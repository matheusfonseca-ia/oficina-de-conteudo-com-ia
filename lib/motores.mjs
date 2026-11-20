// The agents that can drive the rooms. Claude Code is the default and keeps its own runner (lib/claude-runner.mjs);
// the others say here how to be called without a screen and how to read their JSONL output.
// Freebuff is not here on purpose: it has no mode without a screen, so the Oficina cannot call it.

const comModelo = (flag, modelo) => (modelo ? [flag, modelo] : []);

export const MOTORES = {
  claude: { nome: 'Claude Code', comando: 'claude', comoInstalar: 'Instale em https://claude.com/claude-code e faça login' },

  codex: {
    nome: 'Codex', comando: 'codex', comoInstalar: 'Instale com "npm install -g @openai/codex" e faça login com "codex login"',
    // Rooms without a terminal: read-only sandbox, nothing saved, the student's config (MCP, hooks) left out.
    argsSala({ prompt, web = false, modelo = null }) {
      return ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '-s', 'read-only',
        ...(web ? ['-c', 'web_search="live"'] : []), ...comModelo('-m', modelo), prompt];
    },
    // Edição: same reach as Claude's Bash (not an OS sandbox). The session id comes back in thread.started.
    argsEdicao({ prompt, sessao = null, modelo = null }) {
      const comuns = ['--json', '--skip-git-repo-check', '--ignore-user-config', '--dangerously-bypass-approvals-and-sandbox', ...comModelo('-m', modelo)];
      return sessao ? ['exec', 'resume', ...comuns, sessao, prompt] : ['exec', ...comuns, prompt];
    },
    ler(evento, st) {
      if (evento.type === 'thread.started' && evento.thread_id) st.sessao = evento.thread_id;
      if (evento.type === 'item.completed' && evento.item?.type === 'agent_message' && evento.item.text) st.texto = evento.item.text;
      if (evento.type === 'error') st.erro = mensagemDe(evento.message);
      if (evento.type === 'turn.failed') st.erro = mensagemDe(evento.error?.message) || st.erro;
    },
  },

  opencode: {
    nome: 'OpenCode', comando: 'opencode', comoInstalar: 'Instale em https://opencode.ai e conecte um provedor com "opencode auth login"',
    // Rooms without a terminal: the built-in "plan" agent does not edit files, and without --auto nothing else is approved.
    argsSala({ prompt, modelo = null }) {
      return ['run', '--format', 'json', '--agent', 'plan', ...comModelo('--model', modelo), prompt];
    },
    argsEdicao({ prompt, sessao = null, modelo = null }) {
      return ['run', '--format', 'json', '--auto', ...(sessao ? ['--session', sessao] : []), ...comModelo('--model', modelo), prompt];
    },
    ler(evento, st) {
      if (evento.sessionID) st.sessao = evento.sessionID;
      if (evento.type === 'text' && evento.part?.text) st.texto = evento.part.text;
      if (evento.type === 'error') st.erro = mensagemDe(evento.error?.message || evento.error?.data?.message || evento.message);
    },
  },
};

// Codex wraps the provider's error as JSON inside a string: show the sentence, not the envelope.
function mensagemDe(bruto) {
  if (!bruto) return null;
  try { const j = JSON.parse(bruto); return String(j?.error?.message || j?.message || bruto); } catch { return String(bruto); }
}

export const idDoMotor = valor => (Object.hasOwn(MOTORES, valor) ? valor : 'claude');
// null for Claude Code: its rooms keep using the Claude runner untouched.
export const outroMotor = config => (config?.motor && config.motor !== 'claude' ? MOTORES[config.motor] || null : null);
