import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarFicha, aplicar } from '../lib/ficha.mjs';
import { FichasStore } from '../lib/fichas-store.mjs';
import { criarPostForMe } from '../lib/postforme.mjs';
import { PRAZOS, INTERVALO, marcoDevido, segundaDaSemana, semanaParaResumir, criarRelogio } from '../lib/relogio.mjs';
import { iniciarPostForMeFalso, CHAVE_PFM } from './fixtures/postforme-falso.mjs';

const H = 3600e3;
const D = 24 * H;
const PRAZOS_TESTE = { h48: 48 * H, d7: 7 * D };
const AGORA = Date.parse('2026-11-20T12:00:00Z');
const TT = { id: 'spc_tt', plataforma: 'tiktok', usuario: '@teste' };
const YT = { id: 'spc_yt', plataforma: 'youtube', usuario: 'Teste' };
const LEITURA = (marco, extra = {}) => ({ marco, em: '2026-11-22T12:00:00.000Z', numeros: {}, resumo: 'ok', funcionou: [], melhorar: [], nota: 4, naoAchou: false, ...extra });

// Ficha em aguardando-numeros publicada há `horas` horas (relativo a `agora`), com as leituras dadas.
const aguardando = (horas, marcos = [], agora = AGORA) => ({
  etapa: 'aguardando-numeros',
  publicacao: { publicadoEm: new Date(agora - horas * H).toISOString(), contas: {} },
  analise: { proxima: null, leituras: marcos.map(m => LEITURA(m)) },
});

