import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarServidor } from '../serve.mjs';
import { loadConfig } from '../config.mjs';
import { criarFicha } from '../lib/ficha.mjs';
import { iniciarHiggsfieldFalso, CHAVE_CERTA } from './fixtures/higgsfield-falso.mjs';
import { iniciarPostForMeFalso, CHAVE_PFM } from './fixtures/postforme-falso.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const PAINEL = path.resolve('tests/fixtures/painel-falso.mjs');
// The real cover room needs FFmpeg and a browser: these tests use a fake that writes one tiny PNG per option.
const capaFalsa = async ({ pastaVideo }) => {
  fs.mkdirSync(path.join(pastaVideo, 'capa'), { recursive: true });
  for (const n of [1, 2]) fs.writeFileSync(path.join(pastaVideo, 'capa', `capa-${n}.png`), 'png' + n);
  fs.writeFileSync(path.join(pastaVideo, 'capa', 'frame-01.jpg'), 'jpg');
  return { opcoes: [1, 2].map(n => ({ arquivo: `capa/capa-${n}.png`, titulo: `Título ${n}`, origem: 'fabrica' })), escolhida: 0, aviso: null };
};

// `relogio: false`: o relógio não anda sozinho nestes testes (os que precisam dele chamam app.relogio.volta()).
async function subir(t, { runners, relogio = false } = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-srv-'));
  const config = loadConfig({ OFC_DATA: dados, PORT: '0', OFC_CLAUDE_COMMAND: process.execPath, OFC_CLAUDE_PREFIX_ARGS: JSON.stringify([FAKE]) });
  const app = criarServidor({ config, checagem: () => ({ ok: true, mensagem: null, itens: [] }), painelScript: PAINEL, intervaloCaixa: 0, runners: { capa: capaFalsa, ...runners }, relogio });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  app.iniciar();
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(() => app.fechar());
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'x-oficina': '1', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body ?? {}) });
  const estado = async () => (await fetch(base + '/api/estado')).json();
  const ate = async (cond) => { for (let i = 0; i < 100; i++) { const e = await estado(); if (cond(e)) return e; await new Promise(r => setTimeout(r, 50)); } throw new Error('timeout'); };
  return { base, post, estado, ate, dados, app };
}

test('upload → edição prepara → painel → Studio → aprovar → postagem → pronto-pra-postar → postado', { timeout: 30000 }, async t => {
  const { post, ate, base } = await subir(t);
  assert.equal((await post('/api/upload', new Uint8Array([1, 2, 3]), { 'x-nome-arquivo': encodeURIComponent('Minha aula.mp4'), 'content-type': 'application/octet-stream' })).status, 200);
  let e = await ate(e => e.videos[0]?.etapa === 'escolhas-edicao');
  const id = e.videos[0].id;
  assert.equal(e.salas.find(s => s.chave === 'edicao').estado, 'esperando');
  const { url } = await (await post(`/api/videos/${id}/painel`)).json();
  assert.equal(url, 'http://localhost:4517/');
  e = await ate(e => e.videos[0].etapa === 'aprovacao-video');
  assert.equal(e.videos[0].edicao.studioUrl, 'http://127.0.0.1:9/');
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'aprovou' })).status, 200);
  e = await ate(e => e.videos[0].etapa === 'aprovacao-pacote');
  assert.equal(e.videos[0].postagem.legenda, 'Legenda de teste');
  assert.equal(e.videos[0].capa.opcoes.length, 2);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou' });
  e = await ate(e => e.videos[0].etapa === 'pronto-pra-postar');
  const mp4 = await fetch(`${base}/api/videos/${id}/final.mp4`);
  assert.equal(mp4.status, 200); assert.equal(await mp4.text(), 'mp4');
  await post(`/api/videos/${id}/evento`, { tipo: 'postado' });
  await ate(e => e.videos[0].etapa === 'concluido');
});

test('POST without x-oficina, a foreign Host, a bad id or a forbidden event are refused', async t => {
  const { base, post } = await subir(t);
  assert.equal((await fetch(base + '/api/checagem', { method: 'POST' })).status, 403);
  const http = await import('node:http');
  const status = await new Promise(r => http.get(base + '/api/estado', { headers: { host: 'evil.com' } }, res => { res.resume(); r(res.statusCode); }));
  assert.equal(status, 403); // fetch() cannot override Host, node:http can
  assert.equal((await post('/api/videos/..%2F..%2Fx/evento', { tipo: 'aprovou' })).status, 404);
  assert.equal((await fetch(base + '/api/videos/..%2Fx/final.mp4')).status, 404);
  assert.equal((await post('/api/videos/nao-existe/evento', { tipo: 'aprovou' })).status, 404);
});

test('an event that does not fit the etapa answers 409 with the pt-BR reason', async t => {
  const { post, ate } = await subir(t);
  await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': 'a.mp4', 'content-type': 'application/octet-stream' });
  const e = await ate(e => e.videos[0]?.etapa === 'escolhas-edicao');
  const r = await post(`/api/videos/${e.videos[0].id}/evento`, { tipo: 'postado' });
  assert.equal(r.status, 409); assert.match((await r.json()).erro, /pronto pra postar/);
});

