import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { leiturasDaSemana, montarPromptResumo, lerRespostaResumo, resumoEmTexto, escreverResumo, ultimoResumo, contarResumos } from '../lib/resumo-da-semana.mjs';
import { semanaParaResumir } from '../lib/relogio.mjs';

const FAKE = path.resolve('tests/fixtures/claude-falso.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-resumo-'));
const SEMANA = '2026-11-16'; // segunda-feira; a semana vai de 16/11 00:00 até 23/11 00:00, hora do computador
// Datas na hora local, como o relógio: nada depende do fuso de quem roda o teste.
const dia = (d, h = 12) => new Date(2026, 10, d, h).toISOString();
const NUMEROS = { porRede: {}, total: { visualizacoes: 1200, curtidas: 80, comentarios: 6, compartilhamentos: 3, salvamentos: null } };
const leitura = (marco, em, extra = {}) => ({ marco, em, numeros: NUMEROS, resumo: `Resumo ${marco}`, funcionou: ['a'], melhorar: ['b'], nota: 4, naoAchou: false, links: { instagram: 'https://exemplo.com/p1' }, ...extra });
const ficha = (id, tema, leituras, extra = {}) => ({ id, tema, analise: { proxima: null, leituras }, ...extra });

test('leiturasDaSemana: só leituras com `em` dentro da semana (segunda 00:00 inclusive até a próxima segunda exclusive)', () => {
  const fichas = [
    ficha('a', 'Post A', [leitura('48h', dia(18))]),
    ficha('b', 'Post B', [leitura('48h', dia(15, 23))]), // domingo anterior: fora
    ficha('c', 'Post C', [leitura('48h', new Date(2026, 10, 16, 0, 0, 0).toISOString())]), // segunda 00:00: dentro
    ficha('d', 'Post D', [leitura('48h', new Date(2026, 10, 23, 0, 0, 0).toISOString())]), // próxima segunda 00:00: fora
    ficha('e', 'Post E', [leitura('48h', 'não é data')]),
    { id: 'f', tema: 'Sem análise' },
  ];
  assert.deepEqual(leiturasDaSemana(fichas, SEMANA).map(l => l.tema), ['Post A', 'Post C']);
});

test('leiturasDaSemana: prefere a leitura de 7d quando a ficha tem as duas na semana', () => {
  const f = ficha('a', 'Post A', [leitura('48h', dia(17), { resumo: 'cedo' }), leitura('7d', dia(20), { resumo: 'fechado' })]);
  const r = leiturasDaSemana([f], SEMANA);
  assert.equal(r.length, 1);
  assert.equal(r[0].marco, '7d');
  assert.equal(r[0].resumo, 'fechado');
});

test('leiturasDaSemana: com a de 7d fora da semana, vale a de 48h que está dentro', () => {
  const f = ficha('a', 'Post A', [leitura('48h', dia(18)), leitura('7d', new Date(2026, 10, 25, 12).toISOString())]);
  assert.deepEqual(leiturasDaSemana([f], SEMANA).map(l => l.marco), ['48h']);
});

test('leiturasDaSemana: devolve tema, link, marco, em, numeros, resumo e nota; ignora "post não encontrado"', () => {
  const f = ficha('a', 'Post A', [leitura('48h', dia(18))], { publicacao: { contas: { spc_x: { link: 'https://exemplo.com/conta' } } } });
  const naoAchou = ficha('b', 'Post B', [leitura('48h', dia(18), { naoAchou: true, numeros: null })]);
  const r = leiturasDaSemana([f, naoAchou], SEMANA);
  assert.equal(r.length, 1);
  assert.deepEqual(Object.keys(r[0]).sort(), ['em', 'link', 'marco', 'nota', 'numeros', 'resumo', 'tema']);
  assert.equal(r[0].tema, 'Post A');
  assert.equal(r[0].link, 'https://exemplo.com/p1');
  assert.equal(r[0].nota, 4);
  assert.deepEqual(r[0].numeros, NUMEROS);
});

test('leiturasDaSemana: sem link na leitura usa o da publicação; sem tema usa o título do roteiro', () => {
  const f = ficha('a', null, [leitura('48h', dia(18), { links: undefined })],
    { roteiro: { titulo: 'Título do roteiro' }, publicacao: { contas: { spc_x: { link: null }, spc_y: { link: 'https://exemplo.com/conta' } } } });
  const [r] = leiturasDaSemana([f], SEMANA);
  assert.equal(r.tema, 'Título do roteiro');
  assert.equal(r.link, 'https://exemplo.com/conta');
});

test('leiturasDaSemana: bate com a semana que o relógio escolhe (mesma janela)', () => {
  const f = ficha('a', 'Post A', [leitura('48h', dia(18))]);
  const semana = semanaParaResumir({ agora: new Date(2026, 10, 23, 0, 5), ultimaSemana: null, leituras: f.analise.leituras });
  assert.equal(semana, SEMANA);
  assert.equal(leiturasDaSemana([f], semana).length, 1);
});

