// Input hardening: everything that enters the app from outside (backup files, cloud rows, localStorage,
// realtime collaborators) is rebuilt through these functions — types, ranges and sizes are enforced,
// unknown fields and prototype-pollution keys are dropped. Pure functions, no DOM.

export const LIMITS = {
  maxGlyphs: 400, maxKeyLen: 8, maxStrokes: 600, maxPointsPerStroke: 6000, maxPointsPerGlyph: 40000,
  coord: [0, 500], width: [1, 120], metric: [0, 500], nameLen: 60,
};
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const num = (v, [a, b], d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };

/** One character key: short, printable, not a prototype key. */
export const isSafeGlyphKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= LIMITS.maxKeyLen
  && !BAD_KEYS.has(k) && !/[\u0000-\u001F\u007F]/.test(k);

/** Strokes of one glyph → clean strokes ([] when the input is not usable). Never throws. */
export function sanitizeStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  const out = []; let total = 0;
  for (const st of strokes.slice(0, LIMITS.maxStrokes)) {
    if (!Array.isArray(st)) continue;
    const pts = [];
    for (const p of st.slice(0, LIMITS.maxPointsPerStroke)) {
      if (!p || typeof p !== 'object') continue;
      const x = Number(p.x), y = Number(p.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push({ x: num(x, LIMITS.coord, 0), y: num(y, LIMITS.coord, 0), isEraser: p.isEraser === true, strokeWidth: num(p.strokeWidth, LIMITS.width, 14) });
    }
    if (!pts.length) continue;
    total += pts.length;
    if (total > LIMITS.maxPointsPerGlyph) break;
    out.push(pts);
  }
  return out;
}

/** Whole glyph map → clean glyph map (own keys only, bounded). */
export function sanitizeGlyphs(glyphs) {
  const out = {};
  if (!glyphs || typeof glyphs !== 'object' || Array.isArray(glyphs)) return out;
  let n = 0;
  for (const k of Object.keys(glyphs)) {
    if (!isSafeGlyphKey(k)) continue;
    if (++n > LIMITS.maxGlyphs) break;
    const s = sanitizeStrokes(glyphs[k]);
    if (s.length) out[k] = s;
  }
  return out;
}

/** Metrics object → numbers only, bounded, unknown keys dropped. */
export function sanitizeMetrics(m, defaults) {
  const out = { ...defaults };
  if (!m || typeof m !== 'object') return out;
  for (const k of Object.keys(defaults)) if (k in m) out[k] = num(m[k], LIMITS.metric, defaults[k]);
  return out;
}

/** Font / family name: printable text only, no markup characters. */
export function sanitizeFontName(s, fallback = 'KRTD-FontCraft-Pro') {
  const t = String(s == null ? '' : s).normalize('NFC').replace(/[\u0000-\u001F\u007F<>&"'`\\/]/g, '').trim().slice(0, LIMITS.nameLen);
  return t || fallback;
}

/** XML text/attribute escaping for generated SVG. */
export const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