test('studio: a dead Studio URL is reopened with REABRIR_STUDIO', { timeout: 20000 }, async t => {
  const { post, ate, dados } = await subir(t);
  await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': 'b.mp4', 'content-type': 'application/octet-stream' });
  let e = await ate(e => e.videos[0]?.etapa === 'escolhas-edicao');
  const id = e.videos[0].id;
  await post(`/api/videos/${id}/painel`);
  await ate(e => e.videos[0].etapa === 'aprovacao-video');
  const log = path.join(dados, 'log.jsonl'); process.env.OFC_TEST_LOG = log;
  try {
    const { url } = await (await post(`/api/videos/${id}/studio`)).json();
    assert.equal(url, 'http://127.0.0.1:9/'); // a porta 9 não responde → reabriu
    assert.match(fs.readFileSync(log, 'utf8'), /REABRIR_STUDIO/);
  } finally { delete process.env.OFC_TEST_LOG; }
});

test('forbidden event and non-video upload are refused with 400', async t => {
  const { post, ate } = await subir(t);
  assert.equal((await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': 'nota.txt', 'content-type': 'application/octet-stream' })).status, 400);
  assert.equal((await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': '%E0%A4%A', 'content-type': 'application/octet-stream' })).status, 400);
  await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': 'c.mp4', 'content-type': 'application/octet-stream' });
  const e = await ate(e => e.videos[0]?.etapa === 'escolhas-edicao');
  const id = e.videos[0].id;
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'concluiu' })).status, 400);
  assert.equal((await post(`/api/videos/${id}/evento`, 'null')).status, 400);
  assert.equal((await post(`/api/videos/${id}/evento`, '{x')).status, 400);
  assert.equal((await post('/api/videos/%E0%A4%A/evento', {})).status, 404);
});

test('an aborted upload leaves no .parcial file behind', async t => {
  const { base, app } = await subir(t);
  const http = await import('node:http');
  const req = http.request(base + '/api/upload', { method: 'POST', headers: { 'x-oficina': '1', 'x-nome-arquivo': 'x.mp4', 'content-length': '1000' } });
  req.on('error', () => {});
  req.write(Buffer.alloc(100));
  await new Promise(r => setTimeout(r, 150));
  req.destroy();
  await new Promise(r => setTimeout(r, 400));
  const sobras = fs.readdirSync(app.caixa.store.caixaDir).filter(n => n.startsWith('.parcial-'));
  assert.deepEqual(sobras, []);
});

test('two simultaneous /studio calls open the Studio only once', { timeout: 20000 }, async t => {
  const { post, ate, dados } = await subir(t);
  await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': 'd.mp4', 'content-type': 'application/octet-stream' });
  const e = await ate(e => e.videos[0]?.etapa === 'escolhas-edicao');
  const id = e.videos[0].id;
  await post(`/api/videos/${id}/painel`);
  await ate(e => e.videos[0].etapa === 'aprovacao-video');
  const log = path.join(dados, 'log2.jsonl'); process.env.OFC_TEST_LOG = log;
  try {
    const [a, b] = await Promise.all([post(`/api/videos/${id}/studio`), post(`/api/videos/${id}/studio`)]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal((fs.readFileSync(log, 'utf8').match(/REABRIR_STUDIO/g) || []).length, 1);
  } finally { delete process.env.OFC_TEST_LOG; }
});

test('Host must name this server: right port on 127.0.0.1 or localhost, anything else is refused', async t => {
  const { base, app } = await subir(t);
  const porta = app.server.address().port;
  const http = await import('node:http');
  const pedir = host => new Promise(r => http.get(base + '/api/estado', { headers: { host } }, res => { res.resume(); r(res.statusCode); }));
  assert.equal(await pedir(`127.0.0.1:${porta}`), 200);
  assert.equal(await pedir(`localhost:${porta}`), 200);
  assert.equal(await pedir(`localhost:${porta === 1 ? 2 : 1}`), 403);
  assert.equal(await pedir('localhost'), 403);
});

test('fechar() stops a running edição without marking the video as failed', { timeout: 20000 }, async t => {
  const { post, ate, app, dados } = await subir(t);
  const arqPid = path.join(dados, 'pid'); process.env.OFC_TEST_MODO = 'lento'; process.env.OFC_TEST_PID = arqPid;
  try {
    await post('/api/upload', new Uint8Array([1]), { 'x-nome-arquivo': 'e.mp4', 'content-type': 'application/octet-stream' });
    const e = await ate(e => e.videos[0]?.trabalhando && fs.existsSync(arqPid));
    const id = e.videos[0].id, pid = Number(fs.readFileSync(arqPid, 'utf8'));
    await app.fechar();
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
    const ficha = JSON.parse(fs.readFileSync(path.join(dados, 'videos', id, 'ficha.json'), 'utf8'));
    assert.equal(ficha.erro, null); assert.equal(ficha.etapa, 'bruto-recebido');
  } finally { delete process.env.OFC_TEST_MODO; delete process.env.OFC_TEST_PID; }
});

const idDe = (e, id) => e.videos.find(v => v.id === id);
const enviarBruto = (post, id, nome, bytes = new Uint8Array([1, 2, 3])) =>
  post(`/api/videos/${id}/bruto`, bytes, { 'x-nome-arquivo': encodeURIComponent(nome), 'content-type': 'application/octet-stream' });

test('ideia door: pesquisa → escolher → roteiro → aprovar → enviar a gravação → edição', { timeout: 30000 }, async t => {
  const { post, ate, dados } = await subir(t);
  const r = await post('/api/ideia', { tema: 'Como usar o n8n v1.2' });
  assert.equal(r.status, 200);
  const { id } = await r.json();
  assert.match(id, /^\d{4}-\d{2}-\d{2}-como-usar-o-n8n-v1-2$/);
  let e = await ate(e => idDe(e, id)?.etapa === 'escolha-referencia');
  assert.ok(idDe(e, id).pesquisa.referencias.length >= 1);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'escolheu-referencia', indice: 9 })).status, 409);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'escolheu-referencia', indice: 0 })).status, 200);
  await ate(e => idDe(e, id)?.etapa === 'aprovacao-roteiro');
  assert.ok(fs.existsSync(path.join(dados, 'videos', id, 'roteiro.md')));
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'aprovou' })).status, 200);
  await ate(e => idDe(e, id)?.etapa === 'aguardando-gravacao');
  assert.equal((await enviarBruto(post, id, 'gravei.MOV')).status, 200);
  e = await ate(e => idDe(e, id)?.etapa === 'escolhas-edicao');
  assert.equal(idDe(e, id).bruto, 'bruto.mov');
  assert.ok(fs.existsSync(path.join(dados, 'videos', id, 'bruto.mov')));
});

