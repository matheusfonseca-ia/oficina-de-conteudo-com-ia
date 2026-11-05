// Moves fichas through the rooms. One ExecutionLimiter(1) per room: a room handles one video at a time.
// The ficha on disk is the source of truth, so a restart only needs retomar().
import { aplicar, emTrabalho, salaDaEtapa } from './ficha.mjs';
import { ExecutionLimiter } from './execution.mjs';
import { rodarEdicao, COMANDOS, lerEstado } from './runner-edicao.mjs';
import { rodarPostagem } from './runner-postagem.mjs';

export class Orquestrador {
  constructor({ store, config, cerebroDir, runners = {} }) {
    Object.assign(this, { store, config, cerebroDir });
    this.runners = { edicao: runners.edicao || rodarEdicao, postagem: runners.postagem || rodarPostagem };
    this.limites = { edicao: new ExecutionLimiter(1), postagem: new ExecutionLimiter(1) };
    this.rodando = new Map(); // fichaId → Promise
    this.reabrindo = new Map(); // fichaId → Promise do reabrirStudio em andamento
  }
  ocupado(id) { return this.rodando.has(id); }
  andamento(id) {
    if (!this.rodando.has(id)) return null;
    const e = lerEstado(this.store.pasta(id));
    return e ? { progresso: e.progresso, mensagem: e.mensagem } : null;
  }
  evento(id, ev) {
    const f = this.store.carregar(id);
    if (!f) throw new Error('Vídeo não encontrado');
    if (this.ocupado(id) && ev.tipo !== 'pular') throw new Error('A sala ainda está trabalhando neste vídeo. Espere terminar.');
    const nova = this.store.salvar(aplicar(f, ev));
    this.acordar();
    return nova;
  }
  retomar() { this.acordar(); }
  acordar() {
    for (const f of this.store.listar()) {
      if (!emTrabalho(f) || this.ocupado(f.id)) continue;
      const sala = salaDaEtapa(f.etapa);
      if (!this.limites[sala]) continue; // rooms not built yet (stages 2–4)
      const p = this.limites[sala].run(() => this.trabalhar(f.id)).finally(() => { this.rodando.delete(f.id); this.acordar(); });
      this.rodando.set(f.id, p);
    }
  }
  async trabalhar(id) {
    const f = this.store.carregar(id);
    if (!f || !emTrabalho(f)) return;
    const pastaVideo = this.store.pasta(id);
    try {
      const dados = await this.executar(f, pastaVideo);
      const atual = this.store.carregar(id);
      if (atual.etapa === f.etapa) this.store.salvar(aplicar(atual, { tipo: 'concluiu', dados }));
    } catch (e) {
      const atual = this.store.carregar(id);
      if (atual?.etapa === f.etapa) this.store.salvar(aplicar(atual, { tipo: 'falhou', mensagem: e.message }));
    }
  }
  async executar(f, pastaVideo) {
    const base = { pastaVideo, ficha: f, config: this.config };
    switch (f.etapa) {
      case 'bruto-recebido': { const r = await this.runners.edicao({ ...base, comando: COMANDOS.preparar }); return { sessao: r.sessao }; }
      case 'editando': {
        const comando = f.revisao ? `REVISAR: ${f.revisao}` : COMANDOS.montar;
        const r = await this.runners.edicao({ ...base, comando }); return { sessao: r.sessao, studioUrl: r.estado.studioUrl };
      }
      case 'exportando': { const r = await this.runners.edicao({ ...base, comando: COMANDOS.exportar }); return { sessao: r.sessao }; }
      case 'postagem': return { postagem: await this.runners.postagem({ ...base, cerebroDir: this.cerebroDir }) };
      default: throw new Error(`Nenhuma sala sabe trabalhar na etapa ${f.etapa}`);
    }
  }
  reabrirStudio(id) {
    if (this.reabrindo.has(id)) return this.reabrindo.get(id); // clique duplo: mesma operação
    const f = this.store.carregar(id);
    if (f?.etapa !== 'aprovacao-video') return Promise.reject(new Error('Este vídeo não está esperando revisão'));
    const p = (async () => {
      const r = await this.limites.edicao.run(() => this.runners.edicao({ pastaVideo: this.store.pasta(id), ficha: f, config: this.config, comando: COMANDOS.reabrir }));
      const atual = this.store.carregar(id); // pode ter mudado enquanto o Studio abria
      if (!atual || atual.etapa !== 'aprovacao-video') return atual;
      atual.edicao.studioUrl = r.estado.studioUrl; return this.store.salvar(atual);
    })().finally(() => { this.reabrindo.delete(id); this.rodando.delete(id); });
    this.reabrindo.set(id, p); this.rodando.set(id, p); // rodando: evento() recusa enquanto abre
    return p;
  }
  async esperarOcioso() { while (this.rodando.size) await Promise.allSettled([...this.rodando.values()]); }
}
