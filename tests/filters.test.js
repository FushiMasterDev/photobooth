import test from 'node:test';
import assert from 'node:assert/strict';
import { FILTERS, applyFilter } from '../js/filters.js';

function img(width, height, rgba) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { data, width, height };
}

const byId = id => FILTERS.find(filter => filter.id === id);

test('original leaves pixels unchanged', () => {
  assert.deepEqual([...applyFilter(img(1, 1, [10, 20, 30, 255]), byId('original')).data], [10, 20, 30, 255]);
});

test('default params return immediately without reading pixels', () => {
  const imageData = { get data() { assert.fail('Default filters must skip pixel processing'); } };
  assert.strictEqual(applyFilter(imageData, byId('original')), imageData);
  assert.strictEqual(applyFilter(imageData, { params: {
    exposure: 0, contrast: 0, saturation: 1, temperature: 0, tint: 0, fade: 0, vignette: 0, grain: 0,
  } }), imageData);
});

test('bw with grain disabled makes r=g=b', () => {
  const bw = byId('bw');
  const filter = { ...bw, params: { ...bw.params, grain: 0 } };
  const { data } = applyFilter(img(3, 3, [200, 100, 50, 255]), filter);
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i], data[i + 1]);
    assert.equal(data[i + 1], data[i + 2]);
  }
});

test('clear highlights and cool shadows stay within 0..255', () => {
  const clear = applyFilter(img(1, 1, [255, 255, 255, 255]), byId('clear'));
  const cool = applyFilter(img(1, 1, [0, 0, 0, 255]), byId('cool'));
  for (const image of [clear, cool]) {
    assert.ok([...image.data].every(value => value >= 0 && value <= 255));
  }
  assert.deepEqual([...clear.data], [255, 255, 255, 255]);
  assert.equal(cool.data[0], 0);
});

test('alpha 128 is untouched by every filter', () => {
  for (const filter of FILTERS) {
    const { data } = applyFilter(img(3, 2, [10, 20, 30, 128]), filter);
    for (let i = 3; i < data.length; i += 4) assert.equal(data[i], 128, filter.id);
  }
});

test('vignette preserves the center and darkens corners', () => {
  const { data } = applyFilter(img(101, 101, [128, 128, 128, 255]), { params: { vignette: 0.5 } });
  const center = (50 * 101 + 50) * 4;
  assert.deepEqual([...data.slice(center, center + 4)], [128, 128, 128, 255]);
  assert.ok(data[0] < 100);
  assert.equal(data[0], data[(101 * 101 - 1) * 4]);
});

test('film raises R relative to B and cool raises B relative to R on grey', () => {
  const film = applyFilter(img(1, 1, [128, 128, 128, 255]), byId('film')).data;
  const cool = applyFilter(img(1, 1, [128, 128, 128, 255]), byId('cool')).data;
  assert.ok(film[0] > film[2]);
  assert.ok(cool[2] > cool[0]);
});

test('positive tint reduces green to produce magenta', () => {
  const { data } = applyFilter(img(1, 1, [128, 128, 128, 255]), { params: { tint: 0.5 } });
  assert.deepEqual([...data], [128, 118, 128, 255]);
});

test('tone adjustments run in order before temperature and tint', () => {
  const filter = { params: { exposure: 1, contrast: 0.5, fade: 0.2, temperature: 0.5, tint: 0.5 } };
  assert.deepEqual([...applyFilter(img(1, 1, [64, 64, 64, 128]), filter).data], [166, 143, 141, 128]);
});

test('grain adds the same noise to RGB independently for each pixel', t => {
  let calls = 0;
  t.mock.method(Math, 'random', () => ++calls === 1 ? 0.75 : 0.25);
  const { data } = applyFilter(img(2, 1, [100, 120, 140, 128]), { params: { grain: 0.2 } });
  assert.deepEqual([...data], [113, 133, 153, 128, 87, 107, 127, 128]);
  assert.equal(calls, 2);
});

test('lookup tables are keyed by filter object rather than id', () => {
  const warm = { id: 'custom', params: { temperature: 0.5 } };
  const cool = { id: 'custom', params: { temperature: -0.5 } };
  const source = () => img(1, 1, [128, 128, 128, 255]);
  const first = applyFilter(source(), warm).data;
  const second = applyFilter(source(), cool).data;
  assert.ok(first[0] > first[2]);
  assert.ok(second[0] < second[2]);
  assert.deepEqual(applyFilter(source(), warm).data, first);
});

test('vignette geometry is shared without mixing strengths or dimensions', () => {
  const weak = { params: { vignette: 0.2 } };
  const strong = { params: { vignette: 0.8 } };
  const first = applyFilter(img(101, 51, [128, 128, 128, 255]), weak).data;
  const second = applyFilter(img(101, 51, [128, 128, 128, 255]), strong).data;
  assert.ok(first[0] > second[0]);
  const portrait = applyFilter(img(51, 101, [128, 128, 128, 255]), weak).data;
  assert.equal(portrait[(50 * 51 + 25) * 4], 128);
  assert.equal(portrait[0], first[0]);
  assert.deepEqual(applyFilter(img(101, 51, [128, 128, 128, 255]), weak).data, first);
});

test('filter ids are unique, there are exactly seven, and original is first', () => {
  assert.equal(FILTERS.length, 7);
  assert.equal(new Set(FILTERS.map(filter => filter.id)).size, 7);
  assert.equal(FILTERS[0].id, 'original');
});

test('filters have the specified names and params', () => {
  assert.deepEqual(FILTERS, [
    { id: 'original', name: 'Gốc', params: {} },
    { id: 'clear', name: 'Trong trẻo', params: { exposure: 0.15, contrast: -0.08, saturation: 0.92, temperature: 0.02, tint: 0.04, fade: 0.04 } },
    { id: 'peach', name: 'Hồng đào', params: { exposure: 0.08, contrast: 0.05, saturation: 1.05, temperature: 0.25, tint: 0.15, fade: 0.03 } },
    { id: 'film', name: 'Film ấm', params: { exposure: 0.02, contrast: 0.12, saturation: 0.85, temperature: 0.35, fade: 0.1, vignette: 0.35, grain: 0.06 } },
    { id: 'cool', name: 'Mát lạnh', params: { exposure: 0.05, contrast: 0.08, saturation: 0.9, temperature: -0.35, tint: 0.05 } },
    { id: 'bw', name: 'Đen trắng', params: { saturation: 0, contrast: 0.25, fade: 0.03, vignette: 0.25, grain: 0.05 } },
    { id: 'vintage', name: 'Cổ điển', params: { contrast: -0.05, saturation: 0.6, temperature: 0.45, fade: 0.15, vignette: 0.4, grain: 0.08 } },
  ]);
});

test('applyFilter mutates the same buffer and returns its argument', () => {
  for (const filter of FILTERS) {
    const imageData = img(2, 2, [100, 100, 100, 255]);
    const buffer = imageData.data;
    assert.strictEqual(applyFilter(imageData, filter), imageData, filter.id);
    assert.strictEqual(imageData.data, buffer, filter.id);
  }
});
