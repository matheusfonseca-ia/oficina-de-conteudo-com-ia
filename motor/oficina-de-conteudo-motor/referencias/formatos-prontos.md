# Formatos prontos

Catálogo de 20 formatos, dividido entre dez da oferta principal e dez do complemento (order bump). O formato é a estrutura do vídeo: layouts, posições, ritmo e o que aparece em cada momento. Cada um é uma skill própria; depois de instalado, fica ao lado desta (`<pasta de skills>/<nome-do-formato>/`), com a especificação completa em `formato.md`.

**Oferta principal:** Reels de Negócio, Tela Dividida Explicativa, Legenda Encaixada, Telas em Profundidade, Cortes de Vídeo Longo, YouTube Educativo, Formato Ranking, Zoom na Palavra, Widgets de Vidro e Cards em Órbita.

**Complemento:** Reels com B-roll, Ensaio Visual, Nuvem de Imagens, Recorte com Imagens, Aula em Tela Dividida, Palavra Atrás da Cabeça, Checklist na Tela, Marcações, Capa de Revista e Grade do Perfil.

**Formatos de efeito:** Palavra Atrás da Cabeça, Checklist na Tela, Zoom na Palavra, Marcações, Widgets de Vidro, Cards em Órbita, Capa de Revista e Grade do Perfil aplicam efeitos direto na imagem da câmera com o `fx.py` original do claude-video-effects. Além do `formato.md`, eles seguem `efeitos-de-video.md`.

Depois do formato, a pessoa escolhe o **estilo visual** (a aparência). Ver `estilos-visuais.md`.

A pasta de skills é a pasta-mãe da pasta desta skill. Exemplo: se esta skill está em `~/.claude/skills/maquina-de-edicao/`, o formato Reels de Negócio está em `~/.claude/skills/reels-de-negocio/formato.md`.

## Catálogo

Use esta lista na pergunta de formato da fase 1, filtrando primeiro pelas skills instaladas ao lado do motor. Mostre o número, o nome e a descrição curta, e só os formatos que combinam com a orientação da gravação: gravação vertical → os verticais, sem o Cortes de Vídeo Longo; gravação horizontal → os horizontais e o Cortes de Vídeo Longo. Se nenhum instalado combinar, ofereça o caminho Do zero, que segue a orientação da gravação.

### Vertical 9:16 (Reels, TikTok, Shorts)

| # | Nome | Pasta | Descrição curta |
|---|---|---|---|
| 1 | Reels de Negócio | `reels-de-negocio` | Alterna câmera cheia, tela dividida e animação em tela cheia a cada corte |
| 2 | Reels com B-roll | `reels-com-broll` | Corte rápido, clipes de apoio (seus ou buscados na internet) e frases-chave empilhadas na legenda |
| 3 | Tela Dividida Explicativa | `tela-dividida-explicativa` | Você embaixo e a explicação em cima, com cards, contadores e gráficos que se desenham |
| 4 | Ensaio Visual | `ensaio-visual` | Você recortado e as provas (posts, notícias, números) aparecendo acima de você |
| 5 | Legenda Encaixada | `legenda-encaixada` | Uma palavra gigante em destaque e o resto da frase encaixado em volta |
| 6 | Nuvem de Imagens | `nuvem-de-imagens` | Grupos de imagens acima da sua cabeça e legenda pequena e discreta |
| 7 | Recorte com Imagens | `recorte-com-imagens` | Você recortado na frente de imagens em tela cheia que trocam a cada ideia |
| 8 | Telas em Profundidade | `telas-em-profundidade` | Você em tela cheia com interfaces e telas reais atrás da sua cabeça |
| 9 | Formato Ranking | `formato-ranking` | Tier list que vai se preenchendo conforme você ranqueia |
| 10 | Palavra Atrás da Cabeça | `palavra-atras-da-cabeca` | Uma palavra gigante cai atrás da sua cabeça nas palavras mais fortes |
| 11 | Checklist na Tela | `checklist-na-tela` | A lista do que você fala aparece e cada item ganha ✓ na hora certa |
| 12 | Zoom na Palavra | `zoom-na-palavra` | Aproximação rápida nas palavras fortes e mira travando no seu rosto |
| 13 | Marcações | `marcacoes` | Imagem congela com seta à mão, fita no peito, caixa que aumenta o número |
| 14 | Widgets de Vidro | `widgets-de-vidro` | Widgets de vidro em volta da cabeça e gráficos de vidro subindo |
| 15 | Cards em Órbita | `cards-em-orbita` | Seus posts girando em volta da cabeça, em carrossel 3D ou em leque |
| 16 | Capa de Revista | `capa-de-revista` | Você vira capa de revista e as frases fortes viram colagem vermelha |
| 17 | Grade do Perfil | `grade-do-perfil` | Você no centro da grade do perfil, com os reels e as visualizações em volta |
| 18 | Cortes de Vídeo Longo | `cortes-de-video-longo` | Entra um vídeo longo ou uma call, saem cortes verticais ranqueados |

### Horizontal 16:9 (YouTube)

| # | Nome | Pasta | Descrição curta |
|---|---|---|---|
| 19 | YouTube Educativo | `youtube-educativo` | Vídeo longo com cards sobre a câmera, tela dividida e animações explicativas |
| 20 | Aula em Tela Dividida | `aula-em-tela-dividida` | O documento da aula rola na esquerda e você fica na direita; o documento é gerado junto |

