import test from 'node:test';
import assert from 'node:assert/strict';
import { FRAMES, slotAspect } from '../js/frames.js';

test('every frame has 4 slots of equal aspect inside its canvas', () => {
  for (const frame of FRAMES) {
    assert.equal(frame.slots.length, 4, frame.id);
    for (const slot of frame.slots) {
      assert.ok(slot.x >= 0 && slot.y >= 0, frame.id);
      assert.ok(slot.w > 0 && slot.h > 0, frame.id);
      assert.equal(slot.w / slot.h, slotAspect(frame), frame.id);
      assert.ok(slot.x + slot.w <= frame.width, frame.id);
      assert.ok(slot.y + slot.h <= frame.height, frame.id);
    }
  }
});

test('frame ids are unique', () => {
  assert.equal(new Set(FRAMES.map(frame => frame.id)).size, FRAMES.length);
});

test('both layouts present', () => {
  assert.ok(FRAMES.some(frame => frame.layout === 'strip'));
  assert.ok(FRAMES.some(frame => frame.layout === 'grid'));
});

test('slotAspect strip', () => {
  assert.equal(slotAspect(FRAMES.find(frame => frame.layout === 'strip')), 540 / 380);
});

test('six starter frames have the specified geometry, colors and captions', () => {
  const expected = [
    ['strip-pink', 'strip', '#ffd6e0'],
    ['strip-black', 'strip', '#111111'],
    ['strip-cream', 'strip', '#f5efe6'],
    ['grid-white', 'grid', '#ffffff'],
    ['grid-sky', 'grid', '#cfe8ff'],
    ['grid-lilac', 'grid', '#e3d7ff'],
  ];
  assert.equal(FRAMES.length, expected.length);
  for (const [id, layout, background] of expected) {
    const frame = FRAMES.find(item => item.id === id);
    assert.ok(frame, id);
    assert.ok(typeof frame.name === 'string' && frame.name.length > 0, id);
    assert.equal(frame.layout, layout, id);
    assert.equal(frame.background, background, id);
    assert.equal(frame.backgroundImage, null, id);
    assert.equal(frame.overlayImage, null, id);
    const strip = layout === 'strip';
    assert.equal(frame.width, strip ? 600 : 1200, id);
    assert.equal(frame.height, 1800, id);
    assert.deepEqual(frame.slots, strip
      ? [30, 432, 834, 1236].map(y => ({ x: 30, y, w: 540, h: 380 }))
      : [[40, 40], [615, 40], [40, 825], [615, 825]]
        .map(([x, y]) => ({ x, y, w: 545, h: 755 })), id);
    assert.deepEqual(frame.caption, {
      text: 'PHOTOBOOTH · {date}',
      x: strip ? 300 : 600,
      y: strip ? 1700 : 1690,
      font: strip ? '600 32px sans-serif' : '600 56px sans-serif',
      color: id === 'strip-black' ? '#ffffff' : '#333333',
      align: 'center',
    }, id);
  }
});
