import { createStripRenderer } from './compose.js';
import { CLIP_MS, CLIP_FPS } from './config.js';

export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type)) || null;
}

function startRecording(stream, mimeType) {
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    recorder.ondataavailable = event => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error('Không ghi được clip.'));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (blob.size) resolve(blob);
      else reject(new Error('Clip chưa có hình ảnh.'));
    };
    recorder.start();
  });
  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  return { done, stop };
}

export async function renderBehind(frame, clips, filter, mimeType, scale = 0.5, sticker = null) {
  let stream;
  let recording;
  let stepTimer;
  let timeout;
  try {
    if (!clips.length || clips.some(clip => !clip.length)) {
      throw new Error('Clip chưa có hình ảnh.');
    }
    const render = await createStripRenderer(frame, filter, new Date(), scale, sticker);
    const sourcesAt = k => clips.map(clip => clip[Math.min(k, clip.length - 1)]);
    const maxLen = Math.max(...clips.map(clip => clip.length));
    const canvas = render(sourcesAt(0));
    stream = canvas.captureStream(CLIP_FPS);
    recording = startRecording(stream, mimeType);
    // Consume errors immediately, including while frames are being replayed.
    recording.done.catch(() => {});
    return await Promise.race([
      new Promise((resolve, reject) => {
        let k = 0;
        const advance = () => {
          try {
            k += 1;
            if (k === maxLen) {
              recording.stop();
              return;
            }
            render(sourcesAt(k));
            stepTimer = setTimeout(advance, 1000 / CLIP_FPS);
          } catch (error) {
            reject(error);
          }
        };
        recording.done.then(resolve, reject);
        // The first frame is already drawn; hold every frame for one full step.
        stepTimer = setTimeout(advance, 1000 / CLIP_FPS);
      }),
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Tạo clip quá lâu. Vui lòng thử lại.')), CLIP_MS + 15000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    clearTimeout(stepTimer);
    recording?.stop();
    stream?.getTracks().forEach(track => track.stop());
  }
}
