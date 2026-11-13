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
  'pronto-pra-postar':   { sala: 'postagem', tipo: 'espera',   texto: 'Pronto pra postar' },
  'publicando':          { sala: 'postagem', tipo: 'trabalho', texto: 'Enviando pro Post for Me' },
  'agendado':            { sala: 'postagem', tipo: 'espera',   texto: 'Agendado no Post for Me' },
  'aguardando-numeros':  { sala: 'analise',  tipo: 'espera',   texto: 'Esperando os números' },
  'analise':            { sala: 'analise',  tipo: 'trabalho', texto: 'Lendo os números' },
  'concluido':           { sala: 'fim',      tipo: 'fim',      texto: 'Concluído' },
};
export const SEQUENCIA = ['pesquisa', 'escolha-referencia', 'roteiro', 'aprovacao-roteiro', 'aguardando-gravacao',
  'bruto-recebido', 'escolhas-edicao', 'editando', 'aprovacao-video', 'exportando', 'capa', 'postagem',
  'aprovacao-pacote', 'pronto-pra-postar', 'publicando', 'agendado', 'aguardando-numeros', 'analise', 'concluido'];
// Etapas que só se alcançam por evento (publicar, relógio): proxima() nunca entra nelas.
export const ETAPAS_POR_EVENTO = ['publicando', 'agendado', 'aguardando-numeros', 'analise'];
export const SALAS_PULAVEIS = ['pesquisa', 'roteiro', 'capa', 'postagem', 'analise'];
// Quem já gravou não passa por Pesquisa nem Roteiro.
export const SALAS_ANTES_DA_GRAVACAO = ['pesquisa', 'roteiro'];

export const salaDaEtapa = etapa => ETAPAS[etapa]?.sala || 'fim';
// Quem aprende com um "Pedir ajuste": na aprovação do post, a Capa quando o ajuste é dela.
export const salaDoAjuste = (f, ev) => (ev.sala === 'capa' ? 'capa' : salaDaEtapa(f.etapa));
export const emTrabalho = f => ETAPAS[f.etapa]?.tipo === 'trabalho' && !f.erro;

// A failed send can go back to the post approval only if nothing was created at Post for Me yet: approving again
// rebuilds `publicacao` from scratch, so a live post (or one already out) would be forgotten and posted twice.
// Read by `aplicar` and by the page.
export function podeVoltarPraAprovacao(publicacao) {
  if (publicacao?.postIds?.length) return false;
  return !Object.values(publicacao?.contas || {}).some(c => c.postId || ['publicado', 'manual'].includes(c.status));
}

// A schedule can only be cancelled while its time is more than this away: a "Publicar agora", or a time that
// has come, is already on its way to the networks. Read by the cancel route and by the page.
export const MARGEM_CANCELAR_MS = 2 * 60_000;
export function podeCancelar(publicacao, agora = Date.now()) {
  const quando = Date.parse(publicacao?.pedido?.quando ?? '');
  return Number.isFinite(quando) && quando - agora > MARGEM_CANCELAR_MS;
}

// What the room shows while waiting: the Análise wait says which reading comes next.
export function textoDaEspera(f, agora = Date.now()) {
  if (f.etapa !== 'aguardando-numeros') return ETAPAS[f.etapa].texto;
  return f.analise?.leituras?.some(l => l.marco === '48h') ? 'Esperando 7 dias' : 'Esperando 48 horas';
}

// From `etapa`, the next etapa whose room is not skipped. The 'gravacao' wait only exists
// on the ideia door; ETAPAS_POR_EVENTO (publicando…analise) are reached only by events.
function proxima(etapa, pular) {
  let i = SEQUENCIA.indexOf(etapa) + 1;
  while (i < SEQUENCIA.length && (pular.includes(salaDaEtapa(SEQUENCIA[i])) || ETAPAS_POR_EVENTO.includes(SEQUENCIA[i]))) i++;
  return SEQUENCIA[Math.min(i, SEQUENCIA.length - 1)];
}
function primeira(porta, pular) {
  if (porta === 'bruto') return 'bruto-recebido';
  return pular.includes('pesquisa') ? proxima('escolha-referencia', pular) : 'pesquisa';
}

