/**
 * TrueType (glyf) font writer — pure JS, no dependencies, works in browser and Node.
 *
 * Why: opentype.js writes CFF outlines (sfnt "OTTO") even when the file is named .ttf.
 * Our glyphs are straight-line polygons, so a real TrueType `glyf` table is simple and
 * gives a genuine .ttf that every installer (Windows, macOS, Android, Word, Canva…) accepts.
 *
 * Input  model: { familyName, styleName, unitsPerEm, ascender, descender, xHeight, capHeight,
 *                 names:{copyright,version,designer,license,description,manufacturer,url},
 *                 glyphs:[{ name, unicode|null, advance, contours:[[{x,y}...]] }] }
 *         glyphs[0] must be .notdef. Contour points must be integers; outer contours clockwise.
 * Output: Uint8Array of the .ttf file.
 */

const u16 = (v) => [(v >> 8) & 255, v & 255];
const i16 = (v) => u16(v & 0xffff);
const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

class Buf {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u16(v) { this.a.push(...u16(v)); return this; }
  i16(v) { this.a.push(...i16(v)); return this; }
  u32(v) { this.a.push(...u32(v)); return this; }
  i64(v) { this.u32(Math.floor(v / 4294967296)); this.u32(v >>> 0); return this; }
  tag(s) { for (let i = 0; i < 4; i++) this.a.push(s.charCodeAt(i)); return this; }
  bytes(b) { for (const x of b) this.a.push(x); return this; }
  get length() { return this.a.length; }
  pad4() { while (this.a.length % 4) this.a.push(0); return this; }
}

function checksum(bytes) {
  let sum = 0;
  const n = bytes.length;
  for (let i = 0; i < n; i += 4) {
    sum = (sum + (((bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0)) >>> 0;
  }
  return sum >>> 0;
}

/** Clean a contour: integer coords, no repeated / collinear-duplicate points. Returns null if degenerate. */
export function cleanContour(points) {
  const out = [];
  for (const p of points) {
    const x = Math.round(p.x), y = Math.round(p.y);
    const last = out[out.length - 1];
    if (!last || last.x !== x || last.y !== y) out.push({ x, y });
  }
  while (out.length > 1 && out[0].x === out[out.length - 1].x && out[0].y === out[out.length - 1].y) out.pop();
  if (out.length < 3) return null;
  let area = 0;
  for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; area += a.x * b.y - b.x * a.y; }
  return area === 0 ? null : out;
}

/** Signed area (shoelace) — negative = clockwise in y-up space. */
export function signedArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; s += a.x * b.y - b.x * a.y; }
  return s / 2;
}

function encodeGlyph(contours) {
  const pts = [], ends = [];
  contours.forEach((c) => { c.forEach((p) => pts.push(p)); ends.push(pts.length - 1); });
  if (!pts.length) return { data: [], bbox: null, nPoints: 0, nContours: 0 };
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const p of pts) { xMin = Math.min(xMin, p.x); yMin = Math.min(yMin, p.y); xMax = Math.max(xMax, p.x); yMax = Math.max(yMax, p.y); }
  const b = new Buf();
  b.i16(contours.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  ends.forEach((e) => b.u16(e));
  b.u16(0); // instructionLength
  // flags: all points on-curve; compact short-vector encoding; OVERLAP_SIMPLE (0x40) on the first point
  const flags = [], xs = [], ys = [];
  let px = 0, py = 0;
  pts.forEach((p, i) => {
    const dx = p.x - px, dy = p.y - py;
    let f = 0x01;
    if (i === 0) f |= 0x40;
    if (dx === 0) f |= 0x10;
    else if (Math.abs(dx) <= 255) { f |= 0x02; if (dx > 0) f |= 0x10; xs.push(Math.abs(dx)); }
    else xs.push(dx);
    if (dy === 0) f |= 0x20;
    else if (Math.abs(dy) <= 255) { f |= 0x04; if (dy > 0) f |= 0x20; ys.push(Math.abs(dy)); }
    else ys.push(dy);
    flags.push({ f, dx, dy });
    px = p.x; py = p.y;
  });
  // write flags with run-length repeat
  for (let i = 0; i < flags.length;) {
    let j = i + 1;
    while (j < flags.length && flags[j].f === flags[i].f && j - i < 256) j++;
    const run = j - i;
    if (run > 1) { b.u8(flags[i].f | 0x08); b.u8(run - 1); } else b.u8(flags[i].f);
    i = j;
  }
  flags.forEach(({ f, dx }) => {
    if (f & 0x02) b.u8(Math.abs(dx));
    else if (!(f & 0x10)) b.i16(dx);
  });
  flags.forEach(({ f, dy }) => {
    if (f & 0x04) b.u8(Math.abs(dy));
    else if (!(f & 0x20)) b.i16(dy);
  });
  b.pad4(); // keep every glyph 4-byte aligned (also allows short loca)
  return { data: b.a, bbox: { xMin, yMin, xMax, yMax }, nPoints: pts.length, nContours: contours.length };
}

