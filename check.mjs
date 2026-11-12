// npm run check — fast sanity checks with plain-language output. Exit 1 on any ✗.
import fs from 'node:fs';
import { carregarSalas, ORDEM_SALAS } from './lib/salas.mjs';
import { ORDEM, LAYOUT, CORES } from './src/layout.js';
const linhas = []; const ok = (c, m) => linhas.push([!!c, m]);
let salas = []; try { salas = carregarSalas(); ok(true, 'salas.json válido'); } catch (e) { ok(false, e.message); }
ok(JSON.stringify(ORDEM) === JSON.stringify(ORDEM_SALAS), 'ordem das salas igual na página e no servidor');
for (const s of salas) {
  ok(LAYOUT[s.chave], `sala ${s.chave} tem lugar na cena`);
  ok(CORES[s.chave]?.chip === s.chip && CORES[s.chave]?.piso === s.piso, `cores da sala ${s.chave} iguais em salas.json e src/layout.js`);
}
ok(fs.existsSync('dist/oficina.html'), 'página construída (npm run build)');
ok(fs.existsSync('skill/oficina-de-conteudo/SKILL.md'), 'skill /oficina-de-conteudo presente');
for (const f of ['lib/claude-runner.mjs', 'lib/execution.mjs', 'src/builders.js']) ok(fs.existsSync(f), `${f} presente (cópia da Oficina)`);
for (const [c, m] of linhas) console.log(c ? '✓' : '✗', m);
process.exit(linhas.every(([c]) => c) ? 0 : 1);
