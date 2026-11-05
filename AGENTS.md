# Escritório de Conteúdo — manual pra agentes de código

App local em Node (sem framework de servidor) + cena 3D (three, bundle único em `dist/escritorio.html` via `build.mjs`). Upsell da Máquina de Edição: seis salas de agentes. Etapa 1 ativa: Edição + Postagem semiautomática. O aluno roda no próprio PC com Claude Code.

## Arquitetura
- **A ficha é a fonte de verdade.** Cada vídeo tem uma ficha (`lib/ficha.mjs`, guardada por `lib/fichas-store.mjs` em `~/.escritorio-de-conteudo`). A cena, o painel e os runners só leem/escrevem a ficha. Estado vive nela, nunca em variável solta.
- **Uma sala por limiter.** O `lib/orquestrador.mjs` move a ficha de sala em sala e roda no máximo um trabalho por sala por vez. Salas e cores: `salas.json` (carregado por `lib/salas.mjs`); posições na cena: `src/layout.js`. As posições vão em sentido horário a partir do topo: pesquisa, roteiro, edição, capa, postagem, análise. `npm run check` garante que os dois batem.
- **Contrato de arquivos com a Máquina.** A Edição (`lib/runner-edicao.mjs`, `lib/painel-maquina.mjs`) conversa com a skill `maquina-de-edicao` por arquivos, descritos em `referencias/modo-escritorio.md` da Máquina. O modo escritório vive na branch `modo-escritorio` do repo Básico (ainda não mesclada na main). A checagem de ferramentas (`lib/checagem.mjs`) falha sem esse arquivo.
- **Servidor:** `criarServidor()` em `serve.mjs` NÃO inicia trabalho em segundo plano. Quem inicia é `app.iniciar()`, chamado depois do `listen` (uma segunda instância não pode retomar nada). `lib/checagem.mjs` roda sem shell, porque o cmd.exe não enxerga o PATH quando o servidor sobe pelo Git Bash no Windows.
- **Pacote de vídeo:** `src/movimentos.js` guarda a função pura que decide os movimentos do pacote; `src/pacote.js` a usa.

## Regras
- Todo texto que o aluno vê é pt-BR, simples, sem jargão.
- Só a sala de EDIÇÃO tem terminal (Bash). As outras salas rodam o Claude sem ferramentas de terminal.
- Nenhum teste chama o Claude de verdade: use runners falsos (`runners`, `ESC_CLAUDE_COMMAND`, `ESC_CLAUDE_PREFIX_ARGS`).
- `src/builders.js`, `lib/claude-runner.mjs` e `lib/execution.mjs` são **cópias literais** de `projetos/agents-office` (Oficina de Agentes). Correção feita lá precisa ser copiada aqui à mão, e vice-versa. Não editar só aqui.
- Dados do aluno ficam fora do repo (`ESC_DATA`, padrão `~/.escritorio-de-conteudo`). Nunca gravar dados dentro da pasta do repo.
- Não adicionar opções só para teste nos instaladores (`instalar.sh`, `instalar.ps1`). Eles escrevem `instalacao.json` (`pasta`, `versao`) que a skill `/escritorio` lê.

## Laço de verificação
```
npm test && npm run build && npm run check && npm run fumaca
```
No Windows, rode o `npm` pelo PowerShell: sob o Git Bash o cmd.exe não acha o `node`.