test('ideia: empty or too long idea is refused; pularPesquisa goes straight to the script', { timeout: 20000 }, async t => {
  const { post, ate } = await subir(t);
  const vazia = await post('/api/ideia', { tema: '  ' });
  assert.equal(vazia.status, 400); assert.match((await vazia.json()).erro, /Escreva a ideia/);
  assert.equal((await post('/api/ideia', { tema: 'x'.repeat(301) })).status, 400);
  const { id } = await (await post('/api/ideia', { tema: 'Sem pesquisa', pularPesquisa: true })).json();
  const e = await ate(e => idDe(e, id)?.etapa === 'aprovacao-roteiro');
  assert.ok(idDe(e, id).pular.includes('pesquisa'));
});

test('a recording for a video that is not waiting for it is refused and leaves no file behind', { timeout: 20000 }, async t => {
  const { post, dados } = await subir(t);
  const { id } = await (await post('/api/ideia', { tema: 'Ainda pesquisando' })).json();
  const r = await enviarBruto(post, id, 'a.mp4');
  assert.equal(r.status, 409); assert.match((await r.json()).erro, /não está esperando a gravação/);
  const sobras = fs.readdirSync(path.join(dados, 'videos', id)).filter(n => n.startsWith('bruto') || n.startsWith('.parcial'));
  assert.deepEqual(sobras, []);
});

test('cérebro: estado says empty, POST saves the profile, bad answers are 400 in pt-BR', async t => {
  const { post, estado, base, dados } = await subir(t);
  assert.equal((await estado()).cerebro.preenchido, false);
  const ruim = await post('/api/cerebro', { nicho: '', publico: 'a', tom: 'b' });
  assert.equal(ruim.status, 400); assert.match((await ruim.json()).erro, /nicho/);
  assert.equal((await post('/api/cerebro', { nicho: 'IA', publico: 'lojas', tom: 'direto', arroba: 'eu', referencias: [] })).status, 200);
  assert.equal((await estado()).cerebro.preenchido, true);
  const c = await (await fetch(base + '/api/cerebro')).json();
  assert.equal(c.perfil.arroba, '@eu');
  assert.ok(fs.readFileSync(path.join(dados, 'cerebro', 'perfil.md'), 'utf8').includes('## Público\nlojas'));
});

