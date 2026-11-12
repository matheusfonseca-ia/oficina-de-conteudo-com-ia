# B-roll e imagens da internet

Quando um formato usa clipes de apoio (B-roll) ou imagens e a pessoa não trouxe os dela, você busca sozinho na internet. A pessoa não precisa criar pasta nem juntar arquivo nenhum.

Vale quando:

- a escolha de B-roll foi "Buscar clipes na internet" (é o padrão quando a pasta `broll/` não existe);
- a pasta `broll/` tem menos clipes que os pontos de B-roll do vídeo: complete com clipes da internet;
- um formato precisa de imagem e a pasta `imagens/` não tem uma que sirva.

## Onde buscar

Em qualquer lugar da internet. Não se limite a bancos com licença livre: o critério é achar o clipe ou a imagem que mostra melhor o que a pessoa está falando, com boa qualidade.

Lugares que costumam render, sem ordem fixa (escolha pelo assunto):

- **Coisa real citada na fala** (produto, empresa, pessoa pública, notícia, app, site): vá na fonte. Site oficial, página do produto, canal oficial no YouTube, matéria do portal de notícias, perfil oficial na rede social.
- **YouTube e outras plataformas de vídeo**: busque com `yt-dlp` e baixe só o trecho que vai usar.

  ```bash
  yt-dlp "ytsearch10:laptop typing night desk" --flat-playlist --print "%(id)s | %(title)s | %(duration)s"
  yt-dlp -f "bv*[height<=1080][ext=mp4]+ba/b[height<=1080]" --download-sections "*00:01:12-00:01:20" \
    -o "tmp-broll/%(id)s.%(ext)s" "https://www.youtube.com/watch?v=ID"
  ```

  `yt-dlp` também baixa de Vimeo, X, Reddit, Instagram e TikTok quando o post é público. Se pedir login, pule pra outra fonte.
- **Bancos de vídeo e imagem** (Pexels, Pixabay, Mixkit, Coverr, Unsplash, Wikimedia Commons): bons pra cena genérica (pessoa no computador, cidade, café, dinheiro), sem marca d'água e em alta resolução. Pexels e Pixabay têm API com chave grátis (`PEXELS_API_KEY`, `PIXABAY_API_KEY`, nas variáveis de ambiente ou em `~/.maquina-de-edicao/chaves.env`, linhas `NOME=valor`); sem chave, use a busca do site ou o Commons, que não pede chave:

  ```bash
  curl -s -H "Authorization: $PEXELS_API_KEY" \
    "https://api.pexels.com/videos/search?query=woman%20typing%20laptop&orientation=portrait&size=medium&per_page=15"
  curl -s -A "MaquinaDeEdicao/1.0" "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=filetype:video%20laptop%20typing&gsrnamespace=6&gsrlimit=15&prop=videoinfo&viprop=url|size|mime"
  ```
- **Imagens**: busca de imagens (Google, Bing, DuckDuckGo), o próprio site da fonte, ou a skill `media-use` do HyperFrames se estiver disponível. Prefira o arquivo original em alta resolução ao miniatura do buscador. Pra página ou post, capture a tela com `npx hyperframes capture` ou pelo navegador.

**Sem clipe que sirva** pra uma frase: use imagem no lugar, com aproximação lenta (escala 1 → 1,06 no trecho todo), como na opção "Usar só imagens". Sem imagem que sirva: card gráfico no estilo.

## Como buscar

1. Depois da transcrição e dos cortes, marque os pontos de B-roll do formato (ex: Reels com B-roll: a cada 3–6 s, nas frases que dá pra mostrar). Em `edit/plano.md`, monte a tabela **"frase → o que mostrar → busca"**.
2. Pra cena genérica, busque em **inglês**, com 2 a 4 palavras concretas do que aparece na tela, não do conceito: "vender mais no direct" vira `phone notification shopping`; "trabalhar de madrugada" vira `laptop night desk`. Pra coisa brasileira ou citada pelo nome (marca, pessoa, notícia daqui), busque em português e pelo nome.
3. Pra vídeo vertical, prefira material vertical quando houver. Clipe horizontal também serve: o formato tem layout pra ele.
4. Baixe 2 ou 3 candidatos por ponto pra uma pasta temporária (`tmp-broll/`), extraia 3 quadros de cada (início, meio, fim) e olhe. Descarte:
   - marca d'água grande, logo de outro canal ou legenda queimada que atrapalhe;
   - pessoa olhando pra câmera ou falando (parece outro vídeo);
   - qualidade baixa (lado menor < 720 px), tremida forte, cortes no meio;
   - qualquer coisa que contradiga a fala ou mostre outra marca no lugar da citada.
5. Copie o escolhido pra `broll/` (clipes) ou `imagens/` (imagens) com nome descritivo (`notificacao-celular-01.mp4`) e corte só o trecho que vai usar, com 0,5 s de folga em cada lado. Tire o áudio do clipe: o som do vídeo é a fala da pessoa.
6. Registre a origem de cada arquivo em `broll/origens.md` (ou `imagens/origens.md`): arquivo, de onde veio, autor ou canal, link. Leve essa lista pro relatório, pra pessoa saber de onde veio cada coisa e dar crédito se quiser.
7. A partir daqui, siga "Como escolher os clipes" do formato como se a pasta tivesse vindo da pessoa.

## Arquivos enviados pela pessoa

Se a pessoa subiu imagens ou clipes pelo painel (pastas `imagens/` e `broll/`), eles valem mais que qualquer coisa buscada: use primeiro, casando o nome do arquivo e o conteúdo com a fala.