Se a pasta de um formato não existir com `SKILL.md` e `formato.md`, não ofereça esse formato. A ausência dos extras é esperada na oferta principal: não trate como instalação incompleta nem mande reinstalar o principal para obter os 20. Se a pessoa pedir um extra ausente, explique que ele pertence ao complemento e precisa ser instalado pelo pacote correspondente.

---

## Como um formato pronto se aplica

Um formato pronto é uma camada por cima de `instrucoes-base.md`. Ele não repete o que é comum a todos os vídeos. Ele só diz o que muda.

### O que continua valendo sempre (do motor)

- Bloco 0 (ambiente, autonomia, instalação local, nunca exportar sem aprovação).
- Bloco 1 (sincronização e transcrição) e bloco 2 (seleção de tomadas, limpeza, silêncios, J cut, END).
- Bloco 7 (áudio), na estrutura: os quatro stems, a voz a −14 LUFS, os efeitos sincronizados com eventos visuais e o master. O clima da música e o timbre dos efeitos vêm do estilo visual (ou do formato, no Original do formato). **Quantidade e volume dos efeitos seguem sempre o padrão universal do bloco 7** (poucos efeitos, só nos eventos fortes, no máximo 1 a cada 0,6 s, bem abaixo da voz), mesmo quando o `formato.md` descreve mais efeitos ou outro nível em dB.
- Bloco 8 (montagem, prévia, render), bloco 9 (verificação) e RELATÓRIO.
- `variacoes.md`, seções "Gravação vertical na saída vertical" e "Sem áudio separado", quando valerem pela fase 0.
- As fases 3, 4 e 5 da skill (Studio, aprovação, exportação, preferências).

### O que o formato substitui

O `formato.md` de cada formato segue sempre as mesmas seções. Cada uma vale por cima do motor:

| Seção do formato | Substitui no motor |
|---|---|
| Escolhas que este formato já define | As perguntas da entrevista que deixam de ser feitas |
| Base técnica | Diz quais blocos marcados [IMAGENS+] e [COMPLETO] continuam valendo (contato visual, câmera virtual, desfoque de movimento etc.) |
| Entradas extras | O que mais precisa estar na pasta (clipes, imagens) e o que fazer se faltar |
| Ritmo e corte | Acrescenta regras ao bloco 2 (nunca remove as regras de limpeza) |
| Layouts | Substitui o bloco 4 inteiro (os layouts e as regras de distribuição) |
| Direção visual | Substitui "Direção visual" e "Tipografia e cores" do bloco 5 (**só no Original do formato**; com outro estilo visual, vale o estilo) |
| Gráficos | Substitui o resto do bloco 5 (o que aparece em cada trecho e como anima) |
| Legendas | Substitui "Legendas" do bloco 6 (posição e mecânica sempre; aparência só no Original do formato) |
| Capa e gancho | Substitui "Capa" do bloco 6 |
| Chamada para ação | Substitui "Cartão de chamada para ação" do bloco 6 |
| Áudio | Ajusta o bloco 7 (no Original do formato; com outro estilo visual, a música e os efeitos vêm do estilo) |
| Saída | Substitui resolução, fps e nomes de arquivo das ENTREGAS |
| Verificação do formato | Acrescenta itens às verificações 9A e 9B |
| Fluxo diferente (opcional) | Vale por cima das fases da skill. Só existe nos formatos que mudam o fluxo (ex: Cortes de Vídeo Longo gera vários vídeos) |

Regras de prioridade, da mais forte pra mais fraca:

1. Pedidos da pessoa na revisão (fase 3) e as observações que ela mandou (painel ou chat).
2. Ajustes fixos das preferências salvas, se a pessoa escolheu usá-los.
3. O estilo visual, no que é aparência (ver `estilos-visuais.md`).
4. O `formato.md`.
5. `variacoes.md`.
6. `instrucoes-base.md`.

### Marca da pessoa

Se as preferências salvas tiverem cor de marca, ou se a pessoa pedir, troque só a **cor de destaque** (do estilo visual ou do formato) pela cor da marca, mantendo o contraste mínimo de 4,5:1 sobre o fundo onde ela aparece. Fundo, tipografia e layout continuam.

### Imagens, logos e interfaces

Vários formatos mostram imagens a cada ideia. Ordem de origem, da melhor pra pior:

1. Arquivos que a pessoa colocou na pasta `imagens/` do projeto, inclusive os que ela subiu pelo painel (`imagensEnviadas` no `edit/escolhas.json`). O nome do arquivo ajuda a casar com a fala. São opcionais: sem eles, siga a ordem abaixo.
2. Coisas reais citadas na fala: logo oficial, página do produto, post, notícia (captura com `npx hyperframes capture` ou navegador).
3. Imagem buscada em qualquer lugar da internet (busca de imagens, site da fonte, notícia) ou gerada pela skill `media-use` do HyperFrames: veja `broll-da-internet.md`.
4. Último recurso: card gráfico no estilo (ícone, número ou palavra-chave sobre o fundo do estilo).

Nunca invente dado, print de conversa, depoimento ou número que não está na fala. Registre a origem de cada imagem no relatório.

### Clipes de apoio (B-roll)

Formatos com B-roll usam a pasta `broll/` da pessoa (que ela pode ter subido pelo painel) e, sem ela, clipes buscados em qualquer lugar da internet: veja `broll-da-internet.md`.
