// Higgsfield API client (the student's own key, "ID:SECRET"). Docs: docs.higgsfield.ai
// Upload: POST /files/generate-upload-url → PUT upload_url with upload_headers → public_url.
// Generate: POST /alibaba/qwen-image-3/edit → poll status_url until completed (images[].url).
import fs from 'node:fs';
import path from 'node:path';

export const baseHiggsfield = () => process.env.OFC_HIGGSFIELD_URL || 'https://api.higgsfield.ai';
const TIPOS = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const erroDoStatus = status => (status === 401 || status === 403 ? 'A chave do Higgsfield não funcionou.'
  : status === 402 ? 'Acabaram os créditos do Higgsfield.' : 'O Higgsfield não conseguiu gerar a capa.');

const esperarMs = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason || new Error('Parado.'));
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason || new Error('Parado.')); }, { once: true });
});

// No answer at all (offline, DNS, timeout) is not a bad key: it gets its own code.
function semConexao() { const e = new Error('Não consegui falar com o Higgsfield.'); e.code = 'SEM_CONEXAO'; return e; }

export function criarHiggsfield({ chave, base = baseHiggsfield(), fetch = globalThis.fetch, tempoTesteMs = 15000 }) {
  const auth = { authorization: `Key ${chave}` };
  async function api(caminho, corpo, signal) {
    let r;
    try { r = await fetch(base + caminho, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal }); }
    catch (e) { if (signal?.aborted && signal.reason?.name !== 'TimeoutError') throw e; throw semConexao(); }
    if (!r.ok) throw new Error(erroDoStatus(r.status));
    return r.json();
  }
  return {
    // Asking for an upload URL is free: it is how the key gets checked.
    testar: () => api('/files/generate-upload-url', { content_type: 'image/jpeg' }, AbortSignal.timeout(tempoTesteMs)),
    async subirImagem(arquivo, contentType, signal) {
      const u = await api('/files/generate-upload-url', { content_type: contentType }, signal);
      // The presigned URL never gets the Higgsfield credentials.
      const r = await fetch(u.upload_url, { method: 'PUT', headers: u.upload_headers || { 'Content-Type': contentType }, body: fs.readFileSync(arquivo), signal });
      if (!r.ok) throw new Error('Não consegui mandar a imagem pro Higgsfield.');
      return u.public_url;
    },
    gerarCapa: ({ prompt, imagemUrl, proporcao }, signal) =>
      api('/alibaba/qwen-image-3/edit', { prompt, image_urls: [imagemUrl], aspect_ratio: proporcao, resolution: '2k' }, signal),
    async esperar(statusUrl, { intervaloMs = 3000, limiteMs = 180000, signal } = {}) {
      const fim = Date.now() + limiteMs;
      while (Date.now() < fim) {
        const r = await fetch(statusUrl, { headers: auth, signal });
        if (!r.ok) throw new Error(erroDoStatus(r.status));
        const s = await r.json();
        if (s.status === 'completed' && s.images?.[0]?.url) return s.images[0].url;
        if (s.status === 'nsfw') throw new Error('O Higgsfield recusou a imagem.');
        if (['failed', 'canceled', 'completed'].includes(s.status)) throw new Error('O Higgsfield não conseguiu gerar a capa.');
        await esperarMs(intervaloMs, signal);
      }
      throw new Error('O Higgsfield não conseguiu gerar a capa.');
    },
    async baixar(url, destino, signal) {
      const r = await fetch(url, { signal });
      if (!r.ok) throw new Error('Não consegui baixar a capa do Higgsfield.');
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
      return destino;
    },
  };
}

export async function gerarCapaIA({ chave, frame, prompt, proporcao, destino, signal, base = baseHiggsfield(), intervaloMs, fetch }) {
  const hf = criarHiggsfield({ chave, base, ...(fetch ? { fetch } : {}) });
  const imagemUrl = await hf.subirImagem(frame, TIPOS[path.extname(frame).toLowerCase()] || 'image/jpeg', signal);
  const pedido = await hf.gerarCapa({ prompt, imagemUrl, proporcao }, signal);
  const url = await hf.esperar(pedido.status_url, { signal, ...(intervaloMs ? { intervaloMs } : {}) });
  return hf.baixar(url, destino, signal);
}
