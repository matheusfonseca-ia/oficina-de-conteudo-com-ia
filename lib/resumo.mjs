import { ETAPAS, salaDaEtapa } from './ficha.mjs';

export function resumoDasSalas(salas, fichas, checagem = { ok: true }) {
  return salas.map(s => {
    const base = { chave: s.chave, nome: s.nome, ativa: s.ativa, rotuloContador: s.contador.rotulo,
      contador: fichas.filter(f => s.contador.etapas.includes(f.etapa)).length };
    if (!s.ativa) return { ...base, estado: 'inativa', texto: 'Chega na próxima atualização', fila: 0 };
    const aqui = fichas.filter(f => salaDaEtapa(f.etapa) === s.chave);
    const fila = aqui.length;
    if (s.chave === 'edicao' && !checagem.ok) return { ...base, estado: 'problema', texto: checagem.mensagem, fila };
    const comErro = aqui.find(f => f.erro);
    if (comErro) return { ...base, estado: 'problema', texto: comErro.erro.mensagem, fila };
    const espera = aqui.find(f => ETAPAS[f.etapa].tipo === 'espera');
    if (espera) return { ...base, estado: 'esperando', texto: ETAPAS[espera.etapa].texto, fila };
    const trab = aqui.find(f => ETAPAS[f.etapa].tipo === 'trabalho');
    if (trab) return { ...base, estado: 'trabalhando', texto: ETAPAS[trab.etapa].texto, fila };
    return { ...base, estado: 'ocioso', texto: 'Sem vídeos agora', fila: 0 };
  });
}
