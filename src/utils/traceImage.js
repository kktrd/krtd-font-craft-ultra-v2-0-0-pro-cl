// Auto-trace: handwriting bitmap → centre-line strokes with widths (pure, no DOM).
// Pipeline: threshold (Otsu) → remove specks → distance transform → Zhang–Suen thinning
//           → skeleton graph walk (ends / junctions / loops) → spur pruning → width + RDP.
import { rdpSimplify } from './rdpSimplifier.js';
import { WIDTH_MIN, WIDTH_MAX } from './brushPresets.js';

const N8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];   // clockwise from north

export const TRACE_DEFAULTS = { sensitivity: 0, smooth: 2, spur: 14, minArea: 24, fixedWidth: 0, widthScale: 1 };

/** Otsu threshold of a 0-255 grey array. */
export function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i] & 255]++;
  const total = gray.length; let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sB = 0, wB = 0, best = 0, thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; thr = t; }
  }
  return thr;
}

/** Ink mask (1 = ink = darker than threshold). `sensitivity` shifts the threshold (+ = more ink). Border is cleared. */
export function binarize(gray, w, h, sensitivity = 0) {
  const thr = Math.max(5, Math.min(250, otsu(gray) + sensitivity));
  const m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = gray[i] < thr ? 1 : 0;
  for (let x = 0; x < w; x++) { m[x] = 0; m[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { m[y * w] = 0; m[y * w + w - 1] = 0; }
  return { mask: m, threshold: thr };
}

/** Drop connected blobs smaller than minArea pixels. */
export function removeSpecks(mask, w, h, minArea) {
  const seen = new Uint8Array(w * h), stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    const comp = []; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(); comp.push(p);
      const x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length < minArea) for (const p of comp) mask[p] = 0;
  }
  return mask;
}

/** Distance (px) from each ink pixel to the nearest background pixel (two-pass chamfer). */
export function distanceTransform(mask, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  const a = 1, b = 1.4142;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], d[i - 1] + a, d[i - w] + a, d[i - w - 1] + b, d[i - w + 1] + b);
  }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) {
    const i = y * w + x; if (!d[i]) continue;
    d[i] = Math.min(d[i], d[i + 1] + a, d[i + w] + a, d[i + w + 1] + b, d[i + w - 1] + b);
  }
  return d;
}

/** Zhang–Suen thinning (in place on a copy). */
export function thin(mask, w, h) {
  const m = Uint8Array.from(mask);
  const del = [];
  let changed = true, guard = 0;
  while (changed && guard++ < 250) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!m[i]) continue;
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1], p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (step === 0 ? (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) : (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0)) del.push(i);
      }
      if (del.length) { changed = true; for (const i of del) m[i] = 0; }
    }
  }
  return m;
}

const ring = (m, w, i) => N8.map(([dx, dy]) => m[i + dy * w + dx]);
const crossing = (r) => { let c = 0; for (let k = 0; k < 8; k++) if (!r[k] && r[(k + 1) & 7]) c++; return c; };

/** Walk the skeleton into polylines: [{ pts:[pixelIndex…], a:type, b:type }] (types: 1 end, 2 junction, 0 loop). */
function skeletonPaths(sk, w, h) {
  const type = new Uint8Array(w * h), isSk = (i) => sk[i] === 1;
  const isolated = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!sk[i]) continue;
    const r = ring(sk, w, i), B = r.reduce((s, v) => s + v, 0), cn = crossing(r);
    if (B === 0) { isolated.push(i); type[i] = 1; } else if (B === 1 || cn === 1) type[i] = 1; else if (cn >= 3) type[i] = 2; else type[i] = 0;
  }
  const nb = (i) => { const o = []; for (const [dx, dy] of N8) { const j = i + dy * w + dx; if (sk[j]) o.push(j); } return o; };
  const adj = (a, b) => Math.abs((a % w) - (b % w)) <= 1 && Math.abs(((a / w) | 0) - ((b / w) | 0)) <= 1;
  const visited = new Uint8Array(w * h), edgeSeen = new Set(), paths = [];

  const walk = (start, first) => {
    const pts = [start, first]; let prev = start, cur = first;
    while (type[cur] === 0 && !visited[cur]) {
      visited[cur] = 1;
      const cand = nb(cur).filter((j) => j !== prev && !(type[j] === 0 && visited[j]));
      const nx = cand.find((j) => !adj(j, prev)) ?? cand[0];            // prefer moving on, tolerate staircase corners
      if (nx === undefined) break;
      pts.push(nx); prev = cur; cur = nx;
    }
    return pts;
  };

  for (let n = 0; n < sk.length; n++) {
    if (!sk[n] || type[n] === 0) continue;
    for (const q of nb(n)) {
      if (type[q] === 0 ? visited[q] : edgeSeen.has(Math.min(n, q) * 1e7 + Math.max(n, q))) continue;
      if (type[q] !== 0) edgeSeen.add(Math.min(n, q) * 1e7 + Math.max(n, q));
      const pts = walk(n, q);
      paths.push({ pts, a: type[n], b: type[pts[pts.length - 1]] });
    }
  }
  // Leftover pass-pixels: either staircase debris touching an already-walked path (skip) or a genuine closed loop.
  const comp = [], stack = [];
  for (let p = 0; p < sk.length; p++) {
    if (!sk[p] || type[p] !== 0 || visited[p]) continue;
    comp.length = 0; stack.length = 0; stack.push(p); visited[p] = 2; let touches = false;
    while (stack.length) {
      const c = stack.pop(); comp.push(c);
      for (const j of nb(c)) {
        if (type[j] !== 0 || visited[j] === 1) touches = true;
        else if (!visited[j]) { visited[j] = 2; stack.push(j); }
      }
    }
    if (touches) continue;
    const ns = nb(comp[0]); if (ns.length < 2) continue;
    for (const c of comp) visited[c] = 0;
    visited[comp[0]] = 1;
    const pts = walk(comp[0], ns[0]); pts.push(comp[0]);
    for (const c of comp) visited[c] = 1;
    paths.push({ pts, a: 0, b: 0, loop: true });
  }
  return { paths, isolated };
}

