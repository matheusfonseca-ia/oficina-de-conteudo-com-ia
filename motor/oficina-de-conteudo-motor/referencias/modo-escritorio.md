# Modo escritório

O Escritório de Conteúdo (upsell da Máquina) roda esta skill sem ninguém no chat. Ele chama o Claude
em segundo plano com um **comando** e espera você gravar o resultado em arquivos. Você está em modo
escritório quando a pasta do vídeo tem `edit/escritorio.json`. Fora disso, nada deste arquivo vale.

## Regras do modo escritório

- **Nunca pergunte nada no chat.** Ninguém vai responder. Se faltar uma informação, use a opção
  "(Recomendado)" da pergunta. Se não houver como seguir, grave `etapa: "erro"` com a explicação.
- **Nunca abra o painel** (`painel/servidor.mjs`): o escritório abre ele sozinho.
- **Mantenha `edit/estado.json` atualizado** a cada passo que demore mais de alguns segundos:
  ```json
  { "etapa": "montando", "progresso": 0.4, "mensagem": "Cortando as pausas", "studioUrl": null, "erro": null, "atualizadoEm": "2026-11-05T14:03:00-03:00" }
  ```
  `mensagem` é curta, em português simples, e aparece no monitor da sala. `progresso` vai de 0 a 1.
  Escreva o arquivo inteiro de uma vez (grave num `.tmp` e renomeie).
- **Termine a execução** depois de gravar o estado final de cada comando. Não fique esperando resposta.
- Erro em qualquer comando: grave `{"etapa":"erro","erro":"<o que aconteceu, em linguagem simples>", ...}`
  e termine. Exemplo: "Falta instalar o FFmpeg. No Windows: winget install ffmpeg". Não tente instalar
  programas do sistema no modo escritório.
- **Nunca renomeie nem mova a pasta do vídeo**, e não mova nem apague arquivos pra fora dela. O
  escritório acha o vídeo por essa pasta (a ficha mora nela): se ela mudar de nome, o vídeo some do
  escritório. Fora de `edit/`, só mexa no que as fases gravam dentro da própria pasta do vídeo.

## Comandos

A mensagem chega como `/oficina-de-conteudo-motor <COMANDO>`.

### PREPARAR
1. `etapa: "preparando"`.
2. Faça a fase 0 e a fase 0b inteiras (sem instalar nada: o que faltar vira erro).
3. Escreva `edit/painel-contexto.json` exatamente como em `referencias/painel.md`, com uma diferença:
   preencha **sempre** o campo `formatos` (não omita: sem ele o painel lista tudo que está instalado) com
   os formatos instalados **menos `cortes-de-video-longo`**. O Cortes de Vídeo Longo gera vários MP4 e
   nenhum `edit/final.mp4`, então não serve pro escritório. Se as preferências salvas usam esse formato
   (`preferencias.formato` igual a `cortes-de-video-longo`), escreva `"preferencias": null`.
4. Grave `etapa: "aguardando-escolhas"`, `progresso: 1`, `mensagem: "Pronto pra você escolher formato e estilo"` e termine.

### ESCOLHAS_PRONTAS
1. Leia `edit/escolhas.json` (a pessoa escolheu no painel) e siga como se o painel tivesse acabado de devolver `ESCOLHAS_SALVAS`.
2. Pule o resumo e o "Posso começar a edição?": a aprovação já veio pelo escritório.
3. Faça a fase 2 inteira, com `etapa: "montando"` e o progresso subindo.
4. Suba o Studio com `npx hyperframes preview --background`, confirme que a URL responde e grave
   `etapa: "revisao"`, `progresso: 1`, `studioUrl: "<url>"`, `mensagem: "Pronto pra você assistir"`. Termine.

### REVISAR: <pedido>
Uma volta do loop de ajustes da fase 3 com esse pedido: altere a composição, rode `npx hyperframes check`.
Se o Studio não responder, suba de novo. Grave `etapa: "revisao"` com o `studioUrl` atual e, em
`mensagem`, o que mudou em uma frase. Termine. Pedido vago: escolha a interpretação mais provável e
diga qual foi na `mensagem`.

### EXPORTAR
É a aprovação explícita da fase 3. Faça a fase 4 (exportação, verificação final, Studio encerrado) com
`etapa: "exportando"`, e depois a fase 5 (preferências). Não renomeie a pasta do vídeo (pule o passo 7
da fase 4) nem mova nada pra fora dela. O MP4 final fica em `edit/final.mp4`. Escreva também `edit/resumo.md`:

    # Resumo do vídeo
    Tema: <uma frase>
    Formato: <formato> · Estilo: <estilo> · Duração: <mm:ss> · Proporção: <9:16|16:9>
    ## O que é dito
    <3 a 6 frases curtas com as ideias principais, na ordem>
    ## Gancho
    <a primeira frase falada>

Grave `etapa: "exportado"`, `progresso: 1`, `mensagem: "MP4 pronto"`, `studioUrl: null`. Termine.

### REABRIR_STUDIO
O computador reiniciou e o Studio caiu. Suba de novo com `npx hyperframes preview --background` na
pasta do projeto, confirme que responde e grave `etapa: "revisao"` com o novo `studioUrl`. Termine.
