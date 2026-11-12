import * as THREE from 'three';

// A shared spherical network for the office sprite and the enlarged note browser.
// The triangular lattice is decorative; only actual notes enter the hit-test map.
let lattice;
function supportLattice() {
  if (lattice) return lattice;
  // Three r185 subdivides by (detail + 1): detail 3 gives 162 vertices / 320 faces.
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const vertices = geometry.getAttribute('position');
  const points = [], vertexIndices = [], byPosition = new Map(), edgeKeys = new Set(), edges = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    let index = byPosition.get(key);
    if (index == null) {
      index = points.length;
      points.push({ x, y, z });
      byPosition.set(key, index);
    }
    vertexIndices.push(index);
  }
  for (let i = 0; i < vertexIndices.length; i += 3) {
    const triangle = vertexIndices.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key); edges.push([a, b]);
    }
  }
  geometry.dispose();
  return (lattice = { points, edges });
}

function hash(text, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createGlobe(nodes = []) {
  const { points, edges } = supportLattice();
  const notes = new Map();
  nodes.forEach((node, index) => {
    const id = String(node.id ?? index);
    // IDs keep their positions when a live graph adds or reorders notes.
    const y = 1 - 2 * ((hash(id, 0x9e3779b9) + 0.5) / 4294967296);
    const azimuth = ((hash(id, 0x85ebca6b) + 0.5) / 4294967296) * Math.PI * 2;
    const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
    notes.set(node.i ?? index, {
      x: Math.sin(azimuth) * horizontal, y, z: Math.cos(azimuth) * horizontal, node,
    });
  });
  // Rank actual notes globally so filtering never promotes an unrelated point to a hub.
  const hubs = new Set([...notes.entries()]
    .filter(([, p]) => p.node.d >= 2)
    .sort((a, b) => b[1].node.d - a[1].node.d || String(a[1].node.id).localeCompare(String(b[1].node.id)))
    .slice(0, 8).map(([i]) => i));
  return { points, edges, notes, hubs };
}

export function projectPoint(p, yaw = 0, tilt = -0.15) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
  const x = p.x * cy + p.z * sy;
  const z = -p.x * sy + p.z * cy;
  return { x, y: p.y * ct - z * st, z: p.y * st + z * ct };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function hue(p) {
  return (230 + Math.atan2(p.y, p.x) * 180 / Math.PI + 360) % 360;
}
function color(p, light = 60, alpha = 1) {
  return `hsla(${hue(p).toFixed(1)},100%,${light}%,${alpha})`;
}

function glow(ctx, x, y, size, col, strength = 1) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, `rgba(255,255,255,${0.8 * strength})`);
  gradient.addColorStop(0.15, col);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
}

