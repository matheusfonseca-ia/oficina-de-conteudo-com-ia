// Rooms go clockwise on screen starting at the top, matching what this camera shows:
// top = (-32,-12), top-right = (6,-39), right = (38,-11), bottom = (41,27), bottom-left = (6,39),
// left = (-30,26). EDIÇÃO is the bigger island.
export const ORDEM = ['pesquisa', 'roteiro', 'edicao', 'capa', 'postagem', 'analise'];
export const LAYOUT = {
  cerebro:  { pos: [0, 0],     w: 16, d: 16 },
  pesquisa: { pos: [-32, -12], w: 20, d: 22 },
  roteiro:  { pos: [6, -39],   w: 20, d: 22 },
  edicao:   { pos: [38, -11],  w: 24, d: 28 },
  capa:     { pos: [41, 27],   w: 20, d: 22 },
  postagem: { pos: [6, 39],    w: 20, d: 22 },
  analise:  { pos: [-30, 26],  w: 20, d: 22 },
};
export const CORES = {
  pesquisa: { chip: '#8FD3F4', ink: '#2E86AB', piso: '#E6F4FB' },
  roteiro:  { chip: '#5ADEB7', ink: '#1E9070', piso: '#E9F6EF' },
  edicao:   { chip: '#E69393', ink: '#C46060', piso: '#FAE9E7' },
  capa:     { chip: '#EADC8F', ink: '#A08A1E', piso: '#F6F1DA' },
  postagem: { chip: '#BFA2E3', ink: '#7449A9', piso: '#F2ECFA' },
  analise:  { chip: '#98A5EF', ink: '#5B66CE', piso: '#EAEDFA' },
  cerebro:  { chip: '#D1DECD', ink: '#4C7A57', piso: '#E9EFE4' },
};
export const ROBOS = {
  pesquisa: { head: 'dome', shell: '#8C96A3' }, roteiro: { head: 'screen', shell: '#ECE8DE' },
  edicao: { head: 'box', shell: '#3E434B' }, capa: { head: 'dome', shell: '#B9805A' },
  postagem: { head: 'screen', shell: '#C9CED5' }, analise: { head: 'box', shell: '#46536E' },
};
