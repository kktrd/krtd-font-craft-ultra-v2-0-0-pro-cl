/**
 * Shape Guide — canvas drawing layer. Tracing aid only: drawn on a SEPARATE overlay
 * canvas; never written to glyph data, history, cloud or exports.
 * Pure maths lives in guideMath.js.
 */
import {
  CS, REF_SIZE, ANCHOR_CHARS, fontStack, placeGuide, placedBox, labelComponents, orderPieces,
  similarity, strokesBox, matchRatio, matchShift, mergeParams, clampSettings,
} from './guideMath.js';

export * from './guideMath.js';

const refFont = (style) => `${REF_SIZE}px ${fontStack(style)}`;

function measure(ctx, ch, style) {
  ctx.save(); ctx.font = refFont(style); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(ch);
  const b = {
    left: m.actualBoundingBoxLeft || 0, right: m.actualBoundingBoxRight || m.width || REF_SIZE * 0.6,
    ascent: m.actualBoundingBoxAscent || REF_SIZE * 0.8, descent: m.actualBoundingBoxDescent || REF_SIZE * 0.2,
  };
  ctx.restore();
  return b;
}

/** Layout of the guide for a letter: { bbox, pl (placement), box (canvas ink box) } */
export function guideLayout(ctx, ch, p, metrics) {
  const bbox = measure(ctx, ch, p.style);
  const refBox = p.snap ? measure(ctx, 'ක', p.style) : null;
  const pl = placeGuide(bbox, refBox, p, metrics);
  return { bbox, pl, box: placedBox(bbox, pl) };
}

function applyPlacement(ctx, pl, rotDeg) {
  ctx.translate(pl.tx, pl.ty);
  ctx.rotate(((rotDeg || 0) * Math.PI) / 180);
  ctx.scale(pl.s, pl.s);
  ctx.translate(-pl.icx, -pl.icy);
}

// ── Font support check ──────────────────────────────────────────────────────
function signature(ch, style) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.font = `48px ${fontStack(style)}`; x.textBaseline = 'middle'; x.fillText(ch, 6, 32);
  const d = x.getImageData(0, 0, 64, 64).data;
  let s = 0; for (let i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) | 0;
  return s;
}
/** false when no installed / loaded font can draw the char (would show an empty box). */
export function guideSupported(ch, style = 'sans') {
  try {
    if (typeof document === 'undefined') return true;
    return signature(ch, style) !== signature('෿', style); // U+0DFF is unassigned → notdef/blank
  } catch { return true; }
}

// ── Piece order (cached; clear after a web font finishes loading) ───────────
const pieceCache = new Map();
export function clearGuideCache() { pieceCache.clear(); }

export function guidePieces(ch, style) {
  const key = `${style}|${ch}`;
  if (pieceCache.has(key)) return pieceCache.get(key);
  const R = 160;
  const c = document.createElement('canvas'); const x0 = c.getContext('2d', { willReadFrequently: true });
  x0.font = `${R}px ${fontStack(style)}`;
  const m = x0.measureText(ch);
  const left = m.actualBoundingBoxLeft || 0, asc = m.actualBoundingBoxAscent || R * 0.8;
  const w = Math.max(8, Math.ceil(left + (m.actualBoundingBoxRight || m.width || R * 0.6)) + 24);
  const h = Math.max(8, Math.ceil(asc + (m.actualBoundingBoxDescent || R * 0.2)) + 24);
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  const ox = left + 12, oy = asc + 12;
  x.font = `${R}px ${fontStack(style)}`; x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(ch, ox, oy);
  const d = x.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  const k = REF_SIZE / R;
  const out = orderPieces(labelComponents(mask, w, h)).map((p) => ({
    n: p.n, x: (p.startX - ox) * k, y: (p.startY - oy) * k,
  }));
  pieceCache.set(key, out);
  return out;
}

