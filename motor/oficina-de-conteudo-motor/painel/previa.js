// Prévia animada da edição. Cada formato é montado nas coordenadas do próprio
// formato.md (palco de 1080 × 1920 ou 1920 × 1080) e depois reduzido pra tela.
// É uma demonstração com um bonequinho: a edição de verdade usa a gravação e a fala da pessoa.

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';

// ---------------------------------------------------------------- utilidades

function h(tag, estilo = {}, html = '', classe = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(estilo)) if (v !== undefined && v !== null) e.style[k] = v;
  if (html) e.innerHTML = html;
  if (classe) e.className = classe;
  return e;
}

function caixa(x, y, w, hh, extra = {}) {
  return { position: 'absolute', left: px(x), top: px(y), width: px(w), height: px(hh), ...extra };
}

function px(v) { return v === undefined || v === null ? undefined : (typeof v === 'number' ? v + 'px' : v); }

function luminancia(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Tamanho de fonte que faz a palavra caber na largura (fator = largura média da letra em em).
function caber(texto, maximo, largura, fator) {
  return Math.min(maximo, Math.floor(largura / (texto.length * fator)));
}

// Encolhe o elemento (por escala) até caber na largura, medindo o texto já
// desenhado com a fonte certa. Roda depois que a cena entra na página.
function medirECaber(ctx, el, largura) {
  el.style.transformOrigin = 'center';
  ctx.ajustes.push(() => {
    el.style.transform = 'none';
    const w = el.offsetWidth;
    if (w > largura) el.style.transform = `scale(${largura / w})`;
  });
  return el;
}

function rodarAjustes(lista) {
  const rodar = () => lista.forEach((f) => { try { f(); } catch {} });
  rodar();
  document.fonts?.ready.then(rodar);
  setTimeout(rodar, 600);
}

function rgba(hex, a) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

// Separa a fala em palavras; *palavra* é a palavra de destaque.
function palavras(fala) {
  return fala.split(/\s+/).filter(Boolean).map(p => {
    const destaque = /^\*.*\*[?!.,]*$/.test(p);
    return { t: p.replace(/\*/g, ''), d: destaque };
  });
}

// ---------------------------------------------------------------- visual de cada estilo

const BASES = {
  noite: {
    fundo: '#000', manchas: true, pontos: false,
    card: { background: 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03))', border: '1.5px solid rgba(255,255,255,.14)', boxShadow: '0 30px 60px rgba(0,0,0,.55)', borderRadius: '18px', backdropFilter: 'blur(24px)' },
    ativo: (a) => ({ border: `2px solid ${a}`, boxShadow: `0 0 48px ${rgba(a, .45)}, 0 30px 60px rgba(0,0,0,.55)` }),
    acc: '#CC7430', accTxt: '#E0894A', txt: '#FFFFFF', txt2: '#A1A1AA', apagado: '#52525B',
    fTit: "'Inter', sans-serif", pTit: 700, fSerif: "'Instrument Serif', serif", serifItal: true,
    fNum: "'Inter', sans-serif", leg: 'noite', capa: 'noite', escuro: true,
  },
  claro: {
    fundo: 'radial-gradient(ellipse at 50% 36%, #FFFFFF 0%, #F3F3F0 75%)', manchas: false, pontos: false,
    card: { background: '#FFFFFF', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08), 0 30px 60px rgba(0,0,0,.10)', borderRadius: '26px' },
    ativo: (a) => ({ border: `2px solid ${a}`, boxShadow: `0 0 0 10px ${rgba(a, .14)}, 0 30px 60px rgba(0,0,0,.12)` }),
    acc: '#D97757', accTxt: '#B25730', txt: '#111111', txt2: '#6B6B6B', apagado: '#B4B4B0',
    fTit: "'Poppins', sans-serif", pTit: 700, fSerif: "'Instrument Serif', serif", serifItal: true,
    fNum: "'Poppins', sans-serif", leg: 'claro', capa: 'claro', escuro: false,
  },
  escuro: {
    fundo: 'radial-gradient(ellipse at 50% 36%, #1A1A1F 0%, #0D0D10 78%)', manchas: false, pontos: false,
    card: { background: '#1F1F25', border: '1px solid rgba(255,255,255,.06)', boxShadow: '0 1px 2px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35), 0 30px 60px rgba(0,0,0,.25)', borderRadius: '26px' },
    ativo: (a) => ({ border: `2px solid ${a}`, boxShadow: `0 0 0 10px ${rgba(a, .16)}, 0 30px 60px rgba(0,0,0,.4)` }),
    acc: '#D97757', accTxt: '#E89A7C', txt: '#F5F5F7', txt2: '#A1A1AA', apagado: '#55555C',
    fTit: "'Poppins', sans-serif", pTit: 700, fSerif: "'Instrument Serif', serif", serifItal: true,
    fNum: "'Poppins', sans-serif", leg: 'claro', capa: 'escuro', escuro: true,
  },
  pixel: {
    fundo: '#EFEDEB', manchas: false, pontos: false, grade: true,
    card: { background: '#F9F8F6', border: 'none', boxShadow: '0 18px 40px rgba(0,0,0,.10)', borderRadius: '28px' },
    ativo: (a) => ({ border: `3px solid ${a}`, boxShadow: '0 18px 40px rgba(0,0,0,.12)' }),
    acc: '#D97757', accTxt: '#C15F3C', txt: '#1A1A1A', txt2: '#8A8783', apagado: '#C9C6C2',
    fTit: "'Inter', sans-serif", pTit: 800, fSerif: "'Inter', sans-serif", serifItal: false,
    fNum: "'Inter', sans-serif", leg: 'pixel', capa: 'pixel', escuro: false, pixel: true,
  },
};

// Junta formato + estilo visual + cor de marca num conjunto de valores.
export function resolverVisual(cfg) {
  let base, legOriginal = null, id;
  const est = cfg.estilo || 'original';
  if (cfg.tipo === 'zero') {
    id = { claro: 'claro', escuro: 'escuro', pixelado: 'pixel', 'noite-laranja': 'noite', marca: 'marca' }[est] || 'custom';
  } else if (est === 'original') {
    id = 'noite';
  } else {
    id = { 'noite-laranja': 'noite', 'claro-tecnologico': 'claro', pixelado: 'pixel' }[est] || 'custom';
  }

  if (id === 'marca') {
    const m = cfg.marca || {};
    base = { ...BASES[m.fundo === 'escuro' ? 'escuro' : 'claro'] };
    if (m.fonte) { base.fTit = `'${m.fonte.replace(/['"<>;]/g, '')}', ${base.fTit}`; base.fNum = base.fTit; }
  } else if (id === 'custom') {
    const c = cfg.cores || {};
    const fundo = c.fundo || '#101014';
    const escuro = luminancia(fundo) < 0.4;
    base = { ...BASES[escuro ? 'noite' : 'claro'], fundo, manchas: false };
    if (c.texto) base.txt = c.texto;
    if (c.destaque) { base.acc = c.destaque; base.accTxt = c.destaque; }
    if (c.card) base.card = { ...base.card, background: c.card };
  } else {
    base = { ...BASES[id] };
  }
  const T = { ...base, id, card: { ...base.card } };

  // Visual original de cada formato (o que muda em relação ao Kit Noite).
  if (cfg.tipo === 'formato' && est === 'original') {
    const f = cfg.formato;
    legOriginal = {
      'reels-de-negocio': 'rn', 'ensaio-visual': 'ensaio', 'formato-ranking': 'ranking',
      'nuvem-de-imagens': 'nuvem', 'recorte-com-imagens': 'recorte', 'telas-em-profundidade': 'telas',
      'reels-com-broll': 'broll', 'legenda-encaixada': 'encaixada',
    }[f] || 'noite';
    T.leg = legOriginal;
    if (f === 'tela-dividida-explicativa') T.pontos = true;
    if (f === 'legenda-encaixada' || f === 'reels-com-broll') { T.acc = '#D9822B'; T.accTxt = '#D9822B'; }
    if (f === 'telas-em-profundidade') { T.acc = '#E8873A'; T.accTxt = '#E8873A'; }
  }
  T.original = cfg.tipo === 'formato' && est === 'original';

  // Cor da marca troca só o destaque.
  const cor = cfg.cor || (id === 'marca' ? cfg.marca?.hex : null);
  if (cor && /^#[0-9a-f]{6}$/i.test(cor)) { T.acc = cor; T.accTxt = cor; T.marca = cor; }

  // Legendas do caminho do zero: a pergunta de legenda manda, a não ser que o
  // estilo visual seja um arquivo (Pixelado, Noite Laranja), que traz a legenda dele.
  if (cfg.tipo === 'zero') {
    const leg = cfg.legendas || 'padrao';
    if (leg === 'sem') T.leg = null;
    else if (!(est === 'pixelado' || est === 'noite-laranja')) T.leg = leg === 'brancas' ? 'brancas' : 'claro';
    if (leg === 'marca' && cfg.marca?.hex) T.legCor = cfg.marca.hex;
  }
  return T;
}

// ---------------------------------------------------------------- arte (SVG)

let uid = 0;

function salaSVG(w, h) {
  const k = ++uid;
  return `
  <defs>
    <linearGradient id="pa${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3446"/><stop offset="1" stop-color="#211d28"/></linearGradient>
    <radialGradient id="lz${k}" cx="0.8" cy="0.2" r="0.6"><stop offset="0" stop-color="#ffcf9a" stop-opacity=".5"/><stop offset="1" stop-color="#ffcf9a" stop-opacity="0"/></radialGradient>
    <filter id="bl${k}"><feGaussianBlur stdDeviation="${Math.max(w, h) * 0.006}"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#pa${k})"/>
  <g filter="url(#bl${k})">
    <rect width="${w}" height="${h}" fill="url(#lz${k})"/>
    <rect x="${w * 0.06}" y="${h * 0.30}" width="${w * 0.26}" height="${h * 0.012}" fill="#5b4a3c"/>
    <rect x="${w * 0.08}" y="${h * 0.235}" width="${w * 0.03}" height="${h * 0.065}" fill="#8f3f3a"/>
    <rect x="${w * 0.115}" y="${h * 0.245}" width="${w * 0.025}" height="${h * 0.055}" fill="#d0a24f"/>
    <rect x="${w * 0.145}" y="${h * 0.228}" width="${w * 0.035}" height="${h * 0.072}" fill="#3f5a78"/>
    <circle cx="${w * 0.84}" cy="${h * 0.62}" r="${w * 0.16}" fill="#2c4a33" opacity=".85"/>
    <circle cx="${w * 0.92}" cy="${h * 0.55}" r="${w * 0.10}" fill="#365e3f" opacity=".8"/>
    <circle cx="${w * 0.2}" cy="${h * 0.12}" r="${w * 0.035}" fill="#ffd9a8" opacity=".35"/>
    <circle cx="${w * 0.62}" cy="${h * 0.08}" r="${w * 0.025}" fill="#ffd9a8" opacity=".25"/>
  </g>`;
}

// O bonequinho que fica no lugar da pessoa: topo da cabeça em (540, 500),
// ombros com ~780 px na escala 1. Fala (boca), pisca e mexe a cabeça.
function pessoaSVG() {
  const k = ++uid;
  return `
  <defs>
    <linearGradient id="pe${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e3a77f"/><stop offset=".5" stop-color="#f2c29e"/><stop offset="1" stop-color="#dc9d75"/></linearGradient>
    <linearGradient id="ro${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5865c9"/><stop offset="1" stop-color="#3a428f"/></linearGradient>
  </defs>
  <path d="M150 1990 C150 1240 250 1020 430 975 L650 975 C830 1020 930 1240 930 1990 Z" fill="url(#ro${k})"/>
  <path d="M300 1990 C300 1450 320 1230 340 1120" fill="none" stroke="#323a80" stroke-width="10" stroke-linecap="round" opacity=".6"/>
  <path d="M780 1990 C780 1450 760 1230 740 1120" fill="none" stroke="#323a80" stroke-width="10" stroke-linecap="round" opacity=".6"/>
  <path d="M488 820 L592 820 L592 985 Q540 1012 488 985 Z" fill="#eab48f"/>
  <path d="M432 978 Q540 1076 648 978" fill="none" stroke="#7d88e6" stroke-width="26" stroke-linecap="round"/>
  <g class="cabeca">
    <animateTransform attributeName="transform" type="rotate" values="0 540 880;1.6 540 880;0 540 880;-1.3 540 880;0 540 880" dur="3.2s" repeatCount="indefinite"/>
    <ellipse cx="390" cy="716" rx="30" ry="44" fill="#df9e78"/>
    <ellipse cx="690" cy="716" rx="30" ry="44" fill="#df9e78"/>
    <ellipse cx="540" cy="690" rx="152" ry="190" fill="url(#pe${k})"/>
    <path d="M386 664 C372 560 432 474 542 472 C652 470 714 550 698 660 C692 622 680 600 662 588 C612 566 528 576 474 590 C440 600 408 624 386 664 Z" fill="#3a2a20"/>
    <rect x="446" y="628" width="64" height="14" rx="7" fill="#3a2a20" transform="rotate(-6 478 635)"/>
    <rect x="570" y="628" width="64" height="14" rx="7" fill="#3a2a20" transform="rotate(6 602 635)"/>
    <ellipse cx="480" cy="692" rx="15" ry="19" fill="#22170f"><animate attributeName="ry" values="19;19;2;19;19" keyTimes="0;.9;.94;.98;1" dur="4.2s" repeatCount="indefinite"/></ellipse>
    <ellipse cx="600" cy="692" rx="15" ry="19" fill="#22170f"><animate attributeName="ry" values="19;19;2;19;19" keyTimes="0;.9;.94;.98;1" dur="4.2s" repeatCount="indefinite"/></ellipse>
    <circle cx="486" cy="684" r="5" fill="#fff" opacity=".85"/>
    <circle cx="606" cy="684" r="5" fill="#fff" opacity=".85"/>
    <path d="M540 702 Q528 742 546 750" fill="none" stroke="#c9845f" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="452" cy="760" rx="30" ry="15" fill="#ee8f80" opacity=".35"/>
    <ellipse cx="628" cy="760" rx="30" ry="15" fill="#ee8f80" opacity=".35"/>
    <ellipse cx="540" cy="796" rx="36" ry="9" fill="#7a2f2a"><animate attributeName="ry" values="8;17;7;14;9;18;8" dur="1.1s" repeatCount="indefinite"/></ellipse>
  </g>`;
}

// Camada de câmera: no painel a pessoa é sempre o bonequinho. Opções:
// recorte (sem o fundo), escala, cx e topo (enquadramento pelo topo da cabeça),
// escurecer, desfoque, raio, borda.
function camera(ctx, o = {}) {
  const { x = 0, y = 0, w = ctx.W, h: hh = ctx.H, recorte = false, raio = 0,
    escala, cx, topo, escurecer = 0, desfoque = 0, borda = null } = o;
  const box = h('div', caixa(x, y, w, hh, { overflow: recorte ? 'visible' : 'hidden', borderRadius: px(raio), border: borda }));
  const palcoDeitado = ctx.W > ctx.H && w === ctx.W && hh === ctx.H;
  const s = escala ?? (palcoDeitado ? (hh * 0.84) / 1420 : (hh * 0.8) / 1420);
  const cX = cx ?? (palcoDeitado ? w * 0.6 : w / 2);
  const tY = topo ?? (palcoDeitado ? hh * 0.16 : hh * 0.25);
  const fundo = recorte ? '' : salaSVG(w, hh);
  const sombra = recorte ? `filter="drop-shadow(0 20px 40px rgba(0,0,0,.45))"` : '';
  box.innerHTML = `<svg viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" style="position:absolute;inset:0;overflow:visible" xmlns="http://www.w3.org/2000/svg">
    ${fundo}<g transform="translate(${cX - 540 * s} ${tY - 500 * s}) scale(${s})" ${sombra}>${pessoaSVG()}</g>
    ${escurecer ? `<rect width="${w}" height="${hh}" fill="#000" opacity="${escurecer}"/>` : ''}</svg>`;
  const svg = box.firstElementChild;
  if (desfoque) svg.style.filter = `blur(${desfoque}px)`;
  if (ctx.estatico) svg.pauseAnimations?.();
  // Mesma pessoa em todas as camadas: o relógio das animações começa junto.
  else if (ctx.relogio != null) requestAnimationFrame(() => svg.setCurrentTime?.((performance.now() - ctx.relogio) / 1000));
  return box;
}

// Mascote em pixel art (16 × 16), como no estilo Pixelado.
const MASCOTE = [
  '....XXXXXXXX....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '..XXXXXXXXXXXX..',
  '..XXKKXXXXKKXX..', '..XXKKXXXXKKXX..', '..XXXXXXXXXXXX..', '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...', '....XXXXXXXX....', '..XXXXXXXXXXXX..', '.XXXXXXXXXXXXXX.',
  '.XX.XXXXXXXX.XX.', '....XXX..XXX....', '....XXX..XXX....', '...XXXX..XXXX...',
];
function mascote(cor = '#D97757', p = 12, morto = false) {
  let r = '';
  MASCOTE.forEach((linha, y) => [...linha].forEach((c, x) => {
    if (c === '.') return;
    let f = c === 'K' ? '#151513' : (morto ? '#9a9692' : cor);
    if (morto && c === 'K') { if ((x + y) % 2) return; f = '#151513'; }
    r += `<rect x="${x * p}" y="${y * p}" width="${p}" height="${p}" fill="${f}"/>`;
  }));
  return `<svg width="${16 * p}" height="${16 * p}" viewBox="0 0 ${16 * p} ${16 * p}" shape-rendering="crispEdges">${r}</svg>`;
}

// Imagens de exemplo (posts, notícias, telas) pros formatos que mostram imagens.
// escuro: versão pra card de vidro escuro (texto branco, sem fundo branco).
function imagem(tipo, T, escuro = false) {
  const acc = T?.acc || '#CC7430';
  const fundo = escuro ? 'transparent' : '#fff';
  const tinta = escuro ? '#fff' : '#111';
  const bolha = escuro ? 'rgba(255,255,255,.12)' : '#efefef';
  switch (tipo) {
    case 'post': return `<div style="width:100%;height:100%;background:${fundo};display:flex;flex-direction:column;font-family:Inter">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px"><div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#f9a94b,#d6249f,#285aeb)"></div><b style="font-size:20px;color:${tinta}">seuperfil</b></div>
      <div style="flex:1;background:linear-gradient(135deg,#ffd6a5,#fdffb6 40%,#caffbf)"></div>
      <div style="padding:12px 16px;font-size:19px;color:${tinta}"><b>♥ 12,4 mil</b> curtidas</div></div>`;
    case 'noticia': return `<div style="width:100%;height:100%;background:${fundo};padding:22px;box-sizing:border-box;font-family:Inter;color:${tinta}">
      <div style="font-size:15px;color:#c8102e;font-weight:700;letter-spacing:.06em">TECNOLOGIA</div>
      <div style="font-family:'Newsreader',Georgia,serif;font-size:31px;line-height:1.12;margin:10px 0 14px;font-weight:600">IA já responde 7 em cada 10 mensagens de clientes</div>
      <div style="height:42%;background:${escuro ? 'linear-gradient(120deg,#34343c,#26262c)' : 'linear-gradient(120deg,#d9dde3,#b9c2cc)'};border-radius:4px"></div></div>`;
    case 'grafico': return `<div style="width:100%;height:100%;background:${escuro ? 'transparent' : '#0f1115'};padding:20px;box-sizing:border-box;font-family:Inter;color:#fff">
      <div style="font-size:18px;color:#a1a1aa">Vendas pelo direct</div><div style="font-size:40px;font-weight:700">R$ 18.240</div>
      <svg viewBox="0 0 300 120" style="width:100%;height:55%"><path d="M0 110 L50 96 L100 100 L150 70 L200 58 L250 30 L300 12" fill="none" stroke="${acc}" stroke-width="6"/></svg></div>`;
    case 'chat': return `<div style="width:100%;height:100%;background:${fundo};padding:18px;box-sizing:border-box;font-family:Inter;display:flex;flex-direction:column;gap:10px;justify-content:center">
      <div style="align-self:flex-start;background:${bolha};border-radius:18px;padding:10px 16px;font-size:20px;color:${tinta}">Quanto custa?</div>
      <div style="align-self:flex-end;background:#3797f0;border-radius:18px;padding:10px 16px;font-size:20px;color:#fff">Te mandei o link 👇</div>
      <div style="align-self:flex-start;background:${bolha};border-radius:18px;padding:10px 16px;font-size:20px;color:${tinta}">Comprei!</div></div>`;
    case 'perfil': return `<div style="width:100%;height:100%;background:#fff;padding:18px;box-sizing:border-box;font-family:Inter;color:#111">
      <div style="display:flex;gap:16px;align-items:center"><div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#f9a94b,#d6249f)"></div>
      <div style="display:flex;gap:18px;font-size:16px;text-align:center"><div><b style="font-size:22px">312</b><br>posts</div><div><b style="font-size:22px">51 mil</b><br>seguidores</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:16px">${['#ffd6a5', '#bde0fe', '#caffbf', '#ffc6ff', '#fdffb6', '#a0c4ff'].map(c => `<div style="aspect-ratio:1;background:${c}"></div>`).join('')}</div></div>`;
    case 'cidade': return `<svg viewBox="0 0 540 960" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block"><defs><linearGradient id="ce" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b64"/><stop offset=".55" stop-color="#f8916b"/><stop offset="1" stop-color="#ffd59e"/></linearGradient></defs><rect width="540" height="960" fill="url(#ce)"/><circle cx="380" cy="540" r="70" fill="#ffe7b0"/>${[[0, 600, 80], [70, 520, 70], [130, 640, 60], [180, 470, 90], [260, 560, 70], [320, 420, 80], [390, 590, 60], [440, 500, 100]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${960 - y}" fill="#1b1730"/>`).join('')}</svg>`;
    case 'mesa': return `<svg viewBox="0 0 540 960" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block"><rect width="540" height="960" fill="#2b2622"/><rect y="560" width="540" height="400" fill="#6b4a33"/><rect x="90" y="300" width="360" height="230" rx="12" fill="#111"/><rect x="104" y="314" width="332" height="200" rx="6" fill="#3d7bf5"/><rect x="124" y="340" width="190" height="14" rx="7" fill="#fff" opacity=".9"/><rect x="124" y="368" width="260" height="10" rx="5" fill="#fff" opacity=".5"/><rect x="124" y="390" width="220" height="10" rx="5" fill="#fff" opacity=".5"/><rect x="250" y="530" width="40" height="40" fill="#222"/><ellipse cx="420" cy="620" rx="36" ry="14" fill="#e9e1d6"/><rect x="390" y="585" width="60" height="38" rx="8" fill="#e9e1d6"/></svg>`;
    case 'loja': return `<svg viewBox="0 0 540 960" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block"><rect width="540" height="960" fill="#f2e8dc"/>${[0, 1, 2].map(r => `<rect x="40" y="${200 + r * 220}" width="460" height="16" fill="#9c7a5b"/>${[0, 1, 2, 3].map(c => `<rect x="${70 + c * 110}" y="${110 + r * 220}" width="70" height="90" rx="10" fill="${['#e76f51', '#2a9d8f', '#e9c46a', '#264653'][(c + r) % 4]}"/>`).join('')}`).join('')}</svg>`;
    case 'pixelcena': return `<div style="width:100%;height:100%;background:linear-gradient(#7ec8e3 0 60%, #5aa04c 60% 64%, #8b5a2b 64%);image-rendering:pixelated"></div>`;
    default: return `<div style="width:100%;height:100%;background:${acc}"></div>`;
  }
}

