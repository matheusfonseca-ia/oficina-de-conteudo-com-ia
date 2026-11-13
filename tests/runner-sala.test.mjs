import test from 'node:test';
import assert from 'node:assert/strict';
import { argsSala, extrairJSON, secaoAprendizados } from '../lib/runner-sala.mjs';

test('argsSala: no tools by default; listed tools are the only ones allowed', () => {
  const a = argsSala('oi');
  assert.equal(a[a.indexOf('--tools') + 1], ''); assert.ok(!a.includes('--allowedTools'));
  assert.equal(a[a.indexOf('--max-turns') + 1], '2');
  const b = argsSala('oi', { ferramentas: ['WebSearch', 'WebFetch'], maxTurnos: 30 });
  assert.equal(b[b.indexOf('--tools') + 1], 'WebSearch,WebFetch');
  assert.equal(b[b.indexOf('--allowedTools') + 1], 'WebSearch,WebFetch');
  assert.equal(b[b.indexOf('--max-turns') + 1], '30');
  for (const f of ['--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']) assert.ok(b.includes(f), f);
  assert.equal(b[b.indexOf('--settings') + 1], '{"disableAllHooks":true}');
});

test('extrairJSON finds the object inside text and returns null on garbage', () => {
  assert.deepEqual(extrairJSON('ok:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(extrairJSON('nada'), null);
  assert.equal(extrairJSON('{quebrado'), null);
});

test('secaoAprendizados is empty without lines and labelled as taste with them', () => {
  assert.equal(secaoAprendizados(''), '');
  assert.match(secaoAprendizados('- 2026-11-01: x'), /Ajustes que o dono já pediu em outros vídeos/);
});