test('PRAZOS e INTERVALO: padrões e variáveis de ambiente', () => {
  const antes = { a: process.env.OFC_PRAZO_48H_MS, b: process.env.OFC_PRAZO_7D_MS, c: process.env.OFC_RELOGIO_MS };
  try {
    delete process.env.OFC_PRAZO_48H_MS; delete process.env.OFC_PRAZO_7D_MS; delete process.env.OFC_RELOGIO_MS;
    assert.deepEqual(PRAZOS(), { h48: 48 * H, d7: 7 * D });
    assert.equal(INTERVALO(), 10 * 60e3);
    process.env.OFC_PRAZO_48H_MS = '1000'; process.env.OFC_PRAZO_7D_MS = '5000'; process.env.OFC_RELOGIO_MS = '250';
    assert.deepEqual(PRAZOS(), { h48: 1000, d7: 5000 });
    assert.equal(INTERVALO(), 250);
  } finally {
    for (const [k, v] of [['OFC_PRAZO_48H_MS', antes.a], ['OFC_PRAZO_7D_MS', antes.b], ['OFC_RELOGIO_MS', antes.c]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('marcoDevido: 48h, 7d, e nada quando já leu ou ainda não deu a hora', () => {
  assert.equal(marcoDevido(aguardando(47), AGORA, PRAZOS_TESTE), null);
  assert.equal(marcoDevido(aguardando(49), AGORA, PRAZOS_TESTE), '48h');
  assert.equal(marcoDevido(aguardando(49, ['48h']), AGORA, PRAZOS_TESTE), null);
  assert.equal(marcoDevido(aguardando(7 * 24 + 1, ['48h']), AGORA, PRAZOS_TESTE), '7d');
  assert.equal(marcoDevido(aguardando(8 * 24, ['48h', '7d']), AGORA, PRAZOS_TESTE), null);
});

test('marcoDevido: oficina fechada por 8 dias, sem nenhuma leitura, faz só a de 7d (Review Focus 2)', () => {
  assert.equal(marcoDevido(aguardando(8 * 24), AGORA, PRAZOS_TESTE), '7d');
});

test('marcoDevido: só vale em aguardando-numeros e com publicadoEm', () => {
  for (const etapa of ['agendado', 'analise', 'concluido', 'publicando', 'aprovacao-pacote']) {
    assert.equal(marcoDevido({ ...aguardando(100), etapa }, AGORA, PRAZOS_TESTE), null, etapa);
  }
  assert.equal(marcoDevido({ etapa: 'aguardando-numeros', publicacao: { publicadoEm: null }, analise: null }, AGORA, PRAZOS_TESTE), null);
  assert.equal(marcoDevido({ etapa: 'aguardando-numeros', publicacao: null, analise: null }, AGORA, PRAZOS_TESTE), null);
  assert.equal(marcoDevido({ etapa: 'aguardando-numeros', publicacao: { publicadoEm: 'lixo' }, analise: null }, AGORA, PRAZOS_TESTE), null);
});

test('marcoDevido respeita os prazos injetados', () => {
  const f = aguardando(0.01); // 36 segundos
  assert.equal(marcoDevido(f, AGORA, { h48: 10_000, d7: 60_000 }), '48h');
  assert.equal(marcoDevido(f, AGORA, { h48: 10_000, d7: 20_000 }), '7d');
});

test('segundaDaSemana: quinta e domingo caem na segunda anterior (hora local)', () => {
  assert.equal(segundaDaSemana(new Date(2026, 10, 19)), '2026-11-16');
  assert.equal(segundaDaSemana(new Date(2026, 10, 22, 23, 59)), '2026-11-16');
  assert.equal(segundaDaSemana(new Date(2026, 10, 16, 0, 0)), '2026-11-16');
  assert.equal(segundaDaSemana(new Date(2026, 10, 23, 0, 0)), '2026-11-23');
  assert.equal(segundaDaSemana(new Date(2026, 0, 1)), '2025-12-29'); // virada de ano
});

test('semanaParaResumir: a semana anterior, se ainda não resumida e com leitura dentro dela', () => {
  const agora = new Date(2026, 10, 23); // segunda 23/11
  const leituras = [{ marco: '48h', em: new Date(2026, 10, 18, 12).toISOString() }];
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras }), '2026-11-16');
  assert.equal(semanaParaResumir({ agora, ultimaSemana: '2026-11-16', leituras }), null);
  assert.equal(semanaParaResumir({ agora, ultimaSemana: '2026-11-09', leituras }), '2026-11-16');
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras: [] }), null);
  // leitura fora da semana: antes da segunda 00:00 ou a partir da segunda seguinte
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras: [{ em: new Date(2026, 10, 15, 23, 59).toISOString() }] }), null);
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras: [{ em: new Date(2026, 10, 23, 0, 0).toISOString() }] }), null);
  // bordas: segunda 00:00 entra; domingo 23:59 entra
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras: [{ em: new Date(2026, 10, 16, 0, 0).toISOString() }] }), '2026-11-16');
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras: [{ em: new Date(2026, 10, 22, 23, 59).toISOString() }] }), '2026-11-16');
  // leitura sem data legível não conta
  assert.equal(semanaParaResumir({ agora, ultimaSemana: null, leituras: [{ marco: '48h' }, { em: 'lixo' }] }), null);
});

// ---------- volta() ----------

function montar(t, { modo, chave = CHAVE_PFM, semCliente = false, prazos = PRAZOS_TESTE, agora = () => new Date(AGORA), resumir, ocupadas = [], base } = {}) {
  return (async () => {
    const pfm = await iniciarPostForMeFalso({ modo });
    t.after(() => pfm.fechar());
    const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-relogio-'));
    t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
    const store = new FichasStore(dados); store.garantirPastas();
    const estado = { chave, ocupadas: new Set(ocupadas), clientes: 0, resultados: [] };
    // Minimal stand-in for the orchestrator; it stamps events with the injected clock, so `publicadoEm` and the marks agree.
    const orquestrador = { ocupado: id => estado.ocupadas.has(id), evento: (id, ev) => store.salvar(aplicar(store.carregar(id), ev, new Date(agora()).getTime())) };
    const cliente = () => {
      estado.clientes++;
      if (semCliente) return null;
      const c = criarPostForMe({ chave: estado.chave, base: base ?? pfm.base });
      const resultados = c.resultados;
      c.resultados = (...a) => { estado.resultados.push(a[0]); return resultados(...a); };
      return c;
    };
    const relogio = criarRelogio({ store, orquestrador, config: { dados }, cerebroDir: store.cerebroDir, cliente, resumir, agora, intervaloMs: 60_000, prazos });
    t.after(() => relogio.parar());
    const guardar = f => { fs.mkdirSync(store.pasta(f.id), { recursive: true }); return store.salvar(f); };
    return { pfm, store, estado, relogio, guardar, dados };
  })();
}

