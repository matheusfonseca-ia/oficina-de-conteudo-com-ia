import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFicha, aplicar, ETAPAS, SEQUENCIA, salaDaEtapa, emTrabalho } from '../lib/ficha.mjs';

const ETAPA1 = ['pesquisa', 'roteiro', 'capa', 'analise'];
const novo = (extra = {}) => criarFicha({ id: 'v1', porta: 'bruto', bruto: 'bruto.mp4', pular: ETAPA1, agora: 1, ...extra });

test('every etapa in SEQUENCIA has metadata and a sala', () => {
  for (const e of SEQUENCIA) { assert.ok(ETAPAS[e], e); assert.ok(salaDaEtapa(e)); }
});

test('porta bruto starts at bruto-recebido (trabalho da edição)', () => {
  const f = novo();
  assert.equal(f.etapa, 'bruto-recebido');
  assert.equal(salaDaEtapa(f.etapa), 'edicao');
  assert.ok(emTrabalho(f));
});

test('porta ideia with pesquisa and roteiro skipped waits for the recording', () => {
  const f = criarFicha({ id: 'v2', porta: 'ideia', tema: 'IA no varejo', pular: ETAPA1, agora: 1 });
  assert.equal(f.etapa, 'aguardando-gravacao');
  assert.equal(aplicar(f, { tipo: 'bruto', arquivo: 'bruto.mov' }).etapa, 'bruto-recebido');
});

test('porta ideia with everything active starts at pesquisa', () => {
  assert.equal(criarFicha({ id: 'v3', porta: 'ideia', tema: 't', agora: 1 }).etapa, 'pesquisa');
});

test('full etapa-1 path: bruto → … → pronto-pra-postar → publicado → concluido', () => {
  let f = novo();
  f = aplicar(f, { tipo: 'concluiu' });                       assert.equal(f.etapa, 'escolhas-edicao');
  f = aplicar(f, { tipo: 'escolhas-prontas' });               assert.equal(f.etapa, 'editando');
  f = aplicar(f, { tipo: 'concluiu', dados: { studioUrl: 'http://localhost:3002' } });
  assert.equal(f.etapa, 'aprovacao-video'); assert.equal(f.edicao.studioUrl, 'http://localhost:3002');
  f = aplicar(f, { tipo: 'aprovou' });                        assert.equal(f.etapa, 'exportando');
  f = aplicar(f, { tipo: 'concluiu' });                       assert.equal(f.etapa, 'postagem'); // capa pulada
  const post = { legenda: 'oi', hashtags: ['#a'], horario: '2026-11-06T18:00:00-03:00' };
  f = aplicar(f, { tipo: 'concluiu', dados: { postagem: post } });
  assert.equal(f.etapa, 'aprovacao-pacote'); assert.deepEqual(f.postagem, post);
  f = aplicar(f, { tipo: 'aprovou' });                        assert.equal(f.etapa, 'pronto-pra-postar');
  f = aplicar(f, { tipo: 'postado' });                        assert.equal(f.etapa, 'concluido'); // análise pulada
  assert.equal(ETAPAS[f.etapa].tipo, 'fim');
});

test('revisar on aprovacao-video goes back to editando and keeps the text', () => {
  let f = { ...novo(), etapa: 'aprovacao-video' };
  f = aplicar(f, { tipo: 'revisar', texto: 'legenda maior' });
  assert.equal(f.etapa, 'editando'); assert.equal(f.revisao, 'legenda maior');
  f = aplicar(f, { tipo: 'concluiu', dados: { studioUrl: 'http://x' } });
  assert.equal(f.revisao, null);
});

test('revisar on aprovacao-pacote goes back to postagem', () => {
  const f = aplicar({ ...novo(), etapa: 'aprovacao-pacote' }, { tipo: 'revisar', texto: 'legenda mais curta' });
  assert.equal(f.etapa, 'postagem'); assert.equal(f.revisao, 'legenda mais curta');
});

test('falhou keeps the etapa and records the error; tentar-de-novo clears it', () => {
  let f = aplicar(novo(), { tipo: 'falhou', mensagem: 'Falta o FFmpeg' }, 5);
  assert.equal(f.etapa, 'bruto-recebido');
  assert.deepEqual(f.erro, { sala: 'edicao', mensagem: 'Falta o FFmpeg', em: 5 });
  assert.equal(emTrabalho(f), false); // a ficha com erro não volta pra fila sozinha
  f = aplicar(f, { tipo: 'tentar-de-novo' });
  assert.equal(f.erro, null); assert.ok(emTrabalho(f));
});

test('pular postagem after export ends the ficha', () => {
  let f = { ...novo(), etapa: 'exportando' };
  f = aplicar(f, { tipo: 'pular', sala: 'postagem' });
  f = aplicar(f, { tipo: 'concluiu' });
  assert.equal(f.etapa, 'concluido');
});

test('pular the sala of the current etapa advances immediately', () => {
  const f = aplicar({ ...novo(), pular: ['pesquisa', 'roteiro', 'analise'], etapa: 'capa' }, { tipo: 'pular', sala: 'capa' });
  assert.equal(f.etapa, 'postagem');
});

test('edição cannot be skipped and wrong events are refused in pt-BR', () => {
  assert.throws(() => aplicar(novo(), { tipo: 'pular', sala: 'edicao' }), /não pode ser pulada/);
  assert.throws(() => aplicar(novo(), { tipo: 'aprovou' }), /não está esperando aprovação/);
  assert.throws(() => aplicar(novo(), { tipo: 'postado' }), /ainda não está pronto pra postar/);
});

test('aplicar never mutates the input and appends to historico', () => {
  const f = novo(); const copia = JSON.stringify(f);
  const g = aplicar(f, { tipo: 'concluiu' }, 9);
  assert.equal(JSON.stringify(f), copia);
  assert.deepEqual(g.historico.at(-1), { em: 9, etapa: 'escolhas-edicao', nota: 'concluiu' });
  assert.equal(g.atualizadaEm, 9);
});
