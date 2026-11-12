// Som da prévia: a música e os efeitos são sintetizados aqui, como a Máquina
// faz na edição (sem arquivos de áudio prontos). É uma amostra do clima.

const CLIMAS = {
  eletronica: { bpm: 110, raiz: 57, escala: [0, 3, 7, 10], bumbo: [0, 4, 8, 12], chimbal: [2, 6, 10, 14], timbre: 'triangle', pad: true },
  escura: { bpm: 104, raiz: 50, escala: [0, 3, 7, 8], bumbo: [0, 6, 8], chimbal: [4, 12], timbre: 'sawtooth', pad: true, filtro: 700 },
  chiptune: { bpm: 110, raiz: 60, escala: [0, 4, 7, 12], bumbo: [0, 8], chimbal: [4, 12], timbre: 'square', arpejo: true },
  piano: { bpm: 84, raiz: 60, escala: [0, 4, 7, 11], bumbo: [], chimbal: [], timbre: 'sine', pad: true, piano: true },
  calma: { bpm: 90, raiz: 62, escala: [0, 2, 7, 9], bumbo: [0, 10], chimbal: [], timbre: 'sine', pad: true, piano: true },
  energetica: { bpm: 124, raiz: 57, escala: [0, 3, 7, 12], bumbo: [0, 4, 8, 12], chimbal: [2, 6, 10, 14, 15], timbre: 'sawtooth', pad: false, filtro: 1800 },
};

const nota = (m) => 440 * 2 ** ((m - 69) / 12);

export class Som {
  constructor() {
    this.ac = null;
    this.ligado = false;
    this.cfg = { clima: 'eletronica', efeitos: 'todos', pixel: false, musicaUrl: null };
    this.audio = null;
  }

  garantir() {
    if (this.ac) return this.ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ac = new AC();
    this.mestre = this.ac.createGain();
    this.mestre.gain.value = 0.55;
    this.mestre.connect(this.ac.destination);
    this.busMusica = this.ac.createGain();
    this.busMusica.gain.value = 0.32;
    this.busMusica.connect(this.mestre);
    // Padrão universal: efeitos 8 dB mais baixos (bem abaixo da voz).
    this.busEfeitos = this.ac.createGain();
    this.busEfeitos.gain.value = 0.4;
    this.busEfeitos.connect(this.mestre);
    this.ruido = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return this.ac;
  }

  definir(cfg) {
    // Durante uma amostra, a escolha nova vale pra quando a amostra acabar.
    if (this.antesDaAmostra) { this.antesDaAmostra.cfg = { ...this.antesDaAmostra.cfg, ...cfg }; return; }
    const mudouMusica = cfg.clima !== this.cfg.clima || cfg.musicaUrl !== this.cfg.musicaUrl;
    this.cfg = { ...this.cfg, ...cfg };
    if (this.ligado && mudouMusica) { this.pararMusica(); this.tocarMusica(); }
  }

  // Se o som da prévia está ligado pela pessoa (sem contar uma amostra tocando).
  get ativo() { return this.antesDaAmostra ? this.antesDaAmostra.ligado : this.ligado; }

  ligar() {
    if (this.antesDaAmostra) { this.antesDaAmostra.ligado = true; return; }
    this.garantir();
    this.ac.resume();
    this.ligado = true;
    this.tocarMusica();
  }

  desligar() {
    if (this.antesDaAmostra) this.antesDaAmostra.ligado = false;
    this.ligado = false;
    this.pararMusica();
  }

  // ------------------------------------------------------------ música

  tocarMusica() {
    if (!this.ligado) return;
    if (this.cfg.clima === 'sem') return;
    if (this.cfg.clima === 'pasta' && this.cfg.musicaUrl) {
      this.audio = new Audio(this.cfg.musicaUrl);
      this.audio.loop = true;
      this.audio.volume = 0.35;
      this.audio.play().catch(() => {});
      return;
    }
    const c = CLIMAS[this.cfg.clima] || CLIMAS.eletronica;
    const ac = this.garantir();
    const semi = 60 / c.bpm / 4;
    let passo = 0;
    let proximo = ac.currentTime + 0.05;
    const agendar = () => {
      while (proximo < ac.currentTime + 0.15) {
        this.passoMusica(c, passo, proximo, semi);
        proximo += semi;
        passo = (passo + 1) % 64;
      }
    };
    agendar();
    this.relogio = setInterval(agendar, 30);
  }

  pararMusica() {
    clearInterval(this.relogio);
    this.relogio = null;
    if (this.audio) { this.audio.pause(); this.audio = null; }
  }

  passoMusica(c, passo, t, semi) {
    const p16 = passo % 16;
    const compasso = Math.floor(passo / 16);
    const graus = [0, 5, 3, 4];
    const raiz = c.raiz + [0, 5, 3, -2][compasso];
    if (c.bumbo.includes(p16)) this.bumbo(t);
    if (c.chimbal.includes(p16)) this.chimbal(t);
    if (c.arpejo) {
      if (p16 % 2 === 0) this.tom(nota(raiz + c.escala[(p16 / 2) % 4]), t, semi * 1.6, 'square', 0.05);
    } else if (c.piano) {
      if (p16 === 0 || p16 === 6 || p16 === 10) this.tom(nota(raiz + 12 + c.escala[(p16 / 2) % 4]), t, semi * 7, 'sine', 0.08, true);
    } else if (p16 % 4 === 2) {
      this.tom(nota(raiz - 12), t, semi * 1.8, c.timbre, 0.09, false, c.filtro);
    }
    if (c.pad && p16 === 0) c.escala.slice(0, 3).forEach(i => this.tom(nota(raiz + i), t, semi * 15, 'triangle', 0.025, true));
    void graus;
  }