// Ficha `agendado` com as redes dadas esperando o post `postId`, montada só com `aplicar`.
function fichaAgendada(id, contas = [TT, YT], postId = 'sp_1') {
  let f = criarFicha({ id, porta: 'bruto', bruto: 'bruto.mp4', pular: ['capa'], agora: AGORA });
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);            // escolhas-edicao
  f = aplicar(f, { tipo: 'escolhas-prontas' }, AGORA);    // editando
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);            // aprovacao-video
  f = aplicar(f, { tipo: 'aprovou' }, AGORA);             // exportando
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);            // postagem
  f = aplicar(f, { tipo: 'concluiu', dados: { postagem: { legenda: 'Oi', hashtags: [], horario: null } } }, AGORA);
  f = aplicar(f, { tipo: 'aprovou', publicar: { contas, quando: null } }, AGORA);
  assert.equal(f.etapa, 'publicando');
  const pub = { ...f.publicacao, postIds: [postId], contas: Object.fromEntries(contas.map(c => [c.id, { plataforma: c.plataforma, usuario: c.usuario, status: 'esperando', postId, idNaRede: null, link: null, erro: null }])) };
  f = aplicar(f, { tipo: 'concluiu', dados: { publicacao: pub } }, AGORA);
  assert.equal(f.etapa, 'agendado');
  return f;
}
// Cria no Post for Me falso o post que a ficha agendada espera (sp_<n>).
const criarPostNoFalso = (pfm, contas = [TT, YT]) => criarPostForMe({ chave: CHAVE_PFM, base: pfm.base })
  .criarPost({ caption: 'Oi', social_accounts: contas.map(c => c.id), media: [{ url: 'http://x/media/0' }], external_id: 'x:1' });
// Ficha já em aguardando-numeros, publicada às 12:00Z de 20/11 (então AGORA + 49h = 48h vencida).
function fichaAguardando(id, marcos = []) {
  let f = aplicar(fichaAgendada(id), { tipo: 'publicou', resultados: [
    { conta: 'spc_tt', ok: true, idNaRede: 'r1', link: 'https://x/1', erro: null }, { conta: 'spc_yt', ok: true, idNaRede: 'r2', link: 'https://x/2', erro: null }] }, AGORA);
  assert.equal(f.etapa, 'aguardando-numeros');
  f.analise.leituras = marcos.map(m => LEITURA(m));
  return f;
}

test('volta: agendado com as duas redes esperando vira aguardando-numeros com os links', async t => {
  const c = await montar(t);
  await criarPostNoFalso(c.pfm);
  c.guardar(fichaAgendada('v1'));
  await c.relogio.volta();
  const f = c.store.carregar('v1');
  assert.equal(f.etapa, 'aguardando-numeros');
  assert.equal(f.publicacao.contas.spc_tt.status, 'publicado');
  assert.equal(f.publicacao.contas.spc_tt.link, 'https://exemplo.com/spc_tt/sp_1');
  assert.equal(f.publicacao.contas.spc_yt.link, 'https://exemplo.com/spc_yt/sp_1');
  assert.deepEqual(c.estado.resultados, ['sp_1']); // um postId distinto, uma chamada
  assert.equal(c.relogio.avisos().postForMe, null);
});

test('volta: post ainda processando continua agendado', async t => {
  const c = await montar(t, { modo: 'processando' });
  await criarPostNoFalso(c.pfm);
  c.guardar(fichaAgendada('v1'));
  await c.relogio.volta();
  const f = c.store.carregar('v1');
  assert.equal(f.etapa, 'agendado');
  assert.equal(f.publicacao.contas.spc_tt.status, 'esperando');
  assert.equal(f.erro, null);
});

