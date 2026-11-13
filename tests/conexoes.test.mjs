import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estadoConexoes, chaveDe, conectar, desconectar, redesPreferidas, salvarRedes, SERVICOS } from '../lib/conexoes.mjs';

const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-con-'));
const lerConfig = d => JSON.parse(fs.readFileSync(path.join(d, 'config.json'), 'utf8'));
const ok = async () => {};
const falha = async () => { throw new Error('401'); };

test('SERVICOS has higgsfield and postForMe', () => { assert.deepEqual(SERVICOS, ['higgsfield', 'postForMe']); });

test('sem config.json nada está conectado', () => {
  const d = pasta();
  assert.deepEqual(estadoConexoes(d), { higgsfield: false, postForMe: false });
  assert.equal(chaveDe(d, 'higgsfield'), null);
});

test('conectar limpa espaços, testa, grava e preserva o resto do config.json', async () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ porta: 5000 }));
  let testada = null;
  const r = await conectar(d, 'higgsfield', '  a: b ', { testar: async c => { testada = c; } });
  assert.equal(testada, 'a:b');
  assert.deepEqual(r, { higgsfield: true, postForMe: false });
  assert.deepEqual(lerConfig(d), { porta: 5000, higgsfield: 'a:b' });
  assert.equal(chaveDe(d, 'higgsfield'), 'a:b');
});

test('chave sem ":" é recusada e não é gravada', async () => {
  const d = pasta();
  await assert.rejects(conectar(d, 'higgsfield', 'abc', { testar: ok }), /formato ID:SEGREDO/);
  assert.equal(fs.existsSync(path.join(d, 'config.json')), false);
});

test('chave que falha no teste não é gravada', async () => {
  const d = pasta();
  await assert.rejects(conectar(d, 'higgsfield', 'a:b', { testar: falha }), /não funcionou/);
  assert.equal(chaveDe(d, 'higgsfield'), null);
});

test('serviço desconhecido é recusado', async () => {
  await assert.rejects(conectar(pasta(), 'outro', 'a:b', { testar: ok }), /não conheço/);
});

test('desconectar remove só a chave', async () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ porta: 5000, higgsfield: 'a:b' }));
  assert.deepEqual(desconectar(d, 'higgsfield'), { higgsfield: false, postForMe: false });
  assert.deepEqual(lerConfig(d), { porta: 5000 });
});

test('estadoConexoes nunca traz a chave', async () => {
  const d = pasta();
  await conectar(d, 'higgsfield', 'segredo:muito', { testar: ok });
  assert.ok(!JSON.stringify(estadoConexoes(d)).includes('segredo'));
});

test('sem internet não diz que a chave está errada', async () => {
  const semRede = async () => { const e = new Error('rede'); e.code = 'SEM_CONEXAO'; throw e; };
  await assert.rejects(conectar(pasta(), 'higgsfield', 'a:b', { testar: semRede }), /Não consegui falar com o Higgsfield/);
});

const CHAVE_PFM = 'pfm_chave_de_teste_123';

test('Post for Me: conectar limpa espaços, testa, grava e preserva a chave do Higgsfield', async () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ higgsfield: 'a:b', porta: 5000 }));
  let testada = null;
  const r = await conectar(d, 'postForMe', `  ${CHAVE_PFM} `, { testar: async c => { testada = c; } });
  assert.equal(testada, CHAVE_PFM);
  assert.deepEqual(r, { higgsfield: true, postForMe: true });
  assert.deepEqual(lerConfig(d), { higgsfield: 'a:b', porta: 5000, postForMe: CHAVE_PFM });
  assert.equal(chaveDe(d, 'postForMe'), CHAVE_PFM);
});

test('Post for Me: chave curta é recusada e não é gravada', async () => {
  const d = pasta();
  await assert.rejects(conectar(d, 'postForMe', 'abc', { testar: ok }), /chave inteira do Post for Me/);
  assert.equal(fs.existsSync(path.join(d, 'config.json')), false);
});

test('Post for Me: chave que falha no teste não é gravada, e sem internet o aviso é outro', async () => {
  const d = pasta();
  await assert.rejects(conectar(d, 'postForMe', CHAVE_PFM, { testar: falha }), /chave do Post for Me não funcionou/);
  const semRede = async () => { const e = new Error('rede'); e.code = 'SEM_CONEXAO'; throw e; };
  await assert.rejects(conectar(d, 'postForMe', CHAVE_PFM, { testar: semRede }), /Não consegui falar com o Post for Me/);
  assert.equal(chaveDe(d, 'postForMe'), null);
});

test('Post for Me: estadoConexoes nunca traz a chave', async () => {
  const d = pasta();
  await conectar(d, 'postForMe', CHAVE_PFM, { testar: ok });
  const estado = estadoConexoes(d);
  assert.deepEqual(estado, { higgsfield: false, postForMe: true });
  assert.ok(!JSON.stringify(estado).includes(CHAVE_PFM));
});

test('redes: sem config.json não há redes preferidas', () => {
  assert.deepEqual(redesPreferidas(pasta()), []);
});

test('redes: salvarRedes e redesPreferidas dão ida e volta, preservando o resto do config.json', () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ higgsfield: 'a:b', postForMe: CHAVE_PFM, porta: 5000 }));
  salvarRedes(d, ['spc_tt', 'spc_yt']);
  assert.deepEqual(redesPreferidas(d), ['spc_tt', 'spc_yt']);
  assert.deepEqual(lerConfig(d), { higgsfield: 'a:b', postForMe: CHAVE_PFM, porta: 5000, redes: ['spc_tt', 'spc_yt'] });
  salvarRedes(d, []);
  assert.deepEqual(redesPreferidas(d), []);
  assert.equal(chaveDe(d, 'higgsfield'), 'a:b');
});

test('redes: só guarda textos, no máximo 20', () => {
  const d = pasta();
  salvarRedes(d, ['spc_a', 5, null, { id: 'x' }, 'spc_b']);
  assert.deepEqual(redesPreferidas(d), ['spc_a', 'spc_b']);
  salvarRedes(d, Array.from({ length: 30 }, (_, i) => `spc_${i}`));
  assert.equal(redesPreferidas(d).length, 20);
  salvarRedes(d, 'spc_tt');
  assert.deepEqual(redesPreferidas(d), []);
});

test('redes: config.json com "redes" torto devolve lista vazia', () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ redes: 'spc_tt' }));
  assert.deepEqual(redesPreferidas(d), []);
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ redes: ['spc_tt', 3] }));
  assert.deepEqual(redesPreferidas(d), ['spc_tt']);
});

test('desconectar o Post for Me apaga a chave e as redes, e deixa o Higgsfield', async () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ porta: 5000, higgsfield: 'a:b', postForMe: CHAVE_PFM, redes: ['spc_tt'] }));
  assert.deepEqual(desconectar(d, 'postForMe'), { higgsfield: true, postForMe: false });
  assert.deepEqual(lerConfig(d), { porta: 5000, higgsfield: 'a:b' });
  assert.deepEqual(redesPreferidas(d), []);
});

test('desconectar o Higgsfield não mexe nas redes', () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ higgsfield: 'a:b', postForMe: CHAVE_PFM, redes: ['spc_tt'] }));
  desconectar(d, 'higgsfield');
  assert.deepEqual(redesPreferidas(d), ['spc_tt']);
});
