import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { argsSala } from '../lib/runner-sala.mjs';
import { FERRAMENTAS_CAPA, MAX_TURNOS_CAPA, montarPrompt, lerResposta, rodarCapa } from '../lib/runner-capa.mjs';
import { SemNavegador } from '../lib/capa-modelo.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const config = { claude: { command: process.execPath, prefixArgs: [FAKE] }, dados: os.tmpdir() };
const FRAMES = Array.from({ length: 12 }, (_, i) => `capa/frames/frame-${String(i + 1).padStart(2, '0')}.jpg`);

function pastaComVideo() {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-capa-'));
  fs.mkdirSync(path.join(p, 'edit')); fs.writeFileSync(path.join(p, 'edit', 'final.mp4'), 'mp4');
  fs.writeFileSync(path.join(p, 'edit', 'resumo.md'), '# Resumo do vídeo\nTema: IA no varejo');
  const cerebro = path.join(p, 'cerebro'); fs.mkdirSync(cerebro); fs.writeFileSync(path.join(cerebro, 'perfil.md'), 'Tom: direto');
  return { p, cerebro };
}
// Fake frames/PNG/IA so no FFmpeg or browser runs here.
function depsFalsos({ vertical = true, png, ia, chave = null } = {}) {
  const chamadas = { png: [], ia: [] };
  return {
    chamadas,
    deps: {
      extrairFrames: (mp4, saida) => {
        fs.mkdirSync(saida, { recursive: true });
        const frames = FRAMES.map((_, i) => { const a = path.join(saida, `frame-${String(i + 1).padStart(2, '0')}.jpg`); fs.writeFileSync(a, `frame${i}`); return { arquivo: a, segundo: i }; });
        return { video: { largura: vertical ? 1080 : 1920, altura: vertical ? 1920 : 1080, duracao: 30, vertical }, frames };
      },
      renderizarPNG: png || (async (html, destino, tam) => { chamadas.png.push({ html, destino, tam }); fs.writeFileSync(destino, 'png'); return destino; }),
      gerarCapaIA: ia || (async o => { chamadas.ia.push(o); fs.writeFileSync(o.destino, 'png'); return o.destino; }),
      chaveHiggsfield: () => chave,
    },
  };
}
const RESPOSTA = JSON.stringify({ frame: 2, titulos: ['Título de teste um', 'Título dois'], promptIA: 'a person talking' });
const runCom = texto => async () => ({ text: texto });

test('argsSala da capa: só Read, 16 turnos', () => {
  const a = argsSala('oi', { ferramentas: FERRAMENTAS_CAPA, maxTurnos: MAX_TURNOS_CAPA });
  assert.equal(a[a.indexOf('--tools') + 1], 'Read');
  assert.equal(a[a.indexOf('--allowedTools') + 1], 'Read');
  assert.equal(a[a.indexOf('--max-turns') + 1], '16');
});

test('montarPrompt leva frames, resumo, perfil, revisão e os títulos anteriores', () => {
  const p = montarPrompt({ resumo: 'Tema: IA', roteiro: 'Gancho X', perfil: 'Tom: direto', frames: FRAMES, revisao: 'mais contraste', anterior: { opcoes: [{ titulo: 'Velho título' }] }, aprendizados: '- 2026-11-01: sem emoji' });
  for (const s of ['sala de CAPA', 'capa/frames/frame-01.jpg', 'capa/frames/frame-12.jpg', 'Tema: IA', 'Gancho X', 'Tom: direto', 'mais contraste', 'Velho título', 'sem emoji']) assert.ok(p.includes(s), s);
});

test('lerResposta: frame fora da faixa é erro', () => {
  assert.throws(() => lerResposta(JSON.stringify({ frame: 12, titulos: ['a'] }), 12), /frame que não existe/);
  assert.throws(() => lerResposta(JSON.stringify({ frame: '1', titulos: ['a'] }), 12), /frame que não existe/);
});

test('lerResposta limpa títulos: vazios fora, até 6 palavras, no máximo 3', () => {
  const r = lerResposta(JSON.stringify({ frame: 0, titulos: ['', 'a b c d e f g h', 'x', 'y'], promptIA: 'p' }), 12);
  assert.deepEqual(r.titulos, ['a b c d e f', 'x', 'y']);
  assert.equal(r.promptIA, 'p');
});

test('lerResposta sem títulos ou sem JSON é erro', () => {
  assert.throws(() => lerResposta(JSON.stringify({ frame: 0, titulos: [] }), 12), /não devolveu títulos/);
  assert.throws(() => lerResposta('nada aqui', 12), /não devolveu/);
});

