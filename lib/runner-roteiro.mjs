// The ROTEIRO room: hook, body and call to action in the owner's voice, from the idea and the chosen
// reference. No tools. The approved script is also saved as roteiro.md in the video folder.
import fs from 'node:fs';
import path from 'node:path';
import { rodarSala, extrairJSON, lerArquivo, secaoAprendizados } from './runner-sala.mjs';
import { lerAprendizados } from './aprendizados.mjs';

export function roteiroEmTexto(r) {
  return [`# ${r.titulo}`, '', '## Gancho', r.gancho, '', '## Desenvolvimento', ...r.desenvolvimento.map((b, i) => `${i + 1}. ${b}`), '',
    '## Chamada pra ação', r.cta || '(sem chamada)', ''].join('\n');
}

function secaoReferencia(r) {
  if (!r) return '';
  return `## Referência escolhida (inspire-se na estrutura, não copie o texto)\n${r.titulo} (${r.url})\nPor que funcionou: ${r.porQueFuncionou}${r.gancho ? `\nGancho dela: ${r.gancho}` : ''}\n`;
}

export function montarPromptRoteiro({ tema, perfil, referencia = null, aprendizados = '', revisao = null, anterior = null }) {
  return [
    'Você é a sala de ROTEIRO da Oficina de Conteúdo. Escreva o roteiro de um vídeo curto vertical (Reels/TikTok), falado pela pessoa olhando pra câmera.',
    '', '## A ideia do vídeo', tema, '',
    '## Quem fala', perfil || '(sem perfil preenchido: tom direto e casual, em português do Brasil)', '',
    secaoReferencia(referencia),
    secaoAprendizados(aprendizados),
    revisao && anterior ? `## Versão anterior\n${roteiroEmTexto(anterior)}\n` : '',
    revisao ? `## Ajuste pedido pelo dono\n${revisao}\n` : '',
    '## Regras',
    '- Português do Brasil, frases curtas, do jeito que se fala, no tom de voz de quem fala.',
    '- Gancho: uma frase que prende nos 3 primeiros segundos.',
    '- Desenvolvimento: de 3 a 7 blocos curtos, um por ideia.',
    '- Chamada pra ação: uma frase no fim.',
    '- Entre 30 e 90 segundos falados, salvo se o dono pedir outra coisa.',
    '- Sem travessão longo, sem frases de efeito vazias.',
    '', 'Responda SÓ com um JSON, sem nada antes ou depois:',
    '{"titulo": "...", "gancho": "...", "desenvolvimento": ["...", "..."], "cta": "...", "duracaoSegundos": 60}',
  ].join('\n');
}

export function lerRespostaRoteiro(texto) {
  const r = extrairJSON(texto);
  const gancho = String(r?.gancho ?? '').trim();
  const desenvolvimento = (Array.isArray(r?.desenvolvimento) ? r.desenvolvimento : []).map(b => String(b ?? '').trim()).filter(Boolean).slice(0, 10);
  if (!gancho || !desenvolvimento.length) throw new Error('A sala de Roteiro não devolveu o roteiro. Tente de novo.');
  const d = Number(r.duracaoSegundos);
  return {
    titulo: String(r.titulo ?? '').trim().slice(0, 120) || 'Roteiro',
    gancho, desenvolvimento, cta: String(r.cta ?? '').trim(),
    duracaoSegundos: Number.isFinite(d) && d >= 5 && d <= 600 ? Math.round(d) : null,
  };
}

export async function rodarRoteiro({ pastaVideo, ficha, cerebroDir, config, signal, run }) {
  const prompt = montarPromptRoteiro({
    tema: ficha.tema, perfil: lerArquivo(path.join(cerebroDir, 'perfil.md')), referencia: ficha.referencia || null,
    aprendizados: lerAprendizados(cerebroDir, 'roteiro'), revisao: ficha.revisao || null, anterior: ficha.roteiro || null,
  });
  const roteiro = lerRespostaRoteiro(await rodarSala({ prompt, pastaVideo, config, signal, run }));
  fs.writeFileSync(path.join(pastaVideo, 'roteiro.md'), roteiroEmTexto(roteiro));
  return roteiro;
}
