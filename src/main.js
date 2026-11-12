import * as THREE from 'three';
import { makePlinth, makeDesk, makeChair, makeRobot, poseWork, makeWalkway, makeWarnSprite, PLINTH_H } from './builders.js';
import { LAYOUT, ORDEM, CORES, ROBOS, LADO_PLACA } from './layout.js';
import { criarTela } from './tela.js';
import { decorar } from './decor.js';
import { initLeds } from './leds.js';
import { createGlobe, drawGlobe } from './neural-globe.js';
import { BRAIN } from './braingraph.js';

// The scene, camera, zoom and focus are the Oficina's (projetos/agents-office/src/main.js), trimmed to
// six rooms with one desk each. The Escritório only runs in the Oficina's dark mode.
const DEPTS = Object.fromEntries(Object.entries(CORES).map(([k, c]) => [k, { chip: c.chip, ink: c.ink, floor: c.piso, led: c.led }]));
const PAINEL = () => (document.body.classList.contains('limpo') ? 0 : 400 + 30); // tasks.panelWidth() + 30 there

/* ---------- renderer / scene / camera (Oficina main.js 24–107) ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();

const FR = 42; // frustum half-height at zoom 1
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
const ISO = new THREE.Vector3(1, 0.92, 1).normalize();
const CAM_DIST = 220;
// Centre the office beside the panel and fit all island edges into that space.
const OVERVIEW = { base: [-9, 0, -9], zoom: 0.8 }; // (-9,-9) shifts the scene straight DOWN the screen, no sideways drift
const SR_ = new THREE.Vector3(1, 0, -1).normalize();
const overviewXs = Object.values(LAYOUT).flatMap(L => [-1, 1].flatMap(x => [-1, 1].map(z =>
  ((L.pos[0] + x * L.w / 2) - (L.pos[1] + z * L.d / 2)) / Math.SQRT2)));
const overviewWidth = Math.max(...overviewXs) - Math.min(...overviewXs);
function overviewZoom() {
  const panel = PAINEL();
  // Side margins leave room for the front room cards and island shadows.
  const fit = (innerWidth - panel - 440) * (2 * FR) / (overviewWidth * innerHeight);
  return Math.max(0.3, Math.min(OVERVIEW.zoom, fit));
}
function overviewPos() {
  const pw = PAINEL();
  const ppw = overviewZoom() * innerHeight / (2 * FR);
  const sh = (pw / 2) / ppw;
  return [OVERVIEW.base[0] + SR_.x * sh, 0, OVERVIEW.base[2] + SR_.z * sh];
}
const view = { target: new THREE.Vector3(...overviewPos()), zoom: overviewZoom(), arc: 0 };
let tween = null;
const UPV = new THREE.Vector3(0, 1, 0);
const isoWork = new THREE.Vector3();

function applyCamera() {
  const aspect = innerWidth / innerHeight;
  camera.left = -FR * aspect; camera.right = FR * aspect;
  camera.top = FR; camera.bottom = -FR;
  camera.zoom = view.zoom;
  isoWork.copy(ISO);
  if (view.arc) isoWork.applyAxisAngle(UPV, view.arc); // cinematic swing-in, settles back to locked iso
  camera.position.copy(view.target).addScaledVector(isoWork, CAM_DIST);
  camera.lookAt(view.target);
  camera.updateProjectionMatrix();
}

// house easing cubic-bezier(0.2, 0.8, 0.2, 1)
function bezier(t) {
  const cx = 3 * 0.2, bx = 3 * (0.2 - 0.2) - cx, ax = 1 - cx - bx;
  const cy = 3 * 0.8, by = 3 * (1 - 0.8) - cy, ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 5; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  return ((ay * u + by) * u + cy) * u;
}

function flyTo(targetPos, zoom, dur = 800, opts = {}) {
  tween = {
    t0: performance.now(), dur,
    fromT: view.target.clone(), toT: new THREE.Vector3(...targetPos),
    fromZ: view.zoom, toZ: zoom,
    arc: opts.arc || 0, onDone: opts.onDone,
  };
}
function tickTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = bezier(k);
  view.target.lerpVectors(tween.fromT, tween.toT, e);
  view.zoom = tween.fromZ + (tween.toZ - tween.fromZ) * e;
  view.arc = Math.sin(e * Math.PI) * tween.arc;
  if (k >= 1) {
    const cb = tween.onDone;
    view.arc = 0; tween = null;
    if (cb) cb();
  }
}

/* ---------- lights (Oficina main.js 108–129, then setDark(true) below) ---------- */
const hemi = new THREE.HemisphereLight(0xfdfff8, 0xd8d4c8, 0.85);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
key.position.set(-60, 90, 20);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -95; key.shadow.camera.right = 95;
key.shadow.camera.top = 95; key.shadow.camera.bottom = -95;
key.shadow.camera.far = 400;
key.shadow.radius = 7; key.shadow.blurSamples = 12;
key.shadow.bias = -0.0004;
scene.add(key);

