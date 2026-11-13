import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { carregarSalas, ORDEM_SALAS, salasInativas } from '../lib/salas.mjs';
import { resumoDasSalas } from '../lib/resumo.mjs';
import { criarFicha } from '../lib/ficha.mjs';

test('salas.json: six rooms in clockwise order; etapa 3 adds capa', () => {
  const s = carregarSalas();
  assert.deepEqual(s.map(x => x.chave), ORDEM_SALAS);
  assert.deepEqual(s.filter(x => x.ativa).map(x => x.chave), ['pesquisa', 'roteiro', 'edicao', 'capa', 'postagem']);
  assert.deepEqual(salasInativas(s), ['analise']);
});

test('carregarSalas refuses a missing room or a bad colour, in pt-BR', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-salas-'));
  const base = JSON.parse(fs.readFileSync(new URL('../salas.json', import.meta.url)));
  const sem = { salas: base.salas.slice(1) }; fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(sem));
  assert.throws(() => carregarSalas(path.join(dir, 'a.json')), /Falta a sala pesquisa/);
  base.salas[0].chip = 'azul'; fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(base));
  assert.throws(() => carregarSalas(path.join(dir, 'b.json')), /cor inválida/);
});

const f = (id, etapa, extra = {}) => ({ ...criarFicha({ id, porta: 'bruto', agora: 1 }), etapa, ...extra });

test('resumo: problema beats esperando beats trabalhando; fila counts every ficha in the room', () => {
  const salas = carregarSalas();
  const fichas = [f('a', 'editando'), f('b', 'bruto-recebido'), f('c', 'aprovacao-pacote'), f('d', 'concluido')];
  const r = Object.fromEntries(resumoDasSalas(salas, fichas).map(x => [x.chave, x]));
  assert.equal(r.edicao.estado, 'trabalhando'); assert.equal(r.edicao.fila, 2);
  assert.equal(r.edicao.texto, 'Editando o vídeo');
  assert.equal(r.postagem.estado, 'esperando'); assert.equal(r.postagem.texto, 'Aprove o post');
  assert.equal(r.edicao.contador, 2); // c (aprovacao-pacote) e d (concluido) já passaram pela edição
  assert.equal(r.analise.estado, 'inativa'); assert.equal(r.analise.texto, 'Chega na próxima atualização');
  const comErro = resumoDasSalas(salas, [...fichas, f('e', 'aprovacao-video', { erro: { sala: 'edicao', mensagem: 'x', em: 1 } })]);
  assert.equal(comErro.find(x => x.chave === 'edicao').estado, 'problema');
});

test('resumo: failed tool check puts edição in problema with the message', () => {
  const r = resumoDasSalas(carregarSalas(), [], { ok: false, mensagem: 'Falta instalar o FFmpeg' });
  const ed = r.find(x => x.chave === 'edicao');
  assert.equal(ed.estado, 'problema'); assert.equal(ed.texto, 'Falta instalar o FFmpeg');
  assert.equal(r.find(x => x.chave === 'postagem').estado, 'ocioso');
});

test('resumo: Pesquisa and Roteiro count only videos that went through them', () => {
  const salas = carregarSalas();
  const porIdeia = { ...criarFicha({ id: 'i', porta: 'ideia', tema: 't', agora: 1 }), etapa: 'aguardando-gravacao' };
  porIdeia.historico.push({ em: 2, etapa: 'roteiro', nota: 'concluiu' });
  const porBruto = f('b', 'concluido');
  const r = Object.fromEntries(resumoDasSalas(salas, [porIdeia, porBruto]).map(x => [x.chave, x]));
  assert.equal(r.pesquisa.contador, 1); assert.equal(r.roteiro.contador, 1);
  assert.equal(r.edicao.contador, 1); // só o b passou pela edição
  assert.equal(r.roteiro.estado, 'ocioso'); // aguardando-gravacao é da "gravação", não do Roteiro
});

test('resumo: Capa counts videos that went past it', () => {
  const salas = carregarSalas();
  const passou = { ...criarFicha({ id: 'c', porta: 'bruto', bruto: 'b.mp4', agora: 1 }), etapa: 'postagem' };
  passou.historico.push({ em: 2, etapa: 'capa', nota: 'concluiu' });
  const naCapa = { ...criarFicha({ id: 'd', porta: 'bruto', bruto: 'b.mp4', agora: 1 }), etapa: 'capa' };
  const r = Object.fromEntries(resumoDasSalas(salas, [passou, naCapa]).map(x => [x.chave, x]));
  assert.equal(r.capa.contador, 1); assert.equal(r.capa.fila, 1); assert.equal(r.capa.estado, 'trabalhando');
});
