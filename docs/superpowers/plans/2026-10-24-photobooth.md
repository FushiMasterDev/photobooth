# Photobooth Life4Cuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution in this project:** each task is implemented by Codex (`codex exec`), one task per run. Claude supervises: reviews the diff, runs the tests and a headless-Chrome fake-camera check, then commits. Codex does **not** commit.

**Goal:** A static, mobile-first web photobooth in the style of Life4Cuts: pick a frame, auto-shoot 8 photos with a countdown, pick 4, choose a filter, then share or save the strip, plus an optional "behind" clip.

**Architecture:** Plain ES modules with no build step. Pure logic (geometry, selection, filters, frame data) lives in DOM-free modules covered by `node --test`. The DOM modules (camera, compose, share, behind, app) are verified by hand in a browser. Frames and filters are declarative data, so adding one means adding one object.

**Tech Stack:** HTML, CSS, vanilla JS (ES2020 modules), Canvas 2D, getUserMedia, MediaRecorder, Web Share API, Node 22 built-in test runner. No runtime dependencies and no npm packages.

**Spec:** `docs/superpowers/specs/2026-10-24-photobooth-design.md` (read it before starting any task)

## Global Constraints

- No framework, no bundler, no npm dependencies. `package.json` exists only for `"type": "module"` and the `test` script.
- **Never use `CanvasRenderingContext2D.filter`** (unsupported in Safari iOS). All color filtering goes through `applyMatrix` on `ImageData`.
- Must work in Safari iOS and Chrome Android. `<video>` elements need `playsinline muted autoplay`.
- No network requests except loading the site's own files. Photos never leave the device.
- All user-facing text is Vietnamese.
- Numbers live in `js/config.js`: `SHOTS = 8`, `PICK = 4`, `COUNTDOWN_SEC = 5`, `CLIP_MS = 2000`, `EXPORT_TYPE = 'image/jpeg'`, `EXPORT_QUALITY = 0.92`, `PREVIEW_MAX_W = 480`.
- Front camera preview **and** export are mirrored. Back camera is never mirrored.
- Photos are stored raw (unfiltered). Filters are applied only at preview and compose time.
- Caption date format is `dd.MM.yyyy`.

## Review Focus

1. Camera returns a portrait or landscape stream of any size, or the phone is rotated: the crop must still match the slot aspect without stretching. Pinned by the `coverCrop` tests in Task 1.
2. Camera permission is denied, there is no camera, the page is not on HTTPS, or it is opened in an in-app browser (Zalo/Messenger) without `mediaDevices`: show a clear Vietnamese message and a retry button, never a blank screen. Pinned by the `cameraErrorMessage` tests in Task 1.
3. Picking a 5th photo, or tapping a selected photo again: selection stays at most 4 and the tap deselects. Pinned by the `toggleSelection` tests in Task 1.
4. Pressing stop mid-countdown, or leaving the capture screen: timers are cleared and camera tracks are stopped. Checked by hand in Task 4.
5. A pixel value pushed past 0 or 255 by a filter matrix: it must clamp, not wrap. Pinned by the `applyMatrix` clamp test in Task 2.

## File Structure

```
index.html          single page, all screens as <section data-screen="...">
styles.css          mobile-first styles
package.json        {"type":"module","scripts":{"test":"node --test tests/"}}
README.md           run locally, deploy, add a frame, add a filter
js/config.js        constants (Global Constraints)
js/util.js          pure: coverCrop, formatDate, toggleSelection, cameraErrorMessage
js/frames.js        FRAMES data + slotAspect
js/filters.js       FILTERS data + applyMatrix
js/camera.js        openCamera, stopCamera, grabFrame, drawPreview
js/compose.js       loadImage, composeStrip
js/share.js         canvasToBlob, shareOrNull, downloadBlob
js/behind.js        pickMimeType, recordClip, renderBehind
js/app.js           screen flow + state
tests/util.test.js
tests/frames.test.js
tests/filters.test.js
```

---

### Task 1: Project skeleton + pure helpers

**Files:**
- Create: `package.json`, `js/config.js`, `js/util.js`
- Test: `tests/util.test.js`

