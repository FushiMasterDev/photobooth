import { FRAMES, slotAspect } from './frames.js';
import { FILTERS } from './filters.js';
import { PREVIEW_MAX_W, SHOTS, PICK, COUNTDOWN_SEC, CLIP_MS, EXPORT_TYPE, EXPORT_QUALITY } from './config.js';
import { cameraErrorMessage, toggleSelection, formatDate } from './util.js';
import { openCamera, stopCamera, drawPreview, grabFrame } from './camera.js';
import { composeStrip } from './compose.js';
import { canvasToBlob, shareOrNull, downloadBlob } from './share.js';
import { pickMimeType, recordClip, renderBehind } from './behind.js';

const params = new URLSearchParams(window.location.search);
if (params.has('noclip')) window.MediaRecorder = undefined;

export const state = {
  frame: FRAMES[0],
  filter: FILTERS[0],
  facing: 'user',
  photos: [],
  clips: [],
  selected: [],
  result: null,
};

const screens = [...document.querySelectorAll('[data-screen]')];
const preview = document.querySelector('#preview');
const raw = document.createElement('canvas');
const previewWrap = document.querySelector('.preview-wrap');
const status = document.querySelector('#camera-status');
const flipButton = document.querySelector('[data-action="flip"]');
const shootButton = document.querySelector('[data-action="shoot"]');
const stopButton = document.querySelector('[data-action="stop"]');
const countdown = document.querySelector('#countdown');
const shotCounter = document.querySelector('#shot-counter');
const flash = document.querySelector('#capture-flash');
const photoPicker = document.querySelector('#photo-picker');
const continueButton = document.querySelector('[data-action="continue"]');
const resultPreview = document.querySelector('#result-preview');
const resultStatus = document.querySelector('#result-status');
const saveButton = document.querySelector('[data-action="save"]');
const shareButton = document.querySelector('[data-action="share"]');
const makeClipButton = document.querySelector('[data-action="make-clip"]');
const saveClipButton = document.querySelector('[data-action="save-clip"]');
const shareClipButton = document.querySelector('[data-action="share-clip"]');
const behindVideo = document.querySelector('#behind-video');
const clipStatus = document.querySelector('#clip-status');
const clipSpinner = document.querySelector('#clip-spinner');
const countdownSeconds = params.has('fast') ? 1 : COUNTDOWN_SEC;
let currentScreen = 'welcome';
let camera = null;
let animationId = null;
let cameraRequest = 0;
let capturing = false;
let captureRun = 0;
let captureTimer = null;
let resolveDelay = null;
let resultRun = 0;
let resultDate = null;
let resultBlob = null;
let resultFile = null;
let resultFilename = '';
let clipTimer = null;
let clipStream = null;
let clipRun = 0;
let clipUrl = null;
let clipBlob = null;
let clipFile = null;
let clipFilename = '';

function resetCaptureControls() {
  countdown.hidden = true;
  countdown.textContent = '';
  flash.hidden = true;
  shotCounter.textContent = `0/${SHOTS}`;
  stopButton.hidden = true;
  shootButton.hidden = false;
  shootButton.disabled = !camera;
  flipButton.disabled = !camera;
}

function cancelCapture() {
  captureRun += 1;
  clearTimeout(clipTimer);
  clipTimer = null;
  clearTimeout(captureTimer);
  captureTimer = null;
  if (resolveDelay) resolveDelay(false);
  resolveDelay = null;
  if (capturing) {
    state.photos = [];
    state.clips = [];
    state.selected = [];
  }
  capturing = false;
  resetCaptureControls();
}

function captureDelay(ms) {
  return new Promise(resolve => {
    resolveDelay = resolve;
    captureTimer = setTimeout(() => {
      captureTimer = null;
      resolveDelay = null;
      resolve(true);
    }, ms);
  });
}

