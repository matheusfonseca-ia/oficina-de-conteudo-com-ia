// Test fixture: a local stand-in for the Higgsfield API. Never touches the network.
// modo: 'ok' (completes), 'failed', 'nsfw', 'sem-credito' (402 on generate).
import http from 'node:http';

const PNG_1X1 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a1c40000000049454e44ae426082', 'hex');
export const CHAVE_CERTA = 'a:b';

export async function iniciarHiggsfieldFalso({ modo = 'ok' } = {}) {
  const chamadas = [];
  const consultas = new Map();
  let base;
  const server = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', c => { corpo += c; });
    req.on('end', () => {
      chamadas.push({ metodo: req.method, caminho: req.url, cabecalhos: req.headers, corpo });
      const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const autorizado = req.headers.authorization === `Key ${CHAVE_CERTA}`;
      if (req.method === 'POST' && req.url === '/files/generate-upload-url') {
        if (!autorizado) return json(401, { detail: 'unauthorized' });
        const id = chamadas.length;
        return json(200, { public_url: `${base}/publico/${id}.jpg`, upload_url: `${base}/upload/${id}`, content_type: 'image/jpeg', upload_headers: { 'Content-Type': 'image/jpeg', 'x-amz-tagging': 'a=b' } });
      }
      if (req.method === 'PUT' && req.url.startsWith('/upload/')) { res.writeHead(200); return res.end(); }
      if (req.method === 'POST' && req.url === '/alibaba/qwen-image-3/edit') {
        if (!autorizado) return json(401, { detail: 'unauthorized' });
        if (modo === 'sem-credito') return json(402, { detail: 'not enough credits' });
        const id = 'r' + chamadas.length;
        consultas.set(id, 0);
        return json(200, { status: 'queued', request_id: id, status_url: `${base}/requests/${id}/status`, cancel_url: `${base}/requests/${id}/cancel` });
      }
      const m = req.url.match(/^\/requests\/([^/]+)\/status$/);
      if (req.method === 'GET' && m) {
        const n = (consultas.get(m[1]) ?? 0) + 1; consultas.set(m[1], n);
        if (n === 1) return json(200, { status: 'in_progress', request_id: m[1] });
        if (modo === 'failed') return json(200, { status: 'failed', request_id: m[1], error: 'boom' });
        if (modo === 'nsfw') return json(200, { status: 'nsfw', request_id: m[1] });
        return json(200, { status: 'completed', request_id: m[1], images: [{ url: `${base}/img.png` }] });
      }
      if (req.method === 'GET' && req.url === '/img.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG_1X1); }
      json(404, { detail: 'not found' });
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  return { base, chamadas, fechar: () => new Promise(r => server.close(r)) };
}
