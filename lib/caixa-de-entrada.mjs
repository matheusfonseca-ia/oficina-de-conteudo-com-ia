import fs from 'node:fs';
import path from 'node:path';
import { criarFicha } from './ficha.mjs';

export const EXTENSOES_VIDEO = ['.mp4', '.mov', '.mkv', '.webm', '.m4v'];
const TRAVADO = new Set(['EBUSY', 'EPERM', 'EACCES']);

export class CaixaDeEntrada {
  constructor({ store, pular = [], aoCriar = () => {}, agora = () => Date.now() }) {
    Object.assign(this, { store, pular, aoCriar, agora });
    this.vistos = new Map(); // nome → tamanho na última varredura
    this.timer = null;
  }
  varrer() {
    let nomes = [];
    try { nomes = fs.readdirSync(this.store.caixaDir); } catch { return []; }
    const criadas = [], agoraVistos = new Map();
    for (const nome of nomes) {
      if (nome.startsWith('.') || !EXTENSOES_VIDEO.includes(path.extname(nome).toLowerCase())) continue;
      const origem = path.join(this.store.caixaDir, nome);
      let st; try { st = fs.statSync(origem); } catch { continue; }
      if (!st.isFile() || st.size === 0) continue;
      const antes = this.vistos.get(nome);
      agoraVistos.set(nome, st.size);
      if (antes !== st.size) continue; // first sighting or still growing
      const ficha = this.mover(nome, origem);
      if (ficha) { agoraVistos.delete(nome); criadas.push(ficha); this.aoCriar(ficha); }
    }
    this.vistos = agoraVistos;
    return criadas;
  }
  mover(nome, origem) {
    const ext = path.extname(nome).toLowerCase();
    const id = this.store.novoId(nome, this.agora());
    const pasta = this.store.pasta(id);
    fs.mkdirSync(pasta, { recursive: true });
    const destino = path.join(pasta, 'bruto' + ext);
    try { fs.renameSync(origem, destino); }
    catch (e) {
      if (e.code === 'EXDEV') { fs.copyFileSync(origem, destino); fs.unlinkSync(origem); }
      else { fs.rmSync(pasta, { recursive: true, force: true }); if (TRAVADO.has(e.code)) return null; throw e; }
    }
    const ficha = criarFicha({ id, porta: 'bruto', tema: path.parse(nome).name, bruto: 'bruto' + ext, pular: this.pular, agora: this.agora() });
    return this.store.salvar(ficha);
  }
  iniciar(intervaloMs = 2000) { this.parar(); this.timer = setInterval(() => { try { this.varrer(); } catch (e) { console.error('caixa de entrada:', e.message); } }, intervaloMs); this.timer.unref?.(); }
  parar() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
