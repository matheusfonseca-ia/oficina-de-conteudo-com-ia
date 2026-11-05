import { api } from './api.js';
import { salaDaEtapa } from '../lib/ficha.mjs';
import { criarPacotes } from './pacote.js';
import { calcularMovimentos } from './movimentos.js';
import { ETAPAS } from '../lib/ficha.mjs';
import { ORDEM, LAYOUT } from './layout.js';
import * as THREE from 'three';

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
  if (antena) antena.material.emissiveIntensity = estado.videos.some(v => v.etapa === 'pronto-pra-postar') ? 1.6 : 0.2;
}


const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = s => document.querySelector(s);
const ESPERAS = new Set(['escolhas-edicao', 'aprovacao-video', 'aprovacao-pacote', 'pronto-pra-postar']);
const notificados = new Set();

function trilha(v) {
  const atual = ORDEM.indexOf(salaDaEtapa(v.etapa));
  return '<div class="trilha">' + ORDEM.map((s, i) => {
    const cls = v.pular.includes(s) ? 'pulada' : v.etapa === 'concluido' || i < atual ? 'feita' : i === atual ? 'aqui' : '';
    return `<i class="${cls}" title="${s}"></i>`;
  }).join('') + '</div>';
}
function horaTexto(iso) { return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

function cartao(v) {
  const meta = ETAPAS[v.etapa];
  let corpo = `<h3>${esc(v.tema || v.id)}</h3>${trilha(v)}<div class="etapa">${esc(v.andamento?.mensagem || meta.texto)}</div>`;
  if (v.andamento) corpo += `<div class="barra"><b style="width:${Math.round(v.andamento.progresso * 100)}%"></b></div>`;
  if (v.erro) corpo += `<div class="erro">${esc(v.erro.mensagem)}</div><div class="acoes"><button data-acao="tentar">Tentar de novo</button></div>`;
  else if (!v.trabalhando) {
    if (v.etapa === 'escolhas-edicao') corpo += `<div class="acoes"><button class="forte" data-acao="painel">Escolher formato e estilo</button></div>`;
    if (v.etapa === 'aprovacao-video') corpo += `<textarea data-campo="revisao" placeholder="O que mudar? Ex.: legenda maior, tira a música"></textarea>
      <div class="acoes"><button data-acao="studio">Assistir no Studio</button><button data-acao="revisar">Pedir ajuste</button><button class="forte" data-acao="aprovar">Aprovar e exportar</button></div>`;
    if (v.etapa === 'aprovacao-pacote' || v.etapa === 'pronto-pra-postar') {
      const p = v.postagem;
      corpo += `<div class="legenda">${esc(p.legenda)}\n\n${esc(p.hashtags.join(' '))}</div><div class="etapa">Sugestão: ${esc(horaTexto(p.horario))}${p.motivoHorario ? ' · ' + esc(p.motivoHorario) : ''}</div>`;
    }
    if (v.etapa === 'aprovacao-pacote') corpo += `<textarea data-campo="revisao" placeholder="O que mudar na legenda?"></textarea>
      <div class="acoes"><button data-acao="copiar">Copiar legenda</button><button data-acao="revisar">Pedir ajuste</button><button class="forte" data-acao="aprovar">Aprovar</button></div>`;
    if (v.etapa === 'pronto-pra-postar') {
      const hora = new Date(v.postagem.horario) <= new Date();
      corpo += `${hora ? '<div class="erro" style="color:#A06A00">Hora de postar!</div>' : ''}<div class="acoes"><a href="/api/videos/${encodeURIComponent(v.id)}/final.mp4"><button>Baixar vídeo</button></a><button data-acao="copiar">Copiar legenda</button><button class="forte" data-acao="postado">Já postei</button></div>`;
    }
    if (ORDEM.indexOf(salaDaEtapa(v.etapa)) < ORDEM.indexOf('postagem') && !v.pular.includes('postagem'))
      corpo += `<div class="acoes"><button data-acao="pular-postagem">Pular postagem (eu mesmo posto)</button></div>`;
  }
  return `<div class="ficha${ESPERAS.has(v.etapa) && !v.trabalhando ? ' espera' : ''}" data-id="${esc(v.id)}">${corpo}</div>`;
}

function renderLista(e) {
  const espera = e.videos.filter(v => (ESPERAS.has(v.etapa) && !v.trabalhando) || v.erro);
  const fim = e.videos.filter(v => v.etapa === 'concluido');
  const resto = e.videos.filter(v => !espera.includes(v) && !fim.includes(v));
  const ativo = document.activeElement?.closest?.('.ficha')?.dataset.id; // don't wipe a textarea being typed in
  if (ativo) return;
  $('#lista').innerHTML = (espera.length ? '<div class="grupo">Esperando você</div>' + espera.map(cartao).join('') : '')
    + (resto.length ? '<div class="grupo">Trabalhando</div>' + resto.map(cartao).join('') : '')
    + (fim.length ? `<details><summary class="grupo">Concluídos (${fim.length})</summary>${fim.map(cartao).join('')}</details>` : '')
    + (!e.videos.length ? '<p class="etapa">Nenhum vídeo ainda. Clique em <b>Já gravei</b> ou solte o arquivo bruto em qualquer lugar da tela.</p>' : '');
  for (const v of e.videos) if (v.etapa === 'pronto-pra-postar' && new Date(v.postagem.horario) <= new Date() && !notificados.has(v.id)) {
    notificados.add(v.id); if (window.Notification?.permission === 'granted') new Notification('Hora de postar', { body: v.tema || v.id });
  }
}

async function agir(btn) {
  const ficha = btn.closest('.ficha'), id = ficha.dataset.id, base = `/api/videos/${encodeURIComponent(id)}`;
  const v = window.ESC.ultimoEstado.videos.find(x => x.id === id);
  const acao = btn.dataset.acao; btn.disabled = true;
  try {
    if (acao === 'painel') { const { url } = await api.post(base + '/painel'); abrirModal(url, id); }
    else if (acao === 'studio') { const { url } = await api.post(base + '/studio'); window.open(url, '_blank', 'noopener'); }
    else if (acao === 'revisar') { const texto = ficha.querySelector('[data-campo="revisao"]').value.trim(); if (!texto) throw new Error('Escreva o que mudar.'); await api.post(base + '/evento', { tipo: 'revisar', texto }); }
    else if (acao === 'aprovar') await api.post(base + '/evento', { tipo: 'aprovou' });
    else if (acao === 'postado') await api.post(base + '/evento', { tipo: 'postado' });
    else if (acao === 'tentar') await api.post(base + '/evento', { tipo: 'tentar-de-novo' });
    else if (acao === 'pular-postagem') await api.post(base + '/evento', { tipo: 'pular', sala: 'postagem' });
    else if (acao === 'copiar') { await navigator.clipboard.writeText(`${v.postagem.legenda}\n\n${v.postagem.hashtags.join(' ')}`); btn.textContent = 'Copiada!'; }
    if (acao === 'aprovar' && window.Notification?.permission === 'default') Notification.requestPermission();
  } catch (e) { alert(e.message); }
  finally { btn.disabled = false; document.activeElement?.blur(); }
}

let modalId = null;
function abrirModal(url, id) { modalId = id; $('#modal iframe').src = url; $('#modal-aba').href = url; $('#modal').classList.add('aberto'); }
function fecharModal() { modalId = null; $('#modal').classList.remove('aberto'); $('#modal iframe').src = 'about:blank'; }

function criarPlacas(ESC) {
  const placas = {};
  for (const k of ORDEM) {
    const el = document.createElement('div'); el.className = 'placa-sala'; el.dataset.sala = k; document.body.appendChild(el); placas[k] = el;
    el.addEventListener('click', ev => { if (ev.target.dataset.acao === 'checar') api.post('/api/checagem').catch(e => alert(e.message)); });
  }
  const canto = k => { const L = LAYOUT[k]; return new THREE.Vector3(L.pos[0] - L.w / 2, 5, L.pos[1] - L.d / 2); };
  ESC.aoTick(() => { for (const k of ORDEM) { const [x, y] = ESC.toScreen(canto(k)); placas[k].style.left = x + 'px'; placas[k].style.top = y + 'px'; } });
  return e => {
    for (const s of e.salas) {
      const el = placas[s.chave]; el.dataset.estado = s.estado;
      el.innerHTML = `<b>${esc(s.nome)}</b><div class="linha">${esc(s.texto)}</div>`
        + (s.ativa ? `<div class="num"><span>fila: ${s.fila}</span><span>${esc(s.rotuloContador)}: ${s.contador}</span></div>` : '')
        + (s.chave === 'edicao' && !e.checagem.ok ? '<button data-acao="checar">Conferir de novo</button>' : '');
    }
  };
}

export function iniciarPainel(ESC) {
  const pacotes = criarPacotes(ESC); ESC.aoTick(pacotes.tick);
  const placas = criarPlacas(ESC);
  $('#lista').addEventListener('click', e => { const b = e.target.closest('button[data-acao]'); if (b) agir(b); });
  $('#ja-gravei').addEventListener('click', () => $('#arquivo').click());
  $('#arquivo').addEventListener('change', async e => { const f = e.target.files[0]; if (f) { try { await api.upload(f); } catch (err) { alert(err.message); } } e.target.value = ''; });
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('soltando'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('soltando'); });
  addEventListener('drop', async e => { e.preventDefault(); document.body.classList.remove('soltando'); for (const f of e.dataTransfer.files) { try { await api.upload(f); } catch (err) { alert(err.message); } } });
  $('#modal-fechar').addEventListener('click', fecharModal);
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'l' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { document.body.classList.toggle('limpo'); ESC.enquadrar(); } });
  ESC.aoClicarSala(k => { const v = ESC.ultimoEstado?.videos.find(x => salaDaEtapa(x.etapa) === k); if (v) document.querySelector(`.ficha[data-id="${CSS.escape(v.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  const ciclo = async () => {
    try {
      const e = await api.estado(); ESC.ultimoEstado = e;
      aplicarEstado(ESC, e, pacotes); ESC.aoEstado?.(e); placas(e); renderLista(e);
      if (modalId && e.videos.find(v => v.id === modalId)?.etapa !== 'escolhas-edicao') fecharModal();
    } catch (err) { console.warn('estado:', err.message); }
    setTimeout(ciclo, 1500);
  };
  ciclo();
}
