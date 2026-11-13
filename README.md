# Oficina de Conteúdo com IA

Uma oficina que roda no seu computador: seis salas com agentes de IA que levam o seu vídeo do bruto até o post pronto, usando a Máquina de Edição. Você vê tudo numa cena 3D no navegador e só é chamado quando precisa decidir alguma coisa.

## As seis salas

1. **Pesquisa** (funciona): acha na web vídeos que já funcionaram sobre a sua ideia e explica por quê
2. **Roteiro** (funciona): escreve o roteiro no seu tom de voz pra você gravar lendo
3. **Edição** (funciona): edita o vídeo com a Máquina de Edição
4. **Capa** (funciona): escolhe o melhor momento do vídeo e monta 2 ou 3 capas com título; com a sua chave do Higgsfield, faz mais uma com IA
5. **Postagem** (funciona, de forma semiautomática): escreve a legenda e deixa tudo pronto pra você copiar
6. **Análise** (em breve)

Você pode começar de dois jeitos. **Tenho uma ideia**: a Pesquisa traz referências, você escolhe uma, o Roteiro escreve o texto, você aprova, grava lendo e manda a gravação pelo próprio cartão. **Já gravei**: você joga o vídeo e ele vai direto pra Edição. Nos dois casos, você escolhe o formato e o estilo, aprova o vídeo e, na aprovação do post, escolhe a capa e recebe a legenda pronta. A Análise aparece na cena, mas ainda não trabalha.

## O que você precisa antes

- **Máquina de Edição com IA Básico** instalada. Os formatos, os efeitos sonoros e os efeitos de vídeo vêm dela; com o Completo instalado, os formatos dele também aparecem. A Oficina traz o próprio motor de edição, então não é preciso mexer na Máquina.
- **Node.js 22.13 ou mais novo**
- **Claude Code** instalado e com login feito
- **Google Chrome** ou **Microsoft Edge**: a sala de Capa usa o navegador pra montar a imagem da capa

## Instalar

Baixe esta pasta, abra o terminal dentro dela e rode:

- Windows: `powershell -ExecutionPolicy Bypass -File .\instalar.ps1`
- Mac ou Linux: `bash instalar.sh`

O instalador confere tudo, prepara a Oficina e instala no seu Claude Code o comando `/oficina-de-conteudo` e o motor de edição da Oficina. Quando aparecer "Pronto!", feche e abra o Claude Code.

## Primeiro uso

1. No Claude Code, digite `/oficina-de-conteudo`. A Oficina abre no navegador (endereço `http://localhost:4540`).
2. Escolha como começar: clique em **Tenho uma ideia** (a Pesquisa traz referências e o Roteiro escreve o texto pra você gravar) ou em **Já gravei** / solte o vídeo bruto na tela (ele vai direto pra Edição).
3. Quando a Oficina pedir, escolha o **formato** e o **estilo** do vídeo.
4. Assista o resultado no Studio (a janela onde você assiste e revisa o vídeo). Se gostou, aprove. Se não, peça ajustes.
5. Aprove a legenda, copie o texto e baixe o vídeo.

Se preferir, também dá pra abrir sem o Claude Code: `npm start` dentro da pasta.

## Onde ficam os seus dados

Tudo fica na pasta `~/.oficina-de-conteudo` (na pasta do seu usuário), fora desta pasta. Por isso atualizar a Oficina nunca apaga os seus vídeos nem as suas fichas.

## Conte pra Oficina quem você é

Na primeira vez que você abre a Oficina, o chefe pergunta, uma pergunta por vez, o seu nicho, o seu público, o seu tom de voz, o @ do seu perfil e até 3 perfis que você admira. Pesquisa, Roteiro, Capa e Postagem usam isso. Pra mudar depois, clique no **chefe**, no meio da Oficina. Cada vez que você pede um ajuste na Pesquisa, no Roteiro, na capa ou na legenda, a Oficina anota e leva em conta nos próximos vídeos (fica em `~/.oficina-de-conteudo/cerebro/aprendizados/`).

## Conexões

Clique no chefe e abra a aba **Conexões** (ou clique em **Conectar Higgsfield** na placa da Capa).

- **Higgsfield:** gera mais uma opção de capa com IA a partir do seu vídeo. Crie a chave em [cloud.higgsfield.ai](https://cloud.higgsfield.ai) e cole no formato `ID:SEGREDO`. Cada capa gerada usa crédito da sua conta do Higgsfield.

A chave fica só no seu computador, em `~/.oficina-de-conteudo/config.json`, e a Oficina testa antes de salvar. Sem ela, a Capa continua funcionando com as capas de frame e título.

## Atualizar

Se você baixou com git, dentro da pasta rode `git pull` e depois o instalador de novo. Se baixou o ZIP, baixe o ZIP novo, troque a pasta antiga pela nova e rode o instalador de novo. Nos dois casos os seus dados em `~/.oficina-de-conteudo` continuam intactos.

## O que vem nas próximas versões

Publicação automática pelo Post for Me e a sala de Análise.
