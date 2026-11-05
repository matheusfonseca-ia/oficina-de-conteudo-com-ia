import * as THREE from 'three';
import { mat, rbox, makePlinth, makeDesk, makeChair, makeRobot, poseWork, makeNeuralBrain, makeWalkway, makeWarnSprite } from './builders.js';
import { LAYOUT, ORDEM, CORES, ROBOS } from './layout.js';
import { criarTela } from './tela.js';
import { decorar } from './decor.js';

/* ---------- renderer / camera: same iso rig as the Oficina (main.js lines 24–71 there) ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
const scene = new THREE.Scene();
const FR = 42, CAM_DIST = 220;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
const ISO = new THREE.Vector3(1, 0.92, 1).normalize();
const PAINEL_LARGURA = () => (document.body.classList.contains('limpo') ? 0 : 420);
const view = { target: new THREE.Vector3(-6, 0, -6), zoom: 0.8 };
function enquadrar() {
  const xs = Object.values(LAYOUT).flatMap(L => [-1, 1].flatMap(sx => [-1, 1].map(sz => ((L.pos[0] + sx * L.w / 2) - (L.pos[1] + sz * L.d / 2)) / Math.SQRT2)));
  const largura = Math.max(...xs) - Math.min(...xs);
  view.zoom = Math.max(0.3, Math.min(0.8, (innerWidth - PAINEL_LARGURA() - 360) * (2 * FR) / (largura * innerHeight)));
  const ppw = view.zoom * innerHeight / (2 * FR), sh = (PAINEL_LARGURA() / 2) / ppw;
  const SR = new THREE.Vector3(1, 0, -1).normalize();
  view.target.set(-6 + SR.x * sh, 0, -6 + SR.z * sh);
}
function aplicarCamera() {
  const aspect = innerWidth / innerHeight;
  Object.assign(camera, { left: -FR * aspect, right: FR * aspect, top: FR, bottom: -FR, zoom: view.zoom });
  camera.position.copy(view.target).addScaledVector(ISO, CAM_DIST); camera.lookAt(view.target); camera.updateProjectionMatrix();
}

/* ---------- lights + shadow catcher (Oficina main.js lines 106–129) ---------- */
scene.add(new THREE.HemisphereLight(0xfdfff8, 0xd8d4c8, 0.85));
const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
key.position.set(-60, 90, 20); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, far: 400 });
key.shadow.radius = 7; key.shadow.blurSamples = 12; key.shadow.bias = -0.0004; scene.add(key);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: 0.13 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -7; ground.receiveShadow = true; scene.add(ground);

/* ---------- islands ---------- */
const alvosClique = [];
const ilhas = {};
for (const [k, L] of Object.entries(LAYOUT)) {
  const g = new THREE.Group(); g.position.set(L.pos[0], 0, L.pos[1]);
  const plinto = makePlinth(L.w, L.d, CORES[k].piso);
  plinto.traverse(o => { if (o.isMesh) { o.userData.sala = k; alvosClique.push(o); } });
  g.add(plinto); scene.add(g); ilhas[k] = { grupo: g, L };
}
const cerebro = makeNeuralBrain(); cerebro.group.position.y = 7; ilhas.cerebro.grupo.add(cerebro.group);

/* ---------- walkways: one spoke to the Brain per room + the clockwise ring ---------- */
function bordas(A, B) {
  const dx = B.pos[0] - A.pos[0], dz = B.pos[1] - A.pos[1];
  const t = (w, d) => 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dz) / (d / 2));
  const ta = t(A.w - 2, A.d - 2), tb = t(B.w - 2, B.d - 2);
  return [[A.pos[0] + dx * ta, A.pos[1] + dz * ta], [B.pos[0] - dx * tb, B.pos[1] - dz * tb]];
}
const anel = []; // anel[i] = { de, para, a:[x,z], b:[x,z] } from ORDEM[i] to ORDEM[i+1]
for (const k of ORDEM) { const [a, b] = bordas(LAYOUT[k], LAYOUT.cerebro); scene.add(makeWalkway(a, b)); }
ORDEM.forEach((k, i) => {
  const prox = ORDEM[(i + 1) % ORDEM.length];
  const [a, b] = bordas(LAYOUT[k], LAYOUT[prox]);
  scene.add(makeWalkway(a, b)); anel.push({ de: k, para: prox, a, b });
});