export function criarFicha({ id, porta, tema = null, bruto = null, pular = [], agora = Date.now() }) {
  if (!['ideia', 'bruto'].includes(porta)) throw new Error('Porta de entrada desconhecida');
  const pedidas = porta === 'bruto' ? [...pular, ...SALAS_ANTES_DA_GRAVACAO] : pular;
  const p = [...new Set(pedidas.filter(s => SALAS_PULAVEIS.includes(s)))];
  const etapa = primeira(porta, p);
  return { versao: 1, id, porta, tema, etapa, pular: p, bruto, revisao: null,
    pesquisa: null, referencia: null, roteiro: null,
    edicao: { sessao: null, studioUrl: null }, capa: null, postagem: null, publicacao: null, tentativasPublicacao: 0, analise: null, erro: null,
    criadaEm: agora, atualizadaEm: agora, historico: [{ em: agora, etapa, nota: 'criada' }] };
}

const ESPERA_APROVACAO = { 'aprovacao-roteiro': 'roteiro', 'aprovacao-video': 'editando', 'aprovacao-pacote': 'postagem' };
// Onde "Pedir ajuste" leva: as aprovações e, na escolha de referência, uma busca nova.
const REFAZER = { ...ESPERA_APROVACAO, 'escolha-referencia': 'pesquisa' };

