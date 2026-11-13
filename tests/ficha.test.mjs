import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFicha, aplicar, ETAPAS, SEQUENCIA, ETAPAS_POR_EVENTO, textoDaEspera, salaDaEtapa, emTrabalho, salaDoAjuste, MARGEM_CANCELAR_MS, podeCancelar, podeVoltarPraAprovacao } from '../lib/ficha.mjs';

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

// ---------- Etapa 4: publicação pelo Post for Me, espera dos números e leituras ----------
const AGORA = Date.parse('2026-11-20T12:00:00Z');
const CONTAS = [{ id: 'spc_tt', plataforma: 'tiktok', usuario: '@a' }, { id: 'spc_yt', plataforma: 'youtube', usuario: 'A' }];
const FUTURO = '2026-11-21T18:00:00Z';

// Uma ficha em aprovacao-pacote, montada só com `aplicar`.
function noPacote(pular = []) {
  let f = criarFicha({ id: 'p1', porta: 'bruto', bruto: 'bruto.mp4', pular, agora: AGORA });
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);           // escolhas-edicao
  f = aplicar(f, { tipo: 'escolhas-prontas' }, AGORA);   // editando
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);           // aprovacao-video
  f = aplicar(f, { tipo: 'aprovou' }, AGORA);            // exportando
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);           // capa
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);           // postagem
  f = aplicar(f, { tipo: 'concluiu', dados: { postagem: POST } }, AGORA);
  assert.equal(f.etapa, 'aprovacao-pacote');
  return f;
}
const conta = (c, status, extra = {}) => ({ plataforma: c.plataforma, usuario: c.usuario, status, postId: 'pst_1', idNaRede: null, link: null, erro: null, ...extra });
// Publicação como o runner a devolve: cada conta no status dado.
const publicacao = (status, base) => ({ ...base, contas: Object.fromEntries(CONTAS.map(c => [c.id, conta(c, status[c.id])])) });
function emAgendado(status, pular = []) {
  let f = aplicar(noPacote(pular), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  const pub = publicacao(status, { ...f.publicacao, postIds: ['pst_1'] });
  f = aplicar(f, { tipo: 'concluiu', dados: { publicacao: pub } }, AGORA);
  assert.equal(f.etapa, 'agendado');
  return f;
}
const TT_OK = { conta: 'spc_tt', ok: true, idNaRede: 'v1', link: 'https://tiktok.com/v1', erro: null };
const YT_OK = { conta: 'spc_yt', ok: true, idNaRede: 'y1', link: 'https://youtu.be/y1', erro: null };
const TT_ERRO = { conta: 'spc_tt', ok: false, idNaRede: null, link: null, erro: 'TikTok recusou' };
const YT_ERRO = { conta: 'spc_yt', ok: false, idNaRede: null, link: null, erro: 'YouTube recusou' };

test('as etapas novas existem e ficam fora do caminho normal', () => {
  assert.deepEqual(ETAPAS.publicando, { sala: 'postagem', tipo: 'trabalho', texto: 'Enviando pro Post for Me' });
  assert.deepEqual(ETAPAS['aguardando-numeros'], { sala: 'analise', tipo: 'espera', texto: 'Esperando os números' });
  assert.equal(ETAPAS.agendado.texto, 'Agendado no Post for Me');
  assert.deepEqual(ETAPAS_POR_EVENTO, ['publicando', 'agendado', 'aguardando-numeros', 'analise']);
  assert.deepEqual(SEQUENCIA.slice(-7), ['aprovacao-pacote', 'pronto-pra-postar', 'publicando', 'agendado', 'aguardando-numeros', 'analise', 'concluido']);
});

test('criarFicha começa com publicacao e analise nulas', () => {
  const f = novo(); assert.equal(f.publicacao, null); assert.equal(f.analise, null);
});

test('aprovar com publicar vai pra publicando', () => {
  const f = aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  assert.equal(f.etapa, 'publicando');
  assert.deepEqual(f.publicacao.pendentes, ['spc_tt', 'spc_yt']);
  assert.equal(f.publicacao.contas.spc_tt.status, 'enviando'); assert.equal(f.publicacao.contas.spc_yt.status, 'enviando');
  assert.equal(f.publicacao.contas.spc_yt.plataforma, 'youtube'); assert.equal(f.publicacao.contas.spc_yt.usuario, 'A');
  assert.equal(f.publicacao.tentativas, 0); assert.deepEqual(f.publicacao.postIds, []);
  assert.equal(f.publicacao.pedido.quando, null); assert.deepEqual(f.publicacao.pedido.contas, CONTAS);
  assert.equal(f.publicacao.publicadoEm, null); assert.equal(f.publicacao.erro, null);
  const g = aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: FUTURO } }, AGORA);
  assert.equal(g.publicacao.pedido.quando, new Date(FUTURO).toISOString());
});