// ---------------------------------------------------------------- peças gráficas

function fundoGrafico(ctx, x = 0, y = 0, w = ctx.W, hh = ctx.H, o = {}) {
  const { T } = ctx;
  const f = h('div', caixa(x, y, w, hh, { background: T.fundo, overflow: 'hidden' }));
  if (T.pontos) f.appendChild(h('div', { position: 'absolute', inset: '0', backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1.5px, transparent 1.6px)', backgroundSize: '36px 36px' }));
  if (T.grade) f.appendChild(h('div', { position: 'absolute', inset: '0', backgroundImage: 'linear-gradient(#E6E4E1 1.5px, transparent 1.5px), linear-gradient(90deg, #E6E4E1 1.5px, transparent 1.5px)', backgroundSize: '90px 90px' }));
  if (T.manchas && o.manchas !== false) {
    const pos = o.manchasEm || [[0.1, 0.15], [0.9, 0.85]];
    pos.forEach(([mx, my], i) => {
      const r = Math.min(w, hh) * 0.55;
      const m = h('div', { position: 'absolute', left: px(mx * w - r), top: px(my * hh - r), width: px(r * 2), height: px(r * 2), borderRadius: '50%', background: `radial-gradient(circle, ${rgba(T.acc, .42)} 0%, transparent 65%)`, filter: 'blur(40px)' });
      f.appendChild(m);
      ctx.anima(m, [{ transform: 'translate(0,0)' }, { transform: `translate(${i ? -40 : 40}px, ${i ? 30 : -30}px)` }], { dur: 4, ease: 'ease-in-out', iter: Infinity, dir: 'alternate' });
    });
  }
  return f;
}

function card(ctx, x, y, w, hh, html = '', o = {}) {
  const { T } = ctx;
  const c = h('div', caixa(x, y, w, hh, { ...T.card, boxSizing: 'border-box', padding: px(o.pad ?? 32), color: T.txt, fontFamily: T.fTit, overflow: 'hidden' }), html);
  if (o.ativo) Object.assign(c.style, T.ativo(T.acc));
  if (o.apagado) c.style.opacity = '.55';
  return c;
}

function entra(ctx, el, em, o = {}) {
  const d = o.sobe ?? (ctx.T.pixel ? 10 : 30);
  const kf = ctx.T.pixel
    ? [{ opacity: 0, transform: `translateY(${d}px) scale(.96)` }, { opacity: 1, transform: 'none' }]
    : [{ opacity: 0, transform: `translateY(${d}px)` }, { opacity: 1, transform: 'none' }];
  return ctx.anima(el, kf, { em, dur: o.dur ?? (ctx.T.pixel ? .25 : .4), som: 'som' in o ? o.som : 'pop' });
}

function sai(ctx, el, em, dur = .25) {
  return ctx.anima(el, [{ opacity: 1 }, { opacity: 0 }], { em, dur, preso: true });
}

// Título com palavra de destaque (topo das telas gráficas).
function titulo(ctx, l1, l2, y, o = {}) {
  const { T, W } = ctx;
  const tam = o.tam ?? 60;
  const wrap = h('div', { position: 'absolute', left: '0', top: px(y), width: px(W), textAlign: 'center', fontFamily: T.fTit, fontWeight: T.pTit, color: T.txt, fontSize: px(tam), lineHeight: '1.12', letterSpacing: '-0.02em' });
  const linha = (txt, n) => {
    const d = h('div', { position: 'relative', display: 'inline-block' });
    palavras(txt).forEach((p, i) => {
      const s = h('span', { display: 'inline-block', marginRight: '0.26em' }, p.t);
      if (p.d) Object.assign(s.style, { fontFamily: T.fSerif, fontStyle: T.serifItal ? 'italic' : 'normal', color: T.accTxt, fontWeight: T.pixel ? 900 : 400, fontSize: '1.12em' });
      d.appendChild(s);
      ctx.anima(s, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { em: (o.em ?? 0) + (n * 4 + i) * 0.06, dur: .25 });
    });
    return d;
  };
  wrap.appendChild(linha(l1, 0));
  wrap.appendChild(h('br'));
  const l2el = linha(l2, 1);
  wrap.appendChild(l2el);
  if (!T.pixel) {
    const sub = h('div', { position: 'absolute', left: '0', bottom: '-10px', height: '4px', width: '100%', background: T.acc, transformOrigin: 'left' });
    l2el.appendChild(sub);
    ctx.anima(sub, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { em: (o.em ?? 0) + .35, dur: .5 });
  }
  return wrap;
}

function notificacao(ctx, x, y, w, nome, texto, o = {}) {
  const { T } = ctx;
  const n = card(ctx, x, y, w, 120, `
    <div style="display:flex;align-items:center;gap:22px;height:100%">
      <div style="width:64px;height:64px;border-radius:${T.pixel ? '8px' : '50%'};flex:none;background:${o.cor || 'linear-gradient(135deg,#f9a94b,#d6249f)'}"></div>
      <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:30px">${nome}</div><div style="font-weight:400;font-size:27px;color:${T.escuro ? '#D4D4D8' : T.txt2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${texto}</div></div>
      <div style="font-size:24px;color:${T.escuro ? '#71717A' : T.txt2};font-family:${T.pixel ? "'JetBrains Mono'" : 'inherit'}">agora</div></div>`, { pad: '0 30px' });
  n.style.borderRadius = T.pixel ? '16px' : '28px';
  if (T.pixel) Object.assign(n.style, { border: '2px solid #151513', boxShadow: '4px 4px 0 #151513' });
  return n;
}

function contador(ctx, x, y, w, de, ate, o = {}) {
  const { T } = ctx;
  const el = h('div', { position: 'absolute', left: px(x), top: px(y), width: px(w), textAlign: 'center', fontFamily: T.fNum, fontWeight: T.pixel ? 900 : 700, fontSize: px(o.tam ?? 150), color: T.txt, letterSpacing: '-0.03em', lineHeight: '1' });
  const fmt = v => (o.prefixo || '') + Math.round(v).toLocaleString('pt-BR') + (o.sufixo || '');
  el.textContent = fmt(de);
  ctx.tempo(o.em ?? 0, o.dur ?? 1, k => { el.textContent = fmt(de + (ate - de) * (1 - (1 - k) ** 3)); }, 'tique');
  if (o.rotulo) el.appendChild(h('div', { fontSize: '30px', fontWeight: 500, color: T.txt2, letterSpacing: '0', marginTop: '14px', fontFamily: T.pixel ? "'JetBrains Mono'" : T.fTit }, o.rotulo));
  return el;
}

function graficoLinha(ctx, x, y, w, hh, em = 0) {
  const { T } = ctx;
  const pts = T.pixel
    ? 'M0 300 H120 V250 H240 V265 H360 V180 H480 V140 H600 V60 H720'
    : 'M0 300 C80 290 120 250 200 255 S330 200 400 170 S560 120 620 70 S700 30 720 25';
  const el = h('div', caixa(x, y, w, hh), `<svg viewBox="0 0 720 320" width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible">
    <line x1="0" y1="310" x2="720" y2="310" stroke="${T.escuro ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'}" stroke-width="3" stroke-dasharray="10 10"/>
    <path d="${pts}" fill="none" stroke="${T.acc}" stroke-width="${T.pixel ? 8 : 6}" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
  ctx.anima(el.querySelector('path'), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { em, dur: 1.2, ease: 'cubic-bezier(.4,0,.2,1)', som: 'sobe' });
  return el;
}

// Lista de passos em pílulas, com o item falado como ativo.
function listaPassos(ctx, x, y, w, itens, tempos) {
  const { T } = ctx;
  const g = h('div', caixa(x, y, w, itens.length * 150));
  const els = itens.map((t, i) => {
    const c = card(ctx, 0, i * 150, w, 124, `<div style="display:flex;align-items:center;gap:26px;height:100%">
      <div style="font-family:${T.pixel ? "'JetBrains Mono'" : T.fTit};font-size:28px;font-weight:${T.pixel ? 700 : 500};color:${T.pixel ? T.acc : T.txt2};${T.pixel ? `background:#F6E3DA;padding:6px 14px;border-radius:8px` : ''}">${T.pixel ? 'PASSO ' : ''}0${i + 1}</div>
      <div style="font-size:42px;font-weight:${T.pTit}">${t}</div></div>`, { pad: '0 36px' });
    c.style.borderRadius = T.pixel ? '22px' : '999px';
    g.appendChild(c);
    entra(ctx, c, tempos[i]);
    return c;
  });
  // O item ativo acompanha a fala.
  els.forEach((c, i) => {
    const ativo = T.ativo(T.acc);
    ctx.anima(c, [{ border: c.style.border || 'none', boxShadow: c.style.boxShadow, opacity: 1 }, { border: ativo.border, boxShadow: ativo.boxShadow, opacity: 1 }], { em: tempos[i] + .05, dur: .3 });
    if (i < els.length - 1) ctx.anima(c, [{ opacity: 1 }, { opacity: .55 }], { em: tempos[i + 1], dur: .3 });
  });
  return g;
}

// Capa (título no quadro 0) no jeito de cada estilo.
function capa(ctx, l1, l2, y, o = {}) {
  const { T, W } = ctx;
  const w = h('div', { position: 'absolute', left: '0', width: px(W), top: px(y), textAlign: 'center' });
  const tipo = o.tipo || T.capa;
  const maior = Math.max(l1.length, l2.length, 1);
  const fit = (base, folga) => Math.min(base, Math.floor((W - folga) / (maior * 0.56)));
  if (tipo === 'noite' || tipo === 'rn') {
    w.innerHTML = `<div style="font-family:Inter;font-weight:800;font-size:82px;color:#fff;letter-spacing:-.02em;text-shadow:0 4px 20px rgba(0,0,0,.5)">${l1}</div>
      <div style="display:inline-block;margin-top:14px;font-family:Inter;font-weight:800;font-size:82px;color:#0A0A0A;background:#fff;padding:6px 18px;border-radius:4px;letter-spacing:-.02em">${l2}</div>`;
  } else if (tipo === 'pixel') {
    w.innerHTML = `<div class="capa-caixa" style="display:inline-block;font-family:Inter;font-weight:800;font-size:${fit(o.tam ?? 84, 260)}px;line-height:1.08;color:#1A1A1A;background:#F9F8F6;border:3px solid #151513;box-shadow:6px 6px 0 #151513;padding:28px 44px;border-radius:18px;letter-spacing:-.02em;white-space:nowrap">${l1}<br><span style="color:#D97757">${l2}</span></div>`;
  } else {
    const escuro = tipo === 'escuro';
    w.innerHTML = `<div class="capa-caixa" style="display:inline-block;font-family:${T.fTit};font-weight:700;font-size:${fit(o.tam ?? (ctx.W > ctx.H ? 84 : 104), 260)}px;line-height:1.08;white-space:nowrap;color:${escuro ? '#F5F5F7' : '#111'};background:${escuro ? '#1F1F25' : '#fff'};padding:34px 50px;border-radius:30px;box-shadow:0 20px 50px rgba(0,0,0,.25);letter-spacing:-.02em">${l1}<br>${l2}</div>`;
  }
  const cx = w.querySelector('.capa-caixa');
  if (cx) medirECaber(ctx, cx, W - 120);
  ctx.anima(w, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { em: o.em ?? 0, dur: .35, som: 'impacto' });
  return w;
}

// Cartão de chamada pra ação ("comenta X").
function cta(ctx, palavra, y, o = {}) {
  const { T, W } = ctx;
  const w = Math.min(W - 86, 994);
  const c = card(ctx, (W - w) / 2, y, w, 200, `<div style="display:flex;align-items:center;gap:28px;height:100%">
    <div style="width:96px;height:96px;flex:none;border-radius:${T.pixel ? '14px' : '50%'};background:${T.acc};display:grid;place-items:center;color:#fff;font-size:52px">💬</div>
    <div><div style="font-size:34px;color:${T.txt2};font-weight:500">Comenta aqui embaixo</div><div style="font-size:72px;font-weight:800;letter-spacing:-.02em;color:${T.txt}">“${palavra}”</div></div></div>`, { pad: '0 40px' });
  if (T.pixel) Object.assign(c.style, { border: '3px solid #151513', boxShadow: '6px 6px 0 #151513' });
  entra(ctx, c, o.em ?? .3, { som: 'confirma' });
  return c;
}

// Motion do Pixelado: um mascote se multiplica até uma grade de 100, com
// contador e carimbo no fim ("faz 100 versões").
function cenaMultiplica(ctx, x = 0, y = 0, w = ctx.W, hh = ctx.H) {
  const g = fundoGrafico(ctx, x, y, w, hh);
  const cores = ['#D97757', '#4A90D9', '#E86AA6', '#4CAF50', '#8E5BD9', '#E8B547'];
  const lado = Math.min(w - 120, 900, hh * 0.6);
  const passo = lado / 10;
  const gx = (w - lado) / 2, gy = hh > w ? hh * 0.2 : hh * 0.1;
  const grade = h('div', caixa(gx, gy, lado, lado));
  for (let i = 0; i < 100; i++) {
    const m = h('div', { position: 'absolute', left: px((i % 10) * passo), top: px(Math.floor(i / 10) * passo) }, mascote(cores[i % cores.length], Math.floor(passo / 18)));
    grade.appendChild(m);
    ctx.anima(m, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { em: i === 0 ? 0 : .5 + i * 0.012, dur: .18, som: i % 25 === 0 ? 'pop' : null });
  }
  g.appendChild(grade);
  const cont = h('div', { position: 'absolute', left: '0', width: px(w), top: px(gy + lado + 40), textAlign: 'center', fontFamily: 'Inter', fontWeight: 900, fontSize: '96px', color: '#1A1A1A', letterSpacing: '-.03em' });
  const sinal = h('span', { color: '#D97757' }, '×');
  const num = h('span', {}, '1');
  cont.append(sinal, num);
  g.appendChild(cont);
  ctx.tempo(.5, 1.25, k => { num.textContent = String(Math.max(1, Math.round(100 * k))); });
  const carimbo = h('div', { position: 'absolute', left: px(w / 2 - 340), top: px(gy + lado / 2 - 70), width: '680px', boxSizing: 'border-box', whiteSpace: 'nowrap', textAlign: 'center', fontFamily: 'Inter', fontWeight: 900, fontSize: '88px', color: '#D97757', border: '8px solid #D97757', padding: '6px 0', background: 'rgba(249,248,246,.85)', transform: 'rotate(-10deg)' }, 'IGUAL ×100');
  g.appendChild(carimbo);
  ctx.anima(carimbo, [{ opacity: 0, transform: 'rotate(-10deg) scale(1.6)' }, { opacity: 1, transform: 'rotate(-10deg) scale(1)' }], { em: 1.95, dur: .18, ease: 'cubic-bezier(.3,1.6,.5,1)', som: 'impacto' });
  return g;
}

// HUD + cena em pixel art (clímax do estilo Pixelado).
function cenaPixel(ctx, x = 0, y = 0, w = ctx.W, hh = ctx.H) {
  const g = h('div', caixa(x, y, w, hh, { overflow: 'hidden', background: 'linear-gradient(#7EC8E3 0 62%, #5AA04C 62% 65%, #8B5A2B 65%)' }));
  // nuvens em blocos
  [[0.15, 0.12], [0.62, 0.2]].forEach(([nx, ny]) => g.appendChild(h('div', { position: 'absolute', left: px(nx * w), top: px(ny * hh), width: '180px', height: '48px', background: '#fff', boxShadow: '48px -36px 0 #fff, 96px 0 0 #fff' })));
  const chao = hh * 0.62;
  const a = h('div', { position: 'absolute', left: px(w * 0.16), top: px(chao - 192) }, mascote('#D97757', 12));
  const b = h('div', { position: 'absolute', left: px(w * 0.62), top: px(chao - 192), transform: 'scaleX(-1)' }, mascote('#4A90D9', 12));
  g.append(a, b);
  ctx.anima(a, [{ transform: 'translateY(0)' }, { transform: 'translateY(-24px)' }], { dur: .5, ease: 'steps(4)', iter: Infinity, dir: 'alternate' });
  ctx.anima(b, [{ transform: 'scaleX(-1) translateY(0)' }, { transform: 'scaleX(-1) translateY(-24px)' }], { em: .25, dur: .5, ease: 'steps(4)', iter: Infinity, dir: 'alternate' });
  const hud = (txt, l, t, cor = '#E8B547') => h('div', { position: 'absolute', left: px(l), top: px(t), fontFamily: 'Silkscreen, monospace', fontSize: '40px', color: cor, background: '#151513', border: '4px solid #3A3836', padding: '10px 18px' }, txt);
  g.append(hud('RODADA 1', 40, 60), hud('♥♥♥', w - 220, 60, '#E86AA6'));
  const vs = h('div', { position: 'absolute', left: '0', width: '100%', top: px(chao - 330), textAlign: 'center', fontFamily: 'Silkscreen, monospace', fontSize: '110px', color: '#fff', textShadow: '6px 6px 0 #151513' }, 'VS');
  g.appendChild(vs);
  ctx.anima(vs, [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { em: .3, dur: .25, som: 'moeda', ease: 'steps(3)' });
  return g;
}

// ---------------------------------------------------------------- legendas

const PELES = {
  noite: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#E0894A', esc: 1.15 } },
  claro: { f: 'Poppins', p: 700, cor: '#fff', contorno: true, hi: { f: "'Instrument Serif'", ital: true, p: 700, cor: '#FFFF00', esc: 1.12 } },
  brancas: { f: 'Poppins', p: 700, cor: '#fff', contorno: true, hi: null },
  rn: { f: 'Inter', p: 800, cor: '#fff', sombra: '0 6px 24px rgba(0,0,0,.6)', hi: { f: 'Inter', p: 800, cor: '#CC7430', esc: 1 } },
  ensaio: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#CC7430', esc: 1.15 } },
  ranking: { f: 'Archivo', p: 800, ital: true, caixaAlta: true, cor: '#fff', sombra: '0 4px 14px rgba(0,0,0,.7)', hi: { f: 'Archivo', p: 800, ital: true, cor: '#FFE14D', esc: 1 } },
  nuvem: { f: 'Inter', p: 500, cor: '#fff', minusculo: true, sombra: '0 2px 10px rgba(0,0,0,.6)', hi: null },
  recorte: { f: 'Oswald', p: 300, cor: '#fff', sombra: '0 3px 14px rgba(0,0,0,.7)', hi: null },
  telas: { f: 'Inter', p: 600, cor: '#fff', sombra: '0 4px 18px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#E8873A', esc: 1.4, brilho: '0 0 30px rgba(232,135,58,.45)' } },
  broll: { f: 'Inter', p: 600, cor: '#fff', sombra: '0 3px 14px rgba(0,0,0,.65)', hi: null },
  pixel: { pilula: true },
  fxPessego: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#FFB7A5', esc: 1.15 } },
  fxVerde: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#34C759', esc: 1.15 } },
  fxAmarelo: { f: 'Inter', p: 800, cor: '#fff', sombra: '0 4px 18px rgba(0,0,0,.75)', hi: { f: 'Inter', p: 800, cor: '#FFD60A', esc: 1 } },
  fxMarcador: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Permanent Marker'", p: 400, cor: '#FFD60A', esc: 1.1 } },
  fxQuente: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#FFE7C2', esc: 1.15 } },
  fxRosa: { f: 'Inter', p: 700, cor: '#fff', sombra: '0 4px 16px rgba(0,0,0,.7)', hi: { f: "'Instrument Serif'", ital: true, p: 400, cor: '#FF3D7F', esc: 1.15 } },
};

function desenharLegenda(ctx, el, lista, mec) {
  const { T } = ctx;
  const nome = mec.pele;
  el.innerHTML = '';
  if (!nome || !lista.length) return;
  const pele = PELES[nome] || PELES.noite;
  const tam = mec.tam ?? 64;
  if (pele.pilula) {
    const s = h('span', { display: 'inline-block', background: 'rgba(58,56,54,.92)', borderRadius: '12px', padding: `${tam * 0.22}px 34px`, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: px(tam * 0.85), color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '1.15' }, lista.map(p => p.t.replace(/[.]$/, '')).join(' '));
    el.appendChild(s);
    return;
  }
  lista.forEach((p, i) => {
    const hi = p.d && pele.hi ? pele.hi : null;
    const s = h('span', {
      display: 'inline-block', marginRight: i < lista.length - 1 ? '0.24em' : '0',
      fontFamily: (hi ? hi.f : pele.f) + ', sans-serif', fontWeight: hi ? hi.p : pele.p,
      fontStyle: (hi ? hi.ital : pele.ital) ? 'italic' : 'normal',
      fontSize: px(tam * (hi ? hi.esc : 1)), color: hi ? (T.legCor || (T.marca && !T.original ? T.marca : hi.cor)) : pele.cor,
      textShadow: hi?.brilho || pele.sombra, textTransform: pele.caixaAlta ? 'uppercase' : (pele.minusculo ? 'lowercase' : 'none'),
      letterSpacing: pele.f === 'Oswald' ? '0.01em' : '-0.01em', lineHeight: '1.08',
    }, p.t);
    if (pele.contorno) { s.style.webkitTextStroke = `${tam * 0.16}px #000`; s.style.paintOrder = 'stroke fill'; }
    el.appendChild(s);
  });
}

function peleDaLegenda(T, mec) {
  if (!mec) return null;
  return mec.pele && T.original ? mec.pele : T.leg;
}

function posicionarLegenda(el, mec, W) {
  Object.assign(el.style, {
    position: 'absolute', top: mec.y + 'px', transform: 'translateY(-50%)', textAlign: mec.alinha || 'center',
    left: px(mec.x ?? 0), width: px(mec.largura ?? W), padding: mec.alinha ? '0' : '0 70px', boxSizing: 'border-box',
    pointerEvents: 'none', zIndex: 5,
  });
}

// ---------------------------------------------------------------- as demonstrações

const FALA = {
  gancho: 'Você posta todo dia e ninguém *compra*?',
  prova: 'Olha o que *aconteceu* quando eu liguei a IA',
  passos: 'São só *três* passos pra vender no direct',
  cta: 'Comenta *IA* que eu te mando',
};

function demo(cfg) {
  if (cfg.tipo === 'zero') return demoZero(cfg);
  return (DEMOS[cfg.formato] || DEMOS['reels-de-negocio'])(cfg);
}

// Nos formatos horizontais (YouTube, aula) a legenda vai em .srt, então as cenas não têm legenda na tela.
const pixelInsert = (cfg, T, horizontal = false) => T.pixel ? [{
  nome: 'Multiplicação', dur: 2.8, fala: 'Ela faz *cem* versões da resposta', leg: horizontal ? null : { y: 1580, n: 4, tam: 60 },
  montar: (ctx) => cenaMultiplica(ctx),
}, {
  nome: 'Cena pixel', dur: 2.6, fala: 'E aí a IA *venceu* a disputa', leg: horizontal ? null : { y: 1500, n: 4, tam: 60 },
  montar: (ctx) => cenaPixel(ctx),
}] : [];

// Reels de Negócio + Pixelado: o formato do estilo Opus Jake (reels-de-negocio/com-pixelado.md).
// Dividido com a câmera embaixo (borda reta em y 770), gráfico cheio e pixel art cheia;
// a câmera nunca fica em tela cheia e a legenda é uma pílula fixa em y 764.
const LEG_OPUS = { y: 764, n: 3, tam: 61 };

function divididoOpus(ctx, conteudo) {
  const g = h('div', caixa(0, 0, ctx.W, ctx.H));
  g.appendChild(camera(ctx, { y: 770, h: 1150, escala: 1, topo: 200 }));
  const cima = fundoGrafico(ctx, 0, 0, 1080, 770);
  const c = card(ctx, 90, 255, 900, 445, '', { pad: 0 });
  c.style.overflow = 'visible';
  cima.appendChild(c);
  g.appendChild(cima);
  conteudo(c, cima);
  return g;
}

function carimbo(ctx, texto, cor, x, y, w, em) {
  const el = h('div', { position: 'absolute', left: px(x), top: px(y), width: px(w), boxSizing: 'border-box', textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'Inter', fontWeight: 900, fontSize: '84px', letterSpacing: '-.01em', color: cor, border: `8px solid ${cor}`, borderRadius: '14px', padding: '6px 20px', background: 'rgba(249,248,246,.92)' }, texto);
  ctx.anima(el, [{ opacity: 0, transform: 'rotate(-10deg) scale(1.6)' }, { opacity: 1, transform: 'rotate(-10deg) scale(1)', offset: .7 }, { opacity: 1, transform: 'rotate(-10deg) translate(4px,-3px)', offset: .85 }, { opacity: 1, transform: 'rotate(-10deg) scale(1)' }], { em, dur: .28, ease: 'cubic-bezier(.3,1.4,.5,1)', som: 'impacto' });
  return el;
}

const GITHUB_PATH = 'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3';

// Personagem do estilo (12 × 8 blocos), o mesmo da referência.
const SIRI = ['..BBBBBBBB..', '..BBBBBBBB..', '..BEBBBBEB..', 'BBBEBBBBEBBB', 'BBBBBBBBBBBB', '..BBBBBBBB..', '..B.B..B.B..', '..B.B..B.B..'];
function siri(cor = '#D97757', p = 10, morto = false) {
  let r = '';
  SIRI.forEach((l, y) => [...l].forEach((c, x) => {
    if (c === '.') return;
    if (c === 'E' && morto) { r += `<text x="${x * p + p / 2}" y="${y * p + p * 0.9}" font-size="${p * 1.3}" text-anchor="middle" fill="#151513" font-family="monospace">×</text>`; return; }
    r += `<rect x="${x * p}" y="${y * p}" width="${p}" height="${p}" fill="${c === 'E' ? '#1A1A1A' : (morto ? '#9a9692' : cor)}"/>`;
  }));
  return `<svg width="${12 * p}" height="${8 * p}" viewBox="0 0 ${12 * p} ${8 * p}" shape-rendering="crispEdges" style="display:block;overflow:visible">${r}</svg>`;
}
const CORES_SIRI = ['#D97757', '#4A90D9', '#E86AA6', '#4CAF50', '#8E5BD9', '#E8B547', '#3FC1C9', '#E5484D'];

// Cemitério em pixel art ao pôr do sol, dentro do cartão do dividido (gancho da referência).
function cemiterio(ctx, c) {
  Object.assign(c.style, { overflow: 'hidden', background: '#3b2230' });
  const ceu = h('div', { position: 'absolute', inset: '0', background: 'linear-gradient(#5b2a4a 0 14%, #8c3a4c 14% 28%, #c4523f 28% 40%, #e8823c 40% 50%, #f2b25a 50% 56%, #4a2b2b 56% 58%, #5a3426 58%)', imageRendering: 'pixelated' });
  const lua = h('div', caixa(700, 60, 84, 84, { background: '#F6D9A0', borderRadius: '50%', boxShadow: '0 0 30px rgba(246,217,160,.6)' }));
  const cerca = h('div', caixa(0, 222, 900, 26, { backgroundImage: 'linear-gradient(90deg, #2a1a1e 6px, transparent 6px)', backgroundSize: '22px 26px', borderTop: '4px solid #2a1a1e', boxSizing: 'border-box' }));
  const arvore = h('div', caixa(790, 120, 80, 130), `<svg viewBox="0 0 80 130" width="80" height="130" shape-rendering="crispEdges"><path d="M36 130 V60 H30 V40 H22 V30 H14 M36 60 H48 V36 H58 V24 H68 M36 80 H24 V70" stroke="#2a1a1e" stroke-width="8" fill="none"/></svg>`);
  c.append(ceu, lua, cerca, arvore);
  const m = h('div', { position: 'absolute', left: '70px', top: '330px' }, siri('#D97757', 11));
  c.appendChild(m);
  ctx.anima(m, [{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)' }], { dur: .5, ease: 'steps(2)', iter: Infinity, dir: 'alternate' });
  const frases = ['Espero que esteja bem', 'Prezado cliente', 'Ótima pergunta!', 'Conforme combinado'];
  frases.forEach((f, i) => {
    const l = h('div', caixa(250 + i * 158, 228, 140, 190, { background: '#C9C6C2', borderRadius: '60px 60px 0 0', border: '5px solid #6b6763', boxSizing: 'border-box', textAlign: 'center', paddingTop: '22px', color: '#3A3836' }),
      `<div style="font:700 28px Silkscreen,monospace">RIP</div><div style="font:italic 400 19px Newsreader,Georgia,serif;line-height:1.1;margin:8px 10px 0">“${f}”</div>`);
    c.appendChild(l);
    ctx.anima(l, [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { em: .25 + i * .55, dur: .25, ease: 'steps(4)', som: 'tum' });
  });
}

// Arena em pixel art em tela cheia, com HUD e duelo até sobrar um (clímax da referência).
function arena(ctx) {
  const { W, H } = ctx;
  const g = h('div', caixa(0, 0, W, H, { overflow: 'hidden', background: '#E9C98F' }));
  const arq = h('div', caixa(0, 0, W, 560, { background: 'repeating-linear-gradient(90deg, #C7533F 0 18px, #9E3B2E 18px 24px, #C7533F 24px 120px)', borderBottom: '14px solid #7A2E24' }));
  for (let fila = 0; fila < 3; fila++) {
    const f = h('div', caixa(0, 40 + fila * 165, W, 120, { backgroundImage: 'radial-gradient(circle at 50% 100%, #3a2a24 0 46px, transparent 47px), repeating-linear-gradient(90deg, #E8C9A0 0 4px, #6b4a3a 4px 8px, #d9a07a 8px 12px)', backgroundSize: '120px 120px, auto' }));
    arq.appendChild(f);
  }
  g.appendChild(arq);
  g.appendChild(h('div', caixa(0, 574, W, H - 574, { backgroundImage: 'radial-gradient(#d4ad6e 3px, transparent 3.5px)', backgroundSize: '70px 54px' })));
  const hud = (html, l, t) => h('div', { position: 'absolute', left: px(l), top: px(t), fontFamily: 'Silkscreen, monospace', fontSize: '40px', color: '#fff', background: '#151513', border: '4px solid #3A3836', padding: '12px 24px', whiteSpace: 'nowrap' }, html);
  const ronda = hud('<span style="color:#E8B547">RODADA 1</span> <span style="font-size:26px">50 DUELOS</span>', 300, 470);
  g.appendChild(ronda);
  ctx.anima(ronda, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'none' }], { em: 0, dur: .2, ease: 'steps(3)' });
  // multidão que vai caindo até sobrar um
  let s = 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 28 && !ctx.estatico; i++) {
    const x = 120 + rnd() * 760, y = 960 + rnd() * 520;
    const p = h('div', { position: 'absolute', left: px(x), top: px(y) }, siri(CORES_SIRI[i % CORES_SIRI.length], 7));
    g.appendChild(p);
    ctx.anima(p, [{ transform: 'translateX(0)' }, { transform: `translateX(${i % 2 ? -14 : 14}px)` }], { dur: .3, ease: 'steps(2)', iter: Infinity, dir: 'alternate' });
    const morto = h('div', { position: 'absolute', left: px(x), top: px(y), opacity: '0' }, siri('#9a9692', 7, true));
    g.appendChild(morto);
    ctx.anima(p, [{ opacity: 1 }, { opacity: 0 }], { em: .5 + i * .05, dur: .05, preso: true });
    ctx.anima(morto, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { em: .5 + i * .05, dur: .6 });
  }
  const restam = hud('RESTAM <span style="color:#E8B547">100</span>', 360, 470);
  const num = restam.querySelector('span');
  g.appendChild(restam);
  ctx.anima(ronda, [{ opacity: 1 }, { opacity: 0 }], { em: .45, dur: .05, preso: true });
  ctx.anima(restam, [{ opacity: 0 }, { opacity: 1 }], { em: .45, dur: .05, som: 'moeda' });
  ctx.tempo(.5, 1.4, k => { num.textContent = String(Math.max(1, Math.round(100 - 99 * (1 - (1 - k) ** 2)))); });
  const rei = h('div', { position: 'absolute', left: '420px', top: '1180px' }, `<div style="width:100px;height:40px;margin:0 auto -6px;background:#E8B547;clip-path:polygon(0 100%,0 0,25% 50%,50% 0,75% 50%,100% 0,100% 100%)"></div>${siri('#4A90D9', 20)}`);
  g.appendChild(rei);
  ctx.anima(rei, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { em: 1.95, dur: .25, ease: 'steps(4)', som: 'confirma' });
  const venc = hud('<span style="color:#E8B547">VENCEDOR</span> <span style="font-size:26px">VENCEU 99</span>', 290, 470);
  g.appendChild(venc);
  ctx.anima(restam, [{ opacity: 1 }, { opacity: 0 }], { em: 1.95, dur: .05, preso: true });
  ctx.anima(venc, [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'none' }], { em: 1.95, dur: .2, ease: 'steps(3)' });
  // No quadro parado (cartão de escolha) fica só o fim: o vencedor.
  if (ctx.estatico) { ronda.remove(); restam.remove(); }
  return g;
}

