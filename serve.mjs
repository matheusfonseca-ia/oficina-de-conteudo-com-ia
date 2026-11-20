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
import { agenteDaChecagem } from './lib/agente-runner.mjs';
import { criarFicha, aplicar, podeCancelar } from './lib/ficha.mjs';
import { conferirLimites, conferirVideo, legendaDoPost } from './lib/publicar.mjs';
import { lerCerebro, salvarPerfil } from './lib/cerebro.mjs';
import { estadoConexoes, conectar, desconectar, chaveDe, redesPreferidas, salvarRedes, SERVICOS } from './lib/conexoes.mjs';
import { criarHiggsfield } from './lib/higgsfield.mjs';
import { criarPostForMe, ErroPostForMe } from './lib/postforme.mjs';
import { criarRelogio } from './lib/relogio.mjs';
import { escreverResumo, ultimoResumo, contarResumos } from './lib/resumo-da-semana.mjs';

// What the page may ask for. The system events (`publicou`, `ler-numeros`, `cancelou-agendamento`) are NOT here:
// only the clock and the cancel route send them. Cancelling is the route POST /api/videos/:id/cancelar.
const EVENTOS_DO_DONO = new Set(['aprovou', 'revisar', 'tentar-de-novo', 'postado', 'pular', 'escolheu-referencia', 'escolheu-capa', 'republicar', 'postar-na-mao', 'voltar-pra-aprovacao']);
// How each connection checks a key before saving it.
const TESTAR_CHAVE = { higgsfield: chave => criarHiggsfield({ chave }).testar(), postForMe: chave => criarPostForMe({ chave }).testar() };
const SEM_CHAVE_POSTFORME = 'Conecte o Post for Me primeiro.';
// A Post for Me call that hangs must not hold a page request forever (the client reads a timeout as "no connection").
const TEMPO_CHAMADA_MS = 30_000;
const LIMITE_IDEIA = 300;
const versao = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

async function responde(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.status < 500; } catch { return false; }
}

