import fs from 'node:fs';
import path from 'node:path';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OCUPADO = new Set(['EPERM', 'EBUSY', 'EACCES']);
const TENTATIVAS = 5;
const ESPERA = new Int32Array(new SharedArrayBuffer(4)); // Atomics.wait: pausa curta e síncrona entre as tentativas

export class FichasStore {
  constructor(dadosDir) {
    this.dados = dadosDir;
    this.videosDir = path.join(dadosDir, 'videos');
    this.caixaDir = path.join(dadosDir, 'caixa-de-entrada');
    this.cerebroDir = path.join(dadosDir, 'cerebro');
  }
  garantirPastas() { for (const d of [this.videosDir, this.caixaDir, this.cerebroDir]) fs.mkdirSync(d, { recursive: true }); }
  idValido(id) { return typeof id === 'string' && ID.test(id); }
  pasta(id) { if (!this.idValido(id)) throw new Error('Identificador de vídeo inválido'); return path.join(this.videosDir, id); }
  novoId(nomeArquivo, agora = Date.now()) { return this.idDe(path.parse(nomeArquivo).name, agora); }
  // Ideia digitada: o texto inteiro vira o slug (um ponto no meio não é extensão).
  novoIdDeTexto(texto, agora = Date.now()) { return this.idDe(String(texto), agora); }
  idDe(textoBase, agora) {
    const dia = new Date(agora).toISOString().slice(0, 10);
    const base = textoBase.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/^-+|-+$/g, '') || 'video';
    let id = `${dia}-${base}`, n = 2;
    while (fs.existsSync(path.join(this.videosDir, id))) id = `${dia}-${base}-${n++}`;
    return id;
  }
  salvar(ficha) {
    const destino = path.join(this.pasta(ficha.id), 'ficha.json');
    const tmp = destino + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(ficha, null, 2));
    // No Windows, antivírus e indexador seguram o arquivo por instantes: tenta de novo algumas vezes.
    for (let tentativa = 1; ; tentativa++) {
      try { fs.renameSync(tmp, destino); return ficha; }
      catch (e) {
        if (tentativa >= TENTATIVAS || !OCUPADO.has(e.code)) { try { fs.rmSync(tmp, { force: true }); } catch {} throw e; }
        Atomics.wait(ESPERA, 0, 0, 50);
      }
    }
  }
  carregar(id) {
    if (!this.idValido(id)) return null;
    try { return JSON.parse(fs.readFileSync(path.join(this.pasta(id), 'ficha.json'), 'utf8')); } catch { return null; }
  }
  listar() {
    let nomes = [];
    try { nomes = fs.readdirSync(this.videosDir); } catch { return []; }
    return nomes.filter(n => this.idValido(n)).map(n => this.carregar(n)).filter(Boolean)
      .sort((a, b) => b.criadaEm - a.criadaEm);
  }
}
