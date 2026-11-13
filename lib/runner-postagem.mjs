// The POSTAGEM room (semi-automatic). No tools at all: everything it needs is in the prompt.
import path from 'node:path';
import { argsSala, rodarSala, extrairJSON, lerArquivo, secaoAprendizados } from './runner-sala.mjs';
import { lerAprendizados } from './aprendizados.mjs';

export const argsPostagem = prompt => argsSala(prompt);

// Com ajuste pedido, a versão anterior vai junto: "mais curta" precisa saber do que encurtar.
function versaoAnterior(anterior) {
  if (!anterior?.legenda) return '';
  return `## Versão anterior\nLegenda:\n${anterior.legenda}\n\nHashtags: ${(anterior.hashtags || []).join(' ')}\n`;
}

export function montarPrompt({ resumo, perfil, revisao, anterior = null, aprendizados = '', agora }) {
  return [
    'Você é a sala de POSTAGEM da Oficina de Conteúdo. Escreva o post de um vídeo curto pro Instagram e TikTok.',
    `Hoje é ${agora.toISOString().slice(0, 10)} (${agora.toLocaleDateString('pt-BR', { weekday: 'long' })}).`,
    '', '## O vídeo', resumo, '',
    '## Quem posta', perfil || '(sem perfil preenchido: use um tom direto e casual, em português do Brasil)', '',
    secaoAprendizados(aprendizados),
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
  const r = extrairJSON(texto);
  if (!r || typeof r.legenda !== 'string' || !r.legenda.trim()) throw new Error('A sala de postagem não devolveu a legenda. Tente de novo.');
  const hashtags = (Array.isArray(r.hashtags) ? r.hashtags : []).map(h => String(h).trim()).filter(Boolean).map(h => h.startsWith('#') ? h : '#' + h);
  let horario = new Date(r.horario);
  if (Number.isNaN(horario.getTime()) || horario <= agora) horario = proximoDia18(agora);
  return { legenda: r.legenda.trim(), hashtags, horario: horario.toISOString(), motivoHorario: String(r.motivoHorario || '') };
}

export async function rodarPostagem({ pastaVideo, ficha, cerebroDir, config, signal, run, agora = new Date() }) {
  const resumo = lerArquivo(path.join(pastaVideo, 'edit', 'resumo.md'));
  if (!resumo) throw new Error('Não achei o resumo do vídeo (edit/resumo.md). Exporte o vídeo de novo na sala de Edição.');
  const prompt = montarPrompt({ resumo, perfil: lerArquivo(path.join(cerebroDir, 'perfil.md')), revisao: ficha.revisao || null,
    anterior: ficha.postagem || null, aprendizados: lerAprendizados(cerebroDir, 'postagem'), agora });
  return lerResposta(await rodarSala({ prompt, pastaVideo, config, signal, run }), agora);
}
