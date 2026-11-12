#!/usr/bin/env bash
# Instalador da Oficina de Conteúdo (Mac/Linux). Rode de dentro da pasta baixada: bash instalar.sh
set -euo pipefail
pasta="$(cd "$(dirname "$0")" && pwd)"
dados="${OFC_DATA:-$HOME/.oficina-de-conteudo}"
skills="$HOME/.claude/skills"

[ -f "$skills/maquina-de-edicao/SKILL.md" ] || { echo "Instale primeiro a Máquina de Edição com IA Básico."; exit 1; }
[ -f "$skills/maquina-de-edicao/referencias/modo-escritorio.md" ] || { echo "Atualize a Máquina de Edição (git pull na pasta do Básico e rode o instalador dele de novo)."; exit 1; }
command -v node >/dev/null || { echo "Falta o Node.js 22.13 ou mais novo: brew install node"; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || { echo "Seu Node é antigo. Precisa da versão 22.13 ou mais nova."; exit 1; }
command -v claude >/dev/null || { echo "Falta o Claude Code. Instale e faça login antes."; exit 1; }

cd "$pasta"
npm install --no-audit --no-fund
node build.mjs

mkdir -p "$dados"
versao="$(node -p 'require("./package.json").version')"
printf '{ "pasta": %s, "versao": "%s" }\n' "$(node -p 'JSON.stringify(process.argv[1])' "$pasta")" "$versao" > "$dados/instalacao.json"

if [ -d "$skills/oficina-de-conteudo" ]; then
  backup="$HOME/.claude/skills-backup/$(date +%Y-%m-%d_%H-%M-%S)-$$"; mkdir -p "$backup"; mv "$skills/oficina-de-conteudo" "$backup/"
fi
mkdir -p "$skills"; cp -R "$pasta/skill/oficina-de-conteudo" "$skills/oficina-de-conteudo"

echo "Pronto! Feche e abra o Claude Code e chame /oficina-de-conteudo (ou rode: npm start, nesta pasta)."
