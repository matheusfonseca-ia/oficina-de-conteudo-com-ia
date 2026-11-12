# Estilos visuais

O **formato** diz a estrutura do vídeo: que layouts existem, onde cada coisa fica na tela, o ritmo, que tipo de gráfico aparece em cada momento. O **estilo visual** diz a aparência: cores, fontes, material dos cards, jeito da legenda, movimento, clima da música e os elementos de assinatura (ex: cenas em pixel art).

Qualquer formato combina com qualquer estilo visual. A pessoa escolhe primeiro o formato e depois o estilo.

## Onde ficam

- Estilos que vêm com a Máquina: `estilos-visuais/<nome>.md`, dentro da pasta desta skill.
- Estilos que a pessoa criou: `~/.maquina-de-edicao/estilos-visuais/<nome>.md` (ficam fora da skill pra não se perder quando ela atualizar o repositório).
- Arquivos que começam com `_` (ex: `_modelo.md`) não são estilos: são modelos e ficam fora da lista.

Cada arquivo começa com o título, a linha `Resumo:` (uma frase, usada na pergunta) e a linha `Combina com:` (formatos em que o estilo fica melhor, ou "todos").

Pra criar um estilo novo, copie `estilos-visuais/_modelo.md`, preencha as seções e salve na pasta. Ele aparece sozinho na próxima edição.

## As opções na pergunta

1. **Original do formato**: o visual que vem descrito no próprio `formato.md` (seções Direção visual, Legendas e Áudio). Não lê arquivo de estilo nenhum. É a opção recomendada quando a pessoa não tem preferência salva.
2. Um item por arquivo em `estilos-visuais/` e em `~/.maquina-de-edicao/estilos-visuais/`, com o nome e o resumo.

Se o visual original do formato já for igual a um dos estilos (ex: o formato usa o Kit Noite e existe o estilo Noite Laranja), não mostre esse estilo duplicado.

## Como aplicar um estilo visual a um formato

### Combinações com arquivo próprio

Algumas combinações de formato + estilo têm estrutura própria, num arquivo `com-<estilo>.md` dentro da pasta do formato (ex: `reels-de-negocio/com-pixelado.md`, o formato dos reels editados no estilo Opus Jake). Quando ele existe, vale por cima do `formato.md` e do arquivo do estilo, inclusive nos layouts: as regras de "Nunca muda" abaixo não se aplicam ao que ele define.

### Nunca muda (vem do formato)

- Os layouts, as posições, os tamanhos das áreas, as regras de distribuição e o ritmo.
- O que aparece em cada momento (uma lista vira lista, um número vira contador, um ranking vira tier list).
- A posição da legenda e o tamanho dela (a não ser que o estilo peça um ajuste proporcional por causa da fonte).
- O "Fluxo diferente", as entradas extras e a saída.

### Muda (vem do estilo)

Cada estilo visual preenche estes **papéis**. Ao montar `edit/plano.md`, troque cada cor, fonte e material do formato pelo papel equivalente do estilo:

| Papel | Exemplo no Noite Laranja |
|---|---|
| Fundo das telas gráficas | preto com brilho laranja |
| Textura do fundo | grade de pontos fraca |
| Card | vidro escuro |
| Card ativo | borda e brilho laranja |
| Cor de destaque | `#CC7430` |
| Destaque em texto | `#E0894A` |
| Texto principal / secundário | branco / cinza |
| Cores de status (ok / erro) | verde / vermelho |
| Fonte de títulos | Inter 700 |
| Fonte de texto | Inter 400 |
| Fonte da palavra de destaque | Instrument Serif itálico |
| Fonte de números | Inter 700 |
| Legenda | Inter 700 branca com sombra, destaque em serifa laranja |
| Título de gancho | Inter 800, linha 2 em caixa branca |
| Movimento | fade + subida, power3.out |
| Elementos de assinatura | manchas de brilho laranja |
| Música e efeitos | eletrônica escura, "tic" de vidro |

