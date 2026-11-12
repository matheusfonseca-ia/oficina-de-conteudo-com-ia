// As skills presentes no computador definem o catalogo; o contexto nao libera formatos ausentes.
import fs from 'node:fs';
import path from 'node:path';

export function formatosInstalados(pastaSkills, solicitados) {
  const instalados = fs.readdirSync(pastaSkills, { withFileTypes: true })
    .filter((item) => item.isDirectory()
      && fs.existsSync(path.join(pastaSkills, item.name, 'SKILL.md'))
      && fs.existsSync(path.join(pastaSkills, item.name, 'formato.md')))
    .map((item) => item.name);
  return Array.isArray(solicitados) ? instalados.filter((id) => solicitados.includes(id)) : instalados;
}

export function formatoDaEscolha(escolha, preferencias) {
  if (escolha.caminho === 'repetir-ultimo') return preferencias?.formato || null;
  if (escolha.caminho === 'formato-pronto') return escolha.formato?.id || null;
  return null;
}
