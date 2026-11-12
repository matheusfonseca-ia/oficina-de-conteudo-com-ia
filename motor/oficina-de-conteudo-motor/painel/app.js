import { FORMATOS, ESTILOS_MAQUINA, ZERO, PADRAO_COMPLETO, CLIMA, CORTES, BROLL, USO_AUDIO, EXPORTACAO } from './dados.js';
import { Previa, miniatura, tamanhoPalco } from './previa.js';
import { Som } from './som.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HEX = /^#[0-9a-f]{6}$/i;

// Contexto de exemplo: só aparece quando a página é aberta sem o servidor.
const EXEMPLO = {
  videos: [{ arquivo: 'gravacao.mp4', orientacao: 'vertical', resolucao: '1080x1920', fps: 30, duracao: 92 }],
  audios: [], pastas: { broll: false, imagens: false, roteiro: false },
  formatos: ['reels-de-negocio', 'tela-dividida-explicativa', 'legenda-encaixada', 'telas-em-profundidade', 'cortes-de-video-longo', 'youtube-educativo', 'formato-ranking', 'zoom-na-palavra', 'widgets-de-vidro', 'cards-em-orbita'],
  estilosVisuais: [], preferencias: null, formatoFixo: null,
  ferramentas: { node: 'ok', ffmpeg: 'ok', python: 'ok', hyperframes: 'ok' },
};

let C = {};
const noEscritorio = () => !!C.escritorio; // aberto pelo Escritório de Conteúdo: sem chat do Claude Code
const E = {
  modo: null, video: 0, usoAudio: {},
  formato: null, estilo: null,
  musica: 'estilo', efeitos: 'estilo', cor: 'estilo', corHex: '#9A4DFF',
  ajustes: 'sim',
  cortesQtd: '5', cortesDur: '30-60', broll: null, formatoTravado: false,
  envios: { imagens: [], broll: [] },
  zero: { padrao: null, ...PADRAO_COMPLETO, marcaHex: '#9A4DFF', marcaFundo: 'claro', marcaFonte: '' },
  repetirMusica: 'eletronica', observacoes: '',
  expRes: '1080', expFps: '60',
};

const som = new Som();
let previa;
let jaRolou = new Set();

// ------------------------------------------------------------ dados derivados

const formato = (id) => FORMATOS.find((f) => f.id === id);
const estilosDaPessoa = () => (C.estilosVisuais || []).filter((e) => e.origem === 'pessoa');
const temMusicaNaPasta = () => (C.audios || []).some((a, i) => E.usoAudio[i] === 'musica');
const urlMusicaPasta = () => { const i = (C.audios || []).findIndex((a, j) => E.usoAudio[j] === 'musica'); return i >= 0 ? C.audios[i].url : null; };
const duracao = () => Number(C.videos?.[E.video]?.duracao) || 0;
const formatoInstalado = (id) => Array.isArray(C.formatos) && C.formatos.includes(id);
const prefs = () => C.preferencias?.formato && !formatoInstalado(C.preferencias.formato) ? null : C.preferencias || null;

// Orientação da gravação escolhida: decide quais formatos fazem sentido.
function orientacao() {
  const v = C.videos?.[E.video];
  if (!v) return null;
  if (v.orientacao === 'vertical' || v.orientacao === 'horizontal') return v.orientacao;
  const [w, hh] = String(v.resolucao || '').split(/x/i).map(Number);
  if (w && hh && w !== hh) return w > hh ? 'horizontal' : 'vertical';
  return null;
}

// Gravação vertical: só os formatos verticais (sem Cortes de Vídeo Longo).
// Gravação horizontal: os horizontais e o Cortes de Vídeo Longo.
function serve(f) {
  const o = orientacao();
  if (o === 'vertical') return f.orient === 'v' && f.id !== 'cortes-de-video-longo';
  if (o === 'horizontal') return f.orient === 'h' || f.id === 'cortes-de-video-longo';
  return true;
}

const padraoCompleto = () => ({ ...PADRAO_COMPLETO, proporcao: orientacao() === 'horizontal' ? 'horizontal' : 'vertical' });

function nomeEstilo(id) {
  if (id === 'original') return 'Original do formato';
  return ESTILOS_MAQUINA[id]?.nome || (C.estilosVisuais || []).find((e) => e.id === id)?.nome || id;
}

function estilosParaFormato(fid) {
  const f = formato(fid);
  const lista = [{ id: 'original', nome: 'Original do formato', resumo: f?.original || '' }];
  const daMaquina = Object.entries(ESTILOS_MAQUINA).map(([id, e]) => ({ id, ...e }));
  const daPessoa = estilosDaPessoa();
  [...daMaquina, ...daPessoa].forEach((e) => { if (e.id !== f?.originalIgual) lista.push(e); });
  // No Reels de Negócio o Pixelado muda também a estrutura (reels-de-negocio/com-pixelado.md).
  if (fid === 'reels-de-negocio') {
    const px = lista.find((e) => e.id === 'pixelado');
    if (px) px.resumo = 'Tela dividida com você embaixo, cenas que ilustram cada frase no creme quadriculado e clímax em pixel art. Sem câmera cheia, legenda em pílula escura fixa no meio.';
  }
  return lista;
}

function coresDe(id) { return (C.estilosVisuais || []).find((e) => e.id === id)?.cores || null; }

function climaFormato() {
  if (E.musica === 'sem') return 'sem';
  if (E.musica === 'pasta') return 'pasta';
  if (E.estilo === 'original' || !E.estilo) return CLIMA[E.formato] || 'escura';
  return CLIMA[E.estilo] || 'eletronica';
}

// ------------------------------------------------------------ configuração da prévia

function cfgPrevia() {
  if (E.modo === 'repetir' && prefs()) return cfgRepetir();
  if (E.modo === 'zero') {
    const z = E.zero.padrao === 'completo' ? padraoCompleto() : E.zero;
    return {
      tipo: 'zero', proporcao: z.proporcao, nivel: z.nivel, legendas: z.legendas, capa: 'ia', estilo: z.estilo,
      marca: { hex: E.zero.marcaHex, fundo: E.zero.marcaFundo, fonte: E.zero.marcaFonte }, cores: coresDe(z.estilo),
    };
  }
  const fid = E.formato || (orientacao() === 'horizontal' ? 'youtube-educativo' : 'reels-de-negocio');
  return {
    tipo: 'formato', formato: fid, estilo: E.estilo || 'original', cores: coresDe(E.estilo),
    cor: E.cor === 'marca' && HEX.test(E.corHex) ? E.corHex : null,
    cortesQtd: E.cortesQtd,
  };
}

function cfgRepetir() {
  const p = prefs();
  if (p.formato) return { tipo: 'formato', formato: p.formato, estilo: p.estiloVisual || 'original', cor: p.corMarca || null, cores: coresDe(p.estiloVisual) };
  const z = { ...padraoCompleto(), ...(p.zero || {}) };
  return { tipo: 'zero', ...z, capa: 'ia', marca: { hex: p.corMarca || '#9A4DFF', fundo: 'claro' }, cores: coresDe(z.estilo) };
}