// shadow catcher — makes the pods float over the page
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.ShadowMaterial({ opacity: 0.13 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -7;
ground.receiveShadow = true;
scene.add(ground);

/* ---------- islands (Oficina main.js 140–152) ---------- */
const hud = document.getElementById('hud');
const clickTargets = []; // plinth meshes -> room key
const ilhas = {};
for (const [k, L] of Object.entries(LAYOUT)) {
  const g = new THREE.Group();
  g.position.set(L.pos[0], 0, L.pos[1]);
  const plinth = makePlinth(L.w, L.d, DEPTS[k].floor);
  g.add(plinth);
  plinth.traverse(o => { if (o.isMesh) { o.userData.dept = k; o.userData.sala = k; clickTargets.push(o); } });
  plinth.children[0].userData.part = 'plinth'; plinth.children[1].userData.part = 'floor'; // dark mode re-tints these
  scene.add(g);
  ilhas[k] = { grupo: g, L };
}

/* ---------- the Brain: the Oficina's floating neural globe (brain.js 50–94), no vault behind it ---------- */
const cerebro = (() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const BW = 17.5, PX = 1024, PY = PX, GLOBE_RADIUS = PX * 0.405;
  const CENTRE = new THREE.Vector3(0.6, 6.2, 0.6);
  const nodes = BRAIN.nodes.map((n, i) => ({ ...n, i }));
  const links = BRAIN.links.map(([a, b]) => [a, b]);
  const globe = createGlobe(nodes);
  let officeYaw = 0, nextPaint = 0;
  const cv = document.createElement('canvas'); cv.width = PX; cv.height = PY;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const board = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  board.scale.set(BW, BW, 1); board.position.copy(CENTRE); board.renderOrder = 4;
  board.userData.dept = 'brainCore';
  ilhas.cerebro.grupo.add(board);
  function paintGlobe(now = performance.now()) {
    ctx.clearRect(0, 0, PX, PY);
    drawGlobe(ctx, { cx: PX / 2, cy: PY / 2, radius: GLOBE_RADIUS, yaw: officeYaw, tilt: -.15, time: now, globe, links, compact: true, backdrop: false });
    tex.needsUpdate = true;
  }
  paintGlobe();
  return {
    tick(now) {
      officeYaw = reduceMotion.matches ? 0 : now * .000025;
      if (now >= nextPaint) { paintGlobe(now); nextPaint = now + (reduceMotion.matches ? 1000 : 80); }
    },
  };
})();

/* ---------- one straight walkway per room to the Brain (Oficina main.js 183–198) ---------- */
const portas = {}; // portas[k] = { porta: [x,z] at the room's edge, cerebro: [x,z] at the Brain's edge }
for (const k of ORDEM) {
  const L = LAYOUT[k];
  const B = LAYOUT.cerebro;
  const dx = L.pos[0] - B.pos[0], dz = L.pos[1] - B.pos[1];
  const edgeT = (w, d) => 1 / Math.max(Math.abs(dx) / (w / 2), Math.abs(dz) / (d / 2));
  const podT = edgeT(L.w - 2, L.d - 2), brainT = edgeT(B.w - 2, B.d - 2);
  const from = [L.pos[0] - dx * podT, L.pos[1] - dz * podT];
  const to = [B.pos[0] + dx * brainT, B.pos[1] + dz * brainT];
  const walk = makeWalkway(from, to);
  walk.userData.dept = k; walk.userData.part = 'walkway';
  scene.add(walk);
  portas[k] = { porta: from, cerebro: to };
}
// tag remaining brain furnishings (plinth) for the focus-dim pass
ilhas.cerebro.grupo.traverse(o => { if ((o.isMesh || o.isSprite) && !o.userData.dept) o.userData.dept = 'cerebro'; });
const leds = initLeds({ scene, LAYOUT, DEPTS });

/* ---------- one desk + one robot per room (Oficina main.js 207–262, the lead's desk) ---------- */
const ANG = Math.PI / 4;
const rot = v => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), ANG);
const salas = {};
for (const k of ORDEM) {
  const L = LAYOUT[k], cor = CORES[k];
  const base = new THREE.Vector3(L.pos[0], 0.12, L.pos[1] - 1);
  // whole station rotated 45° so monitor screens face the camera square-on
  const station = new THREE.Group();
  station.position.copy(base);
  station.rotation.y = ANG;
  const tela = criarTela(cor.chip);
  const { group: desk } = makeDesk(cor.chip, { tex: tela.tex, canvas: tela.canvas });
  station.add(desk);
  const chair = makeChair();
  chair.position.set(0, 0, 1.75);
  station.add(chair);
  station.traverse(o => { if (o.isMesh) o.userData.dept = k; }); // focus-dim tagging
  scene.add(station);

  const robo = makeRobot({ shell: ROBOS[k].shell, head: ROBOS[k].head, chip: cor.chip, ink: cor.ink, lead: true });
  const assento = base.clone().add(rot(new THREE.Vector3(0, 0, 1.7)));
  robo.position.copy(assento);
  robo.rotation.y = ANG + Math.PI; // face the monitor
  robo.traverse(o => { if (o.isMesh) { o.userData.dept = k; o.userData.sala = k; clickTargets.push(o); } });
  scene.add(robo);

  const aviso = makeWarnSprite();
  aviso.visible = false; aviso.position.copy(assento).add(new THREE.Vector3(0, 6.2, 0));
  scene.add(aviso);

  // name pill (HTML) — clickable, same as clicking the room
  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.innerHTML = '<span class="star">★</span>' + ROBOS[k].nome;
  pill.addEventListener('click', () => enterFocus(k));
  hud.appendChild(pill);

  const decor = decorar(k, cor.chip);
  decor.traverse(o => { if (o.isMesh) o.userData.dept = k; });
  ilhas[k].grupo.add(decor);

  salas[k] = { grupo: ilhas[k].grupo, robo, tela, aviso, estacao: station, assento, pill, decor,
    pe: assento.clone().add(rot(new THREE.Vector3(1.5, 0, 0.15))),
    centro: new THREE.Vector3(L.pos[0], 0, L.pos[1]), estado: 'ocioso', bob: Math.random() * 10 };
}

