# Efeitos de vídeo (formatos de efeito)

Oito formatos têm como assinatura efeitos aplicados direto na imagem da câmera, com a pessoa recortada e o rosto rastreado: palavra gigante atrás da cabeça, checklist que se marca, aproximação na palavra, seta à mão, widgets de vidro, cards girando em volta da cabeça, capa de revista, grade do perfil.

| Formato | Pacote |
|---|---|
| Zoom na Palavra (`zoom-na-palavra`) | principal |
| Widgets de Vidro (`widgets-de-vidro`) | principal |
| Cards em Órbita (`cards-em-orbita`) | principal |
| Palavra Atrás da Cabeça (`palavra-atras-da-cabeca`) | complemento |
| Checklist na Tela (`checklist-na-tela`) | complemento |
| Marcações (`marcacoes`) | complemento |
| Capa de Revista (`capa-de-revista`) | complemento |
| Grade do Perfil (`grade-do-perfil`) | complemento |

Os efeitos são os do [claude-video-effects](https://github.com/Vibha-Ramprakash/claude-video-effects), de Vibha Ramprakash (@vibha.in.progress), licença MIT. Eles rodam com o código original (`efeitos/scripts/fx.py`, dentro da pasta desta skill), com uma única mudança: os rótulos fixos da interface foram traduzidos pro português ("Seguindo", "Renderizando", "Editado pelo Claude", "2 de 3"...). O desenho, o movimento e o tempo de cada efeito são os do original. **Não reconstrua esses efeitos em HyperFrames nem edite o `fx.py`**: o efeito tem que sair igual ao original. O que o HyperFrames faz nesses formatos é a legenda, a capa, a música, os efeitos sonoros e a revisão no Studio.

## Onde fica

- Código, fontes e modelos: `<pasta desta skill>/efeitos/` (`scripts/fx.py`, `fonts/`, `models/`). Licença em `efeitos/LICENSE`, créditos e lista original em `efeitos/README-original.md`.
- Ambiente Python: `~/.maquina-de-edicao/efeitos/.venv`, criado pelo instalador do pacote principal. Neste arquivo ele é chamado de `FX_PY`: `~/.maquina-de-edicao/efeitos/.venv/Scripts/python.exe` no Windows e `~/.maquina-de-edicao/efeitos/.venv/bin/python` no Mac/Linux.
- Chame sempre com `-X utf8` (`FX_PY -X utf8 <pasta desta skill>/efeitos/scripts/fx.py ...`). Sem isso, o Windows lê o plano em outra codificação e quebra nos acentos.

Na fase 0b, quando o formato escolhido for um destes oito, confira `FX_PY -c "import mediapipe, cv2, PIL, numpy"`. Se falhar, rode de novo o instalador do pacote principal. Instalação manual, se o instalador não puder rodar: criar o ambiente com Python 3.10+ (`python -m venv ~/.maquina-de-edicao/efeitos/.venv`) e instalar `numpy opencv-python pillow mediapipe==1.2.2` nele. Não siga sem o ambiente funcionando, e não troque o efeito por uma imitação.

## O que muda no motor

- **Câmera:** a imagem da câmera do vídeo inteiro é o arquivo que o `fx.py` devolve. Não monte layouts B e C, câmera virtual, profundidade de campo, desfoque de movimento nem remoção de fundo pelo HyperFrames: o recorte da pessoa e o rastreamento do rosto são do `fx.py`.
- **Zoom:** a regra "nunca aplique zoom ao vídeo da câmera" (bloco 2) não vale para os efeitos que mexem a câmera (`lean-in`, `slow-push`, `locked-on`, `headline-box`, `over-the-shoulder-zoom`, `glass-widgets`, `apple-toggles`). Fora da janela de um efeito, a regra continua valendo.
- **Centralização (bloco 2A):** vale na câmera limpa, antes dos efeitos. Os efeitos seguem o rosto sozinhos.
- **Contato visual (bloco 3):** não vale. A câmera aparece o vídeo todo.
- **Taxa de quadros:** o `fx.py` entrega no máximo 30 fps. A câmera limpa sai a 30 fps (ou na taxa da gravação, se for menor). Se a pessoa escolheu exportar a 60 fps, exporte a 60 assim mesmo (a câmera fica a 30, a legenda anda a 60) e anote no relatório.

## Passo a passo

Depois dos blocos 1, 2 e 2A:

### 1. Câmera limpa

Monte `edit/efeitos/camera-limpa.mp4` com FFmpeg: os trechos escolhidos no bloco 2, na ordem, já enquadrados em 1080 × 1920 com a cabeça centralizada, a 30 fps, H.264 com CRF 16, e com a voz limpa já cortada como áudio (serve de referência pro `fx.py`, que copia o áudio; a mixagem final continua no bloco 7).

A linha do tempo da câmera limpa é a linha do tempo final: o segundo `t` dela é o segundo `t` do `final.mp4`. Remapeie a transcrição por palavra pra esse tempo e salve em `edit/efeitos/palavras.json`. É dela que saem os tempos dos efeitos.

### 2. Plano dos efeitos

Escreva `edit/efeitos/plano.json` no formato do `fx.py`, em UTF-8:

```json
{"effects": [
  {"fx": "backdrop-word", "start": 0.4, "end": 3.1, "text": "CLAUDE"},
  {"fx": "huge-strike", "start": 9.8, "end": 12.4, "text": "editor", "at": 0.9}
]}
```

Quais efeitos, onde e com que texto: a seção **Gráficos** do formato. Regras que valem em todos:

- Janela de 1,5 a 4 s por efeito. Entre o fim de um efeito e o começo do próximo, pelo menos 2 s de câmera limpa (a não ser que o formato diga outra coisa).
- O efeito começa na palavra que ele ilustra: `start` = início da palavra menos 0,1 s. Palavra-chave falada ⇒ texto do efeito. Número citado ⇒ o número de verdade, nunca inventado.
- Textos curtos: palavra gigante com até 10 letras, linhas com até 22 caracteres. Use as palavras da fala, sem tradução.
- Quando dois efeitos se sobrepõem, os de câmera (`locked-on`, `lean-in`, `slow-push`, `headline-box`) vêm primeiro na lista. Zoom nunca passa de 2×.
- Nada pode cobrir o rosto. O `fx.py` já põe atrás da pessoa o que passa pela cabeça; se um quadro de conferência mostrar texto no rosto, ajuste `x`/`y`, encurte o texto ou troque o efeito.
- **Estilo visual:** a opção `color` recebe a cor de destaque do estilo escolhido (ou a cor da marca) nos efeitos marcados "destaque" na tabela abaixo. Nos marcados "fixa", a cor tem papel próprio (verde de concluído, azul do Instagram) e fica a original. As fontes dos efeitos não mudam com o estilo. No Original do formato, use a cor que o formato manda.
- **Imagens dos cards** (`orbit`, `carousel-spin`, `fan-build`, `phone-fan`, `noise`, `place-in-grid`, `profile-wall`): opção `images` com o caminho absoluto da pasta `imagens/` quando a pessoa mandou prints ou capas (no painel ou na pasta). Sem pasta, deixe sem `images`: o `fx.py` usa 10 quadros do próprio vídeo.

### 3. Conferência por quadros

```
FX_PY -X utf8 <skill>/efeitos/scripts/fx.py --plan edit/efeitos/plano.json edit/efeitos/camera-limpa.mp4 edit/efeitos/conferir.png --still t1,t2,...
```

Um tempo por efeito, perto do fim da janela (quando o efeito já se montou), e mais um no meio dos efeitos que se constroem por partes (checklist, toggles, grade). Abra cada PNG e confira: nada no rosto, nada cortado na borda, texto legível e igual à fala, número certo. Corrija o plano e repita até passar.

### 4. Render dos efeitos

```
FX_PY -X utf8 <skill>/efeitos/scripts/fx.py --plan edit/efeitos/plano.json edit/efeitos/camera-limpa.mp4 edit/efeitos/camera-efeitos.mp4
```

Roda em duas passadas (rastreamento e efeitos) e leva por volta de 10 s por segundo de vídeo num computador comum (um vídeo de 1 minuto, uns 10 minutos): rode em segundo plano e siga com a legenda e o áudio enquanto isso. Saída em 1080 de largura.

### 5. Composição no HyperFrames

- Câmera: `camera-efeitos.mp4` num clipe só, de 0 a END, tela cheia, sem som (a voz vem do stem de voz do bloco 7).
- Por cima: legenda, capa e, quando o formato pedir, o cartão de chamada pra ação. Nenhum outro gráfico HyperFrames.
- Durante a janela de cada efeito, a legenda segue a coluna "Legenda" da tabela: **continua** (fica na posição do formato) ou **some** (some 0,1 s antes do `start` e volta 0,1 s depois do `end`).
- Efeitos sonoros (bloco 7, sempre do earshot): só no momento forte de cada efeito, coluna "Som". Nada além disso.

### 6. Revisão

- Pedido sobre um efeito (outro texto, outro tempo, tirar, trocar por outro da lista do formato): altere `plano.json`, confira o quadro, renderize de novo o `camera-efeitos.mp4` com o mesmo nome. O Studio pega o arquivo novo.
- Pedido sobre corte ou tomada: refaça a câmera limpa, remapeie os tempos do plano e renderize de novo.
- Pedido de um efeito que não está na lista do formato: pode usar qualquer efeito do `fx.py` (`FX_PY -X utf8 fx.py --list`), desde que a pessoa tenha pedido.

### 7. Exportação

Exportação em 4K: renderize de novo com `--width 2160` antes do render final e troque o arquivo na composição. Em 1080 ou 720, use o mesmo arquivo.

## Os efeitos usados nos formatos

Zona: onde o efeito desenha. Legenda: o que a legenda faz na janela dele. Cor: o que o `color` faz. Preencha sempre: opções de texto que nunca podem ficar no padrão.

**Alguns valores padrão do `fx.py` são do vídeo da autora, em inglês e com o nome e o @ dela** ("Vibha", "@vibha.in.progress", "EFFECTS", "VIBE"). Preencha sempre as opções da última coluna com o conteúdo da fala e os dados da pessoa. Os rótulos fixos da interface já estão em português.

| Efeito | O que faz | Zona | Legenda | Cor | Som | Preencha sempre |
|---|---|---|---|---|---|---|
| `backdrop-word` | Palavra gigante cai atrás da cabeça (`font` `bold` ou `serif`) | topo, atrás da pessoa | continua | destaque | impacto abafado na queda | `text` |
| `huge-strike` | Palavra serifada gigante atrás, depois um risco vermelho no `at` | topo, atrás | continua | fixa | risco no `at` | `text` |
| `crayon-write` | Giz vermelho escreve a palavra atrás e sublinha | topo, atrás | continua | fixa | nenhum | `text` |
| `checklist` | Lista embaixo do queixo; cada passo gira e fica verde | peito e barriga | some | fixa | confirmação no último passo | `text` (`passo::detalhe\|...`), `title` (até 14 caracteres) |
| `todo` | Card de lista ao lado da cabeça, marca nos segundos de `ticks` | lado da cabeça | continua | fixa | confirmação no último tique | `text`, `ticks` (segundos do vídeo), `title` |
| `apple-toggles` | Card de ajustes do iPhone acima da cabeça, com leve aproximação; as chaves ligam nos `ticks` | acima, atrás da cabeça | continua | fixa (verde) | clique na primeira chave | `text`, `ticks` |
| `countdown-flip` | Relógio 3, 2, 1 acima da cabeça | acima da cabeça | continua | — | nenhum | `from` |
| `lean-in` | Aproximação rápida numa palavra (`zoom` 1,45, até 2) | câmera | continua | — | nenhum | — |
| `slow-push` | Aproximação lenta, fundo desfocando (`zoom` 1,6) | câmera | continua | — | nenhum | — |
| `locked-on` | Cantoneiras travam no rosto e a câmera segue (`zoom` 1,35) | câmera | continua | — | clique na trava | `text` |
| `headline-box` | Aproximação com título de duas linhas no topo (`zoom` 1,2) | câmera + topo | some | — | impacto abafado | `text` (`linha 1\|linha 2`) |
| `pause-point` | Congela a imagem; seta à mão aponta com rótulo (`label_x`) | topo + seta | continua | destaque | clique no congelamento | `text` |
| `tape-label` | Fita amarela com a frase no peito | peito | some | fixa | nenhum | `text` |
| `select-resize` | Caixa de seleção agarra o número acima da cabeça e o cursor aumenta | acima da cabeça | continua | fixa | clique ao soltar | `text` |
| `scribble` | Rabiscos de marcador em volta da pessoa, com rótulo | em volta | some | destaque | nenhum | `text` |
| `glass-widgets` | Widgets de vidro em volta da cabeça (número, perfil, música tocando, calendário, render) | tela toda | some | fixa | impacto abafado na entrada | `text` (número), `title`, `sub` (`linha\|linha`), `name`, `handle`, `song`, `event`, `day`, `date` |
| `liquid-glass-graph` | Card de vidro no peito com gráfico subindo e número contando | peito | some | fixa (verde) | confirmação no fim da contagem | `text`, `from`, `to` |
| `liquid-glass-graph` `look=bento` | Tela de vidro com o gráfico atrás da cabeça e blocos de vidro na frente | tela toda | some | fixa (verde) | confirmação no fim da contagem | `text`, `from`, `to`, `donut` (`29%::rótulo`), `kpi` (`672K::rótulo`), `bars` (`197\|140\|124::rótulo`) |
| `over-the-shoulder-zoom` | Aproxima num canto com gráfico de vidro, volta, depois o outro canto (`zoom` 2) | câmera + cantos | some | fixa | nenhum | `text` (`rótulo 1\|rótulo 2`), `to` (`n1\|n2`) |
| `orbit` | Cards girando em volta da cabeça (na frente embaixo, atrás em cima) | em volta | some | — | nenhum | — |
| `carousel-spin` | Carrossel 3D de cards girando e parando | em volta | some | — | impacto abafado na parada | — |
| `fan-build` | Capas se abrem em leque atrás da cabeça, uma por vez | topo, atrás | continua | — | nenhum | — |
| `phone-fan` | Celulares em leque no peito, com título de duas linhas no topo | peito + topo | some | — | impacto abafado | `text` (`linha 1\|linha 2`) |
| `cover-star` | Capa de revista: título vermelho atrás da cabeça, chamadas e código de barras | tela toda | some | destaque | impacto abafado | `text`, `lines`, `issue` |
| `cover-star` `look=editorial` | Capa clássica: serifa atrás da cabeça, linha da edição e chamadas elegantes | tela toda | some | destaque (`accent`) | impacto abafado | `text`, `issue`, `lines`, `right` |
| `red-collage` | Pessoa em preto e branco, palavra vermelha gigante atrás, três frases batendo | tela toda | some | destaque | impacto em cada frase (no máximo 3) | `text`, `lines`, `tag` |
| `place-in-grid` | A pessoa encolhe pro centro da grade 3×3 do perfil e os reels aparecem em volta com visualizações | tela toda | some | — | impacto abafado | `views` (9 números, o 9º é o da pessoa) |
| `noise` | Reels se empilham atrás da cabeça | atrás | continua | — | nenhum | — |
| `profile-wall` | Grade do perfil enche a parede e um card de vidro conta até `count` | parede + card no peito | some | — | confirmação no fim da contagem | `count`, `label`, `name`, `sub` |
| `comment-box` | Comentário do Instagram digita a palavra, publica, ganha curtida e a resposta da pessoa | acima da cabeça | some | fixa | clique ao publicar | `text`, `handle`, `reply`, `chip` |
| `tap` | Botão Seguir aparece e vira Seguindo no `at` | ao lado da cabeça | continua | fixa | clique no `at` | `at` |

Os efeitos de câmera que se combinam com outro na mesma janela entram primeiro na lista do plano.

## Dados da pessoa

Vários efeitos mostram o nome e o @ da pessoa (`glass-widgets`, `profile-wall`, `comment-box`). Use, nesta ordem: as observações do painel, a seção "Marca" de `~/.maquina-de-edicao/preferencias.md` (linhas "Nome" e "@ do perfil"), o que a pessoa disser na fala. Se nada disso tiver o @, pergunte no chat logo depois do painel, numa pergunta só ("Qual é o seu @ e o nome que aparece no perfil?"), antes do resumo. Na fase 5, salve as duas linhas na seção "Marca" das preferências. Números do perfil (seguidores, visualizações) só entram se a pessoa falou ou escreveu; sem número real, escolha um efeito que não precise dele.

## Chamada para ação (todos os formatos de efeito)

- "Comenta X": `comment-box` com `text` = X, `handle` = @ da pessoa (sem o @), `reply` = a resposta curta que ela promete ("Te mandei no direct"), `chip` = o que ela entrega (até 18 caracteres), janela de 3 a 4 s começando na palavra "comenta".
- "Me segue", "segue o perfil": `tap` com `at` no segundo em que a pessoa fala "segue".
- Outra chamada (link, salvar): só a legenda.

## Verificação (acrescenta à 9A e à 9B)

- Cada efeito começa a até 2 quadros do início da palavra que ilustra.
- Nenhum quadro com texto ou elemento do efeito sobre o rosto (prancha com o início, o meio e o fim de cada janela).
- Textos e números dos efeitos iguais à fala.
- Legenda some e volta nos efeitos marcados "some"; nunca fica por cima de um efeito.
- Fora das janelas, a câmera limpa sem zoom e com a cabeça centralizada.

## Relatório

Acrescente: a tabela dos efeitos (efeito, início, fim, texto e opções), as correções feitas na conferência por quadros e a linha "Efeitos de vídeo: claude-video-effects, de Vibha Ramprakash (MIT)".