function cfgSom() {
  if (E.modo === 'zero') {
    const z = E.zero.padrao === 'completo' ? padraoCompleto() : E.zero;
    return { clima: z.musica, efeitos: z.efeitos === 'nenhum' ? 'nenhum' : z.efeitos === 'essenciais' ? 'essenciais' : 'todos', pixel: z.estilo === 'pixelado', musicaUrl: urlMusicaPasta() };
  }
  if (E.modo === 'repetir') {
    const p = prefs() || {};
    return { clima: p.musicaDaPasta ? 'pasta' : (p.zero?.musica || (p.formato ? CLIMA[p.estiloVisual] || CLIMA[p.formato] || 'escura' : 'eletronica')), efeitos: 'todos', pixel: p.estiloVisual === 'pixelado', musicaUrl: urlMusicaPasta() };
  }
  const soTum = E.formato === 'legenda-encaixada' && (E.estilo || 'original') === 'original';
  return { clima: climaFormato(), efeitos: E.efeitos === 'nenhum' ? 'nenhum' : (soTum ? 'so-tum' : 'todos'), pixel: E.estilo === 'pixelado', musicaUrl: urlMusicaPasta() };
}

// ------------------------------------------------------------ pedaços de interface

const marcador = '<span class="marcador" aria-hidden="true"></span>';

function botao(k, v, atual, { nome, desc = '', selo = '', classe = '', extra = '' }) {
  return `<button type="button" class="opcao ${classe}" data-k="${k}" data-v="${esc(v)}" aria-pressed="${String(atual === v)}">
    ${selo ? `<span class="selo">${esc(selo)}</span>` : ''}${extra}
    <span class="nome">${esc(nome)}</span>${desc ? `<span class="desc">${esc(desc)}</span>` : ''}${marcador}</button>`;
}

function pilulas(k, atual, opcoes, rec = null) {
  return `<div class="pilulas" role="group">${opcoes.map((o) => `<button type="button" class="pilula" data-k="${k}" data-v="${esc(o.id)}" aria-pressed="${String(atual === o.id)}">${o.id === rec ? '<span class="rec" title="Recomendado"></span>' : ''}${esc(o.rotulo)}${o.sub ? ` <small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>`;
}

function cartao(k, v, atual, nome, desc, cfgMini, selo = '') {
  return `<button type="button" class="opcao cartao" data-k="${k}" data-v="${esc(v)}" aria-pressed="${String(atual === v)}">
    <span class="mini" data-mini="${esc(JSON.stringify(cfgMini))}"></span>
    ${selo ? `<span class="selo">${esc(selo)}</span>` : ''}
    <span class="nome">${esc(nome)}</span>${desc ? `<span class="desc">${esc(desc)}</span>` : ''}${marcador}</button>`;
}

const ouvir = (alvo, rotulo = 'Ouvir') => `<button type="button" class="ouvir" data-ouvir="${alvo}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1l9 5-9 5z" fill="currentColor"/></svg>${rotulo}</button>`;

let numero = 0;
function etapa(titulo, ajuda, corpo, feita = false, id = '') {
  numero++;
  return `<section class="etapa ${feita ? 'feita' : ''}" ${id ? `id="${id}"` : ''}>
    <span class="etapa-num" aria-hidden="true">${String(numero).padStart(2, '0')}</span>
    <h2>${titulo}</h2>${ajuda ? `<p class="ajuda">${ajuda}</p>` : ''}${corpo}</section>`;
}

const ILUSTRA = {
  formato: `<svg class="ilustra" viewBox="0 0 120 74" aria-hidden="true"><rect x="2" y="4" width="34" height="66" rx="6" fill="#1C1929" stroke="#9A4DFF" stroke-width="1.5"/><rect x="43" y="4" width="34" height="66" rx="6" fill="#1C1929" stroke="rgba(205,201,251,.25)"/><rect x="84" y="4" width="34" height="66" rx="6" fill="#1C1929" stroke="rgba(205,201,251,.25)"/><rect x="8" y="12" width="22" height="14" rx="3" fill="#9A4DFF"/><rect x="8" y="30" width="22" height="4" rx="2" fill="#C9C4E3"/><rect x="49" y="38" width="22" height="26" rx="4" fill="#3D1BFF"/><rect x="90" y="12" width="22" height="6" rx="3" fill="#EB6BFB"/><rect x="90" y="22" width="22" height="6" rx="3" fill="#C9C4E3"/><rect x="90" y="32" width="22" height="6" rx="3" fill="#C9C4E3"/></svg>`,
  zero: `<svg class="ilustra" viewBox="0 0 120 74" aria-hidden="true">${[14, 37, 60].map((y, i) => `<rect x="4" y="${y - 2}" width="112" height="4" rx="2" fill="#1C1929"/><rect x="4" y="${y - 2}" width="${[70, 40, 95][i]}" height="4" rx="2" fill="${['#9A4DFF', '#3D1BFF', '#EB6BFB'][i]}"/><circle cx="${4 + [70, 40, 95][i]}" cy="${y}" r="7" fill="#F5F3FF"/>`).join('')}</svg>`,
  repetir: `<svg class="ilustra" viewBox="0 0 120 74" aria-hidden="true"><path d="M40 37a20 20 0 1 1 6 14" fill="none" stroke="#9A4DFF" stroke-width="5" stroke-linecap="round"/><path d="M33 47l13 4 2-13" fill="none" stroke="#9A4DFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="72" y="22" width="40" height="8" rx="4" fill="#C9C4E3"/><rect x="72" y="36" width="30" height="8" rx="4" fill="#3D1BFF"/><rect x="72" y="50" width="36" height="8" rx="4" fill="#EB6BFB"/></svg>`,
};

// ------------------------------------------------------------ envio de arquivos (opcional)

const brollPadrao = () => (C.pastas?.broll ? 'pasta' : 'internet');
const enviando = () => [...E.envios.imagens, ...E.envios.broll].some((a) => a.estado === 'enviando');

function blocoEnvio(destino, titulo, ajuda, accept) {
  const lista = E.envios[destino];
  const itens = lista.map((a, i) => `<li class="envio-item ${a.estado}">
      ${a.previa ? `<img src="${esc(a.previa)}" alt="">` : `<span class="envio-icone" aria-hidden="true">${destino === 'broll' && a.estado !== 'erro' ? '▶' : '!'}</span>`}
      <span class="envio-nome">${esc(a.arquivo || a.nome)}</span>
      <span class="envio-estado">${a.estado === 'enviando' ? 'enviando…' : a.estado === 'erro' ? esc(a.erro || 'não subiu') : 'pronto'}</span>
      ${a.estado !== 'enviando' ? `<button type="button" class="envio-remover" data-remover="${destino}:${i}" aria-label="Tirar ${esc(a.arquivo || a.nome)}">×</button>` : ''}
    </li>`).join('');
  return `<div class="envio">
    <label class="envio-area">
      <input type="file" multiple accept="${accept}" data-envio="${destino}">
      <span class="envio-titulo">${esc(titulo)}</span>
      <span class="envio-ajuda">${esc(ajuda)}</span>
    </label>
    ${lista.length ? `<ul class="envio-lista">${itens}</ul>` : ''}
  </div>`;
}

// Os mesmos tipos que o servidor aceita.
const EXTENSOES = {
  imagens: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic'],
  broll: ['.mp4', '.mov', '.m4v', '.webm', '.mkv'],
};

async function enviarArquivos(destino, arquivos) {
  for (const f of arquivos) {
    const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!EXTENSOES[destino].includes(ext)) {
      E.envios[destino].push({ nome: f.name, estado: 'erro', erro: 'tipo de arquivo não aceito' });
      renderizar();
      continue;
    }
    const item = { nome: f.name, estado: 'enviando', previa: f.type.startsWith('image/') ? URL.createObjectURL(f) : null };
    E.envios[destino].push(item);
    renderizar();
    try {
      const r = await fetch(`/api/enviar?destino=${destino}&nome=${encodeURIComponent(f.name)}`, { method: 'POST', body: f });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.erro || 'não subiu');
      Object.assign(item, { estado: 'pronto', arquivo: d.arquivo });
    } catch (e) {
      Object.assign(item, { estado: 'erro', erro: e.message === 'Failed to fetch' ? (noEscritorio() ? 'o escritório não respondeu' : 'o Claude Code não respondeu') : e.message });
    }
    renderizar();
  }
}

