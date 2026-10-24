import { FRAMES, slotAspect } from './frames.js';
import { FILTERS } from './filters.js';
import { PREVIEW_MAX_W } from './config.js';
import { cameraErrorMessage } from './util.js';
import { openCamera, stopCamera, drawPreview } from './camera.js';

export const state = {
  frame: FRAMES[0],
  filter: FILTERS[0],
  facing: 'user',
  photos: [],
  clips: [],
  selected: [],
};

const screens = [...document.querySelectorAll('[data-screen]')];
const preview = document.querySelector('#preview');
const previewWrap = document.querySelector('.preview-wrap');
const status = document.querySelector('#camera-status');
const flipButton = document.querySelector('[data-action="flip"]');
const shootButton = document.querySelector('[data-action="shoot"]');
let currentScreen = 'welcome';
let camera = null;
let animationId = null;
let cameraRequest = 0;

function releaseCamera() {
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
        drawPreview(camera.video, preview, slotAspect(state.frame), state.facing === 'user', state.filter.matrix);
        animationId = requestAnimationFrame(render);
      } catch (error) {
        showCameraError(error);
      }
    };
    render();
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
  currentScreen = screenName;
  screens.forEach(screen => { screen.hidden = screen !== target; });
  target.querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  if (screenName === 'capture') startCamera();
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

function renderFilters() {
  const chips = document.querySelector('#capture-filters');
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
      chips.querySelectorAll('[data-filter]').forEach(chip => {
        chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter.id));
      });
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
  state.facing = state.facing === 'user' ? 'environment' : 'user';
  startCamera();
});

window.addEventListener('pagehide', releaseCamera);
window.addEventListener('pageshow', event => {
  if (event.persisted && currentScreen === 'capture') startCamera();
});

renderFrames();
renderFilters();
