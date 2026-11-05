import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PaineisMaquina } from '../lib/painel-maquina.mjs';

const SCRIPT = path.resolve('tests/fixtures/painel-falso.mjs');

test('abrir returns the URL, reuses it while open, and reports the exit code', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-pn-'));
  const p = new PaineisMaquina({ skillsDir: '/s', script: SCRIPT });
  let codigo = null, terminou;
  const fim = new Promise(r => { terminou = r; });
  const url = await p.abrir('v1', pasta, c => { codigo = c; terminou(); });
  assert.equal(url, 'http://localhost:4517/');
  assert.equal(await p.abrir('v1', pasta, () => {}), url);
  assert.equal(p.aberto('v1'), url);
  await fim;
  assert.equal(codigo, 0); assert.equal(p.aberto('v1'), null);
  assert.ok(fs.existsSync(path.join(pasta, 'edit', 'escolhas.json')));
});

test('a panel that dies before printing the URL rejects in pt-BR', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-pn-'));
  const ruim = path.join(pasta, 'ruim.mjs'); fs.writeFileSync(ruim, 'process.exit(1)');
  await assert.rejects(new PaineisMaquina({ skillsDir: '/s', script: ruim }).abrir('v1', pasta, () => {}), /não abriu/);
});