async function removerArquivo(destino, i) {
  const item = E.envios[destino][i];
  if (!item) return;
  if (item.estado === 'pronto') {
    try { await fetch(`/api/enviar?destino=${destino}&nome=${encodeURIComponent(item.arquivo)}`, { method: 'DELETE' }); } catch {}
  }
  if (item.previa) URL.revokeObjectURL(item.previa);
  E.envios[destino].splice(i, 1);
  renderizar();
}

function soltarArquivos(ev) {
  const area = ev.target.closest?.('.envio-area');
  if (!area) return;
  ev.preventDefault();
  area.classList.toggle('arrastando', ev.type === 'dragover');
  if (ev.type === 'drop') {
    const input = area.querySelector('input[type=file]');
    const aceitos = [...ev.dataTransfer.files].filter((f) => (input.accept === 'video/*' ? f.type.startsWith('video/') : f.type.startsWith('image/')));
    if (aceitos.length) enviarArquivos(input.dataset.envio, aceitos);
  }
}
['dragover', 'dragleave', 'drop'].forEach((t) => document.addEventListener(t, soltarArquivos));

// ------------------------------------------------------------ montagem das etapas

function etapaArquivos() {
  const vids = C.videos || [];
  const auds = C.audios || [];
  if (vids.length < 2 && !auds.length) return '';
  let corpo = '';
  if (vids.length > 1) {
    corpo += `<p class="subtitulo">Qual vídeo editar?</p>${pilulas('video', String(E.video), vids.map((v, i) => ({ id: String(i), rotulo: v.arquivo, sub: fmtDur(v.duracao) })))}`;
  }
  auds.forEach((a, i) => {
    corpo += `<p class="subtitulo">O que é o arquivo <b>${esc(a.arquivo)}</b>?</p>${pilulas(`usoAudio.${i}`, E.usoAudio[i] || null, USO_AUDIO)}`;
  });
  const feita = auds.every((a, i) => E.usoAudio[i]);
  return etapa('Os arquivos da pasta', 'Achei mais de um arquivo de mídia. Me diz o papel de cada um.', corpo, feita);
}

function etapaModo() {
  if (E.formatoTravado) return '';
  const p = prefs();
  const rec = p ? 'repetir' : 'formato';
  let corpo = '<div class="modos">';
  corpo += botao('modo', 'formato', E.modo, { nome: 'Com um formato pronto', desc: 'Escolhe o formato e o visual, e o vídeo sai daquele jeito, quase sem perguntas.', selo: rec === 'formato' ? 'Recomendado' : '', extra: ILUSTRA.formato });
  corpo += botao('modo', 'zero', E.modo, { nome: 'Do zero', desc: 'Você escolhe cada detalhe: nível, legenda, visual e música.', extra: ILUSTRA.zero });
  if (p) corpo += botao('modo', 'repetir', E.modo, { nome: 'Repetir o último vídeo', desc: 'Usa as escolhas e os ajustes do último vídeo que você aprovou.', selo: 'Recomendado', extra: ILUSTRA.repetir });
  corpo += '</div>';
  if (C.preferencias?.formato && !formatoInstalado(C.preferencias.formato)) corpo += '<p class="aviso">O formato do último vídeo não está instalado. Escolha outro caminho ou instale o pacote que contém esse formato. Suas preferências continuam salvas.</p>';
  return etapa('Como quer editar este vídeo?', '', corpo, !!E.modo, 'etapa-modo');
}

function etapaFormato() {
  if (E.formatoTravado) {
    const f = formato(E.formato);
    const aviso = f && !serve(f) ? `<p class="aviso"><b>Esse formato é ${f.orient === 'h' ? 'horizontal' : 'vertical'} e a sua gravação é ${orientacao()}.</b> Dá pra seguir, mas a imagem vai ser bem cortada. Se quiser, troque de formato.</p>` : '';
    return etapa(`Formato: ${esc(f?.nome)}`, `${esc(f?.desc)}. <button type="button" class="trocar" data-acao="destravar">Trocar de formato</button>`, aviso, true);
  }
  const instalados = FORMATOS.filter((f) => formatoInstalado(f.id));
  const disponiveis = instalados.filter(serve);
  const atual = E.formato;
  const selo = (f) => (prefs()?.formato === f.id ? 'Seu último' : '');
  const grupo = (orient) => disponiveis.filter((f) => f.orient === orient).map((f) => cartao('formato', f.id, atual, f.nome, f.desc, { tipo: 'formato', formato: f.id, estilo: 'original' }, selo(f))).join('');
  const blocoV = grupo('v') ? `<p class="subtitulo">Vertical 9:16, pra Reels, TikTok e Shorts</p><div class="grade grade-v">${grupo('v')}</div>` : '';
  const blocoH = grupo('h') ? `<p class="subtitulo">Horizontal 16:9, pro YouTube</p><div class="grade grade-h">${grupo('h')}</div>` : '';
  let corpo = orientacao() === 'horizontal' ? blocoH + blocoV : blocoV + blocoH;
  if (!disponiveis.length) corpo += '<p class="aviso">Nenhum formato instalado combina com a orientação desta gravação. Você pode usar o caminho Do zero ou instalar um pacote com formatos para esta orientação.</p>';
  corpo += extrasDoFormato();
  const o = orientacao();
  const ajuda = o === 'vertical'
    ? 'Sua gravação é vertical, então aqui estão só os formatos verticais. Toque num formato pra ver a prévia ao lado; o visual você escolhe no próximo passo.'
    : o === 'horizontal'
      ? 'Sua gravação é horizontal, então aqui estão os formatos pro YouTube e o Cortes de Vídeo Longo, que tira cortes verticais dela. Toque num formato pra ver a prévia ao lado.'
      : 'Toque num formato pra ver a prévia ao lado. A estrutura é do formato; o visual você escolhe no próximo passo.';
  return etapa('Qual formato?', ajuda, corpo, disponiveis.some((f) => f.id === E.formato), 'etapa-formato');
}

