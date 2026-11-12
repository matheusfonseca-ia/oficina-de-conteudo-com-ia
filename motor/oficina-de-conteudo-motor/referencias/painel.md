# Painel de escolhas

Página local (só no computador da pessoa) onde ela faz todas as escolhas da entrevista vendo uma prévia animada de como o vídeo vai ficar (com um bonequinho no lugar da pessoa). Substitui as perguntas no chat da fase 1. Fica em `painel/` dentro desta skill e só precisa do Node (sem `npm install`).

## Como abrir

1. Escreva `edit/painel-contexto.json` na pasta do vídeo (formato abaixo).
2. Rode **em segundo plano** (o comando fica esperando a pessoa):

   ```bash
   node "<pasta desta skill>/painel/servidor.mjs" --contexto edit/painel-contexto.json --saida edit/escolhas.json
   ```

   Ele abre o navegador sozinho em `http://localhost:<porta>/` (porta 4517; se estiver ocupada, a próxima livre até 4530) e imprime `PAINEL_ABERTO <url>`. Só aceita conexões do próprio computador.
3. Mande pra pessoa:

   > Abri uma página no seu navegador pra você escolher como o vídeo vai ficar. Cada escolha aparece numa prévia animada. Quando terminar, clique em **Começar a edição** e volte aqui.
   >
   > Se a página não abriu, use este link: <url>

4. Espere o comando terminar. A última linha diz o que aconteceu:

| Saída | Código | O que fazer |
|---|---|---|
| `ESCOLHAS_SALVAS <caminho>` | 0 | Leia o JSON e siga (ver "Ler as escolhas") |
| `PREFERE_CHAT` | 3 | A pessoa pediu as perguntas no chat: faça a fase 1 do jeito antigo |
| `TEMPO_ESGOTADO` | 2 | Passou 1 hora sem resposta: abra o painel de novo e mande o link |
| erro ao iniciar | outro | Leia o erro, corrija (ex: `--porta` com outra porta livre, caminho do contexto) e abra de novo. Não troque pelo chat sem a pessoa pedir |

Se a pessoa escrever no chat que já escolheu ("pronto", "terminei") antes do comando terminar, confira se `edit/escolhas.json` existe e siga com ele.

## O contexto (`edit/painel-contexto.json`)

Tudo que a fase 0 descobriu. Campos ausentes viram "não tem".

```json
{
  "pasta": "<caminho absoluto da pasta do vídeo>",
  "videos": [{ "arquivo": "IMG_7071.MOV", "caminho": "IMG_7071.MOV", "orientacao": "vertical", "resolucao": "2160x3840", "fps": 60, "duracao": 870.9 }],
  "audios": [{ "arquivo": "lapela.wav", "caminho": "lapela.wav" }],
  "pastas": { "broll": false, "imagens": false, "roteiro": false },
  "formatos": ["reels-de-negocio", "..."],
  "estilosVisuais": [
    { "id": "pixelado", "nome": "Pixelado", "resumo": "...", "origem": "maquina" },
    { "id": "neon-roxo", "nome": "Neon Roxo", "resumo": "...", "origem": "pessoa",
      "cores": { "fundo": "#0B0614", "destaque": "#B44DFF", "texto": "#FFFFFF", "card": "#1A1226" } }
  ],
  "preferencias": null,
  "formatoFixo": null,
  "ferramentas": { "node": "v24.14.1", "ffmpeg": "8.1.1", "python": "3.12.4", "hyperframes": "0.9.2" }
}
```

- `videos`: todos os vídeos da pasta, com o que o `ffprobe` mostrou. Se houver mais de um, a pessoa escolhe na página.
- `audios`: os arquivos de áudio da pasta. A página pergunta o que é cada um (voz, música ou não usar).
- `formatos`: as pastas de formato que existem ao lado desta skill, com `SKILL.md` e `formato.md`. São dez após instalar o principal e 20 com o complemento; `[]` significa nenhum. O servidor confere essa lista no disco. Não inclua pastas de formatos extras ainda não instalados. Se omitir o campo, o servidor detecta as skills vizinhas.
- `estilosVisuais`: os de `estilos-visuais/` (origem `maquina`) e os de `~/.maquina-de-edicao/estilos-visuais/` (origem `pessoa`). Nos da pessoa, preencha `cores` com os valores do arquivo (fundo das telas gráficas, cor de destaque, texto principal, card): é o que a prévia usa pra desenhar.
- `preferencias`: `null` se não existir `preferencias.md`. Se existir:

  ```json
  {
    "resumo": [["Formato pronto", "nenhum"], ["Estilo visual", "Pixelado"], ["Música", "Sem música"]],
    "formato": "reels-de-negocio",
    "estiloVisual": "pixelado",
    "zero": { "proporcao": "vertical", "nivel": "completo", "legendas": "padrao", "estilo": "claro", "musica": "eletronica", "efeitos": "completos", "verificar": "sim" },
    "corMarca": "#9A4DFF",
    "ajustesFixos": ["Legendas 15% maiores que o padrão"],
    "musicaDaPasta": false,
    "exportacao": { "resolucao": "1080p", "fps": 60 }
  }
  ```

  `resumo` é o que a página mostra no "Repetir o último vídeo", em linguagem simples. `zero` só quando o último vídeo foi do zero; os valores usam os ids de `painel/dados.js` (`ZERO`). `exportacao` vem da linha "Exportação" das preferências (se existir) e já deixa essa qualidade marcada na página.
