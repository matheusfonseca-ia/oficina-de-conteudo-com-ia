// Smoke test: boots the server with a temp data folder and the fake Claude, opens the page in a real
// Chrome/Edge (playwright-core, no download), checks the scene and the panel, saves a screenshot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { criarServidor } from '../serve.mjs';
import { loadConfig } from '../config.mjs';
import { spawnSync } from 'node:child_process';
import { iniciarHiggsfieldFalso } from '../tests/fixtures/higgsfield-falso.mjs';
import { iniciarPostForMeFalso, CHAVE_PFM } from '../tests/fixtures/postforme-falso.mjs';

const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'esc-fumaca-'));
// The cover room runs for real: a 3 s vertical video (FFmpeg testsrc) that the fake Claude exports as final.mp4.
const mp4Teste = path.join(dados, 'teste.mp4');
if (spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=10', '-t', '3', '-pix_fmt', 'yuv420p', mp4Teste]).status !== 0) { console.error('Precisa do FFmpeg pro teste de fumaça.'); process.exit(1); }
process.env.OFC_TEST_MP4 = mp4Teste;
const higgsfield = await iniciarHiggsfieldFalso();
process.env.OFC_HIGGSFIELD_URL = higgsfield.base;
// Post for Me falso (o servidor só o chama depois que a chave é conectada) e o relógio e os prazos da Análise em segundos:
// tudo isso é lido quando o servidor sobe, então fica antes do criarServidor.
// O segundo falso não devolve resultado ('processando'): é como o Post for Me de verdade trata um post agendado pra amanhã.
const pfm = await iniciarPostForMeFalso();
const pfmAgendado = await iniciarPostForMeFalso({ modo: 'processando' });
process.env.OFC_POSTFORME_URL = pfm.base;
process.env.OFC_RELOGIO_MS = '500'; process.env.OFC_PRAZO_48H_MS = '2000'; process.env.OFC_PRAZO_7D_MS = '4000';
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
ok(await page.evaluate(() => Object.keys(window.ESC.salas).join(',')) === 'pesquisa,roteiro,edicao,capa,postagem,analise', 'seis salas na ordem');
// First open with an empty Cérebro: the boss interview opens by itself, one question at a time.
await page.waitForSelector('#cerebro.aberta', { timeout: 10000 });
await page.click('#cerebro-salvar');
ok(await page.textContent('#cerebro-erro') !== '', 'chefe não avança com a primeira resposta vazia');
for (const resposta of ['IA pra pequenos negócios', 'donos de loja', 'direto e brincalhão', '@fumaca', 'perfil.um']) {
  await page.locator('#cerebro .passo.atual').locator('textarea, input').first().fill(resposta);
  await page.click('#cerebro-salvar');
}
await page.waitForSelector('#cerebro:not(.aberta)', { state: 'attached', timeout: 5000 });
const perfilSalvo = JSON.parse(fs.readFileSync(path.join(dados, 'cerebro', 'perfil.json'), 'utf8'));
ok(perfilSalvo.nicho === 'IA pra pequenos negócios' && perfilSalvo.referencias[0] === '@perfil.um', 'conversa com o chefe salva o perfil');
ok(await page.evaluate(() => Object.keys(window.ESC.portas).length) === 6, 'uma passarela por sala até o Cérebro');
fs.writeFileSync(path.join(app.caixa.store.caixaDir, 'aula.mp4'), 'x'); app.caixa.varrer(); app.caixa.varrer();
await page.waitForFunction(() => window.ESC.ultimoEstado?.videos?.[0]?.etapa === 'escolhas-edicao', null, { timeout: 15000 });
ok(await page.evaluate(() => window.ESC.salas.edicao.estado) === 'esperando', 'robô da Edição esperando você');
ok(await page.evaluate(() => Object.values(window.ESC.salas).every(s => s.estado !== 'inativa')), 'as seis salas ligadas');
ok(await page.evaluate(() => !!window.ESC.salas.postagem.decor.getObjectByName('antena')), 'antena na Postagem');
await page.waitForSelector('.badge[data-sala="edicao"]');
ok(await page.locator('.badge').count() === 6, 'seis placas de sala');
ok((await page.locator('.badge[data-sala="analise"]').innerText()).includes('Conecte o Post for Me'), 'placa da Análise pede o Post for Me');
{ const t = await page.locator('.badge[data-sala="capa"]').innerText(); ok(t.includes('Capas') && !t.includes('Chega na próxima atualização'), 'placa da Capa ativa'); }
// Conexões: the Capa card opens the boss window on the Conexões tab; a wrong key shows the error.
await page.click('.badge[data-sala="capa"] [data-acao="conectar"]');
await page.waitForSelector('#cerebro.aberta #conexoes:not([hidden])', { timeout: 5000 }).then(() => ok(true, 'aba Conexões abre pela placa da Capa'), () => ok(false, 'aba Conexões abre pela placa da Capa'));
await page.fill('#conexoes [data-servico="higgsfield"] input', 'x:y');
await page.click('#conexoes [data-con="conectar"]');
await page.waitForFunction(() => /não funcionou/.test(document.querySelector('#conexoes-erro').textContent), null, { timeout: 5000 })
  .then(() => ok(true, 'conectar Higgsfield com chave errada mostra o erro'), () => ok(false, 'conectar Higgsfield com chave errada mostra o erro'));
await page.click('#conexoes-fechar');
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
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'aprovacao-pacote', id, { timeout: 90000 });
await page.waitForTimeout(2000);
// Covers: two real PNGs on the post approval; choose the second; Refazer capa keeps the caption.
const capasCarregadas = () => page.evaluate(i => [...document.querySelectorAll(`.ficha[data-id="${i}"] .capas img`)].filter(im => im.complete && im.naturalWidth > 0).length, id);
await page.waitForFunction(i => [...document.querySelectorAll(`.ficha[data-id="${i}"] .capas img`)].every(im => im.complete), id, { timeout: 10000 }).catch(() => {});
ok(await capasCarregadas() === 2, 'capas aparecem na aprovação do post');
await page.click(`.ficha[data-id="${id}"] [data-acao="escolher-capa"][data-indice="1"]`);
await page.waitForFunction(i => document.querySelector(`.ficha[data-id="${i}"] [data-acao="escolher-capa"][data-indice="1"]`)?.classList.contains('escolhida'), id, { timeout: 10000 })
  .then(() => ok(true, 'trocar a capa marca a escolhida'), () => ok(false, 'trocar a capa marca a escolhida'));
