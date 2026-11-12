import * as THREE from 'three';
import { rbox } from './builders.js';
// A small clapperboard-like package that walks from one room to the next along the walkways:
// out of the room, across to the Brain, and in through the next room's walkway (the Oficina has no ring).
export function criarPacotes(ESC) {
  const vivos = [], filas = {};
  const novo = () => { const g = new THREE.Group(); const c = rbox(1.4, 1, 0.9, '#151414', 0.12); g.add(c); const t = rbox(1.4, 0.2, 0.25, '#F7F7F2', 0.06); t.position.y = 0.95; g.add(t); ESC.cena.add(g); return g; };
  function rota(de, para) {
    const a = ESC.portas[de], b = ESC.portas[para];
    if (!a || !b) return [];
    return [a.porta, a.cerebro, b.cerebro, b.porta].map(([x, z]) => new THREE.Vector3(x, 0.4, z));
  }
  return {
    aoMudar(id, de, para) {
      const pts = rota(de, para); if (pts.length < 2) return;
      vivos.push({ g: novo(), pts, t: 0, dur: 3.2 });
    },
    fila(sala, n) { // packages waiting at the room's door
      filas[sala] = filas[sala] || [];
      while (filas[sala].length < n) filas[sala].push(novo());
      while (filas[sala].length > n) ESC.cena.remove(filas[sala].pop());
      const c = ESC.salas[sala].centro, L = ESC.ilhas[sala].L;
      filas[sala].forEach((g, i) => g.position.set(c.x + L.w / 2 - 1.5, 0.12 + i * 1.05, c.z + L.d / 2 - 1.5));
    },
    tick(agora, dt) {
      for (let i = vivos.length - 1; i >= 0; i--) {
        const p = vivos[i]; p.t += dt / p.dur;
        if (p.t >= 1) { ESC.cena.remove(p.g); vivos.splice(i, 1); continue; }
        const f = p.t * (p.pts.length - 1), k = Math.floor(f);
        p.g.position.lerpVectors(p.pts[k], p.pts[Math.min(k + 1, p.pts.length - 1)], f - k);
        p.g.position.y = 0.4 + Math.abs(Math.sin(agora / 120)) * 0.35;
      }
    },
  };
}