- `formatoFixo`: o id do formato quando a skill foi chamada por uma skill de formato (ex: `/reels-de-negocio`). A página já abre nele.

## Ler as escolhas (`edit/escolhas.json`)

```json
{
  "caminho": "formato-pronto",
  "video": "IMG_7071.MOV",
  "audios": [{ "arquivo": "lapela.wav", "uso": "voz", "usoTexto": "áudio limpo da minha voz (microfone/lapela)" }],
  "formato": { "id": "reels-de-negocio", "nome": "Reels de Negócio" },
  "estiloVisual": { "id": "pixelado", "nome": "Pixelado" },
  "respostas": { "musica": "A do estilo", "efeitos": "Os do estilo", "corDestaque": "A do estilo", "corMarca": null, "aplicarAjustesFixos": true, "cortes": null, "broll": null },
  "resumo": [["Formato", "Reels de Negócio"], ["Estilo visual", "Pixelado"]],
  "observacoes": "corta a parte em que eu tusso no começo; o produto se chama Falow, com F maiúsculo",
  "imagensEnviadas": ["imagens/print-do-painel.png"],
  "brollEnviados": [],
  "exportacao": { "resolucao": "1080p", "nome": "Full HD", "largura": 1080, "altura": 1920, "fps": 60 }
}
```

- `caminho`: `formato-pronto`, `do-zero` ou `repetir-ultimo`.
- Os textos de `respostas` são as mesmas opções das perguntas desta skill. Siga a fase 1 como se a pessoa tivesse respondido no chat, sem perguntar de novo.
- `estiloVisual.id` é o nome do arquivo do estilo (`pixelado`, `noite-laranja`...) ou `original`. No caminho do zero, é a opção da pergunta 4 (`claro`, `escuro`, `pixelado`, `marca`, `noite-laranja` ou o id de um estilo da pessoa).
- `do-zero` traz `padraoCompleto` (true quando a pessoa escolheu o padrão completo) e, se ela escolheu as cores da marca, `respostas.marca` com cor, fundo e fonte.
- `repetir-ultimo` traz só o que depende deste vídeo (a música, quando a da pasta não existe). O resto vem de `preferencias.md`.
- `resumo` é a tabela pronta pro resumo da fase 1.
- `observacoes`: o que a pessoa escreveu no campo "Observações" da página (opcional; `null` quando ficou vazio). Veja "Observações" no SKILL.md.
- `imagensEnviadas` e `brollEnviados`: arquivos que a pessoa subiu pela página (opcional; listas vazias quando ela não subiu nada). O servidor grava direto na pasta do vídeo, em `imagens/` e `broll/`, e nunca sobrescreve: se o nome já existe, acrescenta um número. Use esses arquivos antes de buscar qualquer coisa.
- `exportacao`: a qualidade do MP4 final que a pessoa escolheu no fim da página (4K 2160p, Full HD 1080p ou HD 720p; 60, 30 ou 24 fps), com a largura e a altura já na proporção do vídeo final. Copie pro `edit/plano.md` (seção "Exportação") e use só na fase 4, depois da aprovação. Não pergunte de novo.
- `respostas.broll` (só no Reels com B-roll): de onde vêm os clipes. "Buscar clipes na internet" quer dizer seguir `broll-da-internet.md`.

O envio aceita imagens (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`, `.heic`, até 50 MB cada) e vídeos (`.mp4`, `.mov`, `.m4v`, `.webm`, `.mkv`, até 4 GB cada). A pasta do vídeo é a do campo `pasta` do contexto: preencha sempre com o caminho absoluto.

A pessoa já viu e confirmou o resumo na página. Mostre a tabela no chat (com as observações embaixo, se houver), avise que a edição começou e siga direto pra fase 2, **sem** perguntar "Posso começar a edição?".
