import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { montarPromptRoteiro, lerRespostaRoteiro, rodarRoteiro, roteiroEmTexto } from '../lib/runner-roteiro.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const config = { claude: { command: process.execPath, prefixArgs: [FAKE] } };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-rot-'));
const ROT = { titulo: 'T', gancho: 'G', desenvolvimento: ['d1', 'd2'], cta: 'C', duracaoSegundos: 40 };

test('prompt carries idea, profile, chosen reference, past adjustments, previous version and the request', () => {
  const p = montarPromptRoteiro({ tema: 'IA no varejo', perfil: 'Tom: direto', referencia: { titulo: 'Ref X', url: 'https://x', porQueFuncionou: 'número no gancho', gancho: '3 erros' },
    aprendizados: '- 2026-11-01: sem palavrão', revisao: 'mais curto', anterior: ROT });
  for (const s of ['IA no varejo', 'Tom: direto', 'Ref X', 'número no gancho', '3 erros', 'sem palavrão', 'mais curto', '## Gancho\nG']) assert.ok(p.includes(s), s);
});

test('prompt without reference or revision has no empty sections', () => {
  const p = montarPromptRoteiro({ tema: 'IA', perfil: null, referencia: null, aprendizados: '', revisao: null, anterior: null });
  assert.ok(!p.includes('Referência escolhida')); assert.ok(!p.includes('Versão anterior')); assert.ok(p.includes('tom direto e casual'));
});

test('lerRespostaRoteiro cleans the answer; missing hook or body is a pt-BR error', () => {
  const r = lerRespostaRoteiro('Pronto:\n{"titulo":"","gancho":" G ","desenvolvimento":[" a ",""," b "],"cta":"C","duracaoSegundos":"40"}');
  assert.deepEqual(r, { titulo: 'Roteiro', gancho: 'G', desenvolvimento: ['a', 'b'], cta: 'C', duracaoSegundos: 40 });
  assert.equal(lerRespostaRoteiro('{"gancho":"G","desenvolvimento":["a"],"duracaoSegundos":9999}').duracaoSegundos, null);
  assert.throws(() => lerRespostaRoteiro('{"gancho":"","desenvolvimento":["a"]}'), /não devolveu o roteiro/);
  assert.throws(() => lerRespostaRoteiro('nada'), /não devolveu o roteiro/);
});

test('rodarRoteiro: no tools, writes roteiro.md in the video folder', async () => {
  const pasta = tmp();
  let visto;
  const run = async o => { visto = o; return { text: JSON.stringify(ROT) }; };
  const r = await rodarRoteiro({ pastaVideo: pasta, ficha: { tema: 'IA', referencia: null, revisao: null, roteiro: null }, cerebroDir: tmp(), config, run });
  assert.deepEqual(r, ROT);
  assert.equal(visto.args[visto.args.indexOf('--tools') + 1], '');
  assert.equal(fs.readFileSync(path.join(pasta, 'roteiro.md'), 'utf8'), roteiroEmTexto(ROT));
  assert.match(roteiroEmTexto(ROT), /^# T\n\n## Gancho\nG\n\n## Desenvolvimento\n1\. d1\n2\. d2/);
});

test('rodarRoteiro with the fake Claude', async () => {
  const r = await rodarRoteiro({ pastaVideo: tmp(), ficha: { tema: 'IA', referencia: null, revisao: null, roteiro: null }, cerebroDir: tmp(), config });
  assert.equal(r.gancho, 'Gancho de teste');
});

test('prompt com oQueFuncionou leva a seção do Cérebro; sem ele, nada', () => {
  const p = montarPromptRoteiro({ tema: 'IA', perfil: null, oQueFuncionou: '# O que funcionou nos seus posts\n- 2026-11-20: Gancho com número (https://x/1)' });
  assert.ok(p.includes('## O que já funcionou pra este perfil\n# O que funcionou nos seus posts\n- 2026-11-20: Gancho com número (https://x/1)'));
  assert.ok(!montarPromptRoteiro({ tema: 'IA', perfil: null }).includes('O que já funcionou'));
});

test('rodarRoteiro lê cerebro/o-que-funcionou.md e manda no prompt (o mesmo texto da Pesquisa)', async () => {
  const cerebro = tmp();
  fs.writeFileSync(path.join(cerebro, 'o-que-funcionou.md'), '# O que funcionou nos seus posts\n\n- 2026-11-20: Final com pergunta (https://x/2)\n');
  let prompt;
  const run = async o => { prompt = o.args[o.args.indexOf('-p') + 1]; return { text: JSON.stringify(ROT) }; };
  await rodarRoteiro({ pastaVideo: tmp(), ficha: { tema: 'IA', referencia: null, revisao: null, roteiro: null }, cerebroDir: cerebro, config, run });
  assert.ok(prompt.includes('## O que já funcionou pra este perfil\n# O que funcionou nos seus posts\n\n- 2026-11-20: Final com pergunta (https://x/2)'));
  // sem o arquivo, a seção não aparece
  await rodarRoteiro({ pastaVideo: tmp(), ficha: { tema: 'IA', referencia: null, revisao: null, roteiro: null }, cerebroDir: tmp(), config, run });
  assert.ok(!prompt.includes('O que já funcionou'));
});
