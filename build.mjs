import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const manrope = readFileSync('src/fonts/Manrope-latin.woff2').toString('base64');
const shell = readFileSync('src/shell.html', 'utf8').replace('__MANROPE_LATIN__', `data:font/woff2;base64,${manrope}`);
mkdirSync('dist', { recursive: true });
const html = shell.replace('<!--APP-->', () => `<script>${res.outputFiles[0].text}</script>`);
writeFileSync('dist/escritorio.html', html);
console.log(`built dist/escritorio.html (${(html.length / 1024).toFixed(0)} KB)`);
