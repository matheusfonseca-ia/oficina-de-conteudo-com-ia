// The Cérebro: what the Oficina knows about its owner. The interview form writes perfil.json (to
// fill the form again) and perfil.md (what the rooms read). No Claude involved.
import fs from 'node:fs';
import path from 'node:path';

const LIMITE = 600;
const LINK = /^https?:\/\/\S+$/i;
const ARROBA = /^@?[A-Za-z0-9._]{1,30}$/;

function texto(dados, chave, faltando) {
  const v = String(dados?.[chave] ?? '').trim();
  if (faltando && !v) throw new Error(faltando);
  if (v.length > LIMITE) throw new Error(`Cada resposta pode ter até ${LIMITE} caracteres.`);
  return v;
}

export function validarPerfil(dados) {
  const nicho = texto(dados, 'nicho', 'Conte sobre o que você fala (o seu nicho).');
  const publico = texto(dados, 'publico', 'Conte pra quem você fala (o seu público).');
  const tom = texto(dados, 'tom', 'Conte como você fala (o seu tom de voz).');
  let arroba = texto(dados, 'arroba', null);
  if (arroba) {
    if (!ARROBA.test(arroba)) throw new Error('O @ do perfil parece errado. Exemplo: @seuperfil');
    if (!arroba.startsWith('@')) arroba = '@' + arroba;
  }
  // Perfis que a pessoa admira: o @ (vira "@perfil") ou o link do perfil.
  const referencias = (Array.isArray(dados?.referencias) ? dados.referencias : []).map(u => String(u ?? '').trim()).filter(Boolean);
  if (referencias.length > 3) throw new Error('No máximo 3 perfis que você admira.');
  if (referencias.some(u => u.length > LIMITE || !(LINK.test(u) || ARROBA.test(u))))
    throw new Error('Os perfis que você admira precisam ser um @ (exemplo: @perfil) ou o link do perfil (começando com http).');
  for (let i = 0; i < referencias.length; i++) if (!LINK.test(referencias[i]) && !referencias[i].startsWith('@')) referencias[i] = '@' + referencias[i];
  return { nicho, publico, tom, arroba, referencias };
}

export function perfilEmTexto(p) {
  return ['# Quem eu sou', '', '## Nicho', p.nicho, '', '## Público', p.publico, '', '## Tom de voz', p.tom, '',
    '## Perfil', p.arroba || '(não informado)', '',
    '## Perfis que eu admiro', ...(p.referencias.length ? p.referencias.map(u => `- ${u}`) : ['(nenhum)']), ''].join('\n');
}

const ler = arq => { try { return fs.readFileSync(arq, 'utf8'); } catch { return null; } };

export function lerCerebro(cerebroDir) {
  let perfil = null; try { perfil = JSON.parse(ler(path.join(cerebroDir, 'perfil.json'))); } catch {}
  const texto_ = ler(path.join(cerebroDir, 'perfil.md'));
  return { perfil, texto: texto_, preenchido: !!(perfil || texto_?.trim()) };
}

function escrever(arq, conteudo) { const tmp = `${arq}.tmp-${process.pid}`; fs.writeFileSync(tmp, conteudo); fs.renameSync(tmp, arq); }

export function salvarPerfil(cerebroDir, dados) {
  const p = validarPerfil(dados);
  fs.mkdirSync(cerebroDir, { recursive: true });
  const md = path.join(cerebroDir, 'perfil.md'), json = path.join(cerebroDir, 'perfil.json');
  // Perfil escrito à mão (antes da entrevista existir): guarda uma cópia antes de trocar, uma vez só.
  if (fs.existsSync(md) && !fs.existsSync(json) && !fs.existsSync(path.join(cerebroDir, 'perfil-antigo.md')))
    fs.copyFileSync(md, path.join(cerebroDir, 'perfil-antigo.md'));
  escrever(json, JSON.stringify(p, null, 2));
  escrever(md, perfilEmTexto(p));
  return p;
}