const legendaAntes = await page.evaluate(i => window.ESC.ultimoEstado.videos.find(v => v.id === i).postagem.legenda, id);
await page.fill(`.ficha[data-id="${id}"] textarea[data-campo="revisao"]`, 'mais contraste');
await page.click(`.ficha[data-id="${id}"] [data-acao="refazer-capa"]`);
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.historico.some(h => h.nota === 'refazer capa'), id, { timeout: 10000 });
await page.waitForFunction(i => { const v = window.ESC.ultimoEstado.videos.find(x => x.id === i); return v?.etapa === 'aprovacao-pacote' && !v.trabalhando; }, id, { timeout: 60000 });
ok(await page.evaluate(i => window.ESC.ultimoEstado.videos.find(v => v.id === i).postagem.legenda, id) === legendaAntes, 'Refazer capa volta pra aprovação sem reescrever a legenda');
ok(fs.readFileSync(path.join(dados, 'cerebro', 'aprendizados', 'capa.md'), 'utf8').includes('mais contraste'), 'Refazer capa ensina a sala de Capa');
await page.waitForTimeout(1000);
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
// ---- Sem o Post for Me: "Aprovar" leva a ficha a pronto-pra-postar e "Já postei" conclui (não existe leitura de números).
await page.click(`.ficha[data-id="${id}"] [data-acao="aprovar"]`);
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'pronto-pra-postar', id, { timeout: 15000 });
await page.click(`.ficha[data-id="${id}"] [data-acao="postado"]`);
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'concluido', id, { timeout: 15000 })
  .then(() => ok(true, 'Postar na mão leva pra pronto-pra-postar e Já postei conclui'), () => ok(false, 'Postar na mão leva pra pronto-pra-postar e Já postei conclui'));
ok(pfm.chamadas.length === 0, 'sem chave, nada chama o Post for Me');