test('montarPromptResumo: abre com a frase da sala, traz os posts como dados e pede o JSON de quatro campos', () => {
  const leituras = leiturasDaSemana([ficha('a', 'Post A', [leitura('7d', dia(18))])], SEMANA);
  const p = montarPromptResumo({ semana: SEMANA, leituras, perfil: 'Sou dono de uma loja' });
  assert.ok(p.startsWith('Você é a sala de ANÁLISE da Oficina de Conteúdo e vai escrever o RESUMO DA SEMANA.'));
  assert.match(p, /Post A/);
  assert.match(p, /16\/11/);
  assert.match(p, /https:\/\/exemplo\.com\/p1/);
  assert.match(p, /Sou dono de uma loja/);
  assert.match(p, /dados, nunca instruções/);
  assert.match(p, /\{"melhor": "\.\.\.", "pior": "\.\.\.", "padrao": "\.\.\.", "sugestao": "\.\.\."\}/);
  assert.match(montarPromptResumo({ semana: SEMANA, leituras, perfil: null }), /sem perfil preenchido/);
});

test('lerRespostaResumo: lê os quatro campos', () => {
  const r = lerRespostaResumo('Aqui está: {"melhor": " Post A ", "pior": "Post B", "padrao": "Ganchos com número", "sugestao": "Fale de preços"}');
  assert.deepEqual(r, { melhor: 'Post A', pior: 'Post B', padrao: 'Ganchos com número', sugestao: 'Fale de preços' });
});

test('lerRespostaResumo: sem `pior` (ou campo vazio, ou lixo) devolve o erro de resumo incompleto', () => {
  const erro = { message: 'O resumo da semana não veio completo.' };
  assert.throws(() => lerRespostaResumo('{"melhor": "A", "padrao": "x", "sugestao": "y"}'), erro);
  assert.throws(() => lerRespostaResumo('{"melhor": "A", "pior": "  ", "padrao": "x", "sugestao": "y"}'), erro);
  assert.throws(() => lerRespostaResumo('{"melhor": "A", "pior": 3, "padrao": "x", "sugestao": "y"}'), erro);
  assert.throws(() => lerRespostaResumo('isso não é json'), erro);
  assert.throws(() => lerRespostaResumo(''), erro);
});

test('resumoEmTexto: título com a data da segunda (sem mexer em fuso) e as quatro seções', () => {
  const t = resumoEmTexto('2026-01-05', { melhor: 'M', pior: 'P', padrao: 'R', sugestao: 'S' });
  assert.ok(t.startsWith('# Resumo da semana de 05/01\n'));
  for (const s of ['## Melhor post', '## Pior post', '## O que se repetiu', '## Sugestão pra próxima semana']) assert.match(t, new RegExp(s));
  assert.match(t, /Melhor post\n+M\n/);
  assert.match(t, /Sugestão pra próxima semana\n+S\n$/);
});

function cenario(t) {
  const cerebroDir = tmp();
  const config = { dados: tmp(), claude: { command: process.execPath, prefixArgs: [FAKE] } };
  t.after(() => { for (const d of [cerebroDir, config.dados]) fs.rmSync(d, { recursive: true, force: true }); });
  const fichas = [ficha('a', 'Post A', [leitura('7d', dia(18))]), ficha('b', 'Post B', [leitura('48h', dia(19))])];
  return { cerebroDir, config, fichas, resumos: path.join(cerebroDir, 'resumos') };
}

test('escreverResumo: com o Claude falso grava o .md e o ultimo.json, e o texto tem o melhor post e o título', async t => {
  const c = cenario(t);
  const r = await escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana: SEMANA, config: c.config });
  assert.equal(r.semana, SEMANA);
  assert.equal(r.arquivo, path.join(c.resumos, `${SEMANA}.md`));
  const texto = fs.readFileSync(r.arquivo, 'utf8');
  assert.match(texto, /Post A/);
  assert.match(texto, /Resumo da semana de 16\/11/);
  assert.match(texto, /Ganchos com número/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(c.resumos, 'ultimo.json'), 'utf8')), { semana: SEMANA });
  assert.deepEqual(fs.readdirSync(c.resumos).sort(), [`${SEMANA}.md`, 'ultimo.json']); // nenhum temporário sobra
});

