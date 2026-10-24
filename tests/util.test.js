import test from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop, formatDate, toggleSelection, cameraErrorMessage } from '../js/util.js';

test('coverCrop landscape source into portrait slot', () => {
  assert.deepEqual(coverCrop(1280, 720, 0.75), { sx: 370, sy: 0, sw: 540, sh: 720 });
});

test('coverCrop portrait source into landscape slot', () => {
  const crop = coverCrop(720, 1280, 540 / 380);
  const expected = { sx: 0, sy: 386.7, sw: 720, sh: 506.7 };
  for (const key of Object.keys(expected)) {
    assert.equal(Math.round(crop[key] * 10) / 10, expected[key], key);
  }
});

test('coverCrop same aspect returns full frame', () => {
  assert.deepEqual(coverCrop(800, 600, 4 / 3), { sx: 0, sy: 0, sw: 800, sh: 600 });
});

test('formatDate pads', () => {
  assert.equal(formatDate(new Date(2026, 0, 5)), '05.01.2026');
});

test('toggleSelection appends in tap order', () => {
  assert.deepEqual(toggleSelection([3, 1], 6, 4), [3, 1, 6]);
});

test('toggleSelection deselects', () => {
  assert.deepEqual(toggleSelection([3, 1, 6], 1, 4), [3, 6]);
});

test('toggleSelection ignores 5th pick', () => {
  assert.deepEqual(toggleSelection([0, 1, 2, 3], 5, 4), [0, 1, 2, 3]);
});

test('toggleSelection does not mutate input and always returns a new array', () => {
  for (const [selected, index] of [[[0], 1], [[0, 1], 1], [[0, 1, 2, 3], 5]]) {
    const before = [...selected];
    const result = toggleSelection(selected, index, 4);
    assert.deepEqual(selected, before);
    assert.notStrictEqual(result, selected);
  }
});

test('cameraErrorMessage insecure', () => {
  assert.match(cameraErrorMessage(null, { secure: false, hasMediaDevices: false }), /HTTPS/);
});

test('cameraErrorMessage in-app browser', () => {
  assert.match(cameraErrorMessage(null, { secure: true, hasMediaDevices: false }), /Safari|Chrome/);
});

test('cameraErrorMessage denied', () => {
  assert.match(cameraErrorMessage({ name: 'NotAllowedError' }, { secure: true, hasMediaDevices: true }), /quyền/);
});

test('cameraErrorMessage no camera', () => {
  assert.match(cameraErrorMessage({ name: 'NotFoundError' }, { secure: true, hasMediaDevices: true }), /camera/i);
});

test('cameraErrorMessage busy', () => {
  assert.match(cameraErrorMessage({ name: 'NotReadableError' }, { secure: true, hasMediaDevices: true }), /ứng dụng khác/);
});

test('cameraErrorMessage unknown error suggests retrying', () => {
  assert.match(cameraErrorMessage({ name: 'UnknownError' }, { secure: true, hasMediaDevices: true }), /thử lại/);
});

test('cameraErrorMessage null error suggests retrying', () => {
  assert.match(cameraErrorMessage(null, { secure: true, hasMediaDevices: true }), /thử lại/);
});