test('aprovar com publicar recusa sem rede ou horário no passado', () => {
  const f = noPacote();
  assert.throws(() => aplicar(f, { tipo: 'aprovou', publicar: { contas: [], quando: null } }, AGORA), /Marque pelo menos uma rede/);
  assert.throws(() => aplicar(f, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: '2026-11-20T11:00:00Z' } }, AGORA), /daqui pra frente/);
  assert.throws(() => aplicar(f, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: '2026-11-20T12:00:30Z' } }, AGORA), /daqui pra frente/);
  assert.throws(() => aplicar(f, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: 'amanhã' } }, AGORA), /daqui pra frente/);
});

test('aprovar sem publicar continua indo pra pronto-pra-postar', () => {
  const f = aplicar(noPacote(), { tipo: 'aprovou' }, AGORA);
  assert.equal(f.etapa, 'pronto-pra-postar'); assert.equal(f.publicacao, null);
});

test('concluiu na publicando vai pra agendado com a publicacao dos dados', () => {
  let f = aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  const pub = publicacao({ spc_tt: 'esperando', spc_yt: 'esperando' }, { ...f.publicacao, postIds: ['pst_1'] });
  f = aplicar(f, { tipo: 'concluiu', dados: { publicacao: pub } }, AGORA);
  assert.equal(f.etapa, 'agendado'); assert.deepEqual(f.publicacao, pub);
});

test('publicou com uma conta ainda esperando fica em agendado', () => {
  const f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_OK] }, AGORA);
  assert.equal(f.etapa, 'agendado');
  assert.equal(f.publicacao.contas.spc_tt.status, 'publicado'); assert.equal(f.publicacao.contas.spc_tt.link, 'https://tiktok.com/v1');
  assert.equal(f.publicacao.contas.spc_tt.idNaRede, 'v1'); assert.equal(f.publicacao.contas.spc_yt.status, 'esperando');
  assert.equal(f.publicacao.publicadoEm, null);
});

test('publicou com as duas ok vai pra aguardando-numeros', () => {
  let f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_OK, YT_OK] }, AGORA);
  assert.equal(f.etapa, 'aguardando-numeros');
  assert.equal(f.publicacao.publicadoEm, new Date(AGORA).toISOString());
  assert.deepEqual(f.analise, { proxima: null, leituras: [] });
  // com a Análise pulada, conclui direto
  f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }, ['analise']), { tipo: 'publicou', resultados: [TT_OK, YT_OK] }, AGORA);
  assert.equal(f.etapa, 'concluido');
});

test('publicou com tudo falhando volta pra aprovacao-pacote com o erro', () => {
  const f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_ERRO, YT_ERRO] }, AGORA);
  assert.equal(f.etapa, 'aprovacao-pacote');
  assert.match(f.publicacao.erro, /^O Post for Me não conseguiu postar: /);
  assert.match(f.publicacao.erro, /TikTok recusou/); assert.match(f.publicacao.erro, /YouTube recusou/);
});

test('publicou fora do agendado é recusado', () => {
  assert.throws(() => aplicar(noPacote(), { tipo: 'publicou', resultados: [TT_OK] }, AGORA), /não está agendado/);
});

test('republicar só a conta que falhou', () => {
  const f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_OK, YT_ERRO] }, AGORA);
  assert.equal(f.etapa, 'aguardando-numeros');
  const r = aplicar(f, { tipo: 'republicar', conta: 'spc_yt' }, AGORA);
  assert.equal(r.etapa, 'publicando'); assert.deepEqual(r.publicacao.pendentes, ['spc_yt']);
  assert.equal(r.publicacao.contas.spc_yt.status, 'enviando'); assert.equal(r.publicacao.contas.spc_tt.status, 'publicado');
  assert.throws(() => aplicar(f, { tipo: 'republicar', conta: 'spc_tt' }, AGORA), /não falhou/);
  assert.throws(() => aplicar(f, { tipo: 'republicar', conta: 'spc_xx' }, AGORA), /não falhou/);
});