async function captureSequence() {
  if (capturing || !camera || currentScreen !== 'capture') return;
  cancelCapture();
  const run = captureRun;
  capturing = true;
  state.photos = [];
  state.clips = [];
  state.selected = [];
  shootButton.hidden = true;
  shootButton.disabled = true;
  stopButton.hidden = false;
  flipButton.disabled = true;

  try {
    const mimeType = pickMimeType();
    let clipsEnabled = mimeType !== null && clipStream !== null;
    for (let i = 0; i < SHOTS; i += 1) {
      let clipPromise = null;
      if (clipsEnabled) {
        const startClip = () => {
          clipTimer = null;
          clipPromise = (async () => {
            try {
              return await recordClip(clipStream, Math.min(CLIP_MS, countdownSeconds * 1000), mimeType);
            } catch {
              if (run === captureRun) {
                clipsEnabled = false;
                state.clips = [];
              }
              return null;
            }
          })();
        };
        const delay = Math.max(0, countdownSeconds * 1000 - CLIP_MS);
        if (delay) clipTimer = setTimeout(startClip, delay);
        else startClip();
      }
      shotCounter.textContent = `${i + 1}/${SHOTS}`;
      countdown.hidden = false;
      for (let seconds = countdownSeconds; seconds > 0; seconds -= 1) {
        countdown.textContent = String(seconds);
        if (!await captureDelay(1000) || run !== captureRun) return;
      }
      countdown.hidden = true;
      flash.hidden = false;
      state.photos.push(grabFrame(camera.video, slotAspect(state.frame), state.facing === 'user'));
      if (!await captureDelay(150) || run !== captureRun) return;
      flash.hidden = true;
      const clip = await clipPromise;
      if (run !== captureRun) return;
      if (clipsEnabled && clip) state.clips.push(clip);
    }
    capturing = false;
    show('select');
  } catch (error) {
    if (run === captureRun) showCameraError(error);
  }
}

function releaseCamera() {
  cancelCapture();
  clipStream?.getTracks().forEach(track => track.stop());
  clipStream = null;
  cameraRequest += 1;
  cancelAnimationFrame(animationId);
  animationId = null;
  if (camera) stopCamera(camera.stream);
  camera = null;
  flipButton.disabled = true;
  shootButton.disabled = true;
}

function cameraContext() {
  return { secure: window.isSecureContext, hasMediaDevices: !!navigator.mediaDevices?.getUserMedia };
}

async function startCamera() {
  releaseCamera();
  const request = cameraRequest;
  preview.width = PREVIEW_MAX_W;
  preview.height = Math.round(PREVIEW_MAX_W / slotAspect(state.frame));
  previewWrap.setAttribute('aria-busy', 'true');
  status.textContent = 'Đang mở camera…';

  try {
    const ctx = cameraContext();
    if (!ctx.secure || !ctx.hasMediaDevices) throw new Error('Camera không khả dụng.');
    const opened = await openCamera(state.facing);
    // Permission may resolve after the user has left or retried the screen.
    if (request !== cameraRequest || currentScreen !== 'capture') {
      stopCamera(opened.stream);
      return;
    }
    camera = opened;
    previewWrap.setAttribute('aria-busy', 'false');
    status.textContent = state.facing === 'user' ? 'Camera trước · Lật như gương' : 'Camera sau';
    flipButton.disabled = false;
    shootButton.disabled = false;

    const render = () => {
      if (request !== cameraRequest || currentScreen !== 'capture') return;
      try {
        drawPreview(camera.video, preview, slotAspect(state.frame), state.facing === 'user', state.filter, raw);
        animationId = requestAnimationFrame(render);
      } catch (error) {
        showCameraError(error);
      }
    };
    render();
    if (request === cameraRequest && camera && pickMimeType()) {
      try {
        clipStream = raw.captureStream(30);
      } catch {
        // Recording is optional; photos still work without canvas capture support.
        clipStream = null;
      }
    }
  } catch (error) {
    if (request === cameraRequest && currentScreen === 'capture') showCameraError(error);
  }
}

function showCameraError(error) {
  document.querySelector('#camera-error').textContent = cameraErrorMessage(error, cameraContext());
  show('error');
}

export function show(screenName) {
  const target = screens.find(screen => screen.dataset.screen === screenName);
  if (!target) return;
  if (currentScreen === 'capture') releaseCamera();
  if (currentScreen === 'result') clearResult();
  currentScreen = screenName;
  screens.forEach(screen => { screen.hidden = screen !== target; });
  target.querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (screenName === 'capture') startCamera();
  if (screenName === 'select') renderPhotos();
  if (screenName === 'result') {
    resultDate = new Date();
    const day = formatDate(resultDate).split('.').reverse().join('');
    const time = `${String(resultDate.getHours()).padStart(2, '0')}${String(resultDate.getMinutes()).padStart(2, '0')}`;
    resultFilename = `photobooth-${day}-${time}.jpg`;
    renderResult();
  }
}

