// OpenType GPOS + GDEF writer: automatic pair kerning (from glyph geometry) and
// mark-to-base attachment for Sinhala combining signs. Pure, no DOM.

const u16 = (v) => [(v >> 8) & 255, v & 255];
const i16 = (v) => u16(v & 0xffff);
const tagBytes = (s) => [...s].map((c) => c.charCodeAt(0));

/** Sinhala combining signs that sit above / below their base letter. */
export const MARKS_ABOVE = new Set([0x0d81, 0x0dca, 0x0dd2, 0x0dd3]);
export const MARKS_BELOW = new Set([0x0dd4, 0x0dd6]);
export const isMarkCode = (u) => MARKS_ABOVE.has(u) || MARKS_BELOW.has(u);

/** Spacing vowel signs: they keep their own advance but hug the letter they belong to. */
export const SIGNS_POST = new Set([0x0d82, 0x0d83, 0x0dcf, 0x0dd0, 0x0dd1, 0x0dd8, 0x0df2, 0x0ddf]);   // after the letter
export const SIGNS_PRE  = new Set([0x0dd9, 0x0dda, 0x0ddb]);                                          // drawn before the letter
export const isSpacingSign = (u) => SIGNS_POST.has(u) || SIGNS_PRE.has(u);

const KERN_MIN = 15, KERN_MAX_TIGHT = -150, KERN_MAX_LOOSE = 60, KERN_PAIR_CAP = 4000, BAND = 25;

function bbox(contours) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  contours.forEach((c) => c.forEach((p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }));
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