test('cérebro and ideia POSTs need the x-oficina header', async t => {
  const { base } = await subir(t);
  assert.equal((await fetch(base + '/api/cerebro', { method: 'POST', body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/api/ideia', { method: 'POST', body: JSON.stringify({ tema: 'x' }) })).status, 403);
});

test('two recordings sent at once: one wins, the other is refused and does not delete the winner', { timeout: 30000 }, async t => {
  const { post, ate, dados, base } = await subir(t);
  const { id } = await (await post('/api/ideia', { tema: 'Duas gravações', pularPesquisa: true })).json();
  await ate(e => idDe(e, id)?.etapa === 'aprovacao-roteiro');
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou' });
  await ate(e => idDe(e, id)?.etapa === 'aguardando-gravacao');
  // B: corpo em pedaços. Passa pela checagem de etapa (aguardando-gravacao) e fica no ar até A terminar.
  const http = await import('node:http');
  const respostaB = new Promise((ok, falha) => {
    const reqB = http.request(`${base}/api/videos/${id}/bruto`, { method: 'POST', headers: { 'x-oficina': '1', 'x-nome-arquivo': 'b.mp4', 'content-type': 'application/octet-stream', 'transfer-encoding': 'chunked' } },
      res => { let b = ''; res.on('data', d => b += d); res.on('end', () => ok({ status: res.statusCode, corpo: b })); });
    reqB.on('error', falha);
    reqB.write(Buffer.from([9, 9]));
    globalThis.__fecharB = () => reqB.end(Buffer.from([9]));
  });
  await new Promise(r => setTimeout(r, 200)); // o servidor já recebeu os cabeçalhos de B e passou da checagem de etapa
  const a = await enviarBruto(post, id, 'a.mp4', new Uint8Array([1, 2, 3]));
  assert.equal(a.status, 200);
  globalThis.__fecharB(); delete globalThis.__fecharB;
  const b = await respostaB;
  assert.equal(b.status, 409); assert.match(JSON.parse(b.corpo).erro, /não está esperando a gravação/);
  const e = await ate(e => ['bruto-recebido', 'escolhas-edicao'].includes(idDe(e, id)?.etapa));
  assert.notEqual(idDe(e, id).etapa, 'aguardando-gravacao');
  const pasta = path.join(dados, 'videos', id);
  assert.deepEqual([...fs.readFileSync(path.join(pasta, 'bruto.mp4'))], [1, 2, 3]); // o arquivo de A continua lá, intacto
  assert.deepEqual(fs.readdirSync(pasta).filter(n => n.startsWith('.parcial')), []);
});

test('ideia: a tema that is not a string is refused with 400', async t => {
  const { post } = await subir(t);
  for (const tema of [{ a: 1 }, ['x'], 5, null]) {
    const r = await post('/api/ideia', { tema }); assert.equal(r.status, 400); assert.match((await r.json()).erro, /Escreva a ideia/);
  }
});

async function ateAprovacaoDoPost(t) {
  const s = await subir(t);
  await s.post('/api/upload', new Uint8Array([1, 2, 3]), { 'x-nome-arquivo': encodeURIComponent('Capa.mp4'), 'content-type': 'application/octet-stream' });
  let e = await s.ate(e => e.videos[0]?.etapa === 'escolhas-edicao');
  const id = e.videos[0].id;
  await s.post(`/api/videos/${id}/painel`);
  await s.ate(e => e.videos[0].etapa === 'aprovacao-video');
  await s.post(`/api/videos/${id}/evento`, { tipo: 'aprovou' });
  await s.ate(e => e.videos[0].etapa === 'aprovacao-pacote');
  return { ...s, id };
}

test('capa: escolher outra, servir o PNG e recusar arquivo fora das capas', { timeout: 30000 }, async t => {
  const { post, ate, base, id } = await ateAprovacaoDoPost(t);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'escolheu-capa', indice: 1 })).status, 200);
  await ate(e => e.videos[0].capa.escolhida === 1);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'escolheu-capa', indice: 7 })).status, 409);
  const png = await fetch(`${base}/api/videos/${id}/capa/capa-2.png`);
  assert.equal(png.status, 200); assert.equal(png.headers.get('content-type'), 'image/png'); assert.equal(await png.text(), 'png2');
  for (const ruim of ['frame-01.jpg', '..%2Fficha.json', 'capa-3.png']) assert.equal((await fetch(`${base}/api/videos/${id}/capa/${ruim}`)).status, 404, ruim);
});

test('conexões: conectar o Higgsfield testa a chave e o estado nunca mostra a chave', { timeout: 20000 }, async t => {
  const hf = await iniciarHiggsfieldFalso(); t.after(() => hf.fechar());
  const antes = process.env.OFC_HIGGSFIELD_URL; process.env.OFC_HIGGSFIELD_URL = hf.base;
  t.after(() => { if (antes === undefined) delete process.env.OFC_HIGGSFIELD_URL; else process.env.OFC_HIGGSFIELD_URL = antes; });
  const { post, estado, base } = await subir(t);
  assert.deepEqual((await estado()).conexoes, { higgsfield: false, postForMe: false });
  const errada = await post('/api/conexoes', { servico: 'higgsfield', chave: 'x:y' });
  assert.equal(errada.status, 400); assert.match((await errada.json()).erro, /não funcionou/);
  const certa = await post('/api/conexoes', { servico: 'higgsfield', chave: CHAVE_CERTA });
  assert.equal(certa.status, 200); assert.deepEqual((await certa.json()).conexoes, { higgsfield: true, postForMe: false });
  const e = await (await fetch(base + '/api/estado')).text();
  assert.ok(e.includes('"higgsfield":true') && !e.includes(CHAVE_CERTA));
  assert.equal((await post('/api/conexoes', { servico: 'outro', chave: 'a:b' })).status, 400);
  assert.equal((await fetch(base + '/api/conexoes/higgsfield', { method: 'DELETE' })).status >= 400, true, 'sem x-oficina é recusado');
  const sai = await fetch(base + '/api/conexoes/higgsfield', { method: 'DELETE', headers: { 'x-oficina': '1' } });
  assert.deepEqual((await sai.json()).conexoes, { higgsfield: false, postForMe: false });
});