function clearResult() {
  clearClip();
  resultRun += 1;
  state.result = null;
  resultBlob = null;
  resultFile = null;
  saveButton.disabled = true;
  shareButton.disabled = true;
  shareButton.hidden = true;
  resultPreview.replaceChildren();
}

function clearClip() {
  clipRun += 1;
  clipBlob = null;
  clipFile = null;
  behindVideo.pause();
  behindVideo.removeAttribute('src');
  behindVideo.load();
  behindVideo.hidden = true;
  if (clipUrl) URL.revokeObjectURL(clipUrl);
  clipUrl = null;
  makeClipButton.hidden = state.clips.length !== SHOTS;
  makeClipButton.disabled = false;
  saveClipButton.hidden = true;
  shareClipButton.hidden = true;
  clipSpinner.hidden = true;
  clipStatus.textContent = '';
  makeClipButton.setAttribute('aria-busy', 'false');
}

async function makeClip() {
  if (state.clips.length !== SHOTS || makeClipButton.disabled || currentScreen !== 'result') return;
  clearClip();
  const run = clipRun;
  makeClipButton.disabled = true;
  makeClipButton.setAttribute('aria-busy', 'true');
  clipSpinner.hidden = false;
  clipStatus.textContent = 'Đang tạo clip…';
  try {
    const mimeType = pickMimeType();
    if (!mimeType) throw new Error('Clip không khả dụng.');
    // Keep the caption date identical to the photo, even across midnight.
    const frame = { ...state.frame, caption: state.frame.caption && {
      ...state.frame.caption,
      text: state.frame.caption.text.replaceAll('{date}', formatDate(resultDate)),
    } };
    const blob = await renderBehind(frame, state.selected.map(index => state.clips[index]), state.filter, mimeType);
    if (run !== clipRun || currentScreen !== 'result') return;
    clipBlob = blob;
    const extension = blob.type.startsWith('video/mp4') ? 'mp4' : 'webm';
    clipFilename = resultFilename.replace(/\.jpg$/, `.${extension}`);
    clipUrl = URL.createObjectURL(blob);
    behindVideo.src = clipUrl;
    behindVideo.hidden = false;
    saveClipButton.hidden = false;
    if (typeof File !== 'undefined') {
      clipFile = new File([blob], clipFilename, { type: blob.type });
      try {
        shareClipButton.hidden = !navigator.share || !navigator.canShare?.({ files: [clipFile] });
      } catch {
        shareClipButton.hidden = true;
      }
    }
    shareClipButton.disabled = false;
    clipStatus.textContent = 'Clip đã sẵn sàng để lưu hoặc chia sẻ.';
  } catch {
    if (run === clipRun && currentScreen === 'result') {
      clipStatus.textContent = 'Chưa tạo được clip. Bạn có thể thử lại hoặc lưu ảnh.';
    }
  } finally {
    if (run === clipRun) {
      makeClipButton.disabled = false;
      makeClipButton.setAttribute('aria-busy', 'false');
      clipSpinner.hidden = true;
    }
  }
}

async function renderResult() {
  clearResult();
  const run = resultRun;
  resultPreview.setAttribute('aria-busy', 'true');
  resultStatus.textContent = 'Đang ghép ảnh…';
  try {
    const canvas = await composeStrip(state.frame, state.selected.map(index => state.photos[index]), state.filter, resultDate);
    if (run !== resultRun || currentScreen !== 'result') return;
    const blob = await canvasToBlob(canvas, EXPORT_TYPE, EXPORT_QUALITY);
    if (run !== resultRun || currentScreen !== 'result') return;
    state.result = canvas;
    resultBlob = blob;
    canvas.id = 'result-image';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Ảnh hoàn chỉnh theo thứ tự bạn đã chọn');
    resultPreview.replaceChildren(canvas);
    saveButton.disabled = false;
    // Prepare the file now: sharing must start directly from a user gesture on iOS.
    if (typeof File !== 'undefined') {
      resultFile = new File([blob], resultFilename, { type: blob.type });
      try {
        shareButton.hidden = !navigator.share || !navigator.canShare?.({ files: [resultFile] });
      } catch {
        shareButton.hidden = true;
      }
    }
    shareButton.disabled = false;
    resultStatus.textContent = 'Ảnh đã sẵn sàng để lưu hoặc chia sẻ.';
  } catch {
    if (run === resultRun && currentScreen === 'result') {
      resultStatus.textContent = 'Chưa ghép được ảnh. Hãy chọn lại bộ lọc để thử lại.';
    }
  } finally {
    if (run === resultRun) resultPreview.setAttribute('aria-busy', 'false');
  }
}