test('republicar também vale em agendado', () => {
  const f = emAgendado({ spc_tt: 'esperando', spc_yt: 'falhou' });
  assert.equal(aplicar(f, { tipo: 'republicar', conta: 'spc_yt' }, AGORA).etapa, 'publicando');
});

test('postar-na-mao marca manual', () => {
  const f = emAgendado({ spc_tt: 'publicado', spc_yt: 'falhou' });
  const g = aplicar(f, { tipo: 'postar-na-mao', conta: 'spc_yt' }, AGORA);
  assert.equal(g.publicacao.contas.spc_yt.status, 'manual');
  assert.equal(g.etapa, 'aguardando-numeros');
  assert.throws(() => aplicar(f, { tipo: 'postar-na-mao', conta: 'spc_tt' }, AGORA), /não falhou/);
});

test('postar-na-mao com outra conta ainda esperando fica em agendado', () => {
  const f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'falhou' }), { tipo: 'postar-na-mao', conta: 'spc_yt' }, AGORA);
  assert.equal(f.etapa, 'agendado');
});

test('cancelou-agendamento volta pra aprovação e apaga a publicacao', () => {
  const f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'cancelou-agendamento' }, AGORA);
  assert.equal(f.etapa, 'aprovacao-pacote'); assert.equal(f.publicacao, null);
  assert.throws(() => aplicar(emAgendado({ spc_tt: 'publicado', spc_yt: 'esperando' }), { tipo: 'cancelou-agendamento' }, AGORA), /já saiu/);
});

function emAguardando() {
  return aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_OK, YT_OK] }, AGORA);
}
const LEITURA = (marco, extra = {}) => ({ marco, em: '2026-11-22T12:00:00.000Z', numeros: { tiktok: { views: 10 } }, resumo: 'ok', funcionou: ['a'], melhorar: ['b'], nota: 4, naoAchou: false, ...extra });

test('ler-numeros e leituras: 48h, depois 7d, depois concluído', () => {
  let f = emAguardando();
  assert.equal(textoDaEspera(f, AGORA), 'Esperando 48 horas');
  f = aplicar(f, { tipo: 'ler-numeros', marco: '48h' }, AGORA);
  assert.equal(f.etapa, 'analise'); assert.equal(f.analise.proxima, '48h'); assert.ok(emTrabalho(f));
  f = aplicar(f, { tipo: 'concluiu', dados: { leitura: LEITURA('48h') } }, AGORA);
  assert.equal(f.etapa, 'aguardando-numeros'); assert.equal(f.analise.proxima, null); assert.equal(f.analise.leituras.length, 1);
  assert.equal(textoDaEspera(f, AGORA), 'Esperando 7 dias');
  f = aplicar(f, { tipo: 'ler-numeros', marco: '7d' }, AGORA);
  f = aplicar(f, { tipo: 'concluiu', dados: { leitura: LEITURA('7d') } }, AGORA);
  assert.equal(f.etapa, 'concluido'); assert.equal(f.analise.leituras.length, 2);
});

test('textoDaEspera fora da espera usa o texto da etapa', () => {
  assert.equal(textoDaEspera(noPacote(), AGORA), 'Aprove o post');
  assert.equal(textoDaEspera(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), AGORA), 'Agendado no Post for Me');
});

test('ler-numeros só vale na espera dos números', () => {
  assert.throws(() => aplicar(noPacote(), { tipo: 'ler-numeros', marco: '48h' }, AGORA), /não está esperando os números/);
});

test('leitura que não achou o post conclui já na de 48h', () => {
  let f = aplicar(emAguardando(), { tipo: 'ler-numeros', marco: '48h' }, AGORA);
  f = aplicar(f, { tipo: 'concluiu', dados: { leitura: LEITURA('48h', { naoAchou: true, nota: null }) } }, AGORA);
  assert.equal(f.etapa, 'concluido'); assert.equal(f.analise.leituras.length, 1);
});

test('adiar volta pra aguardando-numeros sem leitura', () => {
  let f = aplicar(emAguardando(), { tipo: 'ler-numeros', marco: '48h' }, AGORA);
  f = aplicar(f, { tipo: 'concluiu', dados: { adiar: true } }, AGORA);
  assert.equal(f.etapa, 'aguardando-numeros'); assert.equal(f.analise.leituras.length, 0); assert.equal(f.erro, null);
});

