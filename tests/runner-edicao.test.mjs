import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { argsEdicao, lerEstado, rodarEdicao, prepararPasta, COMANDOS } from '../lib/runner-edicao.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const config = { claude: { command: process.execPath, prefixArgs: [FAKE] }, skillsDir: '/s', maquinaDir: '/m', modeloEdicao: null };
const pasta = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-ed-')); prepararPasta(p, 'v1'); return p; };

test('argsEdicao: first run creates the session, later runs resume it; terminal on, MCP off', () => {
  const a = argsEdicao({ comando: 'PREPARAR', sessao: 'u-1', retomar: false, skillsDir: '/s', maquinaDir: '/m' });
  assert.equal(a[0], '-p'); assert.equal(a[1], '/oficina-de-conteudo-motor PREPARAR');
  assert.ok(a.includes('--session-id') && a[a.indexOf('--session-id') + 1] === 'u-1');
  assert.ok(!a.includes('--resume'));
  assert.equal(a[a.indexOf('--permission-mode') + 1], 'dontAsk');
  for (const t of ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'WebSearch', 'WebFetch'])
    assert.ok(a[a.indexOf('--allowedTools') + 1].split(',').includes(t), t);
  assert.ok(a.includes('--strict-mcp-config'));
  assert.deepEqual(a.slice(a.indexOf('--add-dir') + 1, a.indexOf('--add-dir') + 3), ['/s', '/m']);
  assert.ok(!a.includes('--no-session-persistence') && !a.includes('--disable-slash-commands'));
  const b = argsEdicao({ comando: 'REVISAR: legenda maior', sessao: 'u-1', retomar: true, skillsDir: '/s', maquinaDir: '/m', modelo: 'opus' });
  assert.equal(b[b.indexOf('--resume') + 1], 'u-1'); assert.ok(!b.includes('--session-id'));
  assert.equal(b[b.indexOf('--model') + 1], 'opus');
});

test('prepararPasta writes edit/escritorio.json', () => {
  const p = pasta();
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(p, 'edit', 'escritorio.json'))), { versao: 1, fichaId: 'v1' });
});

test('lerEstado: missing or corrupted file is null, fields get defaults', () => {
  const p = pasta(); assert.equal(lerEstado(p), null);
  fs.writeFileSync(path.join(p, 'edit', 'estado.json'), '{'); assert.equal(lerEstado(p), null);
  fs.writeFileSync(path.join(p, 'edit', 'estado.json'), '{"etapa":"montando"}');
  assert.deepEqual(lerEstado(p), { etapa: 'montando', progresso: 0, mensagem: '', studioUrl: null, erro: null });
});

test('rodarEdicao PREPARAR with a new session returns the state and the session id', async () => {
  const p = pasta(); const ficha = { id: 'v1', edicao: { sessao: null } };
  const r = await rodarEdicao({ pastaVideo: p, ficha, comando: COMANDOS.preparar, config });
  assert.equal(r.estado.etapa, 'aguardando-escolhas'); assert.match(r.sessao, /^[0-9a-f-]{36}$/);
});

test('rodarEdicao fails in pt-BR when the Máquina reports an error', async () => {
  const p = pasta(); process.env.OFC_TEST_MODO = 'erro';
  try {
    await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.montar, config }), /Falta instalar o FFmpeg/);
  } finally { delete process.env.OFC_TEST_MODO; }
});

test('rodarEdicao fails clearly when estado.json is missing, corrupted or Claude returns nothing', async () => {
  for (const [modo, msg] of [['sem-estado', /não deixou o andamento/], ['corrompido', /não deixou o andamento/], ['sem-resultado', /resultado/]]) {
    const p = pasta(); process.env.OFC_TEST_MODO = modo;
    try { await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.exportar, config }), msg, modo); }
    finally { delete process.env.OFC_TEST_MODO; }
  }
});

test('REABRIR_STUDIO returns the new Studio URL', async () => {
  const p = pasta();
  const r = await rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.reabrir, config });
  assert.equal(r.estado.etapa, 'revisao'); assert.equal(r.estado.studioUrl, 'http://127.0.0.1:9/');
});

test('rodarEdicao ignores a stale estado.json left by a previous run', async () => {
  const p = pasta();
  const antigo = path.join(p, 'edit', 'estado.json');
  fs.writeFileSync(antigo, JSON.stringify({ etapa: 'revisao', studioUrl: 'http://velho' }));
  const velho = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(antigo, velho, velho);
  process.env.OFC_TEST_MODO = 'sem-estado';
  try {
    await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.reabrir, config }), /não deixou o andamento/);
  } finally { delete process.env.OFC_TEST_MODO; }
});

