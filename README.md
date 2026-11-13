# Oficina de Conteúdo com IA

Uma oficina que roda no seu computador: seis salas com agentes de IA que levam o seu vídeo do bruto até o post pronto, usando a Máquina de Edição. Você vê tudo numa cena 3D no navegador e só é chamado quando precisa decidir alguma coisa.

## As seis salas

1. **Pesquisa** (funciona): acha na web vídeos que já funcionaram sobre a sua ideia e explica por quê
2. **Roteiro** (funciona): escreve o roteiro no seu tom de voz pra você gravar lendo
3. **Edição** (funciona): edita o vídeo com a Máquina de Edição
4. **Capa** (funciona): escolhe o melhor momento do vídeo e monta 2 ou 3 capas com título; com a sua chave do Higgsfield, faz mais uma com IA
5. **Postagem** (funciona): escreve a legenda; com o Post for Me, publica ou agenda nas suas redes
6. **Análise** (funciona, com o Post for Me): lê os números de 48 horas e 7 dias, conta o que funcionou e faz um resumo por semana

Você pode começar de dois jeitos. **Tenho uma ideia**: a Pesquisa traz referências, você escolhe uma, o Roteiro escreve o texto, você aprova, grava lendo e manda a gravação pelo próprio cartão. **Já gravei**: você joga o vídeo e ele vai direto pra Edição. Nos dois casos, você escolhe o formato e o estilo, aprova o vídeo e, na aprovação do post, escolhe a capa e recebe a legenda pronta. Se você conectar o Post for Me, a Postagem publica (ou agenda) nas suas redes e a Análise volta nos posts depois de 48 horas e de 7 dias pra ler os números e contar o que funcionou. Sem o Post for Me, você copia a legenda, baixa o vídeo e posta na mão; a Análise fica parada, porque não tem de onde ler os números.

## O que você precisa antes

- **Máquina de Edição com IA Básico** instalada. Os formatos, os efeitos sonoros e os efeitos de vídeo vêm dela; com o Completo instalado, os formatos dele também aparecem. A Oficina traz o próprio motor de edição, então não é preciso mexer na Máquina.
- **Node.js 22.13 ou mais novo**
- **Claude Code** instalado e com login feito
- **Google Chrome** ou **Microsoft Edge**: a sala de Capa usa o navegador pra montar a imagem da capa
- **Post for Me** (opcional): só pra publicar daqui e pra Análise ler os números. Veja em Conexões.

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
5. Aprove a legenda. Com o Post for Me conectado, marque as redes e clique em **Publicar** (agora) ou em **Agendar**. Sem ele, copie o texto, baixe o vídeo e poste na mão.

Se preferir, também dá pra abrir sem o Claude Code: `npm start` dentro da pasta.

## Onde ficam os seus dados

Tudo fica na pasta `~/.oficina-de-conteudo` (na pasta do seu usuário), fora desta pasta. Por isso atualizar a Oficina nunca apaga os seus vídeos nem as suas fichas.

## Conte pra Oficina quem você é

Na primeira vez que você abre a Oficina, o chefe pergunta, uma pergunta por vez, o seu nicho, o seu público, o seu tom de voz, o @ do seu perfil e até 3 perfis que você admira. Pesquisa, Roteiro, Capa e Postagem usam isso. Pra mudar depois, clique no **chefe**, no meio da Oficina. Cada vez que você pede um ajuste na Pesquisa, no Roteiro, na capa ou na legenda, a Oficina anota e leva em conta nos próximos vídeos (fica em `~/.oficina-de-conteudo/cerebro/aprendizados/`).

## Conexões

Clique no chefe e abra a aba **Conexões** (ou clique em **Conectar Higgsfield** na placa da Capa).

- **Higgsfield:** gera mais uma opção de capa com IA a partir do seu vídeo. Crie a chave em [cloud.higgsfield.ai](https://cloud.higgsfield.ai) e cole no formato `ID:SEGREDO`. Cada capa gerada usa crédito da sua conta do Higgsfield.
- **Post for Me:** libera a publicação e o agendamento direto da Oficina, nas redes que você conectou, e deixa a Análise ler os números dos seus posts. Custa **US$ 10 por mês**, cobrados pelo próprio Post for Me (não pela Oficina). Crie a conta e a chave em [app.postforme.dev](https://app.postforme.dev) e cole na Oficina. Conecte as suas redes (Instagram, TikTok, YouTube e outras) lá no próprio Post for Me e, na hora de conectar, deixe marcada a permissão de **ler o feed**: sem ela a Análise não consegue ver os números. Dois avisos que a Oficina também mostra ao escolher as redes:
  - **Instagram:** pela API do Post for Me o Reels sai **sem música**, e sem música ele quase não entra na aba de Reels.
  - **TikTok:** o vídeo chega como **rascunho** no app do TikTok; você escolhe a música e publica de lá.
  - **YouTube:** o Short sai **público**, não privado, porque um Short privado não deixa a Análise ler os números.

As chaves ficam só no seu computador, em `~/.oficina-de-conteudo/config.json`, e a Oficina testa cada uma antes de salvar. Sem a do Higgsfield, a Capa continua funcionando com as capas de frame e título. Sem a do Post for Me, você posta na mão e a Análise fica parada.

## A Análise precisa da Oficina aberta

Os números são lidos 48 horas e 7 dias depois do post, e quem faz essa conferência é a própria Oficina (a janela do Claude Code que a abriu). Se ela estiver fechada na hora, a leitura acontece quando você abrir de novo. Se você ficar muitos dias sem abrir, a Oficina faz só a leitura de 7 dias. Quando um post nem aparece no feed da rede, a Análise anota "post não encontrado" e conclui. Uma vez por semana ela também escreve um resumo da semana anterior, que aparece no topo da lista.

## Atualizar

Se você baixou com git, dentro da pasta rode `git pull` e depois o instalador de novo. Se baixou o ZIP, baixe o ZIP novo, troque a pasta antiga pela nova e rode o instalador de novo. Nos dois casos os seus dados em `~/.oficina-de-conteudo` continuam intactos.

## O que vem nas próximas versões

Calendário, pesquisa com Apify e números sem o Post for Me.
