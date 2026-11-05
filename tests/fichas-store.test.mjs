import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FichasStore } from '../lib/fichas-store.mjs';
import { criarFicha } from '../lib/ficha.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'esc-store-'));
const DIA = Date.UTC(2026, 10, 5, 12);

test('novoId: date + slug, accents and spaces cleaned, unique on collision', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  const a = s.novoId('Gravação Final (1).MOV', DIA);
  assert.equal(a, '2026-11-05-gravacao-final-1');
  fs.mkdirSync(s.pasta(a));
  assert.equal(s.novoId('Gravação Final (1).MOV', DIA), '2026-11-05-gravacao-final-1-2');
  assert.equal(s.novoId('!!!.mp4', DIA), '2026-11-05-video');
});

test('salvar is atomic and carregar/listar read it back, newest first', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  const f1 = criarFicha({ id: 'a', porta: 'bruto', agora: 1 }); fs.mkdirSync(s.pasta('a'));
  const f2 = criarFicha({ id: 'b', porta: 'bruto', agora: 2 }); fs.mkdirSync(s.pasta('b'));
  s.salvar(f1); s.salvar(f2);
  assert.deepEqual(s.carregar('a'), f1);
  assert.deepEqual(s.listar().map(f => f.id), ['b', 'a']);
  assert.deepEqual(fs.readdirSync(s.pasta('a')).sort(), ['ficha.json']); // no temp leftovers
});

test('idValido rejects traversal and odd characters', () => {
  const s = new FichasStore(tmp());
  for (const bad of ['../x', 'a/b', 'A', '', 'a..b', 'a\b']) assert.equal(s.idValido(bad), false, bad);
  assert.equal(s.idValido('2026-11-05-video-2'), true);
  assert.equal(s.carregar('../x'), null);
});

test('listar skips folders with a corrupted ficha.json', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  fs.mkdirSync(s.pasta('ruim')); fs.writeFileSync(path.join(s.pasta('ruim'), 'ficha.json'), '{');
  assert.deepEqual(s.listar(), []);
});
