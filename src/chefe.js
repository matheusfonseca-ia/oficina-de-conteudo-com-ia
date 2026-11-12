import * as THREE from 'three';
import { mat, PLINTH_H } from './builders.js';

// The centre of the office: a round island under a neural-network dome, with the boss's desk in the middle.
// The dome takes the place of the Oficina's floating globe; its colours run the way the globe paints them
// (hue = 230° + the angle around the centre), and the island's LED ring wears the same wheel.

const hsl = (h, l = 0.6) => new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, l);
const matiz = (x, z) => 230 / 360 + Math.atan2(z, x) / (Math.PI * 2);

export function makeIlhaRedonda(R, floorColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, PLINTH_H, 96), mat('#F7F7F2'));
  body.position.y = -PLINTH_H / 2; body.castShadow = true; body.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.35, R - 0.35, 0.12, 96), mat(floorColor));
  floor.position.y = 0.06; floor.receiveShadow = true;
  g.add(body, floor); // children[0] = plinth, children[1] = floor, like makePlinth (main.js tags them for dark mode)
  return g;
}

// The LED strip round the island's lip, the whole colour wheel (dark mode, like leds.js does for the Brain).
export function makeAnelLed(R) {
  const g = new THREE.Group();
  const faixa = (r0, r1, opacidade, aditivo) => {
    const geo = new THREE.RingGeometry(r0, r1, 192, 1);
    geo.rotateX(-Math.PI / 2);
    const p = geo.getAttribute('position'), cores = [];
    for (let i = 0; i < p.count; i++) { const c = hsl(matiz(p.getX(i), p.getZ(i))); cores.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: opacidade, depthWrite: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, toneMapped: false }));
  };
  const fio = faixa(R - 0.3, R - 0.06, 1, false); fio.position.y = 0.135;
  const brilho = faixa(R - 1.6, R - 0.06, 0.28, true); brilho.position.y = 0.13;
  g.add(brilho, fio);
  return {
    grupo: g,
    nivel: 1,
    tick(dt, apagado) { // fades like the other islands' strips when a room has the focus
      this.nivel += ((apagado ? 0.14 : 1) - this.nivel) * (1 - Math.exp(-dt * 5));
      fio.material.opacity = this.nivel; brilho.material.opacity = 0.28 * this.nivel;
    },
  };
}

// A geodesic half-sphere of lines and nodes over the whole island.
export function makeDomo(R) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(R, 4);
  const pos = geo.getAttribute('position');
  const pontos = [], porChave = new Map(), idx = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let j = porChave.get(k);
    if (j == null) { j = pontos.length; pontos.push(new THREE.Vector3(x, y, z)); porChave.set(k, j); }
    idx.push(j);
  }
  const arestas = new Set(), lin = [], linCor = [];
  const cor = v => hsl(matiz(v.x, v.z), 0.55 + 0.1 * (v.y / R));
  for (let i = 0; i < idx.length; i += 3) for (let a = 0; a < 3; a++) {
    const p = idx[i + a], q = idx[i + (a + 1) % 3];
    const k = p < q ? `${p}:${q}` : `${q}:${p}`;
    if (arestas.has(k)) continue; arestas.add(k);
    const A = pontos[p], B = pontos[q];
    if (A.y < -0.01 || B.y < -0.01) continue; // only the top half
    lin.push(A.x, A.y, A.z, B.x, B.y, B.z);
    const ca = cor(A), cb = cor(B); linCor.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
  }
  // the rim where the dome meets the floor
  for (let i = 0; i < 128; i++) {
    const a0 = i / 128 * Math.PI * 2, a1 = (i + 1) / 128 * Math.PI * 2;
    const A = new THREE.Vector3(Math.cos(a0) * R, 0, Math.sin(a0) * R), B = new THREE.Vector3(Math.cos(a1) * R, 0, Math.sin(a1) * R);
    lin.push(A.x, 0, A.z, B.x, 0, B.z); const ca = cor(A), cb = cor(B); linCor.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lin, 3));
  lg.setAttribute('color', new THREE.Float32BufferAttribute(linCor, 3));
  const linhas = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }));
  const topo = pontos.filter(v => v.y >= -0.01);
  const pg = new THREE.BufferGeometry().setFromPoints(topo);
  pg.setAttribute('color', new THREE.Float32BufferAttribute(topo.flatMap(v => { const c = cor(v); return [c.r, c.g, c.b]; }), 3));
  const nos = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
  // a faint glass shell so the dome reads as a volume, not just a wire cage
  const vidro = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#8EA2FF', transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide }));
  const rede = new THREE.Group(); rede.add(linhas, nos);
  g.add(vidro, rede);
  g.renderOrder = 3; linhas.renderOrder = 3; nos.renderOrder = 4;
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)');
  return {
    grupo: g,
    nivel: 1,
    tick(agora, dt, apagado) {
      if (!reduzir.matches) rede.rotation.y = agora * 0.00004;
      this.nivel += ((apagado ? 0.25 : 1) - this.nivel) * (1 - Math.exp(-dt * 5));
      const pulso = reduzir.matches ? 1 : 0.85 + 0.15 * Math.sin(agora / 900);
      linhas.material.opacity = 0.42 * this.nivel * pulso;
      nos.material.opacity = 0.9 * this.nivel;
      vidro.material.opacity = 0.045 * this.nivel;
    },
  };
}
