import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { argsPostagem, lerResposta, rodarPostagem, montarPrompt } from '../lib/runner-postagem.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const config = { claude: { command: process.execPath, prefixArgs: [FAKE] } };
const AGORA = new Date('2026-11-05T12:00:00-03:00');

test('argsPostagem: no tools, no MCP, no skills, no session', () => {
  const a = argsPostagem('oi');
  assert.equal(a[a.indexOf('--tools') + 1], '');
  for (const f of ['--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']) assert.ok(a.includes(f), f);
  assert.equal(a[a.indexOf('--max-turns') + 1], '2');
});

test('montarPrompt carries the summary, the profile and the revision', () => {
  const p = montarPrompt({ resumo: 'Tema: IA', perfil: 'Tom: direto', revisao: 'mais curta', agora: AGORA });
  for (const s of ['Tema: IA', 'Tom: direto', 'mais curta', '2026-11-05']) assert.ok(p.includes(s), s);
});

test('lerResposta extracts JSON even with text around it', () => {
  const r = lerResposta('Aqui vai:\n```json\n{"legenda":"Oi","hashtags":["ia","#reels"],"horario":"2026-11-06T18:00:00-03:00","motivoHorario":"x"}\n```', AGORA);
  assert.equal(r.legenda, 'Oi'); assert.deepEqual(r.hashtags, ['#ia', '#reels']);
});

test('lerResposta: invalid answer is an error in pt-BR', () => {
  assert.throws(() => lerResposta('não sei', AGORA), /não devolveu a legenda/);
  assert.throws(() => lerResposta('{"hashtags":[]}', AGORA), /não devolveu a legenda/);
});

test('lerResposta: a past or invalid time moves to the next day at 18:00 local', () => {
  const r = lerResposta('{"legenda":"a","hashtags":[],"horario":"2020-01-01T10:00:00Z"}', AGORA);
  const h = new Date(r.horario);
  assert.ok(h > AGORA); assert.equal(h.getHours(), 18);
  assert.ok(new Date(lerResposta('{"legenda":"a","hashtags":[],"horario":"amanhã"}', AGORA).horario) > AGORA);
});

test('rodarPostagem reads edit/resumo.md and cerebro/perfil.md and returns the post', async () => {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-post-'));
  const pasta = path.join(dados, 'v'); fs.mkdirSync(path.join(pasta, 'edit'), { recursive: true });
  fs.writeFileSync(path.join(pasta, 'edit', 'resumo.md'), 'Tema: teste');
  fs.mkdirSync(path.join(dados, 'cerebro')); fs.writeFileSync(path.join(dados, 'cerebro', 'perfil.md'), 'Tom: direto');
  const log = path.join(dados, 'log.jsonl'); process.env.ESC_TEST_LOG = log;
  try {
    const r = await rodarPostagem({ pastaVideo: pasta, ficha: { revisao: null }, cerebroDir: path.join(dados, 'cerebro'), config, agora: AGORA });
    assert.equal(r.legenda, 'Legenda de teste');
    const prompt = JSON.parse(fs.readFileSync(log, 'utf8').trim()).args[1];
    assert.ok(prompt.includes('Tema: teste') && prompt.includes('Tom: direto'));
  } finally { delete process.env.ESC_TEST_LOG; }
});

test('rodarPostagem without resumo.md fails clearly', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-post-'));
  await assert.rejects(rodarPostagem({ pastaVideo: pasta, ficha: {}, cerebroDir: pasta, config, agora: AGORA }), /resumo do vídeo/);
});
