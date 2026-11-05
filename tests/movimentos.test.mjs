import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMovimentos } from '../src/movimentos.js';
import { salaDaEtapa } from '../lib/ficha.mjs';

const REAIS = ['pesquisa', 'roteiro', 'edicao', 'capa', 'postagem', 'analise'];
const run = (m, videos) => calcularMovimentos(m, videos, salaDaEtapa, REAIS);

test('roteiro -> gravacao -> edicao gives exactly one move roteiro -> edicao', () => {
  const m = new Map(); const todas = [];
  for (const etapa of ['roteiro', 'aguardando-gravacao', 'escolhas-edicao']) todas.push(...run(m, [{ id: 'a', etapa }]));
  assert.deepEqual(todas, [{ id: 'a', de: 'roteiro', para: 'edicao' }]);
});
test('edicao -> fim gives no move and keeps the last room', () => {
  const m = new Map();
  run(m, [{ id: 'a', etapa: 'escolhas-edicao' }]);
  assert.deepEqual(run(m, [{ id: 'a', etapa: 'concluido' }]), []);
  assert.equal(m.get('a'), 'edicao');
});
test('a vanished id is pruned', () => {
  const m = new Map();
  run(m, [{ id: 'a', etapa: 'escolhas-edicao' }, { id: 'b', etapa: 'roteiro' }]);
  run(m, [{ id: 'b', etapa: 'roteiro' }]);
  assert.deepEqual([...m.keys()], ['b']);
});
