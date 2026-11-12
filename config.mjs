// Oficina de Conteúdo — configuration.
// Data lives outside the repo (~/.oficina-de-conteudo) so git pull and the installer never touch it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } }

export function loadConfig(env = process.env) {
  const dados = env.OFC_DATA ? path.resolve(env.OFC_DATA) : path.join(os.homedir(), '.oficina-de-conteudo');
  const local = readJSON(path.join(dados, 'config.json'));
  return {
    porta: Number(env.PORT) || Number(local.porta) || 4540,
    dados,
    claude: { command: env.OFC_CLAUDE_COMMAND || 'claude', prefixArgs: JSON.parse(env.OFC_CLAUDE_PREFIX_ARGS || '[]') },
    modeloEdicao: local.modeloEdicao || null,
    skillsDir: env.OFC_SKILLS ? path.resolve(env.OFC_SKILLS) : path.join(os.homedir(), '.claude', 'skills'),
    maquinaDir: path.join(os.homedir(), '.maquina-de-edicao'),
  };
}
