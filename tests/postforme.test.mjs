import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { criarPostForMe, basePostForMe, ErroPostForMe } from '../lib/postforme.mjs';
import { iniciarPostForMeFalso, CHAVE_PFM } from './fixtures/postforme-falso.mjs';

async function cenario(t, modo) {
  const pfm = await iniciarPostForMeFalso({ modo });
  t.after(() => pfm.fechar());
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-pfm-'));
  const cliente = (extra = {}) => criarPostForMe({ chave: CHAVE_PFM, base: pfm.base, ...extra });
  return { pfm, pasta, cliente };
}

const respostaJson = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

test('basePostForMe lê a variável na hora e cai no endereço oficial', () => {
  const antes = process.env.OFC_POSTFORME_URL;
  try {
    delete process.env.OFC_POSTFORME_URL;
    assert.equal(basePostForMe(), 'https://api.postforme.dev');
    process.env.OFC_POSTFORME_URL = 'http://127.0.0.1:9';
    assert.equal(basePostForMe(), 'http://127.0.0.1:9');
  } finally { if (antes === undefined) delete process.env.OFC_POSTFORME_URL; else process.env.OFC_POSTFORME_URL = antes; }
});

test('testar aceita a chave certa e recusa a errada com code CHAVE', async t => {
  const { pfm, cliente } = await cenario(t);
  await cliente().testar();
  const chamada = pfm.chamadas.at(-1);
  assert.equal(chamada.metodo, 'GET'); assert.equal(chamada.caminho, '/v1/social-accounts?status=connected&limit=1');
  await assert.rejects(cliente({ chave: 'pfm_outra_chave_errada' }).testar(), e => {
    assert.ok(e instanceof ErroPostForMe); assert.equal(e.code, 'CHAVE');
    assert.equal(e.message, 'A chave do Post for Me não funcionou.'); return true;
  });
});

test('toda chamada leva Authorization Bearer e Accept json', async t => {
  const { pfm, cliente } = await cenario(t);
  await cliente().contas();
  const c = pfm.chamadas.at(-1);
  assert.equal(c.cabecalhos.authorization, `Bearer ${CHAVE_PFM}`); assert.equal(c.cabecalhos.accept, 'application/json');
});

test('contas devolve as três contas do falso no formato { id, plataforma, usuario }', async t => {
  const { pfm, cliente } = await cenario(t);
  assert.deepEqual(await cliente().contas(), [
    { id: 'spc_tt', plataforma: 'tiktok', usuario: '@teste' },
    { id: 'spc_yt', plataforma: 'youtube', usuario: 'Teste' },
    { id: 'spc_ig', plataforma: 'instagram', usuario: '@teste' },
  ]);
  assert.equal(pfm.chamadas.at(-1).caminho, '/v1/social-accounts?status=connected&limit=100');
});

test('contas: conta sem username vira usuario vazio', async t => {
  const c = criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: async () => respostaJson(200, { data: [{ id: 'spc_1', platform: 'x' }] }) });
  assert.deepEqual(await c.contas(), [{ id: 'spc_1', plataforma: 'x', usuario: '' }]);
});

test('subir manda o .mp4 sem Authorization e devolve a media_url', async t => {
  const { pfm, pasta, cliente } = await cenario(t);
  const mp4 = path.join(pasta, 'final.mp4'); fs.writeFileSync(mp4, 'video-de-mentira');
  const url = await cliente().subir(mp4);
  assert.match(url, /\/media\/\d+$/);
  const criar = pfm.chamadas.find(c => c.metodo === 'POST' && c.caminho === '/v1/media/create-upload-url');
  assert.equal(criar.cabecalhos.authorization, `Bearer ${CHAVE_PFM}`);
  const put = pfm.chamadas.find(c => c.metodo === 'PUT');
  assert.ok(put.caminho.startsWith('/upload/'));
  assert.equal(put.comAutorizacao, false); assert.equal(put.cabecalhos.authorization, undefined);
  assert.equal(put.cabecalhos['content-type'], 'video/mp4');
  assert.equal(put.corpo, 'video-de-mentira');
});

test('subir escolhe o Content-Type pela extensão (png, jpg) e recusa outras', async t => {
  const { pfm, pasta, cliente } = await cenario(t);
  const png = path.join(pasta, 'capa.png'); fs.writeFileSync(png, 'png');
  const jpg = path.join(pasta, 'foto.JPG'); fs.writeFileSync(jpg, 'jpg');
  const txt = path.join(pasta, 'nota.txt'); fs.writeFileSync(txt, 'oi');
  await cliente().subir(png); await cliente().subir(jpg);
  const tipos = pfm.chamadas.filter(c => c.metodo === 'PUT').map(c => c.cabecalhos['content-type']);
  assert.deepEqual(tipos, ['image/png', 'image/jpeg']);
  await assert.rejects(cliente().subir(txt), /tipo de arquivo/);
});

