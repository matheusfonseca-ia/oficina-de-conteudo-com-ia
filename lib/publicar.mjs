// The `publicando` stage: build the post body and send it to Post for Me (the student's own key).
// Never posts twice: every send carries external_id "<ficha>:<n>", and before creating anything the runner asks
// Post for Me whether that id already exists (the Oficina may have closed after creating and before saving).
// `n` is previous tentativas + 1 and is only saved when the send finishes, so a "Tentar de novo" repeats the same id.
import fs from 'node:fs';
import path from 'node:path';
import { criarPostForMe } from './postforme.mjs';
import { chaveDe } from './conexoes.mjs';

// Caption limits of each network (the platforms' own limits: Post for Me does not check them).
export const LIMITES_LEGENDA = { instagram: 2200, facebook: 63206, threads: 500, x: 280, linkedin: 3000, tiktok: 4000, tiktok_business: 4000, youtube: 5000, pinterest: 800, bluesky: 300 };
export const NOMES_REDE = { instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', x: 'X', linkedin: 'LinkedIn', tiktok: 'TikTok', tiktok_business: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest', bluesky: 'Bluesky' };
const TAMANHO_TITULO = 100;
const SEM_CONTAS = 'Não tem nenhuma rede esperando pra publicar.';

export function legendaDoPost(postagem) {
  const hashtags = (postagem?.hashtags || []).filter(Boolean);
  return hashtags.length ? `${postagem.legenda}\n\n${hashtags.join(' ')}` : postagem.legenda;
}

// Title of YouTube and TikTok: the chosen cover's title or, without a cover, the first non-empty line of the caption.
export function tituloDoPost(ficha) {
  const capa = ficha.capa;
  const daCapa = Number.isInteger(capa?.escolhida) ? String(capa.opcoes?.[capa.escolhida]?.titulo ?? '').trim() : '';
  const primeiraLinha = String(ficha.postagem?.legenda ?? '').split(/\r?\n/).map(l => l.trim()).find(Boolean) ?? '';
  return (daCapa || primeiraLinha).slice(0, TAMANHO_TITULO).trim();
}

export function conferirLimites(legenda, contas) {
  for (const c of contas) {
    const limite = LIMITES_LEGENDA[c.plataforma];
    if (limite !== undefined && legenda.length > limite) {
      throw new Error(`A legenda passa do limite do ${NOMES_REDE[c.plataforma] || c.plataforma} (${limite} caracteres). Desmarque essa rede ou peça uma legenda mais curta.`);
    }
  }
}

// Pure: the body of POST /v1/social-posts. Only the networks present get a platform_configurations entry.
export function montarCorpo({ ficha, contas, mediaUrl, capaUrl, quando, externalId }) {
  const titulo = tituloDoPost(ficha);
  const tem = p => contas.some(c => c.plataforma === p);
  const cfg = {};
  // TikTok goes as a draft: music can only be picked in the app, and a post published by the API has none.
  if (tem('tiktok')) cfg.tiktok = { is_draft: true, auto_add_music: true, title: titulo };
  if (tem('tiktok_business')) cfg.tiktok_business = { is_draft: true, auto_add_music: true, title: titulo };
  // YouTube goes public (a private Short has no numbers for the Análise); `localizations: {}` is required by the API.
  if (tem('youtube')) cfg.youtube = { title: titulo, localizations: {}, privacy_status: 'public', made_for_kids: false };
  if (tem('instagram')) cfg.instagram = { placement: 'reels', share_to_feed: true };
  if (tem('facebook')) cfg.facebook = { placement: 'reels' };
  return {
    caption: legendaDoPost(ficha.postagem),
    social_accounts: contas.map(c => c.id),
    media: [{ url: mediaUrl, ...(capaUrl ? { thumbnail_url: capaUrl } : {}) }],
    ...(quando ? { scheduled_at: quando } : {}),
    external_id: externalId,
    ...(Object.keys(cfg).length ? { platform_configurations: cfg } : {}),
  };
}

const existe = arquivo => { try { return fs.statSync(arquivo).isFile(); } catch { return false; } };
// A schedule closer than this goes out now: Post for Me gets no scheduled_at in the past (slow upload, "Tentar de novo" later).
const FOLGA_AGENDAR_MS = 60_000;

// The exported MP4 the post needs. Also checked by the server before approving, so the student hears it on the spot.
export function conferirVideo(pastaVideo) {
  const mp4 = path.join(pastaVideo, 'edit', 'final.mp4');
  if (!existe(mp4)) throw new Error('Não achei o vídeo exportado (edit/final.mp4). Exporte de novo na sala de Edição.');
  return mp4;
}

// Returns the new `publicacao` record; the orchestrator hands it to the ficha as `concluiu { publicacao }`.
export async function rodarPublicacao({ pastaVideo, ficha, config, signal, deps = {}, agora = null }) {
  const antiga = ficha.publicacao;
  if (!antiga) throw new Error('Faltou o registro da publicação. Aprove o post de novo.');
  let cliente = deps.cliente;
  if (!cliente) {
    const chave = chaveDe(config.dados, 'postForMe');
    if (!chave) throw new Error('Conecte o Post for Me pra publicar daqui (chefe → Conexões).');
    cliente = criarPostForMe({ chave });
  }

  const pendentes = new Set(antiga.pendentes || []);
  const contas = (antiga.pedido?.contas || []).filter(c => pendentes.has(c.id));
  if (!contas.length) throw new Error(SEM_CONTAS);
  conferirLimites(legendaDoPost(ficha.postagem), contas);

  const n = (antiga.tentativas || 0) + 1;
  const externalId = `${ficha.id}:${n}`;
  let postId = (await cliente.postsPorExterno(externalId, signal)).find(p => p.external_id === externalId)?.id ?? null;

  if (!postId) {
    const mp4 = conferirVideo(pastaVideo);
    const capa = Number.isInteger(ficha.capa?.escolhida) ? ficha.capa.opcoes?.[ficha.capa.escolhida] : null;
    // The cover is a nicety: if the chosen file is gone, the post goes without it.
    const arquivoCapa = capa?.arquivo ? path.resolve(pastaVideo, capa.arquivo) : null;
    const mediaUrl = await cliente.subir(mp4, signal);
    const capaUrl = arquivoCapa && existe(arquivoCapa) ? await cliente.subir(arquivoCapa, signal) : null;
    // The clock is read after the uploads (they can take minutes); `agora` is only for tests.
    const pedido = antiga.pedido?.quando ?? null;
    const quando = pedido && Date.parse(pedido) - (agora ?? Date.now()) > FOLGA_AGENDAR_MS ? pedido : null;
    postId = (await cliente.criarPost(montarCorpo({ ficha, contas, mediaUrl, capaUrl, quando, externalId }), signal)).id;
  }

  const novas = { ...antiga.contas };
  for (const c of contas) novas[c.id] = { ...(antiga.contas?.[c.id] || { plataforma: c.plataforma, usuario: c.usuario, idNaRede: null, link: null }), status: 'esperando', postId, erro: null };
  return { ...antiga, tentativas: n, postIds: [...new Set([...(antiga.postIds || []), postId])], contas: novas, pendentes: [], erro: null };
}
