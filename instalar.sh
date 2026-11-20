#!/usr/bin/env bash
# Instalador da Oficina de Conteúdo (Mac/Linux). Rode de dentro da pasta baixada: bash instalar.sh
set -euo pipefail
pasta="$(cd "$(dirname "$0")" && pwd)"
dados="${OFC_DATA:-$HOME/.oficina-de-conteudo}"
skills="$HOME/.claude/skills"

[ -f "$skills/maquina-de-edicao/SKILL.md" ] || { echo "Instale primeiro a Máquina de Edição com IA Básico."; exit 1; }
command -v node >/dev/null || { echo "Falta o Node.js 22.13 ou mais novo: brew install node"; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || { echo "Seu Node é antigo. Precisa da versão 22.13 ou mais nova."; exit 1; }
# Sem o Claude Code, a Oficina também roda com o Codex ou o OpenCode (escolha em config.json: "motor").
command -v claude >/dev/null || command -v codex >/dev/null || command -v opencode >/dev/null || { echo "Falta um agente: instale o Claude Code, o Codex ou o OpenCode e faça login antes."; exit 1; }

cd "$pasta"
npm install --no-audit --no-fund
node build.mjs
# A Edição usa o HyperFrames pelo npx. A Máquina só baixa ele na primeira edição; a Oficina baixa aqui,
# senão a checagem (que não instala nada) acusa que falta.
echo "Baixando o HyperFrames (só demora na primeira vez)..."
npx --yes hyperframes --version >/dev/null || { echo "Não deu pra baixar o HyperFrames. Confira a internet e rode o instalador de novo."; exit 1; }

mkdir -p "$dados"
versao="$(node -p 'require("./package.json").version')"
printf '{ "pasta": %s, "versao": "%s" }\n' "$(node -p 'JSON.stringify(process.argv[1])' "$pasta")" "$versao" > "$dados/instalacao.json"

# A skill /oficina-de-conteudo e o motor de edição da Oficina (cópia própria da Máquina com o modo escritório).
backup="$HOME/.claude/skills-backup/$(date +%Y-%m-%d_%H-%M-%S)-$$"
mkdir -p "$skills"
for item in "skill/oficina-de-conteudo:oficina-de-conteudo" "motor/oficina-de-conteudo-motor:oficina-de-conteudo-motor"; do
  origem="${item%%:*}"; nome="${item##*:}"
  if [ -d "$skills/$nome" ]; then mkdir -p "$backup"; mv "$skills/$nome" "$backup/"; fi
  cp -R "$pasta/$origem" "$skills/$nome"
done
# O Codex lê as skills de ~/.agents/skills: a skill que abre a Oficina vai pra lá também (o motor não, ele é chamado pelo caminho).
agentes="$HOME/.agents/skills"
mkdir -p "$agentes"
if [ -d "$agentes/oficina-de-conteudo" ]; then mkdir -p "$HOME/.agents/skills-backup/$(basename "$backup")"; mv "$agentes/oficina-de-conteudo" "$HOME/.agents/skills-backup/$(basename "$backup")/"; fi
cp -R "$pasta/skill/oficina-de-conteudo" "$agentes/oficina-de-conteudo"

echo "Pronto! Feche e abra o Claude Code e chame /oficina-de-conteudo (ou rode: npm start, nesta pasta)."
command -v claude >/dev/null || echo "Sem o Claude Code: abra com \"npm start\" nesta pasta e escolha o agente em $dados/config.json, com \"motor\": \"codex\" ou \"motor\": \"opencode\"."
