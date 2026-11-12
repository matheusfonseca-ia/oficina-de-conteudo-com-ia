// Catálogo do painel. Os textos das opções são os mesmos do SKILL.md e do
// formatos-prontos.md: é com eles que o Claude lê as escolhas depois.

export const FORMATOS = [
  { id: 'reels-de-negocio', nome: 'Reels de Negócio', orient: 'v', capa: true,
    desc: 'Alterna câmera cheia, tela dividida e animação em tela cheia a cada corte',
    original: 'Preto com brilho laranja e cards de vidro', originalIgual: 'noite-laranja' },
  { id: 'reels-com-broll', nome: 'Reels com B-roll', orient: 'v', capa: false,
    desc: 'Corte rápido, clipes de apoio (seus ou buscados na internet) e frases-chave empilhadas na legenda',
    original: 'Sua gravação e seus clipes, com a frase-chave empilhada em laranja' },
  { id: 'tela-dividida-explicativa', nome: 'Tela Dividida Explicativa', orient: 'v', capa: true,
    desc: 'Você embaixo e a explicação em cima, com cards, contadores e gráficos que se desenham',
    original: 'Preto com pontinhos, brilho laranja e cards de vidro', originalIgual: 'noite-laranja' },
  { id: 'ensaio-visual', nome: 'Ensaio Visual', orient: 'v', capa: true,
    desc: 'Você recortado e as provas (posts, notícias, números) aparecendo acima de você',
    original: 'Preto com brilho laranja embaixo e as provas em cards brancos' },
  { id: 'legenda-encaixada', nome: 'Legenda Encaixada', orient: 'v', capa: false,
    desc: 'Uma palavra gigante em destaque e o resto da frase encaixado em volta',
    original: 'Legenda branca com a palavra gigante em serifa laranja' },
  { id: 'nuvem-de-imagens', nome: 'Nuvem de Imagens', orient: 'v', capa: false,
    desc: 'Grupos de imagens acima da sua cabeça e legenda pequena e discreta',
    original: 'Fotos com sombra suave e legenda minúscula ao lado do rosto' },
  { id: 'recorte-com-imagens', nome: 'Recorte com Imagens', orient: 'v', capa: true,
    desc: 'Você recortado na frente de imagens em tela cheia que trocam a cada ideia',
    original: 'Imagens em tela cheia e legenda fina, condensada' },
  { id: 'telas-em-profundidade', nome: 'Telas em Profundidade', orient: 'v', capa: true,
    desc: 'Você em tela cheia com interfaces e telas reais atrás da sua cabeça',
    original: 'Painéis escuros com laranja pro que está andando e verde pro que deu certo' },
  { id: 'formato-ranking', nome: 'Formato Ranking', orient: 'v', capa: false,
    desc: 'Tier list que vai se preenchendo conforme você ranqueia',
    original: 'Tier list colorida de S a F, letras grossas em itálico' },
  { id: 'palavra-atras-da-cabeca', nome: 'Palavra Atrás da Cabeça', orient: 'v', capa: false,
    desc: 'Uma palavra gigante cai atrás da sua cabeça nas palavras mais fortes',
    original: 'Sua gravação, palavra creme gigante e risco e giz vermelhos' },
  { id: 'checklist-na-tela', nome: 'Checklist na Tela', orient: 'v', capa: false,
    desc: 'A lista do que você fala aparece e cada item ganha ✓ na hora certa',
    original: 'Sua gravação com cards de lista e ✓ verdes' },
  { id: 'zoom-na-palavra', nome: 'Zoom na Palavra', orient: 'v', capa: false,
    desc: 'Aproximação rápida nas palavras fortes e mira travando no seu rosto',
    original: 'Sua gravação, legenda grande com a palavra forte em amarelo' },
  { id: 'marcacoes', nome: 'Marcações', orient: 'v', capa: false,
    desc: 'Imagem congela com seta à mão, fita no peito, caixa que aumenta o número',
    original: 'Sua gravação com caneta amarela, fita adesiva e caixa de seleção azul' },
  { id: 'widgets-de-vidro', nome: 'Widgets de Vidro', orient: 'v', capa: false,
    desc: 'Widgets de vidro em volta da cabeça e gráficos de vidro subindo',
    original: 'Vidro fosco, gráfico verde e um leve tom quente' },
  { id: 'cards-em-orbita', nome: 'Cards em Órbita', orient: 'v', capa: false,
    desc: 'Seus posts girando em volta da cabeça, em carrossel 3D ou em leque',
    original: 'Sua gravação com os seus posts em volta' },
  { id: 'capa-de-revista', nome: 'Capa de Revista', orient: 'v', capa: false,
    desc: 'Você vira capa de revista e as frases fortes viram colagem vermelha',
    original: 'Vermelho de revista, preto e branco e letras grossas' },
  { id: 'grade-do-perfil', nome: 'Grade do Perfil', orient: 'v', capa: false,
    desc: 'Você no centro da grade do perfil, com os reels e as visualizações em volta',
    original: 'A interface do Instagram em vidro, com contador subindo' },
  { id: 'cortes-de-video-longo', nome: 'Cortes de Vídeo Longo', orient: 'v', capa: true,
    desc: 'Entra um vídeo longo ou uma call, saem cortes verticais ranqueados',
    original: 'Preto com brilho laranja e cards de vidro', originalIgual: 'noite-laranja' },
  { id: 'youtube-educativo', nome: 'YouTube Educativo', orient: 'h', capa: false,
    desc: 'Vídeo longo com cards sobre a câmera, tela dividida e animações explicativas',
    original: 'Preto com brilho laranja e cards de vidro', originalIgual: 'noite-laranja' },
  { id: 'aula-em-tela-dividida', nome: 'Aula em Tela Dividida', orient: 'h', capa: false,
    desc: 'O documento da aula rola na esquerda e você fica na direita; o documento é gerado junto',
    original: 'Documento branco com título em serifa e marca-texto amarelo' },
];

