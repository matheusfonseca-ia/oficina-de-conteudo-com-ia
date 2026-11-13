const H = { 'x-oficina': '1', 'content-type': 'application/json' };
async function ler(r) { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.erro || `Erro ${r.status}`); return b; }
const arquivo = (caminho, file) => fetch(caminho, { method: 'POST', headers: { 'x-oficina': '1', 'content-type': 'application/octet-stream', 'x-nome-arquivo': encodeURIComponent(file.name) }, body: file }).then(ler);
export const api = {
  estado: () => fetch('/api/estado', { cache: 'no-store' }).then(ler),
  get: caminho => fetch(caminho, { cache: 'no-store' }).then(ler),
  post: (caminho, corpo = {}) => fetch(caminho, { method: 'POST', headers: H, body: JSON.stringify(corpo) }).then(ler),
  del: caminho => fetch(caminho, { method: 'DELETE', headers: H }).then(ler),
  upload: file => arquivo('/api/upload', file),
  uploadBruto: (id, file) => arquivo(`/api/videos/${encodeURIComponent(id)}/bruto`, file),
};
