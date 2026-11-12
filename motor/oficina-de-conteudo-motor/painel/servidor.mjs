#!/usr/bin/env node
// Painel de escolhas da Máquina de Edição.
//
// Sobe uma página local (só neste computador), abre o navegador e espera a
// pessoa escolher tudo. Quando ela clica em "Começar a edição", grava as
// escolhas em JSON e encerra.
//
// Uso:
//   node servidor.mjs --contexto edit/painel-contexto.json --saida edit/escolhas.json
//
// Opções:
//   --sem-navegador   não abre o navegador (só imprime o endereço)
//   --porta N         porta fixa (padrão: uma livre)
//   --minutos N       desiste depois de N minutos sem resposta (padrão: 60)
//
// Saída no terminal (uma linha cada, pra quem chamou ler):
//   PAINEL_ABERTO <url>
//   ESCOLHAS_SALVAS <caminho>        (código 0)
//   PREFERE_CHAT                     (código 3: a pessoa pediu pra responder no chat)
//   TEMPO_ESGOTADO                   (código 2)
//
// A página também pode enviar arquivos (opcional): imagens vão pra
// <pasta do vídeo>/imagens/ e clipes de apoio pra <pasta do vídeo>/broll/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatosInstalados, formatoDaEscolha } from './catalogo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

function argumento(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  if (i === -1) return padrao;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const arqContexto = argumento('contexto');
const arqSaida = argumento('saida', 'escolhas.json');
const semNavegador = argumento('sem-navegador', false);
const portaFixa = Number(argumento('porta', 0)) || 0;
const minutos = Number(argumento('minutos', 60)) || 60;

let contexto = {};
if (arqContexto) {
  try {
    contexto = JSON.parse(fs.readFileSync(arqContexto, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    console.error(`Não consegui ler o contexto (${arqContexto}): ${e.message}`);
    process.exit(1);
  }
}

contexto.formatos = formatosInstalados(path.resolve(AQUI, '../..'), contexto.formatos);
if (contexto.formatoFixo && !contexto.formatos.includes(contexto.formatoFixo)) {
  console.error(`Formato não instalado: ${contexto.formatoFixo}. Instale o pacote que contém esse formato.`);
  process.exit(1);
}

// Arquivos que a página pode pedir: só os listados no contexto.
// Pasta do vídeo: a do contexto; sem ela, a pasta acima de edit/ (onde o contexto costuma ficar).
function acharPastaVideo() {
  if (contexto.pasta) return path.resolve(contexto.pasta);
  if (!arqContexto) return process.cwd();
  const dir = path.dirname(path.resolve(arqContexto));
  return path.basename(dir) === 'edit' ? path.dirname(dir) : dir;
}
const pastaVideo = acharPastaVideo();
// Aberto pelo Escritório de Conteúdo (modo escritório): a página não manda a pessoa de volta pro Claude Code.
contexto.escritorio = fs.existsSync(path.join(pastaVideo, 'edit', 'escritorio.json'));

// Envio de arquivos pela página: só estes tipos, só nestas pastas.
const DESTINOS = {
  imagens: { exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic'], limite: 50 * 1024 * 1024 },
  broll: { exts: ['.mp4', '.mov', '.m4v', '.webm', '.mkv'], limite: 4 * 1024 * 1024 * 1024 },
};
const enviados = new Set();

function nomeSeguro(nome) {
  const base = path.basename(String(nome || 'arquivo')).normalize('NFC');
  const limpo = base.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/^\.+/, '').slice(0, 120);
  return limpo || 'arquivo';
}

function caminhoLivre(dir, nome) {
  const ext = path.extname(nome);
  const raiz = nome.slice(0, nome.length - ext.length);
  let alvo = path.join(dir, nome);
  for (let i = 2; fs.existsSync(alvo); i++) alvo = path.join(dir, `${raiz} ${i}${ext}`);
  return alvo;
}
const permitidos = new Map();
function liberar(chave, caminho) {
  if (!caminho) return null;
  const abs = path.isAbsolute(caminho) ? caminho : path.join(pastaVideo, caminho);
  if (!fs.existsSync(abs)) return null;
  permitidos.set(chave, abs);
  return `/arquivo/${encodeURIComponent(chave)}`;
}

(contexto.audios || []).forEach((a, i) => { a.url = liberar(`audio-${i}`, a.caminho || a.arquivo); });

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.flac': 'audio/flac', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
};

function enviarArquivo(req, res, abs) {
  let st;
  try { st = fs.statSync(abs); } catch { res.writeHead(404); return res.end(); }
  const tipo = TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const [a, b] = range.replace('bytes=', '').split('-');
    const ini = Number(a) || 0;
    const fim = b ? Math.min(Number(b), st.size - 1) : st.size - 1;
    res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': fim - ini + 1 });
    return fs.createReadStream(abs, { start: ini, end: fim }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  fs.createReadStream(abs).pipe(res);
}

function json(res, codigo, obj) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function lerCorpo(req) {
  return new Promise((ok, erro) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 2e6) erro(new Error('grande demais')); });
    req.on('end', () => ok(d));
  });
}

