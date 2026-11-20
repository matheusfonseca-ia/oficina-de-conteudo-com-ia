import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MOTORES, idDoMotor, outroMotor } from '../lib/motores.mjs';
import { rodarAgente, resolverComando, agenteDaChecagem } from '../lib/agente-runner.mjs';
import { rodarSala } from '../lib/runner-sala.mjs';
import { rodarEdicao, promptEdicao, COMANDOS } from '../lib/runner-edicao.mjs';
import { checarFerramentas } from '../lib/checagem.mjs';
import { loadConfig } from '../config.mjs';

const FAKE = path.resolve('tests/fixtures/agente-falso.mjs');
const cfg = motor => ({ motor, agente: { command: process.execPath, prefixArgs: [FAKE] }, modelo: null, skillsDir: path.resolve('/s'), maquinaDir: '/m',
  claude: { command: 'nao-existe-claude', prefixArgs: [] }, modeloEdicao: null });
const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-motor-'));
// The fixture reads its behaviour from the environment; the runners pass process.env on to the child.
async function com(env, fn) {
  const antes = {};
  for (const k of Object.keys(env)) { antes[k] = process.env[k]; process.env[k] = env[k]; }
  try { return await fn(); } finally {
    for (const k of Object.keys(env)) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
}

test('config: claude by default; OFC_MOTOR and config.json choose another agent; unknown names fall back to claude', () => {
  assert.equal(loadConfig({}).motor, 'claude');
  assert.equal(loadConfig({ OFC_MOTOR: 'codex' }).motor, 'codex');
  assert.equal(loadConfig({ OFC_MOTOR: 'freebuff' }).motor, 'claude');
  const dir = pasta();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ motor: 'opencode', modelo: 'google/x' }));
  const c = loadConfig({ OFC_DATA: dir });
  assert.equal(c.motor, 'opencode'); assert.equal(c.modelo, 'google/x');
  assert.equal(idDoMotor('__proto__'), 'claude');
  assert.equal(outroMotor({ motor: 'claude' }), null);
  assert.equal(outroMotor({ motor: 'codex' }), MOTORES.codex);
});

test('codex args: rooms are read-only and ephemeral, web only when asked; edição resumes by session id', () => {
  const s = MOTORES.codex.argsSala({ prompt: 'oi' });
  assert.deepEqual(s.slice(0, 2), ['exec', '--json']);
  assert.equal(s[s.indexOf('-s') + 1], 'read-only');
  for (const f of ['--ephemeral', '--ignore-user-config', '--skip-git-repo-check']) assert.ok(s.includes(f), f);
  assert.ok(!s.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.ok(!s.some(a => a.startsWith('web_search')));
  assert.equal(s.at(-1), 'oi');
  assert.ok(MOTORES.codex.argsSala({ prompt: 'oi', web: true }).includes('web_search="live"'));
  const e = MOTORES.codex.argsEdicao({ prompt: 'p', modelo: 'm1' });
  assert.equal(e[1], '--json'); assert.equal(e[e.indexOf('-m') + 1], 'm1'); assert.equal(e.at(-1), 'p');
  const r = MOTORES.codex.argsEdicao({ prompt: 'p', sessao: 'abc' });
  assert.deepEqual(r.slice(0, 2), ['exec', 'resume']);
  assert.deepEqual(r.slice(-2), ['abc', 'p']);
});

test('opencode args: rooms use the plan agent and never --auto; edição uses --auto and --session', () => {
  const s = MOTORES.opencode.argsSala({ prompt: 'oi', web: true });
  assert.equal(s[s.indexOf('--agent') + 1], 'plan');
  assert.ok(!s.includes('--auto'));
  const e = MOTORES.opencode.argsEdicao({ prompt: 'p', sessao: 'ses_1', modelo: 'a/b' });
  assert.ok(e.includes('--auto'));
  assert.equal(e[e.indexOf('--session') + 1], 'ses_1');
  assert.equal(e[e.indexOf('--model') + 1], 'a/b');
});

for (const tipo of ['codex', 'opencode']) {
  test(`${tipo}: a room gets the final text and the session id`, () => com({ OFC_TEST_AGENTE: tipo, OFC_TEST_RESPOSTA: '{"titulo":"x"}' }, async () => {
    const r = await rodarAgente({ config: cfg(tipo), args: MOTORES[tipo].argsSala({ prompt: 'sala de ROTEIRO' }), cwd: pasta() });
    assert.equal(r.text, '{"titulo":"x"}'); assert.ok(r.sessao);
    assert.equal(await rodarSala({ prompt: 'sala de ROTEIRO', pastaVideo: pasta(), config: cfg(tipo) }), '{"titulo":"x"}');
  }));

  test(`${tipo}: the provider's error reaches the student as a sentence`, () => com({ OFC_TEST_AGENTE: tipo, OFC_TEST_MODO: 'erro-do-provedor' }, async () => {
    const esperado = tipo === 'codex' ? 'Modelo recusado pela conta.' : 'Chave recusada pelo provedor.';
    await assert.rejects(rodarSala({ prompt: 'x', pastaVideo: pasta(), config: cfg(tipo) }), e => e.message === esperado);
  }));

  test(`${tipo}: no final answer is an error with code SEM_RESULTADO`, () => com({ OFC_TEST_AGENTE: tipo, OFC_TEST_MODO: 'sem-resultado' }, async () => {
    await assert.rejects(rodarAgente({ config: cfg(tipo), args: ['x'], cwd: pasta() }), e => e.code === 'SEM_RESULTADO' && e.message.includes(MOTORES[tipo].nome));
  }));

  test(`${tipo}: edição sends the skill path and the command, keeps the agent's session and resumes it`, async () => {
    const p = pasta(); const log = path.join(p, 'log.jsonl');
    await com({ OFC_TEST_AGENTE: tipo, OFC_TEST_LOG: log }, async () => {
      const r = await rodarEdicao({ pastaVideo: p, ficha: { id: 'v1' }, comando: COMANDOS.preparar, config: cfg(tipo) });
      assert.equal(r.estado.etapa, 'aguardando-escolhas'); assert.ok(r.sessao);
      const r2 = await rodarEdicao({ pastaVideo: p, ficha: { id: 'v1', edicao: { sessao: r.sessao } }, comando: COMANDOS.exportar, config: cfg(tipo) });
      assert.equal(r2.estado.etapa, 'exportado'); assert.equal(r2.sessao, r.sessao);
      const [a, b] = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l));
      assert.match(a.args.at(-1), /oficina-de-conteudo-motor[\\/]SKILL\.md/);
      assert.match(a.args.at(-1), /^\/oficina-de-conteudo-motor PREPARAR$/m);
      assert.ok(!a.args.includes(r.sessao)); assert.ok(b.args.includes(r.sessao));
    });
  });

  test(`${tipo}: edição that left the right state but no final message still counts`, () => com({ OFC_TEST_AGENTE: tipo, OFC_TEST_MODO: 'sem-resultado-feito' }, async () => {
    const r = await rodarEdicao({ pastaVideo: pasta(), ficha: { id: 'v1' }, comando: COMANDOS.preparar, config: cfg(tipo) });
    assert.equal(r.estado.etapa, 'aguardando-escolhas'); assert.ok(r.sessao);
  }));
}

