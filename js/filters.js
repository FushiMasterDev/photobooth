export const FILTERS = [
  { id: 'original', name: 'Gốc', params: {} },
  {
    id: 'clear', name: 'Trong trẻo',
    params: { exposure: 0.15, contrast: -0.08, saturation: 0.92, temperature: 0.02, tint: 0.04, fade: 0.04 },
  },
  {
    id: 'peach', name: 'Hồng đào',
    params: { exposure: 0.08, contrast: 0.05, saturation: 1.05, temperature: 0.25, tint: 0.15, fade: 0.03 },
  },
  {
    id: 'film', name: 'Film ấm',
    params: { exposure: 0.02, contrast: 0.12, saturation: 0.85, temperature: 0.35, fade: 0.1, vignette: 0.35, grain: 0.06 },
  },
  {
    id: 'cool', name: 'Mát lạnh',
    params: { exposure: 0.05, contrast: 0.08, saturation: 0.9, temperature: -0.35, tint: 0.05 },
  },
  {
    id: 'bw', name: 'Đen trắng',
    params: { saturation: 0, contrast: 0.25, fade: 0.03, vignette: 0.25, grain: 0.05 },
  },
  {
    id: 'vintage', name: 'Cổ điển',
    params: { contrast: -0.05, saturation: 0.6, temperature: 0.45, fade: 0.15, vignette: 0.4, grain: 0.08 },
  },
];

const DEFAULTS = {
  exposure: 0, contrast: 0, saturation: 1, temperature: 0, tint: 0, fade: 0, vignette: 0, grain: 0,
};
const filterCache = new WeakMap();
const vignetteCache = new Map();

function prepareFilter(filter) {
  if (filterCache.has(filter)) return filterCache.get(filter);
  const params = { ...DEFAULTS, ...filter.params };
  let tables = null;
  if (Object.keys(DEFAULTS).some(key => params[key] !== DEFAULTS[key])) {
    // Keep fractional values until the final write into Uint8ClampedArray.
    tables = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
    const exposure = 2 ** params.exposure;
    const shifts = [params.temperature * 0.1, -params.tint * 0.08, -params.temperature * 0.1];
    for (let c = 0; c < 256; c += 1) {
      let v = c / 255 * exposure;
      v = (v - 0.5) * (1 + params.contrast) + 0.5;
      v = params.fade + v * (1 - params.fade);
      for (let channel = 0; channel < 3; channel += 1) {
        tables[channel][c] = Math.max(0, Math.min(1, v + shifts[channel])) * 255;
      }
    }
  }
  const prepared = { params, tables };
  filterCache.set(filter, prepared);
  return prepared;
}

function vignetteFactors(width, height) {
  const key = `${width}x${height}`;
  if (!vignetteCache.has(key)) {
    const factors = new Float32Array(width * height);
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const halfDiagonal = Math.hypot(width, height) / 2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const d = Math.hypot(x - cx, y - cy) / halfDiagonal;
        const t = Math.max(0, Math.min(1, (d - 0.45) / (1 - 0.45)));
        // Cache the smoothstep weight so filters can share geometry at any strength.
        factors[y * width + x] = t * t * (3 - 2 * t);
      }
    }
    vignetteCache.set(key, factors);
  }
  return vignetteCache.get(key);
}

export function applyFilter(imageData, filter) {
  const { params, tables } = prepareFilter(filter);
  if (!tables) return imageData;
  const { data, width, height } = imageData;
  const { saturation, vignette, grain } = params;
  const factors = vignette ? vignetteFactors(width, height) : null;
  const [red, green, blue] = tables;
  for (let i = 0; i < data.length; i += 4) {
    let r = red[data[i]];
    let g = green[data[i + 1]];
    let b = blue[data[i + 2]];
    if (saturation !== 1) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * saturation;
      g = l + (g - l) * saturation;
      b = l + (b - l) * saturation;
    }
    if (factors) {
      const factor = 1 - vignette * factors[i / 4];
      r *= factor;
      g *= factor;
      b *= factor;
    }
    if (grain) {
      const noise = (Math.random() - 0.5) * grain * 255;
      r += noise;
      g += noise;
      b += noise;
    }
    // Clamp and round once; leave alpha unchanged.
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return imageData;
}
