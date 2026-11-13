import { ETAPAS, salaDaEtapa, textoDaEspera } from './ficha.mjs';

// Uma ficha da porta "Já gravei" nunca passou pela Pesquisa: não entra no contador dela.
const passouPela = (f, sala) => (f.historico || []).some(h => salaDaEtapa(h.etapa) === sala);

// "Relatórios" of the Análise: every reading of every ficha plus the weekly summaries (`resumos`, counted by the server).
const leituras = f => f.analise?.leituras?.length || 0;

export function resumoDasSalas(salas, fichas, checagem = { ok: true }, { resumos = 0 } = {}) {
  return salas.map(s => {
    const contador = s.chave === 'analise'
      ? fichas.reduce((n, f) => n + leituras(f), 0) + resumos
      : fichas.filter(f => s.contador.etapas.includes(f.etapa) && passouPela(f, s.chave)).length;
    const base = { chave: s.chave, nome: s.nome, ativa: s.ativa, rotuloContador: s.contador.rotulo, contador };
    if (!s.ativa) return { ...base, estado: 'inativa', texto: 'Chega na próxima atualização', fila: 0 };
    const aqui = fichas.filter(f => salaDaEtapa(f.etapa) === s.chave);
    const fila = aqui.length;
    if (s.chave === 'edicao' && !checagem.ok) return { ...base, estado: 'problema', texto: checagem.mensagem, fila };
    const comErro = aqui.find(f => f.erro);
    if (comErro) return { ...base, estado: 'problema', texto: comErro.erro.mensagem, fila };
    const espera = aqui.find(f => ETAPAS[f.etapa].tipo === 'espera');
    if (espera) return { ...base, estado: 'esperando', texto: textoDaEspera(espera), fila }; // na Análise diz qual leitura vem
    const trab = aqui.find(f => ETAPAS[f.etapa].tipo === 'trabalho');
    if (trab) return { ...base, estado: 'trabalhando', texto: ETAPAS[trab.etapa].texto, fila };
    return { ...base, estado: 'ocioso', texto: 'Sem vídeos agora', fila: 0 };
  });
}