test('criarPost + postsPorExterno acham o post pelo id externo', async t => {
  const { pfm, cliente } = await cenario(t);
  const c = cliente();
  const criado = await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt'], external_id: 'f1:1' });
  assert.deepEqual(criado, { id: 'sp_1', status: 'processing' });
  assert.equal(pfm.posts.length, 1); assert.equal(pfm.posts[0].external_id, 'f1:1');
  assert.deepEqual(await c.postsPorExterno('f1:1'), [{ id: 'sp_1', status: 'processing' }]);
  assert.deepEqual(await c.postsPorExterno('f1:2'), []);
  assert.equal(pfm.chamadas.at(-1).caminho, `/v1/social-posts?external_id=${encodeURIComponent('f1:2')}`);
});

test('criarPost com scheduled_at volta como scheduled', async t => {
  const { cliente } = await cenario(t);
  const r = await cliente().criarPost({ caption: 'oi', social_accounts: ['spc_tt'], scheduled_at: '2030-01-01T12:00:00.000Z' });
  assert.equal(r.status, 'scheduled');
});

test('cancelar apaga o post e ele some da busca', async t => {
  const { pfm, cliente } = await cenario(t);
  const c = cliente();
  const { id } = await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt'], external_id: 'f1:1' });
  await c.cancelar(id);
  const del = pfm.chamadas.at(-1);
  assert.equal(del.metodo, 'DELETE'); assert.equal(del.caminho, `/v1/social-posts/${id}`);
  assert.deepEqual(await c.postsPorExterno('f1:1'), []);
});

test('resultados (ok) traz uma linha por conta com id e link da rede', async t => {
  const { pfm, cliente } = await cenario(t);
  const c = cliente();
  const { id } = await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt', 'spc_yt'] });
  assert.deepEqual(await c.resultados(id), [
    { conta: 'spc_tt', ok: true, idNaRede: 'rede_spc_tt_sp_1', link: 'https://exemplo.com/spc_tt/sp_1', erro: null },
    { conta: 'spc_yt', ok: true, idNaRede: 'rede_spc_yt_sp_1', link: 'https://exemplo.com/spc_yt/sp_1', erro: null },
  ]);
  assert.equal(pfm.chamadas.at(-1).caminho, `/v1/social-post-results?post_id=${id}&limit=100`);
});

test('resultados (falha-youtube) mostra o erro do YouTube como texto', async t => {
  const { cliente } = await cenario(t, 'falha-youtube');
  const c = cliente();
  const { id } = await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt', 'spc_yt'] });
  const r = await c.resultados(id);
  assert.equal(r.find(x => x.conta === 'spc_tt').ok, true);
  assert.deepEqual(r.find(x => x.conta === 'spc_yt'), { conta: 'spc_yt', ok: false, idNaRede: null, link: null, erro: 'Video too short' });
});

test('resultados: erro que não é texto vira JSON', async t => {
  const c = criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: async () => respostaJson(200, { data: [{ social_account_id: 'spc_1', success: false, error: { code: 7 }, platform_data: null }] }) });
  assert.deepEqual(await c.resultados('sp_1'), [{ conta: 'spc_1', ok: false, idNaRede: null, link: null, erro: '{"code":7}' }]);
});

test('resultados (processando) vem vazio', async t => {
  const { cliente } = await cenario(t, 'processando');
  const c = cliente();
  const { id } = await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt'] });
  assert.deepEqual(await c.resultados(id), []);
});

test('metricas acha o post pelo id da rede e usa os nomes de cada rede', async t => {
  const { pfm, cliente } = await cenario(t);
  const c = cliente();
  await c.criarPost({ caption: 'minha legenda', social_accounts: ['spc_tt', 'spc_yt', 'spc_ig'] });
  const tt = await c.metricas('spc_tt', 'rede_spc_tt_sp_1');
  assert.equal(tt.idNaRede, 'rede_spc_tt_sp_1'); assert.equal(tt.link, 'https://exemplo.com/spc_tt/sp_1');
  assert.equal(tt.legenda, 'minha legenda'); assert.ok(!Number.isNaN(Date.parse(tt.postadoEm)));
  assert.deepEqual(tt.metricas, { view_count: 1000, like_count: 50, comment_count: 5, share_count: 3 });
  assert.equal(pfm.chamadas.at(-1).caminho, '/v1/social-account-feeds/spc_tt?expand=metrics&platform_post_id=rede_spc_tt_sp_1');
  assert.deepEqual((await c.metricas('spc_yt', 'rede_spc_yt_sp_1')).metricas, { views: 400, likes: 20, comments: 2, shares: 1 });
  assert.deepEqual((await c.metricas('spc_ig', 'rede_spc_ig_sp_1')).metricas, { views: 800, likes: 60, comments: 4, shares: 2, saved: 9 });
  assert.equal(await c.metricas('spc_tt', 'rede_que_nao_existe'), null);
});