function buildCmap(glyphs) {
  const map = [];
  glyphs.forEach((g, gid) => { if (g.unicode != null && g.unicode <= 0xffff) map.push([g.unicode, gid]); });
  map.sort((a, b) => a[0] - b[0]);
  const segs = [];
  for (const [c, g] of map) {
    const s = segs[segs.length - 1];
    if (s && c === s.end + 1 && g === s.startGid + (c - s.start)) s.end = c;
    else segs.push({ start: c, end: c, startGid: g });
  }
  segs.push({ start: 0xffff, end: 0xffff, startGid: 0, last: true });
  const n = segs.length;
  const sr = 2 * 2 ** Math.floor(Math.log2(n));
  const b = new Buf();
  b.u16(0).u16(1);                  // version, numTables
  b.u16(3).u16(1).u32(12);          // Windows Unicode BMP, offset
  const len = 16 + n * 8;
  b.u16(4).u16(len).u16(0).u16(n * 2).u16(sr).u16(Math.log2(sr / 2)).u16(2 * n - sr);
  segs.forEach((s) => b.u16(s.end));
  b.u16(0);
  segs.forEach((s) => b.u16(s.start));
  segs.forEach((s) => b.u16(s.last ? 1 : (s.startGid - s.start) & 0xffff));
  segs.forEach(() => b.u16(0));
  return b.a;
}

const utf16be = (s) => { const o = []; for (const ch of s) { const c = ch.codePointAt(0); if (c > 0xffff) { const v = c - 0x10000; o.push(0xd8 | (v >> 18), (v >> 10) & 255, 0xdc | ((v >> 8) & 3), v & 255); } else o.push(c >> 8, c & 255); } return o; };
const macRoman = (s) => [...s].map((ch) => { const c = ch.charCodeAt(0); return c < 128 ? c : 63; });

function buildName(records) {
  const recs = [];
  records.forEach(([id, text]) => {
    if (!text) return;
    recs.push({ p: 3, e: 1, l: 0x409, id, bytes: utf16be(text) });
    recs.push({ p: 1, e: 0, l: 0, id, bytes: macRoman(text) });
  });
  recs.sort((a, b) => a.p - b.p || a.e - b.e || a.l - b.l || a.id - b.id);
  const b = new Buf();
  const strOff = 6 + recs.length * 12;
  b.u16(0).u16(recs.length).u16(strOff);
  let off = 0;
  recs.forEach((r) => { b.u16(r.p).u16(r.e).u16(r.l).u16(r.id).u16(r.bytes.length).u16(off); off += r.bytes.length; });
  recs.forEach((r) => b.bytes(r.bytes));
  return b.a;
}

/** PostScript name: ASCII letters/digits/hyphen, <= 63 chars. */
export function postScriptName(family, style) {
  const clean = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '');
  const n = `${clean(family) || 'KRTDFont'}-${clean(style) || 'Regular'}`;
  return n.slice(0, 63);
}

