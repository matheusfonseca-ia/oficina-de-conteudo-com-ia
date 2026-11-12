# Instalador da Oficina de Conteúdo (Windows). Rode de dentro da pasta baixada:
#   powershell -ExecutionPolicy Bypass -File .\instalar.ps1
$ErrorActionPreference = 'Stop'
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$dados = if ($env:OFC_DATA) { $env:OFC_DATA } else { Join-Path $HOME '.oficina-de-conteudo' }
$skills = Join-Path $HOME '.claude\skills'

if (-not (Test-Path (Join-Path $skills 'maquina-de-edicao\SKILL.md'))) { Write-Host 'Instale primeiro a Máquina de Edição com IA Básico.'; exit 1 }
if (-not (Test-Path (Join-Path $skills 'maquina-de-edicao\referencias\modo-escritorio.md'))) { Write-Host 'Atualize a Máquina de Edição (git pull na pasta do Básico e rode o instalador dele de novo).'; exit 1 }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Falta o Node.js 22.13 ou mais novo: winget install OpenJS.NodeJS.LTS'; exit 1 }
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if ($LASTEXITCODE -ne 0) { Write-Host 'Seu Node é antigo. Precisa da versão 22.13 ou mais nova.'; exit 1 }
# A Oficina chama o claude sem shell: só o claude.exe do instalador oficial funciona (o claude.cmd do npm não).
$claudeExe = Get-Command claude -CommandType Application -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -like '*.exe' } | Select-Object -First 1
if (-not $claudeExe) { Write-Host 'A Oficina precisa do Claude Code instalado pelo instalador oficial (claude.exe). Instale em https://claude.com/claude-code e faça login.'; exit 1 }

Push-Location $pasta
try {
  npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm install falhou' }
  node build.mjs; if ($LASTEXITCODE -ne 0) { throw 'build falhou' }
  New-Item -ItemType Directory -Force $dados | Out-Null
  $versao = node -p "require('./package.json').version"
  $json = @{ pasta = $pasta; versao = $versao } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $dados 'instalacao.json'), $json, (New-Object System.Text.UTF8Encoding $false))
  $destino = Join-Path $skills 'oficina-de-conteudo'
  if (Test-Path $destino) {
    $backup = Join-Path $HOME (".claude\skills-backup\" + (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss') + "-$PID")
    New-Item -ItemType Directory -Force $backup | Out-Null; Move-Item $destino $backup
  }
  New-Item -ItemType Directory -Force $skills | Out-Null
  Copy-Item -Recurse (Join-Path $pasta 'skill\oficina-de-conteudo') $destino
} finally { Pop-Location }
Write-Host 'Pronto! Feche e abra o Claude Code e chame /oficina-de-conteudo (ou rode: npm start, nesta pasta).'
