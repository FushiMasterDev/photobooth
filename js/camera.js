import { PREVIEW_MAX_W } from './config.js';
import { coverCrop } from './util.js';
import { applyFilter } from './filters.js';

const videos = new WeakMap();

export async function openCamera(facingMode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.className = 'camera-source';
  videos.set(stream, video);
  document.body.append(video);

  try {
    await new Promise((resolve, reject) => {
      const events = ['loadedmetadata', 'loadeddata', 'resize', 'playing'];
      let playing = false;
      const finish = (error) => {
        clearTimeout(timeout);
        events.forEach(event => video.removeEventListener(event, check));
        video.removeEventListener('error', fail);
        if (error) reject(error);
        else resolve();
      };
      const check = () => {
        if (playing && video.videoWidth > 0 && video.videoHeight > 0) finish();
      };
      const fail = () => finish(video.error || new Error('Camera chưa sẵn sàng.'));
      const timeout = setTimeout(() => finish(new Error('Không nhận được hình ảnh từ camera.')), 15000);
      events.forEach(event => video.addEventListener(event, check));
      video.addEventListener('error', fail);
      video.srcObject = stream;
      video.play().then(() => { playing = true; check(); }, finish);
    });
    return { video, stream };
  } catch (error) {
    stopCamera(stream);
    throw error;
  }
}

export function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach(track => track.stop());
  const video = videos.get(stream);
  if (video) {
    video.pause();
    video.srcObject = null;
    video.remove();
    videos.delete(stream);
  }
}

function drawCrop(video, canvas, crop, mirror) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return ctx;
}

export function grabFrame(video, aspect, mirror) {
  const crop = coverCrop(video.videoWidth, video.videoHeight, aspect);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.sw));
  canvas.height = Math.max(1, Math.round(crop.sh));
  drawCrop(video, canvas, crop, mirror);
  return canvas;
}

export function drawPreview(video, canvas, aspect, mirror, filter, raw) {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
  const crop = coverCrop(video.videoWidth, video.videoHeight, aspect);
  const width = Math.max(1, Math.min(PREVIEW_MAX_W, Math.round(crop.sw)));
  const height = Math.max(1, Math.round(width / aspect));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  let ctx;
  if (raw) {
    if (raw.width !== width) raw.width = width;
    if (raw.height !== height) raw.height = height;
    drawCrop(video, raw, crop, mirror);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(raw, 0, 0);
  } else {
    ctx = drawCrop(video, canvas, crop, mirror);
  }
  const pixels = ctx.getImageData(0, 0, width, height);
  ctx.putImageData(applyFilter(pixels, filter), 0, 0);
}
