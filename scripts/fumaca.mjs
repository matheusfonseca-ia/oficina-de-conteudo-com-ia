// Smoke test: boots the server with a temp data folder and the fake Claude, opens the page in a real
// Chrome/Edge (playwright-core, no download), checks the scene and the panel, saves a screenshot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { criarServidor } from '../serve.mjs';
import { loadConfig } from '../config.mjs';

const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-fumaca-'));
const config = loadConfig({ ESC_DATA: dados, ESC_CLAUDE_COMMAND: process.execPath, ESC_CLAUDE_PREFIX_ARGS: JSON.stringify([path.resolve('tests/fixtures/claude-falso.mjs')]) });
const app = criarServidor({ config, checagem: () => ({ ok: true, mensagem: null, itens: [] }), painelScript: path.resolve('tests/fixtures/painel-falso.mjs'), intervaloCaixa: 0 });
await new Promise(r => app.server.listen(0, '127.0.0.1', r));
app.iniciar();
const url = `http://127.0.0.1:${app.server.address().port}/`;
let browser;
for (const channel of ['chrome', 'msedge']) { try { browser = await chromium.launch({ channel }); break; } catch {} }
if (!browser) { console.error('Precisa do Chrome ou do Edge instalado pro teste de fumaça.'); process.exit(1); }
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const erros = []; page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.ESC && Object.keys(window.ESC.salas).length === 6, null, { timeout: 15000 });
const checks = [];
const ok = (cond, msg) => { checks.push([cond, msg]); };
ok(await page.evaluate(() => Object.keys(window.ESC.salas).join(',')) === 'pesquisa,roteiro,edicao,capa,postagem,analise', 'seis salas na ordem');
ok(await page.evaluate(() => window.ESC.anel.length) === 6, 'anel com seis passarelas');
// (checagens das Tasks 12 e 13 entram aqui)
await page.waitForTimeout(1500);
const saida = path.join(os.tmpdir(), 'escritorio-fumaca.png'); await page.screenshot({ path: saida });
await browser.close(); app.fechar();
ok(erros.length === 0, 'sem erros no console: ' + erros.join(' | '));
for (const [c, m] of checks) console.log(c ? '✓' : '✗', m);
console.log('captura:', saida);
process.exit(checks.every(([c]) => c) ? 0 : 1);