test('feed devolve os posts mais recentes da conta no mesmo formato', async t => {
  const { pfm, cliente } = await cenario(t);
  const c = cliente();
  await c.criarPost({ caption: 'primeiro', social_accounts: ['spc_tt'] });
  await c.criarPost({ caption: 'segundo', social_accounts: ['spc_tt'] });
  const itens = await c.feed('spc_tt', 5);
  assert.deepEqual(itens.map(i => i.legenda), ['segundo', 'primeiro']);
  assert.deepEqual(Object.keys(itens[0]).sort(), ['idNaRede', 'legenda', 'link', 'metricas', 'postadoEm']);
  assert.equal(pfm.chamadas.at(-1).caminho, '/v1/social-account-feeds/spc_tt?expand=metrics&limit=5');
  assert.equal((await c.feed('spc_tt', 1)).length, 1);
  await c.feed('spc_tt');
  assert.equal(pfm.chamadas.at(-1).caminho, '/v1/social-account-feeds/spc_tt?expand=metrics&limit=20');
});

test('sem-feed: metricas dá null e feed dá lista vazia', async t => {
  const { cliente } = await cenario(t, 'sem-feed');
  const c = cliente();
  await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt'] });
  assert.equal(await c.metricas('spc_tt', 'rede_spc_tt_sp_1'), null);
  assert.deepEqual(await c.feed('spc_tt'), []);
});

test('porta fechada vira SEM_CONEXAO', async () => {
  const s = http.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const porta = s.address().port; await new Promise(r => s.close(r));
  const c = criarPostForMe({ chave: CHAVE_PFM, base: `http://127.0.0.1:${porta}` });
  await assert.rejects(c.testar(), e => { assert.ok(e instanceof ErroPostForMe); assert.equal(e.code, 'SEM_CONEXAO'); assert.equal(e.message, 'Não consegui falar com o Post for Me.'); return true; });
  await assert.rejects(c.contas(), { code: 'SEM_CONEXAO' });
});

test('tempo esgotado no teste vira SEM_CONEXAO', async () => {
  const lento = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  const c = criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: lento, tempoTesteMs: 20 });
  await assert.rejects(c.testar(), { code: 'SEM_CONEXAO' });
});

test('parada pelo próprio programa não vira SEM_CONEXAO', async () => {
  const lento = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  const c = criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: lento });
  const ac = new AbortController();
  const p = c.criarPost({ caption: 'oi' }, ac.signal);
  ac.abort(new Error('Parado.'));
  await assert.rejects(p, /Parado\./);
});

test('400 com { error: [...] } vira RECUSADO com os itens juntos', async () => {
  const c = criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: async () => respostaJson(400, { error: ['a', 'b'] }) });
  await assert.rejects(c.criarPost({ caption: 'oi' }), e => { assert.ok(e instanceof ErroPostForMe); assert.equal(e.code, 'RECUSADO'); assert.equal(e.message, 'a; b'); return true; });
});

test('RECUSADO usa message ou o texto padrão; 401 e 403 viram CHAVE', async () => {
  const com = (status, corpo) => criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: async () => (corpo === null ? new Response('pane', { status }) : respostaJson(status, corpo)) });
  await assert.rejects(com(422, { message: 'Legenda inválida' }).contas(), { code: 'RECUSADO', message: 'Legenda inválida' });
  await assert.rejects(com(500, null).contas(), { code: 'RECUSADO', message: 'O Post for Me recusou o pedido.' });
  await assert.rejects(com(401, { message: 'x' }).contas(), { code: 'CHAVE' });
  await assert.rejects(com(403, null).contas(), { code: 'CHAVE', message: 'A chave do Post for Me não funcionou.' });
});

test('o falso recusa qualquer rota sem a chave certa', async t => {
  const { pfm } = await cenario(t);
  const sem = await fetch(`${pfm.base}/v1/social-accounts`);
  assert.equal(sem.status, 401);
  const errada = await fetch(`${pfm.base}/v1/social-posts`, { method: 'POST', headers: { authorization: 'Bearer outra' }, body: '{}' });
  assert.equal(errada.status, 401);
  assert.equal(pfm.posts.length, 0);
  assert.deepEqual(pfm.chamadas.map(c => c.comAutorizacao), [false, true]);
});

test('cancelar de um post que já não existe é RECUSADO com status 404 (quem chama decide o que fazer)', async t => {
  const { cliente } = await cenario(t);
  const c = cliente();
  await assert.rejects(c.cancelar('sp_nao_existe'), e => { assert.ok(e instanceof ErroPostForMe); assert.equal(e.code, 'RECUSADO'); assert.equal(e.status, 404); return true; });
  const { id } = await c.criarPost({ caption: 'oi', social_accounts: ['spc_tt'] });
  await c.cancelar(id); // o vivo continua apagando normalmente
  await assert.rejects(c.cancelar(id), { code: 'RECUSADO', status: 404 }); // apagar de novo: já foi
});

test('cancelar aceita um signal: tempo esgotado vira SEM_CONEXAO e parada própria não', async () => {
  const lento = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  const c = criarPostForMe({ chave: CHAVE_PFM, base: 'http://x', fetch: lento });
  await assert.rejects(c.cancelar('sp_1', AbortSignal.timeout(20)), { code: 'SEM_CONEXAO' });
  const ac = new AbortController(); const p = c.cancelar('sp_1', ac.signal);
  ac.abort(new Error('fechou'));
  await assert.rejects(p, e => { assert.ok(!(e instanceof ErroPostForMe)); assert.equal(e.message, 'fechou'); return true; });
});
