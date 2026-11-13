import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { instantesDosFrames, extrairFrames, medirVideo } from '../lib/capa-frames.mjs';

const temFFmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

test('instantesDosFrames(60): 12 crescentes entre 1 e 59', () => {
  const t = instantesDosFrames(60);
  assert.equal(t.length, 12);
  assert.ok(t[0] >= 1 && t[11] <= 59);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1]);
});

test('instantesDosFrames(2): vídeo curto usa o vídeo inteiro', () => {
  const t = instantesDosFrames(2);
  assert.equal(t.length, 12);
  assert.ok(t[0] >= 0 && t[11] <= 2);
});

test('extrairFrames tira 12 frames de um vídeo vertical e recusa vídeo sem imagem', { skip: !temFFmpeg && 'sem FFmpeg' }, async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-frames-'));
  const mp4 = path.join(pasta, 'v.mp4'), audio = path.join(pasta, 'a.mp4');
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=10', '-t', '4', '-pix_fmt', 'yuv420p', mp4]);
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine', '-t', '2', audio]);
  const saida = path.join(pasta, 'capa', 'frames');
  fs.mkdirSync(saida, { recursive: true }); fs.writeFileSync(path.join(saida, 'frame-99.jpg'), 'velho');
  const r = await extrairFrames(mp4, saida);
  assert.equal(r.video.vertical, true);
  assert.equal(r.video.largura, 360); assert.equal(r.video.altura, 640);
  assert.equal(r.frames.length, 12);
  assert.equal(path.basename(r.frames[0].arquivo), 'frame-01.jpg');
  for (const f of r.frames) assert.ok(fs.statSync(f.arquivo).size > 0);
  assert.equal(fs.existsSync(path.join(saida, 'frame-99.jpg')), false, 'frames antigos apagados');
  await assert.rejects(medirVideo(audio), /não tem imagem pra capa/);
});

const clipe = (args, nome) => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ofc-fr2-')), nome); spawnSync('ffmpeg', ['-y', '-v', 'error', ...args, p]); return p; };

test('extrairFrames não trava o servidor: o laço de eventos continua rodando', { skip: !temFFmpeg && 'sem FFmpeg' }, async () => {
  const mp4 = clipe(['-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=10', '-t', '4', '-pix_fmt', 'yuv420p'], 'v.mp4');
  let ticks = 0; const t = setInterval(() => ticks++, 5);
  try { await extrairFrames(mp4, path.join(path.dirname(mp4), 'f')); } finally { clearInterval(t); }
  assert.ok(ticks > 3, 'ticks: ' + ticks);
});

test('extrairFrames para quando o sinal é abortado', { skip: !temFFmpeg && 'sem FFmpeg' }, async () => {
  const mp4 = clipe(['-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=10', '-t', '4', '-pix_fmt', 'yuv420p'], 'v.mp4');
  const ctrl = new AbortController(); ctrl.abort(new Error('fechou'));
  await assert.rejects(extrairFrames(mp4, path.join(path.dirname(mp4), 'f'), { signal: ctrl.signal }), /fechou/);
});

test('clipe de 0,4 s ainda dá frames', { skip: !temFFmpeg && 'sem FFmpeg' }, async () => {
  const mp4 = clipe(['-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=30', '-t', '0.4', '-pix_fmt', 'yuv420p'], 'curto.mp4');
  const r = await extrairFrames(mp4, path.join(path.dirname(mp4), 'f'));
  assert.ok(r.frames.length >= 1);
  for (const f of r.frames) assert.ok(fs.statSync(f.arquivo).size > 0);
});

test('áudio mais longo que a imagem: usa a duração da imagem', { skip: !temFFmpeg && 'sem FFmpeg' }, async () => {
  const mp4 = clipe(['-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=10', '-f', 'lavfi', '-i', 'sine', '-t', '8', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-t:v', '3'], 'av.mp4');
  const m = await medirVideo(mp4);
  assert.ok(m.duracao <= 3.2, 'duração ' + m.duracao);
  const r = await extrairFrames(mp4, path.join(path.dirname(mp4), 'f'));
  assert.equal(r.frames.length, 12);
});
