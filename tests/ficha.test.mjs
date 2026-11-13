import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFicha, aplicar, ETAPAS, SEQUENCIA, salaDaEtapa, emTrabalho, salaDoAjuste } from '../lib/ficha.mjs';

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

const REFS = { referencias: [{ titulo: 'A', url: 'https://a', porQueFuncionou: 'x' }, { titulo: 'B', url: 'https://b', porQueFuncionou: 'y' }] };
const ROT = { titulo: 'T', gancho: 'G', desenvolvimento: ['d1'], cta: 'C', duracaoSegundos: 40 };
const ideia = (extra = {}) => criarFicha({ id: 'i1', porta: 'ideia', tema: 'IA no varejo', pular: ['capa', 'analise'], agora: 1, ...extra });

test('porta bruto skips pesquisa and roteiro on its own and starts with empty fields', () => {
  const f = criarFicha({ id: 'b1', porta: 'bruto', bruto: 'bruto.mp4', agora: 1 });
  assert.ok(f.pular.includes('pesquisa') && f.pular.includes('roteiro'));
  assert.equal(f.pesquisa, null); assert.equal(f.referencia, null); assert.equal(f.roteiro, null);
});

test('ideia path: pesquisa → escolha → roteiro → revisar → aprovação → gravação → bruto', () => {
  let f = ideia();
  assert.equal(f.etapa, 'pesquisa');
  f = aplicar(f, { tipo: 'concluiu', dados: { pesquisa: REFS } });
  assert.equal(f.etapa, 'escolha-referencia'); assert.deepEqual(f.pesquisa, REFS);
  f = aplicar(f, { tipo: 'escolheu-referencia', indice: 1 });
  assert.equal(f.etapa, 'roteiro'); assert.equal(f.referencia.titulo, 'B');
  f = aplicar(f, { tipo: 'concluiu', dados: { roteiro: ROT } });
  assert.equal(f.etapa, 'aprovacao-roteiro'); assert.deepEqual(f.roteiro, ROT);
  f = aplicar(f, { tipo: 'revisar', texto: 'mais curto' });
  assert.equal(f.etapa, 'roteiro'); assert.equal(f.revisao, 'mais curto');
  f = aplicar(f, { tipo: 'concluiu', dados: { roteiro: ROT } });
  assert.equal(f.revisao, null);
  f = aplicar(f, { tipo: 'aprovou' }); assert.equal(f.etapa, 'aguardando-gravacao');
  f = aplicar(f, { tipo: 'bruto', arquivo: 'bruto.mp4' });
  assert.equal(f.etapa, 'bruto-recebido'); assert.equal(f.bruto, 'bruto.mp4');
});

test('escolheu-referencia: null means no reference; a missing or bad index is refused in pt-BR', () => {
  const f = aplicar(ideia(), { tipo: 'concluiu', dados: { pesquisa: REFS } });
  const sem = aplicar(f, { tipo: 'escolheu-referencia', indice: null });
  assert.equal(sem.referencia, null); assert.equal(sem.etapa, 'roteiro');
  for (const indice of [undefined, 2, -1, '0', 1.5]) assert.throws(() => aplicar(f, { tipo: 'escolheu-referencia', indice }), /Essa referência não existe/);
});

test('revisar on escolha-referencia searches again with the text; aprovar there is refused', () => {
  const f = aplicar(ideia(), { tipo: 'concluiu', dados: { pesquisa: REFS } });
  const r = aplicar(f, { tipo: 'revisar', texto: 'só em português' });
  assert.equal(r.etapa, 'pesquisa'); assert.equal(r.revisao, 'só em português'); assert.deepEqual(r.pesquisa, REFS);
  assert.throws(() => aplicar(f, { tipo: 'aprovou' }), /não está esperando aprovação/);
});

test('pular pesquisa while it failed goes straight to roteiro without a reference', () => {
  let f = aplicar(ideia(), { tipo: 'falhou', mensagem: 'sem referências' });
  f = aplicar(f, { tipo: 'pular', sala: 'pesquisa' });
  assert.equal(f.etapa, 'roteiro'); assert.equal(f.erro, null); assert.equal(f.referencia, null);
});

