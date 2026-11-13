// Test fixture: a local stand-in for the Post for Me API. Never touches the network.
// modo: 'ok' (every network posts fine), 'falha-youtube' (spc_yt fails with "Video too short"),
//       'processando' (no results yet), 'sem-feed' (the feed has nothing).
// `chamadas` records every request (metodo, caminho with query, comAutorizacao, cabecalhos, corpo) so tests
// can assert what was NOT called. `posts` holds the body of every POST /v1/social-posts (post n is "sp_<n>").
import http from 'node:http';

export const CHAVE_PFM = 'pfm_chave_de_teste_123';

const CONTAS = [
  { id: 'spc_tt', platform: 'tiktok', username: '@teste', status: 'connected' },
  { id: 'spc_yt', platform: 'youtube', username: 'Teste', status: 'connected' },
  { id: 'spc_ig', platform: 'instagram', username: '@teste', status: 'connected' },
];
const METRICAS = {
  tiktok: { view_count: 1000, like_count: 50, comment_count: 5, share_count: 3 },
  youtube: { views: 400, likes: 20, comments: 2, shares: 1 },
  instagram: { views: 800, likes: 60, comments: 4, shares: 2, saved: 9 },
};

export async function iniciarPostForMeFalso({ modo = 'ok' } = {}) {
  const chamadas = [];
  const posts = [];
  const apagados = new Set();
  let base;
  const idDoPost = i => `sp_${i + 1}`;
  const server = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', c => { corpo += c; });
    req.on('end', () => {
      chamadas.push({ metodo: req.method, caminho: req.url, comAutorizacao: req.headers.authorization !== undefined, cabecalhos: req.headers, corpo });
      const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      // The presigned upload URL takes no credentials, like the real one.
      if (req.method === 'PUT' && p.startsWith('/upload/')) { res.writeHead(200); return res.end(); }
      if (req.headers.authorization !== `Bearer ${CHAVE_PFM}`) return json(401, { message: 'Unauthorized' });

      if (req.method === 'GET' && p === '/v1/social-accounts') {
        const limite = Number(url.searchParams.get('limit')) || 100;
        const data = CONTAS.slice(0, limite);
        return json(200, { data, meta: { total: CONTAS.length, offset: 0, limit: limite } });
      }
      if (req.method === 'POST' && p === '/v1/media/create-upload-url') {
        const n = chamadas.filter(c => c.metodo === 'POST' && c.caminho === '/v1/media/create-upload-url').length;
        return json(200, { upload_url: `${base}/upload/${n}`, media_url: `${base}/media/${n}` });
      }
      if (req.method === 'POST' && p === '/v1/social-posts') {
        let dados; try { dados = JSON.parse(corpo); } catch { return json(400, { error: ['invalid json'] }); }
        posts.push(dados);
        return json(200, { id: idDoPost(posts.length - 1), status: dados.scheduled_at ? 'scheduled' : 'processing' });
      }
      if (req.method === 'GET' && p === '/v1/social-posts') {
        const externo = url.searchParams.get('external_id');
        const data = posts.map((dados, i) => ({ dados, id: idDoPost(i) }))
          .filter(x => !apagados.has(x.id) && x.dados.external_id === externo)
          .map(x => ({ id: x.id, status: x.dados.scheduled_at ? 'scheduled' : 'processing', external_id: externo }));
        return json(200, { data, meta: { total: data.length } });
      }
      const mpost = p.match(/^\/v1\/social-posts\/([^/]+)$/);
      if (req.method === 'DELETE' && mpost) { apagados.add(mpost[1]); return json(200, { success: true }); }
      if (req.method === 'GET' && p === '/v1/social-post-results') {
        const idPost = url.searchParams.get('post_id');
        const i = posts.findIndex((_, k) => idDoPost(k) === idPost);
        if (i < 0 || modo === 'processando') return json(200, { data: [], meta: { total: 0 } });
        const data = (posts[i].social_accounts || []).map(conta => {
          if (modo === 'falha-youtube' && conta === 'spc_yt') return { id: `res_${conta}_${idPost}`, post_id: idPost, social_account_id: conta, success: false, error: 'Video too short', platform_data: null };
          return { id: `res_${conta}_${idPost}`, post_id: idPost, social_account_id: conta, success: true, error: null, platform_data: { id: `rede_${conta}_${idPost}`, url: `https://exemplo.com/${conta}/${idPost}` } };
        });
        return json(200, { data, meta: { total: data.length } });
      }
      const mfeed = p.match(/^\/v1\/social-account-feeds\/([^/]+)$/);
      if (req.method === 'GET' && mfeed) {
        const conta = decodeURIComponent(mfeed[1]);
        const dono = CONTAS.find(c => c.id === conta);
        if (!dono) return json(404, { message: 'Account not found' });
        if (modo === 'sem-feed') return json(200, { data: [], meta: { total: 0 } });
        let itens = posts.map((dados, i) => ({ dados, id: idDoPost(i) }))
          .filter(x => !apagados.has(x.id) && (x.dados.social_accounts || []).includes(conta))
          .reverse()
          .map(x => ({ platform_post_id: `rede_${conta}_${x.id}`, platform_url: `https://exemplo.com/${conta}/${x.id}`, caption: x.dados.caption ?? '', posted_at: new Date().toISOString(), metrics: { ...METRICAS[dono.platform] } }));
        const idRede = url.searchParams.get('platform_post_id');
        if (idRede) itens = itens.filter(x => x.platform_post_id === idRede);
        const limite = Number(url.searchParams.get('limit'));
        if (limite) itens = itens.slice(0, limite);
        return json(200, { data: itens, meta: { total: itens.length } });
      }
      json(404, { message: 'Not found' });
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  return { base, chamadas, posts, fechar: () => new Promise(r => { server.close(r); server.closeAllConnections?.(); }) };
}
