// Frames for the cover: ffprobe measures the exported video, ffmpeg grabs n stills spread over it.
// Async spawns (the server keeps answering while this runs) without a shell (same reason as
// lib/checagem.mjs: cmd.exe misses the PATH under Git Bash). The abort signal kills the child.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SEM_IMAGEM = 'O vídeo exportado não tem imagem pra capa.';

function rodar(cmd, args, { signal, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Parado.'));
    const filho = spawn(cmd, args, { windowsHide: true });
    let saida = '';
    filho.stdout.on('data', c => { saida += c; });
    filho.stderr.resume();
    const parar = () => filho.kill();
    const relogio = setTimeout(parar, timeout);
    const aoAbortar = () => { parar(); reject(signal.reason || new Error('Parado.')); };
    signal?.addEventListener('abort', aoAbortar, { once: true });
    const fim = () => { clearTimeout(relogio); signal?.removeEventListener('abort', aoAbortar); };
    filho.on('error', e => { fim(); resolve({ status: null, stdout: saida, error: e }); });
    filho.on('close', status => { fim(); resolve({ status, stdout: saida, error: null }); });
  });
}

export async function medirVideo(mp4, { ffprobe = 'ffprobe', signal } = {}) {
  const r = await rodar(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration:format=duration',
    '-of', 'json', mp4], { signal, timeout: 30000 });
  if (r.error?.code === 'ENOENT') throw new Error('Falta instalar o FFmpeg (ffprobe) pra fazer a capa.');
  let info = null; try { info = JSON.parse(r.stdout); } catch {}
  const s = info?.streams?.[0];
  if (r.status !== 0 || !s?.width || !s?.height) throw new Error(SEM_IMAGEM);
  // The video stream's own length: the container's can be longer when the audio outlasts the picture.
  const duracao = Number(s.duration) || Number(info.format?.duration) || 0;
  return { largura: s.width, altura: s.height, duracao, vertical: s.height > s.width };
}

// n instants spread over the video, skipping the first and last second (mouth open, cut) when it is long enough.
export function instantesDosFrames(duracao, n = 12) {
  const [ini, fim] = duracao >= 3 ? [1, duracao - 1] : [0, Math.max(duracao, 0)];
  const passo = (fim - ini) / n;
  return Array.from({ length: n }, (_, i) => +(ini + passo * (i + 0.5)).toFixed(3));
}

export async function extrairFrames(mp4, pastaSaida, { n = 12, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', signal } = {}) {
  const video = await medirVideo(mp4, { ffprobe, signal });
  fs.mkdirSync(pastaSaida, { recursive: true });
  for (const velho of fs.readdirSync(pastaSaida)) if (/^frame-\d+\.jpg$/.test(velho)) fs.rmSync(path.join(pastaSaida, velho), { force: true });
  const frames = [];
  for (const segundo of instantesDosFrames(video.duracao, n)) {
    const arquivo = path.join(pastaSaida, `frame-${String(frames.length + 1).padStart(2, '0')}.jpg`);
    const r = await rodar(ffmpeg, ['-y', '-v', 'error', '-ss', String(segundo), '-i', mp4, '-frames:v', '1', '-q:v', '3', arquivo], { signal });
    if (r.error?.code === 'ENOENT') throw new Error('Falta instalar o FFmpeg pra fazer a capa.');
    // A seek right at the end can land past the last frame: skip that instant instead of failing.
    if (r.status === 0 && fs.existsSync(arquivo) && fs.statSync(arquivo).size > 0) frames.push({ arquivo, segundo });
    else fs.rmSync(arquivo, { force: true });
  }
  if (!frames.length) throw new Error('Não consegui tirar as imagens do vídeo pra capa.');
  return { video, frames };
}