test('postado vai pra concluido; em agendado é recusado', () => {
  const f = aplicar(noPacote(), { tipo: 'aprovou' }, AGORA);
  assert.equal(f.etapa, 'pronto-pra-postar');
  assert.equal(aplicar(f, { tipo: 'postado' }, AGORA).etapa, 'concluido');
  assert.throws(() => aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'postado' }, AGORA), /ainda não está pronto pra postar/);
});

test('pular a postagem não cai na Análise', () => {
  const f = { ...novo({ pular: ['pesquisa', 'roteiro', 'postagem'] }), etapa: 'capa' };
  assert.equal(aplicar(f, { tipo: 'concluiu' }, AGORA).etapa, 'concluido');
});

// ---------- Fix round 1: tentativas, resultados atrasados, clique duplo, horário normalizado ----------
function comTentativas(n) {
  let f = aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  const pub = publicacao({ spc_tt: 'esperando', spc_yt: 'esperando' }, { ...f.publicacao, postIds: ['pst_1'], tentativas: n });
  return aplicar(f, { tipo: 'concluiu', dados: { publicacao: pub } }, AGORA);
}

test('tentativas sobrevivem a uma falha total e a nova aprovação', () => {
  let f = aplicar(comTentativas(1), { tipo: 'publicou', resultados: [TT_ERRO, YT_ERRO] }, AGORA);
  assert.equal(f.etapa, 'aprovacao-pacote'); assert.equal(f.publicacao.tentativas, 1);
  f = aplicar(f, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  assert.equal(f.etapa, 'publicando'); assert.equal(f.publicacao.tentativas, 1);
  assert.equal(f.publicacao.erro, null); assert.deepEqual(f.publicacao.postIds, []);
});

test('tentativas sobrevivem a cancelou-agendamento e a nova aprovação', () => {
  let f = aplicar(comTentativas(2), { tipo: 'cancelou-agendamento' }, AGORA);
  assert.equal(f.publicacao, null); assert.equal(f.tentativasPublicacao, 2);
  f = aplicar(f, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  assert.equal(f.publicacao.tentativas, 2);
  // sem nenhuma publicação anterior, começa do zero
  assert.equal(aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA).publicacao.tentativas, 0);
});

test('publicou repetido ou atrasado não desfaz conta já publicada ou manual', () => {
  let f = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_OK] }, AGORA);
  f = aplicar(f, { tipo: 'publicou', resultados: [{ ...TT_ERRO }] }, AGORA);
  assert.equal(f.publicacao.contas.spc_tt.status, 'publicado'); assert.equal(f.publicacao.contas.spc_tt.link, 'https://tiktok.com/v1');
  let g = emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' });
  g.publicacao.contas.spc_yt.status = 'manual';
  g = aplicar(g, { tipo: 'publicou', resultados: [YT_OK, TT_OK] }, AGORA);
  assert.equal(g.publicacao.contas.spc_yt.status, 'manual'); assert.equal(g.etapa, 'aguardando-numeros');
});

test('segundo aprovou em publicando ou agendado é recusado (clique duplo)', () => {
  const ev = { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } };
  const pub = aplicar(noPacote(), ev, AGORA);
  assert.throws(() => aplicar(pub, ev, AGORA), /não está esperando aprovação/);
  assert.throws(() => aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), ev, AGORA), /não está esperando aprovação/);
});

