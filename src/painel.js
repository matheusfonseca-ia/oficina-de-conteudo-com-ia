import { api } from './api.js';
import { salaDaEtapa, textoDaEspera } from '../lib/ficha.mjs';
import { criarPacotes } from './pacote.js';
import { calcularMovimentos } from './movimentos.js';
import { ETAPAS } from '../lib/ficha.mjs';
import { ORDEM } from './layout.js';
import { iniciarFormularios, abrirCerebro, abrirLeitura, abrirTexto, escolherDestino } from './formularios.js';

const ultimaSala = new Map();
export function aplicarEstado(ESC, estado, pacotes) {
  for (const s of estado.salas) {
    const sala = ESC.salas[s.chave]; if (!sala) continue;
    sala.estado = s.estado;
    const emAndamento = estado.videos.find(v => v.trabalhando && salaDaEtapa(v.etapa) === s.chave);
    sala.tela.desenhar({ titulo: s.nome, linha: emAndamento?.andamento?.mensagem || s.texto, progresso: emAndamento?.andamento ? emAndamento.andamento.progresso : null });
    pacotes.fila(s.chave, Math.max(0, Math.min(4, s.fila - 1)));
  }
  for (const m of calcularMovimentos(ultimaSala, estado.videos, salaDaEtapa, Object.keys(ESC.salas))) pacotes.aoMudar(m.id, m.de, m.para);
  const antena = ESC.salas.postagem?.decor?.getObjectByName('antena');
  if (antena) {
    antena.userData.base = estado.videos.some(v => v.etapa === 'pronto-pra-postar') ? 1.6 : 0.2;
    if (!antena.userData.piscando) antena.material.emissiveIntensity = antena.userData.base;
  }
  // A post went out (Post for Me): the Postagem antenna blinks three times.
  const publicados = estado.videos.filter(v => v.publicacao?.publicadoEm).length;
  if (ultimosPublicados !== null && publicados > ultimosPublicados) piscar(antena);
  ultimosPublicados = publicados;
  // A new cover: the Capa printer pushes its paper up and back.
  const capas = estado.salas.find(s => s.chave === 'capa')?.contador ?? 0;
  if (ultimasCapas !== null && capas > ultimasCapas) imprimir(ESC.salas.capa?.decor?.getObjectByName('papel'));
  ultimasCapas = capas;
  // A new report: the Análise printer pushes its paper up and the chart screen lights up.
  const leituras = estado.salas.find(s => s.chave === 'analise')?.contador ?? 0;
  if (ultimasLeituras !== null && leituras > ultimasLeituras) {
    imprimir(ESC.salas.analise?.decor?.getObjectByName('papel'));
    brilharTela(ESC.salas.analise?.decor?.getObjectByName('tela'));
  }
  ultimasLeituras = leituras;
}
let ultimasCapas = null, ultimasLeituras = null, ultimosPublicados = null;
// The antenna glows three times, then goes back to the glow of the state (aplicarEstado).
function piscar(antena) {
  if (!antena || antena.userData.piscando) return;
  antena.userData.piscando = true;
  const ini = performance.now();
  const passo = agora => {
    const t = (agora - ini) / 1800;
    if (t >= 1) { antena.userData.piscando = false; antena.material.emissiveIntensity = antena.userData.base ?? 0.2; return; }
    antena.material.emissiveIntensity = (t * 3) % 1 < 0.5 ? 2.4 : 0.2;
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
// The chart screen jumps to 1.6 and settles back to 0.4 in 1.2 s.
function brilharTela(tela) {
  if (!tela || tela.userData.brilhando) return;
  tela.userData.brilhando = true;
  const ini = performance.now();
  const passo = agora => {
    const t = Math.min(1, (agora - ini) / 1200);
    tela.material.emissiveIntensity = 1.6 - 1.2 * t;
    if (t < 1) requestAnimationFrame(passo); else tela.userData.brilhando = false;
  };
  tela.material.emissiveIntensity = 1.6;
  requestAnimationFrame(passo);
}
function imprimir(papel) {
  if (!papel || papel.userData.imprimindo) return;
  papel.userData.imprimindo = true;
  const y0 = papel.position.y, ini = performance.now();
  const passo = agora => {
    const t = Math.min(1, (agora - ini) / 800);
    papel.position.y = y0 + 0.6 * Math.sin(Math.PI * t);
    if (t < 1) requestAnimationFrame(passo); else { papel.position.y = y0; papel.userData.imprimindo = false; }
  };
  requestAnimationFrame(passo);
}


const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = s => document.querySelector(s);
const ESPERAS = new Set(['escolha-referencia', 'aprovacao-roteiro', 'aguardando-gravacao', 'escolhas-edicao', 'aprovacao-video', 'aprovacao-pacote', 'pronto-pra-postar']);
const DEPOIS_DA_EXPORTACAO = new Set(['capa', 'postagem', 'aprovacao-pacote', 'pronto-pra-postar', 'publicando', 'agendado', 'aguardando-numeros', 'analise', 'concluido']);
const notificados = new Set();

function trilha(v) {
  const sala = salaDaEtapa(v.etapa);
  // Esperando a gravação: o roteiro está feito e a edição ainda não começou.
  const atual = sala === 'gravacao' ? ORDEM.indexOf('roteiro') + 0.5 : ORDEM.indexOf(sala);
  return '<div class="trilha">' + ORDEM.map((s, i) => {
    const cls = v.pular.includes(s) ? 'pulada' : v.etapa === 'concluido' || i < atual ? 'feita' : i === atual ? 'aqui' : '';
    return `<i class="${cls}" title="${s}"></i>`;
  }).join('') + '</div>';
}
function horaTexto(iso) { return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

// ---- Publicar pelo Post for Me: onde postar, quando, agendado, números ----
// Same names as lib/publicar.mjs (that file imports node:fs, so the page cannot bundle it).
const NOMES_REDE = { instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', x: 'X', linkedin: 'LinkedIn', tiktok: 'TikTok', tiktok_business: 'TikTok', youtube: 'YouTube', pinterest: 'Pinterest', bluesky: 'Bluesky' };
const AVISOS_REDE = {
  instagram: 'Pela API o Reels sai sem música, e sem música ele quase não entra na aba de Reels.',
  tiktok: 'Chega como rascunho no app do TikTok: você escolhe a música e publica de lá.',
};
AVISOS_REDE.tiktok_business = AVISOS_REDE.tiktok;
const rotuloConta = c => [NOMES_REDE[c.plataforma] || String(c.plataforma ?? ''), c.usuario].filter(Boolean).join(' · ');
// Only http(s) links go into an href (already escaped for the double-quoted attribute).
const urlSegura = u => (typeof u === 'string' && /^https?:\/\//i.test(u) ? esc(u) : null);
const linkDaConta = (c, texto) => { const u = urlSegura(c.link); return u ? `<a href="${u}" target="_blank" rel="noopener">${esc(texto)}</a>` : esc(texto); };
// ISO → "AAAA-MM-DDTHH:mm" in the hour of the computer, for <input type="datetime-local">
function paraCampo(iso) {
  const d = new Date(iso); if (!iso || isNaN(d)) return '';
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
const temFalha = v => ['agendado', 'aguardando-numeros'].includes(v.etapa) && Object.values(v.publicacao?.contas || {}).some(c => c.status === 'falhou');
const esperandoVoce = v => (ESPERAS.has(v.etapa) && !v.trabalhando) || temFalha(v);

// Per ficha, in the page only: the student accounts (loaded once per card) and what is ticked / picked.
const contasPFM = new Map(); // id → { carregando } | { contas, redes } | { erro }
const escolhas = new Map(); // id → { marcadas: Set|null (null = the networks ticked last time), quando: 'agora'|'agendar', horario, editado }
const escolhaDe = id => { let e = escolhas.get(id); if (!e) { e = { marcadas: null, quando: 'agora', horario: '', editado: false }; escolhas.set(id, e); } return e; };
const marcadasDe = (id, info) => escolhaDe(id).marcadas || new Set((info?.redes || []).filter(r => (info.contas || []).some(c => c.id === r)));
function carregarContas(id) {
  contasPFM.set(id, { carregando: true });
  api.get('/api/postforme/contas')
    .then(r => contasPFM.set(id, { contas: r.contas || [], redes: r.redes || [] }))
    .catch(err => contasPFM.set(id, { erro: err.message }))
    .finally(() => { if (window.ESC.ultimoEstado) renderLista(window.ESC.ultimoEstado); });
}

// "Onde postar" + "Quando" on the post approval. Ticks and the date are painted after the render (pintarPublicar),
// so toggling them never changes the HTML that the list compares.
function blocoPublicar(v) {
  const info = contasPFM.get(v.id);
  const titulo = '<div class="titulo-bloco">Onde postar</div>';
  if (!info || info.carregando) return `<div class="publicar">${titulo}<div class="etapa">Carregando suas redes…</div></div>`;
  if (info.erro) return `<div class="publicar">${titulo}<div class="erro">${esc(info.erro)}</div></div>`;
  if (!info.contas.length) return `<div class="publicar">${titulo}<div class="etapa">O Post for Me ainda não tem nenhuma rede conectada. Conecte as suas em <a href="https://app.postforme.dev" target="_blank" rel="noopener">app.postforme.dev</a> ou poste na mão.</div></div>`;
  const redes = info.contas.map(c => `<label class="rede"><input type="checkbox" data-conta="${esc(c.id)}"><span>${esc(rotuloConta(c))}</span></label>`
    + (AVISOS_REDE[c.plataforma] ? `<div class="aviso-rede">${esc(AVISOS_REDE[c.plataforma])}</div>` : '')).join('');
  const nome = `quando-${esc(v.id)}`;
  return `<div class="publicar">${titulo}${redes}<div class="titulo-bloco">Quando</div>
    <div class="quando"><label><input type="radio" name="${nome}" data-quando="agora">Publicar agora</label><label><input type="radio" name="${nome}" data-quando="agendar">Agendar</label></div>
    <input type="datetime-local" data-campo="quando" aria-label="Dia e hora da publicação" hidden></div>`;
}
function pintarPublicar(el, v) {
  const bloco = el.querySelector('.publicar'); if (!bloco) return;
  const e = escolhaDe(v.id), marcadas = marcadasDe(v.id, contasPFM.get(v.id));
  for (const cx of bloco.querySelectorAll('input[data-conta]')) cx.checked = marcadas.has(cx.dataset.conta);
  for (const r of bloco.querySelectorAll('input[data-quando]')) { r.checked = r.dataset.quando === e.quando; r.closest('label').classList.toggle('marcada', r.checked); }
  const campo = bloco.querySelector('input[data-campo="quando"]');
  if (campo) {
    campo.hidden = e.quando !== 'agendar';
    if (document.activeElement !== campo) campo.value = e.editado ? e.horario : paraCampo(v.postagem?.horario);
  }
  const btn = el.querySelector('button[data-acao="publicar"]'); if (btn) btn.textContent = e.quando === 'agendar' ? 'Agendar' : 'Publicar';
}

// One line per network of a publication: where it went, the link when it is live, the error and the way out when it failed.
function redesDaPublicacao(v) {
  const itens = Object.entries(v.publicacao?.contas || {}).map(([id, c]) => {
    const nome = rotuloConta(c);
    if (c.status === 'publicado') return `<li>${linkDaConta(c, nome)} · no ar</li>`;
    if (c.status === 'manual') return `<li>${esc(nome)} · você postou na mão</li>`;
    if (c.status === 'falhou') return `<li>${esc(nome)} · não deu certo<div class="erro">${esc(c.erro || 'O Post for Me não conseguiu postar.')}</div>
      <div class="acoes"><button data-acao="tentar-rede" data-conta="${esc(id)}">Tentar de novo</button><button data-acao="postar-na-mao" data-conta="${esc(id)}">Postar na mão</button></div></li>`;
    return `<li>${esc(nome)} · esperando sair</li>`;
  });
  return itens.length ? `<ul class="redes-agendadas">${itens.join('')}</ul>` : '';
}
function agendado(v) {
  const p = v.publicacao; if (!p) return '';
  const quando = p.pedido?.quando && new Date(p.pedido.quando) > new Date() ? `Agendado pra ${horaTexto(p.pedido.quando)}` : 'Publicando agora…';
  const saiu = Object.values(p.contas || {}).some(c => c.status === 'publicado');
  return `<div class="etapa"><b>${esc(quando)}</b></div>${redesDaPublicacao(v)}`
    + (saiu ? '' : '<div class="acoes"><button data-acao="cancelar-agendamento">Cancelar agendamento</button></div>');
}
// Links of the posts that are live (a post made by hand has none).
function linksDosPosts(v) {
  const links = Object.values(v.publicacao?.contas || {}).filter(c => c.status === 'publicado' && urlSegura(c.link)).map(c => linkDaConta(c, rotuloConta(c)));
  return links.length ? `<div class="links-posts">${links.join(' · ')}</div>` : '';
}

const NUMEROS = [['visualizacoes', 'visualizações'], ['curtidas', 'curtidas'], ['comentarios', 'comentários'], ['compartilhamentos', 'compartilhamentos'], ['salvamentos', 'salvamentos']];
const MARCOS = { '48h': '48 horas', '7d': '7 dias' };
const itensDe = (rotulo, itens) => (Array.isArray(itens) && itens.length ? `<div class="rotulo">${rotulo}</div><ul>${itens.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
function leituraHtml(l) {
  const titulo = `<h4>${esc(MARCOS[l.marco] || l.marco)}</h4>`;
  if (l.naoAchou) return `<div class="leitura-numeros">${titulo}<div>${esc(l.resumo)}</div></div>`;
  const total = l.numeros?.total || {};
  const numeros = NUMEROS.filter(([k]) => total[k] !== null && total[k] !== undefined).map(([k, r]) => `${Number(total[k]).toLocaleString('pt-BR')} ${r}`).join(' · ');
  const nota = Math.min(5, Math.max(0, Math.round(Number(l.nota)) || 0));
  return `<div class="leitura-numeros">${titulo}${numeros ? `<div class="numeros">${esc(numeros)}</div>` : ''}${l.resumo ? `<div>${esc(l.resumo)}</div>` : ''}`
    + (nota ? `<div class="estrelas" role="img" aria-label="Nota ${nota} de 5">${'★'.repeat(nota)}${'☆'.repeat(5 - nota)}</div>` : '')
    + itensDe('Funcionou', l.funcionou) + itensDe('Melhorar', l.melhorar) + '</div>';
}
const leiturasHtml = v => (v.analise?.leituras || []).map(leituraHtml).join('');

// Weekly summary: a fixed card on top until the student opens it (the week is remembered, with a fallback when the browser blocks storage).
const CHAVE_RESUMO = 'ofc-resumo-aberto';
let resumoVisto = (() => { try { return localStorage.getItem(CHAVE_RESUMO) || ''; } catch { return ''; } })();
function cartaoResumo(semana) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(semana || ''), dia = m ? `${m[3]}/${m[2]}` : semana;
  return `<div class="ficha"><h3>Resumo da semana</h3><div class="etapa">A Análise escreveu o resumo da semana de ${esc(dia)}.</div><div class="acoes"><button class="forte" data-acao="abrir-resumo">Abrir</button></div></div>`;
}
async function abrirResumo(btn) {
  btn.disabled = true;
  try {
    const r = await api.get('/api/resumos/ultimo');
    abrirTexto('Resumo da semana', r.texto, { compacto: true });
    resumoVisto = r.semana; try { localStorage.setItem(CHAVE_RESUMO, r.semana); } catch {}
    if (window.ESC.ultimoEstado) renderLista(window.ESC.ultimoEstado); // the card goes away now
  } catch (e) { alert(e.message); }
  finally { btn.disabled = false; }
}

const roteiroCurto = r => `${r.titulo}\n\nGancho: ${r.gancho}\n\n${r.desenvolvimento.map((b, i) => `${i + 1}. ${b}`).join('\n')}${r.cta ? `\n\nChamada: ${r.cta}` : ''}`;
function referencias(v) {
  const itens = (v.pesquisa?.referencias || []).map((r, i) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.titulo)}</a>${r.criador ? ` <span class="etapa">${esc(r.criador)}</span>` : ''}
    <div class="etapa">${esc(r.porQueFuncionou)}</div><button data-acao="referencia" data-indice="${i}">Usar esta</button></li>`).join('');
  return `<ol class="refs">${itens}</ol><textarea data-campo="revisao" placeholder="Quer outras? Ex.: mais vídeos de humor, só em português"></textarea>
    <div class="acoes"><button data-acao="revisar">Buscar outras</button><button data-acao="sem-referencia">Seguir sem referência</button></div>`;
}

const urlCapa = (v, o) => `/api/videos/${encodeURIComponent(v.id)}/capa/${encodeURIComponent(o.arquivo.split('/').pop())}?v=${v.atualizadaEm}`;
// The covers side by side on the post approval: click one to choose it.
function capas(v) {
  const c = v.capa; if (!c) return '';
  const lista = (c.opcoes || []).map((o, i) => `<button data-acao="escolher-capa" data-indice="${i}" class="${i === c.escolhida ? 'escolhida' : ''}" title="${esc(o.titulo)}">
    <img src="${urlCapa(v, o)}" alt="${esc(o.titulo)}">${i === c.escolhida ? '<span class="selo">Escolhida</span>' : ''}${o.origem === 'higgsfield' ? '<span class="selo ia">IA</span>' : ''}</button>`).join('');
  return (lista ? `<div class="capas">${lista}</div>` : '') + (c.aviso ? `<div class="aviso-capa">${esc(c.aviso)}</div>` : '');
}
function baixarCapa(v) {
  const o = v.capa?.opcoes?.[v.capa.escolhida];
  return o ? `<a class="botao" download href="${urlCapa(v, o)}">Baixar capa</a>` : '';
}

function cartao(v, pfm = false) {
  let corpo = `<h3>${esc(v.tema || v.id)}</h3>${trilha(v)}<div class="etapa">${esc(v.andamento?.mensagem || textoDaEspera(v))}</div>`;
  if (v.andamento) corpo += `<div class="barra"><b style="width:${Math.round(v.andamento.progresso * 100)}%"></b></div>`;
  // Depois da exportação o MP4 existe: "Baixar vídeo" fica sempre à mão, com ou sem postagem.
  const baixar = DEPOIS_DA_EXPORTACAO.has(v.etapa) ? `<a class="botao" download href="/api/videos/${encodeURIComponent(v.id)}/final.mp4">Baixar vídeo</a>` : '';
  const copiar = v.postagem ? '<button data-acao="copiar">Copiar legenda</button>' : '';
  const comAcoesProprias = !v.erro && !v.trabalhando && (v.etapa === 'aprovacao-pacote' || v.etapa === 'pronto-pra-postar');
  if (v.erro) corpo += `<div class="erro">${esc(v.erro.mensagem)}</div><div class="acoes"><button data-acao="tentar">Tentar de novo</button>${v.erro.sala === 'pesquisa' ? '<button data-acao="pular-pesquisa">Seguir sem pesquisa</button>' : ''}${baixar}</div>`;
  else if (baixar && !comAcoesProprias) corpo += `<div class="acoes">${baixar}</div>`;
  if (!v.erro && !v.trabalhando) {
    if (v.etapa === 'escolha-referencia') corpo += referencias(v);
    if (v.etapa === 'aprovacao-roteiro' && v.roteiro) corpo += `<div class="legenda">${esc(roteiroCurto(v.roteiro))}</div>${v.referencia ? `<div class="etapa">Inspirado em: ${esc(v.referencia.titulo)}</div>` : ''}
      <textarea data-campo="revisao" placeholder="O que mudar no roteiro? Ex.: gancho mais forte, mais curto"></textarea>
      <div class="acoes"><button data-acao="ler">Ler em tela cheia</button><button data-acao="revisar">Pedir ajuste</button><button class="forte" data-acao="aprovar">Aprovar roteiro</button></div>`;
    if (v.etapa === 'aguardando-gravacao') corpo += `<div class="etapa">Grave o vídeo e mande o arquivo aqui.</div>
      <div class="acoes">${v.roteiro ? '<button data-acao="ler">Ler pra gravar</button>' : ''}<label class="botao forte">Enviar gravação<input type="file" accept="video/*" data-acao="enviar-bruto" hidden></label></div>`;
    if (v.etapa === 'escolhas-edicao') corpo += `<div class="acoes"><button class="forte" data-acao="painel">Escolher formato e estilo</button></div>`;
    if (v.etapa === 'aprovacao-video') corpo += `<textarea data-campo="revisao" placeholder="O que mudar? Ex.: legenda maior, tira a música"></textarea>
      <div class="acoes"><button data-acao="studio">Assistir no Studio</button><button data-acao="revisar">Pedir ajuste</button><button class="forte" data-acao="aprovar">Aprovar e exportar</button></div>`;
    if (v.etapa === 'aprovacao-pacote' || v.etapa === 'pronto-pra-postar') {
      const p = v.postagem;
      if (p) corpo += `<div class="legenda">${esc(p.legenda)}\n\n${esc((p.hashtags || []).join(' '))}</div><div class="etapa">Sugestão: ${esc(horaTexto(p.horario))}${p.motivoHorario ? ' · ' + esc(p.motivoHorario) : ''}</div>`;
    }
    if (v.etapa === 'aprovacao-pacote') {
      // Com o Post for Me: Publicar / Agendar (as redes e o horário vêm do bloco) e, ao lado, Postar na mão (aprova sem publicar).
      // Sem ele: Aprovar, como sempre, e o atalho pra conectar.
      const info = contasPFM.get(v.id);
      const decisao = !pfm ? '<button class="forte" data-acao="aprovar">Aprovar</button>'
        : info?.contas?.length ? '<button class="forte" data-acao="publicar">Publicar</button><button data-acao="aprovar">Postar na mão</button>'
        : !info || info.carregando ? '<button class="forte" data-acao="publicar" disabled>Publicar</button><button data-acao="aprovar">Postar na mão</button>'
        : '<button class="forte" data-acao="aprovar">Postar na mão</button>';
      corpo += `${capas(v)}${v.publicacao?.erro ? `<div class="erro">${esc(v.publicacao.erro)}</div>` : ''}${pfm ? blocoPublicar(v) : ''}<textarea data-campo="revisao" placeholder="O que mudar na legenda ou na capa?"></textarea>
      <div class="acoes">${baixar}${copiar}<button data-acao="revisar">Pedir ajuste</button>${v.pular.includes('capa') ? '' : '<button data-acao="refazer-capa">Refazer capa</button>'}${decisao}</div>`
        + (pfm ? '' : '<button class="link" data-acao="conectar-pfm">Conectar Post for Me pra publicar daqui</button>');
    }
    if (v.etapa === 'agendado') corpo += agendado(v);
    if (v.etapa === 'aguardando-numeros') corpo += redesDaPublicacao(v) + leiturasHtml(v);
    if (v.etapa === 'concluido') corpo += linksDosPosts(v) + leiturasHtml(v);
    if (v.etapa === 'pronto-pra-postar') {
      const hora = v.postagem && new Date(v.postagem.horario) <= new Date();
      corpo += `${hora ? '<div class="erro" style="color:#A06A00">Hora de postar!</div>' : ''}<div class="acoes">${baixar}${baixarCapa(v)}${copiar}<button class="forte" data-acao="postado">Já postei</button></div>`;
    }
  }
  if (v.etapa !== 'concluido' && ORDEM.indexOf(salaDaEtapa(v.etapa)) < ORDEM.indexOf('postagem') && !v.pular.includes('postagem'))
    corpo += `<div class="acoes"><button data-acao="pular-postagem">Pular postagem (eu mesmo posto)</button></div>`;
  return `<div class="ficha${esperandoVoce(v) ? ' espera' : ''}" data-id="${esc(v.id)}">${corpo}</div>`;
}

const rascunhos = new Map();
let ultimoHtml = null, concluidosAberto = false;
function renderLista(e) {
  for (const v of e.videos) if (v.etapa === 'pronto-pra-postar' && v.postagem && new Date(v.postagem.horario) <= new Date() && !notificados.has(v.id)) {
    notificados.add(v.id); if (window.Notification?.permission === 'granted') new Notification('Hora de postar', { body: v.tema || v.id });
  }
  // Post for Me: as contas de cada cartão de aprovação carregam uma vez (e de novo se o cartão voltar pra essa etapa).
  const pfm = !!e.conexoes?.postForMe;
  for (const id of [...contasPFM.keys()]) if (!pfm || e.videos.find(x => x.id === id)?.etapa !== 'aprovacao-pacote') contasPFM.delete(id);
  if (pfm) for (const v of e.videos) if (v.etapa === 'aprovacao-pacote' && !v.erro && !v.trabalhando && !contasPFM.has(v.id)) carregarContas(v.id);
  const espera = e.videos.filter(v => esperandoVoce(v) || v.erro);
  const fim = e.videos.filter(v => v.etapa === 'concluido');
  const acompanhando = e.videos.filter(v => !espera.includes(v) && ['agendado', 'aguardando-numeros'].includes(v.etapa));
  const resto = e.videos.filter(v => !espera.includes(v) && !fim.includes(v) && !acompanhando.includes(v));
  const cartaoDe = v => cartao(v, pfm);
  const html = (e.resumo && e.resumo !== resumoVisto ? cartaoResumo(e.resumo) : '')
    + (espera.length ? '<div class="grupo">Esperando você</div>' + espera.map(cartaoDe).join('') : '')
    + (resto.length ? '<div class="grupo">Trabalhando</div>' + resto.map(cartaoDe).join('') : '')
    + (acompanhando.length ? '<div class="grupo">Acompanhando</div>' + acompanhando.map(cartaoDe).join('') : '')
    + (fim.length ? `<details${concluidosAberto ? ' open' : ''}><summary class="grupo">Concluídos (${fim.length})</summary>${fim.map(cartaoDe).join('')}</details>` : '')
    + (!e.videos.length ? '<p class="etapa">Nenhum vídeo ainda. Clique em <b>Já gravei</b> ou solte o arquivo bruto em qualquer lugar da tela.</p>' : '');
  if (html === ultimoHtml) return;
  const lista = $('#lista'), foco = document.activeElement, focoId = foco?.closest?.('.ficha')?.dataset.id, pos = lista.scrollTop;
  // Quem está escolhendo o horário não perde o campo no meio: a lista espera o campo largar o foco.
  if (foco?.matches?.('input[type="datetime-local"]') && lista.contains(foco)) return;
  const emTexto = foco?.tagName === 'TEXTAREA' && lista.contains(foco);
  const cursor = emTexto ? [foco.selectionStart, foco.selectionEnd, foco.selectionDirection, foco.scrollTop] : null;
  const emOpcao = focoId && foco?.matches?.('.publicar input') ? (foco.dataset.conta ? `input[data-conta="${CSS.escape(foco.dataset.conta)}"]` : `input[data-quando="${CSS.escape(foco.dataset.quando)}"]`) : null;
  ultimoHtml = html; lista.innerHTML = html;
  for (const t of lista.querySelectorAll('textarea[data-campo]')) { const r = rascunhos.get(t.closest('.ficha').dataset.id); if (r) t.value = r; }
  for (const el of lista.querySelectorAll('.ficha[data-id]')) { const v = e.videos.find(x => x.id === el.dataset.id); if (v) pintarPublicar(el, v); }
  if (focoId && emTexto) {
    // O repinte troca o elemento: devolve o foco e o cursor (ou a seleção) pro mesmo lugar do texto.
    const t = lista.querySelector(`.ficha[data-id="${CSS.escape(focoId)}"] textarea`);
    if (t) { t.focus(); t.setSelectionRange(cursor[0], cursor[1], cursor[2] || 'none'); t.scrollTop = cursor[3]; }
  }
  if (emOpcao) lista.querySelector(`.ficha[data-id="${CSS.escape(focoId)}"] .publicar ${emOpcao}`)?.focus();
  lista.scrollTop = pos;
}

// A aba abre já no clique (senão o navegador bloqueia o pop-up, porque reabrir o Studio demora),
// mostra "Abrindo o Studio…" e só depois vai pro endereço. Sem 'noopener' aqui: com ele window.open devolve null.
async function abrirStudio(btn, base) {
  const aba = window.open('about:blank', '_blank');
  if (aba) {
    aba.opener = null;
    try { aba.document.title = 'Abrindo o Studio…'; aba.document.body.innerHTML = '<p style="font:16px system-ui,sans-serif;padding:24px">Abrindo o Studio…</p>'; } catch {}
  }
  const texto = btn.textContent; btn.textContent = 'Abrindo o Studio…';
  try {
    const { url } = await api.post(base + '/studio');
    if (aba && !aba.closed) aba.location = url; else window.open(url, '_blank', 'noopener');
  } catch (e) { aba?.close(); throw e; }
  finally { btn.textContent = texto; }
}

async function agir(btn) {
  const ficha = btn.closest('.ficha'), id = ficha.dataset.id, base = `/api/videos/${encodeURIComponent(id)}`;
  const v = window.ESC.ultimoEstado.videos.find(x => x.id === id);
  const acao = btn.dataset.acao; btn.disabled = true;
  try {
    if (acao === 'painel') { const { url } = await api.post(base + '/painel'); abrirModal(url, id); }
    else if (acao === 'studio') await abrirStudio(btn, base);
    else if (acao === 'revisar') { const texto = ficha.querySelector('[data-campo="revisao"]').value.trim(); if (!texto) throw new Error('Escreva o que mudar.'); await api.post(base + '/evento', { tipo: 'revisar', texto }); }
    else if (acao === 'refazer-capa') { const texto = ficha.querySelector('[data-campo="revisao"]').value.trim(); if (!texto) throw new Error('Escreva o que mudar na capa.'); await api.post(base + '/evento', { tipo: 'revisar', sala: 'capa', texto }); }
    else if (acao === 'escolher-capa') await api.post(base + '/evento', { tipo: 'escolheu-capa', indice: Number(btn.dataset.indice) });
    else if (acao === 'aprovar') await api.post(base + '/evento', { tipo: 'aprovou' });
    else if (acao === 'publicar') {
      // As redes marcadas e o horário (ou "agora") vão no mesmo "aprovou".
      const marcadas = [...ficha.querySelectorAll('.publicar input[data-conta]:checked')].map(i => i.dataset.conta);
      const contas = (contasPFM.get(id)?.contas || []).filter(c => marcadas.includes(c.id)).map(c => ({ id: c.id, plataforma: c.plataforma, usuario: c.usuario }));
      if (!contas.length) throw new Error('Marque pelo menos uma rede.');
      let quando = null;
      if (escolhaDe(id).quando === 'agendar') {
        const ms = new Date(ficha.querySelector('.publicar input[data-campo="quando"]').value).getTime();
        if (!Number.isFinite(ms)) throw new Error('Escolha o dia e a hora.');
        if (ms <= Date.now() + 60_000) throw new Error('Escolha um horário daqui pra frente.');
        quando = new Date(ms).toISOString();
      }
      await api.post(base + '/evento', { tipo: 'aprovou', publicar: { contas, quando } });
    }
    else if (acao === 'cancelar-agendamento') { if (confirm('Cancelar este agendamento?')) await api.post(base + '/cancelar'); }
    else if (acao === 'tentar-rede') await api.post(base + '/evento', { tipo: 'republicar', conta: btn.dataset.conta });
    else if (acao === 'postar-na-mao') await api.post(base + '/evento', { tipo: 'postar-na-mao', conta: btn.dataset.conta });
    else if (acao === 'conectar-pfm') dispatchEvent(new CustomEvent('abrir-chefe', { detail: { aba: 'conexoes', servico: 'postForMe' } }));
    else if (acao === 'postado') await api.post(base + '/evento', { tipo: 'postado' });
    else if (acao === 'tentar') await api.post(base + '/evento', { tipo: 'tentar-de-novo' });
    else if (acao === 'pular-postagem') await api.post(base + '/evento', { tipo: 'pular', sala: 'postagem' });
    else if (acao === 'referencia') await api.post(base + '/evento', { tipo: 'escolheu-referencia', indice: Number(btn.dataset.indice) });
    else if (acao === 'sem-referencia') await api.post(base + '/evento', { tipo: 'escolheu-referencia', indice: null });
    else if (acao === 'pular-pesquisa') await api.post(base + '/evento', { tipo: 'pular', sala: 'pesquisa' });
    else if (acao === 'ler') abrirLeitura(v.roteiro);
    else if (acao === 'copiar') { await navigator.clipboard.writeText(`${v.postagem?.legenda ?? ""}\n\n${(v.postagem?.hashtags || []).join(' ')}`); btn.textContent = 'Copiada!'; }
    if (acao === 'revisar' || acao === 'refazer-capa' || acao === 'aprovar' || acao === 'publicar' || acao === 'referencia' || acao === 'sem-referencia') rascunhos.delete(id);
    if (acao === 'aprovar' && window.Notification?.permission === 'default') Notification.requestPermission();
  } catch (e) { alert(e.message); }
  finally { btn.disabled = false; document.activeElement?.blur(); }
}

let modalId = null;
function abrirModal(url, id) { modalId = id; $('#modal iframe').src = url; $('#modal-aba').href = url; $('#modal').classList.add('aberto'); }
function fecharModal() { modalId = null; $('#modal').classList.remove('aberto'); $('#modal iframe').src = 'about:blank'; }

// Room cards: the Oficina's compact department badge (main.js places them, the same way as there).
function criarPlacas(ESC) {
  for (const el of Object.values(ESC.placas))
    el.addEventListener('click', ev => {
      if (ev.target.dataset.acao === 'checar') api.post('/api/checagem').catch(e => alert(e.message));
      if (ev.target.dataset.acao === 'conectar') { ev.stopPropagation(); dispatchEvent(new CustomEvent('abrir-chefe', { detail: { aba: 'conexoes', servico: ev.target.dataset.servico } })); }
    });
  return e => {
    for (const s of e.salas) {
      const el = ESC.placas[s.chave]; if (!el) continue;
      el.dataset.estado = s.estado;
      const esperando = s.estado === 'esperando' || s.estado === 'problema';
      el.innerHTML = `<div class="b-heading"><div class="b-name"><span class="dot" style="background:${esc(el.style.getPropertyValue('--sw'))}"></span><span class="b-title">${esc(s.nome)}</span></div>`
        + (esperando ? `<span class="b-appr" title="${s.estado === 'problema' ? 'Precisa de você' : 'Esperando você'}">⚠</span>` : '') + '</div>'
        + (s.ativa ? `<div class="b-count"><span class="b-num">${s.fila}</span><span class="b-lab">${s.fila === 1 ? 'vídeo na sala' : 'vídeos na sala'}</span></div>` : '')
        + `<div class="b-metrics"><div class="m-row"><span class="m-lab b-status">${esc(s.texto)}</span></div>`
        + (s.ativa ? `<div class="m-row"><span class="m-lab">${esc(s.rotuloContador)}</span><span class="m-val">${s.contador}</span></div>` : '') + '</div>'
        + (s.chave === 'edicao' && !e.checagem.ok ? '<button data-acao="checar">Conferir de novo</button>' : '')
        + (s.chave === 'capa' ? placaDaCapa(e) : '') + (s.chave === 'postagem' || s.chave === 'analise' ? placaDoPostForMe(e, s.chave) : '');
    }
  };
}

// Capa card: the last cover's warning, and a shortcut to connect the Higgsfield.
function placaDaCapa(e) {
  const ultima = [...e.videos].filter(v => v.capa).sort((a, b) => b.atualizadaEm - a.atualizadaEm)[0];
  const aviso = ultima?.capa?.aviso ? `<div class="aviso-capa">${esc(ultima.capa.aviso)}</div>` : '';
  return aviso + (e.conexoes && !e.conexoes.higgsfield ? '<button data-acao="conectar" data-servico="higgsfield">Conectar Higgsfield</button>' : '');
}
// Postagem and Análise cards: without Post for Me there is no publishing and no numbers; a refused key asks to reconnect.
function placaDoPostForMe(e, sala) {
  if (!e.conexoes) return '';
  const botao = '<button data-acao="conectar" data-servico="postForMe">Conectar Post for Me</button>';
  if (!e.conexoes.postForMe) return (sala === 'analise' ? '<div class="aviso-capa">Conecte o Post for Me pra Análise ler os números dos seus posts</div>' : '') + botao;
  return e.avisos?.postForMe === 'reconectar' ? '<div class="aviso-capa">Reconecte o Post for Me</div>' + botao : '';
}

async function comAviso(nome, fn) {
  const el = $('#envio'); el.textContent = `Enviando ${nome}…`; el.hidden = false;
  try { return await fn(); } finally { el.hidden = true; }
}
// Um arquivo e roteiros esperando gravação: pergunta de qual vídeo é. Vários arquivos viram vídeos novos.
async function enviarArquivos(arquivos) {
  const lista = [...arquivos];
  const esperando = (window.ESC.ultimoEstado?.videos || []).filter(v => v.etapa === 'aguardando-gravacao' && !v.trabalhando && !v.erro);
  let destino = null;
  if (lista.length === 1 && esperando.length) { destino = await escolherDestino(lista[0], esperando); if (destino === undefined) return; }
  for (const f of lista) {
    try { await comAviso(f.name, () => destino ? api.uploadBruto(destino, f) : api.upload(f)); } catch (err) { alert(err.message); }
  }
}
let cerebroOferecido = false;

export function iniciarPainel(ESC) {
  const pacotes = criarPacotes(ESC); ESC.aoTick(pacotes.tick);
  const placas = criarPlacas(ESC);
  iniciarFormularios();
  $('#lista').addEventListener('click', e => { const b = e.target.closest('button[data-acao]'); if (!b) return; if (b.dataset.acao === 'abrir-resumo') abrirResumo(b); else agir(b); });
  // Redes marcadas, "agora" ou "agendar" e o horário: ficam na página e são repintados, sem mexer no HTML da lista.
  const mudouPublicar = e => {
    const campo = e.target.closest?.('.publicar input'); if (!campo) return;
    const el = campo.closest('.ficha'), v = window.ESC.ultimoEstado?.videos.find(x => x.id === el.dataset.id); if (!v) return;
    const escolha = escolhaDe(v.id);
    if (campo.dataset.conta) escolha.marcadas = new Set([...el.querySelectorAll('.publicar input[data-conta]:checked')].map(i => i.dataset.conta));
    else if (campo.dataset.quando) escolha.quando = campo.dataset.quando;
    else if (campo.dataset.campo === 'quando') { escolha.horario = campo.value; escolha.editado = true; }
    pintarPublicar(el, v);
  };
  $('#lista').addEventListener('change', mudouPublicar);
  $('#lista').addEventListener('input', mudouPublicar);
  $('#ja-gravei').addEventListener('click', () => $('#arquivo').click());
  $('#arquivo').addEventListener('change', async e => { const arqs = [...e.target.files]; e.target.value = ''; if (arqs.length) await enviarArquivos(arqs); });
  $('#lista').addEventListener('change', async e => {
    const input = e.target.closest('input[data-acao="enviar-bruto"]'); if (!input) return;
    const f = input.files[0], id = input.closest('.ficha').dataset.id; input.value = '';
    if (f) try { await comAviso(f.name, () => api.uploadBruto(id, f)); } catch (err) { alert(err.message); }
  });
  const arquivos = e => [...(e.dataTransfer?.types || [])].includes('Files');
  $('#lista').addEventListener('input', e => { const t = e.target.closest('textarea[data-campo]'); if (t) rascunhos.set(t.closest('.ficha').dataset.id, t.value); });
  $('#lista').addEventListener('toggle', e => { if (e.target.tagName === 'DETAILS') concluidosAberto = e.target.open; }, true);
  addEventListener('dragover', e => { if (!arquivos(e)) return; e.preventDefault(); document.body.classList.add('soltando'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('soltando'); });
  addEventListener('drop', async e => { if (!arquivos(e)) return; e.preventDefault(); document.body.classList.remove('soltando'); await enviarArquivos(e.dataTransfer.files); });
  $('#modal-fechar').addEventListener('click', fecharModal);
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) { document.body.classList.toggle('limpo'); ESC.enquadrar(); } });
  ESC.aoClicarSala(k => { const v = ESC.ultimoEstado?.videos.find(x => salaDaEtapa(x.etapa) === k); if (v) document.querySelector(`.ficha[data-id="${CSS.escape(v.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  // Duas leituras seguidas sem resposta: o servidor caiu (quase sempre porque o Claude Code foi fechado).
  let falhas = 0;
  const ciclo = async () => {
    let e = null;
    try { e = await api.estado(); falhas = 0; } catch (err) { falhas++; console.warn('estado:', err.message); }
    $('#fechado').hidden = falhas < 2;
    if (e) try {
      ESC.ultimoEstado = e;
      aplicarEstado(ESC, e, pacotes); ESC.aoEstado?.(e); placas(e); renderLista(e);
      if (e.cerebro && !e.cerebro.preenchido && !cerebroOferecido) { cerebroOferecido = true; abrirCerebro().catch(err => console.warn('cérebro:', err.message)); }
      if (modalId && e.videos.find(v => v.id === modalId)?.etapa !== 'escolhas-edicao') fecharModal();
    } catch (err) { console.warn('estado:', err.message); }
    setTimeout(ciclo, 1500);
  };
  ciclo();
}