function updateSelection() {
  photoPicker.querySelectorAll('[data-index]').forEach(button => {
    const order = state.selected.indexOf(Number(button.dataset.index));
    button.setAttribute('aria-pressed', String(order !== -1));
    button.querySelector('.photo-order').textContent = order === -1 ? '' : String(order + 1);
    button.setAttribute('aria-label', `Ảnh ${Number(button.dataset.index) + 1}${order === -1 ? '' : `, đã chọn thứ ${order + 1}`}`);
  });
  document.querySelector('#photo-choice').textContent = `Đã chọn ${state.selected.length}/${PICK} ảnh`;
  continueButton.disabled = state.selected.length !== PICK;
}

function renderPhotos() {
  photoPicker.replaceChildren();
  document.querySelector('#select-intro').textContent = `Chạm để chọn ${PICK} ảnh. Thứ tự bạn chọn cũng là thứ tự trong khung.`;
  state.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-option';
    button.dataset.action = 'select-photo';
    button.dataset.index = String(index);
    // Keep the full-resolution, unfiltered source canvases in state.
    const thumbnail = document.createElement('canvas');
    thumbnail.width = Math.min(PREVIEW_MAX_W, photo.width);
    thumbnail.height = Math.max(1, Math.round(thumbnail.width * photo.height / photo.width));
    thumbnail.getContext('2d').drawImage(photo, 0, 0, thumbnail.width, thumbnail.height);
    thumbnail.setAttribute('aria-hidden', 'true');
    const order = document.createElement('span');
    order.className = 'photo-order';
    order.setAttribute('aria-hidden', 'true');
    button.append(thumbnail, order);
    button.addEventListener('click', () => {
      state.selected = toggleSelection(state.selected, index, PICK);
      updateSelection();
    });
    photoPicker.append(button);
  });
  updateSelection();
}

function renderFrames() {
  const picker = document.querySelector('#frame-picker');
  for (const frame of FRAMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'frame-option';
    button.dataset.action = 'frame';
    button.dataset.frame = frame.id;
    button.setAttribute('aria-pressed', String(frame === state.frame));
    const art = document.createElement('span');
    art.className = 'frame-art';
    art.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    const scale = 180 / frame.height;
    canvas.width = Math.round(frame.width * scale);
    canvas.height = Math.round(frame.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = frame.background;
    ctx.fillRect(0, 0, frame.width, frame.height);
    ctx.fillStyle = '#f1edef';
    frame.slots.forEach(slot => ctx.fillRect(slot.x, slot.y, slot.w, slot.h));
    if (frame.caption) {
      ctx.font = frame.caption.font;
      ctx.fillStyle = frame.caption.color;
      ctx.textAlign = frame.caption.align;
      ctx.fillText('PHOTOBOOTH', frame.caption.x, frame.caption.y);
    }
    art.append(canvas);
    const label = document.createElement('span');
    label.textContent = frame.name;
    button.append(art, label);
    button.addEventListener('click', () => {
      state.frame = frame;
      picker.querySelectorAll('[data-frame]').forEach(option => {
        option.setAttribute('aria-pressed', String(option.dataset.frame === frame.id));
      });
      document.querySelector('#frame-choice').textContent = `Đã chọn: ${frame.name}`;
    });
    picker.append(button);
  }
  document.querySelector('#frame-choice').textContent = `Đã chọn: ${state.frame.name}`;
}

function renderFilters(chips) {
  for (const filter of FILTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.dataset.action = 'filter';
    button.dataset.filter = filter.id;
    button.textContent = filter.name;
    button.setAttribute('aria-pressed', String(filter === state.filter));
    button.addEventListener('click', () => {
      state.filter = filter;
      document.querySelectorAll('[data-filter]').forEach(chip => {
        chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter.id));
      });
      if (currentScreen === 'result') renderResult();
    });
    chips.append(button);
  }
}

