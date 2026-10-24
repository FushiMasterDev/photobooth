import { applyMatrix } from './filters.js';
import { coverCrop, formatDate } from './util.js';

const images = new Map();

export function loadImage(src) {
  if (!images.has(src)) {
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Không tải được ảnh trang trí khung.'));
      image.src = src;
    });
    images.set(src, promise);
    // A failed load can be retried without reloading the page.
    promise.catch(() => images.delete(src));
  }
  return images.get(src);
}

export async function composeStrip(frame, photos, matrix, date) {
  const render = await createStripRenderer(frame, matrix, date);
  return render(photos);
}

// Prepare the decorative layers once; photos and moving clips share this renderer.
export async function createStripRenderer(frame, matrix, date, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(frame.width * scale));
  canvas.height = Math.max(1, Math.round(frame.height * scale));
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas');
  background.width = canvas.width;
  background.height = canvas.height;
  const bg = background.getContext('2d');
  bg.fillStyle = frame.background;
  bg.fillRect(0, 0, canvas.width, canvas.height);
  if (frame.backgroundImage) {
    bg.drawImage(await loadImage(frame.backgroundImage), 0, 0, canvas.width, canvas.height);
  }
  const foreground = document.createElement('canvas');
  foreground.width = canvas.width;
  foreground.height = canvas.height;
  const fg = foreground.getContext('2d');
  if (frame.overlayImage) {
    fg.drawImage(await loadImage(frame.overlayImage), 0, 0, canvas.width, canvas.height);
  }
  if (frame.caption) {
    const caption = frame.caption;
    fg.scale(scale, scale);
    fg.font = caption.font;
    fg.fillStyle = caption.color;
    fg.textAlign = caption.align;
    fg.fillText(caption.text.replaceAll('{date}', formatDate(date)), caption.x, caption.y);
  }
  const slots = frame.slots.map(slot => {
    const layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(slot.w * scale));
    layer.height = Math.max(1, Math.round(slot.h * scale));
    return layer;
  });

  return (sources, mirrors = []) => {
    ctx.drawImage(background, 0, 0);
    frame.slots.forEach((slot, i) => {
      const source = sources[i];
      const { sx, sy, sw, sh } = coverCrop(source.videoWidth || source.width, source.videoHeight || source.height, slot.w / slot.h);
      const layer = slots[i];
      const slotCtx = layer.getContext('2d', { willReadFrequently: true });
      slotCtx.save();
      slotCtx.clearRect(0, 0, layer.width, layer.height);
      if (mirrors[i]) {
        slotCtx.translate(layer.width, 0);
        slotCtx.scale(-1, 1);
      }
      slotCtx.drawImage(source, sx, sy, sw, sh, 0, 0, layer.width, layer.height);
      slotCtx.restore();
      const pixels = slotCtx.getImageData(0, 0, layer.width, layer.height);
      slotCtx.putImageData(applyMatrix(pixels, matrix), 0, 0);
      ctx.drawImage(layer, slot.x * scale, slot.y * scale);
    });
    ctx.drawImage(foreground, 0, 0);
    return canvas;
  };
}
