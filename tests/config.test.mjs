import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../config.mjs';

test('defaults: port 4540, data in ~/.escritorio-de-conteudo, plain claude', () => {
  const c = loadConfig({});
  assert.equal(c.porta, 4540);
  assert.equal(c.dados, path.join(os.homedir(), '.escritorio-de-conteudo'));
  assert.deepEqual(c.claude, { command: 'claude', prefixArgs: [] });
  assert.equal(c.modeloEdicao, null);
  assert.equal(c.skillsDir, path.join(os.homedir(), '.claude', 'skills'));
  assert.equal(c.maquinaDir, path.join(os.homedir(), '.maquina-de-edicao'));
});

test('env overrides: ESC_DATA, PORT, ESC_CLAUDE_COMMAND, ESC_CLAUDE_PREFIX_ARGS, ESC_SKILLS', () => {
  const c = loadConfig({ ESC_DATA: '/tmp/x', PORT: '4999', ESC_CLAUDE_COMMAND: 'node',
    ESC_CLAUDE_PREFIX_ARGS: '["fake.mjs"]', ESC_SKILLS: '/tmp/skills' });
  assert.equal(c.dados, path.resolve('/tmp/x'));
  assert.equal(c.porta, 4999);
  assert.deepEqual(c.claude, { command: 'node', prefixArgs: ['fake.mjs'] });
  assert.equal(c.skillsDir, path.resolve('/tmp/skills'));
});

test('config.json in the data folder sets modeloEdicao', async () => {
  const fs = await import('node:fs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-cfg-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ modeloEdicao: 'opus' }));
  assert.equal(loadConfig({ ESC_DATA: dir }).modeloEdicao, 'opus');
});