**Interfaces:**
- Produces:
  - `config.js` named exports, exactly as in Global Constraints.
  - `coverCrop(srcW: number, srcH: number, aspect: number) -> {sx, sy, sw, sh}`: the largest centered rect of ratio `aspect` (= w/h) inside the source.
  - `formatDate(d: Date) -> string` returns `'dd.MM.yyyy'`.
  - `toggleSelection(selected: number[], index: number, max: number) -> number[]` returns a new array. It removes `index` if present, appends it if `selected.length < max`, and otherwise returns an unchanged copy.
  - `cameraErrorMessage(err: {name?: string} | null, ctx: {secure: boolean, hasMediaDevices: boolean}) -> string` returns a Vietnamese message.

- [ ] **Step 1: Write failing tests in `tests/util.test.js`** (`node:test` + `node:assert/strict`)

```js
test('coverCrop landscape source into portrait slot', () => {
  assert.deepEqual(coverCrop(1280, 720, 0.75), { sx: 370, sy: 0, sw: 540, sh: 720 });
});
test('coverCrop portrait source into landscape slot', () => {
  assert.deepEqual(coverCrop(720, 1280, 540 / 380), { sx: 0, sy: 386.7, sw: 720, sh: 506.7 }); // compare rounded to 1 decimal
});
test('coverCrop same aspect returns full frame', () => {
  assert.deepEqual(coverCrop(800, 600, 4 / 3), { sx: 0, sy: 0, sw: 800, sh: 600 });
});
test('formatDate pads', () => assert.equal(formatDate(new Date(2026, 0, 5)), '05.01.2026'));
test('toggleSelection appends in tap order', () => assert.deepEqual(toggleSelection([3, 1], 6, 4), [3, 1, 6]));
test('toggleSelection deselects', () => assert.deepEqual(toggleSelection([3, 1, 6], 1, 4), [3, 6]));
test('toggleSelection ignores 5th pick', () => assert.deepEqual(toggleSelection([0, 1, 2, 3], 5, 4), [0, 1, 2, 3]));
test('toggleSelection does not mutate input', () => { const a = [0]; toggleSelection(a, 1, 4); assert.deepEqual(a, [0]); });
test('cameraErrorMessage insecure', () => assert.match(cameraErrorMessage(null, { secure: false, hasMediaDevices: false }), /HTTPS/));
test('cameraErrorMessage in-app browser', () => assert.match(cameraErrorMessage(null, { secure: true, hasMediaDevices: false }), /Safari|Chrome/));
test('cameraErrorMessage denied', () => assert.match(cameraErrorMessage({ name: 'NotAllowedError' }, { secure: true, hasMediaDevices: true }), /quyền/));
test('cameraErrorMessage no camera', () => assert.match(cameraErrorMessage({ name: 'NotFoundError' }, { secure: true, hasMediaDevices: true }), /camera/i));
test('cameraErrorMessage busy', () => assert.match(cameraErrorMessage({ name: 'NotReadableError' }, { secure: true, hasMediaDevices: true }), /ứng dụng khác/));
```

For the coverCrop portrait case, assert each field with `Math.round(x * 10) / 10`. Do not deepEqual raw floats.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (module not found).
- [ ] **Step 3: Create `package.json`, `js/config.js`, `js/util.js`** with the signatures above. Any unknown error name gets a generic message with "thử lại".
- [ ] **Step 4: Run `npm test`.** Expected: all pass.
- [ ] **Step 5: Commit** (supervisor) `feat: project skeleton and pure helpers`

---

### Task 2: Frame and filter data (the reusable part)

**Files:**
- Create: `js/frames.js`, `js/filters.js`, `README.md`
- Test: `tests/frames.test.js`, `tests/filters.test.js`

