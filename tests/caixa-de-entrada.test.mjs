import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FichasStore } from '../lib/fichas-store.mjs';
import { CaixaDeEntrada } from '../lib/caixa-de-entrada.mjs';

function montar() {
  const store = new FichasStore(fs.mkdtempSync(path.join(os.tmpdir(), 'esc-caixa-'))); store.garantirPastas();
  const criadas = [];
  const caixa = new CaixaDeEntrada({ store, pular: ['pesquisa', 'roteiro', 'capa', 'analise'], aoCriar: f => criadas.push(f), agora: () => Date.UTC(2026, 10, 5) });
  return { store, caixa, criadas, em: n => path.join(store.caixaDir, n) };
}

test('a file becomes a ficha only after its size is stable across two scans', () => {
  const { store, caixa, em } = montar();
  fs.writeFileSync(em('Gravação.mp4'), 'abc');
  assert.equal(caixa.varrer().length, 0);           // first sighting
  fs.appendFileSync(em('Gravação.mp4'), 'def');      // still growing
  assert.equal(caixa.varrer().length, 0);
  const [f] = caixa.varrer();                        // stable now
  assert.equal(f.id, '2026-11-05-gravacao'); assert.equal(f.etapa, 'bruto-recebido'); assert.equal(f.bruto, 'bruto.mp4');
  assert.equal(fs.readFileSync(path.join(store.pasta(f.id), 'bruto.mp4'), 'utf8'), 'abcdef');
  assert.equal(fs.existsSync(em('Gravação.mp4')), false);
  assert.deepEqual(store.carregar(f.id), f);
});

test('hidden partial uploads, empty files and non-video files are ignored', () => {
  const { caixa, em } = montar();
  fs.writeFileSync(em('.parcial-x.mp4'), 'abc'); fs.writeFileSync(em('vazio.mp4'), ''); fs.writeFileSync(em('notas.txt'), 'x');
  caixa.varrer(); assert.equal(caixa.varrer().length, 0);
});

test('two files with the same name in one scan become two fichas', () => {
  const { caixa, em } = montar();
  fs.mkdirSync(em('sub'));
  fs.writeFileSync(em('aula.mp4'), '1'); fs.writeFileSync(em('aula.MOV'), '2');
  caixa.varrer(); const criadas = caixa.varrer();
  assert.deepEqual(criadas.map(f => f.id).sort(), ['2026-11-05-aula', '2026-11-05-aula-2']);
});

test('a locked file is retried on the next scan instead of failing', () => {
  const { caixa, em, criadas } = montar();
  fs.writeFileSync(em('trava.mp4'), 'abc');
  caixa.varrer();
  const original = fs.renameSync; let vezes = 0;
  fs.renameSync = (a, b) => { if (String(a).endsWith('trava.mp4') && vezes++ === 0) { const e = new Error('busy'); e.code = 'EBUSY'; throw e; } return original(a, b); };
  try {
    assert.equal(caixa.varrer().length, 0);
    assert.equal(caixa.varrer().length, 1);
  } finally { fs.renameSync = original; }
  assert.equal(criadas.length, 1);
});

function capturarErros() {
  const original = console.error; const msgs = [];
  console.error = (...a) => msgs.push(a.join(' '));
  return { msgs, restaurar: () => { console.error = original; } };
}

test('a file whose move throws does not starve the others and is retried later', () => {
  const { store, caixa, em, criadas } = montar();
  fs.writeFileSync(em('ruim.mp4'), 'abc'); fs.writeFileSync(em('boa.mp4'), 'xyz');
  caixa.varrer();
  const original = fs.renameSync;
  fs.renameSync = (a, b) => { if (String(a).endsWith('ruim.mp4')) { const e = new Error('no space'); e.code = 'ENOSPC'; throw e; } return original(a, b); };
  const log = capturarErros();
  try {
    assert.deepEqual(caixa.varrer().map(f => f.tema), ['boa']);
    assert.equal(fs.readdirSync(store.videosDir).length, 1);   // pasta da ruim foi removida
    assert.ok(fs.existsSync(em('ruim.mp4')));                  // continua na caixa
    assert.ok(log.msgs.some(m => m.includes('ruim.mp4') && m.includes('no space')));
  } finally { fs.renameSync = original; log.restaurar(); }
  assert.deepEqual(caixa.varrer().map(f => f.tema), ['ruim']);
  assert.equal(criadas.length, 2);
});

test('EXDEV where unlink fails leaves nothing behind and the next scan creates one ficha', () => {
  const { store, caixa, em, criadas } = montar();
  fs.writeFileSync(em('aula.mp4'), 'abc');
  caixa.varrer();
  const renOriginal = fs.renameSync, unlinkOriginal = fs.unlinkSync;
  let exdev = false, busy = false;
  fs.renameSync = (a, b) => { if (!exdev && String(a).endsWith('aula.mp4')) { exdev = true; const e = new Error('cross'); e.code = 'EXDEV'; throw e; } return renOriginal(a, b); };
  fs.unlinkSync = p => { if (!busy && String(p).endsWith('aula.mp4')) { busy = true; const e = new Error('busy'); e.code = 'EBUSY'; throw e; } return unlinkOriginal(p); };
  const log = capturarErros();
  try {
    assert.equal(caixa.varrer().length, 0);
    assert.deepEqual(fs.readdirSync(store.videosDir), []);
    assert.ok(fs.existsSync(em('aula.mp4')));
  } finally { fs.renameSync = renOriginal; fs.unlinkSync = unlinkOriginal; log.restaurar(); }
  assert.equal(caixa.varrer().length, 1);
  assert.equal(criadas.length, 1);
  assert.equal(fs.readdirSync(store.videosDir).length, 1);
});

test('a failed salvar puts the bruto back in the caixa and leaves no folder', () => {
  const { store, caixa, em, criadas } = montar();
  fs.writeFileSync(em('falha.mp4'), 'abc');
  caixa.varrer();
  const salvarOriginal = store.salvar;
  store.salvar = () => { throw new Error('disco cheio'); };
  const log = capturarErros();
  try {
    assert.equal(caixa.varrer().length, 0);
  } finally { store.salvar = salvarOriginal; log.restaurar(); }
  assert.deepEqual(fs.readdirSync(store.videosDir), []);
  assert.equal(fs.readFileSync(em('falha.mp4'), 'utf8'), 'abc');
  assert.ok(log.msgs.some(m => m.includes('falha.mp4') && m.includes('disco cheio')));
  assert.equal(caixa.varrer().length, 1);
  assert.equal(criadas.length, 1);
});

test('varrer({ confiar }) skips the first sighting only for the trusted file', () => {
  const { caixa, em } = montar();
  fs.writeFileSync(em('crescendo.mp4'), 'abc');
  fs.writeFileSync(em('pronto.mp4'), 'xyz');
  const criadas = caixa.varrer({ confiar: 'pronto.mp4' });
  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].tema, 'pronto');
  assert.equal(fs.existsSync(em('crescendo.mp4')), true);
});
