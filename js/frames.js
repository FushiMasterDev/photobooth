// Bố cục dùng chung: khung mới chỉ cần { ...STRIP hoặc ...GRID, id, name, background }.
export const STRIP = {
  layout: 'strip',
  width: 600,
  height: 1800,
  backgroundImage: null,
  overlayImage: null,
  slots: [
    { x: 30, y: 30, w: 540, h: 380 },
    { x: 30, y: 432, w: 540, h: 380 },
    { x: 30, y: 834, w: 540, h: 380 },
    { x: 30, y: 1236, w: 540, h: 380 },
  ],
  caption: {
    text: 'PHOTOBOOTH · {date}', x: 300, y: 1700,
    font: '600 40px sans-serif', color: '#333333', align: 'center',
  },
};

export const GRID = {
  layout: 'grid',
  width: 1200,
  height: 1800,
  backgroundImage: null,
  overlayImage: null,
  slots: [
    { x: 40, y: 40, w: 545, h: 755 },
    { x: 615, y: 40, w: 545, h: 755 },
    { x: 40, y: 825, w: 545, h: 755 },
    { x: 615, y: 825, w: 545, h: 755 },
  ],
  caption: {
    text: 'PHOTOBOOTH · {date}', x: 600, y: 1690,
    font: '600 56px sans-serif', color: '#333333', align: 'center',
  },
};

export const FRAMES = [
  { ...STRIP, id: 'strip-pink', name: 'Dải hồng', background: '#ffd6e0' },
  { ...STRIP, id: 'strip-black', name: 'Dải đen', background: '#111111', caption: { ...STRIP.caption, color: '#ffffff' } },
  { ...STRIP, id: 'strip-cream', name: 'Dải kem', background: '#f5efe6' },
  { ...GRID, id: 'grid-white', name: 'Lưới trắng', background: '#ffffff' },
  { ...GRID, id: 'grid-sky', name: 'Lưới xanh trời', background: '#cfe8ff' },
  { ...GRID, id: 'grid-lilac', name: 'Lưới tím nhạt', background: '#e3d7ff' },
];

export function slotAspect(frame) {
  return frame.slots[0].w / frame.slots[0].h;
}
