import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FichasStore } from '../lib/fichas-store.mjs';
import { Orquestrador } from '../lib/orquestrador.mjs';
import { criarFicha } from '../lib/ficha.mjs';

const PULAR = ['pesquisa', 'roteiro', 'capa', 'analise'];
function montar(runners) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-orq-'));
  const store = new FichasStore(dados); store.garantirPastas();
  const nova = (id, etapa = 'bruto-recebido') => { fs.mkdirSync(store.pasta(id)); return store.salvar({ ...criarFicha({ id, porta: 'bruto', bruto: 'bruto.mp4', pular: PULAR, agora: 1 }), etapa }); };
  const o = new Orquestrador({ store, config: {}, cerebroDir: store.cerebroDir, runners });
  return { store, o, nova };
}

test('bruto-recebido runs PREPARAR and stops at escolhas-edicao with the session saved', async () => {
  const chamadas = [];
  const { store, o, nova } = montar({ edicao: async ({ comando }) => { chamadas.push(comando); return { estado: { etapa: 'aguardando-escolhas' }, sessao: 'S1' }; } });
  nova('a'); o.acordar(); await o.esperarOcioso();
  assert.deepEqual(chamadas, ['PREPARAR']);
  const f = store.carregar('a'); assert.equal(f.etapa, 'escolhas-edicao'); assert.equal(f.edicao.sessao, 'S1');
});

test('escolhas → editando → aprovacao-video → revisar sends REVISAR: text → aprovar → exportando → postagem', async () => {
  const chamadas = [];
  const { store, o, nova } = montar({
    edicao: async ({ comando }) => { chamadas.push(comando); return { estado: { etapa: comando === 'EXPORTAR' ? 'exportado' : 'revisao', studioUrl: 'http://s' }, sessao: 'S1' }; },
    postagem: async () => ({ legenda: 'L', hashtags: [], horario: '2099-01-01T21:00:00.000Z', motivoHorario: '' }),
  });
  nova('a', 'escolhas-edicao');
  o.evento('a', { tipo: 'escolhas-prontas' }); await o.esperarOcioso();
  assert.equal(store.carregar('a').etapa, 'aprovacao-video');
  o.evento('a', { tipo: 'revisar', texto: 'legenda maior' }); await o.esperarOcioso();
  o.evento('a', { tipo: 'aprovou' }); await o.esperarOcioso();
  assert.deepEqual(chamadas, ['ESCOLHAS_PRONTAS', 'REVISAR: legenda maior', 'EXPORTAR']);
  const f = store.carregar('a'); assert.equal(f.etapa, 'aprovacao-pacote'); assert.equal(f.postagem.legenda, 'L');
});

test('a failing room records the error and does not loop; tentar-de-novo runs again', async () => {
  let vezes = 0;
  const { store, o, nova } = montar({ edicao: async () => { vezes++; throw new Error('Falta o FFmpeg'); } });
  nova('a'); o.acordar(); await o.esperarOcioso(); o.acordar(); await o.esperarOcioso();
  assert.equal(vezes, 1); assert.equal(store.carregar('a').erro.mensagem, 'Falta o FFmpeg');
  o.evento('a', { tipo: 'tentar-de-novo' }); await o.esperarOcioso();
  assert.equal(vezes, 2);
});

test('two videos in edição run one after the other, never at the same time', async () => {
  let ativos = 0, maximo = 0;
  const { o, nova } = montar({ edicao: async () => { ativos++; maximo = Math.max(maximo, ativos); await new Promise(r => setTimeout(r, 30)); ativos--; return { estado: { etapa: 'aguardando-escolhas' }, sessao: 'S' }; } });
  nova('a'); nova('b'); o.acordar(); await o.esperarOcioso();
  assert.equal(maximo, 1);
});

test('retomar after a restart picks up fichas left in a work etapa', async () => {
  const chamadas = [];
  const { store, o, nova } = montar({ edicao: async ({ comando }) => { chamadas.push(comando); return { estado: { etapa: 'revisao', studioUrl: 'http://s' }, sessao: 'S1' }; } });
  const f = nova('a', 'editando'); store.salvar({ ...f, edicao: { sessao: 'S1', studioUrl: null } });
  o.retomar(); await o.esperarOcioso();
  assert.deepEqual(chamadas, ['ESCOLHAS_PRONTAS']); assert.equal(store.carregar('a').etapa, 'aprovacao-video');
});

test('andamento exposes the live estado.json of the running edição', async () => {
  let liberar; const segura = new Promise(r => { liberar = r; });
  const { store, o, nova } = montar({ edicao: async ({ pastaVideo }) => {
    fs.mkdirSync(path.join(pastaVideo, 'edit'), { recursive: true });
    fs.writeFileSync(path.join(pastaVideo, 'edit', 'estado.json'), JSON.stringify({ etapa: 'montando', progresso: 0.5, mensagem: 'Cortando' }));
    await segura; return { estado: { etapa: 'aguardando-escolhas' }, sessao: 'S' };
  } });
  nova('a'); o.acordar(); await new Promise(r => setTimeout(r, 20));
  assert.equal(o.ocupado('a'), true); assert.deepEqual(o.andamento('a'), { progresso: 0.5, mensagem: 'Cortando' });
  liberar(); await o.esperarOcioso(); assert.equal(o.andamento('a'), null);
});
