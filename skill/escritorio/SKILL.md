---
name: escritorio
description: Abre o Escritório de Conteúdo (seis salas de agentes que levam o vídeo do bruto ao post, com a Máquina de Edição). Use quando o usuário chamar /escritorio, disser "abre o escritório", "abrir o escritório de conteúdo" ou "quero mandar um vídeo pro escritório".
---

# Abrir o Escritório de Conteúdo

1. Leia `~/.escritorio-de-conteudo/instalacao.json` e pegue `pasta`. Se o arquivo não existir, diga que o escritório não está instalado e mande rodar o instalador da pasta que a pessoa baixou (`instalar.ps1` no Windows, `instalar.sh` no Mac/Linux). Pare.
2. Rode em segundo plano, dentro de `pasta`: `node serve.mjs --abrir`. Ele abre o navegador em `http://localhost:4540`. Se o escritório já estiver aberto, ele só abre a página.
3. Diga à pessoa, em uma ou duas frases: o escritório abriu no navegador. Pra começar, é só clicar em **Já gravei** ou soltar o vídeo bruto na tela. O escritório avisa quando precisar dela (escolher formato e estilo, aprovar o vídeo, aprovar a legenda).
4. Não edite o vídeo aqui no chat: quem edita é a sala de Edição do escritório.
