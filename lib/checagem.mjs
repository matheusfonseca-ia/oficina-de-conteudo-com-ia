import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { MOTOR } from '../config.mjs';

const WIN = process.platform === 'win32';
const rodar = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { timeout: 20000, windowsHide: true, encoding: 'utf8', ...opcoes });
  return { ok: r.status === 0, naoAchou: r.error?.code === 'ENOENT' };
};
// Sem shell: o cmd.exe do Windows não enxerga o PATH quando o servidor sobe pelo Git Bash.
const execPadrao = (cmd, args) => {
  if (cmd !== 'hyperframes') return rodar(cmd, args);
  // o shim do npm chama "node" pelo PATH: garante que a pasta do Node que está rodando esteja nele
  const env = { ...process.env }; const chave = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
  env[chave] = path.dirname(process.execPath) + path.delimiter + (env[chave] || '');
  const npxCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  // npx can take a while on the first run of the day (it checks its cache): more room than the other tools
  if (fs.existsSync(npxCli)) return rodar(process.execPath, [npxCli, '--no-install', 'hyperframes', ...args], { env, timeout: 60000 });
  return rodar('npx --no-install hyperframes ' + args.join(' '), undefined, { shell: true, env, timeout: 60000 });
};
const instalar = (win, mac) => (WIN ? win : mac);

const CLAUDE_SITE = 'Instale em https://claude.com/claude-code e faça login';
// Sem shell, o Windows só acha o claude.exe do instalador oficial (o claude.cmd do npm não serve).
const AVISO_CLAUDE_WIN = `A Oficina precisa do Claude Code instalado pelo instalador oficial (claude.exe). ${CLAUDE_SITE}.`;

export function checarFerramentas({ exec = execPadrao, skillsDir, maquinaDir, claude = { command: 'claude', prefixArgs: [] }, windows = WIN }) {
  const py = WIN ? 'python' : 'python3';
  const rc = exec(claude.command || 'claude', [...(claude.prefixArgs || []), '--version']);
  const itens = [
    { nome: 'Node', ok: fs.existsSync(process.execPath), comoInstalar: instalar('winget install OpenJS.NodeJS.LTS', 'brew install node') },
    { nome: 'Claude Code', ok: rc.ok, comoInstalar: CLAUDE_SITE, ...(windows && !rc.ok && rc.naoAchou ? { aviso: AVISO_CLAUDE_WIN } : {}) },
    { nome: 'FFmpeg', ok: exec('ffmpeg', ['-version']).ok, comoInstalar: instalar('winget install ffmpeg', 'brew install ffmpeg') },
    { nome: 'ffprobe', ok: exec('ffprobe', ['-version']).ok, comoInstalar: instalar('winget install ffmpeg', 'brew install ffmpeg') },
    { nome: 'Python', ok: exec(py, ['--version']).ok, comoInstalar: instalar('winget install Python.Python.3.12', 'brew install python') },
    { nome: 'HyperFrames', ok: exec('hyperframes', ['--version']).ok, comoInstalar: 'Rode de novo o instalador da Oficina (instalar.ps1 no Windows, instalar.sh no Mac), que baixa o HyperFrames' },
    { nome: 'earshot', ok: fs.existsSync(path.join(maquinaDir, 'earshot')), comoInstalar: 'Rode de novo o instalador da Máquina de Edição Básico' },
    { nome: 'Máquina de Edição Básico', ok: fs.existsSync(path.join(skillsDir, 'maquina-de-edicao', 'SKILL.md')), comoInstalar: 'Instale a Máquina de Edição com IA Básico (os formatos e os efeitos sonoros vêm dela)' },
    { nome: 'Motor da Oficina', ok: fs.existsSync(path.join(skillsDir, MOTOR, 'referencias', 'modo-escritorio.md')), comoInstalar: 'Rode de novo o instalador da Oficina (instalar.ps1 no Windows, instalar.sh no Mac)' },
  ];
  const falta = itens.find(i => !i.ok);
  const mensagem = !falta ? null : falta.aviso ? falta.aviso : falta.nome.startsWith('Máquina') || falta.nome.startsWith('Motor') ? `${falta.comoInstalar}.`
    : `Falta instalar o ${falta.nome}. ${falta.comoInstalar}.`;
  return { ok: !falta, mensagem, itens };
}
