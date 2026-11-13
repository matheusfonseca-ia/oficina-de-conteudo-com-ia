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
  for (const bad of ['../x', 'a/b', 'A', '', 'a..b', 'a\\b']) assert.equal(s.idValido(bad), false, bad);
  assert.equal(s.idValido('2026-11-05-video-2'), true);
  assert.equal(s.carregar('../x'), null);
});

test('listar skips folders with a corrupted ficha.json', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  fs.mkdirSync(s.pasta('ruim')); fs.writeFileSync(path.join(s.pasta('ruim'), 'ficha.json'), '{');
  assert.deepEqual(s.listar(), []);
});

test('salvar retries a rename blocked for a moment (EPERM/EBUSY/EACCES) and gives up cleanly after 5 tries', () => {
  const s = new FichasStore(tmp()); s.garantirPastas(); fs.mkdirSync(s.pasta('a'));
  const original = fs.renameSync; let falhas = 2, chamadas = 0;
  fs.renameSync = (...a) => { chamadas++; if (falhas-- > 0) throw Object.assign(new Error('ocupado'), { code: chamadas === 1 ? 'EPERM' : 'EBUSY' }); return original(...a); };
  try {
    s.salvar(criarFicha({ id: 'a', porta: 'bruto', agora: 1 }));
    assert.equal(chamadas, 3); assert.equal(s.carregar('a').id, 'a');
    falhas = 99; chamadas = 0;
    assert.throws(() => s.salvar(criarFicha({ id: 'a', porta: 'bruto', agora: 2 })), /ocupado/);
    assert.equal(chamadas, 5);
    assert.deepEqual(fs.readdirSync(s.pasta('a')), ['ficha.json']); // o .tmp não fica pra trás
    falhas = 99; chamadas = 0; fs.renameSync = () => { chamadas++; throw Object.assign(new Error('outro'), { code: 'ENOENT' }); };
    assert.throws(() => s.salvar(criarFicha({ id: 'a', porta: 'bruto', agora: 3 })), /outro/);
    assert.equal(chamadas, 1); // outros erros não são repetidos
  } finally { fs.renameSync = original; }
});

test('novoIdDeTexto: slug of the whole text (dots included), unique on collision', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  const a = s.novoIdDeTexto('Como usar o n8n v1.2', DIA);
  assert.equal(a, '2026-11-05-como-usar-o-n8n-v1-2');
  fs.mkdirSync(s.pasta(a));
  assert.equal(s.novoIdDeTexto('Como usar o n8n v1.2', DIA), '2026-11-05-como-usar-o-n8n-v1-2-2');
  assert.equal(s.novoIdDeTexto('!!!', DIA), '2026-11-05-video');
});

test('novoIdDeTexto: a slug cut at 50 chars never ends in a hyphen (id stays valid)', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  const id = s.novoIdDeTexto('a'.repeat(49) + ' bc', DIA);
  assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.doesNotThrow(() => s.pasta(id));
  assert.equal(id, '2026-11-05-' + 'a'.repeat(49));
});

test('novoIdDeTexto: accents are folded into the slug', () => {
  const s = new FichasStore(tmp()); s.garantirPastas();
  assert.equal(s.novoIdDeTexto('Ação rápida do coração', DIA), '2026-11-05-acao-rapida-do-coracao');
});
