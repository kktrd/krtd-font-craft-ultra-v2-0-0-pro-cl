// Optical auto-spacing: round / pointed letters carry more white space inside their bounding box than
// straight ones, so they get a little less bearing (and straight ones a little more). Pure.
import { inkProfile, isMarkCode, isSpacingSign } from './gposWriter.js';
import { SPACING_LIMITS } from './spacing.js';

const STRENGTH = 0.4;
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const label = (g) => (g.sequence ? String.fromCodePoint(...g.sequence) : String.fromCodePoint(g.unicode));
const snap = (v) => {
  const st = SPACING_LIMITS.step;
  return Math.max(SPACING_LIMITS.min, Math.min(SPACING_LIMITS.max, Math.round(v / st) * st));
};

/** Mean white-space depth (font units) between the bounding box edge and the ink, left and right. */
export function edgeDepths(contours) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  contours.forEach((c) => c.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }));
  if (x0 === Infinity || y1 - y0 < 1) return null;
  const bands = inkProfile(contours, Math.floor(y0 / 25) * 25, Math.ceil(y1 / 25) * 25).filter(Boolean);
  if (!bands.length) return null;
  const dl = bands.reduce((s, b) => s + (b[0] - x0), 0) / bands.length;
  const dr = bands.reduce((s, b) => s + (x1 - b[1]), 0) / bands.length;
  return { dl, dr };
}

/** model.glyphs → { [char]: { l, r } } (only non-zero), relative to the font's median glyph. */
export function autoSpacing(modelGlyphs) {
  const rows = [];
  modelGlyphs.forEach((g, i) => {
    if (i === 0 || g.unicode == null || g.unicode === 32 || !g.contours.length) return;
    if (isMarkCode(g.unicode) || isSpacingSign(g.unicode) || g.unicode === 0x200d) return;
    const d = edgeDepths(g.contours);
    if (d) rows.push({ key: label(g), ...d });
  });
  if (rows.length < 3) return {};
  const mL = median(rows.map((r) => r.dl)), mR = median(rows.map((r) => r.dr));
  const out = {};
  rows.forEach((r) => {
    const l = snap(-(r.dl - mL) * STRENGTH), rr = snap(-(r.dr - mR) * STRENGTH);
    if (l !== 0 || rr !== 0) out[r.key] = { l, r: rr };
  });
  return out;
}
