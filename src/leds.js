// Neon LED strips round the islands, dark mode only (the owner, 1 Oct 2026: black floors, an RGB LED
// strip on each island's edge, every island its own colour, taken from the strong colours of the Brain).
// A department keeps its hue, pushed to the globe's neon (DEPTS[k].led, hsl(h, 100%, ~60%) like
// neural-globe.js). The Brain's island wears the whole wheel, laid out the way the globe paints it on
// screen (blue to the right, magenta on top, green below, gold on the left), so the globe's colours run
// on down into the ring. No post-processing: the strip is an unlit band in the reveal between the lip
// and the floor slab. Its glow stays inside the same rounded outline as the island.
import * as THREE from 'three';

const PLINTH_R = 0.9;                                // makePlinth's corner radius
const BAND = { outer: 0.06, inner: 0.30, h: 0.15 };  // insets from the lip; the floor slab starts at 0.35
const MID = (BAND.outer + BAND.inner) / 2;           // the strip's centre line, where the halo is measured from
const DIM = 0.14;                                    // the strip while another department has the focus

function roundRect(p, w, d, r) { // same outline as rboxGeo, so the strip runs parallel to the lip
  const x = -w / 2, y = -d / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + d - r); p.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  p.lineTo(x + r, y + d); p.quadraticCurveTo(x, y + d, x, y + d - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

function bandGeo(w, d) {
  const s = roundRect(new THREE.Shape(), w - 2 * BAND.outer, d - 2 * BAND.outer, PLINTH_R - BAND.outer);
  s.holes.push(roundRect(new THREE.Path(), w - 2 * BAND.inner, d - 2 * BAND.inner, PLINTH_R - BAND.inner));
  const g = new THREE.ExtrudeGeometry(s, { depth: BAND.h, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); // extrude along +Y
  return g;
}

// Colours are worked in sRGB, like the globe's canvas, and written out as they are (no colour-space pass).
const VERT = `varying vec2 vP;
void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const COMMON = `uniform vec3 uColor;
uniform float uRainbow, uLevel, uRad;
uniform vec2 uScrR, uScrU, uHalf; // the camera's right and up on the ground; the strip's centre line
varying vec2 vP;
vec3 hsl2rgb(float h, float s, float l) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (k - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
vec3 ledColour() {
  if (uRainbow < 0.5) return uColor;
  float a = atan(dot(vP, uScrU), dot(vP, uScrR)); // neural-globe.js hue(): 230° + the angle on screen
  return hsl2rgb(fract(230.0 / 360.0 + a / 6.2831853), 1.0, 0.6);
}
// signed distance to the strip's centre line: < 0 towards the floor, > 0 out past the lip
float edge() { vec2 q = abs(vP) - uHalf + uRad; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRad; }
`;
const HALF_BAND = (BAND.inner - BAND.outer) / 2;
const STRIP_FRAG = COMMON + `void main() {
  float x = min(abs(edge()) / ${HALF_BAND.toFixed(3)}, 1.0);
  vec3 c = mix(ledColour(), vec3(1.0), 0.55 * (1.0 - x * x)); // white-hot down the middle, pure colour at the sides
  gl_FragColor = vec4(mix(vec3(0.12), c, uLevel), 1.0);
}`;
const GLOW_FRAG = COMMON + `void main() {
  float t = max(abs(edge()) - ${HALF_BAND.toFixed(3)}, 0.0);
  // A restrained wash on the lip and floor; the glow geometry clips the outer edge.
  float g = 0.55 * exp(-t / 0.08) + 0.30 * exp(-t / 0.35) + 0.07 * exp(-t / 0.85);
  gl_FragColor = vec4(ledColour(), clamp(g * uLevel, 0.0, 1.0));
}`;

const srgb = hex => { const n = parseInt(hex.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

export function initLeds({ scene, LAYOUT, DEPTS }) {
  const scrR = new THREE.Vector2(), scrU = new THREE.Vector2();
  const islands = [];
  for (const [k, L] of Object.entries(LAYOUT)) {
    const led = DEPTS[k].led;
    const uniforms = {
      uColor: { value: srgb(led === 'rainbow' ? '#FFFFFF' : led) }, uRainbow: { value: led === 'rainbow' ? 1 : 0 },
      uLevel: { value: 1 }, uScrR: { value: scrR }, uScrU: { value: scrU },
      uHalf: { value: new THREE.Vector2(L.w / 2 - MID, L.d / 2 - MID) }, uRad: { value: PLINTH_R - MID },
    };
    const g = new THREE.Group();
    g.position.set(L.pos[0], 0, L.pos[1]);
    g.visible = false;
    const strip = new THREE.Mesh(bandGeo(L.w, L.d), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: STRIP_FRAG }));
    strip.name = 'islandLedStrip';
    const glow = new THREE.Mesh(
      new THREE.ShapeGeometry(roundRect(new THREE.Shape(),
        L.w - 2 * BAND.outer, L.d - 2 * BAND.outer, PLINTH_R - BAND.outer), 8).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.name = 'islandLedGlow';
    glow.position.y = 0.13; // a hair over the floor slab (0.12)
    glow.renderOrder = 1;
    g.add(strip, glow);
    // straight into the scene, untagged (no userData.dept / .part): not a click target, and the focus-dim
    // and theme passes in main.js leave it alone — tick() fades it and setDark() shows it
    scene.add(g);
    islands.push({ k, g, uniforms, level: 1 });
  }
  let last = 0;
  const _v = new THREE.Vector3();
  return {
    setDark(on) { for (const i of islands) i.g.visible = !!on; },
    // focused: the department in focus; the others' strips fade with the rest of their island
    tick(now, camera, focused) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      _v.setFromMatrixColumn(camera.matrixWorld, 0); scrR.set(_v.x, _v.z);
      _v.setFromMatrixColumn(camera.matrixWorld, 1); scrU.set(_v.x, _v.z);
      for (const i of islands) {
        const target = focused && focused !== 'brain' && i.k !== focused ? DIM : 1;
        i.level += (target - i.level) * (1 - Math.exp(-dt * 5));
        i.uniforms.uLevel.value = i.level;
      }
    },
  };
}