function star(ctx, x, y, size, col, opacity) {
  ctx.globalAlpha = opacity;
  glow(ctx, x, y, size * 3.4, col, 0.65);
  ctx.strokeStyle = col; ctx.lineWidth = 0.65;
  for (const angle of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
    const length = angle === 0 || angle === Math.PI / 2 ? size * 1.7 : size;
    const dx = Math.cos(angle) * length, dy = Math.sin(angle) * length;
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  }
  ctx.fillStyle = '#fffaf4';
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, size * 0.35), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawGlobe(ctx, {
  cx, cy, radius, yaw = 0, tilt = -0.15, time = 0, globe, links = [],
  focus = null, matches = null, visible = () => true, zoom = 1,
  labels = false, backdrop = true, compact = false, emphasizeHubs = false,
}) {
  const positions = new Map();
  if (!globe || !(radius > 0)) return positions;
  const unit = radius / 310;
  // The office texture is reduced to roughly 120 CSS pixels; strengthen its fine detail and contrast.
  const lineScale = compact ? 3.2 : 1, pointScale = compact ? 1.75 : 1;
  const lineLight = compact ? 54 : 63, pointLight = compact ? 60 : 66;
  const support = globe.points.map(p => {
    const q = projectPoint(p, yaw, tilt);
    return { ...q, px: cx + q.x * radius, py: cy - q.y * radius };
  });
  const focusIndex = focus?.i;
  const highlighted = focusIndex != null ? new Set([focusIndex]) : null;
  if (highlighted) for (const [a, b] of links) {
    if (a === focusIndex) highlighted.add(b);
    if (b === focusIndex) highlighted.add(a);
  }
  for (const [i, p] of globe.notes) {
    if (!visible(p.node)) continue;
    const q = projectPoint(p, yaw, tilt);
    const depth = clamp((q.z + 1) / 2, 0, 1);
    const hub = emphasizeHubs && globe.hubs.has(i);
    const size = (1.5 + Math.sqrt(Math.max(1, p.node.d || 1)) * 0.43) * unit * (0.65 + depth * 0.45) * pointScale * (hub ? 1.85 : 1);
    positions.set(i, { x: cx + q.x * radius, y: cy - q.y * radius, z: q.z, r: size, color: color(q, pointLight), node: p.node, unit: q, hub });
  }
  ctx.save();
  ctx.globalAlpha = 1;
  if (backdrop) {
    // Only the enlarged view uses this backing; office previews stay transparent.
    const background = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.07);
    background.addColorStop(0, 'rgba(2,3,7,.97)');
    background.addColorStop(0.83, 'rgba(2,3,7,.98)');
    background.addColorStop(0.93, 'rgba(2,3,7,.9)');
    background.addColorStop(1, 'rgba(2,3,7,0)');
    ctx.fillStyle = background;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.07, 0, Math.PI * 2); ctx.fill();
  }
  // Fine gradients carry the rainbow continuously across triangular faces.
  ctx.lineWidth = Math.max(0.5, 0.74 * unit) * lineScale;
  for (const [a, b] of globe.edges) {
    const A = support[a], B = support[b];
    const depth = clamp(((A.z + B.z) / 2 + 1) / 2, 0, 1);
    const opacity = (compact ? 0.22 + 0.70 * depth ** 1.45 : 0.13 + 0.58 * depth ** 1.45) * (highlighted || matches ? 0.65 : 1);
    const gradient = ctx.createLinearGradient(A.px, A.py, B.px, B.py);
    gradient.addColorStop(0, color(A, lineLight, opacity)); gradient.addColorStop(1, color(B, lineLight, opacity));
    ctx.strokeStyle = gradient;
    ctx.beginPath(); ctx.moveTo(A.px, A.py); ctx.lineTo(B.px, B.py); ctx.stroke();
  }
  // These edges are real wiki links and remain distinct from the background mesh.
  for (const [a, b] of links) {
    const A = positions.get(a), B = positions.get(b);
    if (!A || !B) continue;
    const lit = highlighted && highlighted.has(a) && highlighted.has(b);
    const dim = (highlighted && !lit) || (matches && !matches.has(a) && !matches.has(b));
    const depth = clamp(((A.z + B.z) / 2 + 1) / 2, 0, 1);
    const opacity = lit ? 0.95 : dim ? 0.055 : compact ? 0.30 + 0.60 * depth : 0.18 + 0.53 * depth;
    const gradient = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
    gradient.addColorStop(0, color(A.unit, lit ? 78 : lineLight, opacity));
    gradient.addColorStop(1, color(B.unit, lit ? 78 : lineLight, opacity));
    ctx.strokeStyle = gradient; ctx.lineWidth = Math.max(0.6, (lit ? 1.4 : 0.8) * unit) * lineScale;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  support.map((p, i) => ({ ...p, i })).sort((a, b) => a.z - b.z).forEach(p => {
    const depth = clamp((p.z + 1) / 2, 0, 1);
    const opacity = (0.18 + 0.82 * depth ** 1.25) * (highlighted || matches ? 0.65 : 1);
    const col = color(p, pointLight);
    const size = (0.8 + 1.0 * depth) * unit * pointScale;
    if (p.i % 13 === 4 && p.z > -0.2) {
      const shimmer = 0.96 + 0.04 * Math.sin(time / 1700 + p.i);
      star(ctx, p.px, p.py, size * 2.6, col, opacity * shimmer);
    } else {
      ctx.globalAlpha = opacity; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.px, p.py, Math.max(0.5, size), 0, Math.PI * 2); ctx.fill();
      if (p.z > 0.5) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.px, p.py, Math.max(0.35, size * 0.42), 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  const ordered = [...positions.entries()].sort((a, b) => a[1].z - b[1].z);
  for (const [i, p] of ordered) {
    const dim = (highlighted && !highlighted.has(i)) || (matches && !matches.has(i));
    const depth = clamp((p.z + 1) / 2, 0, 1);
    const opacity = (dim ? 0.2 : 1) * (p.hub ? 0.55 + 0.45 * depth : 0.3 + 0.7 * depth);
    ctx.globalAlpha = opacity;
    if (!dim && (p.hub || p.node.d >= 6 || highlighted?.has(i) || matches?.has(i))) {
      const shimmer = 0.97 + 0.03 * Math.sin(time / 2100 + i);
      star(ctx, p.x, p.y, p.r * 1.8, p.color, opacity * shimmer);
      ctx.globalAlpha = opacity;
    } else if (!dim && p.z > 0) glow(ctx, p.x, p.y, p.r * 3.5, p.color, 0.4);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fffaf4';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.6, p.r * 0.45), 0, Math.PI * 2); ctx.fill();
    if (p.hub && !dim) {
      ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(0.85, unit);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3 * unit, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.node.fresh || focusIndex === i) {
      ctx.strokeStyle = p.node.fresh ? '#5dffd0' : '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4 * unit, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (labels) {
    const fontSize = clamp(11 * Math.sqrt(zoom), 11, 16);
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    for (const [i, p] of ordered) {
      const hasLabel = highlighted?.has(i) || matches?.has(i) || zoom > 2.1 || (p.hub && p.z >= 0);
      const dim = (highlighted && !highlighted.has(i)) || (matches && !matches.has(i));
      if (!hasLabel || dim || (p.z < -0.2 && !highlighted?.has(i) && !matches?.has(i))) continue;
      const x = p.x + p.r + 6, text = String(p.node.id ?? '');
      ctx.font = `${p.hub ? '600 ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
      ctx.globalAlpha = 0.72 + 0.28 * clamp(p.z, 0, 1);
      ctx.strokeStyle = 'rgba(2,3,7,.9)'; ctx.strokeText(text, x, p.y);
      ctx.fillStyle = '#f2f4ff'; ctx.fillText(text, x, p.y);
    }
  }
  ctx.restore();
  return positions;
}
