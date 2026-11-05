// The POSTAGEM room (stage 1: semi-automatic). No tools at all: everything it needs is in the prompt.
import fs from 'node:fs';
import path from 'node:path';
import { runClaude } from './claude-runner.mjs';
import { ambienteFilho, CONFIG_SEM_HOOKS } from './runner-edicao.mjs';

export function argsPostagem(prompt) {
  return ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
    '--permission-mode', 'dontAsk', '--tools', '', '--settings', CONFIG_SEM_HOOKS, '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--disable-slash-commands', '--max-turns', '2'];
}

// Com ajuste pedido, a versão anterior vai junto: "mais curta" precisa saber do que encurtar.
function versaoAnterior(anterior) {
  if (!anterior?.legenda) return '';
  return `## Versão anterior\nLegenda:\n${anterior.legenda}\n\nHashtags: ${(anterior.hashtags || []).join(' ')}\n`;
}

export function montarPrompt({ resumo, perfil, revisao, anterior = null, agora }) {
  return [
    'Você é a sala de POSTAGEM de um escritório de conteúdo. Escreva o post de um vídeo curto pro Instagram e TikTok.',
    `Hoje é ${agora.toISOString().slice(0, 10)} (${agora.toLocaleDateString('pt-BR', { weekday: 'long' })}).`,
    '', '## O vídeo', resumo, '',
    '## Quem posta', perfil || '(sem perfil preenchido: use um tom direto e casual, em português do Brasil)', '',
    revisao ? versaoAnterior(anterior) : '',
    revisao ? `## Ajuste pedido pelo dono\n${revisao}\n` : '',
    '## Regras',
    '- Legenda em português do Brasil, primeira linha forte (é o que aparece antes do "mais"), no máximo 1.200 caracteres, uma chamada pra ação no fim.',
    '- Sem travessão longo, sem frases de efeito vazias.',
    '- De 3 a 8 hashtags específicas do assunto.',
    '- Sugira dia e horário de publicação nos próximos 7 dias, com o motivo em uma frase.',
    '', 'Responda SÓ com um JSON, sem nada antes ou depois:',
    '{"legenda": "...", "hashtags": ["#..."], "horario": "AAAA-MM-DDTHH:MM:00-03:00", "motivoHorario": "..."}',
  ].join('\n');
}

function proximoDia18(agora) { const d = new Date(agora); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d; }

export function lerResposta(texto, agora = new Date()) {
  const bloco = String(texto).match(/\{[\s\S]*\}/)?.[0];
  let r; try { r = bloco && JSON.parse(bloco); } catch { r = null; }
  if (!r || typeof r.legenda !== 'string' || !r.legenda.trim()) throw new Error('A sala de postagem não devolveu a legenda. Tente de novo.');
  const hashtags = (Array.isArray(r.hashtags) ? r.hashtags : []).map(h => String(h).trim()).filter(Boolean).map(h => h.startsWith('#') ? h : '#' + h);
  let horario = new Date(r.horario);
  if (Number.isNaN(horario.getTime()) || horario <= agora) horario = proximoDia18(agora);
  return { legenda: r.legenda.trim(), hashtags, horario: horario.toISOString(), motivoHorario: String(r.motivoHorario || '') };
}

const ler = p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };

export async function rodarPostagem({ pastaVideo, ficha, cerebroDir, config, signal, run = runClaude, agora = new Date() }) {
  const resumo = ler(path.join(pastaVideo, 'edit', 'resumo.md'));
  if (!resumo) throw new Error('Não achei o resumo do vídeo (edit/resumo.md). Exporte o vídeo de novo na sala de Edição.');
  const prompt = montarPrompt({ resumo, perfil: ler(path.join(cerebroDir, 'perfil.md')), revisao: ficha.revisao || null, anterior: ficha.postagem || null, agora });
  const r = await run({ command: config.claude.command, prefixArgs: config.claude.prefixArgs, args: argsPostagem(prompt), cwd: pastaVideo, env: ambienteFilho(), timeout: 5 * 60 * 1000, signal });
  return lerResposta(r.text, agora);
}