// Estilos visuais que vêm com a Máquina. Os da pessoa chegam pelo contexto.
export const ESTILOS_MAQUINA = {
  'noite-laranja': { nome: 'Noite Laranja',
    resumo: 'Fundo preto com brilho laranja difuso, cards de vidro, legenda branca com uma palavra em serifa itálica laranja.' },
  'claro-tecnologico': { nome: 'Claro Tecnológico',
    resumo: 'Cartões brancos flutuando sobre fundo quase branco, legenda branca com contorno e palavra-chave amarela.' },
  'pixelado': { nome: 'Pixelado',
    resumo: 'Creme quadriculado, legenda em pílula escura e cada frase virando uma cena animada, com clímax de videogame em pixel art.' },
};

// Caminho do zero: as perguntas e as opções, na ordem da skill.
export const ZERO = {
  proporcao: [
    { id: 'vertical', rotulo: 'Vertical 9:16', sub: 'Reels, TikTok, Shorts' },
    { id: 'horizontal', rotulo: 'Horizontal 16:9', sub: 'YouTube' },
  ],
  nivel: [
    { id: 'completo', rotulo: 'Completo com motion',
      sub: 'Tudo do Com imagens, mais câmera virtual andando entre os cartões, fundo desfocado e interfaces se mexendo (digitando, clicando).' },
    { id: 'imagens', rotulo: 'Com imagens',
      sub: 'Tudo do Básico, mais três telas que se alternam (câmera cheia, tela dividida com a cabeça saindo do cartão e tela só com gráficos), com imagens, logos e páginas de fonte.' },
    { id: 'basico', rotulo: 'Básico',
      sub: 'Cortes de silêncio e de falas repetidas, melhor tomada, legendas, capa, cartão de chamada pra ação, música e efeitos. Só a câmera, sem gráficos.' },
  ],
  legendas: [
    { id: 'padrao', rotulo: 'Brancas com contorno e destaque amarelo', skill: 'Brancas com contorno preto e palavras-chave em amarelo com fonte serifada' },
    { id: 'brancas', rotulo: 'Só brancas, sem destaque', skill: 'Só brancas, sem destaque' },
    { id: 'marca', rotulo: 'Destaque na cor da minha marca', skill: 'Destaques na cor da minha marca' },
    { id: 'sem', rotulo: 'Sem legenda', skill: 'Sem legenda' },
  ],
  estilo: [
    { id: 'claro', rotulo: 'Claro tecnológico', sub: 'Cartões brancos flutuando num fundo quase branco' },
    { id: 'escuro', rotulo: 'Escuro premium', sub: 'Cartões grafite num fundo escuro, detalhes terracota' },
    { id: 'pixelado', rotulo: 'Pixelado', sub: 'Creme quadriculado, legenda em pílula escura e cenas em pixel art' },
    { id: 'marca', rotulo: 'Cores da minha marca', sub: 'Sua cor principal, fundo claro ou escuro e a sua fonte' },
    { id: 'noite-laranja', rotulo: 'Noite Laranja', sub: 'Preto com brilho laranja e cards de vidro' },
  ],
  musica: [
    { id: 'eletronica', rotulo: 'Eletrônica minimalista', sub: 'Criada por código, 100–120 BPM', skill: 'Eletrônica minimalista criada por código, 100–120 BPM' },
    { id: 'calma', rotulo: 'Clima calmo', sub: 'Criada por código, mais lenta', skill: 'Outro clima: calma' },
    { id: 'energetica', rotulo: 'Clima energético', sub: 'Criada por código, mais rápida', skill: 'Outro clima: energética' },
    { id: 'pasta', rotulo: 'A música da pasta', sub: '', skill: 'Usar a música que está na pasta' },
    { id: 'sem', rotulo: 'Sem música', sub: '', skill: 'Sem música' },
  ],
  efeitos: [
    { id: 'completos', rotulo: 'Completos', sub: 'Cliques, digitação, impactos, confirmações, passagens e som crescente na abertura', skill: 'Completos' },
    { id: 'essenciais', rotulo: 'Só os essenciais', sub: 'Tudo, menos as passagens', skill: 'Só os essenciais: sem passagens' },
    { id: 'nenhum', rotulo: 'Nenhum', sub: '', skill: 'Nenhum' },
  ],
  verificar: [
    { id: 'sim', rotulo: 'Sim, conferir', sub: 'Confere em fontes reais e mostra a página da fonte no vídeo', skill: 'Sim, conferir em fontes reais e mostrar a página da fonte no vídeo' },
    { id: 'nao', rotulo: 'Não', sub: '', skill: 'Não' },
  ],
};

