# Kit Noite

Kit visual compartilhado: fundo preto, brilho laranja difuso, cards de vidro e a dupla de fontes Inter (sans) + Instrument Serif itálico (destaque). É o visual original de vários formatos (eles dizem isso na seção "Direção visual" e só descrevem o que muda) e a base do estilo visual Noite Laranja.

Coordenadas em 1080 × 1920 (vertical). Pra 16:9 (1920 × 1080), os tamanhos de fonte caem ~12% e as distâncias seguem a mesma proporção em relação à largura.

## Fontes

Baixe do Google Fonts pra dentro do projeto e carregue localmente:

- **Inter**: pesos 400, 500, 600, 700 e 800. Fonte de todo texto normal (títulos, legendas, rótulos, números).
- **Instrument Serif**: itálico 400. Só pra palavra de destaque (uma ou duas palavras por frase), nunca pra frase inteira.

Ajuste de letra: Inter com `letter-spacing: -0.02em` nos títulos e nas legendas; rótulos pequenos em caixa alta com `letter-spacing: 0.08em`.

## Cores

| Uso | Cor |
|---|---|
| Fundo | `#000000` puro, ou `#0A0A0C` nas áreas grandes |
| Brilho laranja | radial de `rgba(204,116,48,0.38)` no centro a transparente, raio 420 a 600 px, desfoque 120 px |
| Destaque (laranja) | `#CC7430` |
| Destaque claro (texto laranja sobre preto) | `#E0894A` |
| Texto principal | `#FFFFFF` |
| Texto secundário | `#A1A1AA` |
| Texto apagado (itens ainda não ativos) | `#52525B` |
| Verde de confirmação | `#34C759` |
| Vermelho de alerta | `#FF453A` |

O brilho laranja fica atrás dos elementos, em 1 ou 2 manchas por tela, normalmente na parte de baixo ou atrás do card ativo. Ele se move devagar (deriva de até 40 px em 4 s, sine.inOut). Nunca brilho em tela inteira.

Textura opcional do fundo: grade de pontos de 1,5 px a cada 36 px, cor `rgba(255,255,255,0.05)`. Só nos estilos que pedirem.

## Card de vidro

- Preenchimento: gradiente vertical de `rgba(255,255,255,0.09)` a `rgba(255,255,255,0.03)`.
- Borda: 1,5 px `rgba(255,255,255,0.14)`.
- Desfoque do que está atrás: `backdrop-filter: blur(24px)`.
- Raio: 18 px nos cards, 999 px nas pílulas.
- Sombra: `0 30px 60px rgba(0,0,0,0.55)`.
- **Card ativo** (o que a fala está citando agora): borda 2 px `#CC7430` e brilho `0 0 48px rgba(204,116,48,0.45)`. Os outros cards ficam com opacidade 0,55. Só um card ativo por vez.
- Texto dentro: título Inter 700 a 40–44 px, número/índice Inter 500 a 28 px em `#A1A1AA` no canto superior direito ("01", "02"), descrição Inter 400 a 28 px em `#A1A1AA`.

## Pílula de notificação

Card de vidro com raio 28 px, 860 × 120 px, avatar circular de 64 px à esquerda, "@seuperfil" em Inter 600 30 px e a linha de baixo em Inter 400 28 px `#D4D4D8`, "agora" em `#71717A` à direita. Entram uma de cada vez, empilhadas de cima pra baixo com 16 px de espaço, subindo 30 px com fade em 0,35 s (power3.out).

## Título com palavra em destaque

Usado no topo das telas gráficas.

- Linha 1 em Inter 700, 60 px, branca.
- Linha 2 mistura Inter 700 branco com **uma** palavra em Instrument Serif itálico, mesmo tamanho +10%, em `#CC7430`.
- Sublinhado laranja de 3 px embaixo da linha 2, com a largura da linha, que se desenha da esquerda pra direita em 0,5 s quando o título entra.
- O título entra palavra por palavra (cada palavra: fade + subida de 12 px em 0,25 s, intervalo de 0,06 s).

## Contadores e gráficos

- Números grandes: Inter 700, 120–160 px. Contam do valor inicial ao final em 0,8–1,2 s (power2.out), sempre sincronizados com a palavra que diz o número.
- Gráfico de linha: traço de 5 px `#CC7430`, desenhado da esquerda pra direita (stroke-dashoffset) em 1–1,5 s, com um ponto branco de 14 px na ponta. Linha de base tracejada `rgba(255,255,255,0.18)`.
- Grade de dias (ex: 30 dias): quadrados de 56 px com raio 8 px e 10 px de espaço. Vazio: borda `rgba(255,255,255,0.14)`. Preenchido: `#CC7430`. Preenche em sequência, 30 ms por quadrado.
- Barra de progresso: 6 px de altura, trilho `rgba(255,255,255,0.12)`, parte cheia `#CC7430`, avança junto com os passos citados.

## Legenda padrão do kit

- Inter 700, 64 px, branca, `letter-spacing: -0.02em`, sombra `0 4px 18px rgba(0,0,0,0.55)` (sem contorno).
- De 2 a 5 palavras por bloco, quebrando em frase, nunca no meio de um nome.
- Uma palavra de destaque a cada 2–3 blocos: Instrument Serif itálico, 1,15× o tamanho, `#CC7430` (ou `#E0894A` se o fundo atrás for a câmera e o contraste ficar baixo).
- Entra com fade de 0,12 s. Sem animação palavra por palavra, a não ser que o estilo peça.
- Se a legenda cair sobre uma área clara da gravação (roupa branca, parede clara), use o reforço de contraste de `estilos-visuais.md` ("Legenda legível sobre a câmera").

## Movimento

- Entradas: fade + subida de 30–40 px em 0,35–0,45 s, power3.out.
- Trocas de card ativo: 0,3 s, power2.inOut.
- Saídas: corte seco no fim do trecho (nada sai animado, a não ser que o estilo peça).
- No quadro 0 de cada trecho, a composição já está estável.

## Efeitos sonoros do kit

Paleta suave, todos tirados do banco do earshot (`efeitos-sonoros.md`):

- "tic" de vidro curto e agudo (`pro_tap/glass` ou `fit/tick/domino`) na entrada de card ou pílula;
- "pop" grave abafado (`pro_pop_in/deep` ou `ui_pop/soft`) na entrada de número grande;
- sinal de duas notas na confirmação (verde), com `notify` ou `mallet` em duas alturas;
- whoosh (`fit/whoosh.short/bamboo_swish` ou `whoosh_fast/crisp`) só em trocas de tela cheia de animação (no máximo 3 por vídeo).

Quantidade e níveis: o padrão universal do bloco 7 do motor (só nos eventos fortes, no máximo 1 a cada 0,6 s, bem abaixo da voz). O "tic" fica só no card ou pílula principal da tela, não em cada item.