function extrasDoFormato() {
  if (E.formato === 'reels-com-broll') {
    const opcoes = BROLL.filter((o) => o.id !== 'pasta' || C.pastas?.broll);
    const rec = brollPadrao();
    let html = `<p class="subtitulo">De onde vêm os clipes de apoio (B-roll)?</p>${pilulas('broll', E.broll || rec, opcoes, rec)}`;
    if ((E.broll || rec) === 'internet') html += `<p class="ajuda" style="margin-top:10px">O Claude procura na internet clipes que mostram o que você fala e anota de onde veio cada um no relatório. Você não precisa juntar nada.</p>`;
    if ((E.broll || rec) === 'subir') html += blocoEnvio('broll', 'Seus clipes', 'Arraste os vídeos aqui ou clique pra escolher. Vão pra pasta broll/ do vídeo.', 'video/*');
    return html;
  }
  if (E.formato === 'cortes-de-video-longo') {
    const curto = duracao() && duracao() < 180;
    return `${curto ? `<p class="aviso"><b>Esse vídeo é curto pra virar cortes</b> (${fmtDur(duracao())}). Dá pra seguir com 1 ou 2 cortes, ou editar ele inteiro no YouTube Educativo.</p>` : ''}
      <p class="subtitulo">Quantos cortes?</p>${pilulas('cortesQtd', E.cortesQtd, CORTES.qtd, '5')}
      <p class="subtitulo">Duração de cada corte?</p>${pilulas('cortesDur', E.cortesDur, CORTES.dur, '30-60')}`;
  }
  if (E.formato === 'aula-em-tela-dividida') {
    return `<p class="aviso">${C.pastas?.roteiro ? '<b>Achei um roteiro na pasta.</b> O documento da aula vai sair dele, conferido com o que você falou.' : 'Se tiver o roteiro ou as anotações da aula, coloque na pasta do vídeo: o documento fica mais fiel. Sem roteiro, ele sai da sua fala.'}</p>`;
  }
  return '';
}

function etapaEstilo() {
  if (!E.formato) return '';
  const p = prefs();
  const rec = p?.estiloVisual && estilosParaFormato(E.formato).some((e) => e.id === p.estiloVisual) ? p.estiloVisual : 'original';
  const cor = E.cor === 'marca' && HEX.test(E.corHex) ? E.corHex : null;
  const cards = estilosParaFormato(E.formato).map((e) => cartao('estilo', e.id, E.estilo, e.nome, e.resumo, { tipo: 'formato', formato: E.formato, estilo: e.id, cor, cores: e.cores || null }, e.id === rec ? 'Recomendado' : '')).join('');
  return etapa('Qual estilo visual?', 'O formato continua o mesmo. Muda a cara: cores, fontes, legenda e música.', `<div class="grade ${formato(E.formato)?.orient === 'h' ? 'grade-h' : 'grade-estilos'}">${cards}</div>`, !!E.estilo, 'etapa-estilo');
}

function etapaDetalhesFormato() {
  if (!E.formato || !E.estilo) return '';
  const f = formato(E.formato);
  let corpo = '';
  const musicas = [{ id: 'estilo', rotulo: 'Com música' }];
  if (temMusicaNaPasta()) musicas.push({ id: 'pasta', rotulo: 'Com a música da pasta' });
  musicas.push({ id: 'sem', rotulo: 'Sem música' });
  corpo += `<p class="subtitulo">Música de fundo</p><div class="linha-campo" style="margin-top:0">${pilulas('musica', E.musica, musicas, 'estilo')}${E.musica !== 'sem' ? ouvir(`musica:${climaFormato()}`) : ''}</div>`;
  corpo += `<p class="subtitulo">Efeitos sonoros</p><div class="linha-campo" style="margin-top:0">${pilulas('efeitos', E.efeitos, [{ id: 'estilo', rotulo: 'Com efeitos sonoros' }, { id: 'nenhum', rotulo: 'Sem efeitos sonoros' }], 'estilo')}${E.efeitos !== 'nenhum' ? ouvir(`efeitos:${cfgSom().efeitos}`) : ''}</div>`;
  const recCor = prefs()?.corMarca ? 'marca' : 'estilo';
  corpo += `<p class="subtitulo">Cor de destaque</p>${pilulas('cor', E.cor, [{ id: 'estilo', rotulo: 'A do estilo' }, { id: 'marca', rotulo: 'A cor da minha marca' }], recCor)}`;
  if (E.cor === 'marca') corpo += `<div class="linha-campo"><label class="cor"><input type="color" data-campo="corHex" value="${esc(HEX.test(E.corHex) ? E.corHex : '#9A4DFF')}" aria-label="Cor da marca"><span data-eco="corHex">${esc(E.corHex)}</span></label><span class="ajuda" style="margin:0">Troca só a cor de destaque. Fundo, fontes e layout continuam.</span></div>`;
  const ajustes = prefs()?.ajustesFixos || [];
  if (ajustes.length) {
    corpo += `<p class="subtitulo">Aplicar seus ajustes fixos neste vídeo?</p>${pilulas('ajustes', E.ajustes, [{ id: 'sim', rotulo: 'Sim' }, { id: 'nao', rotulo: 'Não' }], 'sim')}<ul class="ajustes">${ajustes.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`;
  }
  return etapa('Últimos detalhes', 'Já vem tudo no padrão do estilo. Mude só se quiser.', corpo, true, 'etapa-detalhes');
}

