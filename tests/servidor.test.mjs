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
  const config = loadConfig({ ESC_DATA: dados, PORT: '0', ESC_CLAUDE_COMMAND: process.execPath, ESC_CLAUDE_PREFIX_ARGS: JSON.stringify([FAKE]) });
  const app = criarServidor({ config, checagem: () => ({ ok: true, mensagem: null, itens: [] }), painelScript: PAINEL, intervaloCaixa: 0 });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  app.iniciar();
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(() => app.fechar());
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'x-escritorio': '1', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body ?? {}) });
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

test('POST without x-escritorio, a foreign Host, a bad id or a forbidden event are refused', async t => {
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
  const log = path.join(dados, 'log.jsonl'); process.env.ESC_TEST_LOG = log;
  try {
    const { url } = await (await post(`/api/videos/${id}/studio`)).json();
    assert.equal(url, 'http://127.0.0.1:9/'); // a porta 9 não responde → reabriu
    assert.match(fs.readFileSync(log, 'utf8'), /REABRIR_STUDIO/);
  } finally { delete process.env.ESC_TEST_LOG; }
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
  const req = http.request(base + '/api/upload', { method: 'POST', headers: { 'x-escritorio': '1', 'x-nome-arquivo': 'x.mp4', 'content-length': '1000' } });
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
  const log = path.join(dados, 'log2.jsonl'); process.env.ESC_TEST_LOG = log;
  try {
    const [a, b] = await Promise.all([post(`/api/videos/${id}/studio`), post(`/api/videos/${id}/studio`)]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal((fs.readFileSync(log, 'utf8').match(/REABRIR_STUDIO/g) || []).length, 1);
  } finally { delete process.env.ESC_TEST_LOG; }
});