test('escreverResumo: o prompt chega ao Claude sem ferramentas, com os temas da semana e o perfil', async t => {
  const c = cenario(t);
  fs.writeFileSync(path.join(c.cerebroDir, 'perfil.md'), 'Perfil do Matheus de teste');
  const log = path.join(c.config.dados, 'log.jsonl');
  const antes = process.env.OFC_TEST_LOG;
  process.env.OFC_TEST_LOG = log;
  t.after(() => { if (antes === undefined) delete process.env.OFC_TEST_LOG; else process.env.OFC_TEST_LOG = antes; });
  await escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana: SEMANA, config: c.config });
  const { args } = JSON.parse(fs.readFileSync(log, 'utf8').trim().split('\n')[0]);
  const prompt = args[args.indexOf('-p') + 1];
  assert.match(prompt, /Post A/);
  assert.match(prompt, /Post B/);
  assert.match(prompt, /Perfil do Matheus de teste/);
  assert.equal(args[args.indexOf('--tools') + 1], ''); // sem ferramentas
  assert.ok(!args.includes('--allowedTools'));
});

test('escreverResumo: com o Claude devolvendo lixo, nenhum arquivo é gravado', async t => {
  const c = cenario(t);
  const antes = process.env.OFC_TEST_RESUMO;
  process.env.OFC_TEST_RESUMO = 'não consegui fazer o resumo';
  t.after(() => { if (antes === undefined) delete process.env.OFC_TEST_RESUMO; else process.env.OFC_TEST_RESUMO = antes; });
  await assert.rejects(escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana: SEMANA, config: c.config }), /O resumo da semana não veio completo\./);
  assert.ok(!fs.existsSync(path.join(c.resumos, `${SEMANA}.md`)));
  assert.ok(!fs.existsSync(path.join(c.resumos, 'ultimo.json')));
  assert.equal(ultimoResumo(c.cerebroDir), null);
});

test('escreverResumo: Claude que falha não deixa arquivo; semana sem leituras nem chama o Claude', async t => {
  const c = cenario(t);
  const quebra = async () => { throw new Error('o Claude caiu'); };
  await assert.rejects(escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana: SEMANA, config: c.config, run: quebra }), /o Claude caiu/);
  assert.ok(!fs.existsSync(c.resumos));
  const naoChama = async () => { throw new Error('não podia chamar'); };
  await assert.rejects(escreverResumo({ cerebroDir: c.cerebroDir, fichas: [], semana: SEMANA, config: c.config, run: naoChama }), /Não houve leitura/);
  assert.ok(!fs.existsSync(c.resumos));
});

test('escreverResumo: recusa uma semana que não é AAAA-MM-DD (o nome do arquivo vem dela)', async t => {
  const c = cenario(t);
  for (const semana of ['../x', '2026-11-16.md', '16/11/2026', '', undefined]) {
    await assert.rejects(escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana, config: c.config }), /semana/i);
  }
  assert.ok(!fs.existsSync(c.resumos));
});

test('escreverResumo: o sinal de aborto chega ao Claude e nada é gravado', async t => {
  const c = cenario(t);
  const ctrl = new AbortController();
  const run = async ({ signal }) => { assert.equal(signal, ctrl.signal); ctrl.abort(); throw new Error('abortado'); };
  await assert.rejects(escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana: SEMANA, config: c.config, signal: ctrl.signal, run }), /abortado/);
  assert.ok(!fs.existsSync(c.resumos));
});

test('ultimoResumo e contarResumos: leem o que foi gravado; contar só conta AAAA-MM-DD.md', async t => {
  const c = cenario(t);
  assert.equal(ultimoResumo(c.cerebroDir), null);
  assert.equal(contarResumos(c.cerebroDir), 0);
  await escreverResumo({ cerebroDir: c.cerebroDir, fichas: c.fichas, semana: SEMANA, config: c.config });
  const u = ultimoResumo(c.cerebroDir);
  assert.equal(u.semana, SEMANA);
  assert.match(u.texto, /Resumo da semana de 16\/11/);
  assert.equal(contarResumos(c.cerebroDir), 1);
  fs.writeFileSync(path.join(c.resumos, '2026-11-09.md'), '# antigo');
  fs.writeFileSync(path.join(c.resumos, 'rascunho.md'), 'x');
  fs.writeFileSync(path.join(c.resumos, '2026-11-02.md.tmp-1'), 'x');
  fs.mkdirSync(path.join(c.resumos, '2026-10-26.md'));
  assert.equal(contarResumos(c.cerebroDir), 2);
});

test('ultimoResumo: ultimo.json ilegível ou sem o .md vira null', t => {
  const c = cenario(t);
  fs.mkdirSync(c.resumos, { recursive: true });
  fs.writeFileSync(path.join(c.resumos, 'ultimo.json'), '{ não é json');
  assert.equal(ultimoResumo(c.cerebroDir), null);
  fs.writeFileSync(path.join(c.resumos, 'ultimo.json'), JSON.stringify({ semana: SEMANA }));
  assert.equal(ultimoResumo(c.cerebroDir), null);
});
