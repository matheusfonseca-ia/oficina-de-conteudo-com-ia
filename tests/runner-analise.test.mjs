import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarPostForMe, ErroPostForMe } from '../lib/postforme.mjs';
import { legendaDoPost } from '../lib/publicar.mjs';
import { normalizarMetricas, somar, mediaDasLeituras, acharPost, montarPromptAnalise, lerRespostaAnalise, registrarOQueFuncionou, rodarAnalise } from '../lib/runner-analise.mjs';
import { iniciarPostForMeFalso, CHAVE_PFM } from './fixtures/postforme-falso.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-analise-'));
const NADA = { visualizacoes: null, curtidas: null, comentarios: null, compartilhamentos: null, salvamentos: null };
const POSTAGEM = { legenda: 'Como a IA muda o varejo\nSegunda linha da legenda.', hashtags: ['#ia', '#varejo'] };
const LEGENDA = legendaDoPost(POSTAGEM);
// O falso responde com `posted_at` = agora de verdade: a publicação registrada precisa ficar no passado.
const PUBLICADO_EM = '2020-01-01T00:00:00.000Z';
const ROT = { titulo: 'IA no varejo', gancho: 'Você perde venda todo dia', desenvolvimento: ['d1', 'd2'], cta: 'Comenta EU', duracaoSegundos: 40 };

function ficha({ marco = '48h', contas, leituras = [], publicadoEm = PUBLICADO_EM } = {}) {
  return {
    id: 'v1', etapa: 'analise', analise: { proxima: marco, leituras }, postagem: POSTAGEM, roteiro: ROT,
    capa: { opcoes: [{ arquivo: 'capa/capa-1.png', titulo: 'IA no varejo agora' }], escolhida: 0 },
    publicacao: {
      pedido: { contas: [], quando: null }, publicadoEm,
      contas: contas ?? {
        spc_tt: { plataforma: 'tiktok', usuario: '@teste', status: 'publicado', postId: 'sp_1', idNaRede: 'rede_spc_tt_sp_1', link: 'https://exemplo.com/spc_tt/sp_1', erro: null },
        spc_yt: { plataforma: 'youtube', usuario: 'Teste', status: 'publicado', postId: 'sp_1', idNaRede: 'rede_spc_yt_sp_1', link: 'https://exemplo.com/spc_yt/sp_1', erro: null },
        spc_ig: { plataforma: 'instagram', usuario: '@teste', status: 'manual', postId: null, idNaRede: null, link: null, erro: null },
      },
    },
  };
}

// Post for Me falso com o post já criado (sp_1, nas contas spc_tt e spc_yt) e pastas temporárias.
async function cenario(t, { modo = 'ok', chave = CHAVE_PFM, run } = {}) {
  const pfm = await iniciarPostForMeFalso({ modo });
  t.after(() => pfm.fechar());
  const cliente = criarPostForMe({ chave, base: pfm.base });
  await criarPostForMe({ chave: CHAVE_PFM, base: pfm.base }).criarPost({ caption: LEGENDA, social_accounts: ['spc_tt', 'spc_yt'] });
  const cerebroDir = tmp(), pastaVideo = tmp();
  const config = { dados: tmp(), claude: { command: process.execPath, prefixArgs: [FAKE] } };
  t.after(() => { for (const d of [cerebroDir, pastaVideo, config.dados]) fs.rmSync(d, { recursive: true, force: true }); });
  return {
    pfm, cliente, cerebroDir, pastaVideo, config,
    rodar: (f, extra = {}) => rodarAnalise({ pastaVideo, ficha: f, cerebroDir, config, run, deps: { cliente, fichas: () => [] }, agora: new Date('2026-11-22T12:00:00Z'), ...extra }),
  };
}
const naoChama = async () => { throw new Error('o Claude não podia ser chamado'); };
const arqCerebro = c => path.join(c.cerebroDir, 'o-que-funcionou.md');

