# Pixelado

Resumo: fundo creme quadriculado, cards claros, legenda em pílula escura com letra de máquina em caixa alta, mascote e cenas em pixel art de videogame nos momentos de clímax.

Combina com: todos. Fica melhor em Reels de Negócio, Tela Dividida Explicativa, Formato Ranking e Cortes de Vídeo Longo.

## A ideia

Visual de "caderno de ideias + videogame": tudo é claro, limpo e com cara de papel quadriculado, e nos momentos mais fortes do vídeo a tela vira uma cena de jogo em pixel art (arena, cemitério, corrida, chefão), com HUD de jogo. Os gráficos ilustram a frase ao pé da letra: "respostas ruins" vira um cemitério de lápides, "faz 100 versões" vira um personagem se multiplicando até uma grade de 100.

**Cada frase falada vira uma pequena cena que mostra literalmente o que está sendo dito.** Não existe cartão genérico com ícone e título: o gráfico sempre conta a frase. Antes de construir, escreva em `edit/plano.md` uma tabela "frase → metáfora visual" pro vídeo inteiro, escolhendo cada cena do repertório de motions abaixo. Se não achar metáfora pra uma frase, use a peça real (print da página, terminal, chat) com uma ação em cima (cursor, risco, contorno, carimbo).

O formato continua mandando na estrutura (onde ficam a câmera, os gráficos e a legenda, e quanto tempo dura cada layout). O Pixelado manda no que aparece dentro das áreas gráficas e em como isso se mexe.

**Exceção: Reels de Negócio.** Com o Reels de Negócio, o Pixelado vira o formato completo do estilo Opus Jake (dividido com a câmera embaixo, gráfico cheio e pixel art cheia, sem câmera cheia, legenda em pílula fixa na emenda): siga `reels-de-negocio/com-pixelado.md`, que manda por cima deste arquivo e do `formato.md`.

## Papéis

| Papel | Valor |
|---|---|
| Fundo das telas gráficas | creme `#EFEDEB` liso |
| Textura do fundo | grade quadriculada bem fraca: linhas de 1,5 px a cada 90 px, cor `#E6E4E1` |
| Card | `#F9F8F6`, raio 28 px, sombra `0 18px 40px rgba(0,0,0,0.10)`, sem borda |
| Card ativo | borda 3 px terracota `#D97757` + etiqueta mono terracota no canto |
| Cor de destaque | terracota `#D97757` |
| Destaque em texto | terracota escuro `#C15F3C` |
| Fundo de etiqueta | terracota claro `#F6E3DA` |
| Texto principal / secundário | `#1A1A1A` / `#8A8783` |
| Cores de status | verde carimbo `#2DA44E` / vermelho anotação `#C8102E` |
| Dourado (HUD, prêmio, número de placar) | `#E8B547` |
| Escuro (terminal, HUD) | `#151513` |
| Fonte de títulos | Inter 800 |
| Fonte de texto | Newsreader 400 (serifa; texto de chat, e-mail, frases) |
| Fonte de rótulos, etiquetas e números pequenos | JetBrains Mono 700 |
| Fonte da palavra de destaque | Inter 900 em terracota (sem serifa itálica) |
| Fonte de números grandes | Inter 900 |
| Fonte de jogo (HUD, etiquetas em pixel, placar) | Silkscreen 400/700 (ou Pixelify Sans) |

Todas do Google Fonts, baixadas pra dentro do projeto.

Quando o formato pede fundo escuro (ex: tela C do Reels de Negócio, Tela Dividida Explicativa), troque pelo creme quadriculado. O brilho laranja do Kit Noite não existe neste estilo.

## Legenda

