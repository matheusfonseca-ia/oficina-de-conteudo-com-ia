import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarServidor } from '../serve.mjs';
import { loadConfig } from '../config.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const PAINEL = path.resolve('tests/fixtures/painel-falso.mjs');

async function subir(t) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-srv-'));
  const config = loadConfig({ OFC_DATA: dados, PORT: '0', OFC_CLAUDE_COMMAND: process.execPath, OFC_CLAUDE_PREFIX_ARGS: JSON.stringify([FAKE]) });
  const app = criarServidor({ config, checagem: () => ({ ok: true, mensagem: null, itens: [] }), painelScript: PAINEL, intervaloCaixa: 0 });
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
