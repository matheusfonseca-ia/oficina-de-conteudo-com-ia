// Moves fichas through the rooms. One ExecutionLimiter(1) per room: a room handles one video at a time.
// The ficha on disk is the source of truth, so a restart only needs retomar().
import { aplicar, emTrabalho, salaDaEtapa, salaDoAjuste } from './ficha.mjs';
import { ExecutionLimiter } from './execution.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { rodarEdicao, COMANDOS, lerEstado } from './runner-edicao.mjs';
import { rodarPostagem } from './runner-postagem.mjs';
import { rodarPesquisa } from './runner-pesquisa.mjs';
import { rodarRoteiro } from './runner-roteiro.mjs';
import { rodarCapa } from './runner-capa.mjs';
import { registrarAprendizado } from './aprendizados.mjs';

export class Orquestrador {
  constructor({ store, config, cerebroDir, runners = {} }) {
    Object.assign(this, { store, config, cerebroDir });
    this.runners = { pesquisa: runners.pesquisa || rodarPesquisa, roteiro: runners.roteiro || rodarRoteiro,
      edicao: runners.edicao || rodarEdicao, capa: runners.capa || rodarCapa, postagem: runners.postagem || rodarPostagem };
    this.limites = { pesquisa: new ExecutionLimiter(1), roteiro: new ExecutionLimiter(1), edicao: new ExecutionLimiter(1), capa: new ExecutionLimiter(1), postagem: new ExecutionLimiter(1) };
    this.rodando = new Map(); // fichaId → Promise
    this.reabrindo = new Map(); // fichaId → Promise do reabrirStudio em andamento
    this.controles = new Map(); // fichaId → AbortController do trabalho em andamento
    this.inicios = new Map(); // fichaId → quando o trabalho atual começou (o estado.json anterior não vale)
    this.parado = false; // depois de pararTudo() nada novo começa
    this.travadas = new Set(); // fichas cujo trabalho quebrou sem conseguir gravar o erro: esperam um evento do dono
  }
  ocupado(id) { return this.rodando.has(id); }
  andamento(id) {
    if (!this.rodando.has(id)) return null;
    const pasta = this.store.pasta(id);
    // O estado.json da rodada anterior (ex.: "Pronto pra você escolher") fica no disco até a Máquina escrever o novo.
    let mtime = null; try { mtime = fs.statSync(path.join(pasta, 'edit', 'estado.json')).mtimeMs; } catch {}
    if (mtime === null || mtime < (this.inicios.get(id) ?? 0)) return null;
    const e = lerEstado(pasta);
    return e ? { progresso: e.progresso, mensagem: e.mensagem } : null;
  }
  evento(id, ev) {
    const f = this.store.carregar(id);
    if (!f) throw new Error('Vídeo não encontrado');
    if (this.ocupado(id) && ev.tipo !== 'pular') throw new Error('A sala ainda está trabalhando neste vídeo. Espere terminar.');
    const nova = this.store.salvar(aplicar(f, ev));
    // "Pedir ajuste" ensina a sala: vira uma linha no Cérebro. Falhar aqui não pode desfazer o evento.
    if (ev.tipo === 'revisar') try { registrarAprendizado(this.cerebroDir, salaDoAjuste(f, ev), ev.texto); } catch (e) { console.error('aprendizado:', e.message); }
    this.travadas.delete(id);
    this.acordar();
    return nova;
  }
  retomar() { this.acordar(); }
  acordar() {
    if (this.parado) return;
    for (const f of this.store.listar()) {
      if (!emTrabalho(f) || this.ocupado(f.id) || this.travadas.has(f.id)) continue;
      const sala = salaDaEtapa(f.etapa);
      if (!this.limites[sala]) continue; // rooms not built yet (stage 4)
      const ctrl = new AbortController();
      const p = this.limites[sala].run(() => this.trabalhar(f.id, ctrl.signal), ctrl.signal)
        // Nada pode escapar como rejeição solta: derrubaria o servidor inteiro.
        // E a ficha que quebrou assim (ex.: não deu pra gravar a ficha) não roda de novo sozinha, senão vira um laço.
        .catch(e => { if (!ctrl.signal.aborted) { console.error('sala:', e.message); this.travadas.add(f.id); } })
        .finally(() => { this.rodando.delete(f.id); this.controles.delete(f.id); this.inicios.delete(f.id); this.acordar(); });
      this.rodando.set(f.id, p); this.controles.set(f.id, ctrl); this.inicios.set(f.id, Date.now());
    }
  }
  async trabalhar(id, signal) {
    const f = this.store.carregar(id);
    if (!f || !emTrabalho(f)) return;
    const pastaVideo = this.store.pasta(id);
    try {
      const dados = await this.executar(f, pastaVideo, signal);
      const atual = this.store.carregar(id);
      if (atual.etapa === f.etapa) {
        this.store.salvar(aplicar(atual, { tipo: 'concluiu', dados }));
        if (dados.studioUrl) this.soltarStudio(id, dados.studioUrl);
      }
    } catch (e) {
      // Parado pelo fechamento da Oficina: não é falha. A ficha fica na etapa de trabalho e o retomar() continua.
      if (signal?.aborted) return;
      const atual = this.store.carregar(id);
      if (atual?.etapa === f.etapa) this.store.salvar(aplicar(atual, { tipo: 'falhou', mensagem: e.message }));
    }
  }
  async executar(f, pastaVideo, signal) {
    const base = { pastaVideo, ficha: f, config: this.config, signal };
    switch (f.etapa) {
      case 'pesquisa': return { pesquisa: await this.runners.pesquisa({ ...base, cerebroDir: this.cerebroDir }) };
      case 'roteiro': return { roteiro: await this.runners.roteiro({ ...base, cerebroDir: this.cerebroDir }) };
      case 'bruto-recebido': { const r = await this.runners.edicao({ ...base, comando: COMANDOS.preparar }); return { sessao: r.sessao }; }
      case 'editando': {
        const comando = f.revisao ? `REVISAR: ${f.revisao}` : COMANDOS.montar;
        const r = await this.runners.edicao({ ...base, comando }); return { sessao: r.sessao, studioUrl: r.estado.studioUrl };
      }
      case 'exportando': { const r = await this.runners.edicao({ ...base, comando: COMANDOS.exportar }); return { sessao: r.sessao }; }
      case 'capa': return { capa: await this.runners.capa({ ...base, cerebroDir: this.cerebroDir }) };
      case 'postagem': return { postagem: await this.runners.postagem({ ...base, cerebroDir: this.cerebroDir }) };
      default: throw new Error(`Nenhuma sala sabe trabalhar na etapa ${f.etapa}`);
    }
  }
  // O Studio de um vídeo pode reaproveitar a porta do Studio de outro: a URL passa a ser só deste vídeo.
  soltarStudio(id, url) {
    for (const outra of this.store.listar()) {
      if (outra.id === id || outra.edicao?.studioUrl !== url) continue;
      outra.edicao.studioUrl = null; this.store.salvar(outra);
    }
  }
  reabrirStudio(id) {
    if (this.reabrindo.has(id)) return this.reabrindo.get(id); // clique duplo: mesma operação
    if (this.parado) return Promise.reject(new Error('A Oficina está fechando.'));
    const f = this.store.carregar(id);
    if (f?.etapa !== 'aprovacao-video') return Promise.reject(new Error('Este vídeo não está esperando revisão'));
    const ctrl = new AbortController();
    const p = (async () => {
      const r = await this.limites.edicao.run(() => this.runners.edicao({ pastaVideo: this.store.pasta(id), ficha: f, config: this.config, comando: COMANDOS.reabrir, signal: ctrl.signal }), ctrl.signal);
      const atual = this.store.carregar(id); // pode ter mudado enquanto o Studio abria
      if (!atual || atual.etapa !== 'aprovacao-video') return atual;
      atual.edicao.studioUrl = r.estado.studioUrl;
      const salva = this.store.salvar(atual);
      if (salva.edicao.studioUrl) this.soltarStudio(id, salva.edicao.studioUrl);
      return salva;
    })().finally(() => { this.reabrindo.delete(id); this.rodando.delete(id); this.controles.delete(id); });
    this.reabrindo.set(id, p); this.rodando.set(id, p); this.controles.set(id, ctrl); // rodando: evento() recusa enquanto abre
    return p;
  }
  // Fechamento da Oficina: aborta tudo (o runner mata o Claude filho) e espera os filhos saírem, até `limite` ms.
  pararTudo(limite = 8000) {
    this.parado = true;
    for (const c of this.controles.values()) c.abort(new Error('A Oficina foi fechada.'));
    const todos = Promise.allSettled([...this.rodando.values()]);
    let relogio;
    const tempo = new Promise(r => { relogio = setTimeout(r, limite); relogio.unref?.(); });
    return Promise.race([todos, tempo]).then(() => clearTimeout(relogio));
  }
  async esperarOcioso() { while (this.rodando.size) await Promise.allSettled([...this.rodando.values()]); }
}
