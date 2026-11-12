import * as THREE from 'three';
import { mat, rbox } from './builders.js';

function textura(w, h, desenhar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function placa(w, h, tex, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z); return m;
}
// A wall group facing the iso camera. Local x = along the screen, local +z = toward the camera.
function parede(g, x = -5, z = -5) { const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = Math.PI / 4; g.add(p); return p; }
function quadro(p, w, h, cor) { const b = rbox(w, 0.3, h, cor, 0.12); b.position.set(0, 0.12, 0); p.add(b); return b; }
const brilho = cor => mat(cor, { emissive: cor, ei: 0.6 });

export function decorar(chave, cor) {
  const g = new THREE.Group();
  const D = {
    pesquisa() {
      const p = parede(g); quadro(p, 6.6, 4.4, '#C8A27A');
      p.add(placa(6.2, 4, textura(512, 330, x => {
        x.fillStyle = '#C8A27A'; x.fillRect(0, 0, 512, 330);
        const pts = [[70, 70], [230, 50], [420, 90], [120, 230], [330, 250], [450, 270]];
        x.strokeStyle = '#D33'; x.lineWidth = 4; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke();
        for (const [a, b] of pts) { x.fillStyle = '#FFF'; x.fillRect(a - 34, b - 24, 68, 48); x.fillStyle = '#D33'; x.beginPath(); x.arc(a, b - 22, 6, 0, 7); x.fill(); }
      }), 0, 2.32, 0.18));
      const telas = parede(g, 1.5, -7.5);
      for (let i = 0; i < 6; i++) {
        const cx = -1.4 + (i % 3) * 1.4, cy = 0.4 + Math.floor(i / 3) * 2.1;
        const t = rbox(1.1, 0.15, 1.9, '#26262A', 0.06); t.position.set(cx, cy, 0); telas.add(t);
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7), brilho(cor)); s.position.set(cx, cy + 0.95, 0.09); telas.add(s);
      }
      const lupa = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 8, 24), mat('#3A3A3E')); lupa.position.set(6, 0.3, 5); lupa.rotation.x = -Math.PI / 2; g.add(lupa);
      const cabo = rbox(0.18, 0.9, 0.12, '#3A3A3E', 0.05); cabo.position.set(6.4, 0.24, 5.9); g.add(cabo);
    },
    roteiro() {
      const p = parede(g); quadro(p, 7.2, 4.6, '#FAFAF7');
      p.add(placa(6.8, 4.2, textura(512, 316, x => {
        x.fillStyle = '#FAFAF7'; x.fillRect(0, 0, 512, 316); x.font = '700 30px Manrope, sans-serif';
        [['GANCHO', '#E69393'], ['DESENVOLVIMENTO', '#5ADEB7'], ['CTA', '#BFA2E3']].forEach(([t, c], i) => { x.fillStyle = c; x.fillRect(24, 30 + i * 95, 10, 60); x.fillStyle = '#151414'; x.fillText(t, 50, 72 + i * 95); });
      }), 0, 2.42, 0.18));
      [[3.2, 3.5], [4.6, 4.4], [5.8, 3.1], [4.1, 5.6], [6.6, 5.2]].forEach(([px, pz]) => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat('#FFFFFF')); b.position.set(px, 0.42, pz); g.add(b); });
      const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 8), mat('#3A3A3E')); haste.position.set(6, 1.9, -3); g.add(haste);
      const cupula = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.8, 16, 1, true), mat(cor, { emissive: '#FFE9B0', ei: 0.5 })); cupula.position.set(6, 3.8, -3); g.add(cupula);
    },
    edicao() {
      const fundo = parede(g, -6, -6); quadro(fundo, 14, 4.4, '#F7F7F2');
      const neon = rbox(13.4, 0.22, 0.25, cor, 0.1); neon.material = mat(cor, { emissive: '#FF3366', ei: 1.4 }); neon.position.set(0, 4.3, 0.12); fundo.add(neon);
      const lados = parede(g, 0, -1); // same frame as the desk: local x along the desk
      for (const lado of [-1, 1]) {
        const pe = rbox(0.5, 0.5, 2.3, '#3A3A3E', 0.1); pe.position.set(lado * 4.4, 0.12, -0.7); lados.add(pe);
        const m = rbox(3.2, 0.14, 2, '#26262A', 0.08); m.position.set(lado * 4.4, 2.4, -0.6); lados.add(m);
        lados.add(placa(3, 1.8, textura(400, 240, x => {
          x.fillStyle = '#16171B'; x.fillRect(0, 0, 400, 240);
          ['#E69393', '#8FD3F4', '#EADC8F', '#BFA2E3'].forEach((c, i) => { for (let j = 0; j < 5; j++) { x.fillStyle = c; x.fillRect(12 + j * 78 + (i % 2) * 20, 40 + i * 46, 54 + (j % 3) * 10, 30); } });
          x.fillStyle = '#FFF'; x.fillRect(190, 20, 3, 210);
        }), lado * 4.4, 3.4, -0.52));
      }
    },
    capa() {
      const varal = parede(g);
      for (const x of [-4.2, 4.2]) { const poste = rbox(0.25, 0.25, 4.2, '#3A3A3E', 0.08); poste.position.set(x, 0.12, 0); varal.add(poste); }
      const fio = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8.4, 6), mat('#151414')); fio.rotation.z = Math.PI / 2; fio.position.set(0, 4.1, 0); varal.add(fio);
      ['#E69393', '#8FD3F4', '#EADC8F', '#5ADEB7', '#BFA2E3'].forEach((c, i) => { const capa = rbox(1.4, 0.06, 1.9, c, 0.04); capa.position.set(-3.2 + i * 1.6, 2, 0.05); varal.add(capa); });
      const prancheta = rbox(3.6, 0.2, 2.6, '#F7F7F2', 0.1); prancheta.position.set(-6, 1.6, 3); prancheta.rotation.set(-0.5, Math.PI / 4, 0); g.add(prancheta);
      const cav = rbox(0.3, 0.3, 1.6, '#3A3A3E', 0.08); cav.position.set(-6, 0.12, 3); g.add(cav);
      const imp = rbox(2.4, 1.8, 1.2, '#E5E5E0', 0.15); imp.position.set(6, 0.12, 4); g.add(imp);
      const papel = rbox(1.6, 1.2, 0.04, '#FFFFFF', 0.02); papel.position.set(6, 1.35, 4.6); g.add(papel);
    },
    postagem() {
      const p = parede(g); quadro(p, 8, 4.8, '#26262A');
      for (let i = 0; i < 8; i++) {
        const tel = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5), brilho(cor));
        tel.position.set(-2.85 + (i % 4) * 1.9, 1.35 + Math.floor(i / 4) * 2.1, 0.18); p.add(tel);
      }
      const cal = parede(g, 2.5, -8); quadro(cal, 4.4, 3.8, '#FFFFFF');
      cal.add(placa(4.2, 3.6, textura(360, 300, x => {
        x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 360, 300); x.fillStyle = cor; x.fillRect(0, 0, 360, 48);
        x.strokeStyle = '#DDD'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) x.strokeRect(10 + c * 49, 58 + r * 47, 46, 44);
        x.fillStyle = '#151414'; x.beginPath(); x.arc(10 + 3 * 49 + 23, 58 + 2 * 47 + 22, 9, 0, 7); x.fill();
      }), 0, 2.02, 0.18));
      const mastro = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), mat('#3A3A3E')); mastro.position.set(6.4, 3.6, -1); g.add(mastro);
      // own material (not the shared mat() cache): its glow changes when a post is ready
      const ponta = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: '#FF3366', emissive: '#FF3366', emissiveIntensity: 0.2 }));
      ponta.position.set(6.4, 7.3, -1); ponta.name = 'antena'; g.add(ponta);
    },
    analise() {
      const p = parede(g); quadro(p, 8, 4.6, '#F7F7F2');
      [1.2, 2.1, 1.6, 2.9, 3.6].forEach((h, i) => { const b = rbox(0.9, 0.3, h, cor, 0.08); b.position.set(-3 + i * 1.5, 0.5, 0.2); p.add(b); });
      const imp = rbox(2.4, 1.8, 1.2, '#E5E5E0', 0.15); imp.position.set(6, 0.12, 4); g.add(imp);
      const caneca = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.55, 14), mat(cor)); caneca.position.set(4.5, 0.4, 6); g.add(caneca);
    },
  };
  D[chave]?.();
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.sala = chave; } });
  return g;
}