export function aplicar(ficha, ev, agora = Date.now()) {
  const f = structuredClone(ficha);
  const ir = (etapa, nota) => { f.etapa = etapa; f.historico.push({ em: agora, etapa, nota }); };
  const meta = ETAPAS[f.etapa];
  // Em agendado: com todas as redes resolvidas (nenhuma esperando), a ficha segue.
  const resolverAgendado = () => {
    const contas = Object.values(f.publicacao.contas);
    if (contas.some(c => ['esperando', 'enviando'].includes(c.status))) return;
    if (contas.some(c => c.status === 'publicado')) {
      f.publicacao.publicadoEm = f.publicacao.publicadoEm || new Date(agora).toISOString();
      f.analise = f.analise || { proxima: null, leituras: [] };
      ir(f.pular.includes('analise') ? 'concluido' : 'aguardando-numeros', 'publicado');
    } else {
      const erros = contas.map(c => c.erro).filter(Boolean);
      f.publicacao.erro = 'O Post for Me não conseguiu postar: ' + (erros.length ? erros.join('; ') : 'sem detalhe');
      ir('aprovacao-pacote', 'publicação falhou');
    }
  };
  switch (ev.tipo) {
    case 'concluiu': {
      if (meta.tipo !== 'trabalho') throw new Error('Esta etapa não é de trabalho');
      const d = ev.dados || {};
      if (f.etapa === 'publicando') {
        if (!d.publicacao) throw new Error('Faltou o registro da publicação.');
        f.publicacao = d.publicacao; f.erro = null;
        ir('agendado', 'enviado');
        break;
      }
      if (f.etapa === 'analise') {
        f.analise = f.analise || { proxima: null, leituras: [] };
        f.erro = null;
        if (d.adiar) { f.analise.proxima = null; ir('aguardando-numeros', 'leitura adiada'); break; }
        if (!d.leitura) throw new Error('Faltou a leitura dos números.');
        f.analise.leituras.push(d.leitura);
        f.analise.proxima = null;
        ir(d.leitura.marco === '48h' && !d.leitura.naoAchou ? 'aguardando-numeros' : 'concluido', 'leitura ' + d.leitura.marco);
        break;
      }
      if (d.studioUrl) f.edicao.studioUrl = d.studioUrl;
      if (d.sessao) f.edicao.sessao = d.sessao;
      if (d.postagem) f.postagem = d.postagem;
      if (d.pesquisa) f.pesquisa = d.pesquisa;
      if (d.roteiro) f.roteiro = d.roteiro;
      // Refazer a capa não reescreve a legenda: volta direto pra aprovação do post.
      const refazendoCapa = f.etapa === 'capa' && ficha.capa?.refazendo;
      if (d.capa) f.capa = { ...d.capa };
      if (f.capa) delete f.capa.refazendo;
      f.revisao = null; f.erro = null;
      ir(refazendoCapa ? 'aprovacao-pacote' : proxima(f.etapa, f.pular), 'concluiu');
      break;
    }
    case 'falhou':
      f.erro = { sala: meta.sala, mensagem: String(ev.mensagem || 'Algo deu errado.'), em: agora };
      f.historico.push({ em: agora, etapa: f.etapa, nota: 'falhou' });
      break;
    case 'tentar-de-novo':
      f.erro = null; f.historico.push({ em: agora, etapa: f.etapa, nota: 'tentar de novo' });
      break;
    case 'escolheu-referencia': {
      if (f.etapa !== 'escolha-referencia') throw new Error('Este vídeo não está escolhendo referência');
      const i = ev.indice;
      if (i === null) f.referencia = null;
      else {
        const r = Number.isInteger(i) ? f.pesquisa?.referencias?.[i] : undefined;
        if (!r) throw new Error('Essa referência não existe');
        f.referencia = r;
      }
      ir(proxima(f.etapa, f.pular), f.referencia ? 'referência escolhida' : 'sem referência');
      break;
    }
    case 'aprovou': {
      if (!ESPERA_APROVACAO[f.etapa]) throw new Error('Este vídeo não está esperando aprovação');
      if (f.etapa === 'aprovacao-pacote' && ev.publicar) {
        const { contas, quando = null } = ev.publicar;
        const pedidas = Array.isArray(contas) ? contas.filter(c => c && typeof c.id === 'string' && c.id) : [];
        if (!pedidas.length) throw new Error('Marque pelo menos uma rede.');
        const quandoMs = quando === null ? null : Date.parse(quando);
        if (quandoMs !== null && !(quandoMs > agora + 60_000)) throw new Error('Escolha um horário daqui pra frente.');
        const unicas = [...new Map(pedidas.map(c => [c.id, c])).values()];
        f.publicacao = {
          pedido: { contas: unicas.map(c => ({ id: c.id, plataforma: c.plataforma, usuario: c.usuario })), quando: quandoMs === null ? null : new Date(quandoMs).toISOString() },
          // O contador sobrevive a nova aprovação e a cancelamento: o external_id do envio nunca repete.
          tentativas: f.publicacao?.tentativas ?? f.tentativasPublicacao ?? 0, postIds: [],
          contas: Object.fromEntries(unicas.map(c => [c.id, { plataforma: c.plataforma, usuario: c.usuario, status: 'enviando', postId: null, idNaRede: null, link: null, erro: null }])),
          pendentes: unicas.map(c => c.id), publicadoEm: null, erro: null,
        };
        ir('publicando', 'aprovado pra publicar');
        break;
      }
      if (f.etapa === 'aprovacao-pacote') { f.tentativasPublicacao = f.publicacao?.tentativas ?? f.tentativasPublicacao ?? 0; f.publicacao = null; }
      ir(proxima(f.etapa, f.pular), 'aprovado');
      break;
    }
    case 'revisar':
      if (!REFAZER[f.etapa]) throw new Error('Este vídeo não está esperando aprovação');
      f.revisao = String(ev.texto || '').trim() || null;
      if (ev.sala === 'capa' && f.etapa === 'aprovacao-pacote') { f.capa = { ...f.capa, refazendo: true }; ir('capa', 'refazer capa'); }
      else ir(REFAZER[f.etapa], 'revisar');
      break;
    case 'escolheu-capa': {
      if (f.etapa !== 'aprovacao-pacote') throw new Error('Este vídeo não está esperando aprovação');
      const i = ev.indice;
      if (!Number.isInteger(i) || !f.capa?.opcoes?.[i]) throw new Error('Essa capa não existe');
      f.capa.escolhida = i;
      f.historico.push({ em: agora, etapa: f.etapa, nota: 'capa escolhida' });
      break;
    }
    case 'bruto':
      if (f.etapa !== 'aguardando-gravacao') throw new Error('Este vídeo não está esperando gravação');
      f.bruto = ev.arquivo; ir('bruto-recebido', 'bruto recebido');
      break;
    case 'escolhas-prontas':
      if (f.etapa !== 'escolhas-edicao') throw new Error('Este vídeo não está nas escolhas da edição');
      ir('editando', 'escolhas prontas');
      break;
    case 'postado':
      if (f.etapa !== 'pronto-pra-postar') throw new Error('Este vídeo ainda não está pronto pra postar');
      ir(proxima('pronto-pra-postar', f.pular), 'postado');
      break;
    case 'publicou': {
      if (f.etapa !== 'agendado') throw new Error('Este vídeo não está agendado');
      for (const r of ev.resultados || []) {
        const c = f.publicacao?.contas?.[r.conta];
        if (!c || c.status !== 'esperando') continue; // resultado repetido ou atrasado não desfaz o que já foi resolvido
        if (r.ok) Object.assign(c, { status: 'publicado', idNaRede: r.idNaRede ?? null, link: r.link ?? null, erro: null });
        else Object.assign(c, { status: 'falhou', erro: r.erro ? String(r.erro) : 'Não deu certo.' });
      }
      resolverAgendado();
      break;
    }
    case 'republicar': {
      if (!['agendado', 'aguardando-numeros'].includes(f.etapa)) throw new Error('Este vídeo não tem post pra refazer');
      const c = f.publicacao?.contas?.[ev.conta];
      if (c?.status !== 'falhou') throw new Error('Essa rede não falhou.');
      c.status = 'enviando'; c.erro = null;
      f.publicacao.pendentes = [ev.conta];
      ir('publicando', 'tentar de novo numa rede');
      break;
    }
    case 'postar-na-mao': {
      if (!['agendado', 'aguardando-numeros'].includes(f.etapa)) throw new Error('Este vídeo não tem post pra marcar');
      const c = f.publicacao?.contas?.[ev.conta];
      if (c?.status !== 'falhou') throw new Error('Essa rede não falhou.');
      c.status = 'manual';
      f.historico.push({ em: agora, etapa: f.etapa, nota: 'postado na mão' });
      if (f.etapa === 'agendado') resolverAgendado();
      break;
    }
    case 'cancelou-agendamento': {
      if (f.etapa !== 'agendado') throw new Error('Este vídeo não está agendado');
      if (Object.values(f.publicacao?.contas || {}).some(c => c.status === 'publicado')) throw new Error('Esse post já saiu em alguma rede e não dá mais pra cancelar.');
      f.tentativasPublicacao = f.publicacao?.tentativas ?? f.tentativasPublicacao ?? 0;
      f.publicacao = null;
      ir('aprovacao-pacote', 'agendamento cancelado');
      break;
    }
    // A send that keeps failing the same way (e.g. Post for Me refused the post): back to the post approval.
    // `publicacao` stays with its `tentativas`, so the next send repeats the same external_id and never makes a second post.
    case 'voltar-pra-aprovacao': {
      if (f.etapa !== 'publicando' || !f.erro) throw new Error('Esse vídeo não está com erro no envio.');
      // A "Tentar de novo" on one network while another is out or waiting on a live post: approving again would post there twice.
      if (!podeVoltarPraAprovacao(f.publicacao)) throw new Error('Esse post já foi criado no Post for Me e não dá pra voltar pra aprovação.');
      f.publicacao = { ...f.publicacao, erro: f.erro.mensagem };
      f.erro = null;
      ir('aprovacao-pacote', 'voltou pra aprovação');
      break;
    }
    case 'ler-numeros':
      if (f.etapa !== 'aguardando-numeros') throw new Error('Este vídeo não está esperando os números');
      if (!['48h', '7d'].includes(ev.marco)) throw new Error('Leitura desconhecida');
      f.analise = f.analise || { proxima: null, leituras: [] };
      f.analise.proxima = ev.marco;
      ir('analise', 'ler ' + ev.marco);
      break;
    case 'pular': {
      if (!SALAS_PULAVEIS.includes(ev.sala)) throw new Error('A sala de edição não pode ser pulada');
      if (!f.pular.includes(ev.sala)) f.pular.push(ev.sala);
      // Skipping the Capa in the middle of "Refazer capa": back to the post approval, caption untouched.
      if (meta.sala === 'capa' && ev.sala === 'capa' && f.capa?.refazendo) { f.erro = null; f.revisao = null; delete f.capa.refazendo; ir('aprovacao-pacote', 'sala pulada'); }
      else if (meta.sala === ev.sala) { f.erro = null; ir(proxima(f.etapa, f.pular), 'sala pulada'); }
      break;
    }
    default: throw new Error('Evento desconhecido: ' + ev.tipo);
  }
  f.atualizadaEm = agora;
  return f;
}