test('rodarEdicao REVISAR: keeps the prefix and reaches revisao', async () => {
  const p = pasta();
  const r = await rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: 'REVISAR: legenda maior', config });
  assert.equal(r.estado.etapa, 'revisao');
});

test('rodarEdicao rejects an unknown comando before running Claude', async () => {
  const p = pasta();
  await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: 'FOO', config }), /Comando desconhecido para a Máquina: FOO/);
});

test('rodarEdicao refuses a run that stops in the wrong etapa', async () => {
  const p = pasta();
  const run = async ({ cwd }) => { fs.writeFileSync(path.join(cwd, 'edit', 'estado.json'), JSON.stringify({ etapa: 'montando', progresso: 0.3 })); return { text: 'ok' }; };
  await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.montar, config, run }), /parou em "montando"/);
});

test('argsEdicao: --tools carries the same list as --allowedTools, PowerShell only on Windows, hooks off', () => {
  const win = argsEdicao({ comando: 'PREPARAR', sessao: 'u', retomar: false, skillsDir: '/s', maquinaDir: '/m', plataforma: 'win32' });
  const mac = argsEdicao({ comando: 'PREPARAR', sessao: 'u', retomar: false, skillsDir: '/s', maquinaDir: '/m', plataforma: 'darwin' });
  for (const a of [win, mac]) {
    assert.equal(a[a.indexOf('--tools') + 1], a[a.indexOf('--allowedTools') + 1]);
    assert.deepEqual(JSON.parse(a[a.indexOf('--settings') + 1]), { disableAllHooks: true });
  }
  assert.ok(win[win.indexOf('--tools') + 1].split(',').includes('PowerShell'));
  assert.ok(!mac[mac.indexOf('--tools') + 1].split(',').includes('PowerShell'));
});

test('rodarEdicao runs the child without CLAUDECODE in its env', async () => {
  const p = pasta(); let env = null; const antes = process.env.CLAUDECODE; process.env.CLAUDECODE = '1';
  const run = async (o) => { env = o.env; fs.writeFileSync(path.join(o.cwd, 'edit', 'estado.json'), JSON.stringify({ etapa: 'revisao', studioUrl: 'http://s' })); return { text: 'ok' }; };
  try { await rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.reabrir, config, run }); }
  finally { if (antes === undefined) delete process.env.CLAUDECODE; else process.env.CLAUDECODE = antes; }
  assert.ok(env && !('CLAUDECODE' in env)); assert.equal(env.PATH ?? env.Path, process.env.PATH ?? process.env.Path);
});

test('EXPORTAR without edit/final.mp4 or edit/resumo.md fails in pt-BR', async () => {
  for (const [modo, msg] of [['sem-mp4', /sem o MP4 final \(edit\/final\.mp4\)/], ['sem-resumo', /sem o resumo do vídeo \(edit\/resumo\.md\)/]]) {
    const p = pasta(); process.env.OFC_TEST_MODO = modo;
    try { await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.exportar, config }), msg, modo); }
    finally { delete process.env.OFC_TEST_MODO; }
  }
});

test('EXPORTAR with an empty final.mp4 fails', async () => {
  const p = pasta();
  const run = async ({ cwd }) => {
    fs.writeFileSync(path.join(cwd, 'edit', 'estado.json'), JSON.stringify({ etapa: 'exportado' }));
    fs.writeFileSync(path.join(cwd, 'edit', 'final.mp4'), ''); fs.writeFileSync(path.join(cwd, 'edit', 'resumo.md'), 'Tema: x');
    return { text: 'ok' };
  };
  await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.exportar, config, run }), /sem o MP4 final/);
});

test('a run that ends without a result but wrote the expected fresh estado.json counts as done', async () => {
  const p = pasta(); process.env.OFC_TEST_MODO = 'sem-resultado-feito';
  try {
    const r = await rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.exportar, config });
    assert.equal(r.estado.etapa, 'exportado');
  } finally { delete process.env.OFC_TEST_MODO; }
});

test('a run that ends without a result and a stale or wrong estado.json still fails', async () => {
  const p = pasta();
  const run = async ({ cwd }) => { fs.writeFileSync(path.join(cwd, 'edit', 'estado.json'), JSON.stringify({ etapa: 'montando' })); throw new Error('O Claude não devolveu um resultado concluído.'); };
  await assert.rejects(rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: 's' } }, comando: COMANDOS.montar, config, run }), /terminou sem resultado/);
});