/* ---------- room cards: the Oficina's compact department badges (main.js 343–378) ---------- */
const placas = {};
for (const k of ORDEM) {
  const b = document.createElement('div');
  b.className = 'badge badge--compact';
  b.dataset.dept = k; b.dataset.sala = k;
  b.style.setProperty('--sw', CORES[k].chip);
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterFocus(k); } });
  b.addEventListener('click', e => { if (!e.target.closest('button')) enterFocus(k); });
  hud.appendChild(b);
  const L = LAYOUT[k];
  placas[k] = {
    el: b, lado: LADO_PLACA[k],
    cantos: [-1, 1].flatMap(x => [-1, 1].map(z => new THREE.Vector3(L.pos[0] + x * L.w / 2, PLINTH_H, L.pos[1] + z * L.d / 2))),
  };
}

/* ---------- focus dim: unfocused rooms genuinely darken in-scene (Oficina main.js 280–314) ---------- */
let focusDimTarget = 0, focusDim = 0;
const dimSwapped = [];
const dimCache = new Map();
function dimTwin(m) {
  if (!dimCache.has(m.uuid)) {
    const d = m.clone();
    d.userData.baseColor = m.color.clone();
    const l = (m.color.r + m.color.g + m.color.b) / 3;
    d.userData.dimColor = new THREE.Color(l * 0.40 + 0.10, l * 0.40 + 0.10, l * 0.38 + 0.09);
    dimCache.set(m.uuid, d);
  }
  return dimCache.get(m.uuid);
}
function applySceneDim(deptKey) {
  restoreSceneDim();
  scene.traverse(o => {
    if (!(o.isMesh || o.isLine || o.isSprite) || !o.material || o.material.isShadowMaterial || !o.userData.dept) return;
    if (!o.material.color || o.userData.dept === deptKey) return;
    if (o.userData.dept === 'brainCore') return;
    dimSwapped.push({ mesh: o, orig: o.material });
    o.material = dimTwin(o.material);
  });
}
function restoreSceneDim() {
  for (const s of dimSwapped) s.mesh.material = s.orig;
  dimSwapped.length = 0;
}
function tickDim(dt) {
  focusDim += (focusDimTarget - focusDim) * (1 - Math.exp(-dt * 5));
  if (focusDimTarget === 0 && focusDim < 0.02 && dimSwapped.length) restoreSceneDim();
  for (const m of dimCache.values())
    m.color.copy(m.userData.baseColor).lerp(m.userData.dimColor, focusDim);
}

