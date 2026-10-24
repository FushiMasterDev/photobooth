export const STICKERS = [
  { id: 'none', name: 'Không', emojis: [] },
  { id: 'hearts', name: 'Trái tim', emojis: ['💖', '💕', '💗'] },
  { id: 'sparkle', name: 'Lấp lánh', emojis: ['✨', '⭐', '🌟'] },
  { id: 'flowers', name: 'Hoa', emojis: ['🌸', '🌷', '🌼'] },
  { id: 'bears', name: 'Gấu', emojis: ['🧸', '🎀', '🍓'] },
];

// Each slot gets a big sticker on its outward corner and a small one on the same side,
// both tucked in so thin frame margins never clip them.
export function stickerPlacements(frame, set) {
  if (!set.emojis.length) return [];
  const placements = [];
  const fx = frame.width / 2;
  const fy = frame.height / 2;
  const place = (emoji, slot, left, top, size, angle) => ({
    emoji,
    x: left ? slot.x + size * 0.3 : slot.x + slot.w - size * 0.3,
    y: top ? slot.y + size * 0.3 : slot.y + slot.h - size * 0.3,
    size,
    angle,
  });
  frame.slots.forEach((slot, i) => {
    const cx = slot.x + slot.w / 2;
    // Single-column layouts alternate sides so stickers zigzag down the strip.
    const left = cx === fx ? i % 2 === 0 : cx < fx;
    const top = slot.y + slot.h / 2 <= fy;
    const angle = left ? -12 : 12;
    const min = Math.min(slot.w, slot.h);
    const emoji = k => set.emojis[(2 * i + k) % set.emojis.length];
    placements.push(place(emoji(0), slot, left, top, Math.round(min * 0.24), angle));
    placements.push(place(emoji(1), slot, left, !top, Math.round(min * 0.15), -angle));
  });
  if (frame.caption) {
    const size = Math.round(frame.width * 0.08);
    for (let k = 0; k < 2; k += 1) {
      placements.push({
        emoji: set.emojis[k % set.emojis.length],
        x: frame.caption.x + (k === 0 ? -1 : 1) * frame.width * 0.42,
        y: frame.caption.y - size * 0.35,
        size,
        angle: 0,
      });
    }
  }
  return placements;
}
