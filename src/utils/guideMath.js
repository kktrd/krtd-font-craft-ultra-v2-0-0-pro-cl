/**
 * Shape Guide — pure maths (no DOM). Everything here is unit-tested in Node.
 * Coordinates: canvas space is 500x500, y-down. "ref space" = text origin at the
 * font baseline, measured at REF_SIZE.
 */
export const CS = 500;
export const REF_SIZE = 100;

const FALLBACK = '"Iskoola Pota","Nirmala UI","Sinhala MN","Sinhala Sangam MN",sans-serif';
export const GUIDE_STYLES = [
  { id: 'sans',    label: 'Sans',    family: 'Noto Sans Sinhala' },
  { id: 'serif',   label: 'Serif',   family: 'Noto Serif Sinhala' },
  { id: 'classic', label: 'Classic', family: 'Abhaya Libre' },
  { id: 'soft',    label: 'Soft',    family: 'Yaldevi' },
  { id: 'modern',  label: 'Modern',  family: 'Gemunu Libre' },
];
const STYLE_IDS = GUIDE_STYLES.map((s) => s.id);

export function fontStack(styleId) {
  const s = GUIDE_STYLES.find((x) => x.id === styleId) || GUIDE_STYLES[0];
  return `"${s.family}","Noto Sans Sinhala",${FALLBACK}`;
}

export const ANCHOR_CHARS = ['ක', 'ම', 'න', 'ර', 'ය'];

export const GUIDE_LIMITS = {
  scale:   { min: 0.4, max: 2.2, step: 0.02 },   // per-letter
  dx:      { min: -250, max: 250, step: 1 },
  dy:      { min: -250, max: 250, step: 1 },
  rot:     { min: -45,  max: 45,  step: 1 },
  gscale:  { min: 0.5,  max: 2,   step: 0.02 },  // global (all letters)
  gdy:     { min: -150, max: 150, step: 1 },
  weight:  { min: 1,    max: 8,   step: 0.5 },
  opacity: { min: 0.15, max: 1,   step: 0.05 },
};

const num = (v, d) => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (v, k) => Math.min(GUIDE_LIMITS[k].max, Math.max(GUIDE_LIMITS[k].min, v));
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

export function defaultSettings() {
  return { style: 'sans', snap: false, dashed: true, order: false, meter: true, compare: false,
           weight: 2, opacity: 0.6, gscale: 1, gdy: 0 };
}
export function defaultAdj() { return { scale: 1, dx: 0, dy: 0, rot: 0 }; }

/** Global (all-letter) settings. Never trusts the input (it may come from localStorage). */
export function clampSettings(s) {
  const d = defaultSettings(), src = s && typeof s === 'object' ? s : {};
  return {
    style: STYLE_IDS.includes(src.style) ? src.style : d.style,
    snap: bool(src.snap, d.snap), dashed: bool(src.dashed, d.dashed), order: bool(src.order, d.order),
    meter: bool(src.meter, d.meter), compare: bool(src.compare, d.compare),
    weight: clamp(num(src.weight, d.weight), 'weight'), opacity: clamp(num(src.opacity, d.opacity), 'opacity'),
    gscale: clamp(num(src.gscale, d.gscale), 'gscale'), gdy: clamp(num(src.gdy, d.gdy), 'gdy'),
  };
}

/** Per-letter adjustments. */
export function clampAdj(a) {
  const d = defaultAdj(), src = a && typeof a === 'object' ? a : {};
  return { scale: clamp(num(src.scale, d.scale), 'scale'), dx: clamp(num(src.dx, d.dx), 'dx'),
           dy: clamp(num(src.dy, d.dy), 'dy'), rot: clamp(num(src.rot, d.rot), 'rot') };
}

/** Sanitise the whole persisted preset {settings, adj:{char:adj}}. */
export function clampPreset(p) {
  const src = p && typeof p === 'object' ? p : {};
  const adj = {};
  if (src.adj && typeof src.adj === 'object') {
    for (const k of Object.keys(src.adj).slice(0, 400)) if ([...k].length === 1) adj[k] = clampAdj(src.adj[k]);
  }
  return { settings: clampSettings(src.settings), adj, on: bool(src.on, false) };
}

/** Flat params used for drawing = global settings + this letter's adjustments. */
export function mergeParams(settings, adj) {
  const S = clampSettings(settings), A = clampAdj(adj);
  return { ...S, scale: S.gscale * A.scale, dx: A.dx, dy: A.dy + S.gdy, rot: A.rot };
}

/** "Fit" mode: centre the ink box in the ascender..descender band. */
export function autoFitGuide(bbox, metrics) {
  const w = Math.max(1, num(bbox && bbox.left, 0) + num(bbox && bbox.right, 0));
  const h = Math.max(1, num(bbox && bbox.ascent, 0) + num(bbox && bbox.descent, 0));
  const top = num(metrics && metrics.ascender, 80), bottom = num(metrics && metrics.descender, 450);
  const bandH = Math.max(60, bottom - top);
  const k = Math.min((CS - 120) / w, (bandH * 0.85) / h);
  return { fontSize: Math.max(20, Math.min(400, REF_SIZE * k)), cx: CS / 2, cy: (top + bottom) / 2, k };
}

/**
 * "Metrics" mode: ONE scale for every letter (the anchor ක fills x-height..baseline),
 * sitting on the baseline — so all guides share size & baseline.
 */
