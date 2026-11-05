import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export class PaineisMaquina {
  constructor({ skillsDir, node = process.execPath, script = null }) {
    this.script = script || path.join(skillsDir, 'maquina-de-edicao', 'painel', 'servidor.mjs');
    this.node = node; this.abertos = new Map(); // fichaId → { url, child }
  }
  aberto(id) { return this.abertos.get(id)?.url || null; }
  abrir(id, pastaVideo, aoTerminar) {
    if (this.abertos.has(id)) return Promise.resolve(this.abertos.get(id).url);
    fs.mkdirSync(path.join(pastaVideo, 'edit'), { recursive: true });
    return new Promise((resolve, reject) => {
      const child = spawn(this.node, [this.script, '--contexto', 'edit/painel-contexto.json', '--saida', 'edit/escolhas.json', '--sem-navegador'],
        { cwd: pastaVideo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let buffer = '', url = null, stderr = '';
      child.stdout.on('data', d => {
        buffer += d;
        const m = buffer.match(/PAINEL_ABERTO (\S+)/);
        if (m && !url) { url = m[1]; this.abertos.set(id, { url, child }); resolve(url); }
      });
      child.stderr.on('data', d => { stderr = (stderr + d).slice(-1000); });
      child.on('error', e => reject(new Error('O painel da Máquina não abriu: ' + e.message)));
      child.on('close', code => {
        this.abertos.delete(id);
        if (!url) return reject(new Error('O painel da Máquina não abriu. ' + (stderr.trim() || `Código ${code}.`)));
        aoTerminar(code);
      });
    });
  }
  fecharTodos() { for (const { child } of this.abertos.values()) try { child.kill(); } catch {} this.abertos.clear(); }
}
