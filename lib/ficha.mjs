// The ficha: one video's journey through the six rooms. Pure — no node:* imports,
// because the page (src/) bundles it too.
export const ETAPAS = {
  'pesquisa':            { sala: 'pesquisa', tipo: 'trabalho', texto: 'Buscando referências' },
  'escolha-referencia':  { sala: 'pesquisa', tipo: 'espera',   texto: 'Escolha uma referência' },
  'roteiro':             { sala: 'roteiro',  tipo: 'trabalho', texto: 'Escrevendo o roteiro' },
  'aprovacao-roteiro':   { sala: 'roteiro',  tipo: 'espera',   texto: 'Aprove o roteiro' },
  'aguardando-gravacao': { sala: 'gravacao', tipo: 'espera',   texto: 'Esperando você gravar' },
  'bruto-recebido':      { sala: 'edicao',   tipo: 'trabalho', texto: 'Preparando a edição' },
  'escolhas-edicao':     { sala: 'edicao',   tipo: 'espera',   texto: 'Escolha formato e estilo' },
  'editando':            { sala: 'edicao',   tipo: 'trabalho', texto: 'Editando o vídeo' },
  'aprovacao-video':     { sala: 'edicao',   tipo: 'espera',   texto: 'Assista e aprove no Studio' },
  'exportando':          { sala: 'edicao',   tipo: 'trabalho', texto: 'Exportando o MP4' },
  'capa':                { sala: 'capa',     tipo: 'trabalho', texto: 'Fazendo a capa' },
  'postagem':            { sala: 'postagem', tipo: 'trabalho', texto: 'Escrevendo a legenda' },
  'aprovacao-pacote':    { sala: 'postagem', tipo: 'espera',   texto: 'Aprove o post' },
  'agendado':            { sala: 'postagem', tipo: 'espera',   texto: 'Agendado' },
  'pronto-pra-postar':   { sala: 'postagem', tipo: 'espera',   texto: 'Pronto pra postar' },
  'analise':             { sala: 'analise',  tipo: 'trabalho', texto: 'Lendo os números' },
  'concluido':           { sala: 'fim',      tipo: 'fim',      texto: 'Concluído' },
};
export const SEQUENCIA = ['pesquisa', 'escolha-referencia', 'roteiro', 'aprovacao-roteiro', 'aguardando-gravacao',
  'bruto-recebido', 'escolhas-edicao', 'editando', 'aprovacao-video', 'exportando', 'capa', 'postagem',
  'aprovacao-pacote', 'pronto-pra-postar', 'analise', 'concluido'];
export const SALAS_PULAVEIS = ['pesquisa', 'roteiro', 'capa', 'postagem', 'analise'];

export const salaDaEtapa = etapa => ETAPAS[etapa]?.sala || 'fim';
export const emTrabalho = f => ETAPAS[f.etapa]?.tipo === 'trabalho' && !f.erro;

// From `etapa`, the next etapa whose room is not skipped. The 'gravacao' wait only exists
// on the ideia door; 'agendado' is reached only through dados.modo (stage 4).
function proxima(etapa, pular) {
  let i = SEQUENCIA.indexOf(etapa) + 1;
  while (i < SEQUENCIA.length && pular.includes(salaDaEtapa(SEQUENCIA[i]))) i++;
  return SEQUENCIA[Math.min(i, SEQUENCIA.length - 1)];
}
function primeira(porta, pular) {
  if (porta === 'bruto') return 'bruto-recebido';
  return pular.includes('pesquisa') ? proxima('escolha-referencia', pular) : 'pesquisa';
}

export function criarFicha({ id, porta, tema = null, bruto = null, pular = [], agora = Date.now() }) {
  if (!['ideia', 'bruto'].includes(porta)) throw new Error('Porta de entrada desconhecida');
  const p = [...new Set(pular.filter(s => SALAS_PULAVEIS.includes(s)))];
  const etapa = primeira(porta, p);
  return { versao: 1, id, porta, tema, etapa, pular: p, bruto, revisao: null,
    edicao: { sessao: null, studioUrl: null }, postagem: null, erro: null,
    criadaEm: agora, atualizadaEm: agora, historico: [{ em: agora, etapa, nota: 'criada' }] };
}

const ESPERA_APROVACAO = { 'aprovacao-roteiro': 'roteiro', 'aprovacao-video': 'editando', 'aprovacao-pacote': 'postagem' };

export function aplicar(ficha, ev, agora = Date.now()) {
  const f = structuredClone(ficha);
  const ir = (etapa, nota) => { f.etapa = etapa; f.historico.push({ em: agora, etapa, nota }); };
  const meta = ETAPAS[f.etapa];
  switch (ev.tipo) {
    case 'concluiu': {
      if (meta.tipo !== 'trabalho') throw new Error('Esta etapa não é de trabalho');
      const d = ev.dados || {};
      if (d.studioUrl) f.edicao.studioUrl = d.studioUrl;
      if (d.sessao) f.edicao.sessao = d.sessao;
      if (d.postagem) f.postagem = d.postagem;
      f.revisao = null; f.erro = null;
      ir(proxima(f.etapa, f.pular), 'concluiu');
      break;
    }
    case 'falhou':
      f.erro = { sala: meta.sala, mensagem: String(ev.mensagem || 'Algo deu errado.'), em: agora };
      f.historico.push({ em: agora, etapa: f.etapa, nota: 'falhou' });
      break;
    case 'tentar-de-novo':
      f.erro = null; f.historico.push({ em: agora, etapa: f.etapa, nota: 'tentar de novo' });
      break;
    case 'escolheu-referencia':
      if (f.etapa !== 'escolha-referencia') throw new Error('Este vídeo não está escolhendo referência');
      f.referencia = ev.referencia ?? null; ir(proxima(f.etapa, f.pular), 'referência escolhida');
      break;
    case 'aprovou':
      if (!ESPERA_APROVACAO[f.etapa]) throw new Error('Este vídeo não está esperando aprovação');
      ir(proxima(f.etapa, f.pular), 'aprovado');
      break;
    case 'revisar':
      if (!ESPERA_APROVACAO[f.etapa]) throw new Error('Este vídeo não está esperando aprovação');
      f.revisao = String(ev.texto || '').trim() || null;
      ir(ESPERA_APROVACAO[f.etapa], 'revisar');
      break;
    case 'bruto':
      if (f.etapa !== 'aguardando-gravacao') throw new Error('Este vídeo não está esperando gravação');
      f.bruto = ev.arquivo; ir('bruto-recebido', 'bruto recebido');
      break;
    case 'escolhas-prontas':
      if (f.etapa !== 'escolhas-edicao') throw new Error('Este vídeo não está nas escolhas da edição');
      ir('editando', 'escolhas prontas');
      break;
    case 'postado':
      if (!['pronto-pra-postar', 'agendado'].includes(f.etapa)) throw new Error('Este vídeo ainda não está pronto pra postar');
      ir(proxima('pronto-pra-postar', f.pular), 'postado');
      break;
    case 'pular': {
      if (!SALAS_PULAVEIS.includes(ev.sala)) throw new Error('A sala de edição não pode ser pulada');
      if (!f.pular.includes(ev.sala)) f.pular.push(ev.sala);
      if (meta.sala === ev.sala) { f.erro = null; ir(proxima(f.etapa, f.pular), 'sala pulada'); }
      break;
    }
    default: throw new Error('Evento desconhecido: ' + ev.tipo);
  }
  f.atualizadaEm = agora;
  return f;
}
