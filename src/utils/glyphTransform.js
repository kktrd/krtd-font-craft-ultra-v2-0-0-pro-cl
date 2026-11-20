// Glyph Transformer (FontCreator-style): scale / mirror / rotate / skew / move strokes.
// Pure geometry on canvas strokes ([[{x,y,strokeWidth,isEraser}]], 500×500 space). No DOM, no React.

export const CS = 500;

export const TRANSFORM_PRESETS = [
  { id: 'italic',    label: 'Italic 12°',   si: 'ඇල',       op: { skewX: 12 } },
  { id: 'oblique',   label: 'Oblique 8°',   si: 'ආනත',      op: { skewX: 8 } },
  { id: 'condensed', label: 'Condensed',    si: 'සිහින්',   op: { sx: 90 } },
  { id: 'extended',  label: 'Extended',     si: 'පළල්',     op: { sx: 110 } },
  { id: 'small',     label: 'Small caps 80%', si: 'කුඩා',   op: { sx: 80, sy: 80 } },
  { id: 'flipH',     label: 'Mirror ↔',     si: 'දර්පණ ↔',  op: { mirrorH: true } },
  { id: 'flipV',     label: 'Flip ↕',       si: 'දර්පණ ↕',  op: { mirrorV: true } },
];

export const DEFAULT_OP = { sx: 100, sy: 100, rot: 0, skewX: 0, dx: 0, dy: 0, mirrorH: false, mirrorV: false, scaleWidth: true };

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Clean a user-supplied operation (never throws, bounded values). */
export function normalizeOp(op) {
  const o = { ...DEFAULT_OP, ...(op || {}) };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return {
    sx: clamp(num(o.sx, 100), 10, 400), sy: clamp(num(o.sy, 100), 10, 400),
    rot: clamp(num(o.rot, 0), -180, 180), skewX: clamp(num(o.skewX, 0), -45, 45),
    dx: clamp(num(o.dx, 0), -CS, CS), dy: clamp(num(o.dy, 0), -CS, CS),
    mirrorH: !!o.mirrorH, mirrorV: !!o.mirrorV, scaleWidth: o.scaleWidth !== false,
  };
}

export const isIdentity = (op) => {
  const o = normalizeOp(op);
  return o.sx === 100 && o.sy === 100 && o.rot === 0 && o.skewX === 0 && o.dx === 0 && o.dy === 0 && !o.mirrorH && !o.mirrorV;
};

/** Bounding box of every point, or null. */
export function strokesBBox(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  if (!Array.isArray(strokes)) return null;
  for (const st of strokes) {
    if (!Array.isArray(st)) continue;
    for (const p of st) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/**
 * Apply an operation to one glyph. Order: scale → mirror → rotate → skew → move.
 * Scale/mirror/skew pivot on (glyph centre-x, baseline) so letters stay on the baseline;
 * rotation pivots on the glyph centre. Result is kept inside the canvas; `clipped` counts moved points.
 */
export function transformStrokes(strokes, op, baseline) {
  const o = normalizeOp(op);
  const box = strokesBBox(strokes);
  if (!box || isIdentity(o)) return { strokes, clipped: 0 };
  const B = Number.isFinite(baseline) ? baseline : box.y1;
  const sx = (o.sx / 100) * (o.mirrorH ? -1 : 1);
  const sy = (o.sy / 100) * (o.mirrorV ? -1 : 1);
  const wScale = o.scaleWidth ? (Math.abs(sx) + Math.abs(sy)) / 2 : 1;
  const th = (o.rot * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const k = Math.tan((o.skewX * Math.PI) / 180);
  let clipped = 0;
  const cl = (v) => { const c = Math.max(0, Math.min(CS, v)); if (c !== v) clipped++; return c; };
  const out = strokes.map((st) => (Array.isArray(st) ? st.map((p) => {
    let x = box.cx + (p.x - box.cx) * sx;
    let y = B + (p.y - B) * sy;
    const rx = x - box.cx, ry = y - box.cy;                 // rotate about the glyph centre
    x = box.cx + rx * cos + ry * sin;
    y = box.cy - rx * sin + ry * cos;
    x += k * (B - y);                                       // skew about the baseline
    x += o.dx; y += o.dy;
    const q = { ...p, x: Math.round(cl(x) * 100) / 100, y: Math.round(cl(y) * 100) / 100 };
    if (!p.isEraser && Number.isFinite(p.strokeWidth)) q.strokeWidth = Math.max(2, Math.round(p.strokeWidth * wScale * 10) / 10);
    return q;
  }) : st));
  return { strokes: out, clipped };
}

/** Apply to one character or to the whole font. Returns { glyphs, count, clipped }. */
export function transformGlyphs(glyphs, op, baseline, only = null) {
  if (!glyphs || typeof glyphs !== 'object' || isIdentity(op)) return { glyphs, count: 0, clipped: 0 };
  const keys = only != null ? (glyphs[only] ? [only] : []) : Object.keys(glyphs);
  const out = { ...glyphs };
  let count = 0, clipped = 0;
  for (const k of keys) {
    if (!Array.isArray(glyphs[k]) || !glyphs[k].length) continue;
    const r = transformStrokes(glyphs[k], op, baseline);
    out[k] = r.strokes; clipped += r.clipped; count++;
  }
  return { glyphs: out, count, clipped };
}
