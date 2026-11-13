// Post for Me API client (the student's own key). Docs: https://api.postforme.dev/docs
// Upload: POST /v1/media/create-upload-url → PUT upload_url (Content-Type only, no Authorization) → media_url.
// Post: POST /v1/social-posts → GET /v1/social-post-results?post_id=… (empty = still processing).
// Numbers: GET /v1/social-account-feeds/<conta>?expand=metrics (needs the account connected with the feeds permission).
// Only the server talks to Post for Me: the page never sees the key.
import fs from 'node:fs';
import path from 'node:path';

export const basePostForMe = () => process.env.OFC_POSTFORME_URL || 'https://api.postforme.dev';
const TIPOS = { '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

// code: 'CHAVE' (401/403), 'SEM_CONEXAO' (no answer at all: offline, DNS, timeout), 'RECUSADO' (any other refusal).
export class ErroPostForMe extends Error {
  constructor(code, message, status) { super(message); this.name = 'ErroPostForMe'; this.code = code; if (status) this.status = status; }
}

const semConexao = () => new ErroPostForMe('SEM_CONEXAO', 'Não consegui falar com o Post for Me.');
const chaveRecusada = status => new ErroPostForMe('CHAVE', 'A chave do Post for Me não funcionou.', status);

// A 400 comes as { error: ['...', '...'] }: the list says more than the status does.
function mensagemDeRecusa(texto) {
  let dados; try { dados = JSON.parse(texto); } catch { dados = null; }
  if (Array.isArray(dados?.error)) { const itens = dados.error.map(String).filter(Boolean); if (itens.length) return itens.join('; '); }
  if (typeof dados?.error === 'string' && dados.error) return dados.error;
  if (typeof dados?.message === 'string' && dados.message) return dados.message;
  return 'O Post for Me recusou o pedido.';
}

const textoDoErro = e => (e == null ? '' : typeof e === 'string' ? e : JSON.stringify(e));

function itemDoFeed(i) {
  return { idNaRede: i.platform_post_id ?? null, link: i.platform_url ?? null, legenda: i.caption ?? '', postadoEm: i.posted_at ?? null, metricas: i.metrics ?? {} };
}

export function criarPostForMe({ chave, base = basePostForMe(), fetch = globalThis.fetch, tempoTesteMs = 15000 }) {
  const raiz = String(base).replace(/\/+$/, '');
  const cabecalhos = { authorization: `Bearer ${chave}`, accept: 'application/json' };

  // A rejected fetch is "no connection", unless the caller itself stopped it (then the stop goes up as it came).
  function falhaDeRede(e, signal) {
    if (signal?.aborted && signal.reason?.name !== 'TimeoutError') return e;
    return semConexao();
  }

  async function api(metodo, caminho, { corpo, signal } = {}) {
    let r;
    try {
      r = await fetch(raiz + caminho, {
        method: metodo,
        headers: corpo === undefined ? cabecalhos : { ...cabecalhos, 'content-type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal,
      });
    } catch (e) { throw falhaDeRede(e, signal); }
    let texto;
    try { texto = await r.text(); } catch (e) { throw falhaDeRede(e, signal); }
    if (r.status === 401 || r.status === 403) throw chaveRecusada(r.status);
    if (!r.ok) throw new ErroPostForMe('RECUSADO', mensagemDeRecusa(texto), r.status);
    try { return JSON.parse(texto); } catch { return null; }
  }

  const feedDe = async (conta, consulta, signal) =>
    ((await api('GET', `/v1/social-account-feeds/${encodeURIComponent(conta)}?expand=metrics${consulta}`, { signal }))?.data || []).map(itemDoFeed);

  return {
    // Listing one account is free: it is how the key gets checked.
    async testar() { await api('GET', '/v1/social-accounts?status=connected&limit=1', { signal: AbortSignal.timeout(tempoTesteMs) }); },

    async contas(signal) {
      const r = await api('GET', '/v1/social-accounts?status=connected&limit=100', { signal });
      return (r?.data || []).map(c => ({ id: c.id, plataforma: c.platform, usuario: c.username || '' }));
    },

    async subir(arquivo, signal) {
      const tipo = TIPOS[path.extname(arquivo).toLowerCase()];
      if (!tipo) throw new ErroPostForMe('RECUSADO', 'Esse tipo de arquivo não dá pra mandar pro Post for Me.');
      const u = await api('POST', '/v1/media/create-upload-url', { corpo: {}, signal });
      let r;
      try {
        // The presigned URL never gets the Post for Me key. The file streams from disk (a Blob keeps its size, which the PUT needs).
        r = await fetch(u.upload_url, { method: 'PUT', headers: { 'content-type': tipo }, body: await fs.openAsBlob(arquivo), signal });
      } catch (e) { throw falhaDeRede(e, signal); }
      if (!r.ok) throw new ErroPostForMe('RECUSADO', 'Não consegui mandar o arquivo pro Post for Me.', r.status);
      return u.media_url;
    },

    async criarPost(corpo, signal) {
      const r = await api('POST', '/v1/social-posts', { corpo, signal });
      return { id: r.id, status: r.status };
    },

    async postsPorExterno(externalId, signal) {
      const r = await api('GET', `/v1/social-posts?external_id=${encodeURIComponent(externalId)}`, { signal });
      return (r?.data || []).map(p => ({ id: p.id, status: p.status }));
    },

    async cancelar(postId) { await api('DELETE', `/v1/social-posts/${encodeURIComponent(postId)}`); },

    async resultados(postId, signal) {
      const r = await api('GET', `/v1/social-post-results?post_id=${encodeURIComponent(postId)}&limit=100`, { signal });
      return (r?.data || []).map(x => ({
        conta: x.social_account_id, ok: x.success === true,
        idNaRede: x.platform_data?.id ?? null, link: x.platform_data?.url ?? null,
        erro: x.success === true ? null : textoDoErro(x.error),
      }));
    },

    async metricas(conta, idNaRede, signal) {
      return (await feedDe(conta, `&platform_post_id=${encodeURIComponent(idNaRede)}`, signal))[0] ?? null;
    },

    feed: (conta, limite = 20, signal) => feedDe(conta, `&limit=${encodeURIComponent(limite)}`, signal),
  };
}
