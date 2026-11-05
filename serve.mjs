// Escritório de Conteúdo — local server. npm start → http://localhost:4540
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadConfig, ROOT } from './config.mjs';
import { carregarSalas, salasInativas } from './lib/salas.mjs';
import { resumoDasSalas } from './lib/resumo.mjs';
import { FichasStore } from './lib/fichas-store.mjs';
import { CaixaDeEntrada } from './lib/caixa-de-entrada.mjs';
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
  const checar = checagem || (() => checarFerramentas({ skillsDir: config.skillsDir, maquinaDir: config.maquinaDir }));
  let ultimaChecagem = checar();
  const orquestrador = new Orquestrador({ store, config, cerebroDir: store.cerebroDir, runners });
  const caixa = new CaixaDeEntrada({ store, pular: salasInativas(salas), aoCriar: () => orquestrador.acordar() });
  const paineis = new PaineisMaquina({ skillsDir: config.skillsDir, script: painelScript });
  if (intervaloCaixa) caixa.iniciar(intervaloCaixa);
  orquestrador.retomar();

  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  const corpo = req => new Promise((ok, falha) => { let b = ''; req.on('data', d => { b += d; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { falha(new Error('JSON inválido')); } }); });
  const hostOk = req => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '');

  const server = http.createServer(async (req, res) => {
    try {
      if (!hostOk(req)) return json(res, 403, { erro: 'Acesso só por este computador.' });
      if (req.method === 'POST' && req.headers['x-escritorio'] !== '1') return json(res, 403, { erro: 'Requisição recusada.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/escritorio.html')) {
        const pagina = path.join(ROOT, 'dist', 'escritorio.html');
        if (!fs.existsSync(pagina)) return json(res, 500, { erro: 'Página não construída. Rode: npm run build' });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return fs.createReadStream(pagina).pipe(res);
      }
      if (req.method === 'GET' && url.pathname === '/api/estado') {
        const fichas = store.listar();
        const videos = fichas.map(f => ({ ...f, andamento: orquestrador.andamento(f.id), painelUrl: paineis.aberto(f.id), trabalhando: orquestrador.ocupado(f.id) }));
        return json(res, 200, { versao, salas: resumoDasSalas(salas, fichas, ultimaChecagem), videos, checagem: ultimaChecagem });
      }
      if (req.method === 'POST' && url.pathname === '/api/checagem') { ultimaChecagem = checar(); return json(res, 200, ultimaChecagem); }
      if (req.method === 'POST' && url.pathname === '/api/upload') {
        const nome = path.basename(decodeURIComponent(req.headers['x-nome-arquivo'] || '')).replace(/^\.+/, '');
        if (!nome) return json(res, 400, { erro: 'Arquivo sem nome.' });
        const parcial = path.join(store.caixaDir, `.parcial-${randomBytes(4).toString('hex')}-${nome}`);
        await new Promise((ok, falha) => { const w = fs.createWriteStream(parcial); req.pipe(w); w.on('finish', ok); w.on('error', falha); req.on('error', falha); });
        let destino = path.join(store.caixaDir, nome), n = 2;
        while (fs.existsSync(destino)) destino = path.join(store.caixaDir, `${path.parse(nome).name}-${n++}${path.extname(nome)}`);
        fs.renameSync(parcial, destino);
        caixa.varrer(); caixa.varrer(); // the upload is complete: two scans see a stable size
        return json(res, 200, { ok: true });
      }
      const m = url.pathname.match(/^\/api\/videos\/([^/]+)\/(painel|evento|studio|final\.mp4)$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        const ficha = store.idValido(id) ? store.carregar(id) : null;
        if (!ficha) return json(res, 404, { erro: 'Vídeo não encontrado.' });
        const pasta = store.pasta(id);
        if (m[2] === 'final.mp4' && req.method === 'GET') {
          const arq = path.join(pasta, 'edit', 'final.mp4');
          if (!fs.existsSync(arq)) return json(res, 404, { erro: 'O MP4 ainda não foi exportado.' });
          res.writeHead(200, { 'content-type': 'video/mp4', 'content-disposition': `attachment; filename="${id}.mp4"` });
          return fs.createReadStream(arq).pipe(res);
        }
        if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido.' });
        if (m[2] === 'painel') {
          if (ficha.etapa !== 'escolhas-edicao') return json(res, 409, { erro: 'Este vídeo não está nas escolhas da edição.' });
          const url_ = await paineis.abrir(id, pasta, codigo => { if (codigo === 0) { try { orquestrador.evento(id, { tipo: 'escolhas-prontas' }); } catch (e) { console.error(e.message); } } });
          return json(res, 200, { url: url_ });
        }
        if (m[2] === 'studio') {
          if (ficha.etapa !== 'aprovacao-video') return json(res, 409, { erro: 'Este vídeo não está esperando revisão.' });
          if (ficha.edicao.studioUrl && await responde(ficha.edicao.studioUrl)) return json(res, 200, { url: ficha.edicao.studioUrl });
          const f = await orquestrador.reabrirStudio(id);
          return json(res, 200, { url: f.edicao.studioUrl });
        }
        const ev = await corpo(req);
        if (!EVENTOS_DO_DONO.has(ev.tipo)) return json(res, 400, { erro: 'Ação desconhecida.' });
        try { return json(res, 200, orquestrador.evento(id, { tipo: ev.tipo, texto: ev.texto, sala: ev.sala })); }
        catch (e) { return json(res, 409, { erro: e.message }); }
      }
      return json(res, 404, { erro: 'Não encontrado.' });
    } catch (e) { console.error(e); return json(res, 500, { erro: e.message }); }
  });
  const fechar = () => { caixa.parar(); paineis.fecharTodos(); server.close(); server.closeAllConnections?.(); };
  return { server, orquestrador, caixa, paineis, fechar };
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
    if (e.code === 'EADDRINUSE') { console.log(`O escritório já está aberto em ${url}`); if (process.argv.includes('--abrir')) abrirNavegador(url); process.exit(0); }
    throw e;
  });
  app.server.listen(config.porta, '127.0.0.1', () => {
    console.log(`Escritório de Conteúdo ${versao} → ${url}`);
    console.log(`  dados: ${config.dados}`);
    if (process.argv.includes('--abrir')) abrirNavegador(url);
  });
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { app.fechar(); process.exit(0); });
}
