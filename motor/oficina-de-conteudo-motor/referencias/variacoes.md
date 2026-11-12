# Variações

Cada seção diz o que muda em `instrucoes-base.md` conforme a resposta do usuário ou o que foi detectado na pasta. Ao montar `edit/plano.md`, aplique todas as variações que valem e escreva as instruções finais já resolvidas.

---

## Níveis

### Básico

Vale tudo marcado [TODOS]. Remova tudo marcado [IMAGENS+] e [COMPLETO].

- O vídeo inteiro usa o layout A (câmera em tela cheia). Não há regras de distribuição de layout nem limite de oito segundos por trecho.
- A tabela de cortes registra os trechos (frases mantidas) com início, fim e conteúdo, sem coluna de layout.
- Ignore a etapa de contato visual. Se a pessoa desviar o olhar, mantenha o trecho e registre no relatório.
- Efeitos sonoros: só os que têm evento visual neste nível: clique no cartão de chamada para ação e confirmação quando fizer sentido. Mantenha o riser no fim do gancho.
- Não há verificação de fontes.

### Com imagens

Vale tudo marcado [TODOS] e [IMAGENS+]. Remova tudo marcado [COMPLETO].

- Os três layouts, regras de distribuição, contato visual, direção visual, tipografia, produtos citados, fontes (se ligado) e áreas seguras valem normalmente.
- **Sem câmera virtual:** o ambiente gráfico fica parado em cada trecho. Não use profundidade de campo nem desfoque de movimento.
- **Animação simples dos elementos:** cada cartão, imagem, logotipo ou captura entra com fade e leve subida de 40 px em 0,4 s com power2.out, sincronizado com a palavra que o menciona. Saídas só por corte seco no fim do trecho. No máximo dois elementos entrando por trecho.
- **Ações:** mostre a captura estática da interface ou página citada, sem animar digitação ou cliques dentro dela.
- Efeitos sonoros: impacto na chegada do cartão principal, clique e confirmação. Sem sons de passagem.
- Render a 60 fps direto, sem os 240 fps.

### Completo

Tudo de `instrucoes-base.md`, sem remoções.

---

## Formato horizontal 16:9 (YouTube)

Substitui toda a geometria vertical. Tela de **1920 × 1080**, 60 fps. Todo o resto (cortes, áudio, regras de distribuição, direção visual, câmera virtual) continua igual.

Ajuste os textos de saída: o vídeo é pra YouTube, e `final.mp4` sai em 1920 × 1080.

### Layout A: câmera em tela cheia

- Gravação horizontal: preenche a tela, recorte proporcional se a proporção não for exatamente 16:9.
- Gravação vertical: o vídeo fica centralizado na altura total (608 × 1080, x = 656). Atrás dele, uma cópia do mesmo quadro ampliada para cobrir a tela, com desfoque de 60 px e brilho 0,85. Não aplique zoom no vídeo principal.

### Layout B: composição dividida com a cabeça ultrapassando o cartão

- Composição gráfica de 1920 × 1080 atrás de tudo. Conteúdo principal entre x = 60 e x = 1080 e entre y = 60 e y = 820. Borda inferior do elemento principal entre y = 800 e y = 820.
- Suavize a saída do ambiente gráfico a partir de x = 1080, por uma faixa de 160 px para a direita.
- Cartão de câmera: largura 860 px, altura 820 px, x = 1140, y = 340, raio 160 px com superelipse. Ultrapassa as bordas direita e inferior.
- Gravação horizontal 16:9: redimensione para 1600 × 900 e posicione em x = 770, y = 178.
- Gravação vertical: redimensione para 860 px de largura e ajuste y para que o topo da cabeça fique ~150 px acima da borda superior do cartão e os ombros cruzem a borda.
- Em qualquer caso, confira num quadro de referência que a cabeça ultrapassa a borda superior do cartão. Se não ultrapassar, ajuste o y do vídeo (mesmo valor para cartão e máscara) até ultrapassar.
- Máscara com fundo removido, suavização de ~40 px na borda superior e alinhamento iguais ao vertical.

### Layout C: composição totalmente visual

Composição de 1920 × 1080. Borda inferior do elemento principal entre y = 820 e y = 840.

### Tipografia

- Títulos: 88 px, peso 700.
- Subtítulos: 48 px, peso 700.
- Corpo: 30 px, peso 400. Mínimo de 30 px.

### Moldura de fonte

x = 360, y = 60, largura 1200 px, altura 740 px, raio 36 px. Fundo desfocado igual ao vertical.

### Capa

Título em 96 px, mesma caixa e estilo. Centralizado em ~16% da altura. Para duas linhas, a caixa ocupa aproximadamente y = 70 a y = 330. No quadro 0, elementos da introdução abaixo de y = 350.

### Legendas

- Tamanho 64 px, contorno 9 px.
- Layout dividido: centralizadas na coluna gráfica (x = 60 a 1080), de y = 850 a y = 1010.
- Câmera cheia e composições visuais: parte inferior, centralizadas, de y = 860 a y = 1010.
- Composição visual com conteúdo embaixo: parte superior, de y = 70 a y = 220.
- Encerramento: de y = 560 a y = 720.

### Cartão de chamada para ação

