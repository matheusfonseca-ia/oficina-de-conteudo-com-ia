import { spawn } from 'node:child_process';

function killTree(child) {
  // A parent can exit while inherited pipes remain open. Do not send taskkill
  // to its former PID again: the OS may already have reused that PID.
  if (!child.pid || child.exitCode != null || child.signalCode != null) return;
  const fallback = () => { try { child.kill('SIGKILL'); } catch {} };
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', fallback);
    killer.on('close', code => { if (code !== 0) fallback(); });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { fallback(); }
  }
}

// Tests can provide a local stub binary; no shell interpolation or Claude calls required.
export function runClaude({ command = 'claude', prefixArgs = [], args, cwd, env, timeout = 300000, signal, onInit = () => {} }) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...prefixArgs, ...args], { cwd, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let buffer = '', stderr = '', result = null, failure = null, finished = false, killTimer;
    const used = new Set(), calls = new Map(), outcomes = new Map();
    const finish = (error, value) => {
      if (finished) return; finished = true;
      clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const stop = error => {
      if (finished || failure) return;
      failure = error; killTree(child);
      // Reinforce termination, but retain the execution budget until the actual
      // close event confirms that the process and inherited stdio have closed.
      killTimer = setTimeout(() => { if (!finished) { killTree(child); try { child.kill('SIGKILL'); } catch {} } }, 5000);
      killTimer.unref();
    };
    const abort = () => stop(signal.reason || new Error('Execução cancelada.'));
    const timer = setTimeout(() => stop(new Error(`O Claude demorou mais de ${timeout / 1000} s.`)), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const feed = line => {
      if (!line.trim()) return;
      let event; try { event = JSON.parse(line); } catch { return; }
      if (event.type === 'system' && event.subtype === 'init') onInit(event);
      for (const block of event.message?.content || []) {
        if (block.type === 'tool_use' && block.name) { used.add(block.name); if (block.id) calls.set(block.id, { id: block.id, tool: block.name, input: block.input }); }
        if (block.type === 'tool_result' && block.tool_use_id) outcomes.set(block.tool_use_id, { completed: true, isError: block.is_error === true });
      }
      if (event.type === 'result') result = event;
    };
    child.stdout.on('data', data => {
      buffer += data; let end;
      while ((end = buffer.indexOf('\n')) >= 0) { feed(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
      if (buffer.length > 2 * 1024 * 1024) stop(new Error('A resposta do Claude excedeu o limite de leitura.'));
    });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000); });
    child.on('error', error => {
      const message = new Error(error.code === 'ENOENT' ? 'O Claude Code não está instalado (claude não encontrado no PATH).' : error.message);
      if (!child.pid) return finish(message); // Spawn failed: no process owns a slot.
      stop(message); // A failed kill must not release a still-running process.
    });
    child.on('close', code => {
      feed(buffer);
      if (failure) return finish(failure);
      if (code !== 0 || result?.is_error) {
        const error = new Error(String(result?.result || result?.errors?.join(' · ') || stderr.trim() || `O Claude saiu com código ${code}.`).slice(0, 1200));
        error.code = 'CLAUDE_FAILED'; error.subtype = result?.subtype; return finish(error);
      }
      if (!result || !String(result.result || '').trim()) return finish(new Error('O Claude não devolveu um resultado concluído.'));
      finish(null, { text: String(result.result).trim(), tools: [...used], toolResults: [...calls.values()].map(call => ({ ...call, ...(outcomes.get(call.id) || { completed: false }) })), usage: result.usage || null, modelUsage: result.modelUsage || {} });
    });
  });
}