/** Per-band [minX, maxX] of ink along horizontal scanlines (null where empty). */
export function inkProfile(contours, yFrom, yTo) {
  const bands = [];
  for (let y = yFrom + BAND / 2; y < yTo; y += BAND) {
    let lo = Infinity, hi = -Infinity;
    for (const c of contours) {
      for (let i = 0; i < c.length; i++) {
        const a = c[i], b = c[(i + 1) % c.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
          if (x < lo) lo = x; if (x > hi) hi = x;
        }
      }
    }
    bands.push(lo === Infinity ? null : [lo, hi]);
  }
  return bands;
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/**
 * Optical pair kerning. glyphs[i] = {unicode, advance, contours}; returns [{left, right, value}] (glyph ids).
 * Pulls apart-by-too-much pairs together, pushes colliding pairs apart; ignores marks / empty glyphs.
 */
export function computeKerning(glyphs) {
  const ids = [];
  glyphs.forEach((g, i) => {
    if (i === 0 || g.unicode === 32 || !g.contours.length || isMarkCode(g.unicode) || isSpacingSign(g.unicode)) return;
    ids.push(i);
  });
  if (ids.length < 2) return [];
  let yMin = Infinity, yMax = -Infinity;
  const info = new Map();
  ids.forEach((i) => { const b = bbox(glyphs[i].contours); if (b) { info.set(i, b); yMin = Math.min(yMin, b.y0); yMax = Math.max(yMax, b.y1); } });
  const lo = Math.floor(yMin / BAND) * BAND, hi = Math.ceil(yMax / BAND) * BAND;
  const prof = new Map();
  ids.forEach((i) => { if (info.has(i)) prof.set(i, inkProfile(glyphs[i].contours, lo, hi)); });
  const list = ids.filter((i) => prof.has(i));
  const gaps = [];
  for (const l of list) {
    for (const r of list) {
      const pl = prof.get(l), pr = prof.get(r);
      let g = Infinity;
      for (let k = 0; k < pl.length; k++) if (pl[k] && pr[k]) g = Math.min(g, glyphs[l].advance - pl[k][1] + pr[k][0]);
      if (g === Infinity) g = glyphs[l].advance - info.get(l).x1 + info.get(r).x0;
      gaps.push([l, r, g]);
    }
  }
  const target = median(gaps.map((x) => x[2]));
  const out = [];
  for (const [l, r, g] of gaps) {
    let v = Math.round(target - g);
    v = Math.max(KERN_MAX_TIGHT, Math.min(KERN_MAX_LOOSE, v));
    if (Math.abs(v) >= KERN_MIN) out.push({ left: l, right: r, value: v });
  }
  out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out.slice(0, KERN_PAIR_CAP);
}

/** Mark-to-base data: marks [{gid, cls, ax, ay}], bases [{gid, anchors: [{x,y}]}] (anchor per mark class). */
export function computeMarkAttachments(glyphs) {
  const marks = [];
  glyphs.forEach((g, gid) => {
    if (!isMarkCode(g.unicode) || !g.contours.length) return;
    const b = bbox(g.contours);
    if (!b) return;
    const above = MARKS_ABOVE.has(g.unicode);
    marks.push({ gid, above, ax: Math.round((b.x0 + b.x1) / 2), ay: Math.round(above ? b.y0 : b.y1) });
  });
  if (!marks.length) return null;
  marks.sort((a, b) => a.gid - b.gid);
  marks.forEach((m, i) => { m.cls = i; });
  const GAP = 20;
  const bases = [];
  glyphs.forEach((g, gid) => {
    if (gid === 0 || g.unicode === 32 || isMarkCode(g.unicode) || isSpacingSign(g.unicode) || !g.contours.length) return;
    const b = bbox(g.contours);
    if (!b) return;
    const cx = Math.round((b.x0 + b.x1) / 2);
    bases.push({ gid, anchors: marks.map((m) => ({ x: cx, y: Math.round(m.above ? Math.max(m.ay, b.y1 + GAP) : Math.min(m.ay, b.y0 - GAP)) })) });
  });
  if (!bases.length) return null;
  return { marks, bases };
}

const coverage = (gids) => [...u16(1), ...u16(gids.length), ...gids.flatMap((g) => u16(g))];
const lookupTable = (type, sub) => [...u16(type), ...u16(0), ...u16(1), ...u16(8), ...sub];

function pairPosSubtable(pairs) {
  const by = new Map();
  pairs.forEach((p) => { if (!by.has(p.left)) by.set(p.left, []); by.get(p.left).push(p); });
  const firsts = [...by.keys()].sort((a, b) => a - b);
  const sets = firsts.map((f) => {
    const l = by.get(f).sort((a, b) => a.right - b.right);
    return [...u16(l.length), ...l.flatMap((p) => [...u16(p.right), ...i16(p.value)])];
  });
  const cov = coverage(firsts);
  const headLen = 10 + firsts.length * 2;
  let off = headLen + cov.length;
  const head = [...u16(1), ...u16(headLen), ...u16(0x0004), ...u16(0), ...u16(firsts.length)];
  sets.forEach((s) => { head.push(...u16(off)); off += s.length; });
  const out = head.concat(cov, ...sets);
  return out.length > 0xffff ? null : out;
}

function markBaseSubtable({ marks, bases }) {
  const n = marks.length;
  const anchorBlob = (a) => [...u16(1), ...i16(a.x), ...i16(a.y)];
  const markCov = coverage(marks.map((m) => m.gid));
  const baseCov = coverage(bases.map((b) => b.gid));
  // MarkArray
  const maHead = 2 + n * 4;
  const maRecs = [], maAnch = [];
  marks.forEach((m, i) => { maRecs.push(...u16(m.cls), ...u16(maHead + i * 6)); maAnch.push(...anchorBlob({ x: m.ax, y: m.ay })); });
  const markArray = [...u16(n), ...maRecs, ...maAnch];
  // BaseArray with de-duplicated anchors
  const recLen = 2 + bases.length * n * 2;
  const pool = new Map(), poolBytes = [];
  const anchorOff = (a) => {
    const k = a.x + ',' + a.y;
    if (!pool.has(k)) { pool.set(k, recLen + poolBytes.length); poolBytes.push(...anchorBlob(a)); }
    return pool.get(k);
  };
  const recs = [];
  bases.forEach((b) => b.anchors.forEach((a) => recs.push(...u16(anchorOff(a)))));
  const baseArray = [...u16(bases.length), ...recs, ...poolBytes];
  const headLen = 12;
  const markCovOff = headLen, baseCovOff = markCovOff + markCov.length;
  const markArrOff = baseCovOff + baseCov.length, baseArrOff = markArrOff + markArray.length;
  const out = [...u16(1), ...u16(markCovOff), ...u16(baseCovOff), ...u16(n), ...u16(markArrOff), ...u16(baseArrOff)]
    .concat(markCov, baseCov, markArray, baseArray);
  return baseArrOff > 0xffff || recLen + poolBytes.length > 0xffff ? null : out;
}

function layoutTable(features, lookups) {
  const tags = ['DFLT', 'latn', 'sinh'];
  const feats = features.slice().sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const idx = feats.map((_, i) => i);
  const langSys = [...u16(0), ...u16(0xffff), ...u16(idx.length), ...idx.flatMap((i) => u16(i))];
  const script = [...u16(4), ...u16(0), ...langSys];
  const scriptRecHead = 2 + tags.length * 6;
  const scriptList = [...u16(tags.length)];
  tags.forEach((t, i) => scriptList.push(...tagBytes(t), ...u16(scriptRecHead + i * script.length)));
  const scriptListBytes = scriptList.concat(...tags.map(() => script));
  const featBlobs = feats.map((f) => [...u16(0), ...u16(f.lookups.length), ...f.lookups.flatMap((l) => u16(l))]);
  const fHead = 2 + feats.length * 6;
  const fList = [...u16(feats.length)];
  let fo = fHead;
  feats.forEach((f, i) => { fList.push(...tagBytes(f.tag), ...u16(fo)); fo += featBlobs[i].length; });
  const featureListBytes = fList.concat(...featBlobs);
  const lHead = 2 + lookups.length * 2;
  const lList = [...u16(lookups.length)];
  let lo = lHead;
  lookups.forEach((l) => { lList.push(...u16(lo)); lo += l.length; });
  const lookupListBytes = lList.concat(...lookups);
  const scriptOff = 10, featureOff = scriptOff + scriptListBytes.length, lookupOff = featureOff + featureListBytes.length;
  return Uint8Array.from([...u16(1), ...u16(0), ...u16(scriptOff), ...u16(featureOff), ...u16(lookupOff)]
    .concat(scriptListBytes, featureListBytes, lookupListBytes));
}

/** GDEF with glyph classes: base = 1, mark = 3. */
export function buildGDEF(glyphs) {
  const classes = [];
  glyphs.forEach((g, gid) => {
    if (gid === 0 || g.unicode == null) return;
    if (isMarkCode(g.unicode)) classes.push([gid, 3]);
    else if (g.contours.length) classes.push([gid, 1]);
  });
  if (!classes.some((c) => c[1] === 3)) return null;
  const recs = [];
  // ClassDefFormat2 (ranges), merging consecutive gids with the same class
  let i = 0;
  while (i < classes.length) {
    let j = i;
    while (j + 1 < classes.length && classes[j + 1][0] === classes[j][0] + 1 && classes[j + 1][1] === classes[i][1]) j++;
    recs.push(...u16(classes[i][0]), ...u16(classes[j][0]), ...u16(classes[i][1]));
    i = j + 1;
  }
  const classDef = [...u16(2), ...u16(recs.length / 6), ...recs];
  return Uint8Array.from([...u16(1), ...u16(0), ...u16(12), ...u16(0), ...u16(0), ...u16(0), ...classDef]);
}

/** Build GPOS (kern + mark/abvm/blwm). Returns Uint8Array or null when there is nothing to position. */
export function buildGPOS(glyphs) {
  const lookups = [], features = [];
  const pairs = computeKerning(glyphs);
  const pp = pairs.length ? pairPosSubtable(pairs) : null;
  if (pp) { features.push({ tag: 'kern', lookups: [lookups.length] }); lookups.push(lookupTable(2, pp)); }
  const mk = computeMarkAttachments(glyphs);
  const mb = mk ? markBaseSubtable(mk) : null;
  if (mb) {
    const li = lookups.length;
    ['abvm', 'blwm', 'mark'].forEach((tag) => features.push({ tag, lookups: [li] }));
    lookups.push(lookupTable(4, mb));
  }
  if (!lookups.length) return null;
  return layoutTable(features, lookups);
}
