import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { MOTOR } from '../config.mjs';

export class PaineisMaquina {
  constructor({ skillsDir, node = process.execPath, script = null }) {
    this.script = script || path.join(skillsDir, MOTOR, 'painel', 'servidor.mjs');
    this.node = node; this.abertos = new Map(); // fichaId → { url (null enquanto abre), child, promessa }
  }
  aberto(id) { return this.abertos.get(id)?.url || null; }
  abrir(id, pastaVideo, aoTerminar) {
    if (this.abertos.has(id)) return this.abertos.get(id).promessa;
    fs.mkdirSync(path.join(pastaVideo, 'edit'), { recursive: true });
    const entrada = { url: null, child: null, promessa: null };
    entrada.promessa = new Promise((resolve, reject) => {
      const child = spawn(this.node, [this.script, '--contexto', 'edit/painel-contexto.json', '--saida', 'edit/escolhas.json', '--sem-navegador'],
        { cwd: pastaVideo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      entrada.child = child;
      let buffer = '', stderr = '';
      child.stdout.on('data', d => {
        buffer += d;
        const m = buffer.match(/PAINEL_ABERTO (\S+)/);
        if (m && !entrada.url) { entrada.url = m[1]; resolve(entrada.url); }
      });
      child.stderr.on('data', d => { stderr = (stderr + d).slice(-1000); });
      child.on('error', e => { this.abertos.delete(id); reject(new Error('O painel da Máquina não abriu: ' + e.message)); });
      child.on('close', code => {
        this.abertos.delete(id);
        if (!entrada.url) return reject(new Error('O painel da Máquina não abriu. ' + (stderr.trim() || `Código ${code}.`)));
        aoTerminar(code);
      });
    });
    this.abertos.set(id, entrada); // já registrado enquanto abre: clique duplo não abre dois
    return entrada.promessa;
  }
  fecharTodos() { for (const { child } of this.abertos.values()) try { child?.kill(); } catch {} this.abertos.clear(); }
}