/* ---------- furniture that fills the Oficina-sized island in front of the desk ----------
   Island-local coordinates before the room's scale (main.js ESCALA): x and z within ±6 / ±8 keep
   everything on the island once scaled. The camera looks from +x +z, so the front of the room is +x +z. */
function sofa(cor) {
  const g = new THREE.Group();
  const assento = rbox(3.6, 1.5, 0.7, cor, 0.25); assento.position.y = 0.3; g.add(assento);
  const encosto = rbox(3.6, 0.45, 1.5, cor, 0.2); encosto.position.set(0, 0.3, -0.55); g.add(encosto);
  for (const x of [-1.85, 1.85]) { const braco = rbox(0.4, 1.5, 1.1, cor, 0.15); braco.position.set(x, 0.3, 0); g.add(braco); }
  for (const x of [-1.1, 0, 1.1]) { const alm = rbox(1, 0.35, 0.8, '#ECE8DE', 0.15); alm.position.set(x, 0.95, -0.25); alm.rotation.x = -0.25; g.add(alm); }
  return g;
}
function mesaDeCentro() {
  const g = new THREE.Group();
  const tampo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 24), mat('#2B2C31')); tampo.position.y = 0.75; g.add(tampo);
  const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.75, 10), mat('#3A3A3E')); pe.position.y = 0.37; g.add(pe);
  const caneca = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.3, 12), mat('#ECE8DE')); caneca.position.set(0.3, 0.96, 0.1); g.add(caneca);
  const revista = rbox(0.7, 0.5, 0.05, '#E69393', 0.02); revista.position.set(-0.25, 0.82, -0.1); revista.rotation.y = 0.4; g.add(revista);
  return g;
}
function tapete(cor, w, d) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), mat(cor, { rough: 1 }));
  t.position.y = 0.14; t.receiveShadow = true; return t;
}
function estante(cor) {
  const g = new THREE.Group();
  const corpo = rbox(3, 0.9, 3.6, '#2B2C31', 0.1); g.add(corpo);
  const cores = [cor, '#ECE8DE', '#8FD3F4', '#EADC8F', '#BFA2E3', '#5ADEB7'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const h = 0.7 + ((i * 7 + r * 3) % 4) * 0.08;
    const livro = rbox(0.32, 0.6, h, cores[(i + r) % cores.length], 0.04); livro.position.set(-1.1 + i * 0.42, 0.25 + r * 1.15, 0.2); g.add(livro);
  }
  return g;
}
function tripeComCamera() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const perna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), mat('#3A3A3E'));
    const a = i * Math.PI * 2 / 3; perna.position.set(Math.cos(a) * 0.45, 1.2, Math.sin(a) * 0.45); perna.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(perna);
  }
  const corpo = rbox(0.9, 0.6, 0.65, '#151414', 0.1); corpo.position.y = 2.45; g.add(corpo);
  const lente = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.5, 16), mat('#26262A')); lente.rotation.x = Math.PI / 2; lente.position.set(0, 2.78, -0.5); g.add(lente);
  const rec = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat('#FF3366', { emissive: '#FF3366', ei: 2 })); rec.position.set(0.32, 3.0, 0.3); g.add(rec);
  return g;
}
function tvGrafico(cor) {
  const g = new THREE.Group();
  const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), mat('#3A3A3E')); pe.position.y = 1.1; g.add(pe);
  const base = rbox(1.4, 0.8, 0.12, '#3A3A3E', 0.05); g.add(base);
  const tela = rbox(3.6, 0.18, 2.2, '#151414', 0.08); tela.position.y = 2.1; g.add(tela);
  const img = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.9), new THREE.MeshBasicMaterial({ map: textura(330, 190, x => {
    x.fillStyle = '#16171B'; x.fillRect(0, 0, 330, 190);
    x.strokeStyle = cor; x.lineWidth = 6; x.beginPath(); [[20, 160], [80, 120], [140, 135], [200, 80], [260, 95], [310, 30]].forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 1; i < 4; i++) x.fillRect(0, i * 45, 330, 2);
  }) }));
  img.position.set(0, 3.2, 0.1); g.add(img);
  return g;
}
function caixas(cor) {
  const g = new THREE.Group();
  [[0, 0, 0, 1.4], [1.5, 0, 0.2, 1.2], [0.6, 1.0, 0.1, 1.1]].forEach(([x, y, z, s], i) => {
    const c = rbox(s, s, 0.95, i === 2 ? cor : '#C8A27A', 0.08); c.position.set(x, 0.12 + y, z); g.add(c);
  });
  return g;
}

