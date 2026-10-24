import test from 'node:test';
import assert from 'node:assert/strict';
import { FRAMES } from '../js/frames.js';
import { STICKERS, stickerPlacements } from '../js/stickers.js';

const hearts = STICKERS.find(set => set.id === 'hearts');

const box = ({ x, y, size }) => ({ l: x - size / 2, r: x + size / 2, t: y - size / 2, b: y + size / 2 });

test('every frame has 10 heart stickers fully inside its canvas', () => {
  for (const frame of FRAMES) {
    const placements = stickerPlacements(frame, hearts);
    assert.equal(placements.length, 10, frame.id);
    for (const p of placements) {
      const { l, r, t, b } = box(p);
      assert.ok(l >= 0 && r <= frame.width && t >= 0 && b <= frame.height, `${frame.id} ${JSON.stringify(p)}`);
    }
  }
});

test('stickers do not pile onto each other', () => {
  for (const frame of FRAMES) {
    const placements = stickerPlacements(frame, hearts);
    placements.forEach((a, i) => placements.slice(i + 1).forEach(b => {
      // Small corner overlap is fine; centers must stay ~a sticker apart.
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 0.9 * (a.size + b.size) / 2, `${frame.id} ${a.emoji}@${a.x},${a.y} vs ${b.x},${b.y}`);
    }));
  }
});

test('caption stickers stay clear of the caption text', () => {
  for (const frame of FRAMES) {
    // Generous text width estimate: 0.6 em per character.
    const size = Number(frame.caption.font.match(/(\d+)px/)[1]);
    const half = frame.caption.text.replace('{date}', '00.00.0000').length * size * 0.6 / 2;
    for (const p of stickerPlacements(frame, hearts).slice(8)) {
      const { l, r } = box(p);
      assert.ok(r <= frame.caption.x - half || l >= frame.caption.x + half, `${frame.id} ${p.x}`);
    }
  }
});

test('none gives no stickers', () => {
  const none = STICKERS.find(set => set.id === 'none');
  for (const frame of FRAMES) {
    assert.deepEqual(stickerPlacements(frame, none), []);
  }
});

test('first strip sticker is the big one tucked into the top-left corner', () => {
  const frame = FRAMES.find(frame => frame.layout === 'strip');
  const size = Math.round(380 * 0.24);
  assert.deepEqual(stickerPlacements(frame, hearts)[0], {
    emoji: '💖', x: 30 + size * 0.3, y: 30 + size * 0.3, size, angle: -12,
  });
});

test('grid big stickers sit on the outer corners', () => {
  const frame = FRAMES.find(frame => frame.layout === 'grid');
  const big = stickerPlacements(frame, hearts).filter((_, i) => i < 8 && i % 2 === 0);
  const corner = p => [p.x < frame.width / 2 ? 'L' : 'R', p.y < frame.height / 2 ? 'T' : 'B'].join('');
  assert.deepEqual(big.map(corner), ['LT', 'RT', 'LB', 'RB']);
});

test('sticker placements are deterministic', () => {
  for (const frame of FRAMES) {
    for (const set of STICKERS) {
      assert.deepEqual(stickerPlacements(frame, set), stickerPlacements(frame, set));
    }
  }
});

test('caption stickers are omitted without a caption', () => {
  const frame = FRAMES.find(frame => frame.layout === 'strip');
  assert.equal(stickerPlacements({ ...frame, caption: null }, hearts).length, 8);
});

test('sticker sets have the specified ids, Vietnamese names and emojis', () => {
  assert.deepEqual(STICKERS, [
    { id: 'none', name: 'Không', emojis: [] },
    { id: 'hearts', name: 'Trái tim', emojis: ['💖', '💕', '💗'] },
    { id: 'sparkle', name: 'Lấp lánh', emojis: ['✨', '⭐', '🌟'] },
    { id: 'flowers', name: 'Hoa', emojis: ['🌸', '🌷', '🌼'] },
    { id: 'bears', name: 'Gấu', emojis: ['🧸', '🎀', '🍓'] },
  ]);
});