export const PADRAO_COMPLETO = {
  proporcao: 'vertical', nivel: 'completo', legendas: 'padrao', capa: 'ia',
  estilo: 'claro', musica: 'eletronica', efeitos: 'completos', verificar: 'sim',
};

// Clima de música e paleta de efeitos de cada visual, pra prévia de som.
export const CLIMA = {
  'noite-laranja': 'escura', 'claro-tecnologico': 'eletronica', 'pixelado': 'chiptune',
  'claro': 'eletronica', 'escuro': 'escura', 'marca': 'eletronica',
  'legenda-encaixada': 'piano', 'nuvem-de-imagens': 'calma', 'recorte-com-imagens': 'calma',
  'aula-em-tela-dividida': 'calma', 'formato-ranking': 'energetica', 'reels-com-broll': 'eletronica',
  'palavra-atras-da-cabeca': 'eletronica', 'checklist-na-tela': 'eletronica', 'zoom-na-palavra': 'energetica',
  'marcacoes': 'eletronica', 'widgets-de-vidro': 'eletronica', 'cards-em-orbita': 'eletronica',
  'capa-de-revista': 'escura', 'grade-do-perfil': 'energetica',
};

export const CORTES = {
  qtd: [
    { id: '5', rotulo: 'Os 5 melhores', skill: 'Os 5 melhores' },
    { id: '3', rotulo: 'Os 3 melhores', skill: 'Os 3 melhores' },
    { id: '10', rotulo: 'Os 10 melhores', skill: 'Os 10 melhores' },
  ],
  dur: [
    { id: '30-60', rotulo: 'Entre 30 e 60 s', skill: 'Entre 30 e 60 s' },
    { id: '30', rotulo: 'Até 30 s', skill: 'Até 30 s' },
    { id: '60-90', rotulo: 'Entre 60 e 90 s', skill: 'Entre 60 e 90 s' },
  ],
};

// De onde vêm os clipes de apoio do Reels com B-roll.
export const BROLL = [
  { id: 'internet', rotulo: 'Buscar na internet pra mim', sub: 'o Claude acha os clipes', skill: 'Buscar clipes na internet' },
  { id: 'pasta', rotulo: 'Usar os clipes da pasta broll/', sub: '', skill: 'Usar os clipes da pasta broll/' },
  { id: 'subir', rotulo: 'Subir meus clipes aqui', sub: '', skill: 'Usar os clipes que subi pela página (pasta broll/)' },
  { id: 'imagens', rotulo: 'Usar só imagens', sub: '', skill: 'Usar só imagens' },
  { id: 'sem', rotulo: 'Sem B-roll', sub: '', skill: 'Sem B-roll' },
];

export const USO_AUDIO = [
  { id: 'voz', rotulo: 'Minha voz limpa', sub: 'microfone ou lapela', skill: 'áudio limpo da minha voz (microfone/lapela)' },
  { id: 'musica', rotulo: 'Música que quero usar', sub: '', skill: 'música que quero usar' },
  { id: 'nao', rotulo: 'Não usar', sub: '', skill: 'não usar' },
];

// Qualidade da exportação (usada só no fim, depois da aprovação).
export const EXPORTACAO = {
  resolucao: [
    { id: '2160', rotulo: '4K', sub: '2160p' },
    { id: '1080', rotulo: 'Full HD', sub: '1080p' },
    { id: '720', rotulo: 'HD', sub: '720p' },
  ],
  fps: [
    { id: '60', rotulo: '60 fps', sub: 'mais fluido' },
    { id: '30', rotulo: '30 fps' },
    { id: '24', rotulo: '24 fps', sub: 'cara de cinema' },
  ],
};