- **Pílula escura** `#3A3836` com 92% de opacidade, raio 12 px, altura ~86 px (proporcional ao tamanho da fonte do formato), folga lateral 34 px. A largura acompanha o texto.
- Texto em **JetBrains Mono 800, caixa alta**, branco, `letter-spacing: 0.08em`, ~85% do tamanho de legenda do formato.
- **Sem cor de destaque, sem palavra por palavra, sem animação de entrada**: troca seca a cada bloco.
- Mantém apóstrofo e interrogação. Sem ponto final.
- Posição: a do formato. Nos layouts divididos, a pílula fica **em cima da emenda** (metade sobre o gráfico, metade sobre a câmera).
- Formatos com legenda especial:
  - Legenda Encaixada: palavras pequenas em JetBrains Mono 800 caixa alta branca com sombra (sem pílula); a palavra encaixada em **Silkscreen 700**, terracota, com sombra dura de 6 px `#151513` (sem desfoque), como letreiro de jogo. A Silkscreen é bem mais larga que a serifa do formato: o tamanho é o maior que deixa a palavra inteira dentro de 960 px de largura (normalmente 100 a 150 px, nunca os 200 px do formato).
  - Reels com B-roll (frase empilhada): linha de cima em mono caixa alta; palavra branca em Inter 900; palavra de destaque em Silkscreen 700 terracota com sombra dura. A linha de baixo inteira (palavra branca + palavra em Silkscreen) cabe em 920 px: reduza as duas juntas até caber.
  - Formato Ranking: legenda em pílula escura (como acima); nome do item no card em Silkscreen 700 dourado `#E8B547` com contorno `#151513`.

## Título de gancho e capa

- Se o formato tem título: Inter 800 `#1A1A1A` dentro de um card creme `#F9F8F6` com borda 3 px `#151513` e sombra dura `6px 6px 0 #151513` (cara de botão de jogo). A palavra mais forte em terracota.
- Se o formato não tem título: o quadro 0 mostra a cena mais estranha do vídeo (ex: cemitério em pixel art com a primeira legenda).

## Gráficos (como os elementos do formato ficam neste estilo)

- **Cards de passo / lista**: card claro com etiqueta mono terracota em pílula `#F6E3DA` ("PASSO 01"), título em Inter 800, diagrama simples dentro.
- **Notificações**: cards claros com borda 2 px `#151513` e sombra dura `4px 4px 0 #151513`.
- **Contadores**: número em Inter 900 `#1A1A1A`, prefixo "×" ou unidade em terracota. Placar de jogo (vidas, pontos, rodada) em Silkscreen dentro de caixa `#151513` com número dourado.
- **Gráfico de linha**: traço de 6 px terracota em degraus (escada de pixels, não curva suave).
- **Grade de dias**: quadrados de 48 px sem raio, borda 2 px `#151513`, preenchidos em terracota; cada quadrado preenchido ganha um ✓ em pixel.
- **Telas e interfaces reais**: dentro de card claro com sombra; terminal em `#151513` com raio 18 px, texto mono, cursor de bloco.
- **Carimbo**: palavra em Inter 900 dentro de retângulo com borda 6 px, girado −8 a −12°, entra grande (escala 1,6 → 1) com tremida curta. Verde pra coisa boa ("GRÁTIS", "FUNCIONA"), terracota vazado pra repetição ("IGUAL ×100").
- **Anotação à mão** em vermelho `#C8102E`: risco atravessando, círculo desenhado em volta, palavra manuscrita inclinada. Traço desenhado em 0,3 s (stroke-dashoffset). Fonte manuscrita: Caveat 700.
- **Tier list** (Formato Ranking): moldura do quadro em `#151513` com sombra dura; fileiras creme; rótulos S–F com as cores do formato, letras em Silkscreen.
- **Documento da aula** (Aula em Tela Dividida): o documento fica igual (branco), mas títulos em Inter 800, etiquetas de passo em mono terracota, diagramas com caixas de borda `#151513` e sombra dura.

## Elementos de assinatura

### Mascote em pixel art

Um personagem simples em blocos (16 × 16 "pixels" ampliados, cada pixel com 12–16 px), terracota com olhos pretos quadrados. Representa a pessoa, o produto ou "o agente". Ganha acessórios em pixel conforme a cena (espada, escudo, coroa, troféu, notebook). Variações coloridas (azul `#4A90D9`, rosa `#E86AA6`, verde `#4CAF50`, roxo `#8E5BD9`, amarelo `#E8B547`) representam vários personagens. Faça em SVG com `<rect>` (`shape-rendering: crispEdges`). Se o vídeo for sobre um produto com mascote próprio, use um mascote pixel genérico ligado ao tema, não o personagem de outra marca.