test('normalizarMetricas: os nomes de cada rede viram os cinco campos; sem nada, tudo null', () => {
  assert.deepEqual(normalizarMetricas({ view_count: 1000, like_count: 50, comment_count: 5, share_count: 3 }),
    { visualizacoes: 1000, curtidas: 50, comentarios: 5, compartilhamentos: 3, salvamentos: null });
  assert.deepEqual(normalizarMetricas({ views: 400, likes: 20, comments: 2, shares: 1 }),
    { visualizacoes: 400, curtidas: 20, comentarios: 2, compartilhamentos: 1, salvamentos: null });
  assert.deepEqual(normalizarMetricas({ views: 800, likes: 60, comments: 4, shares: 2, saved: 9, reach: 700 }),
    { visualizacoes: 800, curtidas: 60, comentarios: 4, compartilhamentos: 2, salvamentos: 9 });
  assert.deepEqual(normalizarMetricas({ video_views: 7, likes: 1, comments: 0, shares: 0, favorites: 4 }),
    { visualizacoes: 7, curtidas: 1, comentarios: 0, compartilhamentos: 0, salvamentos: 4 });
  assert.deepEqual(normalizarMetricas({}), NADA);
  assert.deepEqual(normalizarMetricas(undefined), NADA);
  assert.deepEqual(normalizarMetricas({ views: 'abc', likes: null }), NADA);
});

test('somar ignora null; campo todo null continua null', () => {
  const a = { ...NADA, visualizacoes: 10, curtidas: 1 };
  const b = { ...NADA, visualizacoes: 5, salvamentos: 2 };
  assert.deepEqual(somar([a, b]), { visualizacoes: 15, curtidas: 1, comentarios: null, compartilhamentos: null, salvamentos: 2 });
  assert.deepEqual(somar([]), NADA);
});

test('mediaDasLeituras: ignora a ficha atual, outro marco e naoAchou; arredonda; sem nenhuma, null', () => {
  const leitura = (marco, v, em) => ({ marco, em, numeros: { total: { ...NADA, visualizacoes: v, curtidas: v / 10 } } });
  const fichas = [
    { id: 'atual', analise: { leituras: [leitura('48h', 9999, '2026-11-01T00:00:00Z')] } },
    { id: 'a', analise: { leituras: [leitura('48h', 100, '2026-11-02T00:00:00Z'), leitura('7d', 5000, '2026-11-09T00:00:00Z')] } },
    { id: 'b', analise: { leituras: [leitura('48h', 201, '2026-11-03T00:00:00Z')] } },
    { id: 'c', analise: { leituras: [{ marco: '48h', em: '2026-11-04T00:00:00Z', numeros: null, naoAchou: true }] } },
    { id: 'd', analise: null },
  ];
  assert.deepEqual(mediaDasLeituras(fichas, '48h', 'atual'), { visualizacoes: 151, curtidas: 15, comentarios: null, compartilhamentos: null, salvamentos: null });
  assert.equal(mediaDasLeituras(fichas, '7d', 'a'), null);
  assert.equal(mediaDasLeituras([], '48h', 'x'), null);
  // só as `max` leituras mais recentes entram
  assert.equal(mediaDasLeituras(fichas, '48h', 'atual', 1).visualizacoes, 201);
});

test('lerRespostaAnalise: nota presa entre 1 e 5, listas cortadas em 3, sem resumo é erro', () => {
  const r = lerRespostaAnalise('Aqui:\n{"resumo":" Foi bem ","funcionou":["a"," ","b","c","d","e"],"melhorar":[],"nota":9}');
  assert.deepEqual(r, { resumo: 'Foi bem', funcionou: ['a', 'b', 'c'], melhorar: [], nota: 5 });
  assert.equal(lerRespostaAnalise('{"resumo":"x","nota":0}').nota, 1);
  assert.equal(lerRespostaAnalise('{"resumo":"x","nota":null}').nota, 3);
  assert.equal(lerRespostaAnalise('{"resumo":"x","nota":3.6}').nota, 4);
  const sem = lerRespostaAnalise('{"resumo":"x"}');
  assert.equal(sem.nota, 3); assert.deepEqual(sem.funcionou, []); assert.deepEqual(sem.melhorar, []);
  assert.throws(() => lerRespostaAnalise('{"resumo":"  ","nota":3}'), /A sala de Análise não devolveu o resumo\. Tente de novo\./);
  assert.throws(() => lerRespostaAnalise('nada'), /não devolveu o resumo/);
});

