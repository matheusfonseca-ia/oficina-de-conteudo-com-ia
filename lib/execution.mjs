// One process budget for tasks, team pieces, routing and chat.
export class ExecutionLimiter {
  constructor(max = 2) { this.max = Math.max(1, Math.min(8, Number(max) || 2)); this.active = 0; this.pending = []; }
  acquire(signal) {
    if (signal?.aborted) return Promise.reject(signal.reason || new Error('Execução cancelada.'));
    return new Promise((resolve, reject) => {
      const item = { resolve, reject, signal, abort: null };
      item.abort = () => { const i = this.pending.indexOf(item); if (i >= 0) this.pending.splice(i, 1); reject(signal.reason || new Error('Execução cancelada.')); };
      signal?.addEventListener('abort', item.abort, { once: true });
      this.pending.push(item); this.drain();
    });
  }
  drain() {
    while (this.active < this.max && this.pending.length) {
      const item = this.pending.shift(); item.signal?.removeEventListener('abort', item.abort);
      if (item.signal?.aborted) { item.reject(item.signal.reason); continue; }
      this.active++; let released = false;
      item.resolve(() => { if (released) return; released = true; this.active--; this.drain(); });
    }
  }
  async run(fn, signal) { const release = await this.acquire(signal); try { signal?.throwIfAborted(); return await fn(); } finally { release(); } }
  summary() { return { active: this.active, queued: this.pending.length, max: this.max }; }
}
