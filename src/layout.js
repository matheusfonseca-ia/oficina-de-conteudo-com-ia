// Same islands as the Oficina (projetos/agents-office/src/data.js LAYOUT): same positions, same sizes.
// Each room sits on the Oficina department island at the same spot:
//   pesquisa = fin · roteiro = delivery · edicao = sales · capa = emails · postagem = ops · analise = marketing
// Rooms go clockwise on screen starting at the top.
export const ORDEM = ['pesquisa', 'roteiro', 'edicao', 'capa', 'postagem', 'analise'];
export const LAYOUT = {
  cerebro:  { pos: [0, 0],     w: 24, d: 24, raio: 12 }, // round island under the dome (the Oficina's is a 16×16 square)
  pesquisa: { pos: [-32, -12], w: 20, d: 26 },
  roteiro:  { pos: [6, -39],   w: 20, d: 30 },
  edicao:   { pos: [38, -11],  w: 20, d: 30 },
  capa:     { pos: [41, 27],   w: 20, d: 26 },
  postagem: { pos: [6, 39],    w: 20, d: 30 },
  analise:  { pos: [-30, 26],  w: 20, d: 30 },
};
// chip/ink/piso as before; led = the Oficina's neon for the same chip (DEPTS[k].led there).
export const CORES = {
  pesquisa: { chip: '#8FD3F4', ink: '#2E86AB', piso: '#E6F4FB', led: '#1ACDFF' },
  roteiro:  { chip: '#5ADEB7', ink: '#1E9070', piso: '#E9F6EF', led: '#1AFF9F' },
  edicao:   { chip: '#E69393', ink: '#C46060', piso: '#FAE9E7', led: '#FF3366' },
  capa:     { chip: '#EADC8F', ink: '#A08A1E', piso: '#F6F1DA', led: '#FFD11A' },
  postagem: { chip: '#BFA2E3', ink: '#7449A9', piso: '#F2ECFA', led: '#B84DFF' },
  analise:  { chip: '#98A5EF', ink: '#5B66CE', piso: '#EAEDFA', led: '#476CFF' },
  cerebro:  { chip: '#D1DECD', ink: '#4C7A57', piso: '#E9EFE4', led: 'rainbow' },
};
export const ROBOS = {
  pesquisa: { head: 'dome', shell: '#8C96A3', nome: 'PESQUISADOR' }, roteiro: { head: 'screen', shell: '#ECE8DE', nome: 'ROTEIRISTA' },
  edicao: { head: 'box', shell: '#3E434B', nome: 'EDITOR' }, capa: { head: 'dome', shell: '#B9805A', nome: 'DESIGNER DE CAPA' },
  postagem: { head: 'screen', shell: '#C9CED5', nome: 'SOCIAL MEDIA' }, analise: { head: 'box', shell: '#46536E', nome: 'ANALISTA' },
};
// Where each room's card sits, the same side as the Oficina department on that island (main.js badgeSide there).
export const LADO_PLACA = { pesquisa: 'top', analise: 'top-left', roteiro: 'top-right', postagem: 'left', edicao: 'right', capa: 'bottom' };
