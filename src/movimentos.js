// Pure helper: which package moves to animate between two polls.
// `ultima` (Map id -> last real room) is updated in place; ids no longer in `videos` are pruned.
// Pseudo-rooms (not in `salasReais`, e.g. 'gravacao', 'fim') never move a package and don't change `ultima`.
export function calcularMovimentos(ultima, videos, salaDaEtapa, salasReais) {
  const moves = [], vivos = new Set();
  for (const v of videos) {
    vivos.add(v.id);
    const agora = salaDaEtapa(v.etapa);
    if (!salasReais.includes(agora)) continue;
    const antes = ultima.get(v.id);
    if (antes && antes !== agora) moves.push({ id: v.id, de: antes, para: agora });
    ultima.set(v.id, agora);
  }
  for (const id of [...ultima.keys()]) if (!vivos.has(id)) ultima.delete(id);
  return moves;
}