export function mobiliar(chave, cor, extras = {}) {
  const g = new THREE.Group();
  const por = (o, x, z, ry = 0) => { o.position.x = x; o.position.z = z; if (o.position.y === 0) o.position.y = 0.12; o.rotation.y = ry; g.add(o); return o; };
  // the lounge in the front-left: rug, sofa facing the camera, coffee table
  por(tapete(cor, 6.4, 4.6), -2.8, 5.6, Math.PI / 4);
  por(sofa(cor), -3.6, 4.6, Math.PI / 4);
  por(mesaDeCentro(), -1.9, 6.4);
  // plants in the free corners and an Oficina server rack at the back-right
  por(extras.makePlant(), -5.6, 8);
  por(extras.makePlant(), 5.6, -7.6);
  if (chave !== 'postagem') por(extras.makeServerRack(cor), 5.4, -5.2, Math.PI / 4); // Postagem: the calendar wall sits there
  const P = {
    pesquisa: () => por(estante(cor), 4.2, 6.4, Math.PI / 4),
    roteiro: () => por(estante(cor), 4.6, 6.2, Math.PI / 4),
    edicao: () => por(tripeComCamera(), 4, 6.2, Math.PI / 4),
    capa: () => por(caixas(cor), 2.6, 6.6),
    postagem: () => por(caixas(cor), 1.2, 7.2),
    analise: () => por(tvGrafico(cor), 3.2, 6.2, Math.PI / 4),
  };
  P[chave]?.();
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.sala = chave; } });
  return g;
}
