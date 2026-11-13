import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarFicha, aplicar } from '../lib/ficha.mjs';
import { criarPostForMe } from '../lib/postforme.mjs';
import { LIMITES_LEGENDA, NOMES_REDE, legendaDoPost, tituloDoPost, conferirLimites, montarCorpo, rodarPublicacao } from '../lib/publicar.mjs';
import { iniciarPostForMeFalso, CHAVE_PFM } from './fixtures/postforme-falso.mjs';

const AGORA = Date.parse('2026-11-20T12:00:00Z');
const FUTURO = '2026-11-21T18:00:00Z';
const TT = { id: 'spc_tt', plataforma: 'tiktok', usuario: '@teste' };
const YT = { id: 'spc_yt', plataforma: 'youtube', usuario: 'Teste' };
const IG = { id: 'spc_ig', plataforma: 'instagram', usuario: '@teste' };
const POST = { legenda: 'Como a IA muda o varejo\nSegunda linha da legenda.', hashtags: ['#ia', '#varejo'], horario: '2026-11-21T18:00:00-03:00' };
const CAPA = { opcoes: [{ arquivo: 'capa/capa-1.png', titulo: 'IA no varejo agora', origem: 'fabrica' }, { arquivo: 'capa/capa-2.png', titulo: 'Outro título', origem: 'fabrica' }], escolhida: 0, aviso: null };

// Ficha em `publicando`, montada só com `aplicar` (como o orquestrador faz).
function fichaPublicando({ contas = [TT, YT], quando = null, capa = CAPA, postagem = POST } = {}) {
  let f = criarFicha({ id: 'v1', porta: 'bruto', bruto: 'bruto.mp4', pular: capa ? [] : ['capa'], agora: AGORA });
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);                    // escolhas-edicao
  f = aplicar(f, { tipo: 'escolhas-prontas' }, AGORA);            // editando
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);                    // aprovacao-video
  f = aplicar(f, { tipo: 'aprovou' }, AGORA);                     // exportando
  f = aplicar(f, { tipo: 'concluiu' }, AGORA);                    // capa (ou postagem, se pulada)
  if (capa) f = aplicar(f, { tipo: 'concluiu', dados: { capa } }, AGORA); // postagem
  f = aplicar(f, { tipo: 'concluiu', dados: { postagem } }, AGORA);       // aprovacao-pacote
  f = aplicar(f, { tipo: 'aprovou', publicar: { contas, quando } }, AGORA);
  assert.equal(f.etapa, 'publicando');
  return f;
}

