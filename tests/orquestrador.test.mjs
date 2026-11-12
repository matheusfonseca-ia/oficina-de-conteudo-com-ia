import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FichasStore } from '../lib/fichas-store.mjs';
import { Orquestrador } from '../lib/orquestrador.mjs';
import { criarFicha } from '../lib/ficha.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');

const PULAR = ['pesquisa', 'roteiro', 'capa', 'analise'];
function montar(runners, config = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-orq-'));
  const store = new FichasStore(dados); store.garantirPastas();
  const nova = (id, etapa = 'bruto-recebido') => { fs.mkdirSync(store.pasta(id)); return store.salvar({ ...criarFicha({ id, porta: 'bruto', bruto: 'bruto.mp4', pular: PULAR, agora: 1 }), etapa }); };
  const o = new Orquestrador({ store, config, cerebroDir: store.cerebroDir, runners });
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

test('andamento ignores the estado.json left by the previous run until this run writes a new one', async () => {
  let liberar; const segura = new Promise(r => { liberar = r; });
  let escrever;
  const { o, nova } = montar({ edicao: async ({ pastaVideo }) => {
    await new Promise(r => { escrever = r; });
    fs.writeFileSync(path.join(pastaVideo, 'edit', 'estado.json'), JSON.stringify({ etapa: 'montando', progresso: 0.2, mensagem: 'Cortando' }));
    await segura; return { estado: { etapa: 'revisao', studioUrl: 'http://s' }, sessao: 'S' };
  } });
  nova('a', 'editando');
  const arq = path.join(o.store.pasta('a'), 'edit', 'estado.json');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, JSON.stringify({ etapa: 'aguardando-escolhas', progresso: 1, mensagem: 'Pronto pra você escolher formato e estilo' }));
  const antes = new Date(Date.now() - 60000); fs.utimesSync(arq, antes, antes);
  o.acordar(); await new Promise(r => setTimeout(r, 20));
  assert.equal(o.andamento('a'), null);
  escrever(); await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(o.andamento('a'), { progresso: 0.2, mensagem: 'Cortando' });
  liberar(); await o.esperarOcioso();
});

test('a store.salvar that throws inside the failure path is not an unhandled rejection; the office keeps working', async () => {
  const soltas = []; const pegar = e => soltas.push(e); process.on('unhandledRejection', pegar);
  const erroOriginal = console.error; console.error = () => {};
  try {
    let quebrar = true, vezesA = 0;
    const { store, o, nova } = montar({ edicao: async ({ ficha }) => { if (ficha.id === 'a') { vezesA++; throw new Error('Falta o FFmpeg'); } return { estado: { etapa: 'aguardando-escolhas' }, sessao: 'S' }; } });
    const salvar = store.salvar.bind(store);
    store.salvar = f => { if (quebrar && f.erro) throw new Error('disco ocupado'); return salvar(f); };
    nova('a'); o.acordar(); await o.esperarOcioso();
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(soltas, []);
    quebrar = false;
    nova('b'); o.acordar(); await o.esperarOcioso();
    assert.equal(store.carregar('b').etapa, 'escolhas-edicao');
    assert.equal(vezesA, 1); // a ficha que quebrou não entra em laço
  } finally { process.off('unhandledRejection', pegar); console.error = erroOriginal; }
});

test('pararTudo kills the running Claude child and leaves the ficha without error, ready for retomar', { timeout: 20000 }, async () => {
  const config = { claude: { command: process.execPath, prefixArgs: [FAKE] }, skillsDir: '/s', maquinaDir: '/m', modeloEdicao: null };
  const { store, o, nova } = montar({}, config);
  const arqPid = path.join(os.tmpdir(), `esc-pid-${process.pid}-${Date.now()}`);
  process.env.OFC_TEST_MODO = 'lento'; process.env.OFC_TEST_PID = arqPid;
  try {
    nova('a'); o.acordar();
    for (let i = 0; i < 200 && !fs.existsSync(arqPid); i++) await new Promise(r => setTimeout(r, 25));
    const pid = Number(fs.readFileSync(arqPid, 'utf8'));
    assert.ok(pid > 0);
    await o.pararTudo();
    assert.throws(() => process.kill(pid, 0), /ESRCH/);
    const f = store.carregar('a'); assert.equal(f.erro, null); assert.equal(f.etapa, 'bruto-recebido');
    assert.equal(o.rodando.size, 0);
    o.acordar(); assert.equal(o.rodando.size, 0); // depois de parar, nada novo começa
  } finally { delete process.env.OFC_TEST_MODO; delete process.env.OFC_TEST_PID; fs.rmSync(arqPid, { force: true }); }
});

test('a Studio URL belongs to one video: a new run with the same URL clears it on the others', async () => {
  const { store, o, nova } = montar({ edicao: async () => ({ estado: { etapa: 'revisao', studioUrl: 'http://s' }, sessao: 'S' }) });
  const b = nova('b', 'aprovacao-video'); store.salvar({ ...b, edicao: { sessao: 'B', studioUrl: 'http://s' } });
  const c = nova('c', 'aprovacao-video'); store.salvar({ ...c, edicao: { sessao: 'C', studioUrl: 'http://outra' } });
  nova('a', 'editando'); o.acordar(); await o.esperarOcioso();
  assert.equal(store.carregar('a').edicao.studioUrl, 'http://s');
  assert.equal(store.carregar('b').edicao.studioUrl, null);
  assert.equal(store.carregar('c').edicao.studioUrl, 'http://outra');
  o.runners.edicao = async () => ({ estado: { etapa: 'revisao', studioUrl: 'http://outra' }, sessao: 'S' });
  await o.reabrirStudio('b');
  assert.equal(store.carregar('b').edicao.studioUrl, 'http://outra');
  assert.equal(store.carregar('c').edicao.studioUrl, null);
});