// ---------- Etapa 4: Post for Me, relógio e Análise ----------

// Post for Me falso e OFC_POSTFORME_URL apontando pra ele durante o teste.
async function comPostForMe(t, opcoes) {
  const pfm = await iniciarPostForMeFalso(opcoes); t.after(() => pfm.fechar());
  const antes = process.env.OFC_POSTFORME_URL; process.env.OFC_POSTFORME_URL = pfm.base;
  t.after(() => { if (antes === undefined) delete process.env.OFC_POSTFORME_URL; else process.env.OFC_POSTFORME_URL = antes; });
  return pfm;
}
const conectarPostForMe = (post, chave = CHAVE_PFM) => post('/api/conexoes', { servico: 'postForMe', chave });
// Como ateAprovacaoDoPost, mas com o Post for Me já conectado (a chave certa do falso).
async function ateAprovacaoDoPostComPfm(t) {
  const s = await ateAprovacaoDoPost(t);
  assert.equal((await conectarPostForMe(s.post)).status, 200);
  return s;
}
const TT = { id: 'spc_tt', plataforma: 'tiktok', usuario: '@teste' };
const YT = { id: 'spc_yt', plataforma: 'youtube', usuario: 'Teste' };
const lerJson = arq => JSON.parse(fs.readFileSync(arq, 'utf8'));

test('conexões: conectar o Post for Me testa a chave, o estado nunca mostra a chave e traz os avisos e o último resumo', { timeout: 20000 }, async t => {
  await comPostForMe(t);
  const { post, estado, base } = await subir(t);
  const e0 = await estado();
  assert.deepEqual(e0.conexoes, { higgsfield: false, postForMe: false });
  assert.deepEqual(e0.avisos, { postForMe: null }); assert.equal(e0.resumo, null);
  const errada = await conectarPostForMe(post, 'chave-errada-1234567');
  assert.equal(errada.status, 400); assert.match((await errada.json()).erro, /não funcionou/);
  const certa = await conectarPostForMe(post);
  assert.equal(certa.status, 200); assert.deepEqual((await certa.json()).conexoes, { higgsfield: false, postForMe: true });
  const texto = await (await fetch(base + '/api/estado')).text();
  assert.ok(texto.includes('"postForMe":true') && !texto.includes(CHAVE_PFM));
  const sai = await fetch(base + '/api/conexoes/postForMe', { method: 'DELETE', headers: { 'x-oficina': '1' } });
  assert.deepEqual((await sai.json()).conexoes, { higgsfield: false, postForMe: false });
});

test('GET /api/postforme/contas: sem chave é 400; com chave traz as 3 contas e as redes do último post; sem internet é 502', { timeout: 20000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, base, dados } = await subir(t);
  const sem = await fetch(base + '/api/postforme/contas');
  assert.equal(sem.status, 400); assert.equal((await sem.json()).erro, 'Conecte o Post for Me primeiro.');
  await conectarPostForMe(post);
  let r = await (await fetch(base + '/api/postforme/contas')).json();
  assert.deepEqual(r.contas.map(c => c.id), ['spc_tt', 'spc_yt', 'spc_ig']);
  assert.deepEqual(r.contas[0], TT); assert.deepEqual(r.redes, []);
  assert.ok(!JSON.stringify(r).includes(CHAVE_PFM));
  const cfg = lerJson(path.join(dados, 'config.json')); cfg.redes = ['spc_yt']; fs.writeFileSync(path.join(dados, 'config.json'), JSON.stringify(cfg));
  r = await (await fetch(base + '/api/postforme/contas')).json();
  assert.deepEqual(r.redes, ['spc_yt']);
  await pfm.fechar();
  const fora = await fetch(base + '/api/postforme/contas');
  assert.equal(fora.status, 502); assert.match((await fora.json()).erro, /Não consegui falar com o Post for Me/);
});

test('aprovar com publicar: a ficha vai pra agendado pelo Post for Me, as redes ficam guardadas e a chave nunca aparece', { timeout: 30000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, base, dados, app, id } = await ateAprovacaoDoPostComPfm(t);
  const r = await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT], quando: null } });
  assert.equal(r.status, 200);
  await app.orquestrador.esperarOcioso();
  const e = await (await fetch(base + '/api/estado')).json();
  const v = e.videos[0];
  assert.equal(v.etapa, 'agendado'); assert.equal(v.erro, null);
  assert.equal(v.publicacao.contas.spc_tt.status, 'esperando'); assert.equal(v.publicacao.contas.spc_tt.postId, 'sp_1');
  assert.equal(v.analise, null); // a ficha completa sai em videos[]: publicacao e analise (ainda vazia)
  assert.deepEqual(lerJson(path.join(dados, 'config.json')).redes, ['spc_tt']);
  assert.equal(pfm.posts.length, 1); assert.deepEqual(pfm.posts[0].social_accounts, ['spc_tt']); assert.equal(pfm.posts[0].external_id, `${id}:1`);
  assert.ok(!JSON.stringify(e).includes(CHAVE_PFM));
  assert.equal(e.salas.find(s => s.chave === 'postagem').estado, 'esperando');
  assert.equal(e.salas.find(s => s.chave === 'analise').ativa, true);
});

