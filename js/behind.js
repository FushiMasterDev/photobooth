import { createStripRenderer } from './compose.js';
import { CLIP_MS } from './config.js';

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

export async function recordClip(stream, ms, mimeType) {
  const recording = startRecording(stream, mimeType);
  const timer = setTimeout(recording.stop, ms);
  try {
    return await recording.done;
  } finally {
    clearTimeout(timer);
    recording.stop();
  }
}

export async function renderBehind(frame, clips, filter, mimeType, scale = 0.5) {
  const videos = [];
  const urls = [];
  let stream;
  let recording;
  let animation;
  let timeout;
  const cleanups = [];
  try {
    const render = await createStripRenderer(frame, filter, new Date(), scale);
    await Promise.all(clips.map(clip => new Promise((resolve, reject) => {
      const video = document.createElement('video');
      videos.push(video);
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.className = 'camera-source';
      video.setAttribute('aria-hidden', 'true');
      document.body.append(video);
      const timer = setTimeout(() => reject(new Error('Không mở được clip.')), CLIP_MS + 15000);
      const ready = () => {
        // Pause at the start so all four clips can begin together after loading.
        video.pause();
        video.currentTime = 0;
        clearTimeout(timer);
        resolve();
      };
      const fail = () => reject(new Error('Không đọc được clip.'));
      video.addEventListener('loadeddata', ready, { once: true });
      video.addEventListener('error', fail, { once: true });
      cleanups.push(() => {
        clearTimeout(timer);
        video.removeEventListener('loadeddata', ready);
        video.removeEventListener('error', fail);
      });
      const url = URL.createObjectURL(clip);
      urls.push(url);
      video.src = url;
      video.load();
    })));
    const canvas = render(videos);
    stream = canvas.captureStream(30);
    recording = startRecording(stream, mimeType);
    // Handle recorder errors immediately, including while play() is pending.
    recording.done.catch(() => {});
    await new Promise((resolve, reject) => {
      const checkEnded = () => {
        if (videos.every(video => video.ended)) resolve();
      };
      videos.forEach(video => {
        video.addEventListener('ended', checkEnded);
        const fail = () => reject(new Error('Không phát được clip.'));
        video.addEventListener('error', fail);
        cleanups.push(() => {
          video.removeEventListener('ended', checkEnded);
          video.removeEventListener('error', fail);
        });
      });
      // Some recorder files report an infinite duration; ended is authoritative.
      timeout = setTimeout(() => reject(new Error('Tạo clip quá lâu. Vui lòng thử lại.')), CLIP_MS + 15000);
      recording.done.then(() => reject(new Error('Ghi clip bị gián đoạn.')), reject);
      const draw = () => {
        try {
          render(videos);
          animation = requestAnimationFrame(draw);
        } catch (error) {
          reject(error);
        }
      };
      Promise.all(videos.map(video => video.play())).then(draw, reject);
    });
    cancelAnimationFrame(animation);
    recording.stop();
    return await recording.done;
  } finally {
    clearTimeout(timeout);
    cancelAnimationFrame(animation);
    cleanups.forEach(cleanup => cleanup());
    recording?.stop();
    stream?.getTracks().forEach(track => track.stop());
    videos.forEach(video => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    });
    urls.forEach(url => URL.revokeObjectURL(url));
  }
}