/* ---------- dark mode, always on (Oficina main.js 551–575) ---------- */
const DARK = { plinth: 0x2c2d2b, walkway: 0x303230, ground: 0x1b1c1a, floor: 0x09090a }; // floor: black — the island's colour lives in its LED strip
function setDark() {
  document.body.classList.add('dark');
  scene.traverse(o => {
    if (!o.isMesh || !o.userData.part) return;
    // own material first: builders' mat() cache shares it by colour, and the rooms' decor uses the same colours
    o.material = o.material.clone();
    const m = o.material; if (!m.userData.base) m.userData.base = m.color.clone();
    if (o.userData.part === 'plinth') m.color.set(DARK.plinth);
    else if (o.userData.part === 'walkway') m.color.set(DARK.walkway);
    else if (o.userData.part === 'floor') m.color.set(DARK.floor);
  });
  leds.setDark(true);
  hemi.color.set(0x8e95a3); hemi.groundColor.set(0x14151a); hemi.intensity = 0.75;
  key.color.set(0xe4e9f2); key.intensity = 1.5;
  ground.material.opacity = 0.35;
}
setDark();

/* ---------- wheel zoom, drag pan, click (Oficina main.js 419–546) ---------- */
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function worldAt(nx, ny) {
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const p = new THREE.Vector3();
  ray.ray.intersectPlane(groundPlane, p);
  return p;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let focused = null; // room key when zoomed into a room

addEventListener('wheel', (e) => {
  if (e.target.closest && e.target.closest('#painel, #modal')) return; // let the panel scroll
  e.preventDefault();
  tween = null;
  view.arc = 0;
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  const before = worldAt(nx, ny);
  view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.0032), Math.min(0.72, overviewZoom()), 5.2);
  applyCamera();
  const after = worldAt(nx, ny);
  if (before && after) view.target.add(before.sub(after));
  if (view.zoom < 1.6 && focused) exitFocus(false);
  syncOverviewBtn();
}, { passive: false });

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
addEventListener('blur', () => { drag = null; });
addEventListener('pointercancel', () => { drag = null; });
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.moved) {
    tween = null;
    const a = worldAt((drag.x / innerWidth) * 2 - 1, -(drag.y / innerHeight) * 2 + 1);
    const b = worldAt((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (a && b) view.target.add(a.sub(b));
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
const ouvintesClique = [];
addEventListener('pointerup', (e) => {
  if (!drag) return;
  const wasDrag = drag.moved;
  drag = null;
  if (wasDrag || e.target !== canvas) return;
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const hits = ray.intersectObjects(clickTargets, false);
  if (hits.length) {
    const k = hits[0].object.userData.sala;
    if (k === 'cerebro') { zoomOut(); return; }
    if (k && k !== focused) enterFocus(k);
  }
});
// double-click empty space → straight back to overview
canvas.addEventListener('dblclick', (e) => {
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  if (!ray.intersectObjects(clickTargets, false).length) zoomOut();
});
addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return; // typing never fires a hotkey
  if (e.key === 'Escape') { if (!document.getElementById('modal').classList.contains('aberto')) zoomOut(); }
  else if (e.key === '+' || e.key === '=') zoomStep(1.5);
  else if (e.key === '-' || e.key === '_') zoomStep(1 / 1.5);
  else if (e.key === '0') zoomOut();
  else if (e.key >= '1' && e.key <= '6') { const k = ORDEM[+e.key - 1]; if (focused !== k) enterFocus(k); }
});

// on-screen zoom controls
function zoomStep(f) {
  flyTo([view.target.x, 0, view.target.z], clamp(view.zoom * f, Math.min(0.72, overviewZoom()), 5.2), 350);
  if (view.zoom * f < 1.6 && focused) exitFocus(false);
  syncOverviewBtn();
}
document.getElementById('zIn').addEventListener('click', () => zoomStep(1.5));
document.getElementById('zOut').addEventListener('click', () => zoomStep(1 / 1.5));
document.getElementById('zHome').addEventListener('click', zoomOut);

function zoomOut() {
  if (focused) { exitFocus(true); return; }
  flyTo(overviewPos(), overviewZoom(), 550);
  syncOverviewBtn();
}
document.getElementById('overviewBtn').addEventListener('click', zoomOut);
function syncOverviewBtn() {
  document.getElementById('overviewBtn').classList.toggle('show',
    (view.zoom > 1.45 && !(tween && tween.toZ <= OVERVIEW.zoom + 0.05)) || !!focused);
}

/* ---------- focus on a room (Oficina main.js 676–743, without the chat rail) ---------- */
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const vignette = document.getElementById('vignette');
function focusTarget(k) {
  const base = [LAYOUT[k].pos[0], 0, LAYOUT[k].pos[1] + 1];
  const boardW = PAINEL();
  const zoom = 2.5;
  const pxPerWorld = zoom * innerHeight / (2 * FR);
  // the room sits in the middle of whatever screen is left beside the panel
  const shift = ((0 - boardW) / 2 + (boardW ? 0 : 30)) / pxPerWorld;
  const dir = -shift;
  return { pos: [base[0] + SCREEN_RIGHT.x * dir, 0, base[2] + SCREEN_RIGHT.z * dir], zoom };
}
function enterFocus(k) {
  if (focused === k) return;
  if (focused && placas[focused]) placas[focused].el.classList.remove('foco');
  focused = k;
  focusDimTarget = 1;
  applySceneDim(k);
  vignette.classList.add('on');
  const t = focusTarget(k);
  flyTo(t.pos, t.zoom, 950, { arc: 0.10 });
  placas[k].el.classList.add('foco');
  ouvintesClique.forEach(f => f(k));
  syncOverviewBtn();
}
function exitFocus(flyOut = true) {
  if (!focused) return;
  placas[focused].el.classList.remove('foco');
  focused = null;
  focusDimTarget = 0;
  vignette.classList.remove('on');
  if (flyOut) flyTo(overviewPos(), overviewZoom(), 700);
  syncOverviewBtn();
}
// the panel opening/closing (L) re-frames without leaving focus
function enquadrar() {
  if (focused) { const t = focusTarget(focused); flyTo(t.pos, t.zoom, 600); }
  else flyTo(overviewPos(), overviewZoom(), 550);
}

/* ---------- pose by state (Oficina poses: type · wave · slump · sip) ---------- */
const FACE_CAM = Math.PI / 4;
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

/* ---------- cards + pills follow the islands (Oficina main.js 1337–1391, tickLOD) ---------- */
const v3 = new THREE.Vector3();
function toScreen(p) {
  v3.copy(p).project(camera);
  return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
}
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function tickLOD() {
  const z = view.zoom;
  const limpo = document.body.classList.contains('limpo');
  const rightEdge = innerWidth - (limpo ? 0 : 400 + 26);
  const badgeScale = (1.02 - 0.3 * smooth(1.2, 2.6, z)) * clamp(innerHeight / 850, 0.85, 1) *
    Math.max(0.68, Math.min(1, (rightEdge - 16) / 1050));
  const gap = 24 * badgeScale;
  for (const k of ORDEM) {
    const d = placas[k];
    if (limpo || focused === k) { d.el.style.opacity = limpo ? 0 : 1; if (limpo) continue; }
    const corners = d.cantos.map(toScreen);
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    // Each card stays on its room's assigned side, including during pan and zoom.
    const bh = d.el.offsetHeight * badgeScale, bw = d.el.offsetWidth * badgeScale;
    let left, top;
    if (d.lado.startsWith('top')) {
      left = (minX + maxX - bw) / 2;
      if (d.lado === 'top-left') left = minX - bw * 0.38;
      if (d.lado === 'top-right') left = maxX - bw * 0.62;
      top = minY - bh - gap;
    } else if (d.lado === 'bottom') {
      left = (minX + maxX - bw) / 2;
      top = maxY + gap;
    } else {
      left = d.lado === 'left' ? minX - bw - gap : maxX + gap;
      top = minY + (maxY - minY) * 0.3 - bh / 2;
    }
    if (k === 'analise') { left -= 32 * badgeScale; top += 52 * badgeScale; }
    if (k === 'postagem') top += 60 * badgeScale;
    // Stop at the viewport edge continuously; never jump to another free slot.
    const x = clamp(left, 8, Math.max(8, rightEdge - bw));
    const y = clamp(top, 64, Math.max(64, innerHeight - bh - 12));
    d.el.style.transform = `translate(${x}px,${y}px) scale(${badgeScale})`;
    d.el.style.opacity = focused === k ? 1 : 1 - 0.75 * focusDim; // unfocused cards recede with the scene
  }
  // name pills stay on at EVERY zoom — smaller when far, full-size when near
  const pillScale = 0.62 + 0.38 * smooth(1.2, 2.4, z);
  for (const [k, s] of Object.entries(salas)) {
    const p = s.robo.position;
    const [sx, sy] = toScreen(v3.set(p.x, p.y + 5.9 * 1.12, p.z).clone());
    s.pill.style.display = limpo ? 'none' : 'block';
    s.pill.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%) scale(${pillScale})`;
    s.pill.style.opacity = focused && focused !== k ? 1 - 0.85 * focusDim : 1;
  }
}

const ticks = [];
window.ESC = { salas, cena: scene, camera, toScreen, portas, ilhas, placas: Object.fromEntries(ORDEM.map(k => [k, placas[k].el])),
  aoClicarSala: f => ouvintesClique.push(f), aoTick: f => ticks.push(f), enquadrar, entrar: enterFocus, visaoGeral: zoomOut,
  focada: () => focused, view };

/* ---------- boot ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  if (!focused && !tween) { view.target.set(...overviewPos()); view.zoom = overviewZoom(); }
  applyCamera();
}
addEventListener('resize', resize);
resize();
{ // deterministic view hooks for headless screenshots: #view=edicao | #zoom=2.2
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('zoom')) view.zoom = parseFloat(h.get('zoom')) || 1;
  if (h.get('view') && salas[h.get('view')]) enterFocus(h.get('view'));
  syncOverviewBtn();
}

let ultimo = performance.now();
function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
  tickTween(agora);
  applyCamera();
  tickDim(dt);
  leds.tick(agora, camera, focused);
  cerebro.tick(agora);
  for (const s of Object.values(salas)) posar(s, agora, dt);
  tickLOD();
  for (const f of ticks) f(agora, dt);
  syncOverviewBtn();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
import('./painel.js').then(m => m.iniciarPainel(window.ESC)).catch(e => console.error(e));