test('aprovar com publicar sem nenhuma rede marcada é 409 e não grava as redes', { timeout: 30000 }, async t => {
  await comPostForMe(t);
  const { post, dados, id, estado } = await ateAprovacaoDoPostComPfm(t);
  const r = await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [], quando: null } });
  assert.equal(r.status, 409); assert.match((await r.json()).erro, /pelo menos uma rede/);
  const cfg = lerJson(path.join(dados, 'config.json'));
  assert.equal('redes' in cfg, false);
  assert.equal((await estado()).videos[0].etapa, 'aprovacao-pacote');
});

test('aprovar sem publicar continua levando ao "Postar na mão" e não toca no Post for Me', { timeout: 30000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, ate, id } = await ateAprovacaoDoPostComPfm(t);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'aprovou' })).status, 200);
  await ate(e => e.videos[0].etapa === 'pronto-pra-postar');
  assert.equal(pfm.posts.length, 0);
});

test('cancelar o agendamento apaga o post no Post for Me e a ficha volta pra aprovação do post', { timeout: 30000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, ate, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  // fora de agendado: 409
  const antes = await post(`/api/videos/${id}/cancelar`);
  assert.equal(antes.status, 409); assert.equal((await antes.json()).erro, 'Este vídeo não está agendado.');
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT, YT], quando: null } });
  await app.orquestrador.esperarOcioso();
  assert.equal((await (await fetch(base + '/api/estado')).json()).videos[0].etapa, 'agendado');
  assert.equal((await fetch(`${base}/api/videos/${id}/cancelar`, { method: 'POST' })).status, 403, 'sem x-oficina é recusado');
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 200);
  const e = await ate(e => e.videos[0].etapa === 'aprovacao-pacote');
  assert.equal(e.videos[0].publicacao, null);
  const apagados = pfm.chamadas.filter(c => c.metodo === 'DELETE');
  assert.deepEqual(apagados.map(c => c.caminho), ['/v1/social-posts/sp_1']); // um post só, mesmo com duas redes
  // aprovar de novo depois de cancelar não repete o external_id
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT], quando: null } });
  await app.orquestrador.esperarOcioso();
  assert.equal(pfm.posts.length, 2); assert.equal(pfm.posts[1].external_id, `${id}:2`);
});

test('cancelar com o Post for Me fora do ar é 502 e a ficha continua agendada', { timeout: 30000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT], quando: null } });
  await app.orquestrador.esperarOcioso();
  await pfm.fechar();
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 502); assert.match((await r.json()).erro, /Não consegui falar com o Post for Me/);
  const v = (await (await fetch(base + '/api/estado')).json()).videos[0];
  assert.equal(v.etapa, 'agendado'); assert.equal(v.publicacao.contas.spc_tt.status, 'esperando');
});

test('cancelar um post que já saiu em alguma rede é 409 e não apaga nada', { timeout: 30000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, app, id } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT, YT], quando: null } });
  await app.orquestrador.esperarOcioso();
  const store = app.orquestrador.store;
  const f = store.carregar(id); f.publicacao.contas.spc_tt.status = 'publicado'; store.salvar(f);
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 409); assert.match((await r.json()).erro, /já saiu/);
  assert.equal(pfm.chamadas.filter(c => c.metodo === 'DELETE').length, 0);
});

test('cancelar sem a chave do Post for Me guardada é 400 com o aviso pra conectar', { timeout: 30000 }, async t => {
  await comPostForMe(t);
  const { post, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT], quando: null } });
  await app.orquestrador.esperarOcioso();
  await fetch(base + '/api/conexoes/postForMe', { method: 'DELETE', headers: { 'x-oficina': '1' } });
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 400); assert.equal((await r.json()).erro, 'Conecte o Post for Me primeiro.');
});

test('eventos de sistema (publicou, ler-numeros, cancelou-agendamento) não vêm da página: 400 Ação desconhecida', { timeout: 30000 }, async t => {
  const { post, id } = await ateAprovacaoDoPost(t);
  for (const tipo of ['publicou', 'ler-numeros', 'cancelou-agendamento', 'concluiu']) {
    const r = await post(`/api/videos/${id}/evento`, { tipo, resultados: [], marco: '48h' });
    assert.equal(r.status, 400, tipo); assert.equal((await r.json()).erro, 'Ação desconhecida.', tipo);
  }
});

