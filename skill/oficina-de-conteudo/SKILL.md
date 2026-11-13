---
name: oficina-de-conteudo
description: Abre a Oficina de Conteúdo com IA (seis salas de agentes que levam o vídeo do bruto ao post, com a Máquina de Edição). Use quando o usuário chamar /oficina-de-conteudo, disser "abre a oficina", "abrir a oficina de conteúdo" ou "quero mandar um vídeo pra oficina".
---

# Abrir a Oficina de Conteúdo

1. Leia `~/.oficina-de-conteudo/instalacao.json` e pegue `pasta`. Se o arquivo não existir, diga que a Oficina não está instalada e mande rodar o instalador da pasta que a pessoa baixou (`instalar.ps1` no Windows, `instalar.sh` no Mac/Linux). Pare.
2. Entre na pasta `pasta` e rode, em segundo plano, com o caminho entre aspas (costuma ter espaços): `node "<pasta>/serve.mjs" --abrir`. Aqui `~` é a pasta do usuário (`%USERPROFILE%` no Windows). O comando imprime a URL, ou "A Oficina já está aberta em …" se já estiver rodando; nos dois casos ele abre o navegador em `http://localhost:4540`. Se o navegador não abrir, peça pra pessoa abrir `http://localhost:4540` à mão.
3. Diga à pessoa, em uma ou duas frases: a Oficina abriu no navegador. Pra começar, é só clicar em **Tenho uma ideia** (a Oficina pesquisa e escreve o roteiro) ou em **Já gravei** (ou soltar o vídeo bruto na tela). A Oficina avisa quando precisar dela (escolher a referência, aprovar o roteiro, escolher formato e estilo, aprovar o vídeo, escolher a capa e aprovar a legenda). A sala de Capa usa o Google Chrome ou o Microsoft Edge do computador pra montar a imagem. Avise também: deixe esta janela do Claude Code aberta enquanto a Oficina trabalha, porque fechar ela fecha a Oficina. Se fechar, os vídeos que estavam em andamento continuam de onde pararam quando ela abrir o Claude Code e chamar /oficina-de-conteudo de novo.
4. Não edite o vídeo aqui no chat: quem edita é a sala de Edição da Oficina.
