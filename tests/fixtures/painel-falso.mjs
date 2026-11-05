// Stands in for the Máquina panel server: prints the URL, then exits with ESC_TEST_PAINEL_CODIGO (default 0).
const saida = process.argv[process.argv.indexOf('--saida') + 1];
if (!process.argv.includes('--sem-navegador')) { console.error('faltou --sem-navegador'); process.exit(9); }
console.log('PAINEL_ABERTO http://localhost:4517/');
setTimeout(async () => {
  const codigo = Number(process.env.ESC_TEST_PAINEL_CODIGO || 0);
  if (codigo === 0) { (await import('node:fs')).writeFileSync(saida, '{}'); console.log('ESCOLHAS_SALVAS ' + saida); }
  process.exit(codigo);
}, Number(process.env.ESC_TEST_PAINEL_MS || 150));