export function snapFitGuide(refBox, bbox, metrics) {
  const refH = Math.max(1, num(refBox && refBox.ascent, 0) + num(refBox && refBox.descent, 0));
  const w = Math.max(1, num(bbox && bbox.left, 0) + num(bbox && bbox.right, 0));
  const baseline = num(metrics && metrics.baseline, 380), xh = num(metrics && metrics.xHeight, 240);
  const bodyH = Math.max(40, baseline - xh);
  let s = bodyH / refH;
  s = Math.min(s, (CS - 80) / w);
  s = Math.max(0.2, Math.min(4, s));
  return { s, cx: CS / 2, baseY: baseline };
}

/**
 * Placement of the guide: canvas = translate(tx,ty) · rotate · scale(s) · translate(-icx,-icy).
 * bbox/refBox = {left,right,ascent,descent} measured at REF_SIZE.
 */
export function placeGuide(bbox, refBox, params, metrics) {
  const icx = (bbox.right - bbox.left) / 2;
  if (params.snap) {
    const f = snapFitGuide(refBox || bbox, bbox, metrics);
    return { s: f.s * params.scale, tx: f.cx + params.dx, ty: f.baseY + params.dy, icx, icy: 0 };
  }
  const f = autoFitGuide(bbox, metrics);
  return { s: (f.fontSize / REF_SIZE) * params.scale, tx: f.cx + params.dx, ty: f.cy + params.dy,
           icx, icy: (bbox.descent - bbox.ascent) / 2 };
}

/** Axis-aligned ink box in canvas space (rotation ignored). */
export function placedBox(bbox, pl) {
  return {
    minx: pl.tx + pl.s * (-bbox.left - pl.icx), maxx: pl.tx + pl.s * (bbox.right - pl.icx),
    miny: pl.ty + pl.s * (-bbox.ascent - pl.icy), maxy: pl.ty + pl.s * (bbox.descent - pl.icy),
  };
}

// ── Piece (stroke-group) order ───────────────────────────────────────────────
/** Connected components (8-neighbour) of a binary mask. */
export function labelComponents(mask, w, h) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h), pieces = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    let sp = 0, area = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    let best = Infinity, bx = 0, by = 0;
    stack[sp++] = i; seen[i] = 1;
    while (sp) {
      const p = stack[--sp], x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const k = y + x * 0.25;                       // prefer top (then left) as the start point
      if (k < best) { best = k; bx = x; by = y; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (mask[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
      }
    }
    pieces.push({ area, cx: sx / area, cy: sy / area, minx, maxx, miny, maxy, startX: bx, startY: by });
  }
  return pieces;
}

/** Writing order estimate: biggest piece (the body) first, then marks left→right, top→bottom. */
export function orderPieces(pieces, max = 6) {
  if (!pieces.length) return [];
  const big = Math.max(...pieces.map((p) => p.area));
  const keep = pieces.filter((p) => p.area >= big * 0.01);
  const main = keep.reduce((a, b) => (b.area > a.area ? b : a));
  const rest = keep.filter((p) => p !== main).sort((a, b) => a.cx - b.cx || a.cy - b.cy);
  return [main, ...rest].slice(0, max).map((p, i) => ({ ...p, n: i + 1 }));
}

// ── Similarity (accuracy meter) ──────────────────────────────────────────────
function dilate(mask, w, h, r) {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r) && !v; k++) v = mask[y * w + k];
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r) && !v; k++) v = tmp[k * w + x];
    out[y * w + x] = v;
  }
  return out;
}

/**
 * How close the drawn ink B is to the guide shape A (both binary masks).
 * precision = share of B near A, recall = share of A near B; score = F1 in %.
 * Returns null when either mask is empty.
 */
export function similarity(A, B, w, h, r = 4) {
  let sa = 0, sb = 0;
  for (let i = 0; i < w * h; i++) { sa += A[i] ? 1 : 0; sb += B[i] ? 1 : 0; }
  if (!sa || !sb) return null;
  const dA = dilate(A, w, h, r), dB = dilate(B, w, h, r);
  let pb = 0, ra = 0;
  for (let i = 0; i < w * h; i++) { if (B[i] && dA[i]) pb++; if (A[i] && dB[i]) ra++; }
  const P = pb / sb, R = ra / sa;
  const F = P + R ? (2 * P * R) / (P + R) : 0;
  return { score: Math.round(F * 100), precision: Math.round(P * 100), recall: Math.round(R * 100) };
}

// ── Style match ─────────────────────────────────────────────────────────────
export function strokesBox(strokes) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, n = 0;
  for (const st of strokes || []) {
    if (!Array.isArray(st) || st[0]?.isEraser) continue;
    for (const p of st) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      n++;
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x; if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
    }
  }
  return n >= 2 ? { minx, maxx, miny, maxy } : null;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** pairs = [{ drawn:box, guide:box }] → size ratio (guide→drawn), clamped. null if no data. */
export function matchRatio(pairs) {
  const r = pairs.filter((p) => p.drawn && p.guide).map((p) => {
    const rh = (p.drawn.maxy - p.drawn.miny) / Math.max(1, p.guide.maxy - p.guide.miny);
    const rw = (p.drawn.maxx - p.drawn.minx) / Math.max(1, p.guide.maxx - p.guide.minx);
    return Math.sqrt(Math.max(0.01, rh) * Math.max(0.01, rw));
  });
  return r.length ? Math.min(2, Math.max(0.5, median(r))) : null;
}
/** Vertical shift (canvas px) that moves guide centres onto the drawn centres. */
export function matchShift(pairs) {
  const d = pairs.filter((p) => p.drawn && p.guide).map((p) => (p.drawn.miny + p.drawn.maxy) / 2 - (p.guide.miny + p.guide.maxy) / 2);
  return d.length ? median(d) : null;
}