test('Tentar de novo e Postar na mão numa rede que falhou passam pela página com a conta', { timeout: 40000 }, async t => {
  const pfm = await comPostForMe(t, { modo: 'falha-youtube' });
  const { post, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT, YT], quando: null } });
  await app.orquestrador.esperarOcioso();
  await app.relogio.volta(); // o relógio confere o resultado: tiktok saiu, youtube falhou
  const video = async () => (await (await fetch(base + '/api/estado')).json()).videos[0];
  let v = await video();
  assert.equal(v.etapa, 'aguardando-numeros'); assert.equal(v.publicacao.contas.spc_yt.status, 'falhou'); assert.equal(v.publicacao.contas.spc_tt.status, 'publicado');
  // sem conta ou com uma rede que não falhou: 409
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'republicar' })).status, 409);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'republicar', conta: 'spc_tt' })).status, 409);
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'republicar', conta: 'spc_yt' })).status, 200);
  await app.orquestrador.esperarOcioso();
  v = await video();
  assert.equal(v.etapa, 'agendado'); assert.equal(v.publicacao.contas.spc_yt.status, 'esperando'); assert.equal(v.publicacao.contas.spc_tt.status, 'publicado');
  assert.equal(pfm.posts.length, 2); assert.deepEqual(pfm.posts[1].social_accounts, ['spc_yt']); assert.equal(pfm.posts[1].external_id, `${id}:2`);
  await app.relogio.volta(); // falha de novo (o falso sempre falha o youtube)
  assert.equal((await post(`/api/videos/${id}/evento`, { tipo: 'postar-na-mao', conta: 'spc_yt' })).status, 200);
  v = await video();
  assert.equal(v.publicacao.contas.spc_yt.status, 'manual'); assert.equal(v.etapa, 'aguardando-numeros');
});

test('Análise que adia por chave recusada liga o aviso "reconectar" na página, sem erro na ficha', { timeout: 20000 }, async t => {
  const { app, estado, ate } = await subir(t, { runners: { analise: async () => ({ adiar: true, motivo: 'CHAVE' }) } });
  assert.deepEqual((await estado()).avisos, { postForMe: null });
  const store = app.orquestrador.store; fs.mkdirSync(store.pasta('x'));
  store.salvar({ ...criarFicha({ id: 'x', porta: 'bruto', bruto: 'b.mp4', agora: 1 }), etapa: 'analise',
    publicacao: { publicadoEm: '2026-11-15T12:00:00.000Z', contas: {} }, analise: { proxima: '48h', leituras: [] } });
  app.orquestrador.acordar(); await app.orquestrador.esperarOcioso();
  const e = await ate(e => e.avisos.postForMe === 'reconectar');
  assert.equal(e.videos[0].etapa, 'aguardando-numeros'); assert.equal(e.videos[0].erro, null); assert.equal(e.videos[0].analise.leituras.length, 0);
});

test('GET /api/resumos/ultimo: 404 sem resumo; com resumo traz a semana e o texto; o estado e o contador da Análise acompanham', async t => {
  const { base, estado, dados } = await subir(t);
  const nada = await fetch(base + '/api/resumos/ultimo');
  assert.equal(nada.status, 404); assert.match((await nada.json()).erro, /resumo/i);
  const pasta = path.join(dados, 'cerebro', 'resumos'); fs.mkdirSync(pasta, { recursive: true });
  const texto = '# Resumo da semana de 16/11\n\nTexto do resumo.';
  fs.writeFileSync(path.join(pasta, '2026-11-16.md'), texto);
  fs.writeFileSync(path.join(pasta, 'ultimo.json'), JSON.stringify({ semana: '2026-11-16' }));
  const r = await fetch(base + '/api/resumos/ultimo');
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { semana: '2026-11-16', texto });
  const e = await estado();
  assert.equal(e.resumo, '2026-11-16');
  assert.equal(e.salas.find(s => s.chave === 'analise').contador, 1);
});

test('o relógio do servidor escreve o resumo da semana pelo Claude falso e a rota entrega', { timeout: 30000 }, async t => {
  await comPostForMe(t);
  const { post, app, base } = await subir(t, { relogio: { agora: () => new Date(2026, 10, 23, 8, 0) } });
  const store = app.orquestrador.store; fs.mkdirSync(store.pasta('r1'));
  store.salvar({ ...criarFicha({ id: 'r1', porta: 'bruto', bruto: 'b.mp4', agora: 1 }), etapa: 'concluido', tema: 'IA no varejo',
    analise: { proxima: null, leituras: [{ marco: '7d', em: new Date(2026, 10, 18, 12).toISOString(), numeros: { porRede: {}, total: { visualizacoes: 10 } }, links: {}, resumo: 'ok', funcionou: [], melhorar: [], nota: 4 }] } });
  assert.equal((await fetch(base + '/api/resumos/ultimo')).status, 404);
  await conectarPostForMe(post); // sem a chave guardada o relógio nem sai de casa
  await app.relogio.volta();
  const r = await (await fetch(base + '/api/resumos/ultimo')).json();
  assert.equal(r.semana, '2026-11-16'); assert.match(r.texto, /Post A/);
});

