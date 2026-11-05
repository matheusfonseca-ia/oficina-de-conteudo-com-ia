// The EDIÇÃO room: runs the Máquina de Edição skill headless, in office mode, inside the video folder.
// Only room with a terminal. Not an OS sandbox: Bash can leave the folder; the boundary is the cwd,
// the skill's own rules and the absence of any MCP server.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runClaude } from './claude-runner.mjs';

export const COMANDOS = { preparar: 'PREPARAR', montar: 'ESCOLHAS_PRONTAS', exportar: 'EXPORTAR', reabrir: 'REABRIR_STUDIO' };
export const ESPERADO = { PREPARAR: 'aguardando-escolhas', ESCOLHAS_PRONTAS: 'revisao', REVISAR: 'revisao', EXPORTAR: 'exportado', REABRIR_STUDIO: 'revisao' };
export const TEMPO_EDICAO = 60 * 60 * 1000;
const FERRAMENTAS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'WebSearch', 'WebFetch'];

export function argsEdicao({ comando, sessao, retomar, skillsDir, maquinaDir, modelo = null }) {
  const a = ['-p', `/maquina-de-edicao ${comando}`, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'dontAsk', '--allowedTools', FERRAMENTAS.join(','),
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--add-dir', skillsDir, maquinaDir];
  a.push(...(retomar ? ['--resume', sessao] : ['--session-id', sessao]));
  if (modelo) a.push('--model', modelo);
  return a;
}

export function prepararPasta(pastaVideo, fichaId) {
  fs.mkdirSync(path.join(pastaVideo, 'edit'), { recursive: true });
  fs.writeFileSync(path.join(pastaVideo, 'edit', 'escritorio.json'), JSON.stringify({ versao: 1, fichaId }));
}

export function lerEstado(pastaVideo) {
  try {
    const e = JSON.parse(fs.readFileSync(path.join(pastaVideo, 'edit', 'estado.json'), 'utf8'));
    if (!e || typeof e.etapa !== 'string') return null;
    return { etapa: e.etapa, progresso: Number(e.progresso) || 0, mensagem: String(e.mensagem || ''), studioUrl: e.studioUrl || null, erro: e.erro || null };
  } catch { return null; }
}

export async function rodarEdicao({ pastaVideo, ficha, comando, config, signal, run = runClaude }) {
  prepararPasta(pastaVideo, ficha.id);
  const retomar = !!ficha.edicao?.sessao;
  const sessao = ficha.edicao?.sessao || randomUUID();
  const args = argsEdicao({ comando, sessao, retomar, skillsDir: config.skillsDir, maquinaDir: config.maquinaDir, modelo: config.modeloEdicao });
  try {
    await run({ command: config.claude.command, prefixArgs: config.claude.prefixArgs, args, cwd: pastaVideo, timeout: TEMPO_EDICAO, signal });
  } catch (e) {
    const estado = lerEstado(pastaVideo);
    if (estado?.etapa === 'erro') throw new Error(estado.erro || 'A edição parou com erro.');
    throw new Error(/resultado/.test(e.message) ? 'O Claude terminou sem resultado. Tente de novo.' : e.message);
  }
  const estado = lerEstado(pastaVideo);
  if (!estado) throw new Error('A edição terminou mas não deixou o andamento (edit/estado.json). Tente de novo.');
  if (estado.etapa === 'erro') throw new Error(estado.erro || 'A edição parou com erro.');
  const esperado = ESPERADO[comando.split(' ')[0].replace(/:$/, '')] || ESPERADO[comando];
  if (estado.etapa !== esperado) throw new Error(`A edição parou em "${estado.etapa}" quando devia chegar em "${esperado}". Tente de novo.`);
  return { estado, sessao };
}