// relogio: `false` = the clock never starts (tests); an object = options for criarRelogio (interval, clock, client...).
export function criarServidor({ config = loadConfig(), salas = carregarSalas(), checagem = null, runners, painelScript = null, intervaloCaixa = 2000, relogio: relogioOpcoes } = {}) {
  const store = new FichasStore(config.dados); store.garantirPastas();
  const checar = checagem || (() => checarFerramentas({ skillsDir: config.skillsDir, maquinaDir: config.maquinaDir, claude: config.claude, agente: agenteDaChecagem(config) }));
  let ultimaChecagem = { ok: true, mensagem: null, itens: [], conferindo: true };
  // A reading postponed because Post for Me refused the key raises the "reconnect" notice (the relógio clears it after a good lap).
  const orquestrador = new Orquestrador({ store, config, cerebroDir: store.cerebroDir, runners, aoAdiar: motivo => { if (motivo === 'CHAVE') relogio.sinalizarChaveRecusada(); } });
  // The weekly summary runs on the Análise room's queue (one Claude at a time there), with the signal of the clock lap that asked for it.
  let resumoEmAndamento = null;
  const resumir = (semana, signal) => {
    const p = orquestrador.limites.analise.run(() => escreverResumo({ cerebroDir: store.cerebroDir, fichas: store.listar(), semana, config, signal }), signal);
    resumoEmAndamento = p.catch(() => {}); // fechar() waits for the Claude child of the summary too
    return p;
  };
  const relogio = criarRelogio({ store, orquestrador, config, cerebroDir: store.cerebroDir, resumir, ...(relogioOpcoes || {}) });
  const caixa = new CaixaDeEntrada({ store, pular: salasInativas(salas), aoCriar: () => orquestrador.acordar() });
  const paineis = new PaineisMaquina({ skillsDir: config.skillsDir, script: painelScript });
  // Trabalho em segundo plano só começa em iniciar(), depois que a porta foi aberta (uma segunda instância não pode retomar nada)
  const iniciar = () => {
    ultimaChecagem = checar();
    if (intervaloCaixa) caixa.iniciar(intervaloCaixa);
    orquestrador.retomar();
    if (relogioOpcoes !== false) relogio.iniciar();
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
  // Recebe o corpo da requisição num arquivo .parcial-* dentro de `pasta`. Devolve o caminho, ou null se o envio caiu.
  const receber = async (req, res, pasta, nome) => {
    const parcial = path.join(pasta, `.parcial-${randomBytes(4).toString('hex')}-${nome}`);
    const w = fs.createWriteStream(parcial);
    try { await pipelineP(req, w); return parcial; }
    catch (e) {
      w.destroy(); fs.rmSync(parcial, { force: true });
      console.error('upload interrompido:', e.message);
      if (!res.writableEnded && !res.destroyed) json(res, 500, { erro: 'O envio do vídeo foi interrompido. Tente de novo.' });
      return null;
    }
  };
  const nomeDoVideo = (req, res) => {
    let nomeBruto; try { nomeBruto = decodeURIComponent(req.headers['x-nome-arquivo'] || ''); } catch { json(res, 400, { erro: 'Nome de arquivo inválido.' }); return null; }
    const nome = nomeSeguro(nomeBruto);
    if (!nome) { json(res, 400, { erro: 'Nome de arquivo inválido.' }); return null; }
    if (!EXTENSOES_VIDEO.includes(path.extname(nome).toLowerCase())) { json(res, 400, { erro: 'Esse arquivo não é um vídeo. Use MP4, MOV, MKV, WEBM ou M4V.' }); return null; }
    return nome;
  };
  // Só a porta em que este servidor está escutando (outro serviço local não pode se passar por ele).
  const hostOk = req => {
    const porta = server.address()?.port;
    return !!porta && [`127.0.0.1:${porta}`, `localhost:${porta}`].includes(req.headers.host || '');
  };

  const server = http.createServer(async (req, res) => {
    try {
      if (!hostOk(req)) return json(res, 403, { erro: 'Acesso só por este computador.' });
      if ((req.method === 'POST' || req.method === 'DELETE') && req.headers['x-oficina'] !== '1') return json(res, 403, { erro: 'Requisição recusada.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/oficina.html')) {
        const pagina = path.join(ROOT, 'dist', 'oficina.html');
        if (!fs.existsSync(pagina)) return json(res, 500, { erro: 'Página não construída. Rode: npm run build' });
        return enviar(res, pagina, { 'content-type': 'text/html; charset=utf-8' });
      }
      if (req.method === 'GET' && url.pathname === '/api/estado') {
        const fichas = store.listar();
        const videos = fichas.map(f => ({ ...f, andamento: orquestrador.andamento(f.id), painelUrl: paineis.aberto(f.id), trabalhando: orquestrador.ocupado(f.id) }));
        return json(res, 200, { versao, salas: resumoDasSalas(salas, fichas, ultimaChecagem, { resumos: contarResumos(store.cerebroDir) }), videos, checagem: ultimaChecagem,
          cerebro: { preenchido: lerCerebro(store.cerebroDir).preenchido }, conexoes: estadoConexoes(config.dados),
          avisos: relogio.avisos(), resumo: ultimoResumo(store.cerebroDir)?.semana || null });
      }
      // The student's connected accounts (and the networks ticked last time). The key never leaves the server.
      if (req.method === 'GET' && url.pathname === '/api/postforme/contas') {
        const chave = chaveDe(config.dados, 'postForMe');
        if (!chave) return json(res, 400, { erro: SEM_CHAVE_POSTFORME });
        try { return json(res, 200, { contas: await criarPostForMe({ chave }).contas(AbortSignal.timeout(TEMPO_CHAMADA_MS)), redes: redesPreferidas(config.dados) }); }
        catch (e) { return json(res, 502, { erro: e.message }); }
      }
      if (req.method === 'GET' && url.pathname === '/api/resumos/ultimo') {
        const resumo = ultimoResumo(store.cerebroDir);
        return resumo ? json(res, 200, resumo) : json(res, 404, { erro: 'Ainda não tem resumo da semana.' });
      }
      if (req.method === 'POST' && url.pathname === '/api/conexoes') {
        let dados; try { dados = await corpo(req); } catch (e) { return json(res, e.status || 400, { erro: e.message }); }
        if (!SERVICOS.includes(dados?.servico)) return json(res, 400, { erro: 'Essa conexão eu não conheço.' });
        try { return json(res, 200, { conexoes: await conectar(config.dados, dados.servico, dados.chave, { testar: TESTAR_CHAVE[dados.servico] }) }); }
        catch (e) { return json(res, 400, { erro: e.message }); }
      }
      const mc = url.pathname.match(/^\/api\/conexoes\/([^/]+)$/);
      if (req.method === 'DELETE' && mc) {
        if (!SERVICOS.includes(mc[1])) return json(res, 400, { erro: 'Essa conexão eu não conheço.' });
        return json(res, 200, { conexoes: desconectar(config.dados, mc[1]) });
      }
      // Covers: only capa-N.png and capa-ia.png from the video's capa/ folder.
      const mcapa = url.pathname.match(/^\/api\/videos\/([^/]+)\/capa\/(capa-(?:\d+|ia)\.png)$/);
      if (req.method === 'GET' && mcapa) {
        let id; try { id = decodeURIComponent(mcapa[1]); } catch { return json(res, 404, { erro: 'Capa não encontrada.' }); }
        const arq = store.idValido(id) ? path.join(store.pasta(id), 'capa', mcapa[2]) : null;
        if (!arq || !fs.existsSync(arq)) return json(res, 404, { erro: 'Capa não encontrada.' });
        return enviar(res, arq, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      }
      if (req.method === 'POST' && url.pathname === '/api/checagem') { ultimaChecagem = checar(); return json(res, 200, ultimaChecagem); }
      if (req.method === 'POST' && url.pathname === '/api/upload') {
        const nome = nomeDoVideo(req, res); if (!nome) return;
        const parcial = await receber(req, res, store.caixaDir, nome); if (!parcial) return;
        let destino = path.join(store.caixaDir, nome), n = 2;
        while (fs.existsSync(destino)) destino = path.join(store.caixaDir, `${path.parse(nome).name}-${n++}${path.extname(nome)}`);
        fs.renameSync(parcial, destino);
        caixa.varrer({ confiar: path.basename(destino) }); // só este arquivo dispensa a espera de tamanho estável
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/cerebro') {
        if (req.method === 'GET') { const { perfil, texto } = lerCerebro(store.cerebroDir); return json(res, 200, { perfil, texto }); }
        if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido.' });
        let dados; try { dados = await corpo(req); } catch (e) { return json(res, e.status || 400, { erro: e.message }); }
        try { return json(res, 200, { perfil: salvarPerfil(store.cerebroDir, dados) }); }
        catch (e) { return json(res, 400, { erro: e.message }); }
      }
      if (req.method === 'POST' && url.pathname === '/api/ideia') {
        let dados; try { dados = await corpo(req); } catch (e) { return json(res, e.status || 400, { erro: e.message }); }
        const tema = typeof dados.tema === 'string' ? dados.tema.replace(/\s+/g, ' ').trim() : '';
        if (!tema) return json(res, 400, { erro: 'Escreva a ideia do vídeo.' });
        if (tema.length > LIMITE_IDEIA) return json(res, 400, { erro: `A ideia pode ter até ${LIMITE_IDEIA} caracteres.` });
        const id = store.novoIdDeTexto(tema);
        fs.mkdirSync(store.pasta(id), { recursive: true });
        const pular = [...salasInativas(salas), ...(dados.pularPesquisa === true ? ['pesquisa'] : [])];
        const ficha = store.salvar(criarFicha({ id, porta: 'ideia', tema, pular }));
        orquestrador.acordar();
        return json(res, 200, ficha);
      }
      const m = url.pathname.match(/^\/api\/videos\/([^/]+)\/(painel|evento|studio|bruto|cancelar|final\.mp4)$/);
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
        if (m[2] === 'bruto') {
          if (ficha.etapa !== 'aguardando-gravacao' || orquestrador.ocupado(id)) return json(res, 409, { erro: 'Este vídeo não está esperando a gravação.' });
          const nome = nomeDoVideo(req, res); if (!nome) return;
          const parcial = await receber(req, res, pasta, nome); if (!parcial) return;
          const arquivo = 'bruto' + path.extname(nome).toLowerCase();
          const destino = path.join(pasta, arquivo);
          const limpar = arq => { try { fs.rmSync(arq, { force: true }); } catch (e) { console.error('limpeza:', e.message); } };
          // O envio demorou: outro envio do mesmo vídeo pode ter chegado primeiro. Confere de novo, sem await até o fim do bloco.
          const atual = store.carregar(id);
          if (atual?.etapa !== 'aguardando-gravacao' || orquestrador.ocupado(id)) { limpar(parcial); return json(res, 409, { erro: 'Este vídeo não está esperando a gravação.' }); }
          // O arquivo vai pro lugar antes do evento: o evento acorda a Edição, que lê o bruto.
          // Aqui não existe bruto vivo desta ficha (a conferência acima garante), então só este bloco pode ter criado o destino.
          let criouDestino = false;
          try {
            fs.renameSync(parcial, destino); criouDestino = true;
            return json(res, 200, orquestrador.evento(id, { tipo: 'bruto', arquivo }));
          } catch (e) { limpar(parcial); if (criouDestino) limpar(destino); return json(res, 409, { erro: e.message }); }
        }
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
        if (m[2] === 'cancelar') {
          if (ficha.etapa !== 'agendado') return json(res, 409, { erro: 'Este vídeo não está agendado.' });
          if (orquestrador.ocupado(id)) return json(res, 409, { erro: 'A sala ainda está trabalhando neste vídeo. Espere terminar.' });
          // The ficha's own rules first (e.g. "já saiu em alguma rede"): nothing is deleted at Post for Me if the ficha would refuse.
          try { aplicar(ficha, { tipo: 'cancelou-agendamento' }); } catch (e) { return json(res, 409, { erro: e.message }); }
          // "Publicar agora", or a time that has come: Post for Me is already pushing it to the networks.
          if (!podeCancelar(ficha.publicacao)) return json(res, 409, { erro: 'Esse post já está sendo publicado e não dá mais pra cancelar por aqui.' });
          const chave = chaveDe(config.dados, 'postForMe');
          if (!chave) return json(res, 400, { erro: SEM_CHAVE_POSTFORME });
          const cliente = criarPostForMe({ chave });
          const postIds = [...new Set(Object.values(ficha.publicacao?.contas || {}).filter(c => c.status === 'esperando' && c.postId).map(c => c.postId))];
          // A post Post for Me no longer has (404: deleted there, or by an earlier cancel that stopped halfway) is already cancelled.
          // Any other failure leaves the ficha as it was: the student can try again.
          try {
            for (const postId of postIds) {
              try { await cliente.cancelar(postId, AbortSignal.timeout(TEMPO_CHAMADA_MS)); }
              catch (e) { if (!(e instanceof ErroPostForMe && e.status === 404)) throw e; }
            }
          } catch (e) { return json(res, 502, { erro: e.message }); }
          try { return json(res, 200, orquestrador.evento(id, { tipo: 'cancelou-agendamento' })); }
          catch (e) { return json(res, 409, { erro: e.message }); }
        }
        let ev; try { ev = await corpo(req); } catch (e) { return json(res, e.status || 400, { erro: e.message }); }
        if (!EVENTOS_DO_DONO.has(ev.tipo)) return json(res, 400, { erro: 'Ação desconhecida.' });
        // Approving for publishing: what would fail every time (caption over a ticked network's limit, no exported MP4)
        // is refused now, while the ficha is still on the approval and the student can untick the network.
        if (ev.tipo === 'aprovou' && ev.publicar && ficha.etapa === 'aprovacao-pacote') {
          const contas = Array.isArray(ev.publicar.contas) ? ev.publicar.contas.filter(c => c && typeof c.id === 'string') : [];
          try { conferirLimites(legendaDoPost(ficha.postagem), contas); conferirVideo(pasta); }
          catch (e) { return json(res, 409, { erro: e.message }); }
        }
        try {
          const nova = orquestrador.evento(id, { tipo: ev.tipo, texto: ev.texto, sala: ev.sala, indice: ev.indice, publicar: ev.publicar, conta: ev.conta });
          // Approving the post for publishing: the ticked networks are the starting point of the next video.
          if (ev.tipo === 'aprovou' && nova.etapa === 'publicando') {
            try { salvarRedes(config.dados, (nova.publicacao?.pedido?.contas || []).map(c => c.id)); } catch (e) { console.error('redes:', e.message); }
          }
          return json(res, 200, nova);
        } catch (e) { return json(res, 409, { erro: e.message }); }
      }
      return json(res, 404, { erro: 'Não encontrado.' });
    } catch (e) { console.error(e); return json(res, 500, { erro: e.message }); }
  });
  // Para as edições em andamento (o Claude filho não fica órfão) sem marcar erro: o retomar() da próxima abertura continua.
  // Devolve uma promessa que resolve quando os filhos terminaram (ou depois de alguns segundos).
  const fechar = () => {
    relogio.parar(); // also aborts the lap in progress (and the weekly summary it may be running)
    caixa.parar(); paineis.fecharTodos(); server.close(); server.closeAllConnections?.();
    return Promise.all([orquestrador.pararTudo(), resumoEmAndamento]).then(() => {});
  };
  return { server, orquestrador, caixa, paineis, relogio, iniciar, fechar };
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