function etapasZero() {
  let html = '';
  const z = E.zero;
  const padrao = `<div class="modos">
    ${botao('zero.padrao', 'completo', z.padrao, { nome: 'Padrão completo', desc: `${orientacao() === 'horizontal' ? 'Horizontal' : 'Vertical'}, nível Completo, visual claro tecnológico, legenda padrão, música eletrônica e efeitos completos.`, selo: 'Recomendado' })}
    ${botao('zero.padrao', 'personalizar', z.padrao, { nome: 'Personalizar', desc: 'Escolho nível, legenda, visual, música e efeitos.' })}</div>`;
  html += etapa('Padrão completo ou personalizar?', 'O padrão é o vídeo mais completo que a Máquina faz. Dá pra ver na prévia.', padrao, !!z.padrao, 'etapa-padrao');
  if (z.padrao !== 'personalizar') return html;

  const nivelMini = (n) => ({ cena: { completo: 2, imagens: 1, basico: 1 }[n], tipo: 'zero', proporcao: z.proporcao, nivel: n, legendas: z.legendas, capa: 'sem', estilo: z.estilo, marca: { hex: z.marcaHex, fundo: z.marcaFundo }, cores: coresDe(z.estilo) });
  const grade = z.proporcao === 'horizontal' ? 'grade-h' : 'grade-estilos';
  const o = orientacao();
  const proporcao = o
    ? `<p class="ajuda" style="margin-top:0">Sua gravação é ${o}, então o vídeo sai ${o === 'vertical' ? 'na vertical 9:16, pra Reels, TikTok e Shorts' : 'na horizontal 16:9, pro YouTube'}.</p>`
    : `<p class="subtitulo">Onde o vídeo vai ser postado?</p>${pilulas('zero.proporcao', z.proporcao, ZERO.proporcao, 'vertical')}`;
  html += etapa(o ? 'Quanta edição?' : 'Onde vai ser postado e quanta edição?', '', `
    ${proporcao}
    <p class="subtitulo">Qual nível de edição?</p><div class="grade ${grade}">${ZERO.nivel.map((n, i) => cartao('zero.nivel', n.id, z.nivel, n.rotulo, n.sub, nivelMini(n.id), i === 0 ? 'Recomendado' : '')).join('')}</div>`, true, 'etapa-nivel');

  const estilos = [...ZERO.estilo, ...estilosDaPessoa().map((e) => ({ id: e.id, rotulo: e.nome, sub: e.resumo }))];
  const estMini = (id) => ({ tipo: 'zero', proporcao: z.proporcao, nivel: z.nivel === 'basico' ? 'imagens' : z.nivel, legendas: z.legendas, capa: 'sem', estilo: id, marca: { hex: z.marcaHex, fundo: z.marcaFundo, fonte: z.marcaFonte }, cores: coresDe(id) });
  let visual = `<p class="subtitulo">Estilo das legendas</p>${pilulas('zero.legendas', z.legendas, ZERO.legendas, 'padrao')}`;
  if (z.legendas === 'marca' || z.estilo === 'marca') visual += campoMarca();
  visual += `<p class="subtitulo">Estilo visual ${z.nivel === 'basico' ? '<small style="color:var(--tinta-3);font-weight:400">(no Básico, muda só a legenda e a música)</small>' : ''}</p><div class="grade ${grade}">${estilos.map((e, i) => cartao('zero.estilo', e.id, z.estilo, e.rotulo, e.sub, estMini(e.id), i === 0 ? 'Recomendado' : '')).join('')}</div>`;
  if (z.estilo === 'marca' && z.legendas !== 'marca') visual += campoMarca();
  html += etapa('O visual', '', visual, true, 'etapa-visual');

  const musicas = ZERO.musica.filter((m) => m.id !== 'pasta' || temMusicaNaPasta());
  let audio = `<p class="subtitulo">Música de fundo</p><div class="linha-campo" style="margin-top:0">${pilulas('zero.musica', z.musica, musicas, 'eletronica')}${z.musica !== 'sem' ? ouvir(`musica:${z.musica}`) : ''}</div>`;
  audio += `<p class="subtitulo">Efeitos sonoros</p><div class="linha-campo" style="margin-top:0">${pilulas('zero.efeitos', z.efeitos, ZERO.efeitos, 'completos')}${z.efeitos !== 'nenhum' ? ouvir(`efeitos:${z.efeitos === 'essenciais' ? 'essenciais' : 'todos'}`) : ''}</div>`;
  if (z.nivel !== 'basico') audio += `<p class="subtitulo">Verificar notícias e números citados?</p>${pilulas('zero.verificar', z.verificar, ZERO.verificar, 'sim')}`;
  html += etapa('Áudio e conteúdo', '', audio, true, 'etapa-audio');
  return html;
}

function campoMarca() {
  const z = E.zero;
  return `<div class="aviso" style="margin-top:14px"><b>Sua marca</b>
    <div class="linha-campo"><label class="cor"><input type="color" data-campo="zero.marcaHex" value="${esc(HEX.test(z.marcaHex) ? z.marcaHex : '#9A4DFF')}" aria-label="Cor principal da marca"><span data-eco="zero.marcaHex">${esc(z.marcaHex)}</span></label>
    ${z.estilo === 'marca' ? pilulas('zero.marcaFundo', z.marcaFundo, [{ id: 'claro', rotulo: 'Fundo claro' }, { id: 'escuro', rotulo: 'Fundo escuro' }]) : ''}</div>
    ${z.estilo === 'marca' ? `<div class="linha-campo"><input class="campo" data-campo="zero.marcaFonte" placeholder="Fonte da marca, se tiver (ex: Montserrat)" value="${esc(z.marcaFonte)}" aria-label="Fonte da marca"></div>` : ''}</div>`;
}