// ---- Conecta o Post for Me (falso) pela aba Conexões, pela placa da Análise.
await page.click('.badge[data-sala="analise"] [data-acao="conectar"]');
await page.waitForSelector('#cerebro.aberta #conexoes:not([hidden])', { timeout: 5000 });
await page.fill('#conexoes [data-servico="postForMe"] input', CHAVE_PFM);
await page.click('#conexoes [data-servico="postForMe"] [data-con="conectar"]');
await page.waitForSelector('#conexoes [data-servico="postForMe"] .ligada:not([hidden])', { timeout: 5000 })
  .then(() => ok(true, 'conectar o Post for Me pela aba Conexões'), () => ok(false, 'conectar o Post for Me pela aba Conexões'));
await page.click('#conexoes-fechar');

// Daqui até o fim do vídeo 3: se algum passo estourar o tempo, vira um check com o nome do passo (e o resumo sai do mesmo jeito).
let passo = 'conectar o Post for Me';
try {
// Leva um vídeo da caixa de entrada até a aprovação do post (painel de escolhas, aprovar o vídeo e esperar a Capa e a Postagem).
const conhecidos = new Set([id]);
const levarAteAprovacaoDoPost = async (arquivo, nome) => {
  passo = `${nome}: esperar o vídeo na fila da Edição`;
  if (arquivo) { fs.writeFileSync(path.join(app.caixa.store.caixaDir, arquivo), 'x'); app.caixa.varrer(); app.caixa.varrer(); }
  await page.waitForFunction(c => window.ESC.ultimoEstado.videos.some(v => !c.includes(v.id) && v.etapa === 'escolhas-edicao'), [...conhecidos], { timeout: 30000 });
  const novo = await page.evaluate(c => window.ESC.ultimoEstado.videos.find(v => !c.includes(v.id)).id, [...conhecidos]);
  conhecidos.add(novo);
  passo = `${nome}: escolhas da edição e aprovar o vídeo`;
  await page.click(`.ficha[data-id="${novo}"] [data-acao="painel"]`);
  await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'aprovacao-video', novo, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('#modal.aberto'), null, { timeout: 10000 });
  await page.click(`.ficha[data-id="${novo}"] [data-acao="aprovar"]`);
  passo = `${nome}: exportar, Capa e Postagem até a aprovação do post`;
  await page.waitForFunction(i => { const v = window.ESC.ultimoEstado.videos.find(x => x.id === i); return v?.etapa === 'aprovacao-pacote' && !v.trabalhando; }, novo, { timeout: 90000 });
  return novo;
};
const marcarRedes = async i => { for (const cx of await page.locator(`.ficha[data-id="${i}"] .publicar input[data-conta]`).all()) await cx.check(); };

// ---- Segundo vídeo (o "outra.mp4" do teste do cursor, que já está na fila da Edição): as redes do Post for Me,
// publicar agora, os números de 48 horas e 7 dias e o Cérebro.
const id2 = await levarAteAprovacaoDoPost(null, 'vídeo 2');
passo = 'vídeo 2: publicar e esperar os números';
const bloco2 = `.ficha[data-id="${id2}"] .publicar`;
await page.waitForFunction(b => document.querySelectorAll(`${b} input[data-conta]`).length === 3, bloco2, { timeout: 15000 })
  .then(() => ok(true, 'aprovação mostra as redes do Post for Me (3 caixinhas)'), () => ok(false, 'aprovação mostra as redes do Post for Me (3 caixinhas)'));
ok(await page.locator(`${bloco2} .aviso-rede:has-text("sem música")`).first().isVisible(), 'aprovação mostra o aviso do Instagram (Reels sem música)');
await marcarRedes(id2);
await page.click(`.ficha[data-id="${id2}"] [data-acao="publicar"]`);
// A página olha a cada 1,5 s: a Análise pode já ter lido os 48h quando ela olha, então vale qualquer etapa depois de publicado.
await page.waitForFunction(i => ['aguardando-numeros', 'analise', 'concluido'].includes(window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa), id2, { timeout: 15000 })
  .then(() => ok(pfm.posts.length === 1 && pfm.posts[0].social_accounts.length === 3, 'publicar agora leva a ficha a aguardar os números'), () => ok(false, 'publicar agora leva a ficha a aguardar os números'));
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'concluido' && document.querySelectorAll(`.ficha[data-id="${i}"] .leitura-numeros`).length === 2, id2, { timeout: 20000 }).catch(() => ok(false, 'vídeo 2 concluiu com as leituras de 48h e 7d (passou de 20 s)'));
{
  // O cartão concluído fica na lista recolhida "Concluídos": abre como a pessoa abriria.
  if (!(await page.locator(`.ficha[data-id="${id2}"]`).isVisible())) await page.click('summary.grupo:has-text("Concluídos")');
  const t = await page.locator(`.ficha[data-id="${id2}"]`).innerText();
  ok(t.includes('48 horas') && t.includes('7 dias') && await page.locator(`.ficha[data-id="${id2}"] .estrelas`).count() === 2, 'leituras de 48h e 7d aparecem no cartão concluído');
}
ok(fs.existsSync(path.join(dados, 'cerebro', 'o-que-funcionou.md')), 'o que funcionou foi pro Cérebro');

