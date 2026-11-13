// Smoke test: boots the server with a temp data folder and the fake Claude, opens the page in a real
// Chrome/Edge (playwright-core, no download), checks the scene and the panel, saves a screenshot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { criarServidor } from '../serve.mjs';
import { loadConfig } from '../config.mjs';

const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-fumaca-'));
const config = loadConfig({ OFC_DATA: dados, OFC_CLAUDE_COMMAND: process.execPath, OFC_CLAUDE_PREFIX_ARGS: JSON.stringify([path.resolve('tests/fixtures/claude-falso.mjs')]) });
const app = criarServidor({ config, checagem: () => ({ ok: true, mensagem: null, itens: [] }), painelScript: path.resolve('tests/fixtures/painel-falso.mjs'), intervaloCaixa: 0 });
await new Promise(r => app.server.listen(0, '127.0.0.1', r));
app.iniciar();
const url = `http://127.0.0.1:${app.server.address().port}/`;
let browser;
for (const channel of ['chrome', 'msedge']) { try { browser = await chromium.launch({ channel }); break; } catch {} }
if (!browser) { console.error('Precisa do Chrome ou do Edge instalado pro teste de fumaça.'); process.exit(1); }
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const erros = []; page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
const checks = [];
const ok = (cond, msg) => { checks.push([cond, msg]); };
const saida = path.join(os.tmpdir(), 'oficina-fumaca.png');
try {
await page.goto(url); await page.waitForFunction(() => window.ESC && Object.keys(window.ESC.salas).length === 6, null, { timeout: 15000 });
// Primeiro uso: o Cérebro vazio abre a entrevista.
await page.waitForSelector('#cerebro.aberta', { timeout: 15000 }).then(() => ok(true, 'Cérebro vazio abre a entrevista'), () => ok(false, 'Cérebro vazio abre a entrevista'));
await page.fill('#cerebro-form [name=nicho]', 'IA pra pequenos negócios');
await page.fill('#cerebro-form [name=publico]', 'donos de loja');
await page.fill('#cerebro-form [name=tom]', 'direto');
await page.fill('#cerebro-form [name=arroba]', 'teste');
await page.click('#cerebro-salvar');
await page.waitForSelector('#cerebro.aberta', { state: 'hidden', timeout: 10000 });
ok(fs.readFileSync(path.join(dados, 'cerebro', 'perfil.md'), 'utf8').includes('donos de loja'), 'entrevista grava o perfil.md');
ok(await page.evaluate(() => Object.keys(window.ESC.salas).join(',')) === 'pesquisa,roteiro,edicao,capa,postagem,analise', 'seis salas na ordem');
ok(await page.evaluate(() => Object.keys(window.ESC.portas).length) === 6, 'uma passarela por sala até o Cérebro');
fs.writeFileSync(path.join(app.caixa.store.caixaDir, 'aula.mp4'), 'x'); app.caixa.varrer(); app.caixa.varrer();
await page.waitForFunction(() => window.ESC.ultimoEstado?.videos?.[0]?.etapa === 'escolhas-edicao', null, { timeout: 15000 });
ok(await page.evaluate(() => window.ESC.salas.edicao.estado) === 'esperando', 'robô da Edição esperando você');
ok(await page.evaluate(() => window.ESC.salas.capa.estado) === 'inativa', 'Capa inativa nesta etapa');
ok(await page.evaluate(() => !!window.ESC.salas.postagem.decor.getObjectByName('antena')), 'antena na Postagem');
await page.waitForSelector('.badge[data-sala="edicao"]');
ok(await page.locator('.badge').count() === 6, 'seis placas de sala');
ok((await page.locator('.badge[data-sala="capa"]').innerText()).includes('Chega na próxima atualização'), 'placa da Capa avisa que vem depois');
const id = await page.evaluate(() => window.ESC.ultimoEstado.videos[0].id);
await page.click(`.ficha[data-id="${id}"] [data-acao="painel"]`);
await page.waitForSelector('#modal iframe[src="http://localhost:4517/"]');
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'aprovacao-video', id, { timeout: 15000 });
await page.waitForTimeout(2000);
ok(await page.locator('#modal.aberto').count() === 0, 'modal do painel fecha quando as escolhas chegam');
await page.context().route('http://127.0.0.1:9/**', r => r.fulfill({ contentType: 'text/html', body: '<title>Studio</title>Studio' })); // o Studio falso
const [aba] = await Promise.all([page.waitForEvent('popup', { timeout: 10000 }), page.click(`.ficha[data-id="${id}"] [data-acao="studio"]`)]);
ok(await aba.evaluate(() => window.opener === null), 'aba do Studio abre já no clique, sem opener');
await aba.waitForURL(u => String(u).startsWith('http://127.0.0.1:9/'), { timeout: 15000, waitUntil: 'commit' }).then(() => ok(true, 'aba do Studio vai pro endereço do Studio'), e => ok(false, 'aba do Studio vai pro endereço do Studio: ' + e.message));
await aba.close();
await page.click(`.ficha[data-id="${id}"] [data-acao="aprovar"]`);
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'aprovacao-pacote', id, { timeout: 15000 });
await page.waitForTimeout(2000);
ok((await page.locator(`.ficha[data-id="${id}"]`).innerText()).includes('Legenda de teste'), 'legenda aparece pra aprovar');
ok(await page.locator(`.ficha[data-id="${id}"] a.botao:has-text("Baixar vídeo")`).count() === 1, 'Baixar vídeo já aparece na aprovação do post');
ok(await page.locator('#fechado').isHidden(), 'aviso de Oficina fechada escondido enquanto ele responde');
await page.waitForTimeout(1000);
await page.screenshot({ path: saida });
await page.keyboard.press('l');
ok(await page.evaluate(() => document.body.classList.contains('limpo')), 'tecla L liga o modo limpo');
await page.waitForTimeout(500);
await page.screenshot({ path: saida.replace('.png', '-limpo.png') });
await page.keyboard.press('l');
// Cursor do campo de ajuste sobrevive ao repinte da lista (um vídeo novo chegando repinta tudo).
const campo = `.ficha[data-id="${id}"] textarea[data-campo="revisao"]`;
await page.click(campo); await page.keyboard.type('mais curta e direta');
await page.evaluate(s => document.querySelector(s).setSelectionRange(5, 10), campo);
fs.writeFileSync(path.join(app.caixa.store.caixaDir, 'outra.mp4'), 'x'); app.caixa.varrer(); app.caixa.varrer();
await page.waitForFunction(() => window.ESC.ultimoEstado.videos.length === 2 && document.querySelectorAll('.ficha').length === 2, null, { timeout: 15000 });
await page.waitForTimeout(500);
const sel = await page.evaluate(s => { const t = document.querySelector(s); return { foco: document.activeElement === t, ini: t.selectionStart, fim: t.selectionEnd, valor: t.value }; }, campo);
ok(sel.foco && sel.ini === 5 && sel.fim === 10 && sel.valor === 'mais curta e direta', `cursor do campo de ajuste fica no lugar depois do repinte (${JSON.stringify(sel)})`);
// Porta "Tenho uma ideia": pesquisa → escolha → roteiro → gravação pelo cartão → Edição.
await page.click('#tenho-ideia');
await page.fill('#ideia-tema', 'IA no atendimento');
await page.click('#ideia-enviar');
await page.waitForFunction(() => window.ESC.ultimoEstado.videos.some(v => v.tema === 'IA no atendimento' && v.etapa === 'escolha-referencia'), null, { timeout: 15000 });
const ideia = await page.evaluate(() => window.ESC.ultimoEstado.videos.find(v => v.tema === 'IA no atendimento').id);
await page.waitForSelector(`.ficha[data-id="${ideia}"] [data-acao="referencia"]`, { timeout: 10000 });
ok(await page.locator(`.ficha[data-id="${ideia}"] .refs li`).count() === 2, 'referências aparecem pra escolher');
await page.click(`.ficha[data-id="${ideia}"] [data-acao="referencia"][data-indice="0"]`);
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'aprovacao-roteiro', ideia, { timeout: 15000 });
await page.waitForSelector(`.ficha[data-id="${ideia}"] [data-acao="aprovar"]`, { timeout: 10000 });
ok((await page.locator(`.ficha[data-id="${ideia}"]`).innerText()).includes('Gancho de teste'), 'roteiro aparece pra aprovar');
await page.click(`.ficha[data-id="${ideia}"] [data-acao="aprovar"]`);
await page.waitForSelector(`.ficha[data-id="${ideia}"] [data-acao="ler"]`, { timeout: 15000 });
await page.click(`.ficha[data-id="${ideia}"] [data-acao="ler"]`);
ok(await page.locator('#leitura.aberta').count() === 1 && (await page.locator('#leitura-texto').innerText()).includes('Gancho de teste'), 'ler pra gravar abre o roteiro em tela cheia');
await page.keyboard.press('Escape');
await page.setInputFiles(`.ficha[data-id="${ideia}"] input[data-acao="enviar-bruto"]`, { name: 'gravei.mp4', mimeType: 'video/mp4', buffer: Buffer.from('x') });
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'escolhas-edicao', ideia, { timeout: 15000 })
  .then(() => ok(true, 'gravação enviada pelo cartão vai pra Edição'), () => ok(false, 'gravação enviada pelo cartão vai pra Edição'));
await page.screenshot({ path: saida.replace('.png', '-ideia.png') });
await app.fechar();
await page.waitForSelector('#fechado', { state: 'visible', timeout: 10000 }).then(() => ok(true, 'aviso aparece quando a Oficina fecha'), () => ok(false, 'aviso aparece quando a Oficina fecha'));
erros.splice(0, erros.length, ...erros.filter(m => !/Failed to load resource|ERR_CONNECTION_REFUSED/.test(m))); // o servidor fechado de propósito
} finally { await browser.close(); app.fechar(); }
ok(erros.length === 0, 'sem erros no console: ' + erros.join(' | '));
for (const [c, m] of checks) console.log(c ? '✓' : '✗', m);
console.log('captura:', saida);
process.exit(checks.every(([c]) => c) ? 0 : 1);