// ---------- Etapa 3: sala de Capa ----------
const CAPA = { opcoes: [{ arquivo: 'capa/capa-1.png', titulo: 'Um', origem: 'fabrica' }, { arquivo: 'capa/capa-2.png', titulo: 'Dois', origem: 'fabrica' }], escolhida: 0, aviso: null };
const POST = { legenda: 'L', hashtags: ['#a'], horario: '2099-01-01T21:00:00.000Z', motivoHorario: 'x' };
const comCapa = (extra = {}) => ({ ...criarFicha({ id: 'c1', porta: 'bruto', bruto: 'bruto.mp4', pular: ['pesquisa', 'roteiro', 'analise'], agora: 1 }), ...extra });

test('criarFicha starts with capa null', () => { assert.equal(novo().capa, null); });

test('concluiu na capa grava a capa e vai pra postagem', () => {
  const f = aplicar(comCapa({ etapa: 'capa' }), { tipo: 'concluiu', dados: { capa: CAPA } });
  assert.equal(f.etapa, 'postagem'); assert.equal(f.capa.opcoes.length, 2); assert.equal(f.capa.escolhida, 0);
});

test('escolheu-capa troca a escolhida na aprovação do post', () => {
  const f = aplicar(comCapa({ etapa: 'aprovacao-pacote', capa: CAPA, postagem: POST }), { tipo: 'escolheu-capa', indice: 1 });
  assert.equal(f.capa.escolhida, 1); assert.equal(f.etapa, 'aprovacao-pacote');
});

test('escolheu-capa recusa índice inválido ou fora da aprovação', () => {
  const f = comCapa({ etapa: 'aprovacao-pacote', capa: CAPA, postagem: POST });
  for (const indice of [9, -1, '0', 1.5, undefined]) assert.throws(() => aplicar(f, { tipo: 'escolheu-capa', indice }), /Essa capa não existe/, String(indice));
  assert.throws(() => aplicar({ ...f, etapa: 'postagem' }, { tipo: 'escolheu-capa', indice: 0 }), /não está esperando aprovação/);
});

test('refazer capa volta pra capa e depois direto pra aprovação', () => {
  let f = aplicar(comCapa({ etapa: 'aprovacao-pacote', capa: CAPA, postagem: POST }), { tipo: 'revisar', sala: 'capa', texto: 'mais contraste' });
  assert.equal(f.etapa, 'capa'); assert.equal(f.revisao, 'mais contraste'); assert.equal(f.capa.refazendo, true);
  f = aplicar(f, { tipo: 'concluiu', dados: { capa: { ...CAPA, escolhida: 0 } } });
  assert.equal(f.etapa, 'aprovacao-pacote'); assert.equal(f.capa.refazendo, undefined); assert.deepEqual(f.postagem, POST); assert.equal(f.revisao, null);
});

test('revisar sem sala na aprovação do post continua refazendo a legenda', () => {
  const f = aplicar(comCapa({ etapa: 'aprovacao-pacote', capa: CAPA, postagem: POST }), { tipo: 'revisar', texto: 'mais curta' });
  assert.equal(f.etapa, 'postagem');
});

test('salaDoAjuste aponta a sala que aprende com o ajuste', () => {
  const f = comCapa({ etapa: 'aprovacao-pacote' });
  assert.equal(salaDoAjuste(f, { tipo: 'revisar', sala: 'capa' }), 'capa');
  assert.equal(salaDoAjuste(f, { tipo: 'revisar' }), 'postagem');
  assert.equal(salaDoAjuste({ ...f, etapa: 'aprovacao-roteiro' }, { tipo: 'revisar' }), 'roteiro');
});

test('pular a Capa no meio do Refazer capa volta pra aprovação sem reescrever a legenda', () => {
  let f = aplicar(comCapa({ etapa: 'aprovacao-pacote', capa: CAPA, postagem: POST }), { tipo: 'revisar', sala: 'capa', texto: 'mais contraste' });
  f = aplicar(f, { tipo: 'pular', sala: 'capa' });
  assert.equal(f.etapa, 'aprovacao-pacote'); assert.equal(f.revisao, null); assert.equal(f.capa.refazendo, undefined); assert.deepEqual(f.postagem, POST);
});
