// Weight templates: standard stroke weights (Thin → Extra Bold) that set the pen and can
// re-weight every stroke already drawn. Pure data + helpers (no DOM, no React).
import { WIDTH_MIN, WIDTH_MAX } from './brushPresets.js';

export const WEIGHTS = [
  { id: 'thin',    label: 'Thin',       si: 'තුනී',        width: 6 },
  { id: 'light',   label: 'Light',      si: 'සියුම්',      width: 10 },
  { id: 'regular', label: 'Regular',    si: 'සාමාන්‍ය',    width: 14 },
  { id: 'bold',    label: 'Bold',       si: 'ඝන',          width: 22 },
  { id: 'xbold',   label: 'Extra Bold', si: 'අති ඝන',      width: 32 },
];

export const TYPES = [
  { id: 'calligraphy', label: 'Calligraphy', si: 'කැලිග්‍රැෆි' },
  { id: 'tapered',     label: 'Tapered',     si: 'තුඩු' },
  { id: 'uniform',     label: 'Monoline',    si: 'ඒකාකාර' },
];

const POINT_MAX = Math.round(WIDTH_MAX * 1.6);   // tapered / pressure strokes may exceed the nominal size

const isInk = (pt) => pt && !pt.isEraser && Number.isFinite(pt.strokeWidth) && pt.strokeWidth > 0;

/** Average ink width over every (non-eraser) point of the given glyph map. 0 when there is no ink. */
export function meanWidth(glyphs) {
  let sum = 0; let n = 0;
  if (!glyphs || typeof glyphs !== 'object') return 0;
  for (const strokes of Object.values(glyphs)) {
    if (!Array.isArray(strokes)) continue;
    for (const st of strokes) {
      if (!Array.isArray(st)) continue;
      for (const pt of st) if (isInk(pt)) { sum += pt.strokeWidth; n++; }
    }
  }
  return n ? sum / n : 0;
}

/** The standard weight closest to a width. */
export function nearestWeight(width) {
  let best = WEIGHTS[0];
  for (const w of WEIGHTS) if (Math.abs(w.width - width) < Math.abs(best.width - width)) best = w;
  return best;
}

const scaleStrokes = (strokes, factor) => strokes.map((st) => (
  Array.isArray(st) && !(st[0] && st[0].isEraser)
    ? st.map((pt) => (isInk(pt)
      ? { ...pt, strokeWidth: Math.max(WIDTH_MIN, Math.min(POINT_MAX, Math.round(pt.strokeWidth * factor * 10) / 10)) }
      : pt))
    : st));

/**
 * Re-weight drawn strokes so their average width equals `target`, keeping each stroke's own
 * taper/pressure shape (one common factor). `only` limits it to one character.
 * Returns { glyphs, count, factor } — glyphs is the same object when nothing changed.
 */
export function reweightGlyphs(glyphs, target, only = null) {
  const t = Number(target);
  if (!glyphs || !Number.isFinite(t) || t <= 0) return { glyphs, count: 0, factor: 1 };
  const keys = only != null ? (glyphs[only] ? [only] : []) : Object.keys(glyphs);
  const scope = {};
  for (const k of keys) scope[k] = glyphs[k];
  const mean = meanWidth(scope);
  if (!mean) return { glyphs, count: 0, factor: 1 };
  const factor = t / mean;
  const out = { ...glyphs };
  let count = 0;
  for (const k of keys) {
    if (!Array.isArray(glyphs[k]) || !glyphs[k].length) continue;
    out[k] = scaleStrokes(glyphs[k], factor);
    count++;
  }
  return { glyphs: out, count, factor };
}