/* ---------- one desk + one robot per room ---------- */
const ANG = Math.PI / 4, FACE_CAM = Math.PI / 4;
const rot = v => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), ANG);
const salas = {};
for (const k of ORDEM) {
  const L = LAYOUT[k], cor = CORES[k];
  const base = new THREE.Vector3(L.pos[0], 0.12, L.pos[1] - 1);
  const estacao = new THREE.Group(); estacao.position.copy(base); estacao.rotation.y = ANG;
  const tela = criarTela(cor.chip);
  const { group: mesa } = makeDesk(cor.chip, { tex: tela.tex, canvas: tela.canvas });
  estacao.add(mesa); const cadeira = makeChair(); cadeira.position.set(0, 0, 1.75); estacao.add(cadeira);
  if (k === 'edicao') estacao.scale.setScalar(1.15);
  scene.add(estacao);
  const robo = makeRobot({ ...ROBOS[k], chip: cor.chip, ink: cor.ink, lead: true });
  const assento = base.clone().add(rot(new THREE.Vector3(0, 0, 1.7)));
  robo.position.copy(assento); robo.rotation.y = ANG + Math.PI;
  robo.traverse(o => { if (o.isMesh) { o.userData.sala = k; alvosClique.push(o); } });
  scene.add(robo);
  const aviso = makeWarnSprite(); aviso.visible = false; aviso.position.copy(assento).add(new THREE.Vector3(0, 6.2, 0)); scene.add(aviso);
  salas[k] = { grupo: ilhas[k].grupo, robo, tela, aviso, estacao, assento, pe: assento.clone().add(rot(new THREE.Vector3(1.5, 0, 0.15))),
    centro: new THREE.Vector3(L.pos[0], 0, L.pos[1]), estado: 'ocioso', bob: Math.random() * 10 };
  const enfeite = decorar(k, cor.chip); ilhas[k].grupo.add(enfeite); salas[k].decor = enfeite;
}

/* ---------- picking ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
const ouvintesClique = [];
canvas.addEventListener('click', e => {
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(alvosClique, false)[0];
  if (hit?.object.userData.sala) ouvintesClique.forEach(f => f(hit.object.userData.sala));
});

/* ---------- pose by state (Oficina poses: type · wave · slump · sip) ---------- */
const POSE = { trabalhando: 'type', esperando: 'wave', problema: 'slump', ocioso: 'sip', inativa: 'read' };
function posar(s, agora, dt) {
  poseWork(s.robo, POSE[s.estado] || 'read', agora + s.bob * 500, dt);
  const sk = s.robo.userData.cur?.standK || 0;
  s.robo.position.x = s.assento.x + (s.pe.x - s.assento.x) * sk;
  s.robo.position.z = s.assento.z + (s.pe.z - s.assento.z) * sk;
  const alvo = s.estado === 'esperando' ? FACE_CAM : ANG + Math.PI;
  let d = alvo - s.robo.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  s.robo.rotation.y += d * (1 - Math.exp(-dt * 6));
  s.aviso.visible = s.estado === 'problema';
  if (s.aviso.visible) s.aviso.position.y = 6.2 + Math.sin(agora / 300) * 0.25;
}

const v3 = new THREE.Vector3();
const toScreen = p => { v3.copy(p).project(camera); return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight]; };
const ticks = [];
window.ESC = { salas, cena: scene, camera, toScreen, anel, ilhas, aoClicarSala: f => ouvintesClique.push(f), aoTick: f => ticks.push(f), enquadrar };

function redimensionar() { renderer.setSize(innerWidth, innerHeight, false); enquadrar(); }
addEventListener('resize', redimensionar); redimensionar();
let ultimo = performance.now();
function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
  aplicarCamera();
  cerebro.tick(agora, dt, null, 0);
  for (const s of Object.values(salas)) posar(s, agora, dt);
  for (const f of ticks) f(agora, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
import('./painel.js').then(m => m.iniciarPainel(window.ESC)).catch(e => console.error(e));
