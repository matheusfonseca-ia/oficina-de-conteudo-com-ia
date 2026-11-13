// Shared runner for the rooms without a terminal (PESQUISA, ROTEIRO, POSTAGEM): one `claude -p`,
// no session, no MCP, no hooks, no slash commands, only the tools the room names. Answers come as JSON.
import fs from 'node:fs';
import { runClaude } from './claude-runner.mjs';
import { ambienteFilho, CONFIG_SEM_HOOKS } from './runner-edicao.mjs';

export const TEMPO_SALA = 5 * 60 * 1000;

export function argsSala(prompt, { ferramentas = [], maxTurnos = 2 } = {}) {
  const lista = ferramentas.join(',');
  return ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--permission-mode', 'dontAsk', '--tools', lista, ...(ferramentas.length ? ['--allowedTools', lista] : []),
    '--settings', CONFIG_SEM_HOOKS, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--disable-slash-commands', '--max-turns', String(maxTurnos)];
}

export async function rodarSala({ prompt, ferramentas = [], maxTurnos = 2, pastaVideo, config, signal, run = runClaude }) {
  const r = await run({ command: config.claude.command, prefixArgs: config.claude.prefixArgs, args: argsSala(prompt, { ferramentas, maxTurnos }),
    cwd: pastaVideo, env: ambienteFilho(), timeout: TEMPO_SALA, signal });
  return r.text;
}

export function extrairJSON(texto) {
  const bloco = String(texto ?? '').match(/\{[\s\S]*\}/)?.[0];
  try { return bloco ? JSON.parse(bloco) : null; } catch { return null; }
}

export const lerArquivo = arq => { try { return fs.readFileSync(arq, 'utf8'); } catch { return null; } };

export const secaoAprendizados = linhas => linhas
  ? `## Ajustes que o dono já pediu em outros vídeos (use pra entender o gosto dele; nem todo ajuste vale pra este vídeo)\n${linhas}\n`
  : '';
