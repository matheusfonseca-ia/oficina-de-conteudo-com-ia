import { api } from './api.js';
import { salaDaEtapa } from '../lib/ficha.mjs';
import { criarPacotes } from './pacote.js';

const ultimaSala = new Map();
export function aplicarEstado(ESC, estado, pacotes) {
  for (const s of estado.salas) {
    const sala = ESC.salas[s.chave]; if (!sala) continue;
    sala.estado = s.estado;
    const emAndamento = estado.videos.find(v => v.trabalhando && salaDaEtapa(v.etapa) === s.chave);
    sala.tela.desenhar({ titulo: s.nome, linha: emAndamento?.andamento?.mensagem || s.texto, progresso: emAndamento?.andamento ? emAndamento.andamento.progresso : null });
    pacotes.fila(s.chave, Math.max(0, Math.min(4, s.fila - 1)));
  }
  for (const v of estado.videos) {
    const agora = salaDaEtapa(v.etapa), antes = ultimaSala.get(v.id);
    if (antes && antes !== agora && ESC.salas[antes] && ESC.salas[agora]) pacotes.aoMudar(v.id, antes, agora);
    ultimaSala.set(v.id, agora);
  }
  const antena = ESC.salas.postagem?.decor?.getObjectByName('antena');
  if (antena) antena.material.emissiveIntensity = estado.videos.some(v => v.etapa === 'pronto-pra-postar') ? 1.6 : 0.2;
}

export function iniciarPainel(ESC) {
  const pacotes = criarPacotes(ESC); ESC.aoTick(pacotes.tick);
  const ciclo = async () => {
    try { const e = await api.estado(); ESC.ultimoEstado = e; aplicarEstado(ESC, e, pacotes); ESC.aoEstado?.(e); }
    catch (err) { console.warn('estado:', err.message); }
    setTimeout(ciclo, 1500);
  };
  ciclo();
}