test('o relógio só anda depois de iniciar() e para em fechar(); criarServidor() sozinho não começa nada', async t => {
  let voltas = 0;
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-srv-'));
  t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  const config = loadConfig({ OFC_DATA: dados, PORT: '0', OFC_CLAUDE_COMMAND: process.execPath, OFC_CLAUDE_PREFIX_ARGS: JSON.stringify([FAKE]) });
  const checagem = () => ({ ok: true, mensagem: null, itens: [] });
  const app = criarServidor({ config, checagem, intervaloCaixa: 0, relogio: { cliente: () => { voltas++; return null; }, intervaloMs: 15 } });
  t.after(() => app.fechar());
  await new Promise(r => setTimeout(r, 80));
  assert.equal(voltas, 0);
  app.iniciar();
  await new Promise(r => setTimeout(r, 120));
  assert.ok(voltas >= 2, `voltas: ${voltas}`);
  await app.fechar();
  await new Promise(r => setTimeout(r, 40));
  const parou = voltas;
  await new Promise(r => setTimeout(r, 100));
  assert.equal(voltas, parou);
  // relogio: false nunca inicia
  const sem = criarServidor({ config, checagem, intervaloCaixa: 0, relogio: false });
  sem.iniciar(); await new Promise(r => setTimeout(r, 60)); await sem.fechar();
  assert.equal(voltas, parou);
});

// Apaga no falso (como se tivesse sido apagado no painel do Post for Me) o post `postId`.
const apagarNoFalso = postId => fetch(`${process.env.OFC_POSTFORME_URL}/v1/social-posts/${postId}`, { method: 'DELETE', headers: { authorization: `Bearer ${CHAVE_PFM}` } });

test('cancelar um post que o Post for Me já não tem (404) conta como cancelado: a ficha volta pra aprovação do post', { timeout: 30000 }, async t => {
  const pfm = await comPostForMe(t);
  const { post, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT], quando: null } });
  await app.orquestrador.esperarOcioso();
  assert.equal((await apagarNoFalso('sp_1')).status, 200); // apagado direto no Post for Me
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 200);
  assert.equal(pfm.chamadas.filter(c => c.metodo === 'DELETE').length, 2); // o do teste e o do cancelar (que levou 404)
  const v = (await (await fetch(base + '/api/estado')).json()).videos[0];
  assert.equal(v.etapa, 'aprovacao-pacote'); assert.equal(v.publicacao, null); assert.equal(v.erro, null);
});

test('cancelar com dois posts, o primeiro já apagado: apaga o segundo e a ficha volta pra aprovação do post', { timeout: 40000 }, async t => {
  const pfm = await comPostForMe(t, { modo: 'falha-youtube' });
  const { post, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT, YT], quando: null } });
  await app.orquestrador.esperarOcioso();
  await app.relogio.volta(); // tiktok saiu, youtube falhou
  await post(`/api/videos/${id}/evento`, { tipo: 'republicar', conta: 'spc_yt' }); // segundo post (sp_2), spc_yt esperando
  await app.orquestrador.esperarOcioso();
  // agora: spc_tt publicado (sp_1) e spc_yt esperando (sp_2); com um publicado o cancelamento é recusado, então desfaz o publicado
  const store = app.orquestrador.store;
  const f = store.carregar(id); f.publicacao.contas.spc_tt = { ...f.publicacao.contas.spc_tt, status: 'esperando', postId: 'sp_1' }; store.salvar(f);
  assert.equal((await apagarNoFalso('sp_1')).status, 200); // o primeiro já foi apagado lá
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 200);
  assert.deepEqual(pfm.chamadas.filter(c => c.metodo === 'DELETE').map(c => c.caminho), ['/v1/social-posts/sp_1', '/v1/social-posts/sp_1', '/v1/social-posts/sp_2']);
  const v = (await (await fetch(base + '/api/estado')).json()).videos[0];
  assert.equal(v.etapa, 'aprovacao-pacote'); assert.equal(v.publicacao, null);
});

test('cancelar com outra recusa do Post for Me (não 404) continua sendo 502 com a ficha intacta', { timeout: 30000 }, async t => {
  await comPostForMe(t);
  const { post, app, id, base } = await ateAprovacaoDoPostComPfm(t);
  await post(`/api/videos/${id}/evento`, { tipo: 'aprovou', publicar: { contas: [TT], quando: null } });
  await app.orquestrador.esperarOcioso();
  // chave trocada por uma recusada: o DELETE volta 401 (CHAVE), que não é "post já apagado"
  fs.writeFileSync(path.join(app.orquestrador.config.dados, 'config.json'), JSON.stringify({ postForMe: 'chave-que-o-falso-recusa-123', redes: ['spc_tt'] }));
  const r = await post(`/api/videos/${id}/cancelar`);
  assert.equal(r.status, 502); assert.match((await r.json()).erro, /chave do Post for Me não funcionou/);
  assert.equal((await (await fetch(base + '/api/estado')).json()).videos[0].etapa, 'agendado');
});
