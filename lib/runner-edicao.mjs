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
const SEM_RESULTADO = 'O Claude não devolveu um resultado concluído.';
// Execuções sem ninguém olhando: os hooks e plugins do aluno não entram.
export const CONFIG_SEM_HOOKS = '{"disableAllHooks":true}';

// O PowerShell só existe como ferramenta no Windows.
export const ferramentasEdicao = (plataforma = process.platform) => plataforma === 'win32' ? [...FERRAMENTAS, 'PowerShell'] : [...FERRAMENTAS];

// Ambiente do Claude filho: sem CLAUDECODE, senão ele se acha dentro de outra sessão do Claude Code.
export function ambienteFilho(base = process.env) {
  const env = { ...base };
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'CLAUDECODE') delete env[k];
  return env;
}

export function argsEdicao({ comando, sessao, retomar, skillsDir, maquinaDir, modelo = null, plataforma = process.platform }) {
  const ferramentas = ferramentasEdicao(plataforma).join(',');
  const a = ['-p', `/maquina-de-edicao ${comando}`, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'dontAsk', '--tools', ferramentas, '--allowedTools', ferramentas,
    '--settings', CONFIG_SEM_HOOKS,
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

// mtime of edit/estado.json, or null when the file does not exist.
function mtimeEstado(pastaVideo) {
  try { return fs.statSync(path.join(pastaVideo, 'edit', 'estado.json')).mtimeMs; } catch { return null; }
}

// Only trust estado.json if this run wrote it: it must exist and be strictly newer than before the run.
// A stale file from a previous run (e.g. a dead studioUrl) must not look like a fresh result.
function lerEstadoDaRodada(pastaVideo, mtimeAntes) {
  const agora = mtimeEstado(pastaVideo);
  if (agora === null) return null;
  if (mtimeAntes !== null && agora <= mtimeAntes) return null;
  return lerEstado(pastaVideo);
}

function esperadoDe(comando) {
  const etapa = ESPERADO[String(comando).split(' ')[0].replace(/:$/, '')];
  if (!etapa) throw new Error(`Comando desconhecido para a Máquina: ${comando}`);
  return etapa;
}

const tamanho = arq => { try { return fs.statSync(arq).size; } catch { return -1; } };

// A exportação só vale se deixou o MP4 final e o resumo que a sala de Postagem lê.
function conferirExportacao(pastaVideo) {
  if (tamanho(path.join(pastaVideo, 'edit', 'final.mp4')) <= 0) throw new Error('A exportação terminou sem o MP4 final (edit/final.mp4). Tente de novo.');
  if (tamanho(path.join(pastaVideo, 'edit', 'resumo.md')) < 0) throw new Error('A exportação terminou sem o resumo do vídeo (edit/resumo.md). Tente de novo.');
}

export async function rodarEdicao({ pastaVideo, ficha, comando, config, signal, run = runClaude }) {
  const esperado = esperadoDe(comando);
  prepararPasta(pastaVideo, ficha.id);
  const mtimeAntes = mtimeEstado(pastaVideo);
  const retomar = !!ficha.edicao?.sessao;
  const sessao = ficha.edicao?.sessao || randomUUID();
  const args = argsEdicao({ comando, sessao, retomar, skillsDir: config.skillsDir, maquinaDir: config.maquinaDir, modelo: config.modeloEdicao });
  try {
    await run({ command: config.claude.command, prefixArgs: config.claude.prefixArgs, args, cwd: pastaVideo, env: ambienteFilho(), timeout: TEMPO_EDICAO, signal });
  } catch (e) {
    const estado = lerEstadoDaRodada(pastaVideo, mtimeAntes);
    if (estado?.etapa === 'erro') throw new Error(estado.erro || 'A edição parou com erro.');
    // Saiu sem a mensagem final, mas deixou o estado esperado gravado nesta rodada: o trabalho foi feito.
    const feito = e.message === SEM_RESULTADO && estado?.etapa === esperado && !signal?.aborted;
    if (!feito) throw new Error(e.message === SEM_RESULTADO ? 'O Claude terminou sem resultado. Tente de novo.' : e.message);
  }
  const estado = lerEstadoDaRodada(pastaVideo, mtimeAntes);
  if (!estado) throw new Error('A edição terminou mas não deixou o andamento (edit/estado.json). Tente de novo.');
  if (estado.etapa === 'erro') throw new Error(estado.erro || 'A edição parou com erro.');
  if (estado.etapa !== esperado) throw new Error(`A edição parou em "${estado.etapa}" quando devia chegar em "${esperado}". Tente de novo.`);
  if (esperado === ESPERADO.EXPORTAR) conferirExportacao(pastaVideo);
  return { estado, sessao };
}