### Cena pixel art em tela cheia (clímax)

- 1 ou 2 por vídeo, de 3 a 6 s, no momento mais forte (a virada, o resultado, a briga, a comparação).
- Cenário em pixel art preenchendo a tela: gere o fundo com a skill `media-use` (modelo de imagem, pedindo "pixel art, 16-bit, side view, <cenário>") e redimensione com `nearest neighbor` (nunca suavizado). Sem gerador, monte um cenário em blocos (céu, chão, paredes) em SVG.
- Personagens em sprite andando, se multiplicando, se enfrentando, caindo (perdedor fica cinza com olhos em "×").
- HUD em Silkscreen dentro de caixas `#151513` com borda `#3A3836`: rodada, contador descendo, "VENCEDOR" com confete em pixel.
- Legenda continua na posição do formato.
- Onde entra em cada formato: no layout de animação em tela cheia, se o formato tiver; se não tiver, como insert curto em tela cheia por cima da câmera (corte seco de entrada e de saída, numa fronteira de palavra).

### Em formatos com pouco gráfico

Legenda Encaixada, Reels com B-roll, Nuvem de Imagens e Recorte com Imagens ganham:

- a legenda e a tipografia deste estilo;
- 1 cena pixel art em tela cheia no clímax (como acima);
- na Nuvem de Imagens, as imagens ganham moldura de 4 px `#151513` com sombra dura e, a cada 3 grupos, um dos itens é um sprite pixel em vez de foto;
- no Recorte com Imagens, uma das imagens de fundo (a do clímax) é um cenário pixel art com a pessoa recortada dentro.

## Repertório de motions

As cenas que o Pixelado usa dentro das áreas gráficas do formato. Escolha pela frase (tabela "frase → metáfora visual"); a mesma peça pode voltar com outro conteúdo.

- **Multiplicação com contador**: um personagem no centro se divide em vários, em cascata, até uma grade (10 × 10), com contador "×1 → ×51 → ×100" embaixo ("×" em terracota, número em Inter 900 ~70 px). Pra "faz várias versões", "escala", "um time inteiro".
- **Cartão de produto**: ilustração à esquerda (mascote sobre um montinho de terra ou areia), à direita etiqueta mono terracota em pílula `#F6E3DA` ("/nome") e o nome do produto em Inter 800 ~90 px sendo digitado, com a descrição curta em cinza embaixo. Pra apresentar a ferramenta.
- **Print real** (site, GitHub, documentação) dentro de cartão branco com sombra, capturado com `npx hyperframes capture`. Às vezes o print encolhe e sobe pra dar lugar ao próximo elemento.
- **Carimbo**: palavra em Inter 900 dentro de retângulo com borda, girado −8 a −12°, entra grande (escala 1,6 → 1) com tremida curta. Verde pra coisa boa ("GRÁTIS" sobre o print), terracota vazado pra repetição ("IGUAL ×100" sobre um cartão).
- **Terminal** escuro (`#151513`, raio 18, três bolinhas no topo): comando digitado letra a letra com autocompletar em terracota; depois uma lista de tarefas rodando (árvore com ├─, ids coloridos, "rodando" → "pronto").
- **Chat**: cartão creme com texto em Newsreader e barra de ações embaixo; os pedidos da pessoa em bolha cinza à direita ("tenta de novo", "ainda genérico. de novo") e respostas ruins se empilhando.
- **Anotação à mão em vermelho** `#C8102E`: risco atravessando clichês, elipse desenhada em volta de uma expressão, palavra manuscrita inclinada em Caveat ("*genérico.*") entrando na hora. Traço desenhado em ~0,3 s (stroke-dashoffset).
- **Cartão de tarefa**: etiqueta "TAREFA" mono terracota, a frase em serifa ~60 px e, à direita, "enviada pra **0** / 100" com o número subindo.
- **Personagens cercando um cartão**: sprites dos dois lados com rastro pontilhado colorido vindo de fora até o cartão central.
- **Três mini cartões lado a lado**: cabeçalho mono e um diagrama simples que se anima (barras empilhando, lista de ✓ e ✕, curva em degraus sendo desenhada).
- **Linha de etapas**: chips "Rascunho → Crítica → Reescrita" acendendo em sequência, com fundo pastel.
- **Cartas de baralho**: verso escuro que vira e revela a frente colorida com um título; três cartas em leque.
- **Etiquetas de crítica em pixel**: caixas brancas com borda preta e "✕ GENÉRICO", "✕ SEM PROVA" em Silkscreen sobre os personagens. O perdedor fica cinza com olhos em "×" e cai.
- **Cronômetro**: chip "⏱ TEMPO PERDIDO" com contador mono vermelho correndo (00:51 → 47:12) sobre uma pilha de cartões; no fim, um traço vermelho grosso risca a pilha.
- **Fluxo de instalação**: o print do repositório encolhe pro topo, uma seta terracota desce até um chat escuro onde o link e depois "instala a skill" são digitados; o campo ganha contorno terracota.
- **Duelo e vencedor** (na cena pixel art): HUD "RODADA 1 · 50 DUELOS", contador dourado descendo (100 → 25 → 13 → 7 → 4), personagens se atacando e caindo, e no fim "VENCEDOR" com coroa e confete em pixel.