function etapaRepetir() {
  const p = prefs();
  if (!p) return '';
  const linhas = (p.resumo || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  let corpo = `<table class="resumo">${linhas}</table>`;
  const fSalvo = formato(p.formato);
  const propSalva = p.zero?.proporcao;
  if ((fSalvo && !serve(fSalvo)) || (propSalva && orientacao() && propSalva !== orientacao())) {
    corpo += `<p class="aviso"><b>O último vídeo era ${fSalvo ? (fSalvo.orient === 'h' ? 'horizontal' : 'vertical') : propSalva} e esta gravação é ${orientacao()}.</b> Repetir vai cortar bastante a imagem. Se preferir, volte e escolha um formato que combine.</p>`;
  }
  if (p.ajustesFixos?.length) corpo += `<p class="subtitulo">Ajustes fixos que entram junto</p><ul class="ajustes">${p.ajustesFixos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`;
  if (p.musicaDaPasta && !temMusicaNaPasta()) {
    corpo += `<p class="subtitulo">Você costuma usar uma música da pasta, mas não achei nenhuma aqui. Qual usar?</p>${pilulas('repetirMusica', E.repetirMusica, ZERO.musica.filter((m) => m.id !== 'pasta'), 'eletronica')}`;
  }
  return etapa('O que está salvo do último vídeo', 'Vou usar estas escolhas de novo. Se quiser mudar alguma coisa, volte e escolha outro caminho.', corpo, true, 'etapa-repetir');
}

// Proporção do vídeo final: a do formato, a escolhida no caminho do zero ou a da gravação.
function orientacaoSaida() {
  if (E.modo === 'formato' && E.formato) return formato(E.formato)?.orient === 'h' ? 'horizontal' : 'vertical';
  if (E.modo === 'zero' && E.zero.padrao) return (E.zero.padrao === 'completo' ? padraoCompleto() : E.zero).proporcao;
  return orientacao() || 'vertical';
}

function exportacao() {
  const lado = Number(E.expRes), longo = Math.round(lado * 16 / 9);
  const vertical = orientacaoSaida() === 'vertical';
  const res = EXPORTACAO.resolucao.find((o) => o.id === E.expRes);
  return { resolucao: `${lado}p`, nome: res.rotulo, largura: vertical ? lado : longo, altura: vertical ? longo : lado, fps: Number(E.expFps) };
}

function textoExportacao() {
  const x = exportacao();
  return `${x.nome} ${x.resolucao} (${x.largura} × ${x.altura}), ${x.fps} fps`;
}

function blocoExportacao() {
  const x = exportacao();
  const v = C.videos?.[E.video] || {};
  const menor = Math.min(...String(v.resolucao || '').split(/x/i).map(Number).filter(Boolean));
  const avisos = [];
  if (Number.isFinite(menor) && menor < Number(E.expRes)) avisos.push(`Sua gravação tem ${menor}p: em ${x.nome} o arquivo fica maior, mas a câmera não fica mais nítida (os gráficos e a legenda ficam).`);
  if (v.fps && Math.round(v.fps) < x.fps) avisos.push(`Sua gravação é de ${Math.round(v.fps)} fps: as animações saem a ${x.fps} fps, a câmera continua com o movimento da gravação.`);
  return `<p class="subtitulo observacoes-rotulo">Qualidade da exportação</p>
    <p class="ajuda" style="margin:0 0 12px">Vale pro MP4 final, que só é gerado depois que você aprovar a edição.</p>
    ${pilulas('expRes', E.expRes, EXPORTACAO.resolucao, '1080')}
    <div style="height:10px"></div>
    ${pilulas('expFps', E.expFps, EXPORTACAO.fps, '60')}
    <p class="ajuda" style="margin:12px 0 0">Sai em ${x.largura} × ${x.altura} a ${x.fps} fps.${avisos.length ? ' ' + avisos.map(esc).join(' ') : ''}</p>`;
}

function etapaResumo() {
  const r = resumo();
  if (!r.length || falta()) return '';
  return etapa('Conferir e começar', noEscritorio() ? 'É isso que vai pra sala de Edição. Ela edita sozinha e o escritório te chama quando o vídeo estiver pronto pra assistir.' : 'É isso que vai pro Claude Code. Ele edita sozinho e te chama quando o vídeo estiver pronto pra assistir.', `
    <table class="resumo">${r.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    ${blocoExportacao()}
    <p class="subtitulo observacoes-rotulo">Imagens pra usar no vídeo <small>(opcional)</small></p>
    <p class="ajuda" style="margin:0 0 12px">Prints, logos, fotos do produto. Elas entram no lugar das imagens que o Claude buscaria sozinho. Sem imagens, ele busca o que você citar.</p>
    ${blocoEnvio('imagens', 'Suas imagens', 'Arraste as imagens aqui ou clique pra escolher. Vão pra pasta imagens/ do vídeo.', 'image/*')}
    <label class="subtitulo observacoes-rotulo" for="observacoes">Observações <small>(opcional)</small></label>
    <textarea id="observacoes" class="campo observacoes" data-campo="observacoes" maxlength="2000" rows="4" placeholder="Algo que o Claude precisa saber pra editar este vídeo. Ex: corta a parte em que eu tusso no começo; o produto se chama Falow, com F maiúsculo; deixa a música bem baixinha.">${esc(E.observacoes)}</textarea>
    ${noEscritorio() ? '' : '<p class="chat">Prefere responder as perguntas no chat? <button type="button" class="trocar" data-acao="chat">Voltar pro Claude Code sem escolher aqui</button></p>'}`, true, 'etapa-resumo');
}

// ------------------------------------------------------------ o que falta e o resumo

function falta() {
  if (enviando()) return 'Espere os arquivos terminarem de subir';
  const auds = C.audios || [];
  for (let i = 0; i < auds.length; i++) if (!E.usoAudio[i]) return `Diga o que é o arquivo ${auds[i].arquivo}`;
  if (!E.modo) return 'Escolha como quer editar';
  if (E.modo === 'formato') {
    if (!E.formato) return 'Escolha o formato';
    if (!E.estilo) return 'Escolha o estilo visual';
    if (E.formato === 'reels-com-broll' && (E.broll || brollPadrao()) === 'subir' && !E.envios.broll.some((a) => a.estado === 'pronto')) return 'Suba pelo menos um clipe ou escolha outra opção de B-roll';
    if (E.cor === 'marca' && !HEX.test(E.corHex)) return 'Escolha a cor da marca';
  }
  if (E.modo === 'zero') {
    const z = E.zero;
    if (!z.padrao) return 'Escolha padrão completo ou personalizar';
    if (z.padrao === 'personalizar') {
      if ((z.estilo === 'marca' || z.legendas === 'marca') && !HEX.test(z.marcaHex)) return 'Escolha a cor da marca';
    }
  }
  return '';
}

function rotulo(lista, id) { return (lista.find((o) => o.id === id) || {}).skill || (lista.find((o) => o.id === id) || {}).rotulo || id; }

function resumo() {
  const r = [];
  const v = C.videos?.[E.video];
  if (v) r.push(['Vídeo', `${v.arquivo}${v.orientacao ? ` (gravação ${v.orientacao}${v.duracao ? `, ${fmtDur(v.duracao)}` : ''})` : ''}`]);
  (C.audios || []).forEach((a, i) => { if (E.usoAudio[i]) r.push([`Arquivo ${a.arquivo}`, rotulo(USO_AUDIO, E.usoAudio[i])]); });
  if (E.modo === 'formato') {
    r.push(['Formato', formato(E.formato)?.nome || '']);
    if (E.estilo) r.push(['Estilo visual', nomeEstilo(E.estilo)]);
    if (E.formato === 'reels-com-broll') r.push(['B-roll', rotulo(BROLL, E.broll || brollPadrao()) + (n => (n ? ` (${n} ${n === 1 ? 'clipe' : 'clipes'})` : ''))(E.envios.broll.filter((a) => a.estado === 'pronto').length)]);
    if (E.formato === 'cortes-de-video-longo') { r.push(['Quantos cortes', rotulo(CORTES.qtd, E.cortesQtd)]); r.push(['Duração de cada corte', rotulo(CORTES.dur, E.cortesDur)]); }
    r.push(['Música', { estilo: 'Com música (a do estilo)', pasta: 'Com a música da pasta', sem: 'Sem música' }[E.musica]]);
    r.push(['Efeitos sonoros', E.efeitos === 'nenhum' ? 'Sem efeitos sonoros' : 'Com efeitos sonoros (os do estilo)']);
    r.push(['Cor de destaque', E.cor === 'marca' ? `A cor da minha marca (${E.corHex})` : 'A do estilo']);
    if (prefs()?.ajustesFixos?.length) r.push(['Ajustes fixos', E.ajustes === 'sim' ? 'Aplicar' : 'Não aplicar']);
  }
  if (E.modo === 'zero' && E.zero.padrao) {
    const z = E.zero.padrao === 'completo' ? padraoCompleto() : E.zero;
    if (E.zero.padrao === 'completo') r.push(['Caminho', 'Do zero, padrão completo']);
    r.push(['Proporção', rotulo(ZERO.proporcao, z.proporcao)]);
    r.push(['Nível', rotulo(ZERO.nivel, z.nivel)]);
    r.push(['Legendas', rotulo(ZERO.legendas, z.legendas)]);
    const est = [...ZERO.estilo, ...estilosDaPessoa().map((e) => ({ id: e.id, rotulo: e.nome }))].find((e) => e.id === z.estilo);
    r.push(['Estilo visual', est?.rotulo || z.estilo]);
    if (z.estilo === 'marca' || z.legendas === 'marca') r.push(['Marca', [E.zero.marcaHex, z.estilo === 'marca' ? `fundo ${E.zero.marcaFundo}` : '', E.zero.marcaFonte].filter(Boolean).join(', ')]);
    r.push(['Música', rotulo(ZERO.musica, z.musica)]);
    r.push(['Efeitos sonoros', rotulo(ZERO.efeitos, z.efeitos)]);
    if (z.nivel !== 'basico') r.push(['Verificar fontes', rotulo(ZERO.verificar, z.verificar)]);
  }
  if (E.modo === 'repetir') {
    r.push(['Caminho', 'Repetir o último vídeo']);
    if (prefs()?.musicaDaPasta && !temMusicaNaPasta()) r.push(['Música', rotulo(ZERO.musica, E.repetirMusica)]);
  }
  if (E.modo) r.push(['Exportação', textoExportacao()]);
  const imgs = E.envios.imagens.filter((a) => a.estado === 'pronto');
  if (imgs.length) r.push(['Imagens enviadas', `${imgs.length} ${imgs.length === 1 ? 'imagem' : 'imagens'} na pasta imagens/`]);
  return r;
}

function saida() {
  const v = C.videos?.[E.video] || {};
  const base = {
    versao: 1,
    caminho: { formato: 'formato-pronto', zero: 'do-zero', repetir: 'repetir-ultimo' }[E.modo],
    video: v.arquivo || null,
    audios: (C.audios || []).map((a, i) => ({ arquivo: a.arquivo, uso: E.usoAudio[i], usoTexto: rotulo(USO_AUDIO, E.usoAudio[i]) })),
    resumo: resumo(),
    observacoes: E.observacoes.trim() || null,
    imagensEnviadas: E.envios.imagens.filter((a) => a.estado === 'pronto').map((a) => `imagens/${a.arquivo}`),
    brollEnviados: E.envios.broll.filter((a) => a.estado === 'pronto').map((a) => `broll/${a.arquivo}`),
    exportacao: exportacao(),
  };
  if (E.modo === 'formato') {
    Object.assign(base, {
      formato: { id: E.formato, nome: formato(E.formato)?.nome },
      estiloVisual: { id: E.estilo, nome: nomeEstilo(E.estilo) },
      respostas: {
        musica: { estilo: 'A do estilo', pasta: 'Usar a música que está na pasta', sem: 'Sem música' }[E.musica],
        efeitos: E.efeitos === 'nenhum' ? 'Nenhum' : 'Os do estilo',
        corDestaque: E.cor === 'marca' ? 'A cor da minha marca' : 'A do estilo',
        corMarca: E.cor === 'marca' ? E.corHex : null,
        aplicarAjustesFixos: prefs()?.ajustesFixos?.length ? E.ajustes === 'sim' : null,
        cortes: E.formato === 'cortes-de-video-longo' ? { quantidade: rotulo(CORTES.qtd, E.cortesQtd), duracao: rotulo(CORTES.dur, E.cortesDur) } : null,
        broll: E.formato === 'reels-com-broll' ? rotulo(BROLL, E.broll || brollPadrao()) : null,
      },
    });
  }
  if (E.modo === 'zero') {
    const completo = E.zero.padrao === 'completo';
    const z = completo ? padraoCompleto() : E.zero;
    const est = [...ZERO.estilo, ...estilosDaPessoa().map((e) => ({ id: e.id, rotulo: e.nome }))].find((e) => e.id === z.estilo);
    base.padraoCompleto = completo;
    base.respostas = {
      proporcao: rotulo(ZERO.proporcao, z.proporcao), nivel: rotulo(ZERO.nivel, z.nivel), legendas: rotulo(ZERO.legendas, z.legendas),
      estiloVisual: { id: z.estilo, nome: est?.rotulo || z.estilo },
      marca: !completo && (z.estilo === 'marca' || z.legendas === 'marca') ? { cor: E.zero.marcaHex, fundo: z.estilo === 'marca' ? E.zero.marcaFundo : null, fonte: E.zero.marcaFonte || null } : null,
      musica: rotulo(ZERO.musica, z.musica), efeitos: rotulo(ZERO.efeitos, z.efeitos),
      verificarFontes: z.nivel === 'basico' ? null : rotulo(ZERO.verificar, z.verificar),
    };
  }
  if (E.modo === 'repetir') {
    base.respostas = {
      musica: prefs()?.musicaDaPasta && !temMusicaNaPasta() ? rotulo(ZERO.musica, E.repetirMusica) : null,
    };
  }
  return base;
}

// ------------------------------------------------------------ desenho

const cacheMini = new Map();

function renderizar() {
  numero = 0;
  let html = `<div class="abertura"><h1>Como seu vídeo vai ficar</h1><p>Cada escolha aparece na prévia ao lado, com um bonequinho no seu lugar. Quando estiver do seu jeito, clique em começar${noEscritorio() ? ': o escritório continua sozinho' : ' e volte pro Claude Code'}.</p></div>`;
  html += etapaArquivos();
  html += etapaModo();
  if (E.modo === 'formato') html += etapaFormato() + etapaEstilo() + etapaDetalhesFormato();
  if (E.modo === 'zero') html += etapasZero();
  if (E.modo === 'repetir') html += etapaRepetir();
  html += etapaResumo();
  const el = $('#escolhas');
  el.innerHTML = html;
  el.querySelectorAll('[data-mini]').forEach((slot) => {
    const chave = slot.dataset.mini;
    let no = cacheMini.get(chave);
    if (!no) {
      no = document.createElement('span');
      no.style.cssText = 'position:absolute;inset:0;display:block';
      cacheMini.set(chave, no);
      slot.appendChild(no);
      try { const cfg = JSON.parse(slot.dataset.mini); miniatura(no, cfg, null, cfg.cena ?? null); } catch (e) { console.warn('miniatura', e); }
    } else slot.appendChild(no);
  });
  atualizarMonitor();
}

function atualizarMonitor() {
  const cfg = cfgPrevia();
  const { W } = tamanhoPalco(cfg);
  $('#moldura').classList.toggle('horizontal', W > 1080);
  previa.definir(cfg);
  som.definir(cfgSom());
  let titulo = 'Prévia';
  if (cfg.tipo === 'formato') titulo = `${formato(cfg.formato)?.nome}${E.modo === 'formato' && E.estilo ? ` + ${nomeEstilo(E.estilo)}` : ''}`;
  if (cfg.tipo === 'zero') titulo = `Do zero, nível ${rotulo(ZERO.nivel, cfg.nivel).replace(' com motion', '')}`;
  if (!E.modo) titulo = 'Exemplo: Reels de Negócio';
  $('#monitor-titulo').textContent = titulo;
  $('#monitor-nota').textContent = 'demonstração do estilo';
  const f = falta();
  $('#comecar').disabled = !!f;
  $('#falta').textContent = f;
}

function desenharTrilhas(i, cenas) {
  const t = $('#trilhas');
  const chave = cenas.map((c) => c.nome + c.dur).join('|');
  if (t.dataset.chave !== chave) {
    t.dataset.chave = chave;
    t.innerHTML = cenas.map((c, j) => `<button type="button" class="trilha" data-cena="${j}" style="flex:${c.dur}" title="${esc(c.nome)}">${esc(c.nome)}</button>`).join('');
  }
  t.querySelectorAll('.trilha').forEach((b, j) => b.classList.toggle('atual', j === i));
}

function fmtDur(s) {
  s = Math.round(Number(s) || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

function cabecalho() {
  const v = C.videos?.[E.video];
  const el = $('#arquivo');
  if (!v) return;
  const ferr = C.ferramentas ? Object.keys(C.ferramentas) : [];
  el.hidden = false;
  el.innerHTML = `<span><b>${esc(v.arquivo)}</b></span>
    <span class="detalhe">${esc(v.orientacao || '')}${v.resolucao ? ` ${esc(v.resolucao)}` : ''}</span>
    ${v.duracao ? `<span class="detalhe">${fmtDur(v.duracao)}</span>` : ''}
    ${ferr.length ? `<span class="conferido" title="${esc(ferr.join(', '))}">Ferramentas conferidas</span>` : ''}`;
}

// ------------------------------------------------------------ eventos

function definir(k, v) {
  const partes = k.split('.');
  if (partes[0] === 'usoAudio') { E.usoAudio[partes[1]] = v; return; }
  if (partes[0] === 'zero') { E.zero[partes[1]] = v; return; }
  if (k === 'video') {
    E.video = Number(v);
    cabecalho();
    if (E.formato && !E.formatoTravado && !serve(formato(E.formato))) { E.formato = null; E.estilo = null; }
    acertarProporcao();
    return;
  }
  if (k === 'formato') {
    E.formato = v;
    // O estilo já escolhido continua, se existir pra esse formato.
    if (E.estilo && !estilosParaFormato(v).some((e) => e.id === E.estilo)) E.estilo = null;
    return;
  }
  if (k === 'modo') {
    E.modo = v;
    if (v === 'formato' && prefs()?.corMarca && E.cor === 'estilo') { E.cor = 'marca'; E.corHex = prefs().corMarca; }
    return;
  }
  E[k] = v;
}

function acertarProporcao() {
  const o = orientacao();
  if (o) E.zero.proporcao = o;
}

function rolarPara(id) {
  if (jaRolou.has(id)) return;
  jaRolou.add(id);
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight * 0.75 || r.top < 70) window.scrollTo({ top: scrollY + r.top - 90, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-k]');
  if (b) {
    const k = b.dataset.k, v = b.dataset.v;
    definir(k, v);
    renderizar();
    if (k === 'modo') rolarPara(v === 'formato' ? 'etapa-formato' : v === 'zero' ? 'etapa-padrao' : 'etapa-repetir');
    if (k === 'formato') rolarPara('etapa-estilo');
    if (k === 'estilo') rolarPara('etapa-detalhes');
    if (k === 'zero.padrao') rolarPara(v === 'personalizar' ? 'etapa-nivel' : 'etapa-resumo');
    return;
  }
  const o = ev.target.closest('[data-ouvir]');
  if (o) {
    const [tipo, valor] = o.dataset.ouvir.split(':');
    if (tipo === 'musica') som.amostraMusica(valor, urlMusicaPasta());
    else som.amostraEfeitos(valor, cfgSom().pixel);
    return;
  }
  const rem = ev.target.closest('[data-remover]');
  if (rem) { const [d, i] = rem.dataset.remover.split(':'); removerArquivo(d, Number(i)); return; }
  const acao = ev.target.closest('[data-acao]')?.dataset.acao;
  if (acao === 'destravar') {
    E.formatoTravado = false;
    if (E.formato && !serve(formato(E.formato))) { E.formato = null; E.estilo = null; }
    renderizar();
    return;
  }
  if (acao === 'chat') prefiroChat();
  const cena = ev.target.closest('[data-cena]');
  if (cena) previa.irPara(Number(cena.dataset.cena));
});

document.addEventListener('input', (ev) => {
  const k = ev.target.dataset?.campo;
  if (!k) return;
  const v = ev.target.value;
  if (k.startsWith('zero.')) E.zero[k.slice(5)] = v; else E[k] = v;
  document.querySelectorAll(`[data-eco="${k}"]`).forEach((s) => { s.textContent = v; });
  if (k === 'zero.marcaFonte') carregarFonte(v);
  atualizarMonitor();
});

// Fonte da marca: tenta buscar no Google Fonts pra prévia já mostrar com ela.
let fonteTimer;
function carregarFonte(nome) {
  clearTimeout(fonteTimer);
  fonteTimer = setTimeout(() => {
    const limpo = nome.trim().replace(/[^\p{L}\p{N} ]/gu, '');
    if (!limpo) return;
    const id = 'fonte-marca';
    document.getElementById(id)?.remove();
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(limpo).replace(/%20/g, '+')}:wght@400;700;800&display=swap`;
    l.onload = () => { previa.chave = null; atualizarMonitor(); };
    document.head.appendChild(l);
  }, 500);
}

// Cor escolhida: redesenha as miniaturas com a cor nova.
document.addEventListener('change', (ev) => {
  if (ev.target.type === 'color') renderizar();
  if (ev.target.dataset?.envio && ev.target.files?.length) enviarArquivos(ev.target.dataset.envio, [...ev.target.files]);
});

$('#tocar').addEventListener('click', () => {
  const pausado = previa.alternar();
  $('#icone-tocar').setAttribute('d', pausado ? 'M8 5v14l11-7z' : 'M7 5h3v14H7zM14 5h3v14h-3z');
  $('#tocar').setAttribute('aria-label', pausado ? 'Tocar a prévia' : 'Pausar a prévia');
  if (pausado && som.ativo) som.pararMusica(); else if (!pausado && som.ativo) som.tocarMusica();
});

$('#som').addEventListener('click', () => {
  const ligar = !som.ativo;
  if (ligar) som.ligar(); else som.desligar();
  $('#som').setAttribute('aria-pressed', String(ligar));
  $('#som-rotulo').textContent = ligar ? 'Som ligado' : 'Ouvir música e efeitos';
});

$('#comecar').addEventListener('click', async () => {
  if (falta()) return;
  const botao = $('#comecar');
  botao.disabled = true;
  $('#comecar-rotulo').textContent = 'Enviando…';
  try {
    const r = await fetch('/api/escolhas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saida()) });
    if (!r.ok) throw new Error('resposta ' + r.status);
    som.desligar();
    previa.alternar();
    if (noEscritorio()) $('#fim').querySelector('p').textContent = 'A edição já começou na sala de Edição. O escritório te avisa quando o vídeo estiver pronto pra assistir.';
    $('#fim').hidden = false;
  } catch {
    botao.disabled = false;
    $('#comecar-rotulo').textContent = 'Começar a edição';
    $('#falta').textContent = noEscritorio() ? 'O escritório não respondeu. Confira se ele ainda está aberto e tente de novo.' : 'O Claude Code não respondeu. Confira se ele ainda está aberto e tente de novo.';
  }
});

async function prefiroChat() {
  try { await fetch('/api/prefiro-chat', { method: 'POST' }); } catch {}
  const fim = $('#fim');
  fim.querySelector('h2').textContent = 'Tudo bem';
  fim.querySelector('p').textContent = 'Volte pro Claude Code: ele vai te fazer as perguntas por lá.';
  fim.hidden = false;
}

// ------------------------------------------------------------ início

async function iniciar() {
  try {
    const r = await fetch('/api/contexto', { cache: 'no-store' });
    C = r.ok ? await r.json() : EXEMPLO;
  } catch { C = EXEMPLO; }
  if (!C.videos) C = { ...EXEMPLO, ...C };

  previa = new Previa($('#tela'), {
    som,
    aoMudarCena: desenharTrilhas,
    aoTempo: (t, total) => {
      $('#agulha').style.left = `${(t / total) * 100}%`;
      const f = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}`;
      $('#tempo').textContent = `${f(t)} / ${f(total)}`;
    },
  });

  if (C.formatoFixo && formatoInstalado(C.formatoFixo) && formato(C.formatoFixo)) { E.modo = 'formato'; E.formato = C.formatoFixo; E.formatoTravado = true; }
  // Qualidade de exportação salva nas preferências vem marcada.
  const xp = prefs()?.exportacao;
  if (xp && EXPORTACAO.resolucao.some((o) => o.id === String(xp.resolucao).replace('p', ''))) E.expRes = String(xp.resolucao).replace('p', '');
  if (xp && EXPORTACAO.fps.some((o) => o.id === String(xp.fps))) E.expFps = String(xp.fps);
  cabecalho();
  acertarProporcao();
  renderizar();
}

iniciar();
