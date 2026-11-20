// Optimize contours + Round XY (FontCreator-style) for canvas strokes. Pure functions.
import { rdpSimplify } from './rdpSimplifier.js';

export const OPT_LIMITS = { epsMin: 0.5, epsMax: 6, grids: [0, 1, 2, 5, 10] };

const same = (a, b) => a.x === b.x && a.y === b.y;

/** Total drawn points (ink strokes only). */
export function countPoints(glyphs) {
  let n = 0;
  if (!glyphs || typeof glyphs !== 'object') return 0;
  for (const strokes of Object.values(glyphs)) {
    if (!Array.isArray(strokes)) continue;
    for (const st of strokes) if (Array.isArray(st) && !(st[0] && st[0].isEraser)) n += st.length;
  }
  return n;
}

const dedupe = (pts) => pts.filter((p, i) => i === 0 || !same(p, pts[i - 1]));

/** Remove duplicate/redundant points (RDP, epsilon) and snap to a grid (0 = no snapping). */
export function optimizeStroke(stroke, epsilon, grid) {
  if (!Array.isArray(stroke) || stroke.length < 3 || (stroke[0] && stroke[0].isEraser)) return stroke;
  const eps = Math.max(OPT_LIMITS.epsMin, Math.min(OPT_LIMITS.epsMax, Number(epsilon) || 1.5));
  let pts = dedupe(stroke);
  pts = rdpSimplify(pts, eps);
  if (grid > 0) {
    const snapped = pts.map((p) => ({ ...p, x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid }));
    const d = dedupe(snapped);
    pts = d.length >= 2 ? d : [snapped[0], { ...snapped[0], x: snapped[0].x + Math.max(0.1, grid * 0.1) }];
  }
  if (pts.length < 2) pts = [stroke[0], { ...stroke[0], x: stroke[0].x + 0.1 }];   // a dot stays a dot
  return pts;
}

/** Optimize one character or the whole font → { glyphs, before, after, count }. */
export function optimizeGlyphs(glyphs, { epsilon = 1.5, grid = 0 } = {}, only = null) {
  if (!glyphs || typeof glyphs !== 'object') return { glyphs, before: 0, after: 0, count: 0 };
  const keys = only != null ? (glyphs[only] ? [only] : []) : Object.keys(glyphs);
  const out = { ...glyphs };
  let before = 0, after = 0, count = 0;
  for (const k of keys) {
    const strokes = glyphs[k];
    if (!Array.isArray(strokes) || !strokes.length) continue;
    const next = strokes.map((st) => optimizeStroke(st, epsilon, grid));
    before += countPoints({ [k]: strokes }); after += countPoints({ [k]: next });
    out[k] = next; count++;
  }
  return { glyphs: out, before, after, count };
}
