import { api } from './api.js';
import { salaDaEtapa } from '../lib/ficha.mjs';
import { criarPacotes } from './pacote.js';
import { calcularMovimentos } from './movimentos.js';
import { ETAPAS } from '../lib/ficha.mjs';
import { ORDEM } from './layout.js';
import { iniciarFormularios, abrirCerebro, abrirLeitura, escolherDestino } from './formularios.js';

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
const ESPERAS = new Set(['escolha-referencia', 'aprovacao-roteiro', 'aguardando-gravacao', 'escolhas-edicao', 'aprovacao-video', 'aprovacao-pacote', 'pronto-pra-postar']);
const DEPOIS_DA_EXPORTACAO = new Set(['capa', 'postagem', 'aprovacao-pacote', 'pronto-pra-postar', 'agendado', 'analise', 'concluido']);
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

const roteiroCurto = r => `${r.titulo}\n\nGancho: ${r.gancho}\n\n${r.desenvolvimento.map((b, i) => `${i + 1}. ${b}`).join('\n')}${r.cta ? `\n\nChamada: ${r.cta}` : ''}`;
function referencias(v) {
  const itens = (v.pesquisa?.referencias || []).map((r, i) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.titulo)}</a>${r.criador ? ` <span class="etapa">${esc(r.criador)}</span>` : ''}
    <div class="etapa">${esc(r.porQueFuncionou)}</div><button data-acao="referencia" data-indice="${i}">Usar esta</button></li>`).join('');
  return `<ol class="refs">${itens}</ol><textarea data-campo="revisao" placeholder="Quer outras? Ex.: mais vídeos de humor, só em português"></textarea>
    <div class="acoes"><button data-acao="revisar">Buscar outras</button><button data-acao="sem-referencia">Seguir sem referência</button></div>`;
}

function cartao(v) {
  const meta = ETAPAS[v.etapa];
  let corpo = `<h3>${esc(v.tema || v.id)}</h3>${trilha(v)}<div class="etapa">${esc(v.andamento?.mensagem || meta.texto)}</div>`;
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
    if (v.etapa === 'aprovacao-pacote') corpo += `<textarea data-campo="revisao" placeholder="O que mudar na legenda?"></textarea>
      <div class="acoes">${baixar}${copiar}<button data-acao="revisar">Pedir ajuste</button><button class="forte" data-acao="aprovar">Aprovar</button></div>`;
    if (v.etapa === 'pronto-pra-postar') {
      const hora = v.postagem && new Date(v.postagem.horario) <= new Date();
      corpo += `${hora ? '<div class="erro" style="color:#A06A00">Hora de postar!</div>' : ''}<div class="acoes">${baixar}${copiar}<button class="forte" data-acao="postado">Já postei</button></div>`;
    }
  }
  if (ORDEM.indexOf(salaDaEtapa(v.etapa)) < ORDEM.indexOf('postagem') && !v.pular.includes('postagem'))
    corpo += `<div class="acoes"><button data-acao="pular-postagem">Pular postagem (eu mesmo posto)</button></div>`;
  return `<div class="ficha${ESPERAS.has(v.etapa) && !v.trabalhando ? ' espera' : ''}" data-id="${esc(v.id)}">${corpo}</div>`;
}

const rascunhos = new Map();
let ultimoHtml = null, concluidosAberto = false;
function renderLista(e) {
  for (const v of e.videos) if (v.etapa === 'pronto-pra-postar' && v.postagem && new Date(v.postagem.horario) <= new Date() && !notificados.has(v.id)) {
    notificados.add(v.id); if (window.Notification?.permission === 'granted') new Notification('Hora de postar', { body: v.tema || v.id });
  }
  const espera = e.videos.filter(v => (ESPERAS.has(v.etapa) && !v.trabalhando) || v.erro);
  const fim = e.videos.filter(v => v.etapa === 'concluido');
  const resto = e.videos.filter(v => !espera.includes(v) && !fim.includes(v));
  const html = (espera.length ? '<div class="grupo">Esperando você</div>' + espera.map(cartao).join('') : '')
    + (resto.length ? '<div class="grupo">Trabalhando</div>' + resto.map(cartao).join('') : '')
    + (fim.length ? `<details${concluidosAberto ? ' open' : ''}><summary class="grupo">Concluídos (${fim.length})</summary>${fim.map(cartao).join('')}</details>` : '')
    + (!e.videos.length ? '<p class="etapa">Nenhum vídeo ainda. Clique em <b>Já gravei</b> ou solte o arquivo bruto em qualquer lugar da tela.</p>' : '');
  if (html === ultimoHtml) return;
  const lista = $('#lista'), foco = document.activeElement, focoId = foco?.closest?.('.ficha')?.dataset.id, pos = lista.scrollTop;
  const emTexto = foco?.tagName === 'TEXTAREA' && lista.contains(foco);
  const cursor = emTexto ? [foco.selectionStart, foco.selectionEnd, foco.selectionDirection, foco.scrollTop] : null;
  ultimoHtml = html; lista.innerHTML = html;
  for (const t of lista.querySelectorAll('textarea[data-campo]')) { const r = rascunhos.get(t.closest('.ficha').dataset.id); if (r) t.value = r; }
  if (focoId && emTexto) {
    // O repinte troca o elemento: devolve o foco e o cursor (ou a seleção) pro mesmo lugar do texto.
    const t = lista.querySelector(`.ficha[data-id="${CSS.escape(focoId)}"] textarea`);
    if (t) { t.focus(); t.setSelectionRange(cursor[0], cursor[1], cursor[2] || 'none'); t.scrollTop = cursor[3]; }
  }
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
    else if (acao === 'aprovar') await api.post(base + '/evento', { tipo: 'aprovou' });
    else if (acao === 'postado') await api.post(base + '/evento', { tipo: 'postado' });
    else if (acao === 'tentar') await api.post(base + '/evento', { tipo: 'tentar-de-novo' });
    else if (acao === 'pular-postagem') await api.post(base + '/evento', { tipo: 'pular', sala: 'postagem' });
    else if (acao === 'referencia') await api.post(base + '/evento', { tipo: 'escolheu-referencia', indice: Number(btn.dataset.indice) });
    else if (acao === 'sem-referencia') await api.post(base + '/evento', { tipo: 'escolheu-referencia', indice: null });
    else if (acao === 'pular-pesquisa') await api.post(base + '/evento', { tipo: 'pular', sala: 'pesquisa' });
    else if (acao === 'ler') abrirLeitura(v.roteiro);
    else if (acao === 'copiar') { await navigator.clipboard.writeText(`${v.postagem?.legenda ?? ""}\n\n${(v.postagem?.hashtags || []).join(' ')}`); btn.textContent = 'Copiada!'; }
    if (acao === 'revisar' || acao === 'aprovar' || acao === 'referencia' || acao === 'sem-referencia') rascunhos.delete(id);
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
    el.addEventListener('click', ev => { if (ev.target.dataset.acao === 'checar') api.post('/api/checagem').catch(e => alert(e.message)); });
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
        + (s.chave === 'edicao' && !e.checagem.ok ? '<button data-acao="checar">Conferir de novo</button>' : '');
    }
  };
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
  $('#lista').addEventListener('click', e => { const b = e.target.closest('button[data-acao]'); if (b) agir(b); });
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