test('volta: uma rede que falhou e outra que saiu, a ficha segue com a que saiu', async t => {
  const c = await montar(t, { modo: 'falha-youtube' });
  await criarPostNoFalso(c.pfm);
  c.guardar(fichaAgendada('v1'));
  await c.relogio.volta();
  const f = c.store.carregar('v1');
  assert.equal(f.etapa, 'aguardando-numeros');
  assert.equal(f.publicacao.contas.spc_tt.status, 'publicado');
  assert.equal(f.publicacao.contas.spc_yt.status, 'falhou');
});

test('volta: pergunta uma vez por post distinto, mesmo com várias redes no mesmo post', async t => {
  const c = await montar(t);
  await criarPostNoFalso(c.pfm, [TT]);
  await criarPostNoFalso(c.pfm, [YT]);
  // as duas redes em posts diferentes: sp_1 (tiktok) e sp_2 (youtube)
  let f = fichaAgendada('v1');
  f.publicacao.contas.spc_tt.postId = 'sp_1'; f.publicacao.contas.spc_yt.postId = 'sp_2';
  c.guardar(f);
  await c.relogio.volta();
  assert.deepEqual(c.estado.resultados.sort(), ['sp_1', 'sp_2']);
  assert.equal(c.store.carregar('v1').etapa, 'aguardando-numeros');
});

test('volta: ficha ocupada fica de fora', async t => {
  const c = await montar(t, { ocupadas: ['v1'] });
  await criarPostNoFalso(c.pfm);
  c.guardar(fichaAgendada('v1'));
  c.guardar(fichaAguardando('v2'));
  await c.relogio.volta();
  assert.equal(c.store.carregar('v1').etapa, 'agendado');
  assert.deepEqual(c.estado.resultados, []);
});

test('volta: aguardando-numeros publicada há 49h vai pra analise com proxima 48h', async t => {
  const c = await montar(t, { agora: () => new Date(AGORA + 49 * H) });
  c.guardar(fichaAguardando('v1'));
  await c.relogio.volta();
  const f = c.store.carregar('v1');
  assert.equal(f.etapa, 'analise');
  assert.equal(f.analise.proxima, '48h');
});

test('volta: ainda não deu a hora (47h) não mexe na ficha', async t => {
  const c = await montar(t, { agora: () => new Date(AGORA + 47 * H) });
  c.guardar(fichaAguardando('v1'));
  await c.relogio.volta();
  assert.equal(c.store.carregar('v1').etapa, 'aguardando-numeros');
});

test('volta: oficina fechada por 8 dias vai direto pra leitura de 7d (Review Focus 2)', async t => {
  const c = await montar(t, { agora: () => new Date(AGORA + 8 * D) });
  c.guardar(fichaAguardando('v1'));
  await c.relogio.volta();
  const f = c.store.carregar('v1');
  assert.equal(f.etapa, 'analise');
  assert.equal(f.analise.proxima, '7d');
});

test('volta: chave errada não muda ficha nenhuma e liga o aviso; a volta seguinte com a chave certa limpa (Review Focus 5)', async t => {
  const c = await montar(t, { chave: 'chave-errada', agora: () => new Date(AGORA + 49 * H) });
  await criarPostNoFalso(c.pfm);
  c.guardar(fichaAgendada('v1'));
  c.guardar(fichaAguardando('v2'));
  const antes = { v1: c.store.carregar('v1'), v2: c.store.carregar('v2') };
  await c.relogio.volta();
  assert.deepEqual(c.store.carregar('v1'), antes.v1);
  assert.deepEqual(c.store.carregar('v2'), antes.v2); // a volta encerra: nem o prazo da outra ficha anda
  assert.equal(c.relogio.avisos().postForMe, 'reconectar');
  await c.relogio.volta();
  assert.equal(c.relogio.avisos().postForMe, 'reconectar'); // continua enquanto a chave não presta

  c.estado.chave = CHAVE_PFM;
  await c.relogio.volta();
  assert.equal(c.relogio.avisos().postForMe, null);
  assert.equal(c.store.carregar('v1').etapa, 'aguardando-numeros');
  assert.equal(c.store.carregar('v2').etapa, 'analise');
});