function encerrar(codigo, linha) {
  console.log(linha);
  setTimeout(() => process.exit(codigo), 400);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  // Só aceita quem está no próprio computador.
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) { res.writeHead(403); return res.end(); }
  // Pedidos que mudam algo (gravar escolhas, enviar ou apagar arquivo) só da própria página:
  // um site aberto em outra aba não pode mandar nada pra cá.
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin) {
    const porta = servidor.address()?.port;
    const proprias = [`http://localhost:${porta}`, `http://127.0.0.1:${porta}`, `http://[::1]:${porta}`];
    if (!proprias.includes(req.headers.origin)) { res.writeHead(403); return res.end(); }
  }

  if (url.pathname === '/api/contexto') return json(res, 200, contexto);

  if (url.pathname === '/api/escolhas' && req.method === 'POST') {
    try {
      const corpo = JSON.parse(await lerCorpo(req));
      const formatoEscolhido = formatoDaEscolha(corpo, contexto.preferencias);
      if (corpo.caminho === 'formato-pronto' && !formatoEscolhido) {
        return json(res, 400, { ok: false, erro: 'Escolha um formato instalado.' });
      }
      if (formatoEscolhido && !contexto.formatos.includes(formatoEscolhido)) {
        return json(res, 400, { ok: false, erro: 'Esse formato não está instalado. Instale o pacote que contém esse formato.' });
      }
      const destino = path.resolve(arqSaida);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, JSON.stringify({ ...corpo, salvoEm: new Date().toISOString() }, null, 2), 'utf8');
      json(res, 200, { ok: true });
      encerrar(0, `ESCOLHAS_SALVAS ${destino}`);
    } catch (e) {
      json(res, 400, { ok: false, erro: e.message });
    }
    return;
  }

  if (url.pathname === '/api/enviar' && req.method === 'POST') {
    const destino = DESTINOS[url.searchParams.get('destino')] ? url.searchParams.get('destino') : null;
    const nome = nomeSeguro(url.searchParams.get('nome'));
    if (!destino || !DESTINOS[destino].exts.includes(path.extname(nome).toLowerCase())) return json(res, 400, { ok: false, erro: 'Esse tipo de arquivo não é aceito aqui.' });
    const dir = path.join(pastaVideo, destino);
    fs.mkdirSync(dir, { recursive: true });
    const alvo = caminhoLivre(dir, nome);
    const saida = fs.createWriteStream(alvo);
    let bytes = 0, falhou = false;
    req.on('data', (c) => {
      bytes += c.length;
      if (bytes > DESTINOS[destino].limite && !falhou) {
        falhou = true;
        req.unpipe(saida); saida.destroy(); fs.rm(alvo, { force: true }, () => {});
        json(res, 413, { ok: false, erro: 'Arquivo grande demais.' });
        req.destroy();
      }
    });
    req.pipe(saida);
    saida.on('finish', () => {
      if (falhou) return;
      enviados.add(alvo);
      json(res, 200, { ok: true, arquivo: path.basename(alvo), pasta: destino });
    });
    saida.on('error', (e) => { if (!falhou) { falhou = true; json(res, 500, { ok: false, erro: e.message }); } });
    return;
  }

  if (url.pathname === '/api/enviar' && req.method === 'DELETE') {
    const destino = DESTINOS[url.searchParams.get('destino')] ? url.searchParams.get('destino') : null;
    const alvo = destino ? path.join(pastaVideo, destino, nomeSeguro(url.searchParams.get('nome'))) : null;
    // Só apaga o que foi enviado por esta página nesta sessão.
    if (!alvo || !enviados.has(alvo)) return json(res, 404, { ok: false });
    fs.rmSync(alvo, { force: true });
    enviados.delete(alvo);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === '/api/prefiro-chat' && req.method === 'POST') {
    json(res, 200, { ok: true });
    return encerrar(3, 'PREFERE_CHAT');
  }

  if (url.pathname.startsWith('/arquivo/')) {
    const abs = permitidos.get(decodeURIComponent(url.pathname.slice(9)));
    if (!abs) { res.writeHead(404); return res.end(); }
    return enviarArquivo(req, res, abs);
  }

  // Arquivos da própria página.
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const abs = path.resolve(AQUI, rel);
  if (!abs.startsWith(AQUI + path.sep) || rel.includes('servidor')) { res.writeHead(404); return res.end(); }
  return enviarArquivo(req, res, abs);
});

function abrirNavegador(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).unref(); } catch {}
}

// A página abre sempre em http://localhost:<porta>/. Escuta só no próprio computador
// (127.0.0.1 e ::1, os dois endereços que "localhost" pode virar), nunca na rede.
// Sem --porta, tenta 4517 a 4530 e, se todas estiverem ocupadas, qualquer porta livre.
const PORTAS = portaFixa ? [portaFixa] : [...Array.from({ length: 14 }, (_, i) => 4517 + i), 0];

function escutar(i = 0) {
  servidor.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && i + 1 < PORTAS.length) { servidor.removeAllListeners('listening'); return escutar(i + 1); }
    console.error(e.message);
    process.exit(1);
  });
  servidor.listen(PORTAS[i], '127.0.0.1', () => {
    servidor.removeAllListeners('error');
    const porta = servidor.address().port;
    const v6 = http.createServer(servidor.listeners('request')[0]);
    v6.on('error', () => {});
    v6.listen(porta, '::1');
    v6.unref();
    const url = `http://localhost:${porta}/`;
    console.log(`PAINEL_ABERTO ${url}`);
    if (!semNavegador) abrirNavegador(url);
  });
}
escutar();

setTimeout(() => encerrar(2, 'TEMPO_ESGOTADO'), minutos * 60 * 1000).unref?.();
process.on('SIGINT', () => encerrar(130, 'CANCELADO'));