// ---------- Revisão final: saída do envio com erro, cancelar só antes da hora ----------
test('voltar-pra-aprovacao: envio com erro volta pra aprovação do post com o erro e as mesmas tentativas', () => {
  let f = aplicar(comTentativas(1), { tipo: 'publicou', resultados: [TT_ERRO, YT_ERRO] }, AGORA);
  f = aplicar(f, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  f = aplicar(f, { tipo: 'falhou', mensagem: 'O Post for Me recusou o pedido.' }, AGORA);
  assert.equal(f.etapa, 'publicando'); assert.ok(f.erro);
  const g = aplicar(f, { tipo: 'voltar-pra-aprovacao' }, AGORA);
  assert.equal(g.etapa, 'aprovacao-pacote'); assert.equal(g.erro, null);
  assert.equal(g.publicacao.tentativas, 1); assert.equal(g.publicacao.erro, 'O Post for Me recusou o pedido.');
  assert.equal(g.historico.at(-1).nota, 'voltou pra aprovação');
  // aprovar de novo repete o mesmo número de tentativa (o mesmo external_id: nunca um segundo post)
  const h = aplicar(g, { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  assert.equal(h.etapa, 'publicando'); assert.equal(h.publicacao.tentativas, 1); assert.equal(h.publicacao.erro, null);
});

test('voltar-pra-aprovacao é recusado fora de publicando com erro', () => {
  const MSG = /Esse vídeo não está com erro no envio\./;
  const pub = aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA);
  assert.throws(() => aplicar(pub, { tipo: 'voltar-pra-aprovacao' }, AGORA), MSG); // enviando, sem erro
  assert.throws(() => aplicar(noPacote(), { tipo: 'voltar-pra-aprovacao' }, AGORA), MSG);
  assert.throws(() => aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'voltar-pra-aprovacao' }, AGORA), MSG);
  const outraSala = aplicar({ ...novo(), etapa: 'postagem' }, { tipo: 'falhou', mensagem: 'x' }, AGORA);
  assert.throws(() => aplicar(outraSala, { tipo: 'voltar-pra-aprovacao' }, AGORA), MSG);
  // "Tentar de novo" numa rede depois que outra já saiu: voltar pra aprovação postaria de novo na que saiu
  let r = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'esperando' }), { tipo: 'publicou', resultados: [TT_OK, YT_ERRO] }, AGORA);
  r = aplicar(aplicar(r, { tipo: 'republicar', conta: 'spc_yt' }, AGORA), { tipo: 'falhou', mensagem: 'x' }, AGORA);
  assert.throws(() => aplicar(r, { tipo: 'voltar-pra-aprovacao' }, AGORA), /já foi criado no Post for Me/);
  assert.equal(podeVoltarPraAprovacao(r.publicacao), false);
});

test('voltar-pra-aprovacao recusa quando outra rede ainda espera num post já criado (não esquece o post)', () => {
  // TT esperando no post pst_1, YT falhou → Tentar de novo no YT → o envio falha
  let r = aplicar(emAgendado({ spc_tt: 'esperando', spc_yt: 'falhou' }), { tipo: 'republicar', conta: 'spc_yt' }, AGORA);
  r = aplicar(r, { tipo: 'falhou', mensagem: 'x' }, AGORA);
  assert.equal(r.etapa, 'publicando'); assert.equal(r.publicacao.contas.spc_tt.postId, 'pst_1');
  assert.equal(podeVoltarPraAprovacao(r.publicacao), false);
  assert.throws(() => aplicar(r, { tipo: 'voltar-pra-aprovacao' }, AGORA), /já foi criado no Post for Me/);
  // só postIds guardado (sem postId nas contas) também conta como post criado
  const s = structuredClone(r);
  for (const c of Object.values(s.publicacao.contas)) c.postId = null;
  assert.throws(() => aplicar(s, { tipo: 'voltar-pra-aprovacao' }, AGORA), /já foi criado no Post for Me/);
  // primeira tentativa que falhou: nenhum post criado, a volta vale
  const p = aplicar(aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: null } }, AGORA), { tipo: 'falhou', mensagem: 'x' }, AGORA);
  assert.equal(podeVoltarPraAprovacao(p.publicacao), true);
  assert.equal(aplicar(p, { tipo: 'voltar-pra-aprovacao' }, AGORA).etapa, 'aprovacao-pacote');
});

test('podeCancelar: só com horário marcado e mais de 2 minutos antes', () => {
  assert.equal(MARGEM_CANCELAR_MS, 2 * 60_000);
  const pub = quando => ({ pedido: { contas: CONTAS, quando } });
  assert.equal(podeCancelar(pub(null), AGORA), false);                                         // Publicar agora
  assert.equal(podeCancelar(pub(new Date(AGORA - 60_000).toISOString()), AGORA), false);       // horário vencido
  assert.equal(podeCancelar(pub(new Date(AGORA + MARGEM_CANCELAR_MS).toISOString()), AGORA), false); // dentro da margem
  assert.equal(podeCancelar(pub(new Date(AGORA + MARGEM_CANCELAR_MS + 1000).toISOString()), AGORA), true);
  assert.equal(podeCancelar(null, AGORA), false);
});

test('quando é guardado como ISO normalizado', () => {
  const f = aplicar(noPacote(), { tipo: 'aprovou', publicar: { contas: CONTAS, quando: '2026-11-21T15:00:00-03:00' } }, AGORA);
  assert.equal(f.publicacao.pedido.quando, '2026-11-21T18:00:00.000Z');
});
