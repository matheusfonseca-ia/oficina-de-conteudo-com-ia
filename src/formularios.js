// The page's dialogs: a new idea, the Cérebro interview, reading the script full screen,
// and asking which video a recording belongs to.
import { api } from './api.js';

const $ = s => document.querySelector(s);
const abrir = id => $(id).classList.add('aberta');
const fechar = id => $(id).classList.remove('aberta');

export const textoDoRoteiro = r => r ? [r.gancho, ...r.desenvolvimento, r.cta].filter(Boolean).join('\n\n') : '';

export function iniciarFormularios() {
  $('#tenho-ideia').addEventListener('click', () => { abrir('#ideia'); $('#ideia-tema').focus(); });
  $('#ideia-cancelar').addEventListener('click', () => fechar('#ideia'));
  $('#ideia-form').addEventListener('submit', async e => {
    e.preventDefault();
    const tema = $('#ideia-tema').value.trim();
    if (!tema) return alert('Escreva a ideia do vídeo.');
    const btn = $('#ideia-enviar'); btn.disabled = true;
    try { await api.post('/api/ideia', { tema, pularPesquisa: $('#ideia-pular').checked }); e.target.reset(); fechar('#ideia'); }
    catch (err) { alert(err.message); }
    finally { btn.disabled = false; }
  });

  // Clicking the boss (src/main.js) opens his window; a room card can ask for the Conexões tab.
  addEventListener('abrir-chefe', e => abrirChefe(e.detail?.aba).catch(err => alert(err.message)));
  for (const b of document.querySelectorAll('#cerebro .aba')) b.addEventListener('click', () => abrirChefe(b.dataset.aba).catch(err => alert(err.message)));
  $('#conexoes-fechar').addEventListener('click', () => fechar('#cerebro'));
  $('#conexoes').addEventListener('click', e => { const b = e.target.closest('[data-con]'); if (b) agirConexao(b); });
  $('#conexoes').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); const b = e.target.closest('.conexao').querySelector('[data-con="conectar"]'); if (!b.disabled) agirConexao(b); } });
  $('#cerebro-depois').addEventListener('click', () => fechar('#cerebro'));
  $('#cerebro-voltar').addEventListener('click', () => irPara(passoAtual - 1));
  // Enter goes to the next question (Shift+Enter still breaks a line in the bigger answers).
  $('#cerebro-form').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName === 'TEXTAREA') { e.preventDefault(); $('#cerebro-form').requestSubmit(); }
  });
  $('#cerebro-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, passos = [...f.querySelectorAll('.passo')], atual = passos[passoAtual];
    const obrigatorio = atual.dataset.obrigatorio;
    if (obrigatorio && !atual.querySelector('textarea, input').value.trim()) { $('#cerebro-erro').textContent = obrigatorio; return; }
    if (passoAtual < passos.length - 1) return irPara(passoAtual + 1);
    const btn = $('#cerebro-salvar'); btn.disabled = true;
    try {
      await api.post('/api/cerebro', { nicho: f.nicho.value, publico: f.publico.value, tom: f.tom.value, arroba: f.arroba.value,
        referencias: [f.ref1.value, f.ref2.value, f.ref3.value] });
      mostrarProgresso(passos.length, passos.length);
      setTimeout(() => fechar('#cerebro'), 450);
    } catch (err) { $('#cerebro-erro').textContent = err.message; }
    finally { btn.disabled = false; }
  });

  $('#leitura-fechar').addEventListener('click', () => fechar('#leitura'));
  // Esc fecha as janelas simples. A de destino espera uma resposta: fecha só pelos botões dela.
  addEventListener('keydown', e => { if (e.key === 'Escape') for (const id of ['#leitura', '#ideia', '#cerebro']) fechar(id); });
}