### Chamada pra ação

Cartão com duas linhas numeradas por círculos terracota: (1) foto de perfil com anel de story, "Seguir" em Inter 700 e o @perfil, com um botão azul "Seguir" que vira "Seguindo" cinza; (2) "Comenta" e um campo onde a palavra-chave é digitada em caixa alta, que ganha contorno terracota. Embaixo, pequeno: "✈ Te mando o passo a passo no direct". Entra quando a pessoa fala "comenta X" e fica até o fim. O lugar é o que o formato define pra chamada.

## Movimento

- **Ritmo dentro dos gráficos**: uma cena gráfica nova a cada ~2 s de fala, e dentro da cena algo muda a cada 0,3–0,6 s (um elemento entra, um contador sobe, um risco é desenhado, uma palavra é digitada). A tela nunca fica parada com um gráfico estático.
- Trocas de conteúdo dentro do mesmo layout: corte seco ou dissolvência rápida (≤ 0,15 s). Às vezes o mesmo cartão se transforma em vez de trocar.
- Entradas: fade + escala 0,96 → 1 + subida de 8–12 px, 0,25 s, power2.out.
- Texto de terminal e de chat é digitado letra a letra com cursor de bloco.
- Contadores rolam números.
- Grades e multidões aparecem em cascata (20–30 ms entre itens).
- Sprites se movem em passos (steps(4) a 8 fps), não em movimento suave.
- Nada de desfoque forte, nada de whip pan, nada de câmera virtual flutuando.

## Música e efeitos

- Música: eletrônica leve e constante (chiptune suave misturado com batida moderna), 105–115 BPM, ~−24 LUFS, nível fixo.
- Efeitos: "pop" curto em cada elemento que entra, tecla no texto digitado, tique nos contadores, "carimbo" seco nos carimbos e sons de 8 bits (moeda, golpe, pulo, fanfarra curta) nas cenas pixel art. Todos sintetizados (ondas quadradas e de pulso pros sons de 8 bits).
- Quantidade e volume seguem o padrão universal do motor (bloco 7 de `instrucoes-base.md`): só os eventos fortes (carimbo, confirmação, clique, moeda, entrada do elemento principal), no máximo 1 a cada 0,6 s, sem tecla, tique, 8 bits e risco, e bem abaixo da voz. A lista acima é o timbre de cada som quando ele entra.

## Verificação do estilo

- A tabela "frase → metáfora visual" existe no plano e cada cena gráfica do vídeo mostra a frase dita naquele momento (nenhum cartão genérico de ícone e título).
- Dentro de cada cena gráfica, alguma coisa muda pelo menos a cada 0,6 s.

- Nenhuma palavra em Silkscreen passando da borda da tela (meça a largura do texto renderizado, não estime).

- Pixel art nítido em todos os quadros (sem borrão de redimensionamento).
- Legenda em caixa alta, mono, dentro da pílula, sem cor de destaque.
- Nenhum fundo escuro do formato sobrando (exceto terminal, HUD e cenas pixel).
- No máximo 2 cenas pixel art em tela cheia.
