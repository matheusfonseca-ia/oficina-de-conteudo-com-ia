// Test fixture: stands in for `claude`. Never touches the network.
// Edição: reads the /oficina-de-conteudo-motor command and writes edit/estado.json in cwd.
// Postagem: answers with OFC_TEST_POSTAGEM (raw text) or a valid JSON.
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const val = f => { const i = args.indexOf(f); return i < 0 ? null : args[i + 1]; };
const prompt = val('-p') || '';
if (process.env.OFC_TEST_LOG) fs.appendFileSync(process.env.OFC_TEST_LOG, JSON.stringify({ args, cwd: process.cwd() }) + '\n');
const emit = e => process.stdout.write(JSON.stringify(e) + '\n');
emit({ type: 'system', subtype: 'init', session_id: val('--session-id') || val('--resume') || 'x' });
const modo = process.env.OFC_TEST_MODO || 'ok';
if (modo === 'sem-resultado') process.exit(0);
// lento: grava o próprio PID em OFC_TEST_PID e fica rodando (pra testar o fechamento da Oficina).
if (modo === 'lento') { if (process.env.OFC_TEST_PID) fs.writeFileSync(process.env.OFC_TEST_PID, String(process.pid)); setTimeout(() => {}, 120000); }
const cmd = modo === 'lento' ? null : prompt.match(/^\/oficina-de-conteudo-motor (\S+)/)?.[1];
if (modo === 'lento') { /* sem resposta */ } else if (cmd) {
  const edit = path.join(process.cwd(), 'edit'); fs.mkdirSync(edit, { recursive: true });
  const etapa = { PREPARAR: 'aguardando-escolhas', ESCOLHAS_PRONTAS: 'revisao', 'REVISAR:': 'revisao', EXPORTAR: 'exportado', REABRIR_STUDIO: 'revisao' }[cmd];
  const estado = modo === 'erro' ? { etapa: 'erro', erro: 'Falta instalar o FFmpeg', progresso: 0, mensagem: '' }
    : { etapa, progresso: 1, mensagem: 'ok', studioUrl: etapa === 'revisao' ? 'http://127.0.0.1:9/' : null, erro: null };
  if (modo === 'corrompido') fs.writeFileSync(path.join(edit, 'estado.json'), '{');
  else if (modo !== 'sem-estado') fs.writeFileSync(path.join(edit, 'estado.json'), JSON.stringify(estado));
  if (cmd === 'PREPARAR') fs.writeFileSync(path.join(edit, 'painel-contexto.json'), '{}');
  // sem-mp4 / sem-resumo: a exportação diz "exportado" mas não deixa o arquivo.
  if (cmd === 'EXPORTAR' && modo !== 'sem-mp4') fs.writeFileSync(path.join(edit, 'final.mp4'), 'mp4');
  if (cmd === 'EXPORTAR' && modo !== 'sem-resumo') fs.writeFileSync(path.join(edit, 'resumo.md'), '# Resumo do vídeo\nTema: teste');
  // sem-resultado-feito: gravou o estado certo e saiu sem a mensagem final.
  if (modo !== 'sem-resultado-feito') emit({ type: 'result', subtype: 'success', result: 'feito' });
} else {
  const texto = process.env.OFC_TEST_POSTAGEM ?? JSON.stringify({ legenda: 'Legenda de teste', hashtags: ['#ia', '#reels'], horario: '2099-01-01T18:00:00-03:00', motivoHorario: 'fim de tarde' });
  emit({ type: 'result', subtype: 'success', result: texto });
}
