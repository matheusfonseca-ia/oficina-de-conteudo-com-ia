import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { estadoConexoes, chaveDe, conectar, desconectar, SERVICOS } from '../lib/conexoes.mjs';

const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-con-'));
const lerConfig = d => JSON.parse(fs.readFileSync(path.join(d, 'config.json'), 'utf8'));
const ok = async () => {};
const falha = async () => { throw new Error('401'); };

test('SERVICOS has higgsfield', () => { assert.ok(SERVICOS.includes('higgsfield')); });

test('sem config.json nada está conectado', () => {
  const d = pasta();
  assert.deepEqual(estadoConexoes(d), { higgsfield: false });
  assert.equal(chaveDe(d, 'higgsfield'), null);
});

test('conectar limpa espaços, testa, grava e preserva o resto do config.json', async () => {
  const d = pasta();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ porta: 5000 }));
  let testada = null;
  const r = await conectar(d, 'higgsfield', '  a: b ', { testar: async c => { testada = c; } });
  assert.equal(testada, 'a:b');
  assert.deepEqual(r, { higgsfield: true });
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
  assert.deepEqual(desconectar(d, 'higgsfield'), { higgsfield: false });
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