// ---- Terceiro vídeo: agenda pra amanhã e cancela. Daqui em diante o Post for Me falso é o que não devolve resultado
// (o de verdade só tem resultado de um post agendado na hora marcada).
process.env.OFC_POSTFORME_URL = pfmAgendado.base;
const id3 = await levarAteAprovacaoDoPost('terceiro.mp4', 'vídeo 3');
passo = 'vídeo 3: agendar e cancelar';
await page.waitForFunction(i => document.querySelectorAll(`.ficha[data-id="${i}"] .publicar input[data-conta]`).length === 3, id3, { timeout: 15000 });
await marcarRedes(id3);
await page.locator(`.ficha[data-id="${id3}"] input[data-quando="agendar"]`).check();
const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
const doisDig = n => String(n).padStart(2, '0');
await page.fill(`.ficha[data-id="${id3}"] input[data-campo="quando"]`, `${amanha.getFullYear()}-${doisDig(amanha.getMonth() + 1)}-${doisDig(amanha.getDate())}T18:00`);
await page.click(`.ficha[data-id="${id3}"] [data-acao="publicar"]`);
await page.waitForSelector(`.ficha[data-id="${id3}"] [data-acao="cancelar-agendamento"]`, { timeout: 30000 });
const agendadoOk = (await page.locator(`.ficha[data-id="${id3}"]`).innerText()).includes('Agendado pra') && !!pfmAgendado.posts[0]?.scheduled_at;
page.once('dialog', d => d.accept());
await page.click(`.ficha[data-id="${id3}"] [data-acao="cancelar-agendamento"]`);
await page.waitForFunction(i => { const v = window.ESC.ultimoEstado.videos.find(x => x.id === i); return v?.etapa === 'aprovacao-pacote' && !v.publicacao; }, id3, { timeout: 15000 })
  .then(() => ok(agendadoOk && pfmAgendado.chamadas.some(c => c.metodo === 'DELETE'), 'agendar e cancelar volta pra aprovação'), () => ok(false, 'agendar e cancelar volta pra aprovação'));
// Com o Post for Me conectado, o botão "Postar na mão" aprova sem publicar nada.
await page.locator(`.ficha[data-id="${id3}"] button:has-text("Postar na mão")`).click();
await page.waitForFunction(i => window.ESC.ultimoEstado.videos.find(v => v.id === i)?.etapa === 'pronto-pra-postar', id3, { timeout: 15000 })
  .then(() => ok(pfmAgendado.posts.length === 1, 'o botão Postar na mão leva pra pronto-pra-postar sem publicar'), () => ok(false, 'o botão Postar na mão leva pra pronto-pra-postar sem publicar'));
} catch (e) { ok(false, `parou em "${passo}": ${String(e.message).split(/\r?\n/)[0]}`); }
await app.fechar();
await page.waitForSelector('#fechado', { state: 'visible', timeout: 10000 }).then(() => ok(true, 'aviso aparece quando a Oficina fecha'), () => ok(false, 'aviso aparece quando a Oficina fecha'));
erros.splice(0, erros.length, ...erros.filter(m => !/Failed to load resource|ERR_CONNECTION_REFUSED/.test(m))); // o servidor fechado de propósito
} finally { await browser.close(); app.fechar(); await higgsfield.fechar(); await pfm.fechar(); await pfmAgendado.fechar(); }
ok(erros.length === 0, 'sem erros no console: ' + erros.join(' | '));
for (const [c, m] of checks) console.log(c ? '✓' : '✗', m);
console.log('captura:', saida);
process.exit(checks.every(([c]) => c) ? 0 : 1);
