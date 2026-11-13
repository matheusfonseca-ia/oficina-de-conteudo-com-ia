// The student's own keys (Higgsfield now; Post for Me in stage 4). They live in <dados>/config.json,
// next to the other local settings, and only the server reads them: the page only learns true/false.
import fs from 'node:fs';
import path from 'node:path';

export const SERVICOS = ['higgsfield'];
const FORMATO = {
  higgsfield: { ok: c => /^[^:]+:[^:]+$/.test(c), erro: 'Cole a chave no formato ID:SEGREDO, como aparece no Higgsfield.' },
};
const NOMES = { higgsfield: 'Higgsfield' };

const arquivo = dadosDir => path.join(dadosDir, 'config.json');
function lerConfig(dadosDir) { try { return JSON.parse(fs.readFileSync(arquivo(dadosDir), 'utf8')) || {}; } catch { return {}; } }
function gravarConfig(dadosDir, cfg) {
  fs.mkdirSync(dadosDir, { recursive: true });
  const tmp = `${arquivo(dadosDir)}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2)); fs.renameSync(tmp, arquivo(dadosDir));
}
function conferirServico(servico) { if (!SERVICOS.includes(servico)) throw new Error('Essa conexão eu não conheço.'); }

export function estadoConexoes(dadosDir) {
  const cfg = lerConfig(dadosDir);
  return Object.fromEntries(SERVICOS.map(s => [s, typeof cfg[s] === 'string' && cfg[s].length > 0]));
}

export function chaveDe(dadosDir, servico) {
  const v = lerConfig(dadosDir)[servico];
  return typeof v === 'string' && v ? v : null;
}

export async function conectar(dadosDir, servico, valor, { testar }) {
  conferirServico(servico);
  const chave = String(valor ?? '').replace(/\s+/g, '');
  if (!FORMATO[servico].ok(chave)) throw new Error(FORMATO[servico].erro);
  try { await testar(chave); } catch (e) {
    if (e?.code === 'SEM_CONEXAO') throw new Error(`Não consegui falar com o ${NOMES[servico]} agora. Confira a internet e tente de novo.`);
    throw new Error(`Essa chave do ${NOMES[servico]} não funcionou. Confira se copiou inteira.`);
  }
  gravarConfig(dadosDir, { ...lerConfig(dadosDir), [servico]: chave });
  return estadoConexoes(dadosDir);
}

export function desconectar(dadosDir, servico) {
  conferirServico(servico);
  const cfg = lerConfig(dadosDir);
  delete cfg[servico];
  gravarConfig(dadosDir, cfg);
  return estadoConexoes(dadosDir);
}