test('promptEdicao names the engine skill file and carries the command on its own line', () => {
  const t = promptEdicao('/skills', 'REVISAR: legenda maior');
  assert.ok(t.includes(path.join('/skills', 'oficina-de-conteudo-motor', 'SKILL.md')));
  assert.ok(t.endsWith('/oficina-de-conteudo-motor REVISAR: legenda maior'));
});

test('agent not installed: clear message with how to install', async () => {
  const c = { ...cfg('codex'), agente: { command: 'nao-existe-esse-agente', prefixArgs: [] } };
  await assert.rejects(rodarAgente({ config: c, args: ['x'], cwd: pasta() }), /O Codex não está instalado.*npm install -g @openai\/codex/);
});

test('resolverComando on Windows: .exe on the PATH wins; an npm .cmd shim leads to the real .exe or to node + .js', () => {
  const arquivos = {
    'C:\\npm\\opencode.cmd': '@ECHO off\r\n"%dp0%\\node_modules\\@opencode\\cli\\bin\\opencode.exe"   %*\r\n',
    'C:\\npm\\codex.cmd': '@ECHO off\r\n"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n',
    'C:\\a\\claude.exe': '',
  };
  const o = { env: { Path: 'C:\\a;C:\\npm' }, plataforma: 'win32', existe: p => p in arquivos, ler: p => arquivos[p] };
  assert.deepEqual(resolverComando('claude', o), { command: 'C:\\a\\claude.exe', prefixArgs: [] });
  assert.deepEqual(resolverComando('opencode', o), { command: 'C:\\npm\\node_modules\\@opencode\\cli\\bin\\opencode.exe', prefixArgs: [] });
  assert.deepEqual(resolverComando('codex', o), { command: process.execPath, prefixArgs: ['C:\\npm\\node_modules\\@openai\\codex\\bin\\codex.js'] });
  assert.deepEqual(resolverComando('sumiu', o), { command: 'sumiu', prefixArgs: [] });
  assert.deepEqual(resolverComando('codex', { ...o, plataforma: 'darwin' }), { command: 'codex', prefixArgs: [] });
});

test('checagem: the chosen agent is checked in place of Claude Code', () => {
  const chamadas = [];
  const exec = (cmd, args) => { chamadas.push([cmd, ...args]); return { ok: cmd !== 'codex-x' }; };
  const r = checarFerramentas({ exec, skillsDir: '/nao', maquinaDir: '/nao', agente: { nome: 'Codex', command: 'codex-x', prefixArgs: ['a'], comoInstalar: 'Instale o Codex' } });
  assert.deepEqual(chamadas[0], ['codex-x', 'a', '--version']);
  assert.ok(!r.itens.some(i => i.nome === 'Claude Code'));
  assert.equal(r.mensagem, 'Falta instalar o Codex. Instale o Codex.');
  assert.equal(agenteDaChecagem({ motor: 'claude' }), null);
  assert.deepEqual(agenteDaChecagem(cfg('opencode')), { nome: 'OpenCode', comoInstalar: MOTORES.opencode.comoInstalar, command: process.execPath, prefixArgs: [FAKE] });
});
