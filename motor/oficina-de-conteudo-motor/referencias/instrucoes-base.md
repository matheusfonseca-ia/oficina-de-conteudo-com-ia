# Instruções base de edição

Estas são as instruções completas para o padrão: **saída vertical 9:16, gravação horizontal, áudio limpo separado, nível Completo, estilo claro tecnológico, legenda padrão, música eletrônica sintetizada e efeitos completos do earshot.**

Qualquer escolha diferente do usuário é aplicada com `variacoes.md`, que substitui ou remove blocos daqui.

## Mapa de níveis

Cada bloco ou item tem uma etiqueta:

- **[TODOS]**: vale nos três níveis.
- **[IMAGENS+]**: vale nos níveis Com imagens e Completo.
- **[COMPLETO]**: vale só no nível Completo.

Itens sem etiqueta herdam a etiqueta do bloco em que estão. As regras específicas de cada nível (o que entra no lugar do que foi removido) estão em `variacoes.md`, seção "Níveis".

---

## 0. Objetivo, ambiente e autonomia [TODOS]

Transforme a gravação bruta do usuário falando para a câmera num vídeo finalizado e pronto pra publicar como Instagram Reel, TikTok ou YouTube Short.

Faça todo o processo por código, usando FFmpeg, Python, Node e HyperFrames. Não use aplicativos de edição de vídeo.

