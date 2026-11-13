// The clock: every few minutes it (a) asks Post for Me about the posts that were just sent or scheduled,
// (b) moves a ficha from `aguardando-numeros` to the Análise when its 48h / 7d mark passes, and
// (c) asks for the weekly summary on the first lap of a new week.
// It talks to the orchestrator only through `ocupado(id)` and `evento(id, ev)`; the ficha rules stay in ficha.mjs.
// No internet or a refused key is not an error: the lap is skipped and, for a refused key, a notice is raised.
import fs from 'node:fs';
import path from 'node:path';
import { criarPostForMe, ErroPostForMe } from './postforme.mjs';
import { chaveDe } from './conexoes.mjs';

export const PRAZOS = () => ({ h48: Number(process.env.OFC_PRAZO_48H_MS) || 48 * 3600e3, d7: Number(process.env.OFC_PRAZO_7D_MS) || 7 * 24 * 3600e3 });
export const INTERVALO = () => Number(process.env.OFC_RELOGIO_MS) || 10 * 60e3;

// A request that hangs must not freeze the clock for good (only one lap runs at a time): the client reads a timeout as "no connection".
const TEMPO_CHAMADA_MS = 30_000;

// Which reading is due. After a long closed Oficina both marks may be overdue: only the 7d one is read (the 48h one says nothing by then).
export function marcoDevido(ficha, agoraMs, prazos) {
  if (ficha?.etapa !== 'aguardando-numeros') return null;
  const publicadoMs = Date.parse(ficha.publicacao?.publicadoEm ?? '');
  if (Number.isNaN(publicadoMs)) return null;
  const decorrido = agoraMs - publicadoMs;
  const leituras = ficha.analise?.leituras || [];
  const tem = marco => leituras.some(l => l.marco === marco);
  if (decorrido >= prazos.d7 && !tem('7d')) return '7d';
  if (decorrido >= prazos.h48 && !tem('48h')) return '48h';
  return null;
}

const doisDigitos = n => String(n).padStart(2, '0');
const formatarData = d => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
// Monday of the week of `data`, 'AAAA-MM-DD', in the computer's local time.
function segundaDe(data) {
  const d = new Date(data);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}
export const segundaDaSemana = data => formatarData(segundaDe(data));

// The week before `agora` (Monday 00:00 inclusive to the next Monday exclusive), if it still has no summary and has a reading
// that can be summarized (a "post não encontrado" does not count).
export function semanaParaResumir({ agora, ultimaSemana, leituras }) {
  const estaSegunda = segundaDe(agora);
  const inicio = new Date(estaSegunda.getFullYear(), estaSegunda.getMonth(), estaSegunda.getDate() - 7);
  const semana = formatarData(inicio);
  if (semana === ultimaSemana) return null;
  const de = inicio.getTime(), ate = estaSegunda.getTime();
  // A "post não encontrado" reading has nothing to summarize (escreverResumo ignores it and would throw every lap).
  const dentro = (leituras || []).some(l => { const em = Date.parse(l?.em ?? ''); return !l?.naoAchou && !Number.isNaN(em) && em >= de && em < ate; });
  return dentro ? semana : null;
}

function ultimaSemanaResumida(cerebroDir) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(cerebroDir, 'resumos', 'ultimo.json'), 'utf8'))?.semana;
    return typeof s === 'string' ? s : null;
  } catch { return null; }
}

export function criarRelogio({ store, orquestrador, config, cerebroDir, cliente, resumir, agora = () => new Date(), intervaloMs = INTERVALO(), prazos = PRAZOS() }) {
  const novoCliente = cliente || (() => { const chave = chaveDe(config.dados, 'postForMe'); return chave ? criarPostForMe({ chave }) : null; });
  const estado = { postForMe: null };
  let emVolta = false, timer = null, controle = null;

  // Post for Me's own answer about a key or the connection ends the lap; any other refusal only skips that ficha.
  function tratar(e, ficha, sinal) {
    if (sinal.aborted) throw e;
    if (e instanceof ErroPostForMe && e.code !== 'RECUSADO') throw e;
    console.error(`relógio (${ficha.id}):`, e.message);
  }

  async function conferirPosts(c, sinal) {
    for (const f of store.listar()) {
      if (sinal.aborted) return;
      if (f.etapa !== 'agendado' || orquestrador.ocupado(f.id)) continue;
      try {
        const postIds = [...new Set(Object.values(f.publicacao?.contas || {}).filter(x => x.status === 'esperando' && x.postId).map(x => x.postId))];
        const resultados = [];
        for (const postId of postIds) resultados.push(...await c.resultados(postId, AbortSignal.any([sinal, AbortSignal.timeout(TEMPO_CHAMADA_MS)])));
        if (resultados.length) orquestrador.evento(f.id, { tipo: 'publicou', resultados });
      } catch (e) { tratar(e, f, sinal); }
    }
  }

  function lerMarcos(sinal) {
    const agoraMs = new Date(agora()).getTime();
    for (const f of store.listar()) {
      if (sinal.aborted) return;
      if (f.etapa !== 'aguardando-numeros' || orquestrador.ocupado(f.id)) continue;
      const marco = marcoDevido(f, agoraMs, prazos);
      if (!marco) continue;
      try { orquestrador.evento(f.id, { tipo: 'ler-numeros', marco }); } catch (e) { tratar(e, f, sinal); }
    }
  }

  async function resumoDaSemana(sinal) {
    if (typeof resumir !== 'function' || sinal.aborted) return;
    const leituras = store.listar().flatMap(f => f.analise?.leituras || []);
    const semana = semanaParaResumir({ agora: new Date(agora()), ultimaSemana: ultimaSemanaResumida(cerebroDir), leituras });
    if (!semana) return;
    try { await resumir(semana, sinal); } catch (e) { if (!sinal.aborted) console.error('resumo da semana:', e?.message || e); }
  }

  async function umaVolta(sinal) {
    const c = novoCliente();
    if (!c) return;
    try {
      await conferirPosts(c, sinal);
      lerMarcos(sinal);
      await resumoDaSemana(sinal);
    } catch (e) {
      if (sinal.aborted) return;
      if (e instanceof ErroPostForMe && e.code === 'CHAVE') { estado.postForMe = 'reconectar'; return; }
      if (e instanceof ErroPostForMe && e.code === 'SEM_CONEXAO') return; // no internet: try again next lap, quietly
      throw e;
    }
    if (!sinal.aborted) estado.postForMe = null; // a whole lap without the key being refused
  }

  // Never rejects; a call made while another lap is running is ignored.
  async function volta() {
    if (emVolta) return;
    emVolta = true;
    const ctrl = new AbortController();
    controle = ctrl;
    try { await umaVolta(ctrl.signal); }
    catch (e) { if (!ctrl.signal.aborted) console.error('relógio:', e?.message || e); }
    finally { emVolta = false; if (controle === ctrl) controle = null; }
  }

  return {
    iniciar() {
      if (timer) clearInterval(timer);
      volta();
      timer = setInterval(volta, intervaloMs);
      timer.unref?.();
    },
    parar() {
      if (timer) clearInterval(timer);
      timer = null;
      controle?.abort(new Error('A Oficina foi fechada.'));
    },
    volta,
    avisos: () => ({ postForMe: estado.postForMe }),
    // The Análise room found out the key is refused (it postponed a reading): raise the same notice a lap would.
    // The next lap that finishes without a refusal clears it.
    sinalizarChaveRecusada() { estado.postForMe = 'reconectar'; },
  };
}
