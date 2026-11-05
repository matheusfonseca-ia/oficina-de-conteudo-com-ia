import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORDEM_SALAS = ['pesquisa', 'roteiro', 'edicao', 'capa', 'postagem', 'analise'];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const PADRAO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'salas.json');

export function carregarSalas(arquivo = PADRAO) {
  const { salas } = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  for (const chave of ORDEM_SALAS) if (!salas.some(s => s.chave === chave)) throw new Error(`Falta a sala ${chave} em salas.json`);
  const ordenadas = [...salas].sort((a, b) => a.ordem - b.ordem);
  ordenadas.forEach((s, i) => {
    if (s.ordem !== i + 1 || s.chave !== ORDEM_SALAS[i]) throw new Error(`A sala ${s.chave} está fora de ordem em salas.json`);
    for (const k of ['chip', 'ink', 'piso', 'led']) if (!HEX.test(s[k] || '')) throw new Error(`A sala ${s.chave} tem cor inválida em "${k}"`);
    if (!s.nome || typeof s.ativa !== 'boolean') throw new Error(`A sala ${s.chave} está incompleta`);
  });
  return ordenadas;
}
export const salasInativas = salas => salas.filter(s => !s.ativa).map(s => s.chave);