export function buildTrueTypeFont(model) {
  const { unitsPerEm = 1000, ascender, descender, xHeight = 0, capHeight = 0 } = model;
  const glyphs = model.glyphs;
  if (!glyphs.length || glyphs[0].name !== '.notdef') throw new Error('glyph 0 must be .notdef');
  const upem = unitsPerEm;
  const enc = glyphs.map((g) => encodeGlyph(g.contours));

  // ── glyf + loca
  const glyf = new Buf(), offsets = [];
  enc.forEach((e) => { offsets.push(glyf.length); glyf.bytes(e.data); });
  offsets.push(glyf.length);
  const longLoca = glyf.length > 0x1fffe;
  const loca = new Buf();
  offsets.forEach((o) => { if (longLoca) loca.u32(o); else loca.u16(o / 2); });

  // ── global bounds / metrics
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  enc.forEach((e) => { if (e.bbox) { xMin = Math.min(xMin, e.bbox.xMin); yMin = Math.min(yMin, e.bbox.yMin); xMax = Math.max(xMax, e.bbox.xMax); yMax = Math.max(yMax, e.bbox.yMax); } });
  if (!isFinite(xMin)) { xMin = yMin = 0; xMax = upem; yMax = upem; }
  const advMax = Math.max(...glyphs.map((g) => g.advance));
  const lsb = glyphs.map((g, i) => (enc[i].bbox ? enc[i].bbox.xMin : 0));
  const minLsb = Math.min(...glyphs.map((g, i) => (enc[i].bbox ? lsb[i] : Infinity)).filter(isFinite));
  const rsb = glyphs.map((g, i) => (enc[i].bbox ? g.advance - enc[i].bbox.xMax : Infinity)).filter(isFinite);
  const minRsb = rsb.length ? Math.min(...rsb) : 0;
  const maxExtent = Math.max(...glyphs.map((g, i) => (enc[i].bbox ? lsb[i] + (enc[i].bbox.xMax - enc[i].bbox.xMin) : 0)));
  const nPoints = Math.max(...enc.map((e) => e.nPoints), 0);
  const nContours = Math.max(...enc.map((e) => e.nContours), 0);
  const winAscent = Math.max(ascender, yMax, 0), winDescent = Math.max(-descender, -yMin, 0);

  const head = new Buf();
  const epoch1904 = Math.floor(Date.now() / 1000) + 2082844800;
  head.u32(0x00010000).u32(0x00010000).u32(0 /* checkSumAdjustment, patched later */).u32(0x5f0f3cf5)
    .u16(0x0003).u16(upem).i64(epoch1904).i64(epoch1904)
    .i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(0).u16(8).i16(2).i16(longLoca ? 1 : 0).i16(0);

  const hhea = new Buf();
  hhea.u32(0x00010000).i16(ascender).i16(descender).i16(0).u16(advMax).i16(Number.isFinite(minLsb) ? minLsb : 0)
    .i16(minRsb).i16(maxExtent).i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(glyphs.length);

  const maxp = new Buf();
  maxp.u32(0x00010000).u16(glyphs.length).u16(nPoints).u16(nContours).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

  const hmtx = new Buf();
  glyphs.forEach((g, i) => hmtx.u16(g.advance).i16(lsb[i]));

  const codes = glyphs.map((g) => g.unicode).filter((u) => u != null && u <= 0xffff);
  const first = codes.length ? Math.min(...codes) : 0, last = codes.length ? Math.max(...codes) : 0;
  const has = (a, b) => codes.some((c) => c >= a && c <= b);
  const uniRange = [0, 0, 0, 0];
  const setBit = (bit) => { uniRange[bit >> 5] |= (1 << (bit & 31)); };
  if (has(0x20, 0x7e)) setBit(0);        // Basic Latin
  if (has(0x0d80, 0x0dff)) setBit(12);   // Sinhala
  if (has(0xe000, 0xf8ff)) setBit(60);   // Private Use Area
  const avg = Math.round(glyphs.filter((g, i) => enc[i].bbox).reduce((s, g) => s + g.advance, 0) / Math.max(1, glyphs.filter((g, i) => enc[i].bbox).length));
  const os2 = new Buf();
  os2.u16(4).i16(avg).u16(400).u16(5).u16(0)                      // version, xAvgCharWidth, weight, width, fsType
    .i16(Math.round(upem * 0.65)).i16(Math.round(upem * 0.6)).i16(0).i16(Math.round(upem * 0.14))   // subscript size/offset
    .i16(Math.round(upem * 0.65)).i16(Math.round(upem * 0.6)).i16(0).i16(Math.round(upem * 0.48))   // superscript
    .i16(Math.round(upem * 0.05)).i16(Math.round(upem * 0.26))     // strikeout size / position
    .i16(0)                                                         // sFamilyClass
    .bytes([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])                          // panose
    .u32(uniRange[0] >>> 0).u32(uniRange[1] >>> 0).u32(uniRange[2] >>> 0).u32(uniRange[3] >>> 0)
    .tag('KRTD').u16(0x0040 | 0x0080)                               // vendor, fsSelection REGULAR + USE_TYPO_METRICS
    .u16(first).u16(last)
    .i16(ascender).i16(descender).i16(0).u16(winAscent).u16(winDescent)
    .u32(1).u32(0)                                                  // codepage ranges: Latin 1
    .i16(xHeight).i16(capHeight).u16(0).u16(32).u16(1);

  const post = new Buf();
  post.u32(0x00030000).u32(0).i16(-Math.round(upem * 0.1)).i16(Math.round(upem * 0.05)).u32(0).u32(0).u32(0).u32(0).u32(0);

  const gasp = new Buf();
  gasp.u16(1).u16(1).u16(0xffff).u16(0x000a);   // smooth gray scaling at every size (unhinted font)

  const n = model.names || {};
  const family = model.familyName, style = model.styleName || 'Regular';
  const version = n.version || 'Version 1.000';
  const nameTable = buildName([
    [0, n.copyright], [1, family], [2, style],
    [3, `${family}-${style};${version.replace(/^Version\s*/i, '')}`], [4, `${family} ${style}`.trim()],
    [5, version], [6, postScriptName(family, style)],
    [9, n.designer], [10, n.description], [11, n.url], [13, n.license],
  ]);

  const tables = {
    'OS/2': os2.a, cmap: buildCmap(glyphs), gasp: gasp.a, glyf: glyf.a, head: head.a, hhea: hhea.a, hmtx: hmtx.a,
    loca: loca.a, maxp: maxp.a, name: nameTable, post: post.a,
  };
  const tags = Object.keys(tables).sort();
  const numTables = tags.length;
  const sr = 16 * 2 ** Math.floor(Math.log2(numTables));
  const out = new Buf();
  out.u32(0x00010000).u16(numTables).u16(sr).u16(Math.floor(Math.log2(numTables))).u16(numTables * 16 - sr);
  let offset = 12 + numTables * 16;
  const placed = [];
  tags.forEach((t) => {
    const data = tables[t];
    out.tag(t).u32(checksum(data)).u32(offset).u32(data.length);
    placed.push({ t, data, offset });
    offset += Math.ceil(data.length / 4) * 4;
  });
  placed.forEach(({ data }) => { out.bytes(data); out.pad4(); });
  const bytes = Uint8Array.from(out.a);
  // head.checkSumAdjustment
  const headEntry = placed.find((p) => p.t === 'head');
  const adj = (0xb1b0afba - checksum(bytes)) >>> 0;
  const o = headEntry.offset + 8;
  bytes[o] = adj >>> 24; bytes[o + 1] = (adj >>> 16) & 255; bytes[o + 2] = (adj >>> 8) & 255; bytes[o + 3] = adj & 255;
  return bytes;
}