// O personagem se multiplica até 100, em cima e embaixo da legenda, com contador.
function multiplica100(ctx) {
  const g = fundoGrafico(ctx, 0, 0, 1080, 1920);
  const primeiro = h('div', { position: 'absolute', left: '450px', top: '420px' }, siri('#D97757', 15));
  g.appendChild(primeiro);
  ctx.anima(primeiro, [{ opacity: 1 }, { opacity: 0 }], { em: .55, dur: .1, preso: true });
  for (let i = 0; i < 100; i++) {
    const metade = i < 50 ? 0 : 1, k = i % 50;
    const x = 75 + (k % 10) * 96, y = (metade ? 860 : 250) + Math.floor(k / 10) * 84;
    const p = h('div', { position: 'absolute', left: px(x), top: px(y) }, siri(CORES_SIRI[(i * 3) % CORES_SIRI.length], 6));
    g.appendChild(p);
    ctx.anima(p, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { em: .55 + i * .012, dur: .15, som: i % 25 === 0 ? 'pop' : null });
  }
  const cont = h('div', { position: 'absolute', left: '0', width: '1080px', top: '1330px', textAlign: 'center', fontFamily: 'Inter', fontWeight: 900, fontSize: '96px', color: '#1A1A1A', letterSpacing: '-.03em' });
  const num = h('span', {}, '1');
  cont.append(h('span', { color: '#D97757' }, '×'), num);
  g.appendChild(cont);
  ctx.tempo(.55, 1.25, k => { num.textContent = String(Math.max(1, Math.round(100 * k))); });
  if (ctx.estatico) primeiro.remove();
  return g;
}

function demoRnPixel() {
  return [
    { nome: 'Gancho', dur: 2.8, fala: 'Se a IA continua te dando *respostas* ruins', leg: LEG_OPUS,
      montar: (ctx) => divididoOpus(ctx, (c) => cemiterio(ctx, c)) },
    { nome: 'Gráfico', dur: 2.6, fala: 'Faz *cem* versões da resposta', leg: LEG_OPUS,
      montar: (ctx) => multiplica100(ctx) },
    { nome: 'Dividido', dur: 2.6, fala: 'E é um repositório *gratuito*', leg: LEG_OPUS,
      montar: (ctx) => divididoOpus(ctx, (c) => {
        const repo = h('div', { position: 'absolute', inset: '0', padding: '34px 44px', fontFamily: 'Inter', color: '#1A1A1A' });
        repo.innerHTML = `<div style="display:flex;align-items:center;gap:14px;font-size:30px;white-space:nowrap"><svg width="40" height="40" viewBox="0 0 24 24"><path fill="#1A1A1A" d="${GITHUB_PATH}"/></svg><span style="color:#8A8783">seu-usuario /</span><b>atendimento-ia</b><span style="font:600 20px 'JetBrains Mono';border:2px solid #E6E4E1;border-radius:999px;padding:2px 12px;color:#8A8783">Public</span></div>`;
        const lista = h('div', { marginTop: '22px', border: '2px solid #E6E4E1', borderRadius: '14px', overflow: 'hidden' });
        ['📁  skills', '📁  templates', '📄  README.md', '📄  LICENSE'].forEach((t, i) => {
          const l = h('div', { padding: '13px 22px', fontSize: '26px', fontFamily: "'JetBrains Mono'", borderTop: i ? '2px solid #E6E4E1' : 'none', background: '#fff', whiteSpace: 'pre' }, t);
          lista.appendChild(l);
          entra(ctx, l, .15 + i * .12, { som: null });
        });
        repo.appendChild(lista);
        c.appendChild(repo);
        c.appendChild(carimbo(ctx, 'GRÁTIS', '#2DA44E', 230, 150, 440, 1.45));
      }) },
    { nome: 'Pixel art', dur: 2.8, fala: 'Elas lutam até sobrar só a *melhor*', leg: LEG_OPUS,
      montar: (ctx) => arena(ctx) },
    { nome: 'Chamada', dur: 3.4, fala: 'Comenta *IA* que eu te envio na DM', leg: LEG_OPUS,
      montar: (ctx) => divididoOpus(ctx, (c) => {
        const bola = (n) => `<div style="width:48px;height:48px;border-radius:50%;background:#D97757;color:#fff;display:grid;place-items:center;font:800 26px Inter;flex:none">${n}</div>`;
        const corpo = h('div', { position: 'absolute', inset: '0', padding: '0 46px', fontFamily: 'Inter', color: '#1A1A1A', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '38px' });
        const l1 = h('div', { display: 'flex', alignItems: 'center', gap: '22px' }, `${bola(1)}<div style="width:92px;height:92px;border-radius:50%;padding:4px;box-sizing:border-box;background:linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5);flex:none"><div style="width:100%;height:100%;border-radius:50%;border:4px solid #F9F8F6;box-sizing:border-box;background:linear-gradient(135deg,#bde0fe,#a0c4ff)"></div></div><div style="flex:1"><div style="font:700 40px Inter">Seguir</div><div style="font:500 26px 'JetBrains Mono';color:#8A8783">@seuperfil</div></div>`);
        const bt = h('div', { font: '700 28px Inter', color: '#fff', background: '#0095F6', borderRadius: '12px', padding: '14px 26px', whiteSpace: 'nowrap' }, 'Seguir');
        l1.appendChild(bt);
        ctx.anima(bt, [{ background: '#0095F6', color: '#fff' }, { background: '#EFEFEF', color: '#1A1A1A' }], { em: .8, dur: .05, som: 'clique' });
        ctx.tempo(.8, .01, k => { bt.textContent = k > 0 ? 'Seguindo' : 'Seguir'; });
        const l2 = h('div', { display: 'flex', alignItems: 'center', gap: '22px' }, `${bola(2)}<div style="font:700 40px Inter;flex:none">Comente</div>`);
        const campo = h('div', { flex: '1', height: '80px', borderRadius: '14px', border: '3px solid #E6E4E1', boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: '0 24px', font: "800 40px 'JetBrains Mono'", letterSpacing: '.06em' });
        l2.appendChild(campo);
        ctx.tempo(1.2, .3, k => { campo.textContent = 'IA'.slice(0, Math.round(2 * k)) + (k < 1 ? '▌' : ''); });
        ctx.anima(campo, [{ borderColor: '#E6E4E1' }, { borderColor: '#D97757' }], { em: 1.5, dur: .15, som: 'confirma' });
        const dm = h('div', { font: "600 26px 'JetBrains Mono'", color: '#8A8783', textAlign: 'center' }, '✈ Te envio na DM');
        corpo.append(l1, l2, dm);
        c.appendChild(corpo);
        entra(ctx, dm, 2.3, { som: null });
      }) },
  ];
}