document.querySelector('[data-action="start"]').addEventListener('click', () => show('frames'));
document.querySelector('[data-action="home"]').addEventListener('click', () => show('welcome'));
document.querySelector('[data-action="next"]').addEventListener('click', () => show('capture'));
document.querySelector('[data-action="back"]').addEventListener('click', () => show('frames'));
document.querySelector('[data-action="retry"]').addEventListener('click', () => show('capture'));
document.querySelector('[data-action="choose-frame"]').addEventListener('click', () => show('frames'));
flipButton.addEventListener('click', () => {
  if (capturing) return;
  state.facing = state.facing === 'user' ? 'environment' : 'user';
  startCamera();
});
shootButton.addEventListener('click', captureSequence);
stopButton.addEventListener('click', cancelCapture);
makeClipButton.addEventListener('click', makeClip);
saveClipButton.addEventListener('click', () => {
  if (!clipBlob) return;
  try {
    downloadBlob(clipBlob, clipFilename);
    clipStatus.textContent = 'Đã bắt đầu tải clip về thiết bị.';
  } catch {
    clipStatus.textContent = 'Chưa lưu được clip. Vui lòng thử lại.';
  }
});
shareClipButton.addEventListener('click', async () => {
  if (!clipFile) return;
  const file = clipFile;
  shareClipButton.disabled = true;
  try {
    const outcome = await shareOrNull(file);
    if (clipFile !== file || currentScreen !== 'result') return;
    if (outcome === 'shared') clipStatus.textContent = 'Đã chia sẻ clip.';
    if (outcome === null) {
      shareClipButton.hidden = true;
      clipStatus.textContent = 'Thiết bị chưa hỗ trợ chia sẻ clip. Bạn có thể lưu clip về máy.';
    }
  } catch {
    if (clipFile === file && currentScreen === 'result') {
      clipStatus.textContent = 'Chưa chia sẻ được clip. Vui lòng thử lại hoặc lưu clip về máy.';
    }
  } finally {
    if (clipFile === file) shareClipButton.disabled = false;
  }
});
saveButton.addEventListener('click', () => {
  if (!resultBlob) return;
  try {
    downloadBlob(resultBlob, resultFilename);
    resultStatus.textContent = 'Đã bắt đầu tải ảnh về thiết bị.';
  } catch {
    resultStatus.textContent = 'Chưa lưu được ảnh. Vui lòng thử lại.';
  }
});
shareButton.addEventListener('click', async () => {
  if (!resultFile) return;
  const file = resultFile;
  shareButton.disabled = true;
  try {
    const outcome = await shareOrNull(file);
    if (resultFile !== file || currentScreen !== 'result') return;
    if (outcome === 'shared') resultStatus.textContent = 'Đã chia sẻ ảnh.';
    if (outcome === null) {
      shareButton.hidden = true;
      resultStatus.textContent = 'Thiết bị chưa hỗ trợ chia sẻ ảnh. Bạn có thể lưu ảnh về máy.';
    }
  } catch {
    if (resultFile === file && currentScreen === 'result') {
      resultStatus.textContent = 'Chưa chia sẻ được ảnh. Vui lòng thử lại hoặc lưu ảnh về máy.';
    }
  } finally {
    if (resultFile === file) shareButton.disabled = false;
  }
});
continueButton.addEventListener('click', () => {
  if (state.selected.length === PICK) show('result');
});
document.querySelectorAll('[data-action="again"]').forEach(button => {
  button.addEventListener('click', () => {
    state.photos = [];
    state.clips = [];
    state.selected = [];
    photoPicker.replaceChildren();
    show('frames');
  });
});

window.addEventListener('pagehide', () => {
  releaseCamera();
  clearClip();
});
window.addEventListener('pageshow', event => {
  if (event.persisted && currentScreen === 'capture') startCamera();
});

renderFrames();
renderFilters(document.querySelector('#capture-filters'));
renderFilters(document.querySelector('#result-filters'));
resetCaptureControls();
