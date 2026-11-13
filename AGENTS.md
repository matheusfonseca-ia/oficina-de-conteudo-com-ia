# Oficina de Conteúdo com IA — manual pra agentes de código

Nome comercial: **Oficina de Conteúdo com IA** (antes "Escritório de Conteúdo", trocado em 12/11/2026). Produto separado da Máquina de Edição, vendido como upsell dela (R$ 147, downsell R$ 97). Não confundir com a **Oficina de Agentes** (`projetos/agents-office/`), outro produto, de onde vem o visual 3D.

App local em Node (sem framework de servidor) + cena 3D (three, bundle único em `dist/oficina.html` via `build.mjs`). Upsell da Máquina de Edição: seis salas de agentes. Etapa 2 ativa: Pesquisa (web), Roteiro, Edição e Postagem semiautomática; Cérebro com entrevista e aprendizados. O aluno roda no próprio PC com Claude Code.

## Arquitetura
- **A ficha é a fonte de verdade.** Cada vídeo tem uma ficha (`lib/ficha.mjs`, guardada por `lib/fichas-store.mjs` em `~/.oficina-de-conteudo`). A cena, o painel e os runners só leem/escrevem a ficha. Estado vive nela, nunca em variável solta.
- **Uma sala por limiter.** O `lib/orquestrador.mjs` move a ficha de sala em sala e roda no máximo um trabalho por sala por vez. Salas e cores: `salas.json` (carregado por `lib/salas.mjs`); posições na cena: `src/layout.js`, com as mesmas ilhas (posição e tamanho) da Oficina de Agentes. As posições vão em sentido horário a partir do topo: pesquisa, roteiro, edição, capa, postagem, análise. `npm run check` garante que os dois batem.
- **Motor de edição próprio.** A Edição (`lib/runner-edicao.mjs`, `lib/painel-maquina.mjs`) não usa a skill `maquina-de-edicao` do aluno: usa a cópia em `motor/oficina-de-conteudo-motor/`, que o instalador põe em `~/.claude/skills/oficina-de-conteudo-motor/` (ao lado das skills de formato, e é assim que o painel acha os formatos). É o motor do Básico com o **modo escritório**, que só existe aqui: o Básico publicado não tem nada da Oficina. A conversa é por arquivos (`edit/escritorio.json`, `edit/estado.json`), descrita em `motor/oficina-de-conteudo-motor/referencias/modo-escritorio.md`. Origem, o que muda na cópia e como trazer melhorias do Básico: `motor/ORIGEM.md`. Do Básico instalado a Oficina só usa os formatos, o earshot e o ambiente dos efeitos. Não usar `disable-model-invocation` no motor: com ele o `claude -p "/oficina-de-conteudo-motor ..."` não roda a skill.
- **Servidor:** `criarServidor()` em `serve.mjs` NÃO inicia trabalho em segundo plano. Quem inicia é `app.iniciar()`, chamado depois do `listen` (uma segunda instância não pode retomar nada). `lib/checagem.mjs` roda sem shell, porque o cmd.exe não enxerga o PATH quando o servidor sobe pelo Git Bash no Windows.
- **Fechamento:** `app.fechar()` chama `orquestrador.pararTudo()`, que aborta cada trabalho (um `AbortController` por ficha, repassado aos runners) e espera o Claude filho morrer. Trabalho abortado assim não marca erro: a ficha fica na etapa de trabalho e o `retomar()` da próxima abertura continua.
- **Claude filho:** os runners rodam com `--settings '{"disableAllHooks":true}'` e sem `CLAUDECODE` no ambiente (`ambienteFilho()` em `lib/runner-edicao.mjs`). No Windows só o `claude.exe` do instalador oficial funciona (o servidor chama sem shell); a checagem e o `instalar.ps1` conferem isso.
- **Salas sem terminal:** Pesquisa (só `WebSearch,WebFetch`), Roteiro e Postagem rodam pelo `lib/runner-sala.mjs` (um `claude -p` sem sessão, sem MCP, sem hooks, resposta em JSON validada no runner de cada sala). O Cérebro (`lib/cerebro.mjs`) é um formulário, sem Claude; os ajustes pedidos viram linhas em `cerebro/aprendizados/<sala>.md` (`lib/aprendizados.mjs`).
- **Pacote de vídeo:** `src/movimentos.js` guarda a função pura que decide os movimentos do pacote; `src/pacote.js` a usa. Não há anel: o pacote sai pela passarela da sala, passa pelo Cérebro e entra pela passarela da próxima.
- **Cena = Oficina de Agentes, só no modo escuro.** Câmera, visão geral, zoom (roda, botões, teclas), arrastar, foco numa sala (voo com arco, as outras escurecem, vinheta), cartões das salas e nomes dos robôs vêm do `src/main.js` da Oficina de Agentes, com as mesmas funções e números. O centro é próprio (`src/chefe.js`): ilha redonda, domo de rede neural e a mesa do chefe virada pra câmera. A Oficina de Conteúdo não tem modo claro: `setDark()` roda na abertura e o `shell.html` só tem os tokens escuros.

## Regras
- Todo texto que o aluno vê é pt-BR, simples, sem jargão.
- Só a sala de EDIÇÃO tem terminal (Bash). As outras salas rodam o Claude sem ferramentas de terminal. A Pesquisa tem só busca e leitura de páginas da web.
- Nenhum teste chama o Claude de verdade: use runners falsos (`runners`, `OFC_CLAUDE_COMMAND`, `OFC_CLAUDE_PREFIX_ARGS`).
- `src/builders.js`, `src/leds.js`, `lib/claude-runner.mjs` e `lib/execution.mjs` são **cópias literais** de `projetos/agents-office` (Oficina de Agentes). Correção feita lá precisa ser copiada aqui à mão, e vice-versa. Não editar só aqui.
- Dados do aluno ficam fora do repo (`OFC_DATA`, padrão `~/.oficina-de-conteudo`). Nunca gravar dados dentro da pasta do repo.
- Não adicionar opções só para teste nos instaladores (`instalar.sh`, `instalar.ps1`). Eles escrevem `instalacao.json` (`pasta`, `versao`) que a skill `/oficina-de-conteudo` lê.

## Laço de verificação
```
npm test && npm run build && npm run check && npm run fumaca
```
No Windows, rode o `npm` pelo PowerShell: sob o Git Bash o cmd.exe não acha o `node`.
