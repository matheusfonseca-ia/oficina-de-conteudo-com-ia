// The factory cover: frame + hook title in the video's style colors, rendered to PNG by the
// student's own Chrome or Edge (playwright-core, no browser download).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT } from '../config.mjs';

export const PALETA_OFICINA = { fundo: '#15161A', destaque: '#D1DECD', texto: '#F0F1F4' };
const COR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
// "#abc" → "#aabbcc", so an alpha suffix ("…CC") stays a valid colour.
const seis = c => (c.length === 4 ? '#' + [...c.slice(1)].map(x => x + x).join('') : c);
const lerJSON = arq => { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; } };

// Style colors → brand color as the highlight → the Oficina palette.
export function coresDoEstilo(pastaVideo) {
  const escolhas = lerJSON(path.join(pastaVideo, 'edit', 'escolhas.json'));
  const contexto = lerJSON(path.join(pastaVideo, 'edit', 'painel-contexto.json'));
  const id = escolhas?.estiloVisual?.id;
  const estilo = Array.isArray(contexto?.estilosVisuais) ? contexto.estilosVisuais.find(e => e?.id === id) : null;
  const cores = { ...PALETA_OFICINA };
  const marca = escolhas?.respostas?.corMarca ?? escolhas?.corMarca;
  if (COR.test(marca || '')) cores.destaque = seis(marca);
  for (const k of Object.keys(PALETA_OFICINA)) if (COR.test(estilo?.cores?.[k] || '')) cores[k] = seis(estilo.cores[k]);
  return cores;
}

const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let fonte = null;
const fonteManrope = () => (fonte ??= fs.readFileSync(path.join(ROOT, 'src', 'fonts', 'Manrope-latin.woff2')).toString('base64'));

export function htmlDaCapa({ frame, titulo, cores: c, largura, altura }) {
  const cores = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, seis(String(v))]));
  const palavras = String(titulo).trim().split(/\s+/);
  const ultima = palavras.pop();
  const texto = `${palavras.map(escapar).join(' ')}${palavras.length ? ' ' : ''}<span class="destaque">${escapar(ultima ?? '')}</span>`;
  const tam = Math.round(Math.min(largura, altura) * 0.115);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Manrope'; font-weight: 400 800; src: url(data:font/woff2;base64,${fonteManrope()}) format('woff2'); }
* { margin: 0; box-sizing: border-box; }
html, body { width: ${largura}px; height: ${altura}px; overflow: hidden; background: ${cores.fundo}; }
.capa { position: relative; width: ${largura}px; height: ${altura}px; }
.capa img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.capa .sombra { position: absolute; inset: 0; background: linear-gradient(to top, ${cores.fundo} 0%, ${cores.fundo}CC 22%, transparent 55%); }
.capa h1 { position: absolute; left: 6%; right: 6%; bottom: 9%; font: 800 ${tam}px/1.05 'Manrope', sans-serif; letter-spacing: -0.02em;
  color: ${cores.texto}; text-transform: uppercase; text-shadow: 0 4px 24px rgba(0,0,0,.45); }
.capa .destaque { color: ${cores.destaque}; }
</style></head><body><div class="capa"><img src="${frame}" alt=""><div class="sombra"></div><h1>${texto}</h1></div></body></html>`;
}

export class SemNavegador extends Error {
  constructor() { super('Não achei o Chrome nem o Edge neste computador, então o vídeo segue sem capa.'); this.name = 'SemNavegador'; }
}

export async function renderizarPNG(html, destino, { largura, altura, abrir = o => chromium.launch(o) }) {
  let navegador = null;
  for (const channel of ['chrome', 'msedge']) { try { navegador = await abrir({ channel }); break; } catch {} }
  if (!navegador) throw new SemNavegador();
  try {
    const pagina = await navegador.newPage({ viewport: { width: largura, height: altura } });
    await pagina.setContent(html, { waitUntil: 'load' });
    await pagina.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    await pagina.screenshot({ path: destino, type: 'png' });
    return destino;
  } finally { await navegador.close().catch(() => {}); }
}
