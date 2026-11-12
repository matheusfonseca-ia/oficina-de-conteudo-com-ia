// Oficina de Conteúdo — local server. npm start → http://localhost:4540
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream';
import { pipeline as pipelineP } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { loadConfig, ROOT } from './config.mjs';
import { carregarSalas, salasInativas } from './lib/salas.mjs';
import { resumoDasSalas } from './lib/resumo.mjs';
import { FichasStore } from './lib/fichas-store.mjs';
import { CaixaDeEntrada, EXTENSOES_VIDEO } from './lib/caixa-de-entrada.mjs';
import { Orquestrador } from './lib/orquestrador.mjs';
import { PaineisMaquina } from './lib/painel-maquina.mjs';
import { checarFerramentas } from './lib/checagem.mjs';

const EVENTOS_DO_DONO = new Set(['aprovou', 'revisar', 'tentar-de-novo', 'postado', 'pular']);
const versao = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

async function responde(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.status < 500; } catch { return false; }
}

export function criarServidor({ config = loadConfig(), salas = carregarSalas(), checagem = null, runners, painelScript = null, intervaloCaixa = 2000 } = {}) {
  const store = new FichasStore(config.dados); store.garantirPastas();
  const checar = checagem || (() => checarFerramentas({ skillsDir: config.skillsDir, maquinaDir: config.maquinaDir, claude: config.claude }));
  let ultimaChecagem = { ok: true, mensagem: null, itens: [], conferindo: true };
  const orquestrador = new Orquestrador({ store, config, cerebroDir: store.cerebroDir, runners });
  const caixa = new CaixaDeEntrada({ store, pular: salasInativas(salas), aoCriar: () => orquestrador.acordar() });
  const paineis = new PaineisMaquina({ skillsDir: config.skillsDir, script: painelScript });
  // Trabalho em segundo plano só começa em iniciar(), depois que a porta foi aberta (uma segunda instância não pode retomar nada)
  const iniciar = () => {
    ultimaChecagem = checar();
    if (intervaloCaixa) caixa.iniciar(intervaloCaixa);
    orquestrador.retomar();
  };

  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  const LIMITE_CORPO = 1e6;
  const corpo = req => new Promise((ok, falha) => {
    let b = '', estourou = false;
    req.on('data', d => { if (estourou) return; b += d; if (b.length > LIMITE_CORPO) { estourou = true; b = ''; } });
    req.on('error', falha);
    req.on('end', () => {
      if (estourou) return falha(Object.assign(new Error('Corpo grande demais.'), { status: 413 }));
      let v; try { v = b ? JSON.parse(b) : {}; } catch { return falha(Object.assign(new Error('Corpo da requisição inválido.'), { status: 400 })); }
      if (v === null || typeof v !== 'object' || Array.isArray(v)) return falha(Object.assign(new Error('Corpo da requisição inválido.'), { status: 400 }));
      ok(v);
    });
  });
  const enviar = (res, arq, cabecalhos) => {
    const stream = fs.createReadStream(arq);
    stream.on('error', e => { console.error(e.message); if (!res.headersSent) json(res, 500, { erro: 'Não consegui ler o arquivo: ' + e.message }); else res.destroy(); });
    stream.once('open', () => {
      res.writeHead(200, cabecalhos);
      pipeline(stream, res, err => { if (err) { console.error(err.message); if (!res.writableEnded) res.destroy(); } });
    });
  };
  const nomeSeguro = bruto => {
    const nome = path.basename(bruto).replace(/[<>:"|?*\x00-\x1f]/g, '').replace(/^\.+/, '').replace(/[. ]+$/, '');
    const ext = path.extname(nome); const base = nome.slice(0, nome.length - ext.length).replace(/[. ]+$/, '');
    return base ? base.slice(0, 120) + ext : '';
  };
  // Só a porta em que este servidor está escutando (outro serviço local não pode se passar por ele).
  const hostOk = req => {
    const porta = server.address()?.port;
    return !!porta && [`127.0.0.1:${porta}`, `localhost:${porta}`].includes(req.headers.host || '');
  };

  const server = http.createServer(async (req, res) => {
    try {
      if (!hostOk(req)) return json(res, 403, { erro: 'Acesso só por este computador.' });
      if (req.method === 'POST' && req.headers['x-oficina'] !== '1') return json(res, 403, { erro: 'Requisição recusada.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/oficina.html')) {
        const pagina = path.join(ROOT, 'dist', 'oficina.html');
        if (!fs.existsSync(pagina)) return json(res, 500, { erro: 'Página não construída. Rode: npm run build' });
        return enviar(res, pagina, { 'content-type': 'text/html; charset=utf-8' });
      }
      if (req.method === 'GET' && url.pathname === '/api/estado') {
        const fichas = store.listar();
        const videos = fichas.map(f => ({ ...f, andamento: orquestrador.andamento(f.id), painelUrl: paineis.aberto(f.id), trabalhando: orquestrador.ocupado(f.id) }));
        return json(res, 200, { versao, salas: resumoDasSalas(salas, fichas, ultimaChecagem), videos, checagem: ultimaChecagem });
      }
      if (req.method === 'POST' && url.pathname === '/api/checagem') { ultimaChecagem = checar(); return json(res, 200, ultimaChecagem); }
      if (req.method === 'POST' && url.pathname === '/api/upload') {
        let nomeBruto; try { nomeBruto = decodeURIComponent(req.headers['x-nome-arquivo'] || ''); } catch { return json(res, 400, { erro: 'Nome de arquivo inválido.' }); }
        const nome = nomeSeguro(nomeBruto);
        if (!nome) return json(res, 400, { erro: 'Nome de arquivo inválido.' });
        if (!EXTENSOES_VIDEO.includes(path.extname(nome).toLowerCase())) return json(res, 400, { erro: 'Esse arquivo não é um vídeo. Use MP4, MOV, MKV, WEBM ou M4V.' });
        const parcial = path.join(store.caixaDir, `.parcial-${randomBytes(4).toString('hex')}-${nome}`);
        const w = fs.createWriteStream(parcial);
        try { await pipelineP(req, w); }
        catch (e) {
          w.destroy(); fs.rmSync(parcial, { force: true });
          console.error('upload interrompido:', e.message);
          if (!res.writableEnded && !res.destroyed) json(res, 500, { erro: 'O envio do vídeo foi interrompido. Tente de novo.' });
          return;
        }
        let destino = path.join(store.caixaDir, nome), n = 2;
        while (fs.existsSync(destino)) destino = path.join(store.caixaDir, `${path.parse(nome).name}-${n++}${path.extname(nome)}`);
        fs.renameSync(parcial, destino);
        caixa.varrer({ confiar: path.basename(destino) }); // só este arquivo dispensa a espera de tamanho estável
        return json(res, 200, { ok: true });
      }
      const m = url.pathname.match(/^\/api\/videos\/([^/]+)\/(painel|evento|studio|final\.mp4)$/);
      if (m) {
        let id; try { id = decodeURIComponent(m[1]); } catch { return json(res, 404, { erro: 'Vídeo não encontrado.' }); }
        const ficha = store.idValido(id) ? store.carregar(id) : null;
        if (!ficha) return json(res, 404, { erro: 'Vídeo não encontrado.' });
        const pasta = store.pasta(id);
        if (m[2] === 'final.mp4') {
          if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido.' });
          const arq = path.join(pasta, 'edit', 'final.mp4');
          if (!fs.existsSync(arq)) return json(res, 404, { erro: 'O MP4 ainda não foi exportado.' });
          return enviar(res, arq, { 'content-type': 'video/mp4', 'content-disposition': `attachment; filename="${id}.mp4"` });
        }
        if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido.' });
        if (m[2] === 'painel') {
          if (ficha.etapa !== 'escolhas-edicao') return json(res, 409, { erro: 'Este vídeo não está nas escolhas da edição.' });
          try {
            const url_ = await paineis.abrir(id, pasta, codigo => { if (codigo === 0) { try { orquestrador.evento(id, { tipo: 'escolhas-prontas' }); } catch (e) { console.error(e.message); } } });
            return json(res, 200, { url: url_ });
          } catch (e) { return json(res, 409, { erro: e.message }); }
        }
        if (m[2] === 'studio') {
          if (ficha.etapa !== 'aprovacao-video') return json(res, 409, { erro: 'Este vídeo não está esperando revisão.' });
          if (ficha.edicao.studioUrl && await responde(ficha.edicao.studioUrl)) return json(res, 200, { url: ficha.edicao.studioUrl });
          try { const f = await orquestrador.reabrirStudio(id); return json(res, 200, { url: f.edicao.studioUrl }); }
          catch (e) { return json(res, 409, { erro: `Não consegui abrir o Studio: ${e.message}` }); }
        }
        let ev; try { ev = await corpo(req); } catch (e) { return json(res, e.status || 400, { erro: e.message }); }
        if (!EVENTOS_DO_DONO.has(ev.tipo)) return json(res, 400, { erro: 'Ação desconhecida.' });
        try { return json(res, 200, orquestrador.evento(id, { tipo: ev.tipo, texto: ev.texto, sala: ev.sala })); }
        catch (e) { return json(res, 409, { erro: e.message }); }
      }
      return json(res, 404, { erro: 'Não encontrado.' });
    } catch (e) { console.error(e); return json(res, 500, { erro: e.message }); }
  });
  // Para as edições em andamento (o Claude filho não fica órfão) sem marcar erro: o retomar() da próxima abertura continua.
  // Devolve uma promessa que resolve quando os filhos terminaram (ou depois de alguns segundos).
  const fechar = () => {
    caixa.parar(); paineis.fecharTodos(); server.close(); server.closeAllConnections?.();
    return orquestrador.pararTudo();
  };
  return { server, orquestrador, caixa, paineis, iniciar, fechar };
}

function abrirNavegador(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref();
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const config = loadConfig();
  const url = `http://localhost:${config.porta}`;
  const app = criarServidor({ config });
  app.server.on('error', e => {
    if (e.code === 'EADDRINUSE') { console.log(`A Oficina já está aberta em ${url}`); if (process.argv.includes('--abrir')) abrirNavegador(url); process.exit(0); }
    throw e;
  });
  app.server.listen(config.porta, '127.0.0.1', () => {
    console.log(`Oficina de Conteúdo ${versao} → ${url}`);
    console.log(`  dados: ${config.dados}`);
    app.iniciar(); // retoma o trabalho e confere as ferramentas só depois de ter a porta
    if (process.argv.includes('--abrir')) abrirNavegador(url);
  });
  // Espera os filhos morrerem antes de sair: no Windows o taskkill é filho deste processo e morreria junto.
  let saindo = false;
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { if (saindo) return; saindo = true; app.fechar().finally(() => process.exit(0)); });
}