x = 463, y = 780, largura 994 px, altura 240 px. Mesmo comportamento do vertical.

---

## Gravação vertical na saída vertical

- Layout A: o vídeo preenche a tela; recorte proporcional só se a proporção não for 9:16.
- Layout B: redimensione o vídeo para 1210 px de largura, x = −65, e ajuste y para que o topo da cabeça fique ~150 px acima da borda superior do cartão (y = 1200) e os ombros cruzem a borda. Confira num quadro de referência; se a cabeça não ultrapassar, ajuste y (o mesmo para cartão e máscara).

---

## Sem áudio separado

Quando não há áudio limpo na pasta:

- Remova a correlação cruzada da etapa 1.
- Extraia o áudio da câmera em WAV 48 kHz e use como voz.
- Antes de transcrever, limpe o áudio com redução de ruído suave (por exemplo, `afftdn` do FFmpeg ou `noisereduce` em Python), filtro passa-alta em ~80 Hz e leve compressão. Não exagere: voz metálica é pior que um pouco de ruído.
- Todo o resto continua igual.

---

## Estilo visual

### Claro tecnológico

O padrão de `instrucoes-base.md`.

### Escuro premium

Substitui Direção visual e Tipografia e cores:

- Fundo radial: #1A1A1F no ponto de 50% da largura e 36% da altura, chegando a #0D0D10 nas bordas.
- Cartões: #1F1F25, com borda de 1 px em rgba(255,255,255,0.06).
- Sombras: camada 1 rgba(0,0,0,0.50), camada 2 rgba(0,0,0,0.35), camada 3 rgba(0,0,0,0.25), mesmos deslocamentos e desfoques.
- Texto principal: #F5F5F7.
- Terracota para preenchimentos: #D97757. Terracota para texto: #E89A7C.
- Faixa de destaque: rgba(217,119,87,0.16).
- Verde e vermelho iguais.
- Na verificação, troque "ausência de áreas escuras" por "ausência de áreas totalmente pretas ou sem contraste".
- Na moldura de fonte, o fundo desfocado leva camada preta a 72% no lugar da branca.
- A caixa da capa fica #1F1F25 com texto #F5F5F7.

### Cores da minha marca

Pergunte: cor principal (hex), fundo claro ou escuro, e fonte (opcional, do Google Fonts).

- Parta do estilo claro ou do escuro, conforme o fundo escolhido.
- Troque a terracota de preenchimento pela cor principal.
- Para texto colorido, use uma variação da cor principal com contraste mínimo de 4,5:1 sobre o fundo dos cartões.
- Faixa de destaque: cor principal a 12% de opacidade sobre a cor do cartão.
- Se a pessoa informar uma fonte, ela substitui a Poppins nos gráficos, na capa e nas legendas normais. Baixe do Google Fonts para dentro do projeto.

---

## Legendas

- **Padrão:** como em `instrucoes-base.md`.
- **Só brancas:** remova os destaques. Todas as palavras no estilo normal.
- **Destaques na cor da marca:** destaques na cor principal informada (pergunte o hex se ainda não tiver), na mesma fonte das legendas normais, negrito, com o mesmo contorno. Mantenha as regras de frequência dos destaques.
- **Sem legenda:** remova legendas e todas as regras de posição de legenda. Mantenha as áreas seguras.

## Capa

- **IA cria:** como em `instrucoes-base.md`.
- **Usuário escreve:** use o texto exato informado. Se passar de duas linhas a 110 px (96 px no horizontal), reduza o tamanho até caber em duas linhas, com mínimo de 80 px (70 px no horizontal).
- **Sem capa:** remova a capa. O quadro 0 mostra o primeiro trecho normalmente, ainda limpo de legendas.

---

## Música

- **Padrão:** como em `instrucoes-base.md`.
- **Calma:** ambiente com pads suaves e textura acolhedora, 80–95 BPM, sem bateria marcada. Demais regras iguais.
- **Energética:** eletrônica com batida mais presente, 120–128 BPM. Demais regras iguais.
- **Música da pasta:** use o arquivo indicado. Converta para WAV 48 kHz estéreo, corte em END, aplique saída gradual de 800 ms, normalize para ~−24 LUFS integrados e mantenha nível fixo, sem redução sob a voz. Ignore a regra de primeira batida no quadro 1. Registre no relatório que a música é do usuário.
- **Sem música:** não gere `stems/music.wav`. O master soma só as outras faixas. Registre no relatório.

## Efeitos sonoros

- **Completos:** como em `instrucoes-base.md` (respeitando o nível e o padrão universal: poucos efeitos, bem abaixo da voz).
- **Só os essenciais:** cliques, impactos e confirmações. Sem sons de passagem. Riser mantido. Mesmo padrão universal de quantidade e volume.
- **Nenhum:** não gere `stems/sfx.wav` nem `stems/riser.wav`. Remova as verificações de áudio ligadas a efeitos. Registre no relatório.

## Verificação de fontes

- **Sim:** como em `instrucoes-base.md`.
- **Não:** remova a seção Fontes e verificação e os itens 5 e 6 do relatório. Notícias e números citados podem aparecer em cartões gráficos simples, sem página de fonte, e nunca com dado inventado.