const lenOf = (pts, w) => { let L = 0; for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; L += Math.hypot((a % w) - (b % w), ((a / w) | 0) - ((b / w) | 0)); } return L; };

/**
 * Trace a grey image (0-255, ink = dark) into canvas strokes.
 * @returns {{ strokes:Array, threshold:number, inkPixels:number }}
 */
export function traceBitmap(gray, w, h, options = {}) {
  const o = { ...TRACE_DEFAULTS, ...options };
  const { mask, threshold } = binarize(gray, w, h, o.sensitivity);
  removeSpecks(mask, w, h, o.minArea);
  let ink = 0; for (let i = 0; i < mask.length; i++) ink += mask[i];
  if (!ink) return { strokes: [], threshold, inkPixels: 0 };
  const dist = distanceTransform(mask, w, h);
  const sk = thin(mask, w, h);
  const { paths, isolated } = skeletonPaths(sk, w, h);
  const widthAt = (i) => Math.max(WIDTH_MIN, Math.min(WIDTH_MAX * 1.6, o.fixedWidth > 0 ? o.fixedWidth : (2 * dist[i] + 1) * o.widthScale));
  const strokes = [];

  for (const p of paths) {
    const L = lenOf(p.pts, w);
    const spur = (p.a === 1) !== (p.b === 1) && L < o.spur;                 // short branch ending on a junction
    const speck = p.a === 1 && p.b === 1 && L < Math.max(6, o.spur * 0.6);   // short free-floating bit
    const link = p.a === 2 && p.b === 2 && L < 3;                            // junction ↔ junction hairline
    if (spur || speck || link || p.pts.length < 2) continue;
    let pts = p.pts.map((i) => ({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5, w: widthAt(i) }));
    const k = 2;                                                              // smooth the widths along the path
    pts = pts.map((q, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(pts.length - 1, i + k); j++) { s += pts[j].w; c++; } return { ...q, w: s / c }; });
    const extend = (end, ref, wd) => {                                       // skeleton ends stop half a stroke short
      const dx = end.x - ref.x, dy = end.y - ref.y, d = Math.hypot(dx, dy) || 1, e = Math.min(wd / 2, 20);
      return { x: end.x + (dx / d) * e, y: end.y + (dy / d) * e, w: end.w };
    };
    if (p.a === 1 && pts.length > 3) pts.unshift(extend(pts[0], pts[Math.min(3, pts.length - 1)], pts[0].w));
    if (p.b === 1 && pts.length > 3) pts.push(extend(pts[pts.length - 1], pts[Math.max(0, pts.length - 4)], pts[pts.length - 1].w));
    let s = pts.map((q) => ({ x: q.x, y: q.y, isEraser: false, strokeWidth: Math.round(q.w * 10) / 10 }));
    s = rdpSimplify(s, Math.max(0.5, o.smooth));
    if (s.length >= 2) strokes.push(s);
  }
  for (const i of isolated) {                                                  // genuine dots
    const wd = widthAt(i);
    if (dist[i] * 2 >= 5) {
      const x = (i % w) + 0.5, y = ((i / w) | 0) + 0.5;
      strokes.push([{ x, y, isEraser: false, strokeWidth: wd }, { x: x + 0.1, y, isEraser: false, strokeWidth: wd }]);
    }
  }
  return { strokes, threshold, inkPixels: ink };
}
