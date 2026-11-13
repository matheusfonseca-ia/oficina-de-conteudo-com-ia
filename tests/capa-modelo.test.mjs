import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PALETA_OFICINA, coresDoEstilo, htmlDaCapa, renderizarPNG, SemNavegador } from '../lib/capa-modelo.mjs';

const pastaVideo = (escolhas, contexto) => {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-modelo-'));
  fs.mkdirSync(path.join(p, 'edit'));
  if (escolhas !== undefined) fs.writeFileSync(path.join(p, 'edit', 'escolhas.json'), typeof escolhas === 'string' ? escolhas : JSON.stringify(escolhas));
  if (contexto !== undefined) fs.writeFileSync(path.join(p, 'edit', 'painel-contexto.json'), JSON.stringify(contexto));
  return p;
};

test('coresDoEstilo usa as cores do estilo escolhido', () => {
  const cores = { fundo: '#000000', destaque: '#FF0000', texto: '#FFFFFF' };
  const p = pastaVideo({ estiloVisual: { id: 'meu' } }, { estilosVisuais: [{ id: 'outro', cores: { fundo: '#111111', destaque: '#222222', texto: '#333333' } }, { id: 'meu', cores: { ...cores, card: '#123456' } }] });
  assert.deepEqual(coresDoEstilo(p), cores);
});

test('coresDoEstilo usa a cor da marca como destaque', () => {
  const p = pastaVideo({ estiloVisual: { id: 'pixelado' }, respostas: { corMarca: '#9A4DFF' } }, { estilosVisuais: [] });
  assert.deepEqual(coresDoEstilo(p), { ...PALETA_OFICINA, destaque: '#9A4DFF' });
});

test('coresDoEstilo cai na paleta da Oficina sem arquivo, com arquivo quebrado ou cor inválida', () => {
  assert.deepEqual(coresDoEstilo(pastaVideo()), PALETA_OFICINA);
  assert.deepEqual(coresDoEstilo(pastaVideo('{')), PALETA_OFICINA);
  const p = pastaVideo({ estiloVisual: { id: 'meu' } }, { estilosVisuais: [{ id: 'meu', cores: { fundo: 'red', destaque: '#ABC', texto: 'javascript:x' } }] });
  assert.deepEqual(coresDoEstilo(p), { ...PALETA_OFICINA, destaque: '#AABBCC' });
});

test('htmlDaCapa escapa o título, mantém emoji e destaca a última palavra', () => {
  const h = htmlDaCapa({ frame: 'data:image/jpeg;base64,AAAA', titulo: '5 erros <de> "IA" & você 🚀', cores: PALETA_OFICINA, largura: 1080, altura: 1920 });
  for (const s of ['&lt;de&gt;', '&quot;IA&quot;', '&amp;', '🚀', '1080px', '1920px', 'data:image/jpeg;base64,AAAA']) assert.ok(h.includes(s), s);
  assert.ok(!h.includes('<de>'));
  assert.match(h, /<span class="destaque">🚀<\/span>/);
});

test('renderizarPNG sem Chrome nem Edge lança SemNavegador depois de tentar os dois', async () => {
  const tentados = [];
  const abrir = async o => { tentados.push(o.channel); throw new Error('não achou'); };
  await assert.rejects(renderizarPNG('<p>x</p>', path.join(os.tmpdir(), 'nao.png'), { largura: 10, altura: 10, abrir }), e => e instanceof SemNavegador && /Chrome nem o Edge/.test(e.message));
  assert.deepEqual(tentados, ['chrome', 'msedge']);
});

test('renderizarPNG gera PNG no tamanho pedido (navegador real)', async t => {
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-png-')), 'capa.png');
  try { await renderizarPNG(htmlDaCapa({ frame: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', titulo: 'Teste da capa', cores: PALETA_OFICINA, largura: 1080, altura: 1920 }), destino, { largura: 1080, altura: 1920 }); }
  catch (e) { if (e instanceof SemNavegador) return t.skip('sem Chrome/Edge'); throw e; }
  const b = fs.readFileSync(destino);
  assert.equal(b.readUInt32BE(16), 1080); assert.equal(b.readUInt32BE(20), 1920);
});

test('htmlDaCapa com cor de 3 dígitos ainda monta um degradê válido', () => {
  const h = htmlDaCapa({ frame: 'data:,', titulo: 'a', cores: { fundo: '#abc', destaque: '#def', texto: '#fff' }, largura: 10, altura: 10 });
  assert.ok(h.includes('#aabbccCC') && !/#abcCC/.test(h));
});
