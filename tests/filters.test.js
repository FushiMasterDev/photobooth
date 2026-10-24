import test from 'node:test';
import assert from 'node:assert/strict';
import { FILTERS, applyMatrix } from '../js/filters.js';

const px = (...values) => ({ data: new Uint8ClampedArray(values) });
const byId = id => FILTERS.find(filter => filter.id === id);

test('identity leaves pixels unchanged', () => {
  assert.deepEqual([...applyMatrix(px(10, 20, 30, 255), byId('original').matrix).data], [10, 20, 30, 255]);
});

test('bw makes r=g=b', () => {
  const [r, g, b] = applyMatrix(px(200, 100, 50, 255), byId('bw').matrix).data;
  assert.ok(r === g && g === b);
  assert.equal(r, 124);
});

test('clamps above 255', () => {
  assert.equal(applyMatrix(px(250, 250, 250, 255), byId('bright').matrix).data[0], 255);
});

test('clamps below 0', () => {
  const matrix = [...byId('original').matrix];
  matrix[4] = -30;
  assert.equal(applyMatrix(px(10, 20, 30, 255), matrix).data[0], 0);
});

test('alpha untouched', () => {
  for (const filter of FILTERS) {
    assert.equal(applyMatrix(px(10, 10, 10, 128), filter.matrix).data[3], 128, filter.id);
  }
});

test('filter ids unique and all matrices length 20', () => {
  assert.equal(new Set(FILTERS.map(filter => filter.id)).size, FILTERS.length);
  for (const filter of FILTERS) {
    assert.equal(filter.matrix.length, 20, filter.id);
    assert.ok(filter.matrix.every(Number.isFinite), filter.id);
  }
});

test('starter filters have the specified names and matrices', () => {
  assert.deepEqual(FILTERS, [
    { id: 'original', name: 'Gốc', matrix: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0] },
    { id: 'bw', name: 'Đen trắng', matrix: [0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0] },
    { id: 'warm', name: 'Tông ấm', matrix: [1.08, 0, 0, 0, 8, 0, 1.0, 0, 0, 2, 0, 0, 0.88, 0, 0, 0, 0, 0, 1, 0] },
    { id: 'bright', name: 'Sáng da', matrix: [1.05, 0, 0, 0, 18, 0, 1.02, 0, 0, 16, 0, 0, 1.0, 0, 20, 0, 0, 0, 1, 0] },
  ]);
});

test('applyMatrix mutates the same buffer and returns its argument', () => {
  for (const filter of FILTERS) {
    const imageData = px(100, 100, 100, 255);
    const buffer = imageData.data;
    assert.strictEqual(applyMatrix(imageData, filter.matrix), imageData, filter.id);
    assert.strictEqual(imageData.data, buffer, filter.id);
  }
});

test('matrix uses original channels and byte offsets for every pixel', () => {
  const matrix = [
    0, 1, 0, 0, 5,
    0, 0, 1, 0, 6,
    1, 0, 0, 0, 7,
    0, 0, 0, 1, 0,
  ];
  const result = applyMatrix(px(10, 20, 30, 128, 100, 150, 200, 255), matrix);
  assert.deepEqual([...result.data], [25, 36, 17, 128, 155, 206, 107, 255]);
});