// ---------------------------------------------------------------- formatos de efeito

// Peças dos formatos de efeito: imitam, com o bonequinho, os efeitos do fx.py
// (claude-video-effects). A edição de verdade usa o fx.py original na gravação.
const VIDRO = { background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1.5px solid rgba(255,255,255,.32)', borderRadius: '34px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', color: '#fff', fontFamily: 'Inter, Archivo, sans-serif', boxSizing: 'border-box' };
const CAPAS = ['post', 'cidade', 'mesa', 'loja', 'grafico', 'perfil', 'noticia', 'chat'];

// Câmera cheia em camadas: fundo da gravação, o que fica atrás da pessoa, a pessoa
// recortada e, fora do zoom, o que fica na frente.
function fxCena(ctx, atras, frente, o = {}) {
  const g = h('div', caixa(0, 0, ctx.W, ctx.H, { overflow: 'hidden', background: '#000', textAlign: 'left' }));
  const cam = h('div', caixa(0, 0, ctx.W, ctx.H), '', 'fx-cam');
  const fundo = camera(ctx);
  const tras = h('div', caixa(0, 0, ctx.W, ctx.H));
  const pessoa = camera(ctx, { recorte: true });
  if (o.cinza) { fundo.style.filter = 'grayscale(1) contrast(1.1) brightness(.8)'; pessoa.style.filter = 'grayscale(1) contrast(1.15)'; }
  cam.append(fundo, tras, pessoa);
  if (o.quente) cam.appendChild(h('div', { position: 'absolute', inset: '0', background: 'rgba(255,160,80,.10)', pointerEvents: 'none' }));
  const fr = h('div', caixa(0, 0, ctx.W, ctx.H));
  g.append(cam, fr);
  if (atras) atras(tras, fr);
  if (frente) frente(fr);
  return g;
}

// Palavra gigante atrás da cabeça (backdrop-word, huge-strike, capa).
function fxPalavra(ctx, texto, o = {}) {
  const tam = o.tam ?? caber(texto, 330, 1010, 0.68);
  const w = h('div', { position: 'absolute', left: '0', width: '1080px', top: px(o.top ?? 200), textAlign: 'center', fontFamily: o.fonte || "'Archivo Black', Archivo, Inter, sans-serif", fontWeight: o.peso ?? 900, fontSize: px(tam), lineHeight: '1', color: o.cor || '#F4E9D8', letterSpacing: '-0.02em', whiteSpace: 'nowrap' });
  const s = h('span', { display: 'inline-block' }, texto);
  w.appendChild(s);
  medirECaber(ctx, s, 1040);
  ctx.anima(w, [{ opacity: 0, transform: 'translateY(-90px)' }, { opacity: 1, transform: 'none' }], { em: o.em ?? .2, dur: .4, ease: 'cubic-bezier(.3,1.4,.5,1)', som: o.som });
  return w;
}

function fxZoom(ctx, el, z, cx, cy, em, dur) {
  if (!el) return;
  el.style.transformOrigin = `${cx}px ${cy}px`;
  ctx.anima(el, [{ transform: 'scale(1)' }, { transform: `scale(${z})`, offset: .18 }, { transform: `scale(${z})`, offset: .85 }, { transform: 'scale(1)' }], { em, dur, ease: 'ease-in-out' });
}

function fxSoco(ctx, el, z, em) {
  if (!el) return;
  el.style.transformOrigin = '540px 690px';
  ctx.anima(el, [{ transform: 'scale(1)' }, { transform: `scale(${z})`, offset: .12 }, { transform: `scale(${z})`, offset: .7 }, { transform: 'scale(1)' }], { em, dur: 1.4, ease: 'ease-out' });
}

function fxRelogio(ctx, em) {
  const g = h('div', caixa(430, 210, 220, 250, { background: '#1B1B1D', borderRadius: '26px', boxShadow: '0 20px 50px rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', fontFamily: "'Archivo Black', Archivo, Inter", fontWeight: 900, fontSize: '190px', color: '#F4E9D8', overflow: 'hidden' }));
  const n = h('span', {}, '3');
  g.append(n, h('div', caixa(0, 124, 220, 3, { background: '#000' })));
  ctx.anima(g, [{ opacity: 0, transform: 'translateY(-30px)' }, { opacity: 1, transform: 'none' }], { em, dur: .3 });
  ctx.tempo(em + .3, 1.6, (k) => { n.textContent = String(Math.max(1, 3 - Math.floor(k * 3))); });
  return g;
}

// Card de lista ao lado da cabeça (todo): cada item ganha ✓ no tempo dele.
function fxLista(ctx, titulo, itens, tempos) {
  const c = h('div', caixa(712, 740, 330, 120 + itens.length * 64, { background: 'rgba(250,250,247,.96)', borderRadius: '26px', boxShadow: '0 20px 50px rgba(0,0,0,.35)', padding: '26px 28px', boxSizing: 'border-box', fontFamily: 'Inter, Archivo, sans-serif', color: '#111' }));
  const cont = h('span', { fontSize: '22px', color: '#8A8A8E' }, `0 de ${itens.length}`);
  const topo = h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' });
  topo.append(h('b', { fontSize: '26px', color: '#E8873A', letterSpacing: '.04em' }, titulo), cont);
  c.appendChild(topo);
  itens.forEach((t, i) => {
    const l = h('div', { display: 'flex', alignItems: 'center', gap: '16px', height: '64px', fontSize: '30px', fontWeight: 600 });
    const caixinha = h('span', { width: '30px', height: '30px', borderRadius: '8px', border: '3px solid #C7C7CC', boxSizing: 'border-box', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '20px' });
    const txt = h('span', {}, t);
    l.append(caixinha, txt);
    c.appendChild(l);
    ctx.anima(caixinha, [{ background: 'transparent', borderColor: '#C7C7CC' }, { background: '#34C759', borderColor: '#34C759' }], { em: tempos[i], dur: .15, som: i === itens.length - 1 ? 'confirma' : null });
    ctx.anima(txt, [{ color: '#111', textDecoration: 'none' }, { color: '#9A9A9E', textDecoration: 'line-through' }], { em: tempos[i], dur: .15 });
    ctx.tempo(tempos[i], .05, (k) => { if (k >= 1) { caixinha.textContent = '✓'; cont.textContent = `${i + 1} de ${itens.length}`; } else if (i === 0) { cont.textContent = `0 de ${itens.length}`; } });
  });
  ctx.anima(c, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { em: .3, dur: .35 });
  return c;
}

// Lista de tarefas embaixo do queixo (checklist): cada passo gira e fica verde.
function fxTarefas(ctx, quem, itens) {
  const c = h('div', caixa(90, 1120, 900, 140 + itens.length * 96, { ...VIDRO, background: 'rgba(20,20,22,.62)', borderRadius: '30px', padding: '30px 36px' }));
  const topo = h('div', { display: 'flex', justifyContent: 'space-between', fontSize: '30px', fontWeight: 700, marginBottom: '18px' });
  const cont = h('span', { fontSize: '24px', color: '#8E8E93', fontWeight: 500 }, `0 de ${itens.length}`);
  topo.append(h('span', {}, `<span style="color:#FF6B5A">●</span> ${quem} está editando`), cont);
  c.appendChild(topo);
  itens.forEach(([t, d], i) => {
    const em = .5 + i * .6;
    const l = h('div', { display: 'flex', alignItems: 'center', gap: '22px', height: '96px', fontSize: '34px', fontWeight: 600 });
    const bola = h('span', { width: '40px', height: '40px', borderRadius: '50%', border: '4px solid rgba(255,255,255,.3)', borderTopColor: '#fff', boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: '24px', flex: 'none' });
    l.append(bola, h('span', { flex: '1' }, t), h('span', { fontFamily: "'Space Mono', 'JetBrains Mono', monospace", fontSize: '24px', color: '#34D36E' }, d));
    c.appendChild(l);
    ctx.anima(bola, [{ transform: 'rotate(0)' }, { transform: 'rotate(720deg)' }], { em: em - .4, dur: .4, ease: 'linear' });
    ctx.anima(bola, [{ background: 'transparent', border: '4px solid rgba(255,255,255,.3)' }, { background: '#34C759', border: '4px solid #34C759' }], { em, dur: .12, som: i === itens.length - 1 ? 'confirma' : null });
    ctx.tempo(em, .05, (k) => { bola.textContent = k >= 1 ? '✓' : ''; if (k >= 1) cont.textContent = `${i + 1} de ${itens.length}`; });
  });
  ctx.anima(c, [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { em: .1, dur: .35 });
  return c;
}

function fxMira(ctx, tag, em) {
  const g = h('div', caixa(350, 450, 380, 470));
  const canto = (l, t, r) => h('div', caixa(l, t, 70, 70, { borderColor: '#fff', borderStyle: 'solid', borderWidth: '0', ...r }));
  g.append(
    canto(0, 0, { borderTopWidth: '8px', borderLeftWidth: '8px' }), canto(310, 0, { borderTopWidth: '8px', borderRightWidth: '8px' }),
    canto(0, 400, { borderBottomWidth: '8px', borderLeftWidth: '8px' }), canto(310, 400, { borderBottomWidth: '8px', borderRightWidth: '8px' }));
  g.appendChild(h('div', { position: 'absolute', left: '0', width: '380px', top: '492px', textAlign: 'center' }, `<span style="background:rgba(255,255,255,.9);color:#111;font:700 26px Inter,Archivo,sans-serif;padding:6px 16px;border-radius:8px;letter-spacing:.08em">${tag}</span>`));
  ctx.anima(g, [{ opacity: 0, transform: 'scale(1.5)' }, { opacity: 1, transform: 'scale(1)' }], { em, dur: .25, som: 'clique' });
  return g;
}

function fxSeta(ctx, frente, texto, cor, em) {
  const pausa = h('div', caixa(60, 90, 84, 84, { background: 'rgba(20,20,22,.8)', borderRadius: '18px', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '40px', fontFamily: 'Inter, Archivo, sans-serif', fontWeight: 900 }), '❚❚');
  const rot = h('div', { position: 'absolute', left: '0', width: '1080px', textAlign: 'center', top: '140px', fontFamily: "'Permanent Marker', 'Caveat', cursive", fontSize: '70px', color: cor }, texto);
  const seta = h('div', caixa(0, 0, 1080, 1920), `<svg viewBox="0 0 1080 1920" width="1080" height="1920" style="position:absolute;inset:0;overflow:visible"><path d="M540 255 C 575 305 575 365 540 420" fill="none" stroke="${cor}" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><path d="M579 398 L540 420 L540 375" fill="none" stroke="${cor}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`);
  frente.append(pausa, rot, seta);
  ctx.anima(pausa, [{ opacity: 0 }, { opacity: 1 }], { em, dur: .1, som: 'clique' });
  ctx.anima(rot, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { em: em + .1, dur: .25 });
  const [p1, p2] = seta.querySelectorAll('path');
  ctx.anima(p1, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { em: em + .3, dur: .5, ease: 'ease-out' });
  ctx.anima(p2, [{ opacity: 0 }, { opacity: 1 }], { em: em + .8, dur: .1 });
}

function fxSelecao(ctx, frente, texto, em) {
  const g = h('div', caixa(330, 170, 420, 260, { border: '3px dashed #3B82F6', background: 'rgba(40,80,160,.35)', display: 'grid', placeItems: 'center', fontFamily: "'Playfair Display', 'Instrument Serif', serif", fontWeight: 700, fontSize: '170px', color: '#fff', transformOrigin: '0 0' }), texto);
  [[-10, -10], [400, -10], [-10, 240], [400, 240]].forEach(([l, t]) => g.appendChild(h('div', caixa(l, t, 20, 20, { background: '#fff', border: '3px solid #3B82F6', boxSizing: 'border-box' }))));
  const cursor = h('div', { position: 'absolute', left: '745px', top: '425px', fontSize: '60px', color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,.5)' }, '➚');
  cursor.style.transform = 'rotate(-90deg)';
  frente.append(g, cursor);
  ctx.anima(g, [{ opacity: 0 }, { opacity: 1 }], { em, dur: .2 });
  ctx.anima(g, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }], { em: em + 1, dur: .6, ease: 'ease-in-out' });
  ctx.anima(cursor, [{ transform: 'rotate(-90deg) translate(0,0)' }, { transform: 'rotate(-90deg) translate(-50px, 75px)' }], { em: em + 1, dur: .6, ease: 'ease-in-out', som: 'clique' });
}

function fxWidgets(ctx, atras, frente) {
  const tiles = [
    [40, 120, 270, 280, `<div style="font-size:24px;opacity:.85">● Claude</div><div style="font:900 104px/1 'Archivo Black',Archivo,Inter,sans-serif;letter-spacing:-.04em;margin-top:10px">51K</div><div style="font-size:24px;opacity:.85;margin-top:8px">seguidores<br>em 1 ano</div>`],
    [40, 430, 270, 300, `<div style="font-size:24px;font-weight:700">Melhores reels</div><div style="font:900 56px Inter,Archivo,sans-serif;color:#FF6B5A">197K</div><div style="display:flex;gap:12px;align-items:flex-end;height:120px">${[100, 74, 64, 40, 26].map(v => `<div style="width:36px;height:${v}%;background:#FF6B5A;border-radius:6px"></div>`).join('')}</div>`],
    [40, 760, 270, 210, `<div style="font-size:26px;color:#FF6B5A;font-weight:800">QUA</div><div style="font:900 64px Inter,Archivo,sans-serif">05</div><div style="font-size:22px;background:#FF6B5A;border-radius:8px;padding:2px 10px;display:inline-block">Postar 2 reels</div>`],
    [720, 120, 320, 120, `<div style="font-size:26px">● Renderizando</div><div style="height:12px;background:rgba(255,255,255,.3);border-radius:6px;margin-top:16px"><div style="width:94%;height:100%;background:#fff;border-radius:6px"></div></div>`],
    [720, 270, 320, 130, `<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font:800 34px Inter,Archivo,sans-serif">Matheus</div><div style="font-size:22px;opacity:.8">@seuperfil</div></div><div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#f9a94b,#d6249f)"></div></div>`],
    [720, 430, 320, 190, `<div style="display:flex;gap:16px;align-items:center"><div style="width:76px;height:76px;border-radius:16px;background:#E8613A;display:grid;place-items:center;font-size:44px">✳</div><div><div style="font-size:18px;opacity:.7">EDITANDO AGORA</div><div style="font:800 28px Inter,Archivo,sans-serif">Máquina</div></div></div><div style="text-align:center;font-size:34px;margin-top:14px">⏮ ▶ ⏭</div>`],
    [800, 650, 220, 220, `<div style="width:150px;height:150px;margin:0 auto;border-radius:50%;border:14px solid #34C759;box-sizing:border-box;display:grid;place-items:center;font:900 52px Inter,Archivo,sans-serif">4K</div>`],
  ];
  tiles.forEach(([x, y, w, hh, html], i) => {
    const t = h('div', caixa(x, y, w, hh, { ...VIDRO, padding: '24px 26px' }), html);
    atras.appendChild(t);
    ctx.anima(t, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { em: .2 + i * .08, dur: .32, ease: 'cubic-bezier(.3,1.5,.5,1)', som: i === 0 ? 'impacto' : null });
  });
  const pilula = h('div', caixa(250, 1560, 580, 100, { ...VIDRO, borderRadius: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap', fontSize: '40px', fontWeight: 600 }), 'Editado pelo <span style="color:#E8613A;margin-left:10px">Claude</span>');
  frente.appendChild(pilula);
  ctx.anima(pilula, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { em: .9, dur: .35 });
}

function fxGrafico(ctx, rotulo, de, ate, suf, x, y, w, hh, em) {
  const c = h('div', caixa(x, y, w, hh, { ...VIDRO, background: 'rgba(255,255,255,.12)', padding: '34px 40px', overflow: 'hidden' }));
  const num = h('div', { position: 'absolute', right: '40px', top: '24px', font: "900 96px/1 'Archivo Black', Archivo, Inter", letterSpacing: '-.04em' }, de + suf);
  c.append(h('div', { fontFamily: "'Space Mono', 'JetBrains Mono', monospace", fontSize: '26px', opacity: .85, letterSpacing: '.08em' }, rotulo), num);
  const graf = h('div', caixa(30, hh * .38, w - 60, hh * .56), `<svg viewBox="0 0 800 300" width="100%" height="100%" preserveAspectRatio="none" style="overflow:visible"><path d="M0 290 C120 290 200 270 300 240 S520 170 620 110 S760 30 800 10 L800 300 L0 300 Z" fill="rgba(52,211,110,.28)" opacity="0"/><path d="M0 290 C120 290 200 270 300 240 S520 170 620 110 S760 30 800 10" fill="none" stroke="#34D36E" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
  c.appendChild(graf);
  const [area, linha] = graf.querySelectorAll('path');
  ctx.anima(c, [{ opacity: 0, transform: 'translateY(40px) scale(.96)' }, { opacity: 1, transform: 'none' }], { em, dur: .4 });
  ctx.anima(linha, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { em: em + .3, dur: 1.6, ease: 'cubic-bezier(.4,0,.2,1)' });
  ctx.anima(area, [{ opacity: 0 }, { opacity: 1 }], { em: em + 1.2, dur: .6 });
  ctx.tempo(em + .3, 1.6, (k) => { const v = de + (ate - de) * (1 - (1 - k) ** 3); num.textContent = (ate < 10 ? v.toFixed(k >= 1 ? 0 : 1).replace('.', ',') : Math.round(v)) + suf; }, 'tique');
  ctx.som(em + 1.9, 'confirma');
  return c;
}

function fxBento(ctx, frente) {
  const t = [
    [60, 1170, 300, 280, `<div style="width:150px;height:150px;margin:6px auto 0;border-radius:50%;background:conic-gradient(#FF8A5B 0 29%, rgba(255,255,255,.18) 29% 100%);display:grid;place-items:center"><div style="width:110px;height:110px;border-radius:50%;background:rgba(40,40,44,.7);display:grid;place-items:center;font:900 40px Inter,Archivo,sans-serif">29%</div></div><div style="text-align:center;font-size:20px;opacity:.8;margin-top:12px">dos seguidores</div>`],
    [60, 1480, 300, 170, `<div style="font:900 64px Inter,Archivo,sans-serif">672K</div><div style="font-size:20px;opacity:.8">views · top 7 reels</div>`],
    [780, 1170, 240, 480, `<div style="font-size:20px;opacity:.8">MELHORES REELS · MIL</div><div style="display:flex;gap:14px;align-items:flex-end;height:360px;margin-top:20px">${[100, 71, 63, 42, 25].map(v => `<div style="flex:1;height:${v}%;background:${v === 100 ? '#34D36E' : 'rgba(255,255,255,.75)'};border-radius:8px"></div>`).join('')}</div>`],
  ];
  t.forEach(([x, y, w, hh, html], i) => {
    const el = h('div', caixa(x, y, w, hh, { ...VIDRO, padding: '24px' }), html);
    frente.appendChild(el);
    ctx.anima(el, [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { em: .5 + i * .15, dur: .35 });
  });
}

function fxCard(T, i, w, hh) {
  return h('div', { position: 'absolute', left: '0', top: '0', width: px(w), height: px(hh), borderRadius: '16px', overflow: 'hidden', boxShadow: '0 14px 30px rgba(0,0,0,.45)', border: '3px solid rgba(255,255,255,.85)', background: '#fff' }, imagem(CAPAS[i % CAPAS.length], T));
}

// Cards girando em volta da cabeça (orbit, carousel-spin): os de baixo passam na
// frente da pessoa, os de cima passam atrás.
function fxOrbita(ctx, T, o) {
  const dur = 3.4;
  let tras, frente;
  const g = fxCena(ctx, (a, f) => { tras = a; frente = f; });
  const w = o.w, hh = Math.round(o.w * 1.6);
  const cards = Array.from({ length: o.n }, (_, i) => {
    const a = fxCard(T, i, w, hh), b = fxCard(T, i, w, hh);
    tras.appendChild(a); frente.appendChild(b);
    return [a, b];
  });
  ctx.anima(g.lastChild, [{ opacity: 0 }, { opacity: 1 }], { em: 0, dur: .3 });
  ctx.tempo(0, dur, (k) => {
    const giro = (o.freia ? 1 - (1 - k) ** 3 : k) * Math.PI * 2 * o.voltas;
    cards.forEach(([a, b], i) => {
      const ang = giro + i * Math.PI * 2 / o.n;
      const x = 540 + o.rx * Math.cos(ang) - w / 2, y = o.cy + o.ry * Math.sin(ang) - hh / 2;
      const prof = Math.sin(ang);
      const esc = 0.72 + 0.28 * (prof + 1) / 2;
      const giroY = o.freia ? ` rotateY(${Math.round(-Math.cos(ang) * 50)}deg)` : '';
      const st = `translate(${x}px, ${y}px) scale(${esc})${giroY}`;
      a.style.transform = st; b.style.transform = st;
      a.style.visibility = prof > 0 ? 'hidden' : 'visible';
      b.style.visibility = prof > 0 ? 'visible' : 'hidden';
    });
  });
  if (o.freia) ctx.som(dur - .2, 'impacto');
  return g;
}

// Capas se abrindo em leque atrás da cabeça, uma por vez (fan-build).
function fxLeque(ctx, T, atras) {
  const n = 11;
  for (let i = 0; i < n; i++) {
    const ang = -75 + i * (150 / (n - 1));
    const c = fxCard(T, i, 150, 240);
    c.style.transformOrigin = '75px 640px';
    c.style.left = '465px'; c.style.top = '80px';
    atras.appendChild(c);
    ctx.anima(c, [{ opacity: 0, transform: 'rotate(0deg) scale(.7)' }, { opacity: 1, transform: `rotate(${ang}deg)` }], { em: .2 + i * .14, dur: .3, ease: 'cubic-bezier(.3,1.3,.5,1)' });
  }
}

// A pessoa encolhe pro centro da grade 3 × 3 do perfil (place-in-grid).
function fxGrade(ctx, T) {
  const g = h('div', caixa(0, 0, ctx.W, ctx.H, { overflow: 'hidden', background: '#000', textAlign: 'left' }));
  g.appendChild(camera(ctx, { desfoque: 16, escurecer: .2 }));
  g.appendChild(h('div', { position: 'absolute', inset: '0', background: 'rgba(240,236,230,.35)' }));
  const views = ['1,8M', '2,4M', '3,4M', '312K', '3,1M', '847K', '268K', '1,2M', '596K'];
  const W = 300, H = 400, gap = 18, x0 = (1080 - (3 * W + 2 * gap)) / 2, y0 = 300;
  for (let i = 0; i < 9; i++) {
    const x = x0 + (i % 3) * (W + gap), y = y0 + Math.floor(i / 3) * (H + gap);
    const t = h('div', caixa(x, y, W, H, { borderRadius: '14px', overflow: 'hidden', boxShadow: '0 14px 30px rgba(0,0,0,.25)', border: i === 4 ? '4px solid #FF8A5B' : 'none' }));
    if (i === 4) t.appendChild(camera(ctx, { w: W, h: H, escala: .33, topo: 70 }));
    else t.innerHTML = imagem(CAPAS[i % CAPAS.length], T);
    t.appendChild(h('div', { position: 'absolute', left: '14px', bottom: '10px', font: '700 26px Inter, Archivo, sans-serif', color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,.7)' }, `▷ ${views[i]}`));
    g.appendChild(t);
    if (i === 4) ctx.anima(t, [{ transform: 'scale(3.4)', opacity: 1 }, { transform: 'scale(1)', opacity: 1 }], { em: .1, dur: .5, ease: 'cubic-bezier(.65,0,.35,1)', som: 'impacto' });
    else ctx.anima(t, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { em: .7 + i * .06, dur: .2 });
  }
  return g;
}

// Reels se empilhando atrás da cabeça (noise).
function fxPilha(ctx, T, atras) {
  const pos = [[90, 160, -8], [760, 140, 7], [300, 90, 4], [600, 260, -6], [40, 520, 5], [820, 480, -4], [430, 40, -3], [180, 330, 9]];
  pos.forEach(([x, y, r], i) => {
    const c = fxCard(T, i, 220, 350);
    c.style.left = px(x); c.style.top = px(y);
    atras.appendChild(c);
    ctx.anima(c, [{ opacity: 0, transform: `rotate(${r}deg) scale(1.3)` }, { opacity: 1, transform: `rotate(${r}deg) scale(1)` }], { em: .2 + i * .25, dur: .18 });
  });
}

// A grade do perfil enche a parede atrás (profile-wall).
function fxParede(ctx, T, atras) {
  const p = h('div', caixa(60, 90, 960, 660, { background: 'rgba(18,18,20,.92)', borderRadius: '26px', padding: '20px 26px', boxSizing: 'border-box', overflow: 'hidden' }));
  p.appendChild(h('div', { display: 'flex', justifyContent: 'space-around', font: '600 28px Inter, Archivo, sans-serif', color: '#8E8E93', marginBottom: '18px' }, '<span>Posts</span><span style="color:#fff;border-bottom:3px solid #fff;padding-bottom:6px">Reels</span><span>Marcados</span>'));
  const grade = h('div', { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' });
  for (let i = 0; i < 8; i++) {
    const c = h('div', { height: '260px', borderRadius: '8px', overflow: 'hidden' }, imagem(CAPAS[i % CAPAS.length], T));
    grade.appendChild(c);
    ctx.anima(c, [{ opacity: 0 }, { opacity: 1 }], { em: .2 + i * .07, dur: .2 });
  }
  p.appendChild(grade);
  atras.appendChild(p);
  ctx.anima(p, [{ opacity: 0, transform: 'translateY(-30px)' }, { opacity: 1, transform: 'none' }], { em: .1, dur: .35 });
}

function fxContagem(ctx, n, rotulo, em) {
  const c = h('div', caixa(150, 1330, 780, 300, { ...VIDRO, padding: '30px 40px', textAlign: 'center' }));
  const num = h('div', { font: "900 120px/1 'Archivo Black', Archivo, Inter", letterSpacing: '-.04em' }, '0');
  c.append(num, h('div', { fontSize: '40px', fontWeight: 700, marginTop: '6px' }, rotulo),
    h('div', { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '22px', fontSize: '24px', justifyContent: 'center' }, '<span style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#f9a94b,#d6249f)"></span><b>seuperfil</b><span style="background:#2B2B2E;border-radius:10px;padding:6px 18px">Seguindo</span>'));
  ctx.anima(c, [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { em, dur: .35 });
  ctx.tempo(em + .2, 1.8, (k) => { num.textContent = Math.round(n * (1 - (1 - k) ** 3)).toLocaleString('pt-BR'); }, 'tique');
  ctx.som(em + 2, 'confirma');
  return c;
}

const DEMOS = {
  'reels-de-negocio': (cfg) => {
    const T = resolverVisual(cfg);
    if (T.pixel) return demoRnPixel();
    const [l1, l2] = tituloCapa(cfg, ['Posta todo dia', 'mas não vende nada?']);
    return [
      { nome: 'Gancho', dur: 3.2, fala: FALA.gancho, leg: { y: 1174, um: true, tam: 96, pele: T.original ? 'rn' : null, depois: .7 },
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, ctx.W, ctx.H));
          g.appendChild(camera(ctx));
          const fila = h('div', caixa(0, 615, 2000, 410));
          for (let i = 0; i < 7; i++) fila.appendChild(card(ctx, 40 + i * 260, 0, 230, 410, `<div style="height:100%;border-radius:10px;opacity:.85">${imagem(['post', 'grafico', 'chat', 'perfil', 'noticia', 'post', 'chat'][i], ctx.T)}</div>`, { pad: 10 }));
          g.appendChild(fila);
          ctx.anima(fila, [{ transform: 'translateX(0)' }, { transform: 'translateX(-200px)' }], { dur: 3.2, ease: 'linear' });
          g.appendChild(camera(ctx, { recorte: true }));
          g.appendChild(capa(ctx, l1, l2, 250, { tipo: T.original ? 'rn' : null, tam: 80 }));
          return g;
        } },
      { nome: 'Tela dividida', dur: 3.2, fala: FALA.prova, leg: { y: 900, n: 4, tam: 56 },
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, ctx.W, ctx.H));
          g.appendChild(fundoGrafico(ctx, 0, 0, 1080, 960));
          g.appendChild(camera(ctx, { y: 960, h: 960, escala: .62, topo: 90 }));
          [['@ana.paula', 'quero comprar! 😍'], ['@lucas_m', 'como faço pra pagar?'], ['@studio.bia', 'acabei de comprar ✅']].forEach(([n, t], i) => {
            const p = notificacao(ctx, 110, 150 + i * 140, 860, n, t);
            g.appendChild(p); entra(ctx, p, .3 + i * .55);
          });
          return g;
        } },
      { nome: 'Animação', dur: 3.6, fala: FALA.passos, leg: { y: 1130, n: 4, tam: 56 },
        montar: (ctx) => {
          const g = fundoGrafico(ctx, 0, 0, 1080, 1920, { manchasEm: [[0.85, 0.12], [0.15, 0.9]] });
          g.appendChild(titulo(ctx, '3 passos pra', 'vender no *direct*', 200));
          g.appendChild(listaPassos(ctx, 110, 470, 860, ['Responder rápido', 'Mandar o link', 'Fechar a venda'], [.6, 1.4, 2.2]));
          return g;
        } },
      ...pixelInsert(cfg, T),
      { nome: 'Chamada', dur: 2.8, fala: FALA.cta, leg: { y: 1174, um: true, tam: 96, pele: T.original ? 'rn' : null },
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, ctx.W, ctx.H));
          g.appendChild(camera(ctx));
          const p = notificacao(ctx, 110, 1450, 860, '@voce', 'comentou: IA');
          g.appendChild(p); entra(ctx, p, .9, { som: 'confirma' });
          return g;
        } },
    ];
  },

  'reels-com-broll': (cfg) => {
    const T = resolverVisual(cfg);
    const empilhada = (ctx, cima, branca, laranja) => {
      const pele = T.pixel ? 'pixel' : (T.original || T.leg === 'noite') ? 'noite' : 'claro';
      const b = h('div', { position: 'absolute', left: '0', width: px(ctx.W), top: '1060px', textAlign: 'center' });
      const sup = h('div', { fontFamily: pele === 'pixel' ? "'JetBrains Mono'" : pele === 'claro' ? 'Poppins' : 'Inter', fontWeight: pele === 'pixel' ? 800 : 500, fontSize: '46px', color: '#fff', textShadow: '0 3px 14px rgba(0,0,0,.6)', textAlign: 'left', display: 'inline-block', width: '700px', textTransform: pele === 'pixel' ? 'uppercase' : 'none', letterSpacing: pele === 'pixel' ? '.08em' : '0' }, cima);
      const linha = h('div', { display: 'inline-flex', justifyContent: 'center', alignItems: 'baseline', gap: '24px', whiteSpace: 'nowrap' });
      medirECaber(ctx, linha, ctx.W - 140);
      const tamLinha = Math.min(120, Math.floor(900 / (branca.length * 0.62 + laranja.length * (pele === 'pixel' ? 0.9 : 0.55) + 0.4)));
      const br = h('span', { fontFamily: pele === 'claro' ? 'Poppins' : 'Inter', fontWeight: pele === 'pixel' ? 900 : 800, fontSize: tamLinha + 'px', color: '#fff', textShadow: '0 6px 28px rgba(0,0,0,.55)', letterSpacing: '-.03em' }, branca);
      const lj = pele === 'pixel'
        ? h('span', { fontFamily: 'Silkscreen', fontWeight: 700, fontSize: Math.round(tamLinha * 0.9) + 'px', color: '#D97757', textShadow: '6px 6px 0 #151513' }, laranja)
        : h('span', { fontFamily: "'Instrument Serif'", fontStyle: 'italic', fontWeight: pele === 'claro' ? 700 : 400, fontSize: Math.round(tamLinha * 1.17) + 'px', color: pele === 'claro' ? '#FFFF00' : T.acc, textShadow: '0 6px 28px rgba(0,0,0,.55)' }, laranja);
      if (pele === 'claro') { [br, lj].forEach(s => { s.style.webkitTextStroke = '18px #000'; s.style.paintOrder = 'stroke fill'; }); }
      linha.append(br, lj);
      b.append(sup, h('br'), linha);
      ctx.anima(sup, [{ opacity: 0 }, { opacity: 1 }], { em: .2, dur: .1 });
      ctx.anima(br, [{ opacity: 0 }, { opacity: 1 }], { em: .8, dur: .1 });
      ctx.anima(lj, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { em: 1.3, dur: .25, som: 'pop' });
      return b;
    };
    const broll = (ctx, tipo, horizontal) => {
      const g = h('div', caixa(0, 0, ctx.W, ctx.H, { background: '#000' }));
      const r = horizontal ? caixa(0, 656, 1080, 608, { overflow: 'hidden' }) : caixa(0, 0, 1080, 1920, { overflow: 'hidden' });
      const c = h('div', r, imagem(tipo, T));
      ctx.anima(c.firstElementChild || c, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }], { dur: 3, ease: 'linear' });
      g.appendChild(c);
      return g;
    };
    return [
      { nome: 'Câmera', dur: 2.6, fala: 'Todo mundo quer *vender* mais', leg: { y: 1130, n: 3, tam: 52, pele: T.original ? 'broll' : null },
        montar: (ctx) => camera(ctx) },
      { nome: 'B-roll', dur: 2.8, fala: '', leg: null,
        montar: (ctx) => { const g = broll(ctx, 'mesa', false); g.appendChild(empilhada(ctx, 'o segredo é', 'ter', 'constância')); return g; } },
      { nome: 'B-roll horizontal', dur: 2.6, fala: 'Eu gravo tudo num dia só', leg: { y: 1180, n: 3, tam: 52, pele: T.original ? 'broll' : null },
        montar: (ctx) => broll(ctx, 'cidade', true) },
      ...pixelInsert(cfg, T),
      { nome: 'Câmera', dur: 2.4, fala: 'e posto a semana *inteira*', leg: { y: 1130, n: 3, tam: 52, pele: T.original ? 'broll' : null },
        montar: (ctx) => camera(ctx) },
    ];
  },

  'tela-dividida-explicativa': (cfg) => {
    const T = resolverVisual(cfg);
    const [l1, l2] = tituloCapa(cfg, ['Como a IA', 'vende *sozinha*']);
    const dividido = (ctx) => {
      const g = fundoGrafico(ctx, 0, 0, 1080, 1920, { manchasEm: [[0.5, 0.35]] });
      const cartao = camera(ctx, { x: 69, y: 1406, w: 942, h: 600, raio: 28, escala: .62, topo: -70, borda: '1.5px solid rgba(255,255,255,.12)' });
      g.appendChild(cartao);
      g.appendChild(camera(ctx, { x: 69, y: 1406, w: 942, h: 600, recorte: true, escala: .62, topo: -70 }));
      return g;
    };
    return [
      { nome: 'Gancho', dur: 3, fala: 'Deixa eu te mostrar como a IA *vende*', leg: { y: 1218, n: 3, tam: 56 },
        montar: (ctx) => { const g = dividido(ctx); g.appendChild(titulo(ctx, l1, l2, 300, { tam: 76 })); return g; } },
      { nome: 'Contador', dur: 3.2, fala: 'Em *30* dias foram mais de mil vendas', leg: { y: 1218, n: 3, tam: 56 },
        montar: (ctx) => {
          const g = dividido(ctx);
          const c = card(ctx, 110, 170, 860, 760, '', { ativo: true });
          g.appendChild(c); entra(ctx, c, .1);
          c.appendChild(contador(ctx, 32, 60, 796, 0, 1247, { em: .5, tam: 150, rotulo: 'vendas no direct' }));
          c.appendChild(graficoLinha(ctx, 30, 380, 736, 300, .7));
          return g;
        } },
      { nome: 'Câmera cheia', dur: 2, fala: 'E isso é *fácil*', leg: { y: 1180, n: 3, tam: 56 },
        montar: (ctx) => camera(ctx) },
      ...pixelInsert(cfg, T),
      { nome: 'Passos', dur: 3.2, fala: 'Conecta responde e *fecha*', leg: { y: 1218, n: 3, tam: 56 },
        montar: (ctx) => { const g = dividido(ctx); g.appendChild(listaPassos(ctx, 110, 260, 860, ['Conectar o perfil', 'Responder no direct', 'Fechar a venda'], [.3, 1.1, 1.9])); return g; } },
    ];
  },

  'ensaio-visual': (cfg) => {
    const T = resolverVisual(cfg);
    const [l1, l2] = tituloCapa(cfg, ['O Instagram', 'mudou *tudo*']);
    const fundo = (ctx) => {
      const g = h('div', caixa(0, 0, 1080, 1920, { background: T.original || T.id === 'noite' ? '#000' : T.fundo, overflow: 'hidden' }));
      if (T.grade) g.appendChild(fundoGrafico(ctx));
      const glow = T.id === 'claro' ? 'radial-gradient(ellipse at 50% 100%, #FBEEE8 0%, transparent 60%)' : `radial-gradient(ellipse 700px 350px at 540px 1920px, ${rgba(T.acc, .55)}, transparent)`;
      g.appendChild(h('div', { position: 'absolute', inset: '0', background: glow, filter: 'blur(30px)' }));
      return g;
    };
    const prova = (ctx, x, y, w, hh, rot, tipo, em) => {
      const branco = T.original || T.id === 'claro' || T.pixel;
      const g = h('div', caixa(x, y, w, hh + 46));
      g.appendChild(h('div', { fontFamily: T.pixel ? "'JetBrains Mono'" : 'Inter', fontWeight: 500, fontSize: '22px', color: T.escuro || T.original ? '#A1A1AA' : T.txt2, marginBottom: '14px' }, rot));
      const c = h('div', { width: px(w), height: px(hh), borderRadius: T.pixel ? '18px' : '10px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.6)', background: branco ? (T.pixel ? '#F9F8F6' : '#fff') : 'linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03))', backdropFilter: branco ? 'none' : 'blur(24px)', border: T.pixel ? '3px solid #151513' : (branco ? 'none' : '1.5px solid rgba(255,255,255,.14)') }, imagem(tipo, T, !branco));
      g.appendChild(c);
      entra(ctx, g, em);
      return g;
    };
    return [
      { nome: 'Gancho', dur: 3, fala: 'O Instagram *mudou* e pouca gente viu', leg: { y: 640, n: 3, tam: 50, pele: T.original ? 'ensaio' : null, depois: 1.2 },
        montar: (ctx) => {
          const g = fundo(ctx);
          g.appendChild(camera(ctx, { recorte: true, escala: .97, topo: 760 }));
          if (T.original || T.id === 'noite') {
            const t = h('div', { position: 'absolute', left: '0', width: '1080px', top: '1300px', textAlign: 'center', fontFamily: "'Instrument Serif'", fontStyle: 'italic', fontSize: '110px', lineHeight: '1', color: '#fff', textShadow: '0 6px 30px rgba(0,0,0,.6)' }, `${l1}<br><span style="color:${T.accTxt}">${l2.replace(/\*/g, '')}</span>`);
            g.appendChild(t); ctx.anima(t, [{ opacity: 0 }, { opacity: 1 }], { dur: .4, som: 'impacto' });
          } else g.appendChild(capa(ctx, l1, l2.replace(/\*/g, ''), 1280, { tam: 88 }));
          return g;
        } },
      { nome: 'Prova', dur: 3.2, fala: 'Esse post vendeu *R$ 18 mil*', leg: { y: 690, n: 3, tam: 50, pele: T.original ? 'ensaio' : null },
        montar: (ctx) => {
          const g = fundo(ctx);
          g.appendChild(camera(ctx, { recorte: true, escala: .97, topo: 760 }));
          g.appendChild(prova(ctx, 300, 110, 480, 470, 'Post de exemplo, @seuperfil', 'post', .3));
          return g;
        } },
      ...pixelInsert(cfg, T),
      { nome: 'Antes e depois', dur: 3.4, fala: 'Antes e *depois* da IA', leg: { y: 690, n: 3, tam: 50, pele: T.original ? 'ensaio' : null },
        montar: (ctx) => {
          const g = fundo(ctx);
          g.appendChild(camera(ctx, { recorte: true, escala: .97, topo: 760 }));
          g.appendChild(prova(ctx, 70, 120, 450, 400, 'Antes', 'chat', .3));
          g.appendChild(prova(ctx, 560, 120, 450, 400, 'Depois', 'grafico', .9));
          return g;
        } },
    ];
  },

  'legenda-encaixada': (cfg) => {
    const T = resolverVisual(cfg);
    // A frase se monta palavra por palavra; a palavra-chave entra gigante.
    // A palavra-chave gigante no centro; as palavras de antes ficam em cima,
    // alinhadas à borda esquerda dela, e as de depois embaixo, alinhadas à direita.
    // O bloco inteiro fica centralizado na tela em qualquer estilo.
    const frase = (ctx, antes, chave, depois, inicio) => {
      const pele = T.pixel ? 'pixel' : (T.original || T.leg === 'noite') ? 'noite' : 'claro';
      const g = h('div', caixa(0, 0, 1080, 1920));
      const fPeq = pele === 'pixel' ? "'JetBrains Mono'" : pele === 'claro' ? 'Poppins' : 'Inter';
      const peq = { fontFamily: fPeq, fontWeight: pele === 'pixel' ? 800 : 700, fontSize: pele === 'pixel' ? '38px' : '44px', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.6)', textTransform: pele === 'pixel' ? 'uppercase' : 'none', letterSpacing: pele === 'pixel' ? '.06em' : '0', whiteSpace: 'nowrap', lineHeight: '1.15' };
      const contorno = el => { if (pele === 'claro') { el.style.webkitTextStroke = '8px #000'; el.style.paintOrder = 'stroke fill'; } return el; };
      const centro = h('div', { position: 'absolute', left: '0', width: '1080px', top: '1110px', transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center' });
      const bloco = h('div', { flex: 'none', position: 'relative' });
      medirECaber(ctx, bloco, ctx.W - 100);
      const cima = h('div', { ...peq, position: 'absolute', left: '0', bottom: pele === 'pixel' ? 'calc(100% + 6px)' : 'calc(100% - 6px)' });
      const pals = antes.split(' ');
      pals.forEach((p, k) => { const sp = contorno(h('span', { display: 'inline-block', marginRight: '.25em' }, p)); cima.appendChild(sp); ctx.anima(sp, [{ opacity: 0 }, { opacity: 1 }], { em: inicio + k * .28, dur: .05 }); });
      const tChave = inicio + pals.length * .28 + .1;
      const gw = pele === 'pixel'
        ? h('div', { fontFamily: 'Silkscreen', fontWeight: 700, fontSize: caber(chave, 150, 900, 0.98) + 'px', lineHeight: '1', color: '#D97757', textShadow: '6px 6px 0 #151513', whiteSpace: 'nowrap' }, chave.toUpperCase())
        : contorno(h('div', { fontFamily: "'Instrument Serif'", fontStyle: 'italic', fontWeight: pele === 'claro' ? 700 : 400, fontSize: caber(chave, 200, 900, 0.46) + 'px', lineHeight: '.95', color: pele === 'claro' ? '#FFFF00' : T.acc, textShadow: '0 4px 20px rgba(0,0,0,.6)', whiteSpace: 'nowrap' }, chave));
      if (pele === 'claro') gw.style.webkitTextStroke = '14px #000';
      ctx.anima(gw, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { em: tChave, dur: .22, som: 'tum' });
      const baixo = h('div', { ...peq, position: 'absolute', right: '0', top: pele === 'pixel' ? 'calc(100% + 10px)' : 'calc(100% - 4px)' });
      depois.split(' ').forEach((p, k) => { const sp = contorno(h('span', { display: 'inline-block', marginLeft: '.25em' }, p)); baixo.appendChild(sp); ctx.anima(sp, [{ opacity: 0 }, { opacity: 1 }], { em: tChave + .4 + k * .28, dur: .05 }); });
      bloco.append(cima, gw, baixo);
      centro.appendChild(bloco);
      g.appendChild(centro);
      return g;
    };
    const cam = (ctx) => {
      const g = h('div', caixa(0, 0, 1080, 1920));
      g.appendChild(camera(ctx));
      g.appendChild(h('div', { position: 'absolute', inset: '0', background: 'linear-gradient(transparent 47%, rgba(0,0,0,.45))' }));
      return g;
    };
    return [
      { nome: 'Frase encaixada', dur: 3.4, montar: (ctx) => { const g = cam(ctx); g.appendChild(frase(ctx, 'o segredo é ter', 'constância', 'todo santo dia', .2)); return g; } },
      { nome: 'Frase acumulando', dur: 2.8, fala: '', montar: (ctx) => {
        const g = cam(ctx);
        const l = h('div', { position: 'absolute', left: '0', width: '1080px', top: '1035px', padding: '0 110px', boxSizing: 'border-box', lineHeight: '1.1', textAlign: 'center', fontFamily: T.pixel ? "'JetBrains Mono'" : T.id === 'claro' ? 'Poppins' : 'Inter', fontWeight: 700, fontSize: '54px', color: '#fff', textShadow: '0 4px 20px rgba(0,0,0,.6)', textTransform: T.pixel ? 'uppercase' : 'none' });
        'você não precisa de mais seguidores'.split(' ').forEach((p, i) => { const s = h('span', { display: 'inline-block', marginRight: '.25em' }, p); if (T.id === 'claro') { s.style.webkitTextStroke = '8px #000'; s.style.paintOrder = 'stroke fill'; } l.appendChild(s); ctx.anima(s, [{ opacity: 0 }, { opacity: 1 }], { em: .2 + i * .32, dur: .05 }); });
        g.appendChild(l); return g; } },
      ...pixelInsert(cfg, T),
      { nome: 'Chamada', dur: 3, montar: (ctx) => { const g = cam(ctx); g.appendChild(frase(ctx, 'comenta', 'IA', 'aqui embaixo', .2)); return g; } },
    ];
  },

  'nuvem-de-imagens': (cfg) => {
    const T = resolverVisual(cfg);
    const grupo = (ctx, itens, em) => {
      const g = h('div', caixa(60, 180, 960, 580));
      itens.forEach(([tipo, x, y, w, hh, rot], i) => {
        const im = h('div', caixa(x, y, w, hh, { borderRadius: T.pixel ? '0' : '6px', overflow: 'hidden', boxShadow: T.pixel ? '8px 8px 0 #151513' : '0 24px 60px rgba(0,0,0,.45)', border: T.pixel ? '4px solid #151513' : (T.id === 'noite' && !T.original ? '1.5px solid rgba(255,255,255,.14)' : 'none'), transform: `rotate(${rot}deg)` }),
          T.pixel && i === 2 ? `<div style="width:100%;height:100%;background:#EFEDEB;display:grid;place-items:center">${mascote('#D97757', 9)}</div>` : imagem(tipo, T));
        g.appendChild(im);
        ctx.anima(im, [{ opacity: 0, transform: `rotate(${rot}deg) scale(.92)` }, { opacity: 1, transform: `rotate(${rot}deg) scale(1)` }], { em: em + i * .18, dur: .3, som: 'pop' });
      });
      if (T.id === 'noite' && !T.original) g.prepend(h('div', { position: 'absolute', inset: '0', background: `radial-gradient(circle, ${rgba(T.acc, .35)}, transparent 60%)`, filter: 'blur(40px)' }));
      return g;
    };
    const leg = { x: 70, y: 905, alinha: 'left', n: 5, tam: 34, pele: T.original ? 'nuvem' : null, largura: 330 };
    return [
      { nome: 'Grupo 1', dur: 3.2, fala: 'quando eu comecei a postar todo dia', leg,
        montar: (ctx) => { const g = h('div', caixa(0, 0, 1080, 1920)); g.appendChild(camera(ctx, { topo: 780, escala: .82 })); g.appendChild(grupo(ctx, [['perfil', 20, 40, 380, 470, -3], ['post', 330, 0, 300, 380, 2], ['grafico', 600, 60, 340, 300, -2]], .1)); return g; } },
      { nome: 'Grupo 2', dur: 3.2, fala: 'as vendas vieram pelo direct', leg,
        montar: (ctx) => { const g = h('div', caixa(0, 0, 1080, 1920)); g.appendChild(camera(ctx, { topo: 780, escala: .82 })); g.appendChild(grupo(ctx, [['chat', 40, 30, 420, 360, 2], ['noticia', 480, 60, 420, 440, -2], ['loja', 200, 300, 300, 260, 1]], .1)); return g; } },
      ...pixelInsert(cfg, T),
    ];
  },

  'recorte-com-imagens': (cfg) => {
    const T = resolverVisual(cfg);
    const [l1, l2] = tituloCapa(cfg, ['A IA mudou', 'as vendas']);
    const legPele = T.original ? 'recorte' : null;
    const sobre = (ctx, tipo, enq) => {
      const g = h('div', caixa(0, 0, 1080, 1920, { overflow: 'hidden' }));
      const fundo = h('div', caixa(0, 0, 1080, 1920), T.pixel && tipo === 'pixel' ? '' : imagem(tipo, T));
      if (T.pixel && tipo === 'pixel') fundo.appendChild(cenaPixel(ctx));
      g.appendChild(fundo);
      ctx.anima(fundo, [{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { dur: 3, ease: 'linear' });
      g.appendChild(h('div', { position: 'absolute', inset: '0', background: 'linear-gradient(rgba(0,0,0,.18) 62%, rgba(0,0,0,.45))' }));
      const p = camera(ctx, { recorte: true, ...enq });
      if (enq.corte) Object.assign(p.style, { clipPath: `inset(-2000px -2000px ${1920 - enq.corte}px -2000px)` });
      g.appendChild(p);
      ctx.anima(p, [{ opacity: 0 }, { opacity: 1 }], { dur: .15, som: 'passagem' });
      return g;
    };
    return [
      { nome: 'Mosaico', dur: 2.8, fala: 'A IA mudou como eu *vendo*', leg: { y: 960, n: 5, tam: 58, pele: legPele, depois: 1 },
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, 1080, 1920));
          ['cidade', 'mesa', 'loja', 'cidade'].forEach((t, i) => { const c = h('div', caixa((i % 2) * 540, Math.floor(i / 2) * 960, 540, 960, { overflow: 'hidden' }), imagem(t, T)); g.appendChild(c); entra(ctx, c, i * .1, { sobe: 0, som: null }); });
          g.appendChild(camera(ctx, { recorte: true, escala: 1.15, topo: 1010 }));
          const tt = h('div', { position: 'absolute', left: '0', width: '1080px', top: '240px', textAlign: 'center' }, `<div style="font-family:Inter;font-weight:700;font-size:74px;color:#fff;text-shadow:0 4px 20px rgba(0,0,0,.6)">${l1}</div><div style="display:inline-block;margin-top:10px;font-family:${T.pixel ? 'Inter' : 'Inter'};font-weight:800;font-size:74px;background:${T.pixel ? '#F9F8F6' : '#fff'};color:${T.pixel ? '#1A1A1A' : '#111'};padding:6px 22px;border-radius:${T.pixel ? '12px' : '6px'};${T.pixel ? 'border:3px solid #151513;box-shadow:6px 6px 0 #151513' : ''}">${l2}</div>`);
          g.appendChild(tt); ctx.anima(tt, [{ opacity: 0 }, { opacity: 1 }], { dur: .3, som: 'impacto' });
          return g;
        } },
      { nome: 'Recorte grande', dur: 2.6, fala: 'Comecei a responder tudo no automático', leg: { y: 960, n: 5, tam: 58, pele: legPele },
        montar: (ctx) => sobre(ctx, 'mesa', { escala: 1.15, topo: 1010 }) },
      { nome: 'Recorte pequeno', dur: 2.6, fala: 'e a loja não parou mais', leg: { y: 1320, n: 5, tam: 58, pele: legPele },
        montar: (ctx) => sobre(ctx, T.pixel ? 'pixel' : 'loja', { escala: .54, cx: 540, topo: 880, corte: 1230 }) },
    ];
  },

  'telas-em-profundidade': (cfg) => {
    const T = resolverVisual(cfg);
    const claro = T.id === 'claro' || T.pixel;
    const painelCor = claro ? { bg: '#FFFFFF', int: '#F5F5F4', txt: '#111', sec: '#6B6B6B' } : { bg: '#141416', int: '#1C1C1F', txt: '#F4F4F5', sec: '#8E8E93' };
    const verde = T.pixel ? '#2DA44E' : '#34C759';
    const cena = (ctx, conteudo, pilula) => {
      const g = h('div', caixa(0, 0, 1080, 1920, { overflow: 'hidden', background: '#000' }));
      g.appendChild(camera(ctx, { escala: .95, topo: 300, escurecer: claro ? 0 : .55, desfoque: 12 }));
      if (claro) g.appendChild(h('div', { position: 'absolute', inset: '0', background: 'rgba(255,255,255,.4)' }));
      const p = h('div', caixa(40, 340, 1000, 640, { borderRadius: T.pixel ? '18px' : '22px', background: painelCor.bg, border: T.pixel ? '3px solid #151513' : '1px solid rgba(255,255,255,.08)', boxShadow: T.pixel ? '8px 8px 0 #151513' : '0 40px 90px rgba(0,0,0,.6)', overflow: 'hidden', fontFamily: T.pixel ? 'Inter' : 'Inter', color: painelCor.txt }), conteudo);
      g.appendChild(p);
      ctx.anima(p, [{ opacity: 0, transform: 'translateY(40px) scale(.97)' }, { opacity: 1, transform: 'none' }], { em: .1, dur: .45, som: 'passagem' });
      g.appendChild(camera(ctx, { recorte: true, escala: .95, topo: 300 }));
      const pl = h('div', caixa(140, 1350, 800, 104, { borderRadius: '26px', background: claro ? 'rgba(255,255,255,.95)' : 'rgba(28,28,31,.92)', border: T.pixel ? '2px solid #151513' : '1px solid rgba(255,255,255,.1)', boxShadow: T.pixel ? '4px 4px 0 #151513' : 'none', display: 'flex', alignItems: 'center', gap: '20px', padding: '0 26px', boxSizing: 'border-box', fontFamily: 'Inter', color: painelCor.txt }),
        `<div style="width:56px;height:56px;border-radius:14px;background:${pilula.cor};flex:none;display:grid;place-items:center;color:#fff;font-size:30px">${pilula.icone}</div>
         <div style="flex:1"><div style="font-weight:600;font-size:30px">${pilula.titulo}</div><div style="font-size:22px;color:${painelCor.sec}">${pilula.sub}</div></div>
         <div style="font-weight:700;font-size:44px;color:${pilula.cor}">${pilula.valor}</div>`);
      g.appendChild(pl);
      entra(ctx, pl, 1.4, { som: 'confirma' });
      return g;
    };
    const kpi = (r, v, c) => `<div style="background:${painelCor.int};border-radius:14px;padding:18px 20px"><div style="font-size:18px;color:${painelCor.sec}">${r}</div><div style="font-size:38px;font-weight:700;color:${c || painelCor.txt}">${v}</div></div>`;
    const leg = { y: 1230, n: 3, tam: 56, pele: T.original ? 'telas' : null };
    return [
      { nome: 'Painel', dur: 3.4, fala: 'Esse é o *painel* das minhas vendas', leg,
        montar: (ctx) => cena(ctx, `<div style="padding:26px;display:grid;grid-template-columns:240px 1fr 240px;gap:18px;height:100%;box-sizing:border-box">
          <div style="display:flex;flex-direction:column;gap:14px">${kpi('Mensagens', '1.284')}${kpi('Respondidas', '98%', verde)}${kpi('Tempo médio', '12 s')}</div><div></div>
          <div style="display:flex;flex-direction:column;gap:14px">${kpi('Vendas hoje', '37', T.acc)}${kpi('Ticket', 'R$ 97')}${kpi('Conversão', '8,4%', verde)}</div></div>`,
          { cor: verde, icone: '✓', titulo: 'Venda confirmada', sub: '@ana.paula pagou agora', valor: '+R$ 97' }) },
      { nome: 'Fluxo', dur: 3.2, fala: 'Cada comentário vira uma *venda*', leg,
        montar: (ctx) => cena(ctx, `<div style="padding:30px;display:flex;flex-direction:column;justify-content:space-between;height:100%;box-sizing:border-box">
          ${['Comentário recebido', 'Direct enviado', 'Link aberto', 'Pagamento'].map((t, i) => `<div style="display:flex;justify-content:${i % 2 ? 'flex-end' : 'flex-start'}"><div style="background:${painelCor.int};border-radius:14px;padding:14px 22px;font-size:26px;font-weight:600;border-left:6px solid ${i < 3 ? verde : T.acc}">${t}</div></div>`).join('')}</div>`,
          { cor: T.acc, icone: '→', titulo: 'Automação ligada', sub: 'respondendo 24 horas', valor: '24h' }) },
    ];
  },

  'formato-ranking': (cfg) => {
    const T = resolverVisual(cfg);
    const cores = { S: '#FF7F7F', A: '#FFBF7F', B: '#FFDF7F', C: '#BFFF7F', D: '#7FBFFF', E: '#7F7FFF', F: '#FF7FFF' };
    const quadroBg = T.original ? 'rgba(20,20,22,.92)' : T.id === 'claro' ? '#fff' : T.pixel ? '#F9F8F6' : 'rgba(255,255,255,.08)';
    const linhaCor = T.id === 'claro' ? '#e5e5e5' : T.pixel ? '#151513' : '#000';
    const fonteLetra = T.pixel ? 'Silkscreen' : 'Archivo';
    const montarQuadro = (ctx, preenchidos) => {
      const q = h('div', caixa(150, 995, 780, 505, { background: quadroBg, border: `3px solid ${T.pixel ? '#151513' : '#000'}`, boxShadow: T.pixel ? '8px 8px 0 #151513' : T.id === 'claro' ? '0 30px 60px rgba(0,0,0,.2)' : 'none', backdropFilter: T.id === 'noite' && !T.original ? 'blur(20px)' : 'none' }));
      Object.keys(cores).forEach((n, i) => {
        const l = h('div', caixa(0, i * 72, 774, 70, { borderBottom: i < 6 ? `2px solid ${linhaCor}` : 'none', display: 'flex', alignItems: 'center' }));
        l.appendChild(h('div', { width: '52px', height: '70px', background: cores[n], display: 'grid', placeItems: 'center', fontFamily: fonteLetra, fontWeight: 800, fontSize: '32px', color: '#111' }, n));
        const itens = h('div', { display: 'flex', gap: '8px', paddingLeft: '10px' });
        (preenchidos[n] || []).forEach(t => itens.appendChild(h('div', { height: '56px', padding: '0 14px', display: 'grid', placeItems: 'center', background: T.pixel ? '#151513' : '#2a2a2e', color: T.pixel ? '#E8B547' : '#fff', fontFamily: T.pixel ? 'Silkscreen' : "'Lilita One'", fontSize: '22px', borderRadius: '6px' }, t)));
        l.appendChild(itens);
        q.appendChild(l);
      });
      return q;
    };
    const tema = (ctx) => h('div', { position: 'absolute', left: '0', width: '1080px', top: '275px', textAlign: 'center', fontFamily: T.pixel ? 'Silkscreen' : T.original ? 'Archivo' : T.fTit, fontStyle: T.pixel ? 'normal' : 'italic', fontWeight: 800, fontSize: T.pixel ? '62px' : '70px', color: T.original ? '#F07A2A' : T.acc, textShadow: T.pixel ? '5px 5px 0 #151513' : '0 4px 16px rgba(0,0,0,.5)', textTransform: 'uppercase' }, 'Formatos de post');
    const legRk = { y: 935, n: 3, tam: 54, pele: T.original ? 'ranking' : null };
    const voa = (ctx, nome, nota, linha, inicio) => {
      const c = h('div', caixa(290, 560, 500, 300, { background: T.pixel ? '#151513' : '#2a2a2e', borderRadius: '18px', display: 'grid', placeItems: 'center', fontFamily: T.pixel ? 'Silkscreen' : "'Lilita One'", fontSize: '64px', color: T.pixel ? '#E8B547' : '#fff', boxShadow: '0 30px 60px rgba(0,0,0,.5)', WebkitTextStroke: T.pixel ? '2px #151513' : '0' }));
      const nomeEl = h('span', { display: 'inline-block', whiteSpace: 'nowrap' }, nome);
      c.appendChild(nomeEl);
      medirECaber(ctx, nomeEl, 440);
      ctx.anima(c, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1)' }], { em: inicio, dur: .3, som: 'pop' });
      ctx.anima(c, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(-170px, ${995 + linha * 72 - 560 - 120}px) scale(.22)`, opacity: 0 }], { em: inicio + 1.4, dur: .45, ease: EASE_IN_OUT, som: 'passagem', preso: true });
      return c;
    };
    return [
      { nome: 'Item 1', dur: 3.2, fala: 'Carrossel pra mim é *S TIER*', leg: legRk,
        montar: (ctx) => { const g = h('div', caixa(0, 0, 1080, 1920)); g.appendChild(camera(ctx)); g.appendChild(tema(ctx)); g.appendChild(montarQuadro(ctx, { S: [], C: ['Live'] })); g.appendChild(voa(ctx, 'Carrossel', 'S', 0, .3)); return g; } },
      { nome: 'Item 2', dur: 3.2, fala: 'Foto parada hoje é *NOTA F*', leg: legRk,
        montar: (ctx) => { const g = h('div', caixa(0, 0, 1080, 1920)); g.appendChild(camera(ctx)); g.appendChild(tema(ctx)); g.appendChild(montarQuadro(ctx, { S: ['Carrossel'], C: ['Live'] })); g.appendChild(voa(ctx, 'Foto parada', 'F', 6, .3)); return g; } },
      ...pixelInsert(cfg, T),
    ];
  },

  // ------------------------------------------------------------ formatos de efeito
  // Prévia dos efeitos do fx.py (claude-video-effects) com o bonequinho. A edição
  // de verdade roda o fx.py original na gravação; aqui é só a ideia de cada efeito.

  'palavra-atras-da-cabeca': (cfg) => {
    const T = resolverVisual(cfg);
    const cor = T.original ? '#F4E9D8' : T.acc;
    const leg = { y: 1500, n: 3, tam: 58, pele: 'fxPessego' };
    return [
      { nome: 'Palavra atrás', dur: 3.2, fala: 'O *Claude* edita o vídeo inteiro', leg,
        montar: (ctx) => fxCena(ctx, (atras) => atras.appendChild(fxPalavra(ctx, 'CLAUDE', { cor, em: .25, som: 'impacto' }))) },
      { nome: 'Palavra riscada', dur: 3.2, fala: 'Você não precisa de *editor*', leg,
        montar: (ctx) => fxCena(ctx, (atras) => {
          atras.appendChild(fxPalavra(ctx, 'editor', { cor: '#F4E9D8', fonte: "'Playfair Display', 'Instrument Serif', serif", peso: 700, em: .2, tam: 300, top: 240 }));
          const r = h('div', caixa(90, 420, 900, 16, { background: '#E02424', borderRadius: '8px', transformOrigin: 'left', transform: 'rotate(-3deg)' }));
          atras.appendChild(r);
          ctx.anima(r, [{ transform: 'rotate(-3deg) scaleX(0)' }, { transform: 'rotate(-3deg) scaleX(1)' }], { em: 1, dur: .35, som: 'risco' });
        }) },
      { nome: 'Giz de cera', dur: 3, fala: 'O segredo é a *IA*', leg,
        montar: (ctx) => fxCena(ctx, (atras) => {
          const w = h('div', { position: 'absolute', left: '0', width: '1080px', top: '150px', textAlign: 'center', fontFamily: "'Permanent Marker', 'Caveat', cursive", fontSize: '260px', color: '#E02424', lineHeight: '1' }, 'IA');
          atras.appendChild(w);
          ctx.anima(w, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { em: .2, dur: .8, ease: 'linear' });
          const s = h('div', caixa(380, 430, 320, 14, { background: '#E02424', borderRadius: '8px', transformOrigin: 'left' }));
          atras.appendChild(s);
          ctx.anima(s, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { em: 1.05, dur: .3 });
        }) },
    ];
  },

  'checklist-na-tela': (cfg) => {
    const T = resolverVisual(cfg);
    const leg = { y: 1540, n: 3, tam: 58, pele: 'fxVerde' };
    return [
      { nome: 'Contagem', dur: 2.6, fala: 'São *três* coisas que você precisa', leg,
        montar: (ctx) => fxCena(ctx, null, (frente) => frente.appendChild(fxRelogio(ctx, .3))) },
      { nome: 'Lista', dur: 4, fala: 'Gravar, editar e *postar* no mesmo dia', leg,
        montar: (ctx) => fxCena(ctx, null, (frente) => frente.appendChild(fxLista(ctx, 'HOJE', ['Gravar', 'Editar', 'Postar'], [.8, 1.8, 2.9]))) },
      { nome: 'Checklist', dur: 3.6, fala: 'Ele corta, legenda e *exporta* sozinho', leg: null,
        montar: (ctx) => fxCena(ctx, null, (frente) => frente.appendChild(fxTarefas(ctx, 'Claude', [['Cortou os silêncios', 'auto'], ['Colocou legenda', 'IA'], ['Escolheu a música', 'trilha'], ['Exportou', '4K']]))) },
    ];
  },

  'zoom-na-palavra': (cfg) => {
    const T = resolverVisual(cfg);
    const leg = { y: 1520, n: 2, tam: 62, pele: 'fxAmarelo' };
    return [
      { nome: 'Título', dur: 3, fala: 'Como eu edito com IA', leg: null,
        montar: (ctx) => {
          const g = fxCena(ctx, null, (frente) => {
            const t = h('div', { position: 'absolute', left: '0', width: '1080px', top: '170px', textAlign: 'center', fontFamily: 'Inter, Archivo, sans-serif', fontWeight: 800, fontSize: '78px', color: '#fff', lineHeight: '1.25', textShadow: '0 4px 20px rgba(0,0,0,.5)' }, 'Como eu edito<br><span style="background:#fff;color:#111;padding:2px 18px;border-radius:6px;text-shadow:none">com IA</span>');
            frente.appendChild(t);
            ctx.anima(t, [{ opacity: 0, transform: 'translateY(-20px)' }, { opacity: 1, transform: 'none' }], { em: .2, dur: .35, som: 'impacto' });
          });
          fxZoom(ctx, g.querySelector('.fx-cam'), 1.2, 540, 700, 0, 2.8);
          return g;
        } },
      { nome: 'Aproximação', dur: 2.6, fala: 'Em *dez* minutos tá pronto', leg,
        montar: (ctx) => { const g = fxCena(ctx); fxSoco(ctx, g.querySelector('.fx-cam'), 1.45, .5); return g; } },
      { nome: 'Mira', dur: 3, fala: 'E quem editou foi *você*', leg,
        montar: (ctx) => {
          const g = fxCena(ctx, null, (frente) => frente.appendChild(fxMira(ctx, 'VOCÊ', .3)));
          fxZoom(ctx, g.querySelector('.fx-cam'), 1.35, 540, 690, .3, 2.6);
          return g;
        } },
    ];
  },

  'marcacoes': (cfg) => {
    const T = resolverVisual(cfg);
    const cor = T.original ? '#FFD60A' : T.acc;
    const leg = { y: 1520, n: 3, tam: 58, pele: 'fxMarcador' };
    return [
      { nome: 'Pausa e seta', dur: 3, fala: 'Esse aqui sou *eu*', leg,
        montar: (ctx) => fxCena(ctx, null, (frente) => fxSeta(ctx, frente, 'EU', cor, .3)) },
      { nome: 'Fita', dur: 3, fala: 'E tudo isso *sem editor*', leg: null,
        montar: (ctx) => fxCena(ctx, null, (frente) => {
          const f = h('div', { position: 'absolute', left: '320px', top: '1180px', width: '440px', padding: '18px 0', textAlign: 'center', background: '#FFD84A', boxShadow: '0 8px 20px rgba(0,0,0,.35)', fontFamily: "'Permanent Marker', 'Caveat', cursive", fontSize: '52px', color: '#1A1A1A', transform: 'rotate(-2deg)' }, 'SEM EDITOR');
          frente.appendChild(f);
          ctx.anima(f, [{ opacity: 0, transform: 'rotate(-8deg) scale(1.3)' }, { opacity: 1, transform: 'rotate(-2deg) scale(1)' }], { em: .3, dur: .25 });
        }) },
      { nome: 'Seleção', dur: 3, fala: 'Fica *dez vezes* mais rápido', leg,
        montar: (ctx) => fxCena(ctx, null, (frente) => fxSelecao(ctx, frente, '10X', .3)) },
    ];
  },

  'widgets-de-vidro': (cfg) => {
    const T = resolverVisual(cfg);
    return [
      { nome: 'Widgets', dur: 3.6, fala: 'Cinquenta mil pessoas em *um ano*', leg: null,
        montar: (ctx) => fxCena(ctx, (atras, frente) => fxWidgets(ctx, atras, frente), null, { quente: true }) },
      { nome: 'Gráfico de vidro', dur: 3.4, fala: 'Saí de dois mil pra *49 mil*', leg: null,
        montar: (ctx) => fxCena(ctx, null, (frente) => frente.appendChild(fxGrafico(ctx, 'SEGUIDORES', 2, 49, 'K', 90, 1180, 900, 460, .3))) },
      { nome: 'Bento', dur: 3.4, fala: 'Um milhão de *visualizações*', leg: null,
        montar: (ctx) => fxCena(ctx, (atras) => atras.appendChild(fxGrafico(ctx, 'VIEWS', 0, 1, 'M', 120, 110, 840, 520, .2)), (frente) => fxBento(ctx, frente)) },
    ];
  },

  'cards-em-orbita': (cfg) => {
    const T = resolverVisual(cfg);
    const leg = { y: 1540, n: 3, tam: 58, pele: 'fxQuente' };
    return [
      { nome: 'Órbita', dur: 3.6, fala: 'Olha *tudo* que eu postei', leg: null,
        montar: (ctx) => fxOrbita(ctx, T, { n: 7, rx: 430, ry: 150, cy: 820, w: 170, voltas: 1.2 }) },
      { nome: 'Carrossel 3D', dur: 3.6, fala: 'São *vinte* formatos diferentes', leg: null,
        montar: (ctx) => fxOrbita(ctx, T, { n: 10, rx: 480, ry: 90, cy: 980, w: 230, voltas: 1.1, freia: true }) },
      { nome: 'Leque', dur: 3.4, fala: 'Um depois do *outro*', leg,
        montar: (ctx) => fxCena(ctx, (atras) => fxLeque(ctx, T, atras)) },
    ];
  },

  'capa-de-revista': (cfg) => {
    const T = resolverVisual(cfg);
    const vermelho = T.original ? '#E82434' : T.acc;
    return [
      { nome: 'Capa', dur: 3.6, fala: 'Eu virei *capa* de revista', leg: null,
        montar: (ctx) => fxCena(ctx, (atras) => {
          atras.appendChild(fxPalavra(ctx, 'MATHEUS', { cor: vermelho, fonte: "'Archivo Black', Archivo, Inter, sans-serif", peso: 900, em: .2, top: 120, tam: 190, som: 'impacto' }));
        }, (frente) => {
          frente.appendChild(h('div', { position: 'absolute', left: '0', width: '1080px', top: '70px', textAlign: 'center', fontFamily: "'Space Mono', 'JetBrains Mono', monospace", fontSize: '24px', color: '#fff', letterSpacing: '.12em' }, 'EDIÇÃO IA · 2026'));
          const ch = h('div', { position: 'absolute', left: '70px', top: '1020px', fontFamily: 'Inter, Archivo, sans-serif', fontWeight: 800, fontSize: '50px', lineHeight: '1.25', color: '#fff', textShadow: '0 3px 14px rgba(0,0,0,.5)' }, `<span style="font-family:'Instrument Serif';font-style:italic;font-weight:400;color:#FFD60A;font-size:72px">IA</span><br>EDIÇÃO<br>REELS`);
          frente.appendChild(ch);
          ctx.anima(ch, [{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'none' }], { em: .6, dur: .35 });
          frente.appendChild(h('div', caixa(840, 1640, 160, 90, { background: 'repeating-linear-gradient(90deg,#111 0 4px,#fff 4px 7px,#111 7px 9px,#fff 9px 14px)', border: '8px solid #fff' })));
        }) },
      { nome: 'Colagem vermelha', dur: 3.6, fala: 'Sem editor, sem app, *só Claude*', leg: null,
        montar: (ctx) => fxCena(ctx, (atras) => {
          const w = fxPalavra(ctx, 'IA', { cor: vermelho, fonte: "'Archivo Black', Archivo, Inter, sans-serif", peso: 900, em: .1, top: 140, tam: 420 });
          w.style.textShadow = `0 0 60px ${rgba(vermelho, .8)}`;
          atras.appendChild(w);
        }, (frente) => {
          ['Sem editor', 'Sem app', 'Só Claude'].forEach((t, i) => {
            const l = h('div', { position: 'absolute', left: '70px', top: px(1380 + i * 110), fontFamily: 'Inter, Archivo, sans-serif', fontWeight: 800, fontSize: '96px', letterSpacing: '-.03em', color: i === 1 ? vermelho : '#fff', lineHeight: '1' }, t);
            frente.appendChild(l);
            ctx.anima(l, [{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 1, transform: 'none' }], { em: .5 + i * .45, dur: .18, som: 'impacto' });
          });
        }, { cinza: true }) },
    ];
  },

  'grade-do-perfil': (cfg) => {
    const T = resolverVisual(cfg);
    const leg = { y: 1540, n: 3, tam: 58, pele: 'fxRosa' };
    return [
      { nome: 'Grade', dur: 3.6, fala: 'Esse é o meu *perfil*', leg: null,
        montar: (ctx) => fxGrade(ctx, T) },
      { nome: 'Pilha', dur: 3, fala: 'Eu postei *todo dia*', leg,
        montar: (ctx) => fxCena(ctx, (atras) => fxPilha(ctx, T, atras)) },
      { nome: 'Parede', dur: 3.6, fala: 'Cinquenta e um mil *seguidores*', leg: null,
        montar: (ctx) => fxCena(ctx, (atras) => fxParede(ctx, T, atras), (frente) => frente.appendChild(fxContagem(ctx, 51000, 'seguidores', .4))) },
    ];
  },

  'cortes-de-video-longo': (cfg) => {
    const T = resolverVisual(cfg);
    const qtd = Number(cfg.cortesQtd || 5);
    const rn = DEMOS['reels-de-negocio']({ ...cfg, capaTitulo: cfg.capaTitulo });
    const ranking = { nome: 'Ranking dos cortes', dur: 3.4, fala: '', leg: null,
      montar: (ctx) => {
        const g = fundoGrafico(ctx, 0, 0, 1080, 1920);
        const t = h('div', { position: 'absolute', left: '90px', top: '220px', fontFamily: T.fTit, fontWeight: 700, fontSize: '58px', color: T.txt, letterSpacing: '-.02em' }, `Seu vídeo longo vira<br><span style="color:${T.accTxt}">${qtd} cortes</span>`);
        g.appendChild(t); entra(ctx, t, 0);
        const barra = h('div', caixa(90, 520, 900, 70, { borderRadius: '12px', background: T.escuro ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', overflow: 'hidden' }));
        g.appendChild(barra);
        const trechos = [[.08, .1], [.3, .08], [.52, .12], [.7, .07], [.86, .09]].slice(0, Math.min(qtd, 5));
        trechos.forEach(([x, w], i) => { const s = h('div', { position: 'absolute', left: (x * 100) + '%', width: (w * 100) + '%', top: '0', bottom: '0', background: T.acc }); barra.appendChild(s); ctx.anima(s, [{ opacity: 0 }, { opacity: 1 }], { em: .4 + i * .15, dur: .2, som: 'tique' }); });
        const ordem = [2, 0, 4, 1, 3].filter(i => i < trechos.length);
        ordem.forEach((i, pos) => {
          const c = card(ctx, 90, 660 + pos * 150, 900, 124, `<div style="display:flex;align-items:center;gap:24px;height:100%"><div style="font-size:44px;font-weight:800;color:${T.accTxt};width:70px">#${pos + 1}</div><div style="flex:1"><div style="font-size:32px;font-weight:700">${['A virada que dobrou as vendas', 'O erro que todo mundo comete', 'Como responder 1.000 directs', 'O print do resultado', 'Por que parar de postar foto'][pos]}</div><div style="font-size:24px;color:${T.txt2}">${['42 s', '38 s', '51 s', '33 s', '45 s'][pos]} · nota ${[9.4, 8.9, 8.6, 8.1, 7.8][pos]}</div></div></div>`, { pad: '0 30px', ativo: pos === 0 });
          g.appendChild(c); entra(ctx, c, 1.1 + pos * .25);
        });
        return g;
      } };
    return [ranking, ...rn.slice(0, 3)];
  },

  'youtube-educativo': (cfg) => {
    const T = resolverVisual(cfg);
    const W = 1920, H = 1080;
    const camCheia = (ctx) => camera(ctx, { escala: .64, cx: 1180, topo: 170 });
    return [
      { nome: 'Câmera + card', dur: 3.2, fala: '', leg: null,
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, W, H));
          g.appendChild(camCheia(ctx));
          g.appendChild(h('div', { position: 'absolute', left: '-200px', top: '-260px', width: '1200px', height: '1200px', background: 'radial-gradient(circle, rgba(0,0,0,.35), transparent 50%)' }));
          const c = card(ctx, 90, 120, 500, 340, `<div style="font-size:26px;color:${T.txt2};font-weight:500">Vendas pelo direct</div><div style="font-size:110px;font-weight:700;letter-spacing:-.03em;margin:6px 0">+212%</div><div style="font-size:28px;color:${T.txt2}">em 30 dias</div>`, { ativo: true });
          g.appendChild(c); entra(ctx, c, .4);
          return g;
        } },
      { nome: 'Dividido', dur: 3.4, fala: '', leg: null,
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, W, H));
          g.appendChild(fundoGrafico(ctx, 0, 0, 960, 1080, { manchasEm: [[0.5, 1]] }));
          g.appendChild(camera(ctx, { x: 960, w: 960, h: 1080, escala: .62, topo: 190 }));
          const t = h('div', { position: 'absolute', left: '80px', top: '150px', width: '800px', fontFamily: T.fTit, fontWeight: 700, fontSize: '56px', color: T.txt, letterSpacing: '-.02em', lineHeight: '1.1' }, `Por que o direct<br>vende <span style="font-family:${T.fSerif};font-style:${T.serifItal ? 'italic' : 'normal'};color:${T.accTxt}">mais</span>`);
          g.appendChild(t); entra(ctx, t, .1);
          [['Resposta em 12 s', '98%'], ['Link no momento certo', '3×']].forEach(([a, b], i) => {
            const c = card(ctx, 80, 430 + i * 200, 800, 170, `<div style="display:flex;justify-content:space-between;align-items:center;height:100%"><div style="font-size:36px;font-weight:600">${a}</div><div style="font-size:64px;font-weight:700;color:${T.accTxt}">${b}</div></div>`, { pad: '0 40px', ativo: i === 1 });
            g.appendChild(c); entra(ctx, c, .6 + i * .5);
          });
          return g;
        } },
      { nome: 'Animação', dur: 3.4, fala: '', leg: null,
        montar: (ctx) => {
          const g = fundoGrafico(ctx, 0, 0, W, H, { manchasEm: [[0.5, 1]] });
          ['Atrair', 'Conversar', 'Vender'].forEach((t, i) => {
            const c = card(ctx, 180 + i * 540, 330, 480, 420, `<div style="font-size:30px;color:${T.txt2}">0${i + 1}</div><div style="font-size:60px;font-weight:700;margin-top:150px">${t}</div>`, { pad: 44, ativo: i === 2 });
            g.appendChild(c); entra(ctx, c, .3 + i * .6, { som: i ? 'clique' : 'pop' });
          });
          const t = h('div', { position: 'absolute', left: '0', width: px(W), top: '150px', textAlign: 'center', fontFamily: T.fTit, fontWeight: 700, fontSize: '60px', color: T.txt, letterSpacing: '-.02em' }, 'O caminho da venda');
          g.appendChild(t); entra(ctx, t, 0);
          return g;
        } },
      ...pixelInsert(cfg, T, true),
    ];
  },

  'aula-em-tela-dividida': (cfg) => {
    const T = resolverVisual(cfg);
    const W = 1920, H = 1080;
    // Documento escuro nos estilos escuros (Noite Laranja e os criados com fundo escuro).
    const escuro = !T.original && T.escuro && !T.pixel;
    const doc = escuro ? { bg: T.id === 'custom' ? T.fundo : '#0A0A0C', txt: '#fff', sec: '#A1A1AA', mk: rgba(T.acc, .30), tag: T.accTxt } : { bg: '#fff', txt: '#111', sec: '#6B6B6B', mk: '#FDE68A', tag: T.original ? '#C8662A' : T.acc };
    const fTit = T.original ? "'Playfair Display', serif" : T.pixel ? 'Inter' : T.fTit;
    return [
      { nome: 'Abertura', dur: 2.6, fala: '', leg: null,
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, W, H));
          g.appendChild(camera(ctx, { escala: .64, cx: 1180, topo: 170 }));
          // Card do progresso da aula: Kit Noite no original; nos outros estilos, o card do estilo.
          const TT = ctx.T.original ? { ...ctx.T, ...BASES.noite } : ctx.T;
          const c = card(ctx, 80, 220, 420, 300, `<div style="font-size:18px;color:${TT.txt2}">Aula 3</div><div style="font-size:34px;font-weight:700;margin:8px 0 40px">Vender no direct</div><div style="display:flex;gap:8px">${['Gancho', 'História', 'Oferta'].map((e, i) => `<div style="flex:1"><div style="height:8px;border-radius:4px;background:${i === 0 ? TT.acc : (TT.escuro ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.12)')}"></div><div style="font-size:16px;margin-top:8px;color:${i === 0 ? TT.txt : TT.txt2}">${e}</div></div>`).join('')}</div>`, { pad: 28 });
          if (ctx.T.original) Object.assign(c.style, { ...BASES.noite.card, color: '#fff', fontFamily: 'Inter' });
          g.appendChild(c); entra(ctx, c, .3);
          return g;
        } },
      { nome: 'Documento', dur: 5, fala: '', leg: null,
        montar: (ctx) => {
          const g = h('div', caixa(0, 0, W, H, { background: '#000' }));
          g.appendChild(camera(ctx, { x: 845, w: 1075, h: 1080, escala: .66, topo: 170 }));
          const d = h('div', caixa(0, 0, 845, 1080, { background: doc.bg, overflow: 'hidden', boxShadow: '4px 0 24px rgba(0,0,0,.25)', fontFamily: T.pixel ? 'Inter' : T.id === 'claro' ? 'Poppins' : 'Inter', color: doc.txt }));
          const rolo = h('div', { padding: '56px' }, `
            <div style="font-family:${T.pixel ? "'JetBrains Mono'" : 'Inter'};font-size:14px;letter-spacing:.08em;color:${doc.tag};font-weight:700">AULA 3</div>
            <div style="font-family:${fTit};font-size:56px;font-weight:700;line-height:1.05;margin:10px 0 40px">Como vender no <span style="font-family:'Instrument Serif';font-style:italic;font-weight:400;color:${doc.tag}">direct</span></div>
            <div style="font-size:30px;font-weight:700;margin-bottom:14px">1. Responda rápido</div>
            <div style="font-size:20px;line-height:1.6;color:${doc.sec}">Quem pergunta o preço quer comprar agora. Uma resposta em segundos <span class="mk" style="background-image:linear-gradient(${doc.mk},${doc.mk});background-repeat:no-repeat;background-size:0% 100%;color:${doc.txt}">dobra a chance de venda</span>.</div>
            <div style="margin:36px 0;padding:24px;border-radius:12px;background:${escuro ? 'rgba(255,255,255,.06)' : '#111'};color:#fff;font-size:22px;${escuro ? `border:1.5px solid ${T.acc}` : ''}${T.pixel ? ';border:3px solid #151513;box-shadow:6px 6px 0 #151513;background:#F9F8F6;color:#1A1A1A' : ''}">A regra: nunca deixe um cliente esperando.</div>
            <div style="font-size:30px;font-weight:700;margin-bottom:14px">2. Mande o link certo</div>
            <div style="font-size:20px;line-height:1.6;color:${doc.sec}">Um link por conversa. Sem catálogo, sem textão.</div>
            <div style="font-size:30px;font-weight:700;margin:36px 0 14px">3. Feche com uma pergunta</div>
            <div style="font-size:20px;line-height:1.6;color:${doc.sec}">“Posso separar o seu?” funciona melhor que “alguma dúvida?”.</div>`);
          d.appendChild(rolo);
          g.appendChild(d);
          ctx.anima(rolo, [{ transform: 'translateY(0)' }, { transform: 'translateY(-260px)' }], { em: 2.2, dur: 2.2, ease: EASE_IN_OUT });
          ctx.anima(rolo.querySelector('.mk'), [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }], { em: .8, dur: .6, som: 'risco' });
          return g;
        } },
      ...pixelInsert(cfg, T, true),
    ];
  },
};

