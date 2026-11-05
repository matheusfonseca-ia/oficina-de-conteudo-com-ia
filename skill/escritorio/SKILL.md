---
name: escritorio
description: Abre o Escritório de Conteúdo (seis salas de agentes que levam o vídeo do bruto ao post, com a Máquina de Edição). Use quando o usuário chamar /escritorio, disser "abre o escritório", "abrir o escritório de conteúdo" ou "quero mandar um vídeo pro escritório".
---

# Abrir o Escritório de Conteúdo

1. Leia `~/.escritorio-de-conteudo/instalacao.json` e pegue `pasta`. Se o arquivo não existir, diga que o escritório não está instalado e mande rodar o instalador da pasta que a pessoa baixou (`instalar.ps1` no Windows, `instalar.sh` no Mac/Linux). Pare.
2. Entre na pasta `pasta` e rode, em segundo plano, com o caminho entre aspas (costuma ter espaços): `node "<pasta>/serve.mjs" --abrir`. Aqui `~` é a pasta do usuário (`%USERPROFILE%` no Windows). O comando imprime a URL, ou "O escritório já está aberto em …" se já estiver rodando; nos dois casos ele abre o navegador em `http://localhost:4540`. Se o navegador não abrir, peça pra pessoa abrir `http://localhost:4540` à mão.
3. Diga à pessoa, em uma ou duas frases: o escritório abriu no navegador. Pra começar, é só clicar em **Já gravei** ou soltar o vídeo bruto na tela. O escritório avisa quando precisar dela (escolher formato e estilo, aprovar o vídeo, aprovar a legenda).
4. Não edite o vídeo aqui no chat: quem edita é a sala de Edição do escritório.
