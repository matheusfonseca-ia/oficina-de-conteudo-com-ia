// Test fixture: stands in for `codex` and `opencode`. Never touches the network.
// Speaks each agent's JSONL (OFC_TEST_AGENTE = codex | opencode). Edição: reads the "/oficina-de-conteudo-motor CMD" line of the prompt
// and writes edit/estado.json in cwd, like the real engine does. Other rooms: answers OFC_TEST_RESPOSTA (default {"ok":true}).
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const tipo = process.env.OFC_TEST_AGENTE || 'codex';
const modo = process.env.OFC_TEST_MODO || 'ok';
const prompt = args.at(-1) || '';
if (process.env.OFC_TEST_LOG) fs.appendFileSync(process.env.OFC_TEST_LOG, JSON.stringify({ args, cwd: process.cwd() }) + '\n');
const emit = e => process.stdout.write(JSON.stringify(e) + '\n');
const sessao = tipo === 'codex' ? '01a1fa35-0237-7ac1-a4fb-93baec49eb20' : 'ses_e05cab23cffeGJMWZUMQ7bvyQn';
function falar(texto) {
  if (tipo === 'codex') {
    emit({ type: 'item.completed', item: { id: 'item_1', type: 'agent_message', text: texto } });
    emit({ type: 'turn.completed', usage: {} });
  } else {
    emit({ type: 'text', sessionID: sessao, part: { type: 'text', text: texto } });
    emit({ type: 'step_finish', sessionID: sessao, part: {} });
  }
}
if (tipo === 'codex') { emit({ type: 'thread.started', thread_id: sessao }); emit({ type: 'turn.started' }); }
else emit({ type: 'step_start', sessionID: sessao, part: {} });

if (modo === 'erro-do-provedor') {
  // Shapes copied from real runs of codex-cli 0.136.0 and opencode 2.1.3.
  if (tipo === 'codex') {
    const message = JSON.stringify({ type: 'error', status: 400, error: { type: 'invalid_request_error', message: 'Modelo recusado pela conta.' } });
    emit({ type: 'error', message }); emit({ type: 'turn.failed', error: { message } });
    process.exit(1);
  }
  emit({ type: 'error', timestamp: 1, sessionID: sessao, error: { type: 'provider.auth', message: 'Chave recusada pelo provedor.', status: 400 } });
  process.exit(0);
}
if (modo === 'sem-resultado') process.exit(0);

const cmd = prompt.match(/^\/oficina-de-conteudo-motor (\S+)/m)?.[1];
if (cmd) {
  const edit = path.join(process.cwd(), 'edit'); fs.mkdirSync(edit, { recursive: true });
  const etapa = { PREPARAR: 'aguardando-escolhas', ESCOLHAS_PRONTAS: 'revisao', 'REVISAR:': 'revisao', EXPORTAR: 'exportado', REABRIR_STUDIO: 'revisao' }[cmd];
  fs.writeFileSync(path.join(edit, 'estado.json'), JSON.stringify({ etapa, progresso: 1, mensagem: 'ok', studioUrl: etapa === 'revisao' ? 'http://127.0.0.1:9/' : null, erro: null }));
  if (cmd === 'EXPORTAR') {
    fs.writeFileSync(path.join(edit, 'final.mp4'), 'mp4');
    fs.writeFileSync(path.join(edit, 'resumo.md'), '# Resumo do vídeo\nTema: teste');
  }
  if (modo !== 'sem-resultado-feito') falar('feito');
} else {
  falar(process.env.OFC_TEST_RESPOSTA ?? '{"ok":true}');
}