  bumbo(t) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.busMusica);
    o.start(t); o.stop(t + 0.26);
  }

  chimbal(t) {
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.ruido;
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.busMusica);
    s.start(t); s.stop(t + 0.06);
  }

  tom(freq, t, dur, tipo = 'sine', vol = 0.1, suave = false, filtro = null, destino = null) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (suave ? 0.08 : 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (filtro) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filtro; n = o.connect(f); }
    n.connect(g).connect(destino || this.busMusica);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  // ------------------------------------------------------------ efeitos

  permitido(tipo) {
    const e = this.cfg.efeitos;
    if (e === 'nenhum') return false;
    // Padrão universal: poucos efeitos, só nos eventos fortes. Sem tecla, tique, risco nem sobe.
    if (['tique', 'digita', 'risco', 'sobe'].includes(tipo)) return false;
    if (e === 'so-tum') return tipo === 'tum';
    if (e === 'essenciais' && (tipo === 'passagem' || tipo === 'riser')) return false;
    return true;
  }

  efeito(tipo, _cfg, forcar = false) {
    if (!forcar && (!this.ligado || !this.permitido(tipo))) return;
    const ac = this.garantir();
    const t = ac.currentTime + 0.01;
    // No máximo um efeito a cada 0,6 s.
    if (!forcar && tipo !== 'riser') {
      if (t - (this.ultimoEfeito ?? -1) < 0.6) return;
      this.ultimoEfeito = t;
    }
    const out = this.busEfeitos;
    const px = this.cfg.pixel;
    switch (tipo) {
      case 'pop':
        { const o = this.tom(520, t, 0.09, 'sine', 0.14, false, null, out); o.frequency.exponentialRampToValueAtTime(900, t + 0.06); }
        break;
      case 'tique': this.tom(2400, t, 0.025, 'square', 0.03, false, null, out); break;
      case 'clique': this.ruidoCurto(t, 0.02, 3000, 0.2); break;
      case 'digita': for (let i = 0; i < 8; i++) this.ruidoCurto(t + i * 0.1, 0.015, 2500 + (i % 3) * 400, 0.12); break;
      case 'impacto': { const o = this.tom(160, t, 0.35, 'sine', 0.35, false, null, out); o.frequency.exponentialRampToValueAtTime(50, t + 0.3); this.ruidoCurto(t, 0.12, 900, 0.18); break; }
      case 'tum': { const o = this.tom(70, t, 0.18, 'sine', 0.4, false, null, out); o.frequency.setValueAtTime(70, t); break; }
      case 'confirma':
        if (px) [784, 988, 1319].forEach((f, i) => this.tom(f, t + i * 0.07, 0.12, 'square', 0.05, false, null, out));
        else { this.tom(880, t, 0.12, 'sine', 0.1, false, null, out); this.tom(1320, t + 0.08, 0.18, 'sine', 0.1, false, null, out); }
        break;
      case 'moeda': this.tom(988, t, 0.08, 'square', 0.07, false, null, out); this.tom(1319, t + 0.08, 0.3, 'square', 0.07, false, null, out); break;
      case 'passagem': this.varredura(t, 0.35, 400, 4000, 0.16); break;
      case 'riser': this.varredura(t, 1.1, 200, 5000, 0.12); break;
      case 'sobe': { const o = this.tom(300, t, 0.9, 'triangle', 0.06, true, null, out); o.frequency.exponentialRampToValueAtTime(900, t + 0.9); break; }
      case 'risco': this.ruidoCurto(t, 0.3, 1800, 0.08); break;
      default: break;
    }
  }

  ruidoCurto(t, dur, freq, vol) {
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.ruido;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.busEfeitos);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  varredura(t, dur, de, ate, vol) {
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.ruido;
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(de, t);
    f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.busEfeitos);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // Amostra curta pros botões "Ouvir", mesmo com o som da prévia desligado.
  amostraMusica(clima, url) {
    // Guarda o estado de antes só na primeira amostra, pra cliques seguidos não o perderem.
    if (!this.antesDaAmostra) this.antesDaAmostra = { cfg: { ...this.cfg }, ligado: this.ligado };
    this.pararMusica();
    clearTimeout(this.fimAmostra);
    this.garantir(); this.ac.resume();
    this.cfg = { ...this.cfg, clima, musicaUrl: url };
    this.ligado = true;
    this.tocarMusica();
    this.fimAmostra = setTimeout(() => {
      const { cfg, ligado } = this.antesDaAmostra;
      this.antesDaAmostra = null;
      this.pararMusica();
      this.cfg = { ...cfg };
      this.ligado = ligado;
      if (ligado) this.tocarMusica();
    }, 5000);
  }

  amostraEfeitos(efeitos, pixel) {
    this.garantir(); this.ac.resume();
    // Não mexe na configuração: a amostra usa a própria paleta.
    const pode = (tp) => !(efeitos === 'nenhum' || (efeitos === 'so-tum' && tp !== 'tum') || (efeitos === 'essenciais' && (tp === 'passagem' || tp === 'riser')));
    const seq = efeitos === 'so-tum' ? ['tum', 'tum'] : ['riser', 'pop', 'clique', 'passagem', 'confirma', pixel ? 'moeda' : 'impacto'];
    const tempos = efeitos === 'so-tum' ? [0, 700] : [0, 1100, 1450, 1800, 2300, 2800];
    seq.forEach((tp, i) => setTimeout(() => {
      if (!pode(tp)) return;
      const antes = this.cfg.pixel;
      this.cfg.pixel = pixel;
      this.efeito(tp, null, true);
      this.cfg.pixel = antes;
    }, tempos[i]));
  }
}