**Interfaces:**
- Produces:
  - `FRAMES: Frame[]`, where `Frame = { id, name, layout: 'strip'|'grid', width, height, background: string, backgroundImage: string|null, overlayImage: string|null, slots: {x,y,w,h}[4], caption: {text, x, y, font, color, align: 'center'} | null }`. In `caption.text`, `{date}` is replaced by `formatDate(new Date())`.
  - `slotAspect(frame) -> number` = `slots[0].w / slots[0].h`.
  - `FILTERS: {id, name, matrix: number[20]}[]`. The matrix is 4×5 row-major like `feColorMatrix`, **with offsets in 0–255 units**.
  - `applyMatrix(imageData: {data: Uint8ClampedArray}, matrix: number[20]) -> imageData` mutates in place, returns its argument, and skips work when the matrix is identity.

Frame geometry (exact values):
- strip 600×1800: slots `x=30, w=540, h=380, y = 30 + i*402` (i = 0..3). Caption `y=1700, x=300, font='600 40px sans-serif'`.
- grid 1200×1800: slots `w=545, h=755` at `(40,40) (615,40) (40,825) (615,825)`. Caption `y=1690, x=600, font='600 56px sans-serif'`.
- Six frames: `strip-pink #ffd6e0`, `strip-black #111111` (caption `#ffffff`), `strip-cream #f5efe6`, `grid-white #ffffff`, `grid-sky #cfe8ff`, `grid-lilac #e3d7ff`. Other captions use `#333333`. Caption text is `'PHOTOBOOTH · {date}'`.

Filters (exact matrices, alpha row `[0,0,0,1,0]` for all):
- `original` "Gốc": identity
- `bw` "Đen trắng": each RGB row `[0.299, 0.587, 0.114, 0, 0]`
- `warm` "Tông ấm": `[1.08,0,0,0,8], [0,1.0,0,0,2], [0,0,0.88,0,0]`
- `bright` "Sáng da": `[1.05,0,0,0,18], [0,1.02,0,0,16], [0,0,1.0,0,20]`

- [ ] **Step 1: Write failing tests**

```js
// frames.test.js
test('every frame has 4 slots of equal aspect inside its canvas', ...) // for each frame: slots.length===4, all w/h equal, x+w<=width, y+h<=height
test('frame ids are unique', ...)
test('both layouts present', ...) // some strip, some grid
test('slotAspect strip', () => assert.equal(slotAspect(FRAMES.find(f => f.layout === 'strip')), 540 / 380));
// filters.test.js
const px = (...v) => ({ data: new Uint8ClampedArray(v) });
test('identity leaves pixels unchanged', () => assert.deepEqual([...applyMatrix(px(10, 20, 30, 255), byId('original').matrix).data], [10, 20, 30, 255]));
test('bw makes r=g=b', () => { const [r, g, b] = applyMatrix(px(200, 100, 50, 255), byId('bw').matrix).data; assert.ok(r === g && g === b); });
test('clamps above 255', () => assert.equal(applyMatrix(px(250, 250, 250, 255), byId('bright').matrix).data[0], 255));
test('alpha untouched', () => assert.equal(applyMatrix(px(10, 10, 10, 128), byId('warm').matrix).data[3], 128));
test('filter ids unique and all matrices length 20', ...)
```

- [ ] **Step 2: Run `npm test`.** Expected: new tests FAIL.
- [ ] **Step 3: Implement `js/frames.js` and `js/filters.js`.** `applyMatrix` loops over `data` in steps of 4 and writes into the same `Uint8ClampedArray` (it clamps by itself).
- [ ] **Step 4: Write `README.md`** in Vietnamese: run locally (`python3 -m http.server 8000`, then open `http://localhost:8000`; phones need HTTPS), deploy to GitHub Pages / Vercel, **how to add a frame** (copy one object, coordinates in px, optional PNG in `assets/frames/`), **how to add a filter** (copy one object, what each matrix row means), and where to change shot count and countdown.
- [ ] **Step 5: Run `npm test`.** Expected: all pass.
- [ ] **Step 6: Commit** (supervisor) `feat: declarative frames and filters`

---

### Task 3: Page shell, frame picker, live camera preview

**Files:**
- Create: `index.html`, `styles.css`, `js/camera.js`, `js/app.js`

