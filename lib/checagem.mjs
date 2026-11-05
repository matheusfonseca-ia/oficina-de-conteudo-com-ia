import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WIN = process.platform === 'win32';
const execPadrao = (cmd, args) => {
  const r = spawnSync(cmd, args, { shell: WIN, timeout: 20000, windowsHide: true, encoding: 'utf8' });
  return { ok: r.status === 0 };
};
const instalar = (win, mac) => (WIN ? win : mac);

export function checarFerramentas({ exec = execPadrao, skillsDir, maquinaDir }) {
  const py = WIN ? 'python' : 'python3';
  const itens = [
    { nome: 'Node', ok: exec('node', ['--version']).ok, comoInstalar: instalar('winget install OpenJS.NodeJS.LTS', 'brew install node') },
    { nome: 'FFmpeg', ok: exec('ffmpeg', ['-version']).ok, comoInstalar: instalar('winget install ffmpeg', 'brew install ffmpeg') },
    { nome: 'ffprobe', ok: exec('ffprobe', ['-version']).ok, comoInstalar: instalar('winget install ffmpeg', 'brew install ffmpeg') },
    { nome: 'Python', ok: exec(py, ['--version']).ok, comoInstalar: instalar('winget install Python.Python.3.12', 'brew install python') },
    { nome: 'HyperFrames', ok: exec('npx', ['--no-install', 'hyperframes', '--version']).ok, comoInstalar: 'Rode de novo o instalador da Máquina de Edição Básico' },
    { nome: 'earshot', ok: fs.existsSync(path.join(maquinaDir, 'earshot')), comoInstalar: 'Rode de novo o instalador da Máquina de Edição Básico' },
    { nome: 'Máquina de Edição (modo escritório)', ok: fs.existsSync(path.join(skillsDir, 'maquina-de-edicao', 'referencias', 'modo-escritorio.md')), comoInstalar: 'Atualize a Máquina de Edição: git pull na pasta do Básico e rode o instalador de novo' },
  ];
  const falta = itens.find(i => !i.ok);
  const mensagem = !falta ? null : falta.nome.startsWith('Máquina') ? `Atualize a Máquina de Edição pra usar o escritório. ${falta.comoInstalar}.`
    : `Falta instalar o ${falta.nome}. ${falta.comoInstalar}.`;
  return { ok: !falta, mensagem, itens };
}
