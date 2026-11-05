// Agents Office v2 — procedural mesh builders (stylised 3D, Image-1/2 blend on nominal palette)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const PLINTH_H = 2.6;
const WHITE = '#F7F7F2';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.02,
      ...(opts.emissive ? { emissive: opts.emissive, emissiveIntensity: opts.ei ?? 1 } : {}),
    }));
  }
  return matCache.get(key);
}

// Rounded-rectangle prism via extrusion. Origin at centre, extruded along Y.
const geoCache = new Map();
export function rboxGeo(w, d, h, r = 0.35) {
  const key = `${w}|${d}|${h}|${r}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); // extrude along +Y
  geoCache.set(key, g);
  return g;
}

export function rbox(w, d, h, color, r) {
  const m = new THREE.Mesh(rboxGeo(w, d, h, r), typeof color === 'string' ? mat(color) : color);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- plinth: floating white pod with pastel dept floor ---------- */
export function makePlinth(w, d, floorColor) {
  const g = new THREE.Group();
  const body = rbox(w, d, PLINTH_H, WHITE, 0.9);
  body.position.y = -PLINTH_H;
  g.add(body);
  // pastel floor slab, inset hairline reveal
  const floor = rbox(w - 0.7, d - 0.7, 0.12, floorColor, 0.7);
  floor.position.y = 0;
  floor.castShadow = false;
  g.add(floor);
  return g;
}

/* ---------- floor title: serif letterspaced dept name lying on the floor ---------- */
export function makeFloorTitle(text, inkColor, width) {
  const c = document.createElement('canvas');
  const W = 1024, H = 192; c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.font = '700 92px Georgia, "Times New Roman", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const sp = 14; // letterspacing via manual draw
  let total = 0;
  for (const ch of text) total += x.measureText(ch).width + sp;
  let cx0 = (W - total + sp) / 2;
  x.fillStyle = inkColor;
  for (const ch of text) {
    const cw = x.measureText(ch).width;
    x.fillText(ch, cx0 + cw / 2, H / 2 + 6);
    cx0 += cw + sp;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const h = width * (H / W);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.14;
  return m;
}

/* ---------- desk: wood top, white pedestals, monitor with live screen, chair ---------- */
export function makeDeskScreenTexture(chip) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const x = c.getContext('2d');
  const draw = (lines) => {
    // live cream screen (v1 rule: wood desks with live cream/mint screens)
    x.fillStyle = '#FDFFF8'; x.fillRect(0, 0, 256, 160);
    x.fillStyle = chip; x.fillRect(0, 0, 256, 26);
    x.fillStyle = '#151414'; x.font = 'bold 15px Menlo, monospace'; x.fillText('● working', 10, 18);
    x.font = '13px Menlo, monospace';
    lines.forEach((l, i) => {
      x.fillStyle = i === lines.length - 1 ? '#1E9070' : 'rgba(21,20,20,.78)';
      x.fillText(l, 10, 48 + i * 22);
    });
  };
  draw(['▸ …', '▸ …', '▸ …']);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, canvas: c, ctx: x, draw };
}

export function makeDesk(chip, live) {
  const g = new THREE.Group();
  const top = rbox(5.2, 2.6, 0.22, '#DCC29A', 0.18); top.position.y = 2.1; g.add(top);
  const ped1 = rbox(0.9, 2.2, 1.9, WHITE, 0.12); ped1.position.set(-2.0, 0.1, 0); g.add(ped1);
  const ped2 = rbox(0.9, 2.2, 1.9, WHITE, 0.12); ped2.position.set(2.0, 0.1, 0); g.add(ped2);
  // monitor — with a live screen (screens.js) it is a wider 16:10 panel so the session reads from the pod view
  const screenSet = live ? { tex: live.tex, canvas: live.canvas, draw: () => {}, live } : makeDeskScreenTexture(chip);
  const [mw, mh] = live ? [3.4, 2.125] : [2.1, 1.3];
  // rbox extrudes UP from its position — bezel base sits just above the desk top
  const monBack = rbox(mw + 0.2, 0.14, mh + 0.2, '#26262A', 0.08); monBack.position.set(0, 2.75, -0.85); g.add(monBack);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(mw, mh),
    new THREE.MeshBasicMaterial({ map: screenSet.tex })
  );
  screen.position.set(0, 2.85 + mh / 2, -0.77); screen.name = 'screen'; monBack.name = 'monBack'; g.add(screen);
  const stand = rbox(0.16, 0.16, 0.45, '#3A3A3E', 0.05); stand.position.set(0, 2.32, -0.9); g.add(stand);
  // keyboard + mug
  const kb = rbox(1.5, 0.5, 0.07, '#EFEFEA', 0.06); kb.position.set(0, 2.22, 0.35); g.add(kb);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.3, 12), mat(chip));
  mug.position.set(1.9, 2.36, 0.4); mug.castShadow = true; g.add(mug);
  return { group: g, screenSet };
}

export function makeChair() {
  const g = new THREE.Group();
  const seat = rbox(1.3, 1.2, 0.22, '#8E998B', 0.35); seat.position.y = 1.25; g.add(seat);
  const back = rbox(1.25, 0.2, 1.35, '#7C8779', 0.3); back.position.set(0, 1.5, 0.62); g.add(back);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 8), mat('#55555A'));
  pole.position.y = 0.82; g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.1, 10), mat('#55555A'));
  base.position.y = 0.4; base.castShadow = true; g.add(base);
  return g;
}

/* ---------- stylised 3D robot ----------
   The owner, 1 Oct 2026: the agents are robots now, not people. Same rig as the person it replaced
   (legs/legL/legR · torso · shL/shR · headG, front = +z, feet at y 0), so the desk poses, the walk
   to the Brain, the wave and the hero story drive it unchanged. Three head styles (box · dome ·
   screen) and a shell paint per agent (data.js) keep the desks from looking cloned; the body wears
   the department chip like the old shirt did, and a lead keeps the navy suit, the chip tie and the
   gold pin (v1 lead rule). Every moving part (torso, arms, head, eyes, legs) is a bone of one
   skeleton, so each paint is a single skinned mesh: six draws a seated robot plus three in the shadow
   pass, what the person cost. The geometry is built once per head style and shared by every robot
   that wears it. */
const rb = (w, h, d, r, s = 3) => new RoundedBoxGeometry(w, h, d, s, r);
const ball = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const rod = (top, bottom, h, n = 14) => new THREE.CylinderGeometry(top, bottom, h, n);
const smile = r => new THREE.TorusGeometry(r, r * 0.22, 6, 14, Math.PI); // a ∩, turned over into a ∪
const side = [0, 0, Math.PI / 2]; // a disc whose axis points out of the robot's side
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// [paint, geometry, position, rotation?, scale?] → { paint: the parts of that paint merged into one geometry }
function piece(parts) {
  const by = {};
  for (let [paint, geo, pos, rot = [0, 0, 0], scl = [1, 1, 1]] of parts) {
    geo.deleteAttribute('uv'); // nothing on a robot is textured; without UVs the welding below also closes the face seams
    geo = mergeVertices(geo); // indexes RoundedBoxGeometry (it comes unindexed, and a merge needs every part alike)
    geo.applyMatrix4(_m.compose(_p.fromArray(pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.fromArray(scl)));
    (by[paint] = by[paint] || []).push(geo);
  }
  for (const k in by) by[k] = by[k].length > 1 ? mergeGeometries(by[k]) : by[k][0];
  return by;
}

// heads pivot at the neck (headG, y 2.75): the shell sits above it; the eyes ride their own bone so they can blink
const HEADS = {
  // rounded cube, one antenna with a lamp, vent slats on the back
  box: () => ({
    parts: [
      ['shell', rb(1.0, 0.82, 0.86, 0.22), [0, 0.5, 0]],
      ['visor', rb(0.82, 0.54, 0.1, 0.1, 2), [0, 0.5, 0.4]],
      ['glow', smile(0.085), [0, 0.41, 0.452], [0, 0, Math.PI]],
      ['trim', rod(0.17, 0.17, 0.08, 20), [0.52, 0.5, 0], side],
      ['trim', rod(0.17, 0.17, 0.08, 20), [-0.52, 0.5, 0], side],
      ['joint', rod(0.075, 0.075, 0.07), [0.58, 0.5, 0], side],
      ['joint', rod(0.075, 0.075, 0.07), [-0.58, 0.5, 0], side],
      ['trim', rod(0.1, 0.12, 0.06, 16), [0, 0.93, 0]],
      ['joint', rod(0.026, 0.026, 0.36, 8), [0, 1.12, 0]],
      ['glow', ball(0.085, 12, 10), [0, 1.33, 0]],
      ...[0.62, 0.5, 0.38].map(y => ['joint', rb(0.5, 0.05, 0.05, 0.02, 1), [0, y, -0.43]]),
    ],
    eyeAt: [0, 0.56, 0.45],
    eyes: [-1, 1].map(s => ['glow', ball(0.09, 12, 8), [s * 0.19, 0, 0], [0, 0, 0], [1, 1.25, 0.35]]),
  }),
  // round helmet with a curved visor band, twin antennas, a seam round the back from ear to ear
  dome: () => {
    const R = 0.5, SX = 1.06, SY = 0.92, CY = 0.5;
    const on = (th, ph, k) => [R * k * Math.sin(th) * Math.sin(ph) * SX, CY + R * k * Math.cos(th) * SY, R * k * Math.sin(th) * Math.cos(ph)];
    const eyeAt = on(1.47, 0, 1.04);
    return {
      parts: [
        ['shell', ball(R, 24, 18), [0, CY, 0], [0, 0, 0], [SX, SY, 1]],
        ['visor', new THREE.SphereGeometry(R * 1.025, 16, 8, Math.PI / 2 - 1, 2, 1.08, 0.92), [0, CY, 0], [0, 0, 0], [SX, SY, 1]],
        ['glow', smile(0.075), on(1.8, 0, 1.035), [0.23, 0, Math.PI]],
        ['joint', rod(0.33, 0.37, 0.1, 22), [0, 0.1, 0]],
        ['trim', rod(0.14, 0.14, 0.1, 20), [0.55, CY, 0], side],
        ['trim', rod(0.14, 0.14, 0.1, 20), [-0.55, CY, 0], side],
        ['joint', new THREE.TorusGeometry(R, 0.022, 6, 24, Math.PI), [0, CY + 0.08, 0], [-Math.PI / 2, 0, 0], [SX, 1, 1]],
        ['joint', rod(0.022, 0.022, 0.32, 8), [0.2, 1.02, 0], [0, 0, -0.38]],
        ['joint', rod(0.022, 0.022, 0.32, 8), [-0.2, 1.02, 0], [0, 0, 0.38]],
        ['glow', ball(0.065, 12, 10), [0.26, 1.17, 0]],
        ['glow', ball(0.065, 12, 10), [-0.26, 1.17, 0]],
      ],
      eyeAt,
      eyes: [-1, 1].map(s => {
        const p = on(1.47, s * 0.34, 1.04);
        return ['glow', ball(0.085, 12, 8), [p[0], p[1] - eyeAt[1], p[2] - eyeAt[2]], [0, s * 0.34, 0], [1, 1.25, 0.35]];
      }),
    };
  },
  // a little monitor: wide box, a screen for a face with pixel eyes, rabbit-ear antennas, the tube behind
  screen: () => ({
    parts: [
      ['shell', rb(1.18, 0.76, 0.7, 0.16), [0, 0.48, 0]],
      ['joint', rb(0.78, 0.5, 0.26, 0.08, 2), [0, 0.48, -0.4]],
      ['visor', rb(0.98, 0.56, 0.06, 0.08, 2), [0, 0.48, 0.345]],
      ['glow', rb(0.26, 0.045, 0.03, 0.015, 1), [0, 0.34, 0.38]],
      ['trim', rod(0.11, 0.11, 0.08, 18), [0.62, 0.48, 0], side],
      ['trim', rod(0.11, 0.11, 0.08, 18), [-0.62, 0.48, 0], side],
      ['trim', rb(0.32, 0.07, 0.22, 0.03, 1), [0, 0.88, 0]],
      ['joint', rod(0.02, 0.024, 0.48, 8), [0.12, 1.06, 0], [0, 0, -0.42]],
      ['joint', rod(0.02, 0.024, 0.48, 8), [-0.12, 1.06, 0], [0, 0, 0.42]],
      ['glow', ball(0.055, 12, 10), [0.22, 1.28, 0]],
      ['glow', ball(0.055, 12, 10), [-0.22, 1.28, 0]],
    ],
    eyeAt: [0, 0.54, 0.385],
    eyes: [-1, 1].map(s => ['glow', rb(0.15, 0.15, 0.03, 0.035, 1), [s * 0.2, 0, 0]]),
  }),
};
export const ROBOT_HEADS = Object.keys(HEADS);

// where each pivot rests, in the robot's own space (before the lead's size-up); legs swing from the hips
const RIG = { torso: [0, 1.75, 0], shL: [-0.5, 2.1, 0], shR: [0.5, 2.1, 0], headG: [0, 2.75, 0], legL: [-0.22, 1.1, 0], legR: [0.22, 1.1, 0] };
const BONES = ['torso', 'shL', 'shR', 'headG', 'eyes', 'legL', 'legR'];

// [[bone, rest position, { paint: geometry }], …] → { paint: one geometry, every vertex riding its bone }
function skinned(bones) {
  const by = {};
  for (const [bone, at, parts] of bones) for (const k in parts) {
    const geo = parts[k].clone().translate(at[0], at[1], at[2]);
    const b = BONES.indexOf(bone), n = geo.attributes.position.count, idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { idx[i * 4] = b; w[i * 4] = 1; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    (by[k] = by[k] || []).push(geo);
  }
  for (const k in by) by[k] = mergeGeometries(by[k]);
  return by;
}

let robotBody = null;
const robotKits = {};
function robotKit(style, lead) {
  if (!robotBody) {
    // hip pivot at y 1.1: the sole of the foot lands on y 0
    const leg = piece([
      ['joint', ball(0.13, 10, 8), [0, 0, 0]],
      ['joint', rod(0.1, 0.1, 0.82, 12), [0, -0.47, 0]],
      ['shell', rb(0.3, 0.2, 0.46, 0.08, 2), [0, -1.0, 0.06]],
    ]);
    robotBody = {
      legs: skinned([['legL', RIG.legL, leg], ['legR', RIG.legR, leg]]),
      // torso pivot at y 1.75 (it leans back in 'read'): chest 1.45–2.55 with a lamp panel, hips below
      torso: piece([
        ['body', rb(0.94, 1.1, 0.72, 0.26), [0, 0.25, 0]],
        ['joint', rod(0.3, 0.3, 0.14, 20), [0, -0.33, 0]],
        ['joint', rb(0.7, 0.42, 0.56, 0.14, 2), [0, -0.57, 0]],
        ['visor', rb(0.5, 0.4, 0.06, 0.08, 2), [0, 0.38, 0.35]],
        ['glow', rod(0.075, 0.075, 0.03, 18), [0, 0.42, 0.385], [Math.PI / 2, 0, 0]],
        ['glow', rb(0.24, 0.035, 0.02, 0.01, 1), [0, 0.27, 0.385]],
        ...[0.52, 0.4, 0.28].map(y => ['joint', rb(0.5, 0.05, 0.05, 0.02, 1), [0, y, -0.36]]),
      ]),
      // dept-coloured tie under the chest panel + gold pin (v1 lead rule)
      lead: piece([
        ['trim', rb(0.13, 0.4, 0.05, 0.03, 1), [0, -0.03, 0.37]],
        ['gold', ball(0.06, 10, 8), [0.33, 0.5, 0.335]],
      ]),
      // shoulder pivot: ball joint, rod, elbow, gauntlet, mitten hand
      arm: piece([
        ['body', ball(0.2, 14, 10), [0, 0, 0]],
        ['joint', rod(0.085, 0.085, 0.42, 12), [0, -0.27, 0]],
        ['joint', ball(0.11, 10, 8), [0, -0.49, 0]],
        ['body', rod(0.13, 0.11, 0.3, 16), [0, -0.66, 0]],
        ['shell', ball(0.135, 12, 8), [0, -0.87, 0.01], [0, 0, 0], [1, 0.85, 1.1]],
      ]),
    };
  }
  const key = style + (lead ? '·lead' : '');
  if (!robotKits[key]) {
    const h = HEADS[style](), B = robotBody, eyes = RIG.headG.map((v, i) => v + h.eyeAt[i]);
    robotKits[key] = {
      legs: B.legs, eyeAt: h.eyeAt,
      body: skinned([
        ['torso', RIG.torso, B.torso], ...(lead ? [['torso', RIG.torso, B.lead]] : []),
        ['shL', RIG.shL, B.arm], ['shR', RIG.shR, B.arm],
        ['headG', RIG.headG, piece([['joint', rod(0.13, 0.15, 0.4, 14), [0, -0.05, 0]], ...h.parts])], // the neck rides with the head
        ['eyes', eyes, piece(h.eyes)],
      ]),
    };
  }
  return robotKits[key];
}

const glowCache = new Map();
// lamps (eyes, antenna tips, chest light) are unlit so they read as light in both themes;
// the focus dim still greys them, because it lerps .color
function glow(color) {
  if (!glowCache.has(color)) glowCache.set(color, new THREE.MeshBasicMaterial({ color }));
  return glowCache.get(color);
}
// the shadow pass draws every caster with one depth material, and flipping it between skinned and
// plain meshes makes the renderer look its shader up again on every flip; the robots bring their own
const ROBOT_DEPTH = new THREE.MeshDepthMaterial();

export function makeRobot({ shell, head, chip, ink, lead }) {
  const g = new THREE.Group();
  const S = lead ? 1.12 : 1;
  const kit = robotKit(ROBOT_HEADS.includes(head) ? head : 'box', !!lead);
  const paint = {
    shell: mat(shell || '#C9CED5', { rough: 0.45, metal: 0.1 }),
    body: mat(lead ? '#2B3245' : chip, { rough: 0.55, metal: 0.08 }),
    trim: mat(lead ? chip : (ink || chip), { rough: 0.5, metal: 0.1 }),
    joint: mat('#4A4F57', { rough: 0.5, metal: 0.25 }),
    visor: mat('#14161B', { rough: 0.2, metal: 0.4 }),
    gold: mat('#E5C158', { metal: 0.8, rough: 0.3, emissive: '#8a6d1f', ei: 0.4 }),
    glow: glow('#' + new THREE.Color(chip).lerp(new THREE.Color('#FFFFFF'), 0.35).getHexString()),
  };
  // the whole robot is a size up for a lead; scaled on an inner group, since hero mode scales the root.
  // Only the bones and the root move after this, so everything else skips its per-frame matrix compose.
  const body = new THREE.Group();
  body.scale.setScalar(S);
  body.updateMatrix(); body.matrixAutoUpdate = false;
  g.add(body);

  // big-head cartoon proportions (Image 2) — head pivots at the neck so it can turn/nod
  const [torso, shL, shR, headG, eyes, legL, legR] = BONES.map(() => new THREE.Bone());
  for (const [b, at] of [[torso, RIG.torso], [shL, RIG.shL], [shR, RIG.shR], [headG, RIG.headG], [eyes, kit.eyeAt], [legL, RIG.legL], [legR, RIG.legR]]) b.position.fromArray(at);
  headG.add(eyes);
  const legs = new THREE.Group(); // holds the leg meshes only, so it can hide them while the robot sits
  legs.matrixAutoUpdate = false;
  body.add(torso, shL, shR, headG, legL, legR, legs);
  body.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([torso, shL, shR, headG, eyes, legL, legR]);
  const dress = (parts, into) => { // one skinned mesh per paint, all on this robot's skeleton
    for (const k in parts) {
      const m = new THREE.SkinnedMesh(parts[k], paint[k]);
      m.castShadow = k === 'shell' || k === 'body' || k === 'joint'; // the small bits add draws, not shadow
      m.customDepthMaterial = ROBOT_DEPTH;
      m.matrixAutoUpdate = false;
      into.add(m);
      m.bind(skeleton);
      m.computeBoundingSphere(); m.boundingSphere.radius *= 1.3; // taken at rest; a raised arm or a stride reaches past it (clicks + culling)
    }
  };
  dress(kit.body, body);
  dress(kit.legs, legs);

  g.userData = { legs, legL, legR, shL, shR, torso, headG, eyes, S, blink: Math.random() * 4200 };
  return g;
}

// the eye lamps squash shut for a blink every few seconds, each robot on its own beat;
// `open` narrows them for a mood (happy squint on a cheer, droop on a slump)
function blink(u, t, open = 1) {
  if (u.eyes) u.eyes.scale.y = (t + u.blink) % 4200 < 110 ? 0.12 : open;
}

/* seated work poses — varied desk life, smoothly blended between modes */
export function poseWork(g, mode, t, dt) {
  const u = g.userData;
  u.legs.visible = false;
  // NOTE the camera sees agents from BEHIND — poses must read as back-view silhouettes.
  // z-rotation sign: negative shLz / positive shRz flare the arms OUTWARD past the head.
  // standK 0 = seated at desk, 1 = standing beside it (position lerp happens in main).
  const tg = { shLx: -1.05, shLz: 0.25, shRx: -1.05, shRz: -0.25, headRx: 0.04, headRy: 0, torsoRx: 0, posY: 0.55, standK: 0 };
  switch (mode) {
    case 'type':
      tg.shLx = -1.05 + Math.sin(t / 170) * 0.12;
      tg.shRx = -1.05 + Math.sin(t / 140 + 1.3) * 0.14;
      tg.headRx = 0.07 + Math.sin(t / 380) * 0.05;
      break;
    case 'read': // leans back off the keyboard, arms drop to the sides, head tilts at the screen
      tg.shLx = -0.3; tg.shLz = -0.35; tg.shRx = -0.3; tg.shRz = 0.35;
      tg.torsoRx = -0.12;
      tg.headRx = 0.18 + Math.sin(t / 650) * 0.05;
      break;
    case 'phone': // right arm visibly up and out to the ear, small nods
      tg.shRx = -2.3; tg.shRz = 0.55; tg.shLx = -0.4; tg.shLz = -0.2;
      tg.headRy = -0.18; tg.headRx = 0.05 + (Math.sin(t / 330) > 0.55 ? 0.09 : 0);
      break;
    case 'glance': // big head turn toward a neighbour
      tg.shLx = -0.9; tg.shRx = -0.9;
      tg.headRy = u.glanceDir || 0.55;
      break;
    case 'sip': // mug arm up and out, head tips back a touch
      tg.shRx = -2.0; tg.shRz = 0.5; tg.shLx = -0.6; tg.headRx = -0.12;
      break;
    case 'spin': // slow chair spin, arms out — rotation itself driven in main
      tg.shLx = -0.7; tg.shLz = -0.55; tg.shRx = -0.7; tg.shRz = 0.55;
      tg.headRx = -0.05;
      break;
    case 'stretch': // STANDS beside the desk, arms up in a wide V
      tg.standK = 1; tg.posY = 0.12;
      tg.shLx = -2.6; tg.shLz = -0.75; tg.shRx = -2.6; tg.shRz = 0.75;
      tg.headRx = -0.15; tg.torsoRx = -0.05;
      break;
    case 'wave': // STUCK: standing, facing the camera, waving for attention
      tg.standK = 1; tg.posY = 0.12;
      tg.shRx = -2.6; tg.shRz = 0.55 + Math.sin(t / 150) * 0.4;
      tg.shLx = -0.3; tg.shLz = -0.25;
      tg.headRx = -0.05;
      break;
    case 'cheer': // approval granted — standing, arms V, little hops
      tg.standK = 1;
      tg.posY = 0.12 + Math.abs(Math.sin(t / 150)) * 0.16;
      tg.shLx = -2.7; tg.shLz = -0.85 + Math.sin(t / 190) * 0.12;
      tg.shRx = -2.7; tg.shRz = 0.85 - Math.sin(t / 190) * 0.12;
      tg.headRx = -0.2;
      break;
    case 'slump': // approval rejected — head drops, arms droop
      tg.shLx = -0.2; tg.shLz = -0.3; tg.shRx = -0.2; tg.shRz = 0.3;
      tg.headRx = 0.45; tg.posY = 0.5;
      break;
  }
  if (!u.cur) u.cur = { ...tg };
  const k = 1 - Math.exp(-(dt || 0.016) * 7);
  for (const key in tg) u.cur[key] += (tg[key] - u.cur[key]) * k;
  u.shL.rotation.x = u.cur.shLx; u.shL.rotation.z = u.cur.shLz;
  u.shR.rotation.x = u.cur.shRx; u.shR.rotation.z = u.cur.shRz;
  u.headG.rotation.x = u.cur.headRx; u.headG.rotation.y = u.cur.headRy;
  u.torso.rotation.x = u.cur.torsoRx;
  u.legs.visible = u.cur.standK > 0.4;
  g.position.y = u.cur.posY + Math.sin(t / 460) * 0.02;
  blink(u, t, mode === 'cheer' ? 0.45 : mode === 'slump' ? 0.35 : 1);
}

export function poseRobot(g, pose, t = 0) {
  const u = g.userData;
  u.cur = null; // walking/standing sets rotations directly; work poses re-blend from here
  u.headG.rotation.x = 0; u.headG.rotation.y = 0;
  blink(u, t);
  if (pose === 'walk') {
    u.legs.visible = true;
    const sw = Math.sin(t / 110);
    g.position.y = Math.abs(Math.cos(t / 110)) * 0.08;
    u.legL.rotation.x = sw * 0.55; u.legR.rotation.x = -sw * 0.55;
    u.shL.rotation.x = -sw * 0.45; u.shR.rotation.x = sw * 0.45;
    u.shL.rotation.z = 0.08; u.shR.rotation.z = -0.08;
  } else { // stand (meeting)
    u.legs.visible = true;
    g.position.y = 0;
    u.legL.rotation.x = u.legR.rotation.x = 0;
    u.shL.rotation.x = -0.15 + Math.sin(t / 500) * 0.05; u.shR.rotation.x = -0.15 - Math.sin(t / 500) * 0.05;
    u.shL.rotation.z = 0.15; u.shR.rotation.z = -0.15;
    u.headG.rotation.y = Math.sin(t / 900) * 0.12; // looks at the other attendee now and then
  }
}

/* ---------- holo work-screen (Image-2 style floating glass panel) ---------- */
export function makeHolo(agentName, chip, lines) {
  const c = document.createElement('canvas');
  const W = 512, H = 320; c.width = W; c.height = H;
  const x = c.getContext('2d');
  const draw = (ls) => {
    x.clearRect(0, 0, W, H);
    // glass card
    x.fillStyle = 'rgba(253,255,248,0.93)';
    roundRect(x, 6, 6, W - 12, H - 12, 26); x.fill();
    x.strokeStyle = chip; x.lineWidth = 5;
    roundRect(x, 6, 6, W - 12, H - 12, 26); x.stroke();
    // header
    x.fillStyle = chip;
    x.beginPath(); x.arc(40, 44, 11, 0, 7); x.fill();
    x.fillStyle = '#151414'; x.font = '700 27px Georgia, serif';
    x.fillText(agentName, 62, 54);
    x.strokeStyle = 'rgba(21,20,20,0.12)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(28, 76); x.lineTo(W - 28, 76); x.stroke();
    // terminal lines
    x.font = '20px Menlo, monospace';
    ls.forEach((l, i) => {
      x.fillStyle = i === ls.length - 1 ? '#1E9070' : 'rgba(21,20,20,0.72)';
      x.fillText(l.length > 40 ? l.slice(0, 40) + '…' : l, 30, 116 + i * 36);
    });
    // blinking caret line
    x.fillStyle = '#151414';
    x.fillRect(30, 116 + ls.length * 36 - 16, 12, 20);
  };
  draw(lines);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.0),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.96, depthWrite: false, side: THREE.DoubleSide })
  );
  m.userData.draw = draw;
  m.userData.tex = tex;
  return m;
}

function roundRect(x, a, b, w, h, r) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

/* ---------- props ---------- */
export function makePlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 10), mat('#B96A4B'));
  pot.position.y = 0.4; pot.castShadow = true; g.add(pot);
  const foliage = mat('#5F8A5C', { rough: 1 });
  const foliage2 = mat('#6F9B68', { rough: 1 });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.42 + Math.sin(i * 7) * 0.12, 10, 8), i % 2 ? foliage : foliage2);
    s.position.set(Math.sin(i * 2.4) * 0.35, 1.15 + i * 0.28, Math.cos(i * 2.4) * 0.35);
    s.castShadow = true; g.add(s);
  }
  return g;
}

export function makeServerRack(chip) {
  const g = new THREE.Group();
  const body = rbox(1.6, 1.2, 3.4, '#232326', 0.14); g.add(body);
  for (let r = 0; r < 5; r++) {
    const slot = rbox(1.3, 0.06, 0.3, '#2E2E33', 0.04);
    slot.position.set(0, 0.5 + r * 0.6, 0.62); g.add(slot);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
      mat(r % 2 ? chip : '#E69393', { emissive: r % 2 ? chip : '#E69393', ei: 2.2 }));
    led.position.set(0.45, 0.65 + r * 0.6, 0.64); g.add(led);
  }
  return g;
}

export function makeMeetingTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 28), mat('#EFEADF'));
  top.position.y = 1.9; top.castShadow = true; top.receiveShadow = true; g.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.9, 12), mat('#C9C4B8'));
  leg.position.y = 0.95; g.add(leg);
  return g;
}

/* ---------- the Brain: GALACTIC-CORE nebula + knowledge web + swirling outer band ----------
   M4 "HERO BRAIN" (the owner chose A+D from the reference video — a dark galaxy-core map where the
   centre is a dense multicolour particle nebula and departments light up one at a time):
   A = the nebula — ~1100 particles in the nominal + chip palette, packed bright at the
       centre, differential swirl (core spins faster, like a galaxy), per-particle shimmer,
       periodic "thought flashes" where a random cluster blooms.
   D = the thinking sweep — tick() accepts {theta, strength, col}: particles in that azimuth
       window brighten toward the dept chip colour while main.js orbits a comet + glows the
       dept billboard. The knowledge web stays as a compact hub lattice so the brain still
       reads as a knowledge graph, not just dust. */
export function makeNeuralBrain() {
  const g = new THREE.Group();
  const R = 5.2;
  const PI2 = Math.PI * 2;
  const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
  const dummy = new THREE.Object3D();

  /* the nebula — cylindrical coords so the swirl is a pure per-frame azimuth advance.
     DUAL PALETTE (M5): every particle carries a CREAM colour (ink-dominant dust that reads
     on the cream office with no dark backing — the M4 orb read as a storm-cloud shadow and
     is gone) and a GALAXY colour (the M4 bright set) — tick lerps between them by gk. */
  const N = 1100;
  const parts = [];
  const PAL_G = [ // galaxy mode: white-hot core + chip sparkle (needs a dark field)
    ['#FFFFFF', .24], ['#B9B9B2', .13], ['#8B8B85', .10],
    ['#5ADEB7', .12], ['#EADC8F', .12], ['#E69393', .09], ['#98A5EF', .09],
    ['#4C7A57', .05], ['#D9A05B', .03], ['#151414', .03],
  ];
  const PAL_C = [ // cream mode: ink/graphite carries the mass, deep chip tones sparkle
    ['#151414', .20], ['#3E3E3A', .16], ['#6E6E68', .15], ['#9A9A92', .08],
    ['#2E8B57', .11], ['#C8A438', .10], ['#C2574F', .08], ['#5A6ACF', .08],
    ['#4C7A57', .03], ['#D9A05B', .01],
  ];
  const pick = (PAL) => { let x = Math.random(); for (const [c, w] of PAL) { if ((x -= w) <= 0) return c; } return PAL[0][0]; };
  for (let i = 0; i < N; i++) {
    const rad = R * Math.pow(Math.random(), 0.62);              // clustered toward the core
    parts.push({
      rad, az: Math.random() * PI2,
      y: gauss() * R * 0.34 * (0.35 + 0.65 * (rad / R)),        // thin bright plane, puffier rim
      w: 0.00005 + 0.00013 * (1 - rad / R),                     // differential swirl speed
      base: (0.6 + Math.random() * 0.7) * (1 + 0.55 * (1 - rad / R)), // bigger toward centre
      colC: new THREE.Color(pick(PAL_C)),
      colG: new THREE.Color(pick(PAL_G)),
      phase: Math.random() * 7,
    });
  }
  const inst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.10, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  parts.forEach((p, i) => {
    dummy.position.set(p.rad * Math.cos(p.az), p.y, p.rad * Math.sin(p.az));
    dummy.scale.setScalar(p.base);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, p.colC);
  });
  g.add(inst);

  /* knowledge web: a compact hub lattice INSIDE the nebula. Its nodes+edges live in their
     own group that rotates as one (edges must stay attached), while the dust swirls past. */
  const webG = new THREE.Group();
  g.add(webG);
  const NW = 90;
  const wnodes = [];
  for (let i = 0; i < NW; i++) {
    const dir = new THREE.Vector3(gauss(), gauss(), gauss()).normalize();
    const p = dir.multiplyScalar(R * (0.1 + 0.6 * Math.cbrt(Math.random())));
    p.y *= 0.7;
    const big = Math.random() < 0.3;
    wnodes.push({ p, big });
  }
  const winst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.10, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff }), NW);
  wnodes.forEach((n, i) => {
    n.colC = new THREE.Color(n.big ? '#7A7A74' : '#454540'); // graphite on cream
    n.colG = new THREE.Color(n.big ? '#A8A8A1' : '#FFFFFF'); // light on the night field
    dummy.position.copy(n.p);
    dummy.scale.setScalar(n.big ? 1.7 : 0.9);
    dummy.updateMatrix();
    winst.setMatrixAt(i, dummy.matrix);
    winst.setColorAt(i, n.colC);
  });
  webG.add(winst);
  const edges = [];
  for (const n of wnodes) {
    const near = wnodes
      .filter(m => m !== n)
      .sort((a, b) => a.p.distanceToSquared(n.p) - b.p.distanceToSquared(n.p));
    for (let j = 0; j < (n.big ? 5 : 2); j++)
      if (near[j]) edges.push([n.p, near[j].p]);
  }
  const epos = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => epos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6));
  const egeo = new THREE.BufferGeometry();
  egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
  const webLineMat = new THREE.LineBasicMaterial({ color: 0x3A3A38, transparent: true, opacity: 0.15 });
  webG.add(new THREE.LineSegments(egeo, webLineMat)); // ink on cream, lerped light in galaxy mode
  // signal pulses along the web
  const pulses = [];
  const pulseCols = ['#5ADEB7', '#E69393', '#98A5EF', '#D9A05B', '#FFF8EC', '#EADC8F', '#5ADEB7', '#4C7A57'];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshBasicMaterial({ color: pulseCols[i] }));
    webG.add(m);
    pulses.push({ m, edge: edges[Math.floor(Math.random() * edges.length)], t: Math.random(), speed: 0.35 + Math.random() * 0.6 });
  }

  /* outer band: hundreds of loose dots in a swirling annulus (the "circle" read) */
  const bandG = new THREE.Group();
  g.add(bandG);
  const bandPts = [];
  let guard = 0;
  while (bandPts.length < 320 && guard++ < 5000) {
    // 3D shell: random direction, swirl gaps by azimuth, gently squashed vertically
    const dir = new THREE.Vector3(gauss(), gauss(), gauss()).normalize();
    const r = R * (1.35 + 0.75 * Math.random());
    const az = Math.atan2(dir.z, dir.x);
    if (Math.sin(az * 2.2 + r * 1.6) < -0.45) continue; // swirl gaps
    const p = dir.multiplyScalar(r);
    p.y *= 0.55;
    const x = Math.random();
    bandPts.push({
      p,
      colC: new THREE.Color(x < 0.32 ? '#C8A438' : x < 0.54 ? '#8B8B85' : x < 0.68 ? '#3E3E3A'
        : x < 0.80 ? '#2E8B57' : x < 0.90 ? '#C2574F' : '#5A6ACF'),
      colG: new THREE.Color(x < 0.32 ? '#EADC8F' : x < 0.54 ? '#8B8B85' : x < 0.68 ? '#FFFFFF'
        : x < 0.80 ? '#5ADEB7' : x < 0.90 ? '#E69393' : '#98A5EF'),
      phase: Math.random() * 7,
    });
  }
  const NB = bandPts.length;
  const band = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.085, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff }), NB);
  bandPts.forEach((n, i) => {
    dummy.position.copy(n.p);
    dummy.scale.setScalar(0.8 + Math.random() * 0.5);
    dummy.updateMatrix();
    band.setMatrixAt(i, dummy.matrix);
    band.setColorAt(i, n.colC);
  });
  bandG.add(band);
  /* links to the outer nodes (M5.5 per the owner — the band dots floated unconnected): local
     nearest-neighbour edges so the ring reads as constellations, plus sparse inward spokes
     tying the outer nodes back to the core. Lives INSIDE bandG so the lines rotate with
     their endpoints (M3.4 lesson: edges must stay attached). */
  const bandLineMat = new THREE.LineBasicMaterial({ color: 0x3A3A38, transparent: true, opacity: 0.12 });
  {
    const bedges = [];
    bandPts.forEach((n, i) => {
      const near = bandPts
        .filter(m => m !== n)
        .sort((a, b) => a.p.distanceToSquared(n.p) - b.p.distanceToSquared(n.p));
      if (near[0] && near[0].p.distanceTo(n.p) < 3.0) bedges.push([n.p, near[0].p]);
      if (near[1] && Math.random() < 0.45 && near[1].p.distanceTo(n.p) < 3.0) bedges.push([n.p, near[1].p]);
      if (i % 7 === 0) bedges.push([n.p, n.p.clone().multiplyScalar(0.45)]); // inward spoke to the core
    });
    const bpos = new Float32Array(bedges.length * 6);
    bedges.forEach(([a, b], i) => bpos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6));
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    bandG.add(new THREE.LineSegments(bgeo, bandLineMat));
  }

  /* M5: the M4 "space orb" dark backing is DELETED — on the cream office it read as a
     storm-cloud shadow (the owner). The cream palette above needs no backing; galaxy mode (gk→1)
     supplies the dark field page-wide instead. */
  /* tight warm-white glow at the very centre — near-invisible on cream, blooms in galaxy */
  let coreMat;
  {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const rg = x.createRadialGradient(128, 128, 4, 128, 128, 126);
    rg.addColorStop(0, 'rgba(255,252,240,0.95)');
    rg.addColorStop(0.3, 'rgba(255,250,232,0.45)');
    rg.addColorStop(1, 'rgba(255,250,232,0)');
    x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    coreMat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.2 });
    const core = new THREE.Sprite(coreMat);
    core.scale.set(7.5, 7.5, 1);
    core.renderOrder = -1;
    g.add(core);
  }

  /* thought flashes: every few seconds a random cluster blooms bright — "having an idea" */
  let flash = null, nextFlashAt = 2200;
  const sweepCol = new THREE.Color('#FFFFFF');
  const tmpCol = new THREE.Color();
  const flashCol = new THREE.Color();
  const FLASH_C = new THREE.Color('#D9A05B'); // amber bloom reads on cream…
  const FLASH_G = new THREE.Color('#FFFFFF'); // …white bloom on the night field
  const WEB_LINE_C = new THREE.Color(0x3A3A38), WEB_LINE_G = new THREE.Color(0xFFF8EC);
  let lastGk = -1;

  const tick = (t, dt, sw, gk = 0) => {
    const swS = sw ? sw.strength : 0;
    const swTheta = sw ? sw.theta : 0;
    if (sw && sw.col) sweepCol.set(sw.col);
    // galaxy-mode crossfades (skip the instanced recolours when gk hasn't moved)
    coreMat.opacity = 0.2 + 0.8 * gk;
    webLineMat.color.copy(WEB_LINE_C).lerp(WEB_LINE_G, gk);
    webLineMat.opacity = 0.15 + 0.05 * gk;
    bandLineMat.color.copy(webLineMat.color);
    bandLineMat.opacity = 0.12 + 0.04 * gk;
    flashCol.copy(FLASH_C).lerp(FLASH_G, gk);
    if (Math.abs(gk - lastGk) > 0.004) {
      lastGk = gk;
      wnodes.forEach((n, i) => winst.setColorAt(i, tmpCol.copy(n.colC).lerp(n.colG, gk)));
      winst.instanceColor.needsUpdate = true;
      bandPts.forEach((n, i) => band.setColorAt(i, tmpCol.copy(n.colC).lerp(n.colG, gk)));
      band.instanceColor.needsUpdate = true;
    }
    webG.rotation.y = t * 0.00008;
    bandG.rotation.y = -t * 0.000035; // counter-rotating galaxy shear
    if (t > nextFlashAt) {
      flash = { az: Math.random() * PI2, rad: R * (0.15 + 0.55 * Math.random()), r: R * 0.38, t0: t };
      nextFlashAt = t + 2600 + Math.random() * 2600;
    }
    let fk = 0, fx = 0, fz = 0;
    if (flash) {
      const k = (t - flash.t0) / 950;
      if (k >= 1) flash = null;
      else { fk = Math.sin(k * Math.PI); fx = flash.rad * Math.cos(flash.az); fz = flash.rad * Math.sin(flash.az); }
    }
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      const az = p.az + t * p.w; // differential swirl
      const x = p.rad * Math.cos(az), z = p.rad * Math.sin(az);
      let s = p.base * (1 + 0.32 * Math.sin(t / 620 + p.phase)); // shimmer
      tmpCol.copy(p.colC);
      if (gk > 0.004) tmpCol.lerp(p.colG, gk);
      if (swS > 0.01) { // the thinking sweep: this side of the brain leans toward the dept colour
        const d = Math.atan2(Math.sin(az - swTheta), Math.cos(az - swTheta));
        let sk = Math.max(0, 1 - Math.abs(d) / 0.62);
        sk = sk * sk * (3 - 2 * sk) * swS;
        if (sk > 0.01) { s *= 1 + 0.85 * sk; tmpCol.lerp(sweepCol, 0.6 * sk); }
      }
      if (fk > 0) { // thought flash bloom
        const dx = x - fx, dz = z - fz;
        const fb = fk * Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / flash.r);
        if (fb > 0.01) { s *= 1 + 0.9 * fb; tmpCol.lerp(flashCol, 0.5 * fb); }
      }
      dummy.position.set(x, p.y, z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, tmpCol);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor.needsUpdate = true;
    for (const p of pulses) {
      p.t += dt * p.speed;
      if (p.t >= 1) { p.t = 0; p.edge = edges[Math.floor(Math.random() * edges.length)]; }
      p.m.position.lerpVectors(p.edge[0], p.edge[1], p.t);
    }
  };
  return { group: g, tick };
}

/* ---------- pulsing ⚠ sprite for stuck agents (v1 rule) ---------- */
export function makeWarnSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.beginPath(); x.moveTo(64, 12); x.lineTo(120, 112); x.lineTo(8, 112); x.closePath();
  x.fillStyle = '#F2B84B'; x.fill();
  x.lineWidth = 7; x.strokeStyle = '#151414'; x.lineJoin = 'round'; x.stroke();
  x.fillStyle = '#151414'; x.font = '900 64px Inter, sans-serif';
  x.textAlign = 'center'; x.fillText('!', 64, 98);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(2.6, 2.6, 1);
  return s;
}

/* ---------- walkway bridge between two XZ points ---------- */
export function makeWalkway(from, to) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const g = rbox(len, 3.2, 0.35, '#EFEFE8', 0.16);
  g.position.set((from[0] + to[0]) / 2, -0.35, (from[1] + to[1]) / 2);
  g.rotation.y = -Math.atan2(dz, dx);
  return g;
}
