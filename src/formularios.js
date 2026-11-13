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

  $('#abrir-cerebro').addEventListener('click', () => abrirCerebro().catch(e => alert(e.message)));
  $('#cerebro-depois').addEventListener('click', () => fechar('#cerebro'));
  $('#cerebro-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = $('#cerebro-salvar'); btn.disabled = true;
    try {
      await api.post('/api/cerebro', { nicho: f.nicho.value, publico: f.publico.value, tom: f.tom.value, arroba: f.arroba.value,
        referencias: [f.ref1.value, f.ref2.value, f.ref3.value] });
      fechar('#cerebro');
    } catch (err) { alert(err.message); }
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
  abrir('#cerebro'); f.nicho.focus();
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
