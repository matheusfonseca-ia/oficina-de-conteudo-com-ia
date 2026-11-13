// The CAPA room. The server grabs frames and renders the PNGs; Claude only looks at the frames
// (Read, nothing else) and picks one plus 2–3 hook titles. With the student's Higgsfield key,
// one more cover is generated from the chosen frame; if that fails the video still moves on.
import fs from 'node:fs';
import path from 'node:path';
import { rodarSala, extrairJSON, lerArquivo, secaoAprendizados } from './runner-sala.mjs';
import { lerAprendizados } from './aprendizados.mjs';
import { extrairFrames } from './capa-frames.mjs';
import { coresDoEstilo, htmlDaCapa, renderizarPNG, SemNavegador } from './capa-modelo.mjs';
import { gerarCapaIA } from './higgsfield.mjs';
import { chaveDe } from './conexoes.mjs';

export const FERRAMENTAS_CAPA = ['Read'];
// Room for Claude to open the 12 frames even if it reads them a few at a time.
export const MAX_TURNOS_CAPA = 16;
const MAX_PALAVRAS = 6;

export function montarPrompt({ resumo, roteiro = null, perfil, frames, revisao = null, anterior = null, aprendizados = '' }) {
  const anteriores = (anterior?.opcoes || []).map(o => `- ${o.titulo}`).join('\n');
  return [
    'Você é a sala de CAPA da Oficina de Conteúdo. Escolha a imagem da capa de um vídeo e escreva os títulos.',
    '', '## O vídeo', resumo || '(sem resumo)', '',
    roteiro ? `## Roteiro\n${roteiro}\n` : '',
    '## Quem posta', perfil || '(sem perfil preenchido: tom direto e casual, em português do Brasil)', '',
    secaoAprendizados(aprendizados),
    revisao && anteriores ? `## Títulos da versão anterior\n${anteriores}\n` : '',
    revisao ? `## Ajuste pedido pelo dono\n${revisao}\n` : '',
    '## Imagens do vídeo (abra todas de uma vez com a ferramenta de leitura, numa só rodada)',
    ...frames.map((f, i) => `${i}: ${f}`), '',
    '## Regras',
    '- Escolha a imagem com o rosto bem visível, expressão forte e sem borrão. O número é o que aparece antes do caminho.',
    `- Escreva de 2 a 3 títulos de gancho, com até ${MAX_PALAVRAS} palavras cada, em português do Brasil, sem travessão longo.`,
    '- Em "promptIA", descreva em inglês a cena da imagem escolhida para um gerador de imagens, pedindo uma capa chamativa de vídeo com o título em letras grandes.',
    '', 'Responda SÓ com um JSON, sem nada antes ou depois:',
    '{"frame": 0, "titulos": ["...", "..."], "promptIA": "..."}',
  ].join('\n');
}

export function lerResposta(texto, totalFrames) {
  const r = extrairJSON(texto);
  if (!r) throw new Error('A sala de capa não devolveu a resposta. Tente de novo.');
  if (!Number.isInteger(r.frame) || r.frame < 0 || r.frame >= totalFrames) throw new Error('A sala de capa escolheu um frame que não existe. Tente de novo.');
  const titulos = (Array.isArray(r.titulos) ? r.titulos : [])
    .map(t => String(t ?? '').trim().split(/\s+/).filter(Boolean).slice(0, MAX_PALAVRAS).join(' '))
    .filter(Boolean).slice(0, 3);
  if (!titulos.length) throw new Error('A sala de capa não devolveu títulos. Tente de novo.');
  return { frame: r.frame, titulos, promptIA: String(r.promptIA || '').trim() };
}

const dataUrl = arq => `data:image/jpeg;base64,${fs.readFileSync(arq).toString('base64')}`;

export async function rodarCapa({ pastaVideo, ficha, cerebroDir, config, signal, run, deps = {} }) {
  const d = { extrairFrames, renderizarPNG, gerarCapaIA, chaveHiggsfield: () => chaveDe(config.dados, 'higgsfield'), ...deps };
  const mp4 = path.join(pastaVideo, 'edit', 'final.mp4');
  if (!fs.existsSync(mp4)) throw new Error('Não achei o vídeo exportado (edit/final.mp4). Exporte de novo na sala de Edição.');
  const pastaCapa = path.join(pastaVideo, 'capa');
  const { video, frames } = await d.extrairFrames(mp4, path.join(pastaCapa, 'frames'), { signal });
  const [largura, altura] = video.vertical ? [1080, 1920] : [1280, 720];
  const relativo = arq => path.relative(pastaVideo, arq).split(path.sep).join('/');

  const prompt = montarPrompt({ resumo: lerArquivo(path.join(pastaVideo, 'edit', 'resumo.md')), roteiro: lerArquivo(path.join(pastaVideo, 'roteiro.md')),
    perfil: lerArquivo(path.join(cerebroDir, 'perfil.md')), frames: frames.map(f => f.arquivo), // full paths: the Read tool wants them
    revisao: ficha?.revisao || null, anterior: ficha?.capa || null, aprendizados: lerAprendizados(cerebroDir, 'capa') });
  const escolha = lerResposta(await rodarSala({ prompt, ferramentas: FERRAMENTAS_CAPA, maxTurnos: MAX_TURNOS_CAPA, pastaVideo, config, signal, run }), frames.length);
  const frame = frames[escolha.frame].arquivo;
  const cores = coresDoEstilo(pastaVideo);

  const opcoes = [];
  try {
    for (const [i, titulo] of escolha.titulos.entries()) {
      const destino = path.join(pastaCapa, `capa-${i + 1}.png`);
      await d.renderizarPNG(htmlDaCapa({ frame: dataUrl(frame), titulo, cores, largura, altura }), destino, { largura, altura });
      opcoes.push({ arquivo: relativo(destino), titulo, origem: 'fabrica' });
    }
  } catch (e) {
    if (e instanceof SemNavegador) return { opcoes: [], escolhida: null, aviso: e.message };
    throw e;
  }

  let aviso = null;
  const chave = d.chaveHiggsfield();
  if (chave) {
    const destino = path.join(pastaCapa, 'capa-ia.png');
    try {
      await d.gerarCapaIA({ chave, frame, prompt: `${escolha.promptIA}\nTitle text on the cover, large and legible: "${escolha.titulos[0]}"`,
        proporcao: video.vertical ? '9:16' : '16:9', destino, signal });
      opcoes.push({ arquivo: relativo(destino), titulo: escolha.titulos[0], origem: 'higgsfield' });
    } catch (e) {
      if (signal?.aborted) throw e;
      aviso = `A capa com IA não saiu: ${e.message}`;
    }
  }
  return { opcoes, escolhida: 0, aviso };
}