test('volta: sem internet (porta fechada) não muda ficha, não liga aviso e a volta resolve (Review Focus 5)', async t => {
  const morto = await iniciarPostForMeFalso();
  const baseMorta = morto.base;
  await morto.fechar();
  const c = await montar(t, { base: baseMorta, agora: () => new Date(AGORA + 49 * H) });
  c.guardar(fichaAgendada('v1'));
  c.guardar(fichaAguardando('v2'));
  const antes = { v1: c.store.carregar('v1'), v2: c.store.carregar('v2') };
  await assert.doesNotReject(c.relogio.volta());
  assert.deepEqual(c.store.carregar('v1'), antes.v1);
  assert.deepEqual(c.store.carregar('v2'), antes.v2);
  assert.equal(c.relogio.avisos().postForMe, null);
});

test('volta: sem cliente (sem chave) sai sem tocar em nada', async t => {
  const resumir = async () => { throw new Error('não devia resumir'); };
  const c = await montar(t, { semCliente: true, agora: () => new Date(AGORA + 49 * H), resumir });
  c.guardar(fichaAguardando('v1'));
  await c.relogio.volta();
  assert.equal(c.store.carregar('v1').etapa, 'aguardando-numeros');
  assert.equal(c.relogio.avisos().postForMe, null);
});

test('volta: duas chamadas juntas fazem uma volta só', async t => {
  const c = await montar(t);
  await criarPostNoFalso(c.pfm);
  c.guardar(fichaAgendada('v1'));
  await Promise.all([c.relogio.volta(), c.relogio.volta(), c.relogio.volta()]);
  assert.equal(c.estado.clientes, 1);
  assert.deepEqual(c.estado.resultados, ['sp_1']);
  // terminada a volta, outra pode começar
  await c.relogio.volta();
  assert.equal(c.estado.clientes, 2);
});

test('volta: um erro de uma ficha não derruba a volta nem as outras fichas', async t => {
  const erros = []; t.mock.method(console, 'error', (...a) => erros.push(a.join(' ')));
  const c = await montar(t, { agora: () => new Date(AGORA + 49 * H) });
  c.guardar(fichaAguardando('v1'));
  c.guardar(fichaAguardando('v2'));
  // o orquestrador falha só na primeira ficha
  const quebrada = criarRelogio({
    store: c.store, config: { dados: c.dados }, cerebroDir: c.store.cerebroDir, prazos: PRAZOS_TESTE, agora: () => new Date(AGORA + 49 * H),
    cliente: () => criarPostForMe({ chave: CHAVE_PFM, base: c.pfm.base }),
    orquestrador: { ocupado: () => false, evento: (id, ev) => { if (id === 'v1') throw new Error('A sala ainda está trabalhando neste vídeo.'); return c.store.salvar(aplicar(c.store.carregar(id), ev)); } },
  });
  await assert.doesNotReject(quebrada.volta());
  assert.equal(c.store.carregar('v1').etapa, 'aguardando-numeros');
  assert.equal(c.store.carregar('v2').etapa, 'analise');
  assert.ok(erros.length >= 1);
});

// ---------- resumo da semana ----------

function leituraNaSemana(c, id = 'r1') {
  const f = { ...criarFicha({ id, porta: 'bruto', bruto: 'b.mp4', agora: AGORA }), etapa: 'concluido',
    analise: { proxima: null, leituras: [LEITURA('7d', { em: new Date(2026, 10, 18, 12).toISOString() })] } };
  c.guardar(f);
}
const SEGUNDA_23 = () => new Date(2026, 10, 23, 8, 0);

test('volta: chama resumir uma vez com a semana anterior quando há leitura e nenhum ultimo.json', async t => {
  const semanas = [];
  const c = await montar(t, { agora: SEGUNDA_23, resumir: async s => { semanas.push(s); } });
  leituraNaSemana(c);
  await c.relogio.volta();
  assert.deepEqual(semanas, ['2026-11-16']);
});