Sintetize por código toda a música. Os efeitos sonoros e o efeito crescente da introdução vêm sempre do banco do **earshot** (https://github.com/Leonxlnx/earshot), instalado junto com a Máquina; o passo a passo está em `efeitos-sonoros.md`. O áudio da voz do usuário é fornecido, mas não há arquivos externos de música ou efeitos.

Instale as dependências necessárias dentro deste projeto: pacotes npm na pasta do projeto e pacotes Python num ambiente virtual local. Nunca instale programas globalmente no sistema. A única exceção é o earshot, que fica em `~/.maquina-de-edicao/earshot` com ambiente Python próprio e serve todos os vídeos.

Baixe as fontes usadas (Poppins e Instrument Serif, do Google Fonts) para dentro do projeto e carregue-as localmente nas composições.

Se as skills do HyperFrames estiverem disponíveis neste ambiente (hyperframes, hyperframes-core, hyperframes-cli, hyperframes-animation, media-use), siga as convenções delas para estrutura de composição, transcrição, remoção de fundo, prévia e render.

AUTONOMIA

- Execute todas as etapas até o vídeo estar montado e aberto no HyperFrames Studio, sem pedir esclarecimentos.
- **Não exporte o MP4 final sem a confirmação explícita do usuário.** Renderizar só acontece na fase de exportação, depois da aprovação no Studio.
- Tome as decisões necessárias sobre seleção de tomadas, layouts, divergências entre fontes e interfaces que não conseguir capturar. Escolha a melhor solução disponível, continue trabalhando e registre a decisão no plano e no relatório.
- Se uma ferramenta ou método falhar, tente uma alternativa. Ferramenta ausente não é motivo pra parar: instale localmente ou use outra abordagem.
- Se a interface real de um produto exigir login, reconstrua uma representação fiel a partir de capturas públicas ou documentação e identifique essa reconstrução no relatório.
- Se não houver título de capa, crie um com base no gancho inicial.
- Interrompa antes do fim só se os arquivos de entrada estiverem ausentes ou ilegíveis.

## ENTRADAS [TODOS]

1. Vídeo da câmera, na pasta do projeto.
2. Áudio limpo da voz, na pasta do projeto.
3. Título da capa, criado por você, exibido só no quadro 0.

## ENTREGAS [TODOS]

Organize tudo numa pasta nova chamada `edit`.

Antes da aprovação, a entrega é a composição completa aberta no HyperFrames Studio, com voz, efeitos, riser e música já posicionados para a revisão.

Depois da aprovação, entregue:

1. `final.mp4` na qualidade de exportação escolhida (padrão: 1080 × 1920 pixels, 60 quadros por segundo; veja 8C), vídeo H.264 em alta qualidade e áudio AAC estéreo a 48 kHz.
2. `stems/voice.wav`.
3. `stems/sfx.wav`.
4. `stems/riser.wav`.
5. `stems/music.wav`.
6. `relatorio.md`, com as informações listadas no fim deste arquivo.

Todas as faixas WAV devem ter a duração completa do vídeo e ficar sincronizadas, permitindo remixagem posterior.

---

## 1. Sincronização e transcrição [TODOS]

Compare o áudio da câmera com o áudio limpo por correlação cruzada, convertendo ambos temporariamente para mono a 16 kHz.
Encontre o deslocamento temporal entre as gravações e confirme com um pico claro de correlação.
A partir daqui, use só o áudio limpo. Descarte o áudio da câmera da montagem final.

Transcreva o áudio limpo com marcações de tempo por palavra, usando `npx hyperframes transcribe`, Whisper ou alternativa equivalente.
Agrupe as palavras em tomadas e identifique as diferentes tentativas de cada frase.

## 2. Seleção e corte [TODOS]

O usuário repete as frases até ficar satisfeito. Por isso, preserve a ÚLTIMA tomada completa de cada frase.
Use uma tomada anterior somente quando a última tiver um defeito audível nas palavras: gagueira, palavra cortada, palavra errada ou reinício no meio da frase.
Registre cada substituição no relatório.
Se a pessoa gravou sem repetir frases, cada frase tem uma tomada só: mantenha-a e aplique apenas a limpeza abaixo.

Remova reinícios, autocorreções, expressões de preparação como "ok", sílabas soltas e comentários murmurados depois de uma tomada.
Preserve aproximadamente 40 ms antes da primeira palavra de cada trecho.
Reduza silêncios acima de aproximadamente 250 ms, dentro das frases ou entre elas, para cerca de 120 ms. Preserve pausas curtas e naturais.

Determine o final real de cada frase pelo áudio, sem depender só do término indicado pela transcrição.
Use como referência a última janela RMS de 10 ms com nível igual ou acima de −35 dB. Se houver um trecho de mais de ~150 ms abaixo de −32 dB, examine se a fala já terminou antes e corte no término verdadeiro.

Os cortes de imagem devem ser secos, exatamente nas junções planejadas.
Nunca aplique zoom, aproximação ou movimento artificial ao vídeo da câmera.

Antecipe só o áudio de cada nova frase: ele começa 50 ms antes do corte correspondente de imagem, criando um J cut.
Mantenha a cauda da frase anterior em volume normal até ela atingir o ruído de fundo. Depois, aplique saída gradual de 170 ms, sem ultrapassar o início do próximo som.
Nenhuma junção pode conter silêncio acima de 150 ms.
Resolva intervalos excessivos cortando antes ou sobrepondo as caudas. Nunca acrescente silêncio para corrigir uma junção.

Defina END como o final exclusivo da faixa de voz, imediatamente após seu último quadro. Todas as camadas terminam exatamente em END.

## 2A. Centralização horizontal obrigatória [TODOS]

Esta configuração universal vale para todos os projetos e vídeos editados, em qualquer proporção, nível, formato ou estilo, inclusive preferências reutilizadas. Prevalece sobre posições de câmera de formatos, estilos, variações e referências.

- Sempre que a pessoa aparecer, o centro horizontal da cabeça deve coincidir exatamente com o centro horizontal da área visível da câmera: `x_cabeca = x_area + largura_area / 2`, em coordenadas da composição final. Em câmera cheia, `x_area = 0` e `largura_area = largura_video`. Em tela dividida, cartão, janela ou recorte, use a área destinada à pessoa. Não desloque a pessoa para abrir espaço para texto ou gráficos; reorganize esses elementos. A altura da cabeça segue o layout e a área segura.
- Meça a cabeça nos quadros da fonte, após considerar rotação e escala. Ajuste crop, deslocamento horizontal e/ou posição da camada para colocar o centro medido no alvo. Não confunda o centro do arquivo, do corpo ou da caixa do elemento com o centro da cabeça; `object-position: center` só basta se a medição confirmar o alinhamento.
- Recalcule para cada tomada, corte e mudança de layout ou escala. Se houver movimento lateral, acompanhe a cabeça ao longo do trecho com rastreamento e keyframes determinísticos, inspecionando o intervalo todo. O alvo continua fixo no centro; não aceite um desvio intencional nem enquadramento apenas aproximadamente centralizado. Isso corrige o enquadramento, sem acrescentar zoom dramático.
- Aplique o mesmo ajuste à câmera e à máscara de cabeça/ombros, mantendo as duas versões sincronizadas e alinhadas. Garanta que o recorte não corte a cabeça nem revele bordas vazias; se necessário, adapte a escala ou o layout preservando a centralização.
- Registre em `edit/plano.md` a área da câmera, o alvo horizontal e os ajustes por trecho. Confira início, meio e fim de cada tomada, ambos os lados dos cortes, transições e extremos de movimentos; examine todos os quadros dos trechos com deslocamento. Sobreponha temporariamente uma guia vertical no centro para medir, removendo-a da entrega. Corrija qualquer desvio detectado antes de abrir o Studio e confira novamente no MP4 renderizado. Registre o resultado em `edit/relatorio.md`.

## 3. Contato visual [IMAGENS+]

Inspecione aproximadamente oito quadros de cada tomada selecionada.
Ao detectar uma virada de cabeça, examine também quadros em intervalos de 100 ms ao redor do movimento.
Mostre a câmera somente enquanto o usuário estiver olhando para a lente.
Se ele desviar o olhar no meio da frase, esconda a câmera a partir do último quadro em que ainda olha para a lente.
Divida o trecho na fronteira de palavra mais próxima antes do desvio e transforme o restante numa composição totalmente visual.
Uma tomada lida fora da câmera durante toda a fala usa composição totalmente visual.

## 4. Os três layouts

Tela de 1080 × 1920 pixels.
Nos níveis Com imagens e Completo, o vídeo alterna entre os três layouts abaixo, com cortes secos nas junções. No nível Básico, só existe o layout A.

### A. Câmera em tela cheia [TODOS]

Use o vídeo do usuário preenchendo a tela por recorte proporcional.
Se a fonte for horizontal, ajuste a faixa recortada pela posição real da cabeça para preencher o formato vertical com a pessoa centralizada, conforme o bloco 2A.

### B. Composição dividida, com a câmera embaixo e a cabeça ultrapassando o cartão [IMAGENS+]

Coloque uma composição gráfica de 1080 × 1920 atrás de todos os elementos.
Mantenha o conteúdo principal dessa composição entre y = 40 e y = 900. A borda inferior do elemento principal fica entre y = 880 e y = 900.

Sobre essa composição, coloque um cartão de câmera com:
- Largura: 1210 px.
- Altura: 864 px.
- Posição x: −65.
- Posição y: 1200.
- Raio dos cantos: 200 px, com aparência de superelipse.

O cartão ultrapassa as bordas esquerda, direita e inferior da tela.
Para vídeo de origem 16:9, redimensione a imagem para 1890 × 1063 px e posicione em x = −405 e y = 1008.
Dentro do cartão, mostre esse vídeo pelo recorte da janela.

Acima da borda superior do cartão, mostre só a cabeça e os ombros do usuário, usando uma versão do mesmo quadro com o fundo removido (`npx hyperframes remove-background` ou método equivalente).
Na borda superior do cartão, suavize a máscara alfa em aproximadamente 40 px e mantenha o alinhamento exato entre as duas versões do vídeo.
A máscara e o cartão usam o mesmo quadro de origem em cada instante. A cabeça nunca pode se separar visualmente do corpo durante os movimentos.
Confira esse alinhamento em movimentos rápidos da cabeça.

### C. Composição totalmente visual [IMAGENS+]

Composição gráfica ocupando a tela inteira.

### Regras de distribuição [IMAGENS+]

- O gancho inicial (primeira frase) usa sempre o layout dividido.
- O encerramento, a partir da frase de chamada para ação, usa sempre câmera em tela cheia.
- Frases dirigidas diretamente ao espectador, opiniões e frases de impacto usam câmera em tela cheia, desde que haja contato visual.
- Gravações de tela, páginas de notícia e interfaces que precisam de aproximação interna usam composição totalmente visual.
- Uma captura isolada, um cartão, um logotipo ou uma lista curta usam o layout dividido.
- Nenhum trecho contínuo passa de aproximadamente oito segundos.
- Dois trechos consecutivos não podem usar o mesmo layout.
- Os três layouts aparecem no vídeo.

### Tabela de cortes [TODOS]

Antes de construir os gráficos, escreva em `edit/plano.md` uma tabela com todos os trechos cobrindo o intervalo de 0 até END: início, fim, layout e conteúdo.

---

## 5. Composições gráficas [IMAGENS+]

Use HyperFrames e crie uma composição por trecho (cada trecho é uma sub-composição).
Se houver suporte a subagentes paralelos no ambiente, distribua a construção de composições independentes entre eles, mantendo uma única direção visual e revisando o resultado integrado.

### Direção visual [IMAGENS+]

A estética transmite tecnologia sofisticada: um ambiente claro de cartões brancos flutuantes, com uma câmera virtual se deslocando entre eles.
Fundo radial quase branco: #FFFFFF no ponto de 50% da largura e 36% da altura, chegando a #F3F3F0 nas bordas.
Não use grades, esferas decorativas ou áreas escuras.

Cada objeto elevado tem sombra de três camadas:
- Camada 1: deslocamento vertical de 60 px, desfoque de 120 px, cor rgba(24,24,32,0.16).
- Camada 2: deslocamento vertical de 24 px, desfoque de 48 px, cor rgba(24,24,32,0.10).
- Camada 3: deslocamento vertical de 4 px, desfoque de 10 px, cor rgba(24,24,32,0.06).

Raios de canto:
- Cartões de mídia: 3% da largura.
- Documentos: 40 px.
- Blocos: 72 px.
- Telefones: 84 px.

### Tipografia e cores [IMAGENS+]

Poppins em toda a composição gráfica.
- Títulos: 96 px, peso 700.
- Subtítulos: 52 px, peso 700.
- Corpo: 30 px, peso 400.
- Nenhum texto gráfico abaixo de 30 px.

Cores:
- Texto principal: #111111.
- Terracota para preenchimentos: #D97757.
- Terracota para texto sobre branco: #B25730.
- Faixa de destaque: #FBEEE8.
- Verde para confirmações: #34C759.
- Vermelho para carimbos: #FF3B30.

### Movimento da câmera virtual [COMPLETO]

A câmera do ambiente gráfico pode executar:

1. Deslocamento suave com sine.inOut e variação máxima de escala de 0,04.
2. Passagem de aproximadamente 0,5 s para o próximo item, com power3.inOut, iniciada 0,25 s antes da palavra que o nomeia.
3. Aproximação de 1,2 a 2 s ao cartão mencionado, com power2.inOut, chegando a aproximadamente 1,6 vez a escala inicial.
4. Recuo de 1 a 2 s para revelar o contexto.
5. No máximo um movimento rápido por trecho, com 0,45 s de saída em power3.in e 0,6 s de chegada em power3.out.

No quadro 0 de cada trecho, a composição está numa posição estável, nítida e com a câmera em repouso.

### Profundidade de campo [COMPLETO]

Mantenha nítido o cartão em destaque.
Enquanto a câmera passa por outros cartões, eles podem receber até 14 px de desfoque e redução de destaque de aproximadamente 30%.
Ao encerrar uma aproximação, retorne os cartões secundários para até 9 px de desfoque e opacidade de aproximadamente 40%.
Nunca desfoque palavras que o espectador precisa ler.

### Desfoque de movimento [COMPLETO]

Aplique desfoque ao ambiente gráfico de acordo com a velocidade da câmera na tela em cada quadro.
Use sigma = 0,29 × velocidade × 0,75 ÷ 60, limitado a 40 px.
Na exportação, renderize os gráficos a 240 quadros por segundo e combine grupos de quatro quadros para obter 60 quadros por segundo, com mistura temporal no FFmpeg.
Aplique desfoque só durante o movimento. Quadro parado e desfocado é erro.

### Representação das ações [COMPLETO]

Anime a ação mencionada na fala.
Não substitua a demonstração por etiquetas, listas ou cartões que só repetem a narração.
Se um produto for citado, mostre a interface dele executando a ação correspondente: digitar, transmitir dados, clicar.
Capture a interface com HyperFrames (`npx hyperframes capture`) ou captura de navegador equivalente.
Ao demonstrar ações dentro de uma janela de produto, anime essa janela entre aproximadamente 1,15 e 1,4 vez a escala, por 0,4 a 0,7 s, com power2.inOut. Durante esse movimento, a câmera do ambiente fica parada.

### Produtos citados [IMAGENS+]

Identifique pela transcrição todos os produtos, ferramentas e marcas citados.
Ao apresentar um produto pelo nome, mostre primeiro o logotipo oficial, grande e centralizado, e depois a interface.
Use a interface que corresponde ao que a fala descreve. Se o produto tem app de desktop e versão de terminal (como o Claude Code), mostre o app visual, a não ser que a fala trate explicitamente do terminal.

### Fontes e verificação [IMAGENS+, se o usuário ligou a verificação]

Qualquer acontecimento citado (lançamento, declaração, número, manchete) é acompanhado pela página real da fonte.
Verifique cada dado numérico da fala em duas ou mais fontes confiáveis e registre divergências no relatório.
Se a fala divergir das fontes, preserve a gravação e não reforce o dado incorreto nos gráficos. Registre a diferença claramente.

Para exibir uma fonte, coloque a captura real e nítida dentro de uma moldura fixa:
- Posição x: 24.
- Posição y: 200.
- Largura: 1032 px.
- Altura: 1040 px.
- Raio dos cantos: 36 px.
- Sombra conforme o padrão visual.

Atrás dela, use uma cópia ampliada e suavizada da mesma captura, quase branca:
- Desfoque: 40 px.
- Saturação: 0,7.
- Brilho: 1,05.
- Camada branca sobreposta com opacidade de 72%.

A moldura fica parada. Aproximações e deslocamentos acontecem dentro dela.

### Áreas seguras [IMAGENS+]

- Nas composições totalmente visuais, a borda inferior do elemento principal fica entre y = 1200 e y = 1230.
- No layout dividido, preserve o conteúdo entre y = 40 e y = 900, suavizando a saída do ambiente gráfico a partir de y = 900 por uma faixa de 160 px.
- Cada cena é simples: um assunto dominante, no máximo um elemento de apoio e movimentos suaves.
- A duração de cada composição corresponde exatamente ao seu trecho.
- Inspecione uma prancha de quadros (snapshots) de cada composição antes de usá-la.

---

## 6. Capa, legendas e chamada para ação [TODOS]

### Capa

Exiba a capa somente no quadro 0.
Título em Poppins Bold, 110 px, preto, sobre uma caixa branca arredondada com sombra suave.
Raio de canto de aproximadamente 2,8% e espaçamento lateral interno de cerca de 50 px.
Centralize o título verticalmente em aproximadamente 13% da altura da tela. Para duas linhas, a caixa ocupa aproximadamente o intervalo de y = 262 a y = 603.
No quadro 0, mantenha todos os elementos gráficos da introdução abaixo de y = 620.

### Legendas

Gere as legendas com base nos tempos por palavra da faixa FINAL de voz, depois dos cortes.
Comece a exibição em aproximadamente 17 ms, para manter o quadro 0 limpo.
De uma a três palavras por bloco.

Estilo normal:
- Poppins Bold, 74 px.
- Texto branco.
- Contorno preto de 10 px.
- Sem caixa de fundo.

Depois de cada dois ou três blocos normais, destaque uma ou duas palavras relevantes: nome de produto, número, benefício ou palavra da chamada para ação.
Destaques em fonte serifada no estilo Instrument Serif, negrito e itálico, amarelo puro #FFFF00, mesmo tamanho e contorno.
Nunca dois destaques consecutivos.
Não destaque artigos, preposições, conjunções ou outras palavras sem peso semântico.
Mantenha uma posição de legenda por trecho.
As legendas nunca cobrem o rosto, a borda do cartão ou conteúdo importante.

Posicionamento:
- Layout dividido: centralizadas no espaço entre as áreas, de y = 941 a y = 1114.
- Câmera em tela cheia e maioria das composições visuais: parte inferior, de y = 1267 a y = 1536.
- Composição visual com conteúdo na parte inferior: parte superior, de y = 365 a y = 634.
- Encerramento: região central, de y = 1037 a y = 1306.

### Cartão de chamada para ação

Identifique pela transcrição se existe chamada para ação com palavra a ser comentada ("comenta X"). Se não existir, não crie o cartão e registre isso no relatório.

Exiba só durante o encerramento, no terço inferior.
Área do cartão:
- Posição x: 43.
- Posição y: 1344.
- Largura: 994 px.
- Altura: 276 px.

Mostre uma única caixa de comentário centralizada sobre fundo transparente, com avatar genérico.
Digite a palavra pedida na chamada para ação, com cursor piscante. Depois, anime o clique no botão de publicar.
Não acrescente painel, fundo, texto de plataforma ou pedido de mensagem privada.

---

## 7. Áudio [TODOS]

Sintetize a música com NumPy e SciPy, ou com Web Audio API renderizada offline por OfflineAudioContext.
Efeitos sonoros e efeito crescente saem sempre do earshot (`efeitos-sonoros.md`): kit montado a partir do banco, tomadas posicionadas pelos tempos medidos no `kit.lock.json` e escuta final com `earshot timeline`. Não sintetize efeitos à mão.
O resultado deve soar limpo, moderno e sofisticado.

Gere os quatro stems antes da revisão e coloque-os na composição como faixas de áudio, para o usuário ouvir no Studio. A medição final e o master acontecem na exportação.

### Voz

Arquivo: `stems/voice.wav`.
Use a faixa montada com as antecipações de áudio da etapa 2.
Normalize para −14 LUFS integrados.

### Efeitos sonoros

Arquivo: `stems/sfx.wav`, montado com as tomadas do earshot (`efeitos-sonoros.md`).

**Padrão universal: poucos efeitos e bem mais baixos que a voz.** Vale pra todo formato e todo estilo visual, por cima do que o `formato.md`, o arquivo do estilo, o Kit Noite ou `variacoes.md` disserem sobre quantidade e volume. As paletas de efeitos descritas neles definem só o timbre de cada som, e o timbre decide qual som do banco do earshot usar. Só muda se a pessoa pedir (observação, revisão ou ajuste fixo).

- Efeito só nos eventos fortes: carimbo, confirmação, clique em botão, moeda e a entrada do elemento principal de cada cena. Elementos secundários, cascatas e itens de lista entram em silêncio.
- No máximo um efeito a cada 0,6 s. Se dois eventos caírem mais perto que isso, fica só o mais forte.
- Sem sons de tecla (digitação), tique (contadores), 8 bits e risco (anotação à mão).

Os sons que sobram:

1. Clique suave para botões realmente pressionados.
2. Impacto abafado para a chegada do elemento principal (cartão, bloco, dispositivo) ou de um carimbo. [IMAGENS+]
3. Sinal delicado de duas notas para resposta, confirmação ou abertura de janela.
4. Moeda (duas notas curtas) pra um ganho, um prêmio ou um resultado.
5. Som suave de passagem (whoosh do earshot), somente nos movimentos rápidos de câmera. [COMPLETO]

O pico do som de passagem coincide exatamente com o meio do movimento.
No máximo um som de passagem por trecho e três no vídeo inteiro.
Alterne entre três ou quatro variações, sem repetir a mesma em sequência.
Não coloque efeitos em mudanças de layout, deslocamentos suaves da câmera, aproximações, recuos ou zooms.
Na apresentação de um logotipo e na chamada para ação, use só um som de passagem ou nenhum efeito.

Picos em relação ao pico da voz (padrão universal, a voz sempre bem na frente):
- Cliques, impactos, carimbos, moeda e sinais de confirmação: 18 dB abaixo.
- Sons de passagem: 17 dB abaixo.
- Nenhum efeito pode ficar a menos de 15 dB do pico da voz, mesmo que o formato ou o estilo peçam mais alto.

### Efeito crescente da introdução

Arquivo: `stems/riser.wav`.
Som grave crescente de aproximadamente dois a três segundos, do banco do earshot (`riser/dark` ou outro membro da categoria `riser`).
O término audível coincide exatamente com a junção em que o gancho termina e o primeiro ponto começa.
É o único som que pode crescer até um corte.
Pico 22 dB abaixo do pico da voz (8 dB abaixo do antigo padrão, como os efeitos).

### Música

Arquivo: `stems/music.wav`.
Trilha instrumental original, moderna, minimalista e eletrônica, com timbre acolhedor.
Andamento entre 100 e 120 BPM.
Sem voz cantada e sem melodia principal que dispute atenção com a fala.
Cobre toda a duração do vídeo.
Primeira batida no quadro 1.
Sem entrada gradual, exceto suavização de 5 ms para evitar estalos.
Saída gradual de 800 ms no final.
Um único nível de volume durante todo o vídeo, sem redução automática sob a voz e sem automação de volume.
A música fica aproximadamente 10 LU abaixo da voz, em torno de −24 LUFS integrados.

### Master (na exportação)

Some as quatro faixas sem modificar de novo os níveis individuais.
Busque aproximadamente −14 LUFS integrados e pico verdadeiro máximo de −1 dBTP.
Use limitador transparente só se algum pico ultrapassar o limite.
Evite saturação e oscilações artificiais de volume.
Meça as quatro faixas e o master com o filtro ebur128 do FFmpeg. Registre LUFS e pico verdadeiro no relatório, e confira que o pico do `sfx.wav` ficou pelo menos 15 dB abaixo do pico da voz.

---

## 8. Montagem, prévia e render [TODOS]

### 8A. Montagem no HyperFrames

Construa o vídeo com base na tabela de cortes, como um projeto HyperFrames dentro de `edit/`.
- Trechos de câmera em tela cheia: a gravação do usuário.
- Trechos divididos: composição gráfica, cartão de câmera e camada recortada da cabeça. [IMAGENS+]
- Trechos totalmente visuais: só a composição gráfica. [IMAGENS+]

Depois, aplique a capa no quadro 0, as legendas e o cartão da chamada para ação. Coloque os stems de áudio como faixas.
Composição em 1080 × 1920 pixels e 60 quadros por segundo.
Todas as camadas terminam exatamente em END.
Organize a timeline do jeito que o Studio lê bem: cada trecho uma sub-composição, uma faixa de legenda, um tipo de elemento por faixa.

### 8B. Prévia no Studio

Rode `npx hyperframes check` até passar, faça a verificação prévia (9A) e abra o Studio com `npx hyperframes preview --background`. Pare aqui e aguarde a revisão do usuário.

### 8C. Render (somente após aprovação)

**Qualidade da exportação:** a que a pessoa escolheu no painel (`exportacao` em `edit/escolhas.json`, copiada pro `edit/plano.md`). Se a fase 1 foi no chat, pergunte junto com as outras ("Qualidade da exportação?": 4K, Full HD 1080p (Recomendado) ou HD 720p; e 60 fps (Recomendado), 30 ou 24 fps). Sem escolha nenhuma, use Full HD 1080p a 60 fps. Essa escolha vale por cima da resolução e da taxa de quadros escritas no formato, no estilo, nas variações e nos ajustes fixos: os tamanhos de 1080 × 1920 (ou 1920 × 1080) que aparecem neles são o tamanho da composição, que não muda.

Renderize com o áudio master incorporado, H.264 em alta qualidade e AAC estéreo a 48 kHz:

- **Taxa de quadros:** `npx hyperframes render --fps <fps escolhido>`. No nível Completo, renderize os gráficos a 4× a taxa escolhida (240 pra 60, 120 pra 30, 96 pra 24) e combine de 4 em 4 (ver Desfoque de movimento).
- **4K (2160p):** `--resolution portrait-4k` (vertical, 2160 × 3840) ou `--resolution landscape-4k` (horizontal, 3840 × 2160). O HyperFrames desenha a composição em resolução dobrada, então texto e gráficos saem nítidos de verdade.
- **Full HD (1080p):** o tamanho da composição (`--resolution portrait` ou `landscape`).
- **HD (720p):** renderize em 1080p e reduza com FFmpeg (`scale=720:1280:flags=lanczos` no vertical, `1280:720` no horizontal), sem recodificar o áudio.
- A câmera usa a gravação original em resolução cheia: se a gravação for menor que a exportação, ela é ampliada (avise no relatório).
- Confira com `ffprobe` que o `final.mp4` saiu exatamente com a largura, a altura e a taxa de quadros escolhidas.
Não deixe quadro branco, cabeça congelada, imagem sobrando ou silêncio depois do término.

---

## 9. Verificação [TODOS]

### 9A. Verificação prévia (antes de abrir o Studio)

Sem renderizar o vídeo final, use `npx hyperframes check` e quadros soltos (snapshots) da composição para conferir:

1. Legendas sem cobrir rosto ou elementos importantes.
2. Alternância correta das palavras destacadas.
3. Conteúdo dentro das áreas seguras.
4. Ausência de grades e áreas escuras nas composições gráficas. [IMAGENS+]
5. Capa limpa no quadro 0.
6. Cabeça recortada presente desde o PRIMEIRO quadro de cada trecho dividido e alinhada ao cartão em movimentos rápidos. [IMAGENS+]
7. Efeitos e riser posicionados nos eventos certos, de acordo com a tabela de cortes.
8. Nenhuma junção com silêncio acima de 150 ms (medido na faixa de voz).
9. Centro da cabeça exatamente no centro horizontal da área da câmera em todas as tomadas, cortes e movimentos, conforme o bloco 2A. Corrija qualquer desvio, inclusive em tela dividida e na máscara.

Corrija o que falhar antes de abrir o Studio.

### 9B. Verificação final (depois do render)

Inspecione quadros reais do `final.mp4`.
Repita a medição de centralização do bloco 2A no vídeo renderizado: cabeça no centro horizontal da área da câmera, sem desvio à esquerda ou à direita, inclusive em movimentos e mudanças de layout.
Confira os dois lados de cada corte: a nova tomada aparece desde o primeiro quadro previsto, e a anterior fica até o último quadro previsto.
Verifique se a cabeça e o cartão continuam alinhados durante movimentos rápidos. [IMAGENS+]
Gere uma prancha de quadros do vídeo completo e confira os itens 1 a 6 da verificação prévia, mais continuidade visual e ausência de erros de máscara.

Áudio:
1. Cada efeito coincide com seu evento visual, conferido com `earshot timeline` e os cues do vídeo (offset dentro de um quadro).
2. Os sons de passagem aparecem só no meio dos movimentos rápidos. [COMPLETO]
3. O efeito crescente termina na junção correta da introdução.
4. Nenhuma junção contém silêncio acima de 150 ms.
5. As metas de loudness são atingidas com tolerância de ~0,5 LU.
6. O pico verdadeiro do master fica dentro do limite.

Corrija qualquer falha e exporte de novo.
Entregue só depois que a verificação estiver concluída.

---

## RELATÓRIO [TODOS]

`edit/relatorio.md`, com:

1. END em milissegundos.
2. Tabela dos trechos com tempos, layouts e conteúdo.
3. Tomadas escolhidas, frases sem repetição e substituições feitas, incluindo o conteúdo da tomada descartada.
4. Descrição do que cada composição gráfica apresenta. [IMAGENS+]
5. Fatos verificados e respectivas fontes. [IMAGENS+, se a verificação estava ligada]
6. Divergências entre a fala e as fontes. [IMAGENS+, se a verificação estava ligada]
7. Lista dos efeitos sonoros com seus tempos, id do banco do earshot e pico em relação à voz, mais o resultado da escuta com `earshot timeline`.
8. LUFS integrados e pico verdadeiro de cada faixa e do master.
9. Reconstruções de interface, alternativas técnicas e decisões relevantes tomadas na execução.
10. Ajustes pedidos pelo usuário na revisão.
11. Resultado da verificação final.