// Caminho do zero: o motor com os três níveis e os dois formatos de tela.
function demoZero(cfg) {
  const T = resolverVisual(cfg);
  const hz = cfg.proporcao === 'horizontal';
  const W = hz ? 1920 : 1080, H = hz ? 1080 : 1920;
  const nivel = cfg.nivel || 'completo';
  const [l1, l2] = tituloCapa(cfg, ['IA no direct', 'vende sozinha']);
  const legY = hz ? 985 : 1180;
  const legT = hz ? 58 : 72;
  const camCheia = (ctx, o = {}) => hz ? camera(ctx, { escala: .64, cx: 1180, topo: 170, ...o }) : camera(ctx, { escala: .9, topo: 420, ...o });
  const cenas = [];

  cenas.push({ nome: 'Capa e gancho', dur: 3.2, fala: FALA.gancho, leg: { y: legY, n: 3, tam: legT, depois: 1.2 },
    montar: (ctx) => {
      const g = h('div', caixa(0, 0, W, H));
      g.appendChild(camCheia(ctx));
      if (cfg.capa !== 'sem') { const c = capa(ctx, l1, l2, hz ? 90 : 262); g.appendChild(c); sai(ctx, c, 1.1); }
      ctx.som(0, 'riser');
      return g;
    } });

  if (nivel === 'basico') {
    cenas.push({ nome: 'Câmera cheia', dur: 3, fala: 'Eu deixei a IA responder meus *clientes*', leg: { y: legY, n: 3, tam: legT }, montar: (ctx) => camCheia(ctx) });
    cenas.push({ nome: 'Câmera cheia', dur: 2.6, fala: 'e as vendas *dobraram* em um mês', leg: { y: legY, n: 3, tam: legT }, montar: (ctx) => camCheia(ctx) });
  } else {
    const completo = nivel === 'completo';
    // B: tela dividida com a cabeça saindo do cartão
    cenas.push({ nome: 'Tela dividida', dur: 3.4, fala: 'Olha o que *aconteceu* no primeiro mês', leg: hz ? { y: legY, n: 3, tam: 52, x: 0, largura: 1040 } : { y: 1250, n: 3, tam: 60 },
      montar: (ctx) => {
        const g = fundoGrafico(ctx, 0, 0, W, H);
        if (hz) {
          g.appendChild(camera(ctx, { x: 1060, y: 160, w: 780, h: 920, raio: 28, escala: .58, topo: -40 }));
          g.appendChild(camera(ctx, { x: 1060, y: 160, w: 780, h: 920, recorte: true, escala: .58, topo: -40 }));
        } else {
          g.appendChild(camera(ctx, { x: 69, y: 1360, w: 942, h: 640, raio: 28, escala: .62, topo: -80 }));
          g.appendChild(camera(ctx, { x: 69, y: 1360, w: 942, h: 640, recorte: true, escala: .62, topo: -80 }));
        }
        const area = hz ? [80, 160, 900, 760] : [110, 150, 860, 900];
        const c = card(ctx, area[0], area[1], area[2], area[3], '', { ativo: true });
        g.appendChild(c); entra(ctx, c, .1);
        c.appendChild(contador(ctx, 32, hz ? 60 : 90, area[2] - 64, 0, 18240, { em: .5, tam: hz ? 120 : 140, prefixo: 'R$ ', rotulo: 'vendidos pelo direct' }));
        c.appendChild(graficoLinha(ctx, 30, hz ? 360 : 420, area[2] - 124, hz ? 280 : 340, .8));
        if (completo) { ctx.anima(c, [{ transform: 'perspective(1600px) rotateX(6deg) scale(.96)' }, { transform: 'perspective(1600px) rotateX(0) scale(1)' }], { em: .1, dur: 2.6, ease: EASE_IN_OUT }); }
        return g;
      } });
    // C: tela só com gráficos (no Completo, com câmera virtual andando entre cartões)
    cenas.push({ nome: completo ? 'Câmera virtual' : 'Só gráficos', dur: completo ? 4.2 : 3.4, fala: 'A IA responde *manda* o link e fecha', leg: { y: hz ? legY : 1790, n: 3, tam: hz ? 52 : 60 },
      montar: (ctx) => {
        const g = fundoGrafico(ctx, 0, 0, W, H);
        const mundo = h('div', caixa(0, 0, W, H, { transformOrigin: '0 0' }));
        g.appendChild(mundo);
        const cw = hz ? 540 : 860, ch = hz ? 560 : 520;
        const pos = hz ? [[120, 200], [700, 200], [1280, 200]] : [[110, 150], [110, 690], [110, 1230]];
        const conteudos = [
          `<div style="font-size:32px;color:${T.txt2}">Novo comentário</div><div style="font-size:64px;font-weight:700;margin-top:18px;letter-spacing:-.02em">“quero o link!”</div>`,
          `<div style="font-size:32px;color:${T.txt2}">Resposta automática</div><div class="digita" style="font-size:56px;font-weight:600;margin-top:18px;white-space:nowrap;overflow:hidden;border-right:5px solid ${T.acc};width:0;letter-spacing:-.01em">Te mandei no direct 👇</div>`,
          `<div style="font-size:32px;color:${T.txt2}">Pagamento</div><div style="font-size:110px;font-weight:700;margin-top:6px;color:${T.pixel ? '#2DA44E' : '#34C759'}">✓ R$ 97</div>`,
        ];
        const cards = pos.map(([x, y], i) => { const c = card(ctx, x, y, cw, hz ? ch : 440, conteudos[i], { pad: 44 }); mundo.appendChild(c); entra(ctx, c, completo ? .2 + i * 1.2 : .3 + i * .5, { som: i === 2 ? 'confirma' : 'pop' }); return c; });
        if (completo) {
          // câmera virtual: aproxima de cada cartão, com o resto desfocado
          const alvo = i => { const [x, y] = pos[i]; const s = hz ? 1.45 : 1.25; return `translate(${W / 2 - (x + cw / 2) * s}px, ${H / 2 - (y + (hz ? ch : 440) / 2) * s}px) scale(${s})`; };
          ctx.anima(mundo, [{ transform: alvo(0), offset: 0 }, { transform: alvo(0), offset: .22 }, { transform: alvo(1), offset: .38 }, { transform: alvo(1), offset: .55 }, { transform: alvo(2), offset: .72 }, { transform: alvo(2), offset: 1 }], { dur: 4.2, ease: EASE_IN_OUT });
          [.9, 2.1].forEach(t => ctx.som(t, 'passagem'));
          cards.forEach((c, i) => ctx.anima(c, [{ filter: 'blur(6px)' }, { filter: 'blur(0px)' }, { filter: 'blur(0px)' }, { filter: 'blur(6px)' }], { em: [0, 1.2, 2.4][i], dur: i === 2 ? 1.8 : 1.6, preso: true }));
          ctx.anima(cards[1].querySelector('.digita'), [{ width: '0' }, { width: '100%' }], { em: 1.5, dur: .9, ease: 'steps(22)', som: 'digita' });
        } else {
          cards[1].querySelector('.digita').style.width = '100%';
        }
        return g;
      } });
    if (T.pixel) cenas.push({ nome: 'Cena pixel', dur: 2.6, fala: 'E aí a IA *venceu*', leg: { y: hz ? legY : 1500, n: 4, tam: 60 }, montar: (ctx) => cenaPixel(ctx, 0, 0, W, H) });
  }
  cenas.push({ nome: 'Chamada', dur: 3, fala: FALA.cta, leg: { y: legY, n: 3, tam: legT },
    montar: (ctx) => {
      const g = h('div', caixa(0, 0, W, H));
      g.appendChild(camCheia(ctx));
      g.appendChild(cta(ctx, 'IA', hz ? 560 : 1344, { em: .5 }));
      return g;
    } });
  return cenas;
}

