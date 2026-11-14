// Brush presets: pure data + helpers (no DOM, no React).
// A preset is just a brush mode + a stroke width, so it works with the existing brush engine.

export const BRUSH_MODES = ['calligraphy', 'tapered', 'uniform'];
export const WIDTH_MIN = 2;
export const WIDTH_MAX = 48;
export const CUSTOM_KEY = 'krtd_brush_palette_v1';
export const MAX_CUSTOM = 8;

export const BRUSH_PRESETS = [
  { id: 'fine-nib',    group: 'nib',   label: 'Fine nib',    si: 'සියුම් පෙන්',   mode: 'calligraphy', width: 8,  hint: 'Thin calligraphy pen' },
  { id: 'classic-nib', group: 'nib',   label: 'Classic nib', si: 'සාමාන්‍ය පෙන්', mode: 'calligraphy', width: 14, hint: 'Everyday calligraphy pen' },
  { id: 'broad-nib',   group: 'nib',   label: 'Broad nib',   si: 'පළල් පෙන්',     mode: 'calligraphy', width: 24, hint: 'Bold calligraphy pen' },
  { id: 'fine-brush',  group: 'brush', label: 'Fine brush',  si: 'සියුම් බ්‍රෂ්',  mode: 'tapered',     width: 9,  hint: 'Thin tapered brush' },
  { id: 'ink-brush',   group: 'brush', label: 'Ink brush',   si: 'තීන්ත බ්‍රෂ්',   mode: 'tapered',     width: 16, hint: 'Classic ink brush' },
  { id: 'heavy-brush', group: 'brush', label: 'Heavy brush', si: 'ඝන බ්‍රෂ්',      mode: 'tapered',     width: 28, hint: 'Heavy tapered brush' },
  { id: 'mono-thin',   group: 'mono',  label: 'Mono thin',   si: 'තුනී ඒකාකාර',   mode: 'uniform',     width: 6,  hint: 'Thin even line' },
  { id: 'mono-regular',group: 'mono',  label: 'Mono regular',si: 'ඒකාකාර',         mode: 'uniform',     width: 12, hint: 'Regular even line' },
  { id: 'mono-bold',   group: 'mono',  label: 'Mono bold',   si: 'ඝන ඒකාකාර',     mode: 'uniform',     width: 20, hint: 'Bold even line' },
  { id: 'marker',      group: 'mono',  label: 'Marker',      si: 'මාකර්',          mode: 'uniform',     width: 32, hint: 'Wide marker' },
];

export const BRUSH_GROUPS = [
  { id: 'nib',   label: 'PEN NIBS',  si: 'පෙන්' },
  { id: 'brush', label: 'BRUSHES',   si: 'බ්‍රෂ්' },
  { id: 'mono',  label: 'MONOLINE',  si: 'ඒකාකාර' },
];

const clampWidth = (w) => {
  const n = Math.round(Number(w));
  if (!Number.isFinite(n)) return null;
  return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, n));
};

/** Find the preset equal to the current brush (or null). */
export function matchPreset(mode, width, list = BRUSH_PRESETS) {
  return list.find((p) => p.mode === mode && p.width === width) || null;
}

const cleanLabel = (s, fallback) => {
  const t = String(s == null ? '' : s)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 24);
  return t || fallback;
};

const customId = (mode, width) => `c-${mode}:${width}`;

/** Validate whatever came from storage. Never throws, never returns bad data. */
export function sanitizeCustom(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    if (!BRUSH_MODES.includes(it.mode)) continue;
    const width = clampWidth(it.width);
    if (width == null) continue;
    const id = customId(it.mode, width);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, group: 'custom', label: cleanLabel(it.label, `${it.mode} ${width}`), mode: it.mode, width, custom: true });
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

/** Add the current brush to the custom list (ignores duplicates / built-in matches / overflow). */
export function addCustom(list, mode, width, label) {
  const base = sanitizeCustom(list);
  if (!BRUSH_MODES.includes(mode)) return base;
  const w = clampWidth(width);
  if (w == null) return base;
  if (matchPreset(mode, w)) return base;
  if (base.some((p) => p.mode === mode && p.width === w)) return base;
  if (base.length >= MAX_CUSTOM) return base;
  return base.concat({
    id: customId(mode, w), group: 'custom', mode, width: w, custom: true,
    label: cleanLabel(label, `${mode} ${w}`),
  });
}

export function removeCustom(list, id) {
  return sanitizeCustom(list).filter((p) => p.id !== id);
}

/**
 * Closed polygon (array of [x,y]) showing how a stroke of this mode/width looks,
 * for a w×h swatch. Thickness is scaled to fit the swatch.
 */
export function previewPolygonPoints(mode, width, w = 60, h = 24) {
  const pad = 4;
  const maxT = h - 4;
  const base = Math.max(1.5, Math.min(maxT, Number(width) * 0.5));
  const n = 24;
  const top = [];
  const bot = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = pad + u * (w - pad * 2);
    let t = base;
    if (mode === 'tapered') t = Math.max(0.8, base * Math.sin(Math.PI * u) ** 0.7);
    else if (mode === 'calligraphy') t = Math.max(1.2, base * (0.45 + 0.55 * Math.abs(Math.sin(u * Math.PI * 2 + 0.6))));
    t = Math.min(t, maxT);
    const amp = Math.min(h * 0.12, Math.max(0, (h - t) / 2 - 0.5));
    const cy = h / 2 + Math.sin(u * Math.PI * 2) * amp;
    top.push([x, cy - t / 2]);
    bot.push([x, cy + t / 2]);
  }
  return top.concat(bot.reverse());
}

export function previewPolygon(mode, width, w = 60, h = 24) {
  return previewPolygonPoints(mode, width, w, h)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

/** Next / previous preset in the combined list (presets then custom). No current match: first (forward) / last (back). */
export function stepPreset(mode, width, dir, list = BRUSH_PRESETS) {
  if (!list.length) return null;
  const i = list.findIndex((p) => p.mode === mode && p.width === width);
  if (i < 0) return dir > 0 ? list[0] : list[list.length - 1];
  return list[(i + (dir > 0 ? 1 : -1) + list.length) % list.length];
}