test('volta: com ultimo.json da mesma semana não resume de novo', async t => {
  const semanas = [];
  const c = await montar(t, { agora: SEGUNDA_23, resumir: async s => { semanas.push(s); } });
  leituraNaSemana(c);
  fs.mkdirSync(path.join(c.store.cerebroDir, 'resumos'), { recursive: true });
  fs.writeFileSync(path.join(c.store.cerebroDir, 'resumos', 'ultimo.json'), JSON.stringify({ semana: '2026-11-16' }));
  await c.relogio.volta();
  assert.deepEqual(semanas, []);
});

test('volta: ultimo.json ilegível conta como "nenhum resumo ainda"', async t => {
  const semanas = [];
  const c = await montar(t, { agora: SEGUNDA_23, resumir: async s => { semanas.push(s); } });
  leituraNaSemana(c);
  fs.mkdirSync(path.join(c.store.cerebroDir, 'resumos'), { recursive: true });
  fs.writeFileSync(path.join(c.store.cerebroDir, 'resumos', 'ultimo.json'), '{ não é json');
  await c.relogio.volta();
  assert.deepEqual(semanas, ['2026-11-16']);
});

test('volta: sem leitura na semana não resume', async t => {
  const semanas = [];
  const c = await montar(t, { agora: SEGUNDA_23, resumir: async s => { semanas.push(s); } });
  await c.relogio.volta();
  assert.deepEqual(semanas, []);
});

test('volta: erro no resumo vai pro console.error e a volta resolve', async t => {
  const erros = []; t.mock.method(console, 'error', (...a) => erros.push(a.join(' ')));
  const c = await montar(t, { agora: SEGUNDA_23, resumir: async () => { throw new Error('Claude fora do ar'); } });
  leituraNaSemana(c);
  await assert.doesNotReject(c.relogio.volta());
  assert.ok(erros.some(e => e.includes('Claude fora do ar')));
});

test('volta: resumo roda mesmo depois de a ficha ter ido pra analise na mesma volta (leituras relidas)', async t => {
  const semanas = [];
  const c = await montar(t, { agora: SEGUNDA_23, resumir: async s => { semanas.push(s); } });
  leituraNaSemana(c);
  c.guardar(fichaAguardando('v1')); // publicada em 20/11: em 23/11 a de 48h já venceu, então vai pra analise nesta volta
  await c.relogio.volta();
  assert.deepEqual(semanas, ['2026-11-16']);
});

// ---------- iniciar / parar ----------

const esperar = async (cond, ms = 3000) => { const fim = Date.now() + ms; while (!cond() && Date.now() < fim) await new Promise(r => setTimeout(r, 5)); };

test('iniciar roda uma volta já e depois a cada intervalo; parar encerra', async t => {
  const pfm = await iniciarPostForMeFalso();
  t.after(() => pfm.fechar());
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-relogio-'));
  t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  const store = new FichasStore(dados); store.garantirPastas();
  let voltas = 0;
  const relogio = criarRelogio({ store, orquestrador: { ocupado: () => false, evento: () => {} }, config: { dados }, cerebroDir: store.cerebroDir,
    cliente: () => { voltas++; return null; }, intervaloMs: 10 });
  t.after(() => relogio.parar());
  relogio.iniciar();
  assert.equal(voltas, 1); // a primeira volta começa na hora, sem esperar o intervalo
  await esperar(() => voltas >= 3);
  assert.ok(voltas >= 3, `voltas: ${voltas}`);
  relogio.parar();
  await new Promise(r => setTimeout(r, 30));
  const depois = voltas;
  await new Promise(r => setTimeout(r, 60));
  assert.equal(voltas, depois);
});

test('iniciar duas vezes não empilha relógios', async t => {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-relogio-'));
  t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  const store = new FichasStore(dados); store.garantirPastas();
  let voltas = 0;
  const relogio = criarRelogio({ store, orquestrador: { ocupado: () => false, evento: () => {} }, config: { dados }, cerebroDir: store.cerebroDir,
    cliente: () => { voltas++; return null; }, intervaloMs: 40 });
  t.after(() => relogio.parar());
  relogio.iniciar(); relogio.iniciar();
  relogio.parar();
  const parou = voltas;
  await new Promise(r => setTimeout(r, 120));
  assert.equal(voltas, parou);
});
