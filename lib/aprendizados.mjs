// Each "Pedir ajuste" in a room becomes one dated line in cerebro/aprendizados/<sala>.md.
// The room's prompt reads the last lines next time, as the owner's taste.
import fs from 'node:fs';
import path from 'node:path';

export const SALAS_QUE_APRENDEM = ['pesquisa', 'roteiro', 'postagem'];
const arquivo = (cerebroDir, sala) => path.join(cerebroDir, 'aprendizados', `${sala}.md`);

export function registrarAprendizado(cerebroDir, sala, texto, agora = new Date()) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!t || !SALAS_QUE_APRENDEM.includes(sala)) return false;
  fs.mkdirSync(path.dirname(arquivo(cerebroDir, sala)), { recursive: true });
  fs.appendFileSync(arquivo(cerebroDir, sala), `- ${agora.toISOString().slice(0, 10)}: ${t}\n`);
  return true;
}

export function lerAprendizados(cerebroDir, sala, max = 15) {
  let s; try { s = fs.readFileSync(arquivo(cerebroDir, sala), 'utf8'); } catch { return ''; }
  return s.split('\n').filter(l => l.startsWith('- ')).slice(-max).join('\n');
}
