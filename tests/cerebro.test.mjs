import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validarPerfil, salvarPerfil, lerCerebro } from '../lib/cerebro.mjs';
import { registrarAprendizado, lerAprendizados } from '../lib/aprendizados.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-cer-'));
const BOM = { nicho: ' IA pra pequenos negócios ', publico: 'donos de loja', tom: 'direto e brincalhão', arroba: 'matheus.ia', referencias: ['https://instagram.com/reel/1', '', '  '] };

test('validarPerfil trims, adds the @ and drops empty links', () => {
  const p = validarPerfil(BOM);
  assert.equal(p.nicho, 'IA pra pequenos negócios'); assert.equal(p.arroba, '@matheus.ia');
  assert.deepEqual(p.referencias, ['https://instagram.com/reel/1']);
  assert.equal(validarPerfil({ ...BOM, arroba: '' }).arroba, '');
});

test('validarPerfil refuses missing answers, bad @, bad links and too many links, in pt-BR', () => {
  assert.throws(() => validarPerfil({ ...BOM, nicho: ' ' }), /nicho/);
  assert.throws(() => validarPerfil({ ...BOM, publico: '' }), /público/);
  assert.throws(() => validarPerfil({ ...BOM, tom: '' }), /tom de voz/);
  assert.throws(() => validarPerfil({ ...BOM, tom: 'x'.repeat(601) }), /até 600 caracteres/);
  assert.throws(() => validarPerfil({ ...BOM, arroba: 'meu perfil!' }), /@ do perfil/);
  assert.throws(() => validarPerfil({ ...BOM, referencias: ['instagram.com/x'] }), /links/);
  assert.throws(() => validarPerfil({ ...BOM, referencias: ['https://a', 'https://b', 'https://c', 'https://d'] }), /No máximo 3/);
});

test('salvarPerfil writes perfil.json and perfil.md; lerCerebro reads them back', () => {
  const d = tmp();
  assert.equal(lerCerebro(d).preenchido, false);
  salvarPerfil(d, BOM);
  const c = lerCerebro(d);
  assert.equal(c.preenchido, true); assert.equal(c.perfil.publico, 'donos de loja');
  assert.match(c.texto, /## Tom de voz\ndireto e brincalhão/);
  assert.match(c.texto, /- https:\/\/instagram\.com\/reel\/1/);
});

test('a hand-written perfil.md counts as filled and is kept in perfil-antigo.md, only once', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'perfil.md'), 'meu texto');
  assert.equal(lerCerebro(d).preenchido, true);
  salvarPerfil(d, BOM);
  assert.equal(fs.readFileSync(path.join(d, 'perfil-antigo.md'), 'utf8'), 'meu texto');
  salvarPerfil(d, { ...BOM, nicho: 'outro' });
  assert.equal(fs.readFileSync(path.join(d, 'perfil-antigo.md'), 'utf8'), 'meu texto');
});

test('aprendizados: one dated line per adjustment, only for rooms that learn, last N read back', () => {
  const d = tmp(); const dia = new Date('2026-11-12T12:00:00Z');
  assert.equal(registrarAprendizado(d, 'roteiro', '  gancho  mais\n curto ', dia), true);
  assert.equal(registrarAprendizado(d, 'edicao', 'x', dia), false);
  assert.equal(registrarAprendizado(d, 'roteiro', '   ', dia), false);
  for (let i = 0; i < 20; i++) registrarAprendizado(d, 'roteiro', `ajuste ${i}`, dia);
  const t = lerAprendizados(d, 'roteiro', 15);
  assert.equal(t.split('\n').length, 15);
  assert.match(t, /- 2026-11-12: ajuste 19$/); assert.doesNotMatch(t, /gancho/);
  assert.equal(lerAprendizados(d, 'pesquisa'), '');
});
