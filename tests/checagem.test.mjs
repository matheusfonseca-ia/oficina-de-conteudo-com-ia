import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checarFerramentas } from '../lib/checagem.mjs';

function ambiente({ faltando = [] } = {}) {
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-sk-'));
  const maquinaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-mq-'));
  if (!faltando.includes('maquina')) { fs.mkdirSync(path.join(skillsDir, 'maquina-de-edicao', 'referencias'), { recursive: true }); fs.writeFileSync(path.join(skillsDir, 'maquina-de-edicao', 'referencias', 'modo-escritorio.md'), '#'); }
  if (!faltando.includes('earshot')) fs.mkdirSync(path.join(maquinaDir, 'earshot'));
  const exec = (cmd) => ({ ok: !faltando.includes(cmd), naoAchou: faltando.includes(cmd) });
  return { skillsDir, maquinaDir, exec };
}

test('everything installed → ok', () => {
  const r = checarFerramentas(ambiente());
  assert.equal(r.ok, true); assert.equal(r.mensagem, null);
  assert.deepEqual(r.itens.map(i => i.nome), ['Node', 'Claude Code', 'FFmpeg', 'ffprobe', 'Python', 'HyperFrames', 'earshot', 'Máquina de Edição (modo escritório)']);
});

test('missing ffmpeg → plain message with how to install', () => {
  const r = checarFerramentas(ambiente({ faltando: ['ffmpeg'] }));
  assert.equal(r.ok, false); assert.match(r.mensagem, /Falta instalar o FFmpeg/);
  assert.match(r.itens.find(i => i.nome === 'FFmpeg').comoInstalar, /winget install|brew install/);
});

test('Máquina without office mode → asks to update the Máquina', () => {
  const r = checarFerramentas(ambiente({ faltando: ['maquina'] }));
  assert.match(r.mensagem, /Atualize a Máquina de Edição/);
});

test('Claude Code missing on Windows → asks for the official installer (claude.exe)', () => {
  const r = checarFerramentas({ ...ambiente({ faltando: ['claude'] }), windows: true });
  assert.equal(r.ok, false);
  assert.equal(r.mensagem, 'A Oficina precisa do Claude Code instalado pelo instalador oficial (claude.exe). Instale em https://claude.com/claude-code e faça login.');
});

test('Claude Code missing elsewhere → plain message with the site', () => {
  const r = checarFerramentas({ ...ambiente({ faltando: ['claude'] }), windows: false });
  assert.equal(r.mensagem, 'Falta instalar o Claude Code. Instale em https://claude.com/claude-code e faça login.');
});

test('the Claude Code check runs the configured command with --version, without a shell', () => {
  const chamadas = []; const amb = ambiente();
  checarFerramentas({ ...amb, exec: (cmd, args) => { chamadas.push([cmd, args]); return { ok: true }; }, claude: { command: 'node', prefixArgs: ['falso.mjs'] } });
  assert.deepEqual(chamadas.find(([c]) => c === 'node'), ['node', ['falso.mjs', '--version']]);
});