async function cenario(t, { modo, capaNoDisco = true, videoNoDisco = true } = {}) {
  const pfm = await iniciarPostForMeFalso({ modo });
  t.after(() => pfm.fechar());
  const pastaVideo = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-publicar-'));
  t.after(() => fs.rmSync(pastaVideo, { recursive: true, force: true }));
  if (videoNoDisco) { fs.mkdirSync(path.join(pastaVideo, 'edit')); fs.writeFileSync(path.join(pastaVideo, 'edit', 'final.mp4'), 'video-de-mentira'); }
  if (capaNoDisco) { fs.mkdirSync(path.join(pastaVideo, 'capa')); fs.writeFileSync(path.join(pastaVideo, 'capa', 'capa-1.png'), 'png-de-mentira'); }
  const cliente = criarPostForMe({ chave: CHAVE_PFM, base: pfm.base });
  const config = { dados: fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-publicar-dados-')) };
  t.after(() => fs.rmSync(config.dados, { recursive: true, force: true }));
  return { pfm, pastaVideo, cliente, config, rodar: (ficha, extra = {}) => rodarPublicacao({ pastaVideo, ficha, config, deps: { cliente }, ...extra }) };
}
const uploads = pfm => pfm.chamadas.filter(c => c.metodo === 'PUT');
const criacoes = pfm => pfm.chamadas.filter(c => c.metodo === 'POST' && c.caminho === '/v1/social-posts');

test('limites e nomes das redes', () => {
  assert.deepEqual(LIMITES_LEGENDA, { instagram: 2200, facebook: 63206, threads: 500, x: 280, linkedin: 3000, tiktok: 4000, tiktok_business: 4000, youtube: 5000, pinterest: 800, bluesky: 300 });
  assert.deepEqual(NOMES_REDE, { instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', x: 'X', linkedin: 'LinkedIn', tiktok: 'TikTok', tiktok_business: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest', bluesky: 'Bluesky' });
});

test('legendaDoPost junta a legenda e as hashtags, e sem hashtags fica só a legenda', () => {
  assert.equal(legendaDoPost({ legenda: 'Oi', hashtags: ['#a', '#b'] }), 'Oi\n\n#a #b');
  assert.equal(legendaDoPost({ legenda: 'Oi', hashtags: [] }), 'Oi');
  assert.equal(legendaDoPost({ legenda: 'Oi' }), 'Oi');
});

test('tituloDoPost usa o título da capa escolhida; sem capa, a primeira linha da legenda; corta em 100', () => {
  assert.equal(tituloDoPost({ capa: { ...CAPA, escolhida: 1 }, postagem: POST }), 'Outro título');
  assert.equal(tituloDoPost({ capa: CAPA, postagem: POST }), 'IA no varejo agora');
  assert.equal(tituloDoPost({ capa: null, postagem: POST }), 'Como a IA muda o varejo');
  assert.equal(tituloDoPost({ capa: { opcoes: [], escolhida: null }, postagem: POST }), 'Como a IA muda o varejo');
  assert.equal(tituloDoPost({ capa: null, postagem: { legenda: '\n\n  Primeira linha de verdade  \nresto', hashtags: [] } }), 'Primeira linha de verdade');
  const longo = 'a'.repeat(150);
  assert.equal(tituloDoPost({ capa: null, postagem: { legenda: longo, hashtags: [] } }).length, 100);
  assert.equal(tituloDoPost({ capa: { opcoes: [{ arquivo: 'capa/capa-1.png', titulo: longo }], escolhida: 0 }, postagem: POST }).length, 100);
});

test('conferirLimites recusa a rede que estoura e deixa passar sem ela', () => {
  const legenda = 'a'.repeat(300);
  assert.throws(() => conferirLimites(legenda, [TT, { id: 'spc_x', plataforma: 'x', usuario: '@x' }]),
    /A legenda passa do limite do X \(280 caracteres\)\. Desmarque essa rede ou peça uma legenda mais curta\./);
  assert.doesNotThrow(() => conferirLimites(legenda, [TT, YT, IG]));
  assert.doesNotThrow(() => conferirLimites('a'.repeat(280), [{ id: 'spc_x', plataforma: 'x' }]));
  // a primeira rede estourada é a que aparece na mensagem
  assert.throws(() => conferirLimites('a'.repeat(3000), [IG, { id: 'spc_b', plataforma: 'bluesky' }]), /limite do Instagram \(2200 caracteres\)/);
  // rede que eu não conheço não trava
  assert.doesNotThrow(() => conferirLimites(legenda, [{ id: 'spc_n', plataforma: 'rede-nova' }]));
});

test('montarCorpo com tiktok + youtube + instagram', () => {
  const ficha = fichaPublicando({ contas: [TT, YT, IG] });
  const corpo = montarCorpo({ ficha, contas: [TT, YT, IG], mediaUrl: 'https://m/1', capaUrl: 'https://m/2', quando: null, externalId: 'v1:1' });
  assert.equal(corpo.caption, 'Como a IA muda o varejo\nSegunda linha da legenda.\n\n#ia #varejo');
  assert.deepEqual(corpo.social_accounts, ['spc_tt', 'spc_yt', 'spc_ig']);
  assert.deepEqual(corpo.media, [{ url: 'https://m/1', thumbnail_url: 'https://m/2' }]);
  assert.equal(corpo.external_id, 'v1:1');
  assert.equal('scheduled_at' in corpo, false);
  const cfg = corpo.platform_configurations;
  assert.deepEqual(cfg.tiktok, { is_draft: true, auto_add_music: true, title: 'IA no varejo agora' });
  assert.equal(cfg.tiktok.is_draft, true);
  assert.deepEqual(cfg.youtube, { title: 'IA no varejo agora', localizations: {}, privacy_status: 'public', made_for_kids: false });
  assert.deepEqual(cfg.instagram, { placement: 'reels', share_to_feed: true });
  assert.equal('facebook' in cfg, false); assert.equal('tiktok_business' in cfg, false);
});

test('montarCorpo: scheduled_at só com quando; sem capaUrl não há thumbnail_url; facebook e tiktok_business', () => {
  const ficha = fichaPublicando();
  const fb = { id: 'spc_fb', plataforma: 'facebook' }, tb = { id: 'spc_tb', plataforma: 'tiktok_business' };
  const corpo = montarCorpo({ ficha, contas: [fb, tb], mediaUrl: 'https://m/1', capaUrl: null, quando: '2026-11-21T18:00:00.000Z', externalId: 'v1:1' });
  assert.equal(corpo.scheduled_at, '2026-11-21T18:00:00.000Z');
  assert.deepEqual(corpo.media, [{ url: 'https://m/1' }]); assert.equal('thumbnail_url' in corpo.media[0], false);
  assert.deepEqual(corpo.platform_configurations, {
    facebook: { placement: 'reels' },
    tiktok_business: { is_draft: true, auto_add_music: true, title: 'IA no varejo agora' },
  });
});

test('montarCorpo: rede sem configuração própria (x) não ganha platform_configurations', () => {
  const corpo = montarCorpo({ ficha: fichaPublicando(), contas: [{ id: 'spc_x', plataforma: 'x' }], mediaUrl: 'https://m/1', capaUrl: null, quando: null, externalId: 'v1:1' });
  assert.equal('platform_configurations' in corpo, false);
});

test('rodarPublicacao sobe vídeo e capa, cria 1 post com external_id e devolve as contas esperando', async t => {
  const { pfm, rodar } = await cenario(t);
  const ficha = fichaPublicando();
  const pub = await rodar(ficha);
  assert.equal(uploads(pfm).length, 2);
  assert.deepEqual(uploads(pfm).map(c => c.cabecalhos['content-type']), ['video/mp4', 'image/png']);
  assert.equal(pfm.posts.length, 1);
  const corpo = pfm.posts[0];
  assert.equal(corpo.external_id, 'v1:1');
  assert.deepEqual(corpo.social_accounts, ['spc_tt', 'spc_yt']);
  assert.deepEqual(uploads(pfm).map(c => c.corpo), ['video-de-mentira', 'png-de-mentira']);
  assert.match(corpo.media[0].url, /\/media\/1$/); assert.match(corpo.media[0].thumbnail_url, /\/media\/2$/); // vídeo primeiro, capa depois
  assert.equal('scheduled_at' in corpo, false);
  assert.equal(corpo.platform_configurations.tiktok.is_draft, true);
  assert.equal(pub.tentativas, 1); assert.deepEqual(pub.postIds, ['sp_1']);
  assert.deepEqual(pub.pendentes, []); assert.equal(pub.erro, null);
  for (const id of ['spc_tt', 'spc_yt']) {
    assert.equal(pub.contas[id].status, 'esperando'); assert.equal(pub.contas[id].postId, 'sp_1'); assert.equal(pub.contas[id].erro, null);
  }
  assert.deepEqual(pub.pedido, ficha.publicacao.pedido);
  assert.equal(ficha.publicacao.tentativas, 0); // a ficha de entrada não é alterada
  assert.deepEqual(ficha.publicacao.pendentes, ['spc_tt', 'spc_yt']);
  // e a ficha aceita o registro: vai pra agendado
  assert.equal(aplicar(ficha, { tipo: 'concluiu', dados: { publicacao: pub } }, AGORA).etapa, 'agendado');
});

test('rodarPublicacao agendado leva scheduled_at do pedido', async t => {
  const { pfm, rodar } = await cenario(t);
  await rodar(fichaPublicando({ quando: FUTURO }), { agora: AGORA });
  assert.equal(pfm.posts[0].scheduled_at, new Date(FUTURO).toISOString());
});

test('rodarPublicacao com o horário já vencido (ou a menos de 1 minuto) publica agora, sem scheduled_at', async t => {
  const { pfm, rodar } = await cenario(t);
  const ficha = fichaPublicando({ quando: FUTURO });
  await rodar(ficha, { agora: Date.parse(FUTURO) + 3_600_000 }); // "Tentar de novo" horas depois
  assert.equal('scheduled_at' in pfm.posts[0], false);
  ficha.id = 'v2';
  await rodar(ficha, { agora: Date.parse(FUTURO) - 30_000 }); // upload demorado: faltam 30 s
  assert.equal(pfm.posts[1].external_id, 'v2:1'); assert.equal('scheduled_at' in pfm.posts[1], false);
  ficha.id = 'v3';
  await rodar(ficha, { agora: Date.parse(FUTURO) - 5 * 60_000 }); // faltam 5 minutos: ainda agenda
  assert.equal(pfm.posts[2].scheduled_at, new Date(FUTURO).toISOString());
});

test('I1: se o Post for Me ignora o filtro de external_id, um post antigo de outro id não é reaproveitado', async t => {
  const { pfm, cliente, rodar } = await cenario(t, { modo: 'filtro-ignorado' });
  await cliente.criarPost({ caption: 'post antigo do dono', social_accounts: ['spc_tt'], external_id: 'outra-ficha:1' });
  const pub = await rodar(fichaPublicando());
  assert.equal(pfm.posts.length, 2); assert.equal(pfm.posts[1].external_id, 'v1:1');
  assert.deepEqual(pub.postIds, ['sp_2']); assert.equal(pub.contas.spc_tt.postId, 'sp_2');
});

test('rodarPublicacao sem capa escolhida sobe só o vídeo e o corpo não tem thumbnail_url', async t => {
  const { pfm, rodar } = await cenario(t, { capaNoDisco: false });
  const pub = await rodar(fichaPublicando({ capa: null }));
  assert.equal(uploads(pfm).length, 1);
  assert.equal('thumbnail_url' in pfm.posts[0].media[0], false);
  assert.equal(pub.contas.spc_tt.postId, 'sp_1');
  // título cai pra primeira linha da legenda
  assert.equal(pfm.posts[0].platform_configurations.youtube.title, 'Como a IA muda o varejo');
});

test('rodarPublicacao com capa escolhida mas o arquivo sumiu: pula a capa e publica mesmo assim', async t => {
  const { pfm, rodar } = await cenario(t, { capaNoDisco: false });
  const pub = await rodar(fichaPublicando());
  assert.equal(uploads(pfm).length, 1);
  assert.equal('thumbnail_url' in pfm.posts[0].media[0], false);
  assert.equal(pub.contas.spc_yt.status, 'esperando');
});

test('rodarPublicacao: capa com escolhida nula não sobe capa', async t => {
  const { pfm, rodar } = await cenario(t);
  await rodar(fichaPublicando({ capa: { opcoes: [], escolhida: null, aviso: 'sem navegador' } }));
  assert.equal(uploads(pfm).length, 1);
});

test('rodarPublicacao: sem edit/final.mp4 avisa antes de subir qualquer coisa', async t => {
  const { pfm, rodar } = await cenario(t, { videoNoDisco: false });
  await assert.rejects(rodar(fichaPublicando()), { message: 'Não achei o vídeo exportado (edit/final.mp4). Exporte de novo na sala de Edição.' });
  assert.equal(uploads(pfm).length, 0);
  assert.equal(pfm.chamadas.some(c => c.caminho === '/v1/media/create-upload-url'), false);
  assert.equal(criacoes(pfm).length, 0);
});

test('Review Focus 1: post já criado com o mesmo external_id é reaproveitado, sem upload nem novo POST', async t => {
  const { pfm, cliente, rodar } = await cenario(t);
  await cliente.criarPost({ caption: 'já criado antes de a Oficina fechar', social_accounts: ['spc_tt', 'spc_yt'], external_id: 'v1:1' });
  const antes = pfm.chamadas.length;
  const pub = await rodar(fichaPublicando());
  const novas = pfm.chamadas.slice(antes);
  assert.equal(novas.some(c => c.metodo === 'PUT'), false);
  assert.equal(novas.some(c => c.caminho === '/v1/media/create-upload-url'), false);
  assert.equal(novas.some(c => c.metodo === 'POST' && c.caminho === '/v1/social-posts'), false);
  assert.equal(pfm.posts.length, 1);
  assert.deepEqual(pub.postIds, ['sp_1']); assert.equal(pub.tentativas, 1);
  assert.equal(pub.contas.spc_tt.postId, 'sp_1'); assert.equal(pub.contas.spc_yt.status, 'esperando');
  assert.deepEqual(pub.pendentes, []);
});

test('reaproveitar o post existente vale mesmo sem o vídeo no disco', async t => {
  const { pfm, cliente, rodar } = await cenario(t, { videoNoDisco: false });
  await cliente.criarPost({ caption: 'x', social_accounts: ['spc_tt', 'spc_yt'], external_id: 'v1:1' });
  const pub = await rodar(fichaPublicando());
  assert.equal(pfm.posts.length, 1); assert.deepEqual(pub.postIds, ['sp_1']);
});

test('um "Tentar de novo" depois de falhar na criação repete o mesmo external_id', async t => {
  const { pfm, cliente, rodar } = await cenario(t);
  const ficha = fichaPublicando();
  let falhou = false;
  const quebrado = { ...cliente, criarPost: async (...a) => { if (!falhou) { falhou = true; throw new Error('O Post for Me recusou o pedido.'); } return cliente.criarPost(...a); } };
  await assert.rejects(rodar(ficha, { deps: { cliente: quebrado } }), /recusou o pedido/);
  assert.equal(pfm.posts.length, 0);
  const pub = await rodar(ficha); // a ficha segue como estava: n continua 1
  assert.equal(pfm.posts[0].external_id, 'v1:1'); assert.equal(pub.tentativas, 1);
});

test('republicar: external_id novo (:2), só a conta pendente, e a outra fica intacta', async t => {
  const { pfm, rodar } = await cenario(t, { modo: 'falha-youtube' });
  let f = fichaPublicando();
  f = aplicar(f, { tipo: 'concluiu', dados: { publicacao: await rodar(f) } }, AGORA); // agendado
  const resultados = await criarPostForMe({ chave: CHAVE_PFM, base: pfm.base }).resultados('sp_1');
  f = aplicar(f, { tipo: 'publicou', resultados }, AGORA);                           // tt publicado, yt falhou
  assert.equal(f.etapa, 'aguardando-numeros');
  f = aplicar(f, { tipo: 'republicar', conta: 'spc_yt' }, AGORA);
  assert.equal(f.etapa, 'publicando'); assert.deepEqual(f.publicacao.pendentes, ['spc_yt']); assert.equal(f.publicacao.tentativas, 1);
  const ttAntes = structuredClone(f.publicacao.contas.spc_tt);
  const pub = await rodar(f);
  assert.equal(pfm.posts.length, 2);
  assert.equal(pfm.posts[1].external_id, 'v1:2'); assert.deepEqual(pfm.posts[1].social_accounts, ['spc_yt']);
  assert.equal(pub.tentativas, 2); assert.deepEqual(pub.postIds, ['sp_1', 'sp_2']);
  assert.deepEqual(pub.contas.spc_tt, ttAntes);
  assert.equal(pub.contas.spc_tt.status, 'publicado');
  assert.equal(pub.contas.spc_yt.status, 'esperando'); assert.equal(pub.contas.spc_yt.postId, 'sp_2'); assert.equal(pub.contas.spc_yt.erro, null);
  assert.deepEqual(pub.pendentes, []);
});

test('limite de legenda: recusa antes de subir qualquer arquivo', async t => {
  const { pfm, rodar } = await cenario(t);
  const X = { id: 'spc_x', plataforma: 'x', usuario: '@x' };
  const ficha = fichaPublicando({ contas: [TT, X], postagem: { legenda: 'a'.repeat(300), hashtags: [], horario: POST.horario } });
  await assert.rejects(rodar(ficha), /limite do X \(280 caracteres\)/);
  assert.equal(pfm.chamadas.length, 0);
});

test('só as redes pendentes entram na checagem de limite', async t => {
  const { pfm, rodar } = await cenario(t);
  const X = { id: 'spc_x', plataforma: 'x', usuario: '@x' };
  const ficha = fichaPublicando({ contas: [TT, X], postagem: { legenda: 'a'.repeat(300), hashtags: [], horario: POST.horario } });
  ficha.publicacao.pendentes = ['spc_tt']; // o X já saiu em outra tentativa
  const pub = await rodar(ficha);
  assert.deepEqual(pfm.posts[0].social_accounts, ['spc_tt']);
  assert.equal(pub.contas.spc_tt.status, 'esperando'); assert.equal(pub.contas.spc_x.status, 'enviando');
});

test('sem chave do Post for Me avisa onde conectar, sem chamar a rede', async t => {
  const pfm = await iniciarPostForMeFalso(); t.after(() => pfm.fechar());
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-publicar-dados-')); t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  const antes = process.env.OFC_POSTFORME_URL; process.env.OFC_POSTFORME_URL = pfm.base;
  t.after(() => { if (antes === undefined) delete process.env.OFC_POSTFORME_URL; else process.env.OFC_POSTFORME_URL = antes; });
  await assert.rejects(rodarPublicacao({ pastaVideo: dados, ficha: fichaPublicando(), config: { dados } }), { message: 'Conecte o Post for Me pra publicar daqui (chefe → Conexões).' });
  assert.equal(pfm.chamadas.length, 0);
});

test('chave guardada no config vira o cliente padrão; chave recusada vira "não funcionou"', async t => {
  const pfm = await iniciarPostForMeFalso(); t.after(() => pfm.fechar());
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-publicar-dados-')); t.after(() => fs.rmSync(dados, { recursive: true, force: true }));
  const pastaVideo = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-publicar-')); t.after(() => fs.rmSync(pastaVideo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(pastaVideo, 'edit')); fs.writeFileSync(path.join(pastaVideo, 'edit', 'final.mp4'), 'v');
  const antes = process.env.OFC_POSTFORME_URL; process.env.OFC_POSTFORME_URL = pfm.base;
  t.after(() => { if (antes === undefined) delete process.env.OFC_POSTFORME_URL; else process.env.OFC_POSTFORME_URL = antes; });
  const ficha = fichaPublicando({ capa: null });

  fs.writeFileSync(path.join(dados, 'config.json'), JSON.stringify({ postForMe: 'pfm_outra_chave_errada' }));
  await assert.rejects(rodarPublicacao({ pastaVideo, ficha, config: { dados } }), /não funcionou/);
  assert.equal(pfm.posts.length, 0);

  fs.writeFileSync(path.join(dados, 'config.json'), JSON.stringify({ postForMe: CHAVE_PFM }));
  const pub = await rodarPublicacao({ pastaVideo, ficha, config: { dados } });
  assert.equal(pub.contas.spc_tt.postId, 'sp_1'); assert.equal(pfm.posts.length, 1);
});