**Interfaces:**
- Consumes: `FRAMES`, `slotAspect`, `FILTERS`, `applyMatrix`, `coverCrop`, `cameraErrorMessage`, config.
- Produces:
  - `openCamera(facingMode: 'user'|'environment') -> Promise<{video: HTMLVideoElement, stream: MediaStream}>` requests `{video: {facingMode, width: {ideal: 1920}, height: {ideal: 1080}}, audio: false}` and resolves only once `video.videoWidth > 0`.
  - `stopCamera(stream)` stops all tracks.
  - `grabFrame(video, aspect, mirror) -> HTMLCanvasElement` returns a full-resolution `coverCrop` of the current frame, mirrored if asked, **unfiltered**.
  - `drawPreview(video, canvas, aspect, mirror, matrix)` draws the cropped frame at width ≤ `PREVIEW_MAX_W` and applies `applyMatrix`. It is called every `requestAnimationFrame` while capturing.
  - `app.js` holds state `{frame, filter, facing, photos: HTMLCanvasElement[], clips: Blob[], selected: number[]}` and `show(screenName)` toggles `<section data-screen>`.

Screens: `welcome` (title + "Bắt đầu") → `frames` (thumbnails drawn from each frame's background and empty slots; tapping one selects it, then "Tiếp tục") → `capture` (preview canvas sized to the slot aspect, filter chips, camera-flip button, "Bắt đầu chụp" button which Task 4 wires up) → `error` (message from `cameraErrorMessage` + "Thử lại").

- [ ] **Step 1: Build the shell and screens.** Big touch targets (≥ 44px), one-handed layout with main actions near the bottom, cute Korean-photobooth look. `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- [ ] **Step 2: Implement `camera.js`.** In `app.js`, entering `capture` opens the camera and leaving it calls `stopCamera`. Flip camera = stop, then reopen with the other facing. Mirror = `facing === 'user'`.
- [ ] **Step 3: Verify.** `npm test` still passes. Then the supervisor runs headless Chrome with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` against `http://localhost:8000`: the capture screen shows the moving fake feed cropped to the slot aspect, and switching to "Đen trắng" turns it grey. Run Chrome **without** the fake flags plus `--deny-permission-prompts` (or with no camera access): the error screen shows a Vietnamese message.
- [ ] **Step 4: Commit** (supervisor) `feat: page shell, frame picker, live preview`

---

### Task 4: Auto-capture sequence + photo selection

**Files:**
- Modify: `js/app.js`, `index.html`, `styles.css`

**Interfaces:**
- Consumes: `grabFrame`, `toggleSelection`, config `SHOTS`, `PICK`, `COUNTDOWN_SEC`.
- Produces: `state.photos` (length `SHOTS`, raw canvases) and `state.selected` (length `PICK`, indices in tap order) when moving to the result screen.

- [ ] **Step 1: Capture sequence.** "Bắt đầu chụp" starts an automatic loop over `SHOTS` shots. Each shot runs a `COUNTDOWN_SEC` countdown with a big number over the preview and a "3/8" counter, then a white flash and `grabFrame`. A "Dừng" button cancels: clear all timers and return to the idle capture screen with photos discarded. Leaving the screen any other way also clears the timers.
- [ ] **Step 2: Select screen** `select`: grid of the 8 thumbnails. Tapping uses `toggleSelection(state.selected, i, PICK)`. Selected thumbnails show their order number (1–4). "Tiếp tục" is disabled until `selected.length === PICK`. "Chụp lại" goes back to `frames`. Stop the camera on entering `select`.
- [ ] **Step 3: Verify.** `npm test` passes. With `COUNTDOWN_SEC` temporarily overridden to 1 via a `?fast` URL param (`COUNTDOWN_SEC` stays 5 by default), the fake-camera Chrome run reaches the `select` screen with 8 thumbnails. Pressing "Dừng" mid-sequence returns to idle and the counter resets.
- [ ] **Step 4: Commit** (supervisor) `feat: auto capture and photo selection`

---

### Task 5: Compose, filter on result, share and save

**Files:**
- Create: `js/compose.js`, `js/share.js`
- Modify: `js/app.js`, `index.html`, `styles.css`

**Interfaces:**
- Consumes: `FRAMES`, `FILTERS`, `applyMatrix`, `coverCrop`, `formatDate`, config export settings.
- Produces:
  - `loadImage(src) -> Promise<HTMLImageElement>`, cached per src.
  - `composeStrip(frame, photos: HTMLCanvasElement[], matrix, date: Date) -> Promise<HTMLCanvasElement>` draws, in order: background color, background image, each photo `coverCrop`'d into its slot with the filter applied to that slot's pixels only, overlay image, then the caption.
  - `canvasToBlob(canvas, type, quality) -> Promise<Blob>`.
  - `shareOrNull(file: File) -> Promise<'shared'|'cancelled'|null>` returns `null` when `navigator.canShare?.({files: [file]})` is false.
  - `downloadBlob(blob, filename)` uses an `<a download>` + object URL and revokes the URL afterwards.

- [ ] **Step 1: Implement `compose.js` and `share.js`.**
- [ ] **Step 2: Result screen** `result`: shows the composed strip (scaled to fit). Filter chips re-compose on change, starting from the filter chosen during capture. Buttons: "Chia sẻ" (hidden if `navigator.canShare` is missing or rejects files), "Lưu ảnh" (filename `photobooth-YYYYMMDD-HHmm.jpg`), "Chụp lại" (→ `frames`, clears photos and clips).
- [ ] **Step 3: Verify.** `npm test` passes. In the fake-camera run, reach `result`. Take a screenshot: the 4 slots are filled in tap order, nothing is stretched, and the caption shows today's date as `dd.MM.yyyy`. Switching the filter to "Đen trắng" re-renders grey slots while the frame background keeps its color. Clicking "Lưu ảnh" produces a 600×1800 (strip) or 1200×1800 (grid) JPEG.
- [ ] **Step 4: Commit** (supervisor) `feat: compose strip, share and save`

---

### Task 6: "Behind" clip

**Files:**
- Create: `js/behind.js`
- Modify: `js/app.js`, `index.html`

**Interfaces:**
- Consumes: the capture loop from Task 4, `composeStrip`'s slot layout and filter approach, `coverCrop`, `applyMatrix`, `CLIP_MS`.
- Produces:
  - `pickMimeType() -> string|null`: the first type in `['video/mp4', 'video/webm;codecs=vp9', 'video/webm']` that `MediaRecorder.isTypeSupported` accepts, or `null` when there is no `MediaRecorder`.
  - `recordClip(stream, ms, mimeType) -> Promise<Blob>`.
  - `renderBehind(frame, clips: Blob[], matrix, mimeType, scale = 0.5) -> Promise<Blob>` plays the 4 clips muted and inline at the same time. Each `requestAnimationFrame` it draws the frame at `scale` with each clip `coverCrop`'d + filtered into its slot (mirrored like the photos), recorded via `canvas.captureStream(30)` until the longest clip ends.

- [ ] **Step 1: Record during capture.** If `pickMimeType()` is non-null, start `recordClip(stream, CLIP_MS, type)` when each countdown has `CLIP_MS` left, giving `state.clips[i]` per shot. If recording throws, set clips to `[]` and keep shooting: the photo flow must never break.
- [ ] **Step 2: Result screen** gets a "Tạo clip" button, shown only when `state.clips.length === SHOTS`. It renders with the selected indices and current filter, shows a spinner while working, then shows a `<video controls playsinline>` plus "Lưu clip" / "Chia sẻ clip" (using `share.js`, with extension `.mp4` or `.webm` matching the mime type).
- [ ] **Step 3: Verify.** `npm test` passes. In the fake-camera run, "Tạo clip" appears and produces a playable video of non-zero duration showing 4 moving slots inside the frame. With a `?noclip` URL param that sets `window.MediaRecorder = undefined` at startup, the button is hidden and photos still work.
- [ ] **Step 4: Commit** (supervisor) `feat: behind clip`

---

## Done when

All six tasks are committed, `npm test` passes, and the owner has tested on a real iPhone (Safari) and a real Android phone (Chrome) over HTTPS: permissions, preview colors matching the export, share sheet, save, and clip.
