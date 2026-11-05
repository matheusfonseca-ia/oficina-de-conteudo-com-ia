import * as THREE from 'three';
// The live monitor on each room's desk: a 512×320 canvas (16:10, as the Oficina's live screens).
export function criarTela(cor) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
  const x = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  let ultimo = '';
  function desenhar({ titulo = '', linha = '', progresso = null } = {}) {
    const chave = `${titulo}|${linha}|${progresso == null ? '' : progresso.toFixed(2)}`;
    if (chave === ultimo) return; ultimo = chave;
    x.fillStyle = '#16171B'; x.fillRect(0, 0, 512, 320);
    x.fillStyle = cor; x.fillRect(0, 0, 512, 10);
    x.fillStyle = '#FFFFFF'; x.font = '700 40px Manrope, sans-serif'; x.fillText(titulo, 28, 92);
    x.fillStyle = '#B9BCC4'; x.font = '500 28px Manrope, sans-serif';
    const palavras = linha.split(' '); let l = '', y = 150;
    for (const p of palavras) { if (x.measureText(l + p).width > 450) { x.fillText(l, 28, y); l = ''; y += 38; } l += p + ' '; }
    x.fillText(l, 28, y);
    if (progresso != null) {
      x.fillStyle = '#2A2C33'; x.fillRect(28, 262, 456, 22);
      x.fillStyle = cor; x.fillRect(28, 262, 456 * Math.max(0, Math.min(1, progresso)), 22);
    }
    tex.needsUpdate = true;
  }
  desenhar({ titulo: '', linha: '' });
  return { tex, canvas, desenhar };
}
