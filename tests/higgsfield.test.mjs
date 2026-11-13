import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarHiggsfield, gerarCapaIA } from '../lib/higgsfield.mjs';
import { iniciarHiggsfieldFalso, CHAVE_CERTA } from './fixtures/higgsfield-falso.mjs';

async function cenario(t, modo) {
  const hf = await iniciarHiggsfieldFalso({ modo });
  t.after(() => hf.fechar());
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-hf-'));
  const frame = path.join(pasta, 'frame.jpg'); fs.writeFileSync(frame, 'jpg');
  const gerar = (extra = {}) => gerarCapaIA({ chave: CHAVE_CERTA, frame, prompt: 'a person', proporcao: '9:16', destino: path.join(pasta, 'capa-ia.png'), base: hf.base, intervaloMs: 5, ...extra });
  return { hf, pasta, gerar };
}

test('testar aceita a chave certa e recusa a errada', async t => {
  const { hf } = await cenario(t);
  await criarHiggsfield({ chave: CHAVE_CERTA, base: hf.base }).testar();
  await assert.rejects(criarHiggsfield({ chave: 'x:y', base: hf.base }).testar(), /não funcionou/);
});

test('gerarCapaIA sobe o frame, gera em 9:16 2k e grava o PNG', async t => {
  const { hf, pasta, gerar } = await cenario(t);
  const destino = await gerar();
  assert.equal(destino, path.join(pasta, 'capa-ia.png'));
  assert.ok(fs.readFileSync(destino).subarray(1, 4).toString() === 'PNG');
  const put = hf.chamadas.find(c => c.metodo === 'PUT');
  assert.equal(put.cabecalhos.authorization, undefined, 'credenciais não vão pro upload');
  assert.equal(put.cabecalhos['x-amz-tagging'], 'a=b');
  const gen = hf.chamadas.find(c => c.caminho === '/alibaba/qwen-image-3/edit');
  assert.equal(gen.cabecalhos.authorization, `Key ${CHAVE_CERTA}`);
  const corpo = JSON.parse(gen.corpo);
  assert.equal(corpo.aspect_ratio, '9:16'); assert.equal(corpo.resolution, '2k'); assert.equal(corpo.prompt, 'a person');
  assert.match(corpo.image_urls[0], /\/publico\/\d+\.jpg$/);
});

test('nsfw vira "recusou a imagem"', async t => {
  const { gerar } = await cenario(t, 'nsfw');
  await assert.rejects(gerar(), /recusou a imagem/);
});

test('failed vira "não conseguiu gerar"', async t => {
  const { gerar } = await cenario(t, 'failed');
  await assert.rejects(gerar(), /não conseguiu gerar/);
});

test('402 vira "Acabaram os créditos"', async t => {
  const { gerar } = await cenario(t, 'sem-credito');
  await assert.rejects(gerar(), /Acabaram os créditos/);
});

test('chave errada na geração vira "não funcionou"', async t => {
  const { gerar } = await cenario(t);
  await assert.rejects(gerar({ chave: 'x:y' }), /não funcionou/);
});

test('signal abortado para a espera', async t => {
  const { gerar } = await cenario(t);
  const ctrl = new AbortController(); ctrl.abort(new Error('fechou'));
  await assert.rejects(gerar({ signal: ctrl.signal }));
});

test('testar sem rede ou travado vira SEM_CONEXAO, e não fica pendurado', async () => {
  const caiu = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(criarHiggsfield({ chave: 'a:b', base: 'http://x', fetch: caiu }).testar(), e => e.code === 'SEM_CONEXAO');
  const travado = (url, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason)));
  const ini = Date.now();
  await assert.rejects(criarHiggsfield({ chave: 'a:b', base: 'http://x', fetch: travado, tempoTesteMs: 50 }).testar(), e => e.code === 'SEM_CONEXAO');
  assert.ok(Date.now() - ini < 2000);
});