Regras da troca:

- **Cores com papel fixo no formato continuam** quando fazem parte da lógica: as cores das fileiras S a F do Formato Ranking, o verde de confirmação, o marca-texto amarelo do documento da aula. Só mude se o estilo disser que muda.
- **Fonte diferente, mesmo espaço**: se a fonte do estilo for mais larga ou mais estreita, ajuste o tamanho pra ocupar a mesma área que o formato previu (ex: fonte mono em caixa alta costuma precisar de ~85% do tamanho).
- **Legenda**: posição e quantidade de palavras por bloco vêm do formato. Fonte, cor, caixa, contorno, pílula e destaque vêm do estilo. Se o formato tem uma legenda que é a alma dele (Legenda Encaixada, frase empilhada do Reels com B-roll), mantenha a mecânica e troque só a tipografia e as cores pelas do estilo.
- **Formatos com pouco gráfico** (Legenda Encaixada, Reels com B-roll, Nuvem de Imagens, Recorte com Imagens): o estilo muda a legenda, as molduras e o pouco que houver de gráfico. Se o estilo tiver a seção "Em formatos com pouco gráfico", siga o que ela manda (ex: o Pixelado acrescenta inserts em pixel art).
- **Formatos de efeito** (Palavra Atrás da Cabeça, Checklist na Tela, Zoom na Palavra, Marcações, Widgets de Vidro, Cards em Órbita, Capa de Revista, Grade do Perfil): os efeitos saem do `fx.py` original e não são redesenhados. O estilo muda a legenda, a música, o timbre dos efeitos sonoros e a cor de destaque dos efeitos que aceitam `color` (tabela de `efeitos-de-video.md`). As fontes e os materiais dos efeitos ficam os originais. Elementos de assinatura que são cenas ou gráficos (ex: os inserts em pixel art do Pixelado) não entram nesses formatos; a legenda do estilo (ex: a pílula escura do Pixelado) entra normalmente, na posição do formato.
- **Áudio**: o clima da música e o timbre dos efeitos vêm do estilo. Quantidade e volume dos efeitos seguem sempre o padrão universal do motor (poucos efeitos, bem abaixo da voz: bloco 7 de `instrucoes-base.md`), assim como nível, sincronia e master.
- **Marca da pessoa**: se ela pediu a cor da marca, troque só a cor de destaque do estilo (com contraste de 4,5:1).

Prioridade (da mais forte pra mais fraca): pedidos da revisão e observações da pessoa → ajustes fixos salvos → estilo visual (no que é aparência) → formato → `variacoes.md` → `instrucoes-base.md`.

## Vale pra todo estilo (inclusive o Original do formato)

- **Texto sempre dentro da tela.** Quando a fonte do estilo é mais larga que a do formato (Silkscreen, mono em caixa alta), meça a largura do texto já renderizado e reduza até caber com 60 px de margem de cada lado. Nunca deixe palavra cortada na borda.
- **Legenda legível sobre a câmera.** Antes de fixar a legenda de cada trecho, meça a luminância média da gravação no retângulo onde ela fica. Se passar de 0,55 (roupa branca, parede clara, luz estourada), a legenda que não tem caixa nem contorno (Kit Noite, Noite Laranja e os originais de Ensaio Visual, Legenda Encaixada, Reels com B-roll, Nuvem de Imagens, Recorte com Imagens e Telas em Profundidade) ganha reforço: sombra dupla `0 2px 6px rgba(0,0,0,0.85), 0 0 28px rgba(0,0,0,0.6)` e, na palavra de destaque colorida, contorno de 3 px `rgba(0,0,0,0.55)` (`paint-order: stroke fill`). Legendas com pílula ou contorno próprio (Pixelado, Claro Tecnológico) não precisam. Confira nos quadros da verificação 9A: nenhuma palavra branca sobre fundo claro sem reforço.