test('rodarCapa sem chave: duas capas de fábrica no tamanho do vídeo vertical', async () => {
  const { p, cerebro } = pastaComVideo(); const { deps, chamadas } = depsFalsos();
  const r = await rodarCapa({ pastaVideo: p, ficha: { revisao: null, capa: null }, cerebroDir: cerebro, config, run: runCom(RESPOSTA), deps });
  assert.equal(r.escolhida, 0); assert.equal(r.aviso, null);
  assert.deepEqual(r.opcoes, [{ arquivo: 'capa/capa-1.png', titulo: 'Título de teste um', origem: 'fabrica' }, { arquivo: 'capa/capa-2.png', titulo: 'Título dois', origem: 'fabrica' }]);
  assert.deepEqual(chamadas.png[0].tam, { largura: 1080, altura: 1920 });
  assert.ok(fs.existsSync(path.join(p, 'capa', 'capa-2.png')));
  assert.equal(chamadas.ia.length, 0);
});

test('rodarCapa usa 1280×720 em vídeo horizontal', async () => {
  const { p, cerebro } = pastaComVideo(); const { deps, chamadas } = depsFalsos({ vertical: false });
  await rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, run: runCom(RESPOSTA), deps });
  assert.deepEqual(chamadas.png[0].tam, { largura: 1280, altura: 720 });
});

test('rodarCapa com chave do Higgsfield: terceira opção IA a partir do frame escolhido', async () => {
  const { p, cerebro } = pastaComVideo(); const { deps, chamadas } = depsFalsos({ chave: 'a:b' });
  const r = await rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, run: runCom(RESPOSTA), deps });
  assert.equal(r.opcoes.length, 3);
  assert.deepEqual(r.opcoes[2], { arquivo: 'capa/capa-ia.png', titulo: 'Título de teste um', origem: 'higgsfield' });
  assert.equal(path.basename(chamadas.ia[0].frame), 'frame-03.jpg');
  assert.equal(chamadas.ia[0].chave, 'a:b'); assert.equal(chamadas.ia[0].proporcao, '9:16');
  assert.ok(chamadas.ia[0].prompt.includes('a person talking') && chamadas.ia[0].prompt.includes('Título de teste um'));
});

test('rodarCapa: falha do Higgsfield vira aviso e o vídeo segue', async () => {
  const { p, cerebro } = pastaComVideo();
  const { deps } = depsFalsos({ chave: 'a:b', ia: async () => { throw new Error('Acabaram os créditos do Higgsfield.'); } });
  const r = await rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, run: runCom(RESPOSTA), deps });
  assert.equal(r.opcoes.length, 2); assert.match(r.aviso, /Acabaram os créditos do Higgsfield/);
});

test('rodarCapa sem navegador: sem capas, com aviso', async () => {
  const { p, cerebro } = pastaComVideo();
  const { deps } = depsFalsos({ png: async () => { throw new SemNavegador(); } });
  const r = await rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, run: runCom(RESPOSTA), deps });
  assert.deepEqual(r.opcoes, []); assert.equal(r.escolhida, null); assert.match(r.aviso, /Chrome nem o Edge/);
});

test('rodarCapa sem final.mp4 é erro claro', async () => {
  const { p, cerebro } = pastaComVideo(); fs.rmSync(path.join(p, 'edit', 'final.mp4'));
  const { deps } = depsFalsos();
  await assert.rejects(rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, run: runCom(RESPOSTA), deps }), /edit\/final\.mp4/);
});

test('rodarCapa com o Claude falso de verdade escolhe o frame 2', async () => {
  const { p, cerebro } = pastaComVideo(); const { deps, chamadas } = depsFalsos();
  await rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, deps });
  assert.ok(chamadas.png[0].html.includes(Buffer.from('frame2').toString('base64')), 'usou o frame-03.jpg');
});

test('rodarCapa manda os frames com caminho completo e pede pra abrir todos de uma vez', async () => {
  const { p, cerebro } = pastaComVideo(); const { deps } = depsFalsos();
  let prompt = '';
  await rodarCapa({ pastaVideo: p, ficha: {}, cerebroDir: cerebro, config, run: async o => { prompt = o.args[o.args.indexOf('-p') + 1]; return { text: RESPOSTA }; }, deps });
  assert.ok(prompt.includes(path.join(p, 'capa', 'frames', 'frame-01.jpg')), 'caminho completo');
  assert.match(prompt, /todas de uma vez/);
});