// ── Painters ────────────────────────────────────────────────────────────────
/** Hollow guide + optional numbered start points, on the overlay canvas. */
export function drawShapeGuide(ctx, ch, p, metrics, theme) {
  ctx.clearRect(0, 0, CS, CS);
  if (!ch) return null;
  const lay = guideLayout(ctx, ch, p, metrics);
  const { pl } = lay;
  const color = theme === 'dark' ? '#38bdf8' : '#0ea5e9';
  ctx.save();
  applyPlacement(ctx, pl, p.rot);
  ctx.globalAlpha = p.opacity;
  ctx.font = refFont(p.style); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = p.weight / pl.s;
  if (p.dashed) ctx.setLineDash([5 / pl.s, 4 / pl.s]);
  ctx.strokeStyle = color;
  ctx.strokeText(ch, 0, 0);                              // OUTLINE ONLY → hollow shape
  if (p.order && !/\p{M}/u.test(ch)) {   // combining signs: no piece numbers (the ◌ base would be numbered)
    ctx.setLineDash([]); ctx.globalAlpha = Math.max(0.85, p.opacity);
    const r = 9 / pl.s;
    for (const pc of guidePieces(ch, p.style)) {
      ctx.beginPath(); ctx.arc(pc.x, pc.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${12 / pl.s}px system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(pc.n), pc.x, pc.y + 0.5 / pl.s);
    }
  }
  ctx.restore();
  return lay;
}

/** Solid fill of the standard shape (compare view / accuracy mask). `scale` maps 500-space → target canvas. */
export function paintGuideFill(ctx, ch, p, metrics, scale, color) {
  const lay = guideLayout(ctx, ch, p, metrics);
  ctx.save(); ctx.scale(scale, scale);
  applyPlacement(ctx, lay.pl, p.rot);
  ctx.font = refFont(p.style); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color; ctx.fillText(ch, 0, 0);
  ctx.restore();
  return lay;
}

/** The user's strokes, drawn like the main canvas (quadratic smoothing, round caps). */
export function paintStrokes(ctx, strokes, scale, color, fallbackW = 8) {
  ctx.save(); ctx.scale(scale, scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const line of strokes || []) {
    if (!Array.isArray(line) || line.length < 2) continue;
    const er = !!line[0].isEraser;
    ctx.globalCompositeOperation = er ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    let lx = line[0].x, ly = line[0].y, lmx = lx, lmy = ly;
    for (let i = 1; i < line.length; i++) {
      const pt = line[i], mx = (lx + pt.x) / 2, my = (ly + pt.y) / 2;
      ctx.beginPath(); ctx.moveTo(lmx, lmy); ctx.quadraticCurveTo(lx, ly, mx, my);
      ctx.lineWidth = pt.strokeWidth || fallbackW; ctx.stroke();
      lmx = mx; lmy = my; lx = pt.x; ly = pt.y;
    }
  }
  ctx.restore();
}

// ── Accuracy meter ──────────────────────────────────────────────────────────
const MS = 125; // mask size (500 / 4)
function maskOf(draw) {
  const c = document.createElement('canvas'); c.width = MS; c.height = MS;
  const x = c.getContext('2d', { willReadFrequently: true });
  draw(x);
  const d = x.getImageData(0, 0, MS, MS).data, m = new Uint8Array(MS * MS);
  for (let i = 0; i < MS * MS; i++) m[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  return m;
}
/** {score, precision, recall} of the drawn glyph vs the guide, or null (nothing drawn / no guide). */
export function scoreAgainstGuide(ch, strokes, p, metrics) {
  if (!ch || !strokesBox(strokes)) return null;
  const A = maskOf((x) => paintGuideFill(x, ch, { ...p, rot: p.rot }, metrics, 0.25, '#000'));
  const B = maskOf((x) => paintStrokes(x, strokes, 0.25, '#000', 6));
  return similarity(A, B, MS, MS, 4);
}

// ── Style match (from the anchors the user already drew) ────────────────────
/** → { gscale, gdy, used } to apply to settings, or null when no anchor is drawn yet. */
export function computeStyleMatch(glyphs, settings, adjMap, metrics) {
  const S = clampSettings(settings);
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  const drawn = ANCHOR_CHARS.map((ch) => ({ ch, box: strokesBox(glyphs[ch]) })).filter((a) => a.box);
  if (!drawn.length) return null;
  const pairsFor = (st) => drawn.map(({ ch, box }) => ({
    drawn: box, guide: guideLayout(ctx, ch, { ...mergeParams(st, adjMap[ch] || {}), rot: 0 }, metrics).box,
  }));
  const ratio = matchRatio(pairsFor(S));
  if (ratio == null) return null;
  const S2 = clampSettings({ ...S, gscale: S.gscale * ratio });
  const shift = matchShift(pairsFor(S2)) || 0;
  const S3 = clampSettings({ ...S2, gdy: S2.gdy + shift });
  return { gscale: S3.gscale, gdy: S3.gdy, used: drawn.map((a) => a.ch) };
}