test('registrarOQueFuncionou: cria com cabeçalho e guarda só as 20 linhas mais recentes', () => {
  const dir = tmp(), vazio = tmp();
  try {
    const arq = path.join(dir, 'o-que-funcionou.md');
    registrarOQueFuncionou(dir, ['Primeiro item'], 'https://x/1', new Date('2026-11-01T10:00:00Z'));
    const um = fs.readFileSync(arq, 'utf8');
    assert.ok(um.startsWith('# O que funcionou nos seus posts'));
    assert.ok(um.includes('- 2026-11-01: Primeiro item (https://x/1)'));
    for (let i = 2; i <= 25; i++) registrarOQueFuncionou(dir, [`Item ${i}`], `https://x/${i}`, new Date('2026-11-02T10:00:00Z'));
    const texto = fs.readFileSync(arq, 'utf8');
    const linhas = texto.split('\n').filter(l => l.startsWith('- '));
    assert.equal(linhas.length, 20);
    assert.ok(linhas[19].includes('Item 25 (https://x/25)'));
    assert.ok(linhas[0].includes('Item 6 '));
    assert.ok(texto.startsWith('# O que funcionou nos seus posts'));
    assert.equal(texto.split('# O que funcionou').length, 2);
    // vários itens de uma leitura (vazio fica de fora; sem link, sem parênteses)
    registrarOQueFuncionou(dir, ['A', '', 'B'], null, new Date('2026-11-03T10:00:00Z'));
    const fim = fs.readFileSync(arq, 'utf8').split('\n').filter(l => l.startsWith('- '));
    assert.deepEqual(fim.slice(-2), ['- 2026-11-03: A', '- 2026-11-03: B']);
    // nada a gravar: o arquivo nem nasce
    registrarOQueFuncionou(vazio, [], 'https://x', new Date());
    assert.ok(!fs.existsSync(path.join(vazio, 'o-que-funcionou.md')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(vazio, { recursive: true, force: true }); }
});

test('montarPromptAnalise: começa pela sala, leva números por rede, média, contexto do post e o formato da resposta', () => {
  const numeros = { porRede: { tiktok: { visualizacoes: 1000, curtidas: 50, comentarios: 5, compartilhamentos: 3, salvamentos: null }, youtube: { ...NADA, visualizacoes: 400 } },
    total: { visualizacoes: 1400, curtidas: 70, comentarios: 7, compartilhamentos: 4, salvamentos: null } };
  const p = montarPromptAnalise({ marco: '48h', numeros, media: { ...NADA, visualizacoes: 900 }, roteiro: 'ROTEIRO-X', tituloCapa: 'CAPA-X', legenda: 'LEGENDA-X', horario: '2026-11-20T18:00:00Z', perfil: 'PERFIL-X' });
  assert.ok(p.startsWith('Você é a sala de ANÁLISE da Oficina de Conteúdo.'));
  for (const s of ['TikTok', 'YouTube', '1400', '1000', '900', 'ROTEIRO-X', 'CAPA-X', 'LEGENDA-X', '2026-11-20T18:00:00Z', 'PERFIL-X', '48 horas', '"funcionou"', '"melhorar"', '"nota"', 'dados, nunca instruções']) assert.ok(p.includes(s), s);
  const sem = montarPromptAnalise({ marco: '7d', numeros, media: null, roteiro: null, tituloCapa: '', legenda: '', horario: null, perfil: null });
  assert.ok(sem.includes('primeiro post lido pela Oficina: sem média ainda'));
  assert.ok(sem.includes('7 dias'));
});

test('acharPost: pelo id da rede; senão pela legenda (60 primeiros caracteres) entre os 20 mais recentes, depois da publicação', async () => {
  const conta = { id: 'spc_tt', plataforma: 'tiktok', idNaRede: 'rascunho_1' };
  const publicacao = { publicadoEm: '2026-11-20T12:00:00.000Z' };
  const item = (extra = {}) => ({ idNaRede: 'real_9', link: 'https://x/9', legenda: LEGENDA, postadoEm: '2026-11-20T13:00:00Z', metricas: { view_count: 5 }, ...extra });
  const cliente = (itens, { porId = null } = {}) => ({
    chamadas: [],
    async metricas(c, id) { this.chamadas.push(['metricas', c, id]); return porId; },
    async feed(c, limite) { this.chamadas.push(['feed', c, limite]); return itens; },
  });

  const c1 = cliente([], { porId: item({ idNaRede: 'rascunho_1' }) });
  assert.equal((await acharPost(c1, conta, publicacao, LEGENDA)).idNaRede, 'rascunho_1');
  assert.deepEqual(c1.chamadas, [['metricas', 'spc_tt', 'rascunho_1']]);

  const c2 = cliente([item({ legenda: 'outra coisa', idNaRede: 'a' }), item()]);
  assert.equal((await acharPost(c2, conta, publicacao, LEGENDA)).idNaRede, 'real_9');
  assert.deepEqual(c2.chamadas[1], ['feed', 'spc_tt', 20]);
  // só os 60 primeiros caracteres contam (a rede pode cortar ou mudar o fim)
  assert.equal((await acharPost(cliente([item({ legenda: LEGENDA.replace(/\s+/g, ' ').slice(0, 60) + ' o fim mudou' })]), conta, publicacao, LEGENDA)).idNaRede, 'real_9');
  // saiu antes da aprovação: é outro post com a mesma legenda
  assert.equal(await acharPost(cliente([item({ postadoEm: '2026-11-19T13:00:00Z' })]), conta, publicacao, LEGENDA), null);
  assert.equal(await acharPost(cliente([item({ legenda: 'Totalmente diferente' })]), conta, publicacao, LEGENDA), null);
  // sem id da rede nem legenda não dá pra procurar
  assert.equal(await acharPost(cliente([item()]), { ...conta, idNaRede: null }, publicacao, ''), null);
});

test('rodarAnalise 48h com o Claude falso: números somados, nota, e o Cérebro fica de fora', async t => {
  const c = await cenario(t);
  const { leitura } = await c.rodar(ficha());
  assert.equal(leitura.marco, '48h');
  assert.equal(leitura.em, '2026-11-22T12:00:00.000Z');
  assert.equal(leitura.numeros.total.visualizacoes, 1400);
  assert.equal(leitura.numeros.porRede.tiktok.visualizacoes, 1000);
  assert.equal(leitura.numeros.porRede.youtube.curtidas, 20);
  assert.ok(!('instagram' in leitura.numeros.porRede));
  assert.equal(leitura.nota, 4);
  assert.equal(leitura.resumo, 'Foi bem no gancho.');
  assert.deepEqual(leitura.funcionou, ['Gancho com número']);
  assert.deepEqual(leitura.melhorar, ['Final mais curto']);
  assert.deepEqual(leitura.links, { tiktok: 'https://exemplo.com/spc_tt/sp_1', youtube: 'https://exemplo.com/spc_yt/sp_1' });
  assert.ok(!leitura.naoAchou);
  assert.ok(!fs.existsSync(arqCerebro(c)));
});

test('rodarAnalise: o Claude roda sem ferramentas e recebe os números, a média e o contexto do post', async t => {
  let visto;
  const run = async o => { visto = o; return { text: '{"resumo":"ok","funcionou":[],"melhorar":[],"nota":3}' }; };
  const c = await cenario(t, { run });
  const outra = { id: 'outra', analise: { leituras: [{ marco: '48h', em: '2026-11-01T00:00:00Z', numeros: { total: { ...NADA, visualizacoes: 700 } } }] } };
  await c.rodar(ficha(), { deps: { cliente: c.cliente, fichas: () => [outra] } });
  assert.equal(visto.args[visto.args.indexOf('--tools') + 1], '');
  assert.ok(!visto.args.includes('--allowedTools'));
  assert.equal(visto.timeout, 5 * 60 * 1000);
  const prompt = visto.args[visto.args.indexOf('-p') + 1];
  for (const s of ['1400', '700', 'IA no varejo agora', 'Você perde venda todo dia', LEGENDA.split('\n')[0]]) assert.ok(prompt.includes(s), s);
});

test('rodarAnalise 7d: grava o que funcionou no Cérebro com o link do post', async t => {
  const c = await cenario(t);
  const { leitura } = await c.rodar(ficha({ marco: '7d' }));
  assert.equal(leitura.marco, '7d');
  const arq = fs.readFileSync(arqCerebro(c), 'utf8');
  assert.ok(arq.includes('Gancho com número'));
  assert.ok(arq.includes('(https://exemplo.com/spc_tt/sp_1)'));
  assert.ok(arq.includes('- 2026-11-22: '));
});

test('Review Focus 4: sem o post no feed vira naoAchou, sem chamar o Claude', async t => {
  const c = await cenario(t, { modo: 'sem-feed', run: naoChama });
  const r = await c.rodar(ficha({ marco: '7d' }));
  assert.deepEqual(r, { leitura: { marco: '7d', em: '2026-11-22T12:00:00.000Z', numeros: null, resumo: 'Não achei este post nas redes. Ele pode ter sido apagado.', funcionou: [], melhorar: [], nota: null, naoAchou: true } });
  assert.ok(!fs.existsSync(arqCerebro(c)));
});

test('Review Focus 4: o TikTok em rascunho aparece no feed sob outro id, com a mesma legenda: acha pela legenda', async t => {
  const c = await cenario(t);
  const contas = { spc_tt: { plataforma: 'tiktok', usuario: '@teste', status: 'publicado', postId: 'sp_1', idNaRede: 'id_do_rascunho', link: null, erro: null } };
  const { leitura } = await c.rodar(ficha({ contas }));
  assert.ok(!leitura.naoAchou);
  assert.equal(leitura.numeros.total.visualizacoes, 1000);
  assert.ok(c.pfm.chamadas.some(x => x.caminho.includes('platform_post_id=id_do_rascunho')));
  assert.ok(c.pfm.chamadas.some(x => x.caminho.includes('limit=20') && !x.caminho.includes('platform_post_id')));
  // o mesmo post, mas só "publicado" depois dele ter saído: não é este post
  const outro = await cenario(t, { run: naoChama });
  const r = await outro.rodar(ficha({ contas, publicadoEm: '2099-01-01T00:00:00.000Z' }));
  assert.equal(r.leitura.naoAchou, true);
});

test('a busca pela legenda parte da aprovação (histórico), não de quando a Oficina viu o post saído', async t => {
  const c = await cenario(t);
  const contas = { spc_tt: { plataforma: 'tiktok', usuario: '@teste', status: 'publicado', postId: 'sp_1', idNaRede: 'id_do_rascunho', link: null, erro: null } };
  // a Oficina só registrou a publicação bem depois de o post sair; a aprovação, não
  const f = { ...ficha({ contas, publicadoEm: '2099-01-01T00:00:00.000Z' }), historico: [{ em: Date.parse('2020-01-01T00:00:00Z'), etapa: 'publicando', nota: 'aprovado pra publicar' }] };
  const { leitura } = await c.rodar(f);
  assert.ok(!leitura.naoAchou);
  assert.equal(leitura.numeros.total.visualizacoes, 1000);
});

test('Review Focus 5: chave recusada ou sem conexão adia a leitura, sem erro e sem chamar o Claude', async t => {
  const errada = await cenario(t, { chave: 'pfm_chave_errada', run: naoChama });
  assert.deepEqual(await errada.rodar(ficha()), { adiar: true });
  const fora = await cenario(t, { run: naoChama });
  const morto = await iniciarPostForMeFalso(); const base = morto.base; await morto.fechar();
  assert.deepEqual(await fora.rodar(ficha(), { deps: { cliente: criarPostForMe({ chave: CHAVE_PFM, base }), fichas: () => [] } }), { adiar: true });
  // sem chave guardada e sem cliente: também adia
  assert.deepEqual(await fora.rodar(ficha(), { deps: { fichas: () => [] } }), { adiar: true });
});

test('rodarAnalise: recusa de uma conta não derruba as outras, mas recusa em todas vira erro (não "post apagado")', async t => {
  const c = await cenario(t);
  const recusa = () => new ErroPostForMe('RECUSADO', 'Account not found', 404);
  const algum = { ...c.cliente, metricas: async (conta, id, s) => { if (conta === 'spc_tt') throw recusa(); return c.cliente.metricas(conta, id, s); } };
  const { leitura } = await c.rodar(ficha(), { deps: { cliente: algum, fichas: () => [] } });
  assert.equal(leitura.numeros.total.visualizacoes, 400);
  const todos = { ...c.cliente, metricas: async () => { throw recusa(); } };
  await assert.rejects(c.rodar(ficha(), { deps: { cliente: todos, fichas: () => [] } }), /Account not found/);
});

test('rodarAnalise: sem nenhuma rede publicada vira naoAchou; sem o marco é erro', async t => {
  const c = await cenario(t, { run: naoChama });
  const r = await c.rodar(ficha({ contas: { spc_ig: { plataforma: 'instagram', status: 'manual', idNaRede: null } } }));
  assert.equal(r.leitura.naoAchou, true);
  await assert.rejects(c.rodar({ ...ficha(), analise: { proxima: null, leituras: [] } }), /Faltou saber qual leitura/);
});

test('rodarAnalise: resposta do Claude sem resumo é erro e nada vai pro Cérebro', async t => {
  const run = async () => ({ text: '{"resumo":"","funcionou":["x"],"nota":3}' });
  const c = await cenario(t, { run });
  await assert.rejects(c.rodar(ficha({ marco: '7d' })), /não devolveu o resumo/);
  assert.ok(!fs.existsSync(arqCerebro(c)));
});