export async function abrirCerebro() {
  const { perfil, texto } = await api.get('/api/cerebro');
  const f = $('#cerebro-form');
  f.nicho.value = perfil?.nicho || ''; f.publico.value = perfil?.publico || ''; f.tom.value = perfil?.tom || ''; f.arroba.value = perfil?.arroba || '';
  [f.ref1.value, f.ref2.value, f.ref3.value] = [0, 1, 2].map(i => perfil?.referencias?.[i] || '');
  $('#cerebro-antigo').hidden = !(!perfil && texto);
  mostrarAba('perfil'); abrir('#cerebro'); irPara(0);
}

export async function abrirChefe(aba = 'perfil') {
  if (aba !== 'conexoes') return abrirCerebro();
  mostrarAba('conexoes'); abrir('#cerebro');
  pintarConexoes((await api.estado()).conexoes || {});
  $('#conexoes input')?.focus();
}

function mostrarAba(aba) {
  for (const b of document.querySelectorAll('#cerebro .aba')) b.classList.toggle('ativa', b.dataset.aba === aba);
  for (const p of document.querySelectorAll('#cerebro [data-painel]')) p.hidden = p.dataset.painel !== aba;
  $('#conexoes-erro').textContent = '';
}

function pintarConexoes(conexoes) {
  for (const c of document.querySelectorAll('#conexoes .conexao')) {
    const ligada = !!conexoes[c.dataset.servico];
    c.querySelector('.ligada').hidden = !ligada; c.querySelector('.desligada').hidden = ligada;
    if (ligada) c.querySelector('input').value = '';
  }
}

async function agirConexao(btn) {
  const c = btn.closest('.conexao'), servico = c.dataset.servico;
  btn.disabled = true; $('#conexoes-erro').textContent = '';
  try {
    const r = btn.dataset.con === 'conectar'
      ? await api.post('/api/conexoes', { servico, chave: c.querySelector('input').value })
      : await api.del(`/api/conexoes/${encodeURIComponent(servico)}`);
    pintarConexoes(r.conexoes);
  } catch (e) { $('#conexoes-erro').textContent = e.message; }
  finally { btn.disabled = false; }
}

// The boss interview walks one question at a time; the bar fills as each answer is done.
let passoAtual = 0;
function mostrarProgresso(feitos, total) {
  const pct = Math.round((feitos / total) * 100);
  $('#cerebro-barra').style.width = pct + '%';
  $('#cerebro-pct').textContent = pct + '%';
}
function irPara(i) {
  const passos = [...document.querySelectorAll('#cerebro .passo')];
  passoAtual = Math.max(0, Math.min(passos.length - 1, i));
  passos.forEach((p, j) => p.classList.toggle('atual', j === passoAtual));
  $('#cerebro-contagem').textContent = `Pergunta ${passoAtual + 1} de ${passos.length}`;
  mostrarProgresso(passoAtual, passos.length);
  $('#cerebro-erro').textContent = '';
  $('#cerebro-voltar').style.visibility = passoAtual ? 'visible' : 'hidden';
  $('#cerebro-salvar').textContent = passoAtual === passos.length - 1 ? 'Salvar' : 'Próximo';
  passos[passoAtual].querySelector('textarea, input').focus();
}

export function abrirLeitura(roteiro) {
  $('#leitura-titulo').textContent = roteiro?.titulo || 'Roteiro';
  $('#leitura-texto').textContent = textoDoRoteiro(roteiro);
  abrir('#leitura');
}

// Resolve com o id do vídeo escolhido, null (vídeo novo) ou undefined (cancelou).
export function escolherDestino(arquivo, esperando) {
  return new Promise(resolve => {
    $('#destino-arquivo').textContent = arquivo.name;
    const lista = $('#destino-lista'); lista.innerHTML = '';
    const opcao = (texto, valor, forte = false) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = texto; if (forte) b.className = 'forte';
      b.addEventListener('click', () => { fechar('#destino'); resolve(valor); }); lista.append(b);
    };
    for (const v of esperando) opcao(`Roteiro: ${v.roteiro?.titulo || v.tema || v.id}`, v.id, true);
    opcao('É um vídeo novo', null);
    opcao('Cancelar', undefined);
    abrir('#destino');
  });
}
