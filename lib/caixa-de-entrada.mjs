import fs from 'node:fs';
import path from 'node:path';
import { criarFicha } from './ficha.mjs';

export const EXTENSOES_VIDEO = ['.mp4', '.mov', '.mkv', '.webm', '.m4v'];
const TRAVADO = new Set(['EBUSY', 'EPERM', 'EACCES']);
const apagar = pasta => fs.rmSync(pasta, { recursive: true, force: true });

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
      try {
        const ficha = this.mover(nome, origem);
        if (!ficha) continue; // travado: tenta de novo na próxima varredura
        agoraVistos.delete(nome);
        criadas.push(ficha);
        this.aoCriar(ficha);
      } catch (e) {
        // o arquivo continua na caixa (ou volta pra ela) e entra de novo na próxima varredura
        console.error(`caixa de entrada: ${nome}: ${e.message}`);
      }
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
    let movido = false;
    try {
      try { fs.renameSync(origem, destino); }
      catch (e) {
        if (TRAVADO.has(e.code)) { apagar(pasta); return null; }
        if (e.code !== 'EXDEV') throw e;
        fs.copyFileSync(origem, destino);
        try { fs.unlinkSync(origem); }
        catch { apagar(pasta); return null; } // original ainda na caixa: nunca salvar ficha agora
      }
      movido = true;
      const ficha = criarFicha({ id, porta: 'bruto', tema: path.parse(nome).name, bruto: 'bruto' + ext, pular: this.pular, agora: this.agora() });
      return this.store.salvar(ficha);
    } catch (e) {
      if (movido) this.devolver(origem, destino, pasta);
      else apagar(pasta);
      throw e;
    }
  }
  // salvar falhou depois que o bruto saiu da caixa: devolve o arquivo e só apaga a pasta se a devolução deu certo
  devolver(origem, destino, pasta) {
    try {
      try { fs.renameSync(destino, origem); }
      catch { fs.copyFileSync(destino, origem); }
      apagar(pasta);
    } catch { /* bruto ficou em destino: não apagar, pra não perder o arquivo */ }
  }
  iniciar(intervaloMs = 2000) { this.parar(); this.timer = setInterval(() => { try { this.varrer(); } catch (e) { console.error('caixa de entrada:', e.message); } }, intervaloMs); this.timer.unref?.(); }
  parar() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
