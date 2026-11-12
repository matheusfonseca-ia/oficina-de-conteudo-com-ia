# Oficina de Conteúdo com IA

Uma oficina que roda no seu computador: seis salas com agentes de IA que levam o seu vídeo do bruto até o post pronto, usando a Máquina de Edição. Você vê tudo numa cena 3D no navegador e só é chamado quando precisa decidir alguma coisa.

## As seis salas

1. **Pesquisa** (em breve)
2. **Roteiro** (em breve)
3. **Edição** (funciona): edita o vídeo com a Máquina de Edição
4. **Capa** (em breve)
5. **Postagem** (funciona, de forma semiautomática): escreve a legenda e deixa tudo pronto pra você copiar
6. **Análise** (em breve)

Nesta versão você grava o vídeo, joga na Oficina, escolhe o formato e o estilo, assiste o resultado, aprova, e recebe a legenda pronta pra copiar junto com o vídeo pra baixar. As salas marcadas "em breve" aparecem na cena, mas ainda não trabalham.

## O que você precisa antes

- **Máquina de Edição com IA Básico**, instalada e **atualizada, versão com modo escritório**. Essa versão ainda não foi publicada pra todo mundo: enquanto isso não acontecer, o instalador vai parar avisando pra atualizar a Máquina.
- **Node.js 22.13 ou mais novo**
- **Claude Code** instalado e com login feito

## Instalar

Baixe esta pasta, abra o terminal dentro dela e rode:

- Windows: `powershell -ExecutionPolicy Bypass -File .\instalar.ps1`
- Mac ou Linux: `bash instalar.sh`

O instalador confere tudo, prepara a Oficina e instala o comando `/oficina-de-conteudo` no seu Claude Code. Quando aparecer "Pronto!", feche e abra o Claude Code.

## Primeiro uso

1. No Claude Code, digite `/oficina-de-conteudo`. A Oficina abre no navegador (endereço `http://localhost:4540`).
2. Clique em **Já gravei** ou solte o vídeo bruto na tela.
3. Quando a Oficina pedir, escolha o **formato** e o **estilo** do vídeo.
4. Assista o resultado no Studio (a janela onde você assiste e revisa o vídeo). Se gostou, aprove. Se não, peça ajustes.
5. Aprove a legenda, copie o texto e baixe o vídeo.

Se preferir, também dá pra abrir sem o Claude Code: `npm start` dentro da pasta.

## Onde ficam os seus dados

Tudo fica na pasta `~/.oficina-de-conteudo` (na pasta do seu usuário), fora desta pasta. Por isso atualizar a Oficina nunca apaga os seus vídeos nem as suas fichas.

## Conte pra Oficina quem você é

Crie o arquivo `~/.oficina-de-conteudo/cerebro/perfil.md` e escreva, em texto simples:

- o seu **nicho** (sobre o que você fala)
- o seu **público** (pra quem você fala)
- o seu **tom de voz** (como você fala: direto, brincalhão, sério...)

A sala de Postagem usa isso pra escrever a legenda com a sua cara. Sem o arquivo, ela usa um tom direto e casual.

## Atualizar

Se você baixou com git, dentro da pasta rode `git pull` e depois o instalador de novo. Se baixou o ZIP, baixe o ZIP novo, troque a pasta antiga pela nova e rode o instalador de novo. Nos dois casos os seus dados em `~/.oficina-de-conteudo` continuam intactos.

## O que vem nas próximas versões

Roteiro, Pesquisa, Capa, publicação automática pelo Post for Me e Análise.
