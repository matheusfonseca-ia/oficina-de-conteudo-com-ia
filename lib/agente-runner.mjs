// Runs an agent other than Claude Code (see lib/motores.mjs) without a screen and without a shell.
// lib/claude-runner.mjs is a literal copy from the Oficina de Agentes and stays as it is; this file is the Oficina's own.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { MOTORES } from './motores.mjs';

function matarArvore(child) {
  if (!child.pid || child.exitCode != null || child.signalCode != null) return;
  const forcar = () => { try { child.kill('SIGKILL'); } catch {} };
  if (process.platform === 'win32') {
    const k = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    k.on('error', forcar); k.on('close', code => { if (code !== 0) forcar(); });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { forcar(); }
  }
}

// On Windows the server spawns without a shell, and npm installs agents as a .cmd shim, which only a shell can run.
// Find the real program behind the name: an .exe on the PATH, or the .exe/.js the shim points to.
export function resolverComando(nome, { env = process.env, plataforma = process.platform, existe = fs.existsSync, ler = p => fs.readFileSync(p, 'utf8') } = {}) {
  const direto = { command: nome, prefixArgs: [] };
  if (plataforma !== 'win32' || /[\\/]/.test(nome) || path.win32.extname(nome)) return direto;
  const chave = Object.keys(env).find(k => k.toLowerCase() === 'path');
  const pastas = String(chave ? env[chave] : '').split(';').filter(Boolean);
  for (const pasta of pastas) { const exe = path.win32.join(pasta, `${nome}.exe`); if (existe(exe)) return { command: exe, prefixArgs: [] }; }
  for (const pasta of pastas) {
    const shim = path.win32.join(pasta, `${nome}.cmd`);
    if (!existe(shim)) continue;
    let texto = ''; try { texto = ler(shim); } catch { continue; }
    const alvo = texto.match(/%~?dp0%?\\([^"\r\n]+?\.(exe|js|mjs|cjs))"/i);
    if (!alvo) continue;
    const arquivo = path.win32.join(pasta, alvo[1]);
    return /\.exe$/i.test(arquivo) ? { command: arquivo, prefixArgs: [] } : { command: process.execPath, prefixArgs: [arquivo] };
  }
  return direto;
}

// The command of the chosen agent: what the config says (tests point it to a fake), or the real program found on this computer.
export function comandoDoAgente(config) {
  const motor = MOTORES[config.motor];
  if (config.agente?.command) return { command: config.agente.command, prefixArgs: config.agente.prefixArgs || [] };
  return resolverComando(motor.comando);
}

// What the startup check needs to know about the chosen agent. null for Claude Code, which has its own check.
export function agenteDaChecagem(config) {
  const motor = config.motor && config.motor !== 'claude' ? MOTORES[config.motor] : null;
  return motor ? { nome: motor.nome, comoInstalar: motor.comoInstalar, ...comandoDoAgente(config) } : null;
}

// Resolves with { text, sessao }. Rejects with code SEM_RESULTADO when the agent left without a final answer.
export function rodarAgente({ config, args, cwd, env = process.env, timeout = 300000, signal }) {
  signal?.throwIfAborted();
  const motor = MOTORES[config.motor];
  const { command, prefixArgs } = comandoDoAgente(config);
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...prefixArgs, ...args], { cwd, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const st = { texto: '', sessao: null, erro: null };
    let buffer = '', stderr = '', falha = null, acabou = false, reforco;
    const fim = (erro, valor) => {
      if (acabou) return; acabou = true;
      clearTimeout(relogio); clearTimeout(reforco); signal?.removeEventListener('abort', abortar);
      if (erro) { erro.sessao = st.sessao; reject(erro); } else resolve(valor);
    };
    const parar = erro => {
      if (acabou || falha) return;
      falha = erro; matarArvore(child);
      reforco = setTimeout(() => { if (!acabou) matarArvore(child); }, 5000); reforco.unref();
    };
    const abortar = () => parar(signal.reason || new Error('Execução cancelada.'));
    const relogio = setTimeout(() => parar(new Error(`O ${motor.nome} demorou mais de ${timeout / 1000} s.`)), timeout);
    signal?.addEventListener('abort', abortar, { once: true });
    if (signal?.aborted) abortar();
    const linha = l => { if (!l.trim()) return; let e; try { e = JSON.parse(l); } catch { return; } if (e && typeof e === 'object') motor.ler(e, st); };
    child.stdout.on('data', dados => {
      buffer += dados; let i;
      while ((i = buffer.indexOf('\n')) >= 0) { linha(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
      if (buffer.length > 2 * 1024 * 1024) parar(new Error(`A resposta do ${motor.nome} excedeu o limite de leitura.`));
    });
    child.stderr.on('data', dados => { stderr = (stderr + dados).slice(-2000); });
    child.on('error', erro => {
      const e = new Error(erro.code === 'ENOENT' ? `O ${motor.nome} não está instalado (${motor.comando} não encontrado). ${motor.comoInstalar}.` : erro.message);
      if (!child.pid) return fim(e);
      parar(e);
    });
    child.on('close', code => {
      linha(buffer);
      if (falha) return fim(falha);
      if (st.erro || code !== 0) {
        const e = new Error(String(st.erro || stderr.trim() || `O ${motor.nome} saiu com código ${code}.`).slice(0, 1200));
        e.code = 'AGENTE_FAILED'; return fim(e);
      }
      if (!String(st.texto).trim()) { const e = new Error(`O ${motor.nome} não devolveu um resultado concluído.`); e.code = 'SEM_RESULTADO'; return fim(e); }
      fim(null, { text: String(st.texto).trim(), sessao: st.sessao });
    });
  });
}
