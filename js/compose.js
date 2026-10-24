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
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = frame.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (frame.backgroundImage) {
    ctx.drawImage(await loadImage(frame.backgroundImage), 0, 0, canvas.width, canvas.height);
  }

  // Filter a separate slot canvas so the frame and raw photos keep their colors.
  const slotCanvas = document.createElement('canvas');
  for (let i = 0; i < frame.slots.length; i += 1) {
    const slot = frame.slots[i];
    const photo = photos[i];
    const { sx, sy, sw, sh } = coverCrop(photo.width, photo.height, slot.w / slot.h);
    slotCanvas.width = slot.w;
    slotCanvas.height = slot.h;
    const slotCtx = slotCanvas.getContext('2d');
    slotCtx.drawImage(photo, sx, sy, sw, sh, 0, 0, slot.w, slot.h);
    const pixels = slotCtx.getImageData(0, 0, slot.w, slot.h);
    slotCtx.putImageData(applyMatrix(pixels, matrix), 0, 0);
    ctx.drawImage(slotCanvas, slot.x, slot.y);
  }

  if (frame.overlayImage) {
    ctx.drawImage(await loadImage(frame.overlayImage), 0, 0, canvas.width, canvas.height);
  }
  if (frame.caption) {
    const caption = frame.caption;
    ctx.font = caption.font;
    ctx.fillStyle = caption.color;
    ctx.textAlign = caption.align;
    ctx.fillText(caption.text.replaceAll('{date}', formatDate(date)), caption.x, caption.y);
  }
  return canvas;
}