function tituloCapa(cfg, padrao) {
  const t = (cfg.capaTitulo || '').trim();
  if (!t) return padrao;
  const p = t.split(/\s+/);
  if (p.length < 3) return [t, ''];
  const meio = Math.ceil(p.length / 2);
  return [p.slice(0, meio).join(' '), p.slice(meio).join(' ')];
}

// ---------------------------------------------------------------- o player

export function tamanhoPalco(cfg) {
  const hz = cfg.tipo === 'zero' ? cfg.proporcao === 'horizontal'
    : cfg.tipo === 'formato' ? ['youtube-educativo', 'aula-em-tela-dividida'].includes(cfg.formato) : false;
  return hz ? { W: 1920, H: 1080 } : { W: 1080, H: 1920 };
}

export class Previa {
  constructor(tela, opcoes = {}) {
    this.tela = tela;
    this.som = opcoes.som || null;
    this.aoMudarCena = opcoes.aoMudarCena || (() => {});
    this.aoTempo = opcoes.aoTempo || (() => {});
    this.palco = h('div', { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', overflow: 'hidden' }, '', 'palco');
    tela.appendChild(this.palco);
    this.cenas = [];
    this.i = -1;
    this.t0 = performance.now();
    this.pausado = false;
    this.reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.ajustar()).observe(tela);
    const passo = () => { this.quadro(); this.raf = requestAnimationFrame(passo); };
    this.raf = requestAnimationFrame(passo);
  }

  definir(cfg) {
    const chave = JSON.stringify(cfg);
    if (chave === this.chave) return;
    const mesmaEstrutura = this.cfg && this.cfg.formato === cfg.formato && this.cfg.tipo === cfg.tipo && this.cfg.nivel === cfg.nivel && this.cfg.proporcao === cfg.proporcao;
    this.chave = chave;
    this.cfg = cfg;
    const { W, H } = tamanhoPalco(cfg);
    this.W = W; this.H = H;
    Object.assign(this.palco.style, { width: W + 'px', height: H + 'px' });
    this.cenas = demo(cfg);
    this.total = this.cenas.reduce((s, c) => s + c.dur, 0);
    this.ajustar();
    // Ao trocar só o visual, continua na mesma cena; ao trocar o formato, recomeça.
    const manter = mesmaEstrutura ? Math.min(Math.max(this.i, 0), this.cenas.length - 1) : 0;
    this.irPara(manter);
    this.aoMudarCena(this.i, this.cenas);
  }

  ajustar() {
    if (!this.W) return;
    const r = this.tela.getBoundingClientRect();
    const s = Math.min(r.width / this.W, r.height / this.H);
    this.palco.style.transform = `translate(${(r.width - this.W * s) / 2}px, ${(r.height - this.H * s) / 2}px) scale(${s})`;
  }

  inicioCena(i) { return this.cenas.slice(0, i).reduce((s, c) => s + c.dur, 0); }

  irPara(i) {
    this.t0 = performance.now() - this.inicioCena(i) * 1000;
    this.pausadoEm = this.pausado ? this.inicioCena(i) : null;
    this.montarCena(i);
  }

  alternar() {
    this.pausado = !this.pausado;
    const svgs = this.palco.querySelectorAll('svg');
    if (this.pausado) { this.pausadoEm = (performance.now() - this.t0) / 1000; this.ctx?.anims.forEach(a => a.pause()); svgs.forEach(v => v.pauseAnimations?.()); }
    else { this.t0 = performance.now() - this.pausadoEm * 1000; this.ctx?.anims.forEach(a => a.play()); svgs.forEach(v => v.unpauseAnimations?.()); }
    return this.pausado;
  }

  montarCena(i) {
    this.ctx?.timers.forEach(clearTimeout);
    this.i = i;
    const cena = this.cenas[i];
    const T = resolverVisual(this.cfg);
    const ctx = this.ctx = {
      W: this.W, H: this.H, T, cfg: this.cfg, anims: [], timers: [], tempos: [], relogio: performance.now(),
      anima: (el, kf, o = {}) => {
        if (!el) return null;
        // Só a primeira animação de cada elemento segura o estado inicial;
        // as seguintes não podem cobrir a entrada enquanto esperam a vez.
        const fill = el.__animado ? 'forwards' : 'both';
        el.__animado = true;
        const a = el.animate(kf, { delay: (o.em || 0) * 1000, duration: (this.reduzido ? Math.min(o.dur ?? .4, .01) : (o.dur ?? .4)) * 1000, easing: o.ease || EASE, fill, iterations: this.reduzido && o.iter === Infinity ? 1 : (o.iter || 1), direction: o.dir || 'normal' });
        ctx.anims.push(a);
        if (o.som) ctx.som(o.em || 0, o.som);
        return a;
      },
      som: (em, tipo) => { if (!this.som) return; ctx.timers.push(setTimeout(() => this.som.efeito(tipo, this.cfg), em * 1000)); },
      tempo: (em, dur, fn, somTipo) => { ctx.tempos.push({ em, dur, fn }); fn(0); },
      ajustes: [],
    };
    this.palco.innerHTML = '';
    this.palco.appendChild(cena.montar(ctx));
    rodarAjustes(ctx.ajustes);
    this.leg = h('div', { position: 'absolute', left: '0', width: this.W + 'px', textAlign: 'center', pointerEvents: 'none', zIndex: 5 });
    this.palco.appendChild(this.leg);
    this.legChave = null;
    if (this.pausado) ctx.anims.forEach(a => { a.currentTime = 0; a.pause(); });
    this.aoMudarCena(i, this.cenas);
  }

  quadro() {
    if (!this.cenas.length) return;
    let t = this.pausado ? this.pausadoEm : (performance.now() - this.t0) / 1000;
    if (t >= this.total) { this.t0 = performance.now(); t = 0; this.montarCena(0); }
    let i = 0, acc = 0;
    while (i < this.cenas.length - 1 && t >= acc + this.cenas[i].dur) { acc += this.cenas[i].dur; i++; }
    if (i !== this.i) this.montarCena(i);
    const tc = t - acc;
    this.ctx.tempos.forEach(({ em, dur, fn }) => fn(Math.max(0, Math.min(1, (tc - em) / dur))));
    this.legendar(this.cenas[i], tc);
    this.aoTempo(t, this.total);
  }

  legendar(cena, tc) {
    const mec = cena.leg;
    const pele = peleDaLegenda(this.ctx.T, mec);
    if (!mec || !cena.fala || !pele) { if (this.legChave !== '') { this.leg.innerHTML = ''; this.legChave = ''; } return; }
    const lista = palavras(cena.fala);
    const ini = mec.depois ?? .15, fim = cena.dur - .2;
    const passo = (fim - ini) / lista.length;
    const k = Math.floor((tc - ini) / passo);
    let mostrar = [];
    if (k >= 0 && k < lista.length) {
      if (mec.um) mostrar = [lista[k]];
      else { const n = mec.n || 3; const b = Math.floor(k / n); mostrar = lista.slice(b * n, b * n + n); }
    }
    const chave = mostrar.map(p => p.t).join(' ');
    if (chave === this.legChave) return;
    this.legChave = chave;
    posicionarLegenda(this.leg, mec, this.W);
    desenharLegenda(this.ctx, this.leg, mostrar, { ...mec, pele });
  }

  destruir() { cancelAnimationFrame(this.raf); this.ctx?.timers.forEach(clearTimeout); }
}

// Quadro parado pros cartões de escolha (mesmo motor, sem animação).
export function miniatura(alvo, cfg, _midia = null, cena = null) {
  const { W, H } = tamanhoPalco(cfg);
  const cenas = demo(cfg);
  const i = cena ?? Math.min(cenas.length - 1, Math.max(0, cenas.findIndex(c => /Animação|Tela dividida|Prova|Painel|Item|Grupo|Ranking|Contador|Frase encaixada|Documento|Dividido|Mosaico|Câmera virtual|Só gráficos/.test(c.nome))));
  const c = cenas[i] || cenas[0];
  const palco = h('div', { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '0 0', overflow: 'hidden', pointerEvents: 'none' });
  const T = resolverVisual(cfg);
  const anims = [];
  const ctx = { W, H, T, cfg, estatico: true, anims, timers: [], tempos: [],
    anima: (el, kf, o = {}) => {
      if (!el) return null;
      const fill = el.__animado ? 'forwards' : 'both';
      el.__animado = true;
      const a = el.animate(kf, { duration: (o.dur ?? .4) * 1000, fill, iterations: 1, easing: 'linear' });
      a.pause(); a.currentTime = o.preso ? 0 : (o.dur ?? .4) * 1000;
      if (o.preso) a.cancel();
      return a;
    },
    som: () => {}, tempo: (em, dur, fn) => fn(1), ajustes: [] };
  palco.appendChild(c.montar(ctx));
  const pele = peleDaLegenda(T, c.leg);
  if (c.leg && c.fala && pele) {
    const lista = palavras(c.fala);
    const n = c.leg.um ? 1 : (c.leg.n || 3);
    const leg = h('div', { position: 'absolute' });
    posicionarLegenda(leg, c.leg, W);
    const d = lista.findIndex(p => p.d);
    const ini = d >= 0 ? (c.leg.um ? d : Math.floor(d / n) * n) : 0;
    desenharLegenda(ctx, leg, lista.slice(ini, ini + n), { ...c.leg, pele });
    palco.appendChild(leg);
  }
  alvo.innerHTML = '';
  alvo.appendChild(palco);
  rodarAjustes(ctx.ajustes);
  const ajustar = () => { const r = alvo.getBoundingClientRect(); if (!r.width) return; const s = Math.max(r.width / W, r.height / H); palco.style.transform = `translate(${(r.width - W * s) / 2}px, ${(r.height - H * s) / 2}px) scale(${s})`; };
  ajustar();
  new ResizeObserver(ajustar).observe(alvo);
}
