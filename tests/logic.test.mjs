// Pure-logic regression tests. Run by GitHub Actions on every push (no local install needed):
//   node tests/logic.test.mjs
import assert from 'node:assert/strict';
import { convertSinglishToSinhala as c } from '../src/utils/transliteration.js';
import { verifyRoundTrip } from '../src/utils/legacyEncoding.js';
import { rdpSimplify } from '../src/utils/rdpSimplifier.js';
import { Trie } from '../src/utils/trieEngine.js';

import { analyzeProject, fixMetrics, validateMetrics, nextBestActions, workflowSteps } from '../src/agent/projectAnalyzer.js';
import { predictNextChars } from '../src/agent/pathPredictor.js';
import { parseIntent } from '../src/agent/intentParser.js';
import { localReply } from '../src/agent/agentBrain.js';
import { sanitizeAction, sanitizeActions } from '../src/agent/actionSchema.js';
import { runAgentAction } from '../src/agent/agentExecutor.js';
import handler from '../api/agent.js';
import { configuredProviders } from '../api/_providers.js';
import { strokeToContours, strokeToPolygons, normalizeWinding, centerlineSamples } from '../src/utils/strokeOutline.js';
import * as G from '../src/utils/guideMath.js';
import * as BP from '../src/utils/brushPresets.js';
import { buildTrueTypeFont, signedArea, cleanContour, postScriptName } from '../src/utils/ttfWriter.js';
import { getGuestOwner, ownerIdFor, isGuestOwner } from '../src/utils/ownerId.js';
import { DEFAULT_METRICS } from '../src/utils/glyphData.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('transliteration basics', () => {
  assert.equal(c('kohomada'), 'කොහොමද');
  assert.equal(c('kaalaya'), 'කාලය');
  assert.equal(c('guru'), 'ගුරු');
  assert.equal(c('kriya'), 'ක්‍රිය');
});
t('long o (oo) uses ෝ', () => assert.equal(c('pooja'), 'පෝජ'));
t('ng handling (anusvara / nga)', () => {
  assert.equal(c('lankaawa'.replace('nk', 'ngk')), 'ලංකාව');
  assert.equal(c('sinhala'), 'සිංහල');
  assert.equal(c('dangaa'), 'දඟා');
});
t('capital letters never break words', () => {
  assert.equal(c('Mama Pasal yanawa'), 'මම පසල් යනව');
  assert.equal(c('cinema'), 'චිනෙම');
});
t('legacy round-trip incl. ං and composites', () => {
  for (const w of ['කො', 'කෝ', 'කෙ', 'කාං', 'කිං', 'ක්‍ර', 'ශ්‍රී ලංකා', 'ඉස්කෝලේ']) {
    const r = verifyRoundTrip(w);
    assert.ok(r.matches, `${w} -> ${r.legacy} -> ${r.restored}`);
  }
  assert.ok(!/ං/.test(verifyRoundTrip('කාං').legacy), 'ං must be encoded');
});
t('rdp keeps endpoints, reduces points, handles closed loop', () => {
  const pts = Array.from({ length: 200 }, (_, i) => ({ x: i, y: Math.sin(i / 20) * 50 }));
  const s = rdpSimplify(pts, 1.5);
  assert.ok(s.length < 40 && s[0] === pts[0] && s[s.length - 1] === pts[199]);
  const loop = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
  assert.ok(rdpSimplify(loop, 1.5).length >= 4);
});
t('trie returns highest-frequency words first', () => {
  const tr = new Trie();
  for (let i = 0; i < 60; i++) tr.insert('කඅ' + String.fromCharCode(0x0d9a + (i % 20)) + i, 1);
  tr.insert('කඅඅ-top', 999);
  assert.equal(tr.suggest('කඅ', 3)[0], 'කඅඅ-top');
});

// ── Agent ──────────────────────────────────────────────────────────────────
const stroke = (w = 12, x0 = 150) => [[{ x: x0, y: 150, strokeWidth: w }, { x: x0 + 100, y: 300, strokeWidth: w }]];
const draw = (chars, w) => Object.fromEntries(chars.map((c) => [c, stroke(w)]));
const ANCH = ['ක', 'ම', 'න', 'ර', 'ය'];

t('agent: empty project -> score 0, anchors first', () => {
  const a = analyzeProject({ glyphs: {}, metrics: { ...DEFAULT_METRICS }, selectedChar: 'අ' });
  assert.equal(a.score, 0); assert.equal(a.phase, 'anchors');
  assert.deepEqual(a.predicted.slice(0, 5).map((p) => p.char), ANCH);
  assert.equal(nextBestActions(a)[0].args.char, 'ක');
});
t('agent: phases advance with progress', () => {
  const g = draw(ANCH);
  const a = analyzeProject({ glyphs: g, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක', styleLearned: true });
  assert.equal(a.phase, 'core');
  assert.ok(a.score > 0 && a.score < 15, String(a.score));
  assert.equal(workflowSteps(a).find((x) => x.status === 'current').id, 'core');
});
t('agent: family prediction (ග drawn -> ඝ suggested early)', () => {
  const p = predictNextChars(draw([...ANCH, 'ග']), 'ග', 6).map((x) => x.char);
  assert.ok(p.includes('ඝ'), p.join());
});
t('agent: full perfect project scores 100 / ship phase', () => {
  const all = analyzeProject({ glyphs: {}, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක' });
  const chars = all.coverage.flatMap((c) => c.missing);
  const g = Object.fromEntries(chars.map((c) => [c, stroke(12)[0] && stroke(12)]));
  const a = analyzeProject({ glyphs: g, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක', styleLearned: true, env: { isOnline: true, hasSupabase: true } });
  assert.equal(a.drawnCount, 75); assert.equal(a.score, 100); assert.equal(a.phase, 'ship');
  assert.equal(nextBestActions(a).find((x) => x.id === 'export_ttf').id, 'export_ttf');
});
t('agent: metrics validation + repair', () => {
  const bad = { ascender: 300, capHeight: 100, xHeight: 240, baseline: 380, descender: 370 };
  assert.ok(validateMetrics(bad).length > 0);
  assert.equal(validateMetrics(fixMetrics(bad)).length, 0);
  assert.equal(validateMetrics(fixMetrics({})).length, 0);
  assert.equal(analyzeProject({ glyphs: draw(ANCH), metrics: bad, selectedChar: 'ක' }).phase, 'setup');
});
t('agent: detects out-of-canvas, tiny and inconsistent glyphs', () => {
  const g = draw(['ක', 'ම', 'න', 'ර'], 12);
  g['ය'] = [[{ x: -20, y: 100, strokeWidth: 12 }, { x: 600, y: 200, strokeWidth: 12 }]];
  g['ව'] = [[{ x: 100, y: 100, strokeWidth: 12 }, { x: 105, y: 104, strokeWidth: 12 }]];
  g['ස'] = stroke(40);
  const a = analyzeProject({ glyphs: g, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක' });
  const ids = a.issues.map((i) => i.id);
  assert.ok(ids.includes('out-of-canvas') && ids.includes('tiny') && ids.includes('weight'), ids.join());
});
t('agent: intent parser (Sinhala / Singlish / English)', () => {
  assert.deepEqual(parseIntent('ක').actions[0], { id: 'select_char', args: { char: 'ක' } });
  assert.equal(parseIntent('draw ක්ෂ').actions[0].args.char, 'ක්ෂ');
  assert.equal(parseIntent('ඊළඟ අකුර?').intent, 'next');
  assert.equal(parseIntent('fix all').intent, 'fixall');
  assert.equal(parseIntent('export ttf').actions[0].id, 'export_ttf');
  assert.equal(parseIntent('text studio').actions[0].args.tab, 'text');
  assert.equal(parseIntent('metrics fix karanna').actions[0].id, 'fix_metrics');
  assert.equal(parseIntent('blah blah').intent, null);
});
t('agent: action whitelist rejects anything unsafe', () => {
  assert.equal(sanitizeAction({ id: 'rm_rf', args: {} }), null);
  assert.equal(sanitizeAction({ id: 'select_char', args: { char: 'Z' } }), null);
  assert.equal(sanitizeAction({ id: 'go_tab', args: { tab: 'evil' } }), null);
  assert.equal(sanitizeAction({ id: 'set_brush', args: { mode: 'uniform', width: 9999 } }).args.width, 40);
  assert.equal(sanitizeAction({ id: '__proto__', args: {} }), null);
  assert.equal(sanitizeActions(Array(20).fill({ id: 'fix_metrics', args: {} })).length, 4);
});
t('agent: local reply understood flag', () => {
  const a = analyzeProject({ glyphs: {}, metrics: { ...DEFAULT_METRICS }, selectedChar: 'අ' });
  assert.equal(localReply('score', a).understood, true);
  assert.equal(localReply('why is the sky blue', a).understood, false);
  assert.equal(localReply('save', a).run[0].id, 'push_cloud');
});

// ── Stroke outline (export geometry) ───────────────────────────────────────
t('strokeOutline: curve → closed contours within brush bounds', () => {
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push({ x: 100 + i * 10, y: 250 + 80 * Math.sin(i / 3), strokeWidth: 10 });
  const cs = strokeToContours(pts, 400, 2);
  assert.ok(cs.length > 0 && cs.length < 400);
  const xs = cs.flat().map(p => p.x), ys = cs.flat().map(p => p.y);
  assert.ok(Math.min(...xs) >= (100 - 6) * 2 - 1 && Math.max(...xs) <= (300 + 6) * 2 + 1);
  assert.ok(xs.every(Number.isFinite) && ys.every(Number.isFinite));
  for (const c of cs) assert.ok(c.length >= 3);
});
t('strokeOutline: single dot → round blob', () => {
  const cs = strokeToContours([{ x: 200, y: 200, strokeWidth: 20 }, { x: 200.1, y: 200, strokeWidth: 20 }], 400, 1);
  assert.ok(cs.length >= 1);
  const xs = cs.flat().map(p => p.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 18);
});
t('strokeOutline: winding normalised to one direction', () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const area = ps => ps.reduce((a, p, i) => { const q = ps[(i + 1) % ps.length]; return a + (p.x * q.y - q.x * p.y); }, 0);
  const a = normalizeWinding(sq.slice(), true), b = normalizeWinding(sq.slice().reverse(), true);
  assert.equal(Math.sign(area(a)), Math.sign(area(b)));
});

t('guideMath: fit, snap placement, clamping, preset sanitising', () => {
  const box = { left: 0, right: 60, ascent: 80, descent: 20 };
  const f = G.autoFitGuide(box, DEFAULT_METRICS);
  assert.ok(f.fontSize >= 20 && f.fontSize <= 400 && f.cx === 250);
  const params = G.mergeParams({ snap: true }, {});
  const pl = G.placeGuide(box, box, params, DEFAULT_METRICS);
  const b = G.placedBox(box, pl);
  assert.ok(Math.abs(b.maxy - (DEFAULT_METRICS.baseline + pl.s * 20)) < 1e-6);            // sits on the baseline
  assert.ok(Math.abs((b.maxy - 20 * pl.s) - (b.miny + 80 * pl.s)) < 1e-6);
  assert.ok(Math.abs((b.maxy - b.miny) - (DEFAULT_METRICS.baseline - DEFAULT_METRICS.xHeight)) < 1e-6); // anchor fills x-height..baseline
  const c = G.clampAdj({ scale: 99, dx: -999, rot: 'x' });
  assert.equal(c.scale, 2.2); assert.equal(c.dx, -250); assert.equal(c.rot, 0);
  const s = G.clampSettings({ style: 'evil', snap: 'yes', gscale: 9 });
  assert.equal(s.style, 'sans'); assert.equal(s.snap, false); assert.equal(s.gscale, 2);
  const pre = G.clampPreset({ on: 1, settings: { style: 'serif' }, adj: { 'ක': { scale: 5 }, 'abc': {} } });
  assert.equal(pre.on, false); assert.equal(pre.settings.style, 'serif'); assert.equal(pre.adj['ක'].scale, 2.2); assert.ok(!pre.adj.abc);
  assert.deepEqual(sanitizeAction({ id: 'shape_guide', args: { on: true, evil: 1 } }), { id: 'shape_guide', args: { on: true } });
  assert.deepEqual(sanitizeAction({ id: 'shape_guide', args: { on: 'yes' } }), { id: 'shape_guide', args: {} });
  assert.equal(parseIntent('show hollow shape guide', { glyphs: {}, metrics: DEFAULT_METRICS, selectedChar: 'ක' }).actions[0].id, 'shape_guide');
});
t('guideMath: piece order (body first, marks left→right)', () => {
  const w = 40, h = 40, m = new Uint8Array(w * h);
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1; };
  rect(10, 12, 26, 30);            // body
  rect(32, 4, 35, 7);              // mark right-top
  rect(4, 4, 7, 7);                // mark left-top
  m[39 * w + 39] = 1;              // 1px noise → dropped
  const ps = G.orderPieces(G.labelComponents(m, w, h));
  assert.equal(ps.length, 3);
  assert.deepEqual(ps.map((p) => p.n), [1, 2, 3]);
  assert.ok(ps[0].area > ps[1].area && ps[1].cx < ps[2].cx);
  assert.ok(ps[0].startY <= 13);   // start point near the top of the body
});
t('guideMath: similarity meter', () => {
  const w = 60, h = 60, mk = (x0, y0, x1, y1) => { const m = new Uint8Array(w * h); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1; return m; };
  const A = mk(10, 10, 40, 14);
  assert.equal(G.similarity(A, A, w, h, 3).score, 100);
  const near = G.similarity(A, mk(10, 12, 40, 16), w, h, 3).score;
  const far = G.similarity(A, mk(10, 45, 40, 49), w, h, 3).score;
  assert.ok(near >= 90 && far <= 10, `${near} ${far}`);
  assert.equal(G.similarity(A, new Uint8Array(w * h), w, h), null);
});
t('guideMath: style match ratio / shift', () => {
  const pairs = [
    { drawn: { minx: 100, maxx: 300, miny: 100, maxy: 300 }, guide: { minx: 100, maxx: 200, miny: 120, maxy: 220 } },
    { drawn: { minx: 50, maxx: 250, miny: 200, maxy: 400 }, guide: { minx: 50, maxx: 150, miny: 220, maxy: 320 } },
  ];
  assert.equal(G.matchRatio(pairs), 2);
  assert.equal(G.matchRatio([{ drawn: { minx: 0, maxx: 10, miny: 0, maxy: 10 }, guide: { minx: 0, maxx: 100, miny: 0, maxy: 100 } }]), 0.5); // clamped
  assert.equal(G.matchShift([{ drawn: { miny: 100, maxy: 200 }, guide: { miny: 120, maxy: 220 } }]), -20);
  assert.equal(G.matchRatio([]), null);
  assert.deepEqual(G.strokesBox([[{ x: 1, y: 2 }, { x: 5, y: 9 }]]), { minx: 1, maxx: 5, miny: 2, maxy: 9 });
  assert.equal(G.strokesBox([]), null);
});

t('ownerId: stable per-device guest id, auth id wins, blocked storage still works', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const g1 = getGuestOwner(), g2 = getGuestOwner();
  assert.equal(g1, g2); assert.ok(isGuestOwner(g1) && g1.length >= 34);   // matches the SQL rule length(user_id) >= 34
  store.set('krtd_guest_key', 'junk'); assert.notEqual(getGuestOwner(), 'junk');      // corrupted value is replaced
  assert.equal(ownerIdFor({ id: 'abc-uuid' }), 'abc-uuid');
  assert.ok(isGuestOwner(ownerIdFor(null)));
  assert.equal(isGuestOwner('guest'), false); assert.equal(isGuestOwner('g:1'), false);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const m1 = getGuestOwner(); assert.equal(m1, getGuestOwner()); assert.ok(isGuestOwner(m1));
  delete globalThis.localStorage;
});

t('strokeOutline: gentle curves have no wedge gaps on the outer edge', () => {
  const R = 90, W = 14, N = 40, pts = [];
  for (let i = 0; i <= N; i++) pts.push({ x: 250 + R * Math.cos(i / N * 6.2832), y: 250 + R * Math.sin(i / N * 6.2832), strokeWidth: W });
  const polys = strokeToPolygons(pts);
  const inside = (pt, poly) => { let w = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length];
    if (a.y <= pt.y) { if (b.y > pt.y && (b.x - a.x) * (pt.y - a.y) - (pt.x - a.x) * (b.y - a.y) > 0) w++; }
    else if (b.y <= pt.y && (b.x - a.x) * (pt.y - a.y) - (pt.x - a.x) * (b.y - a.y) < 0) w--; } return w !== 0; };
  let misses = 0;
  for (let k = 1; k < 800; k++) { const ang = k / 800 * 6.2832;      // walk the OUTER and INNER ring edges (0.5px inside)
    for (const r of [R + W / 2 - 0.5, R - W / 2 + 0.5]) {
      const pt = { x: 250 + r * Math.cos(ang), y: 250 + r * Math.sin(ang) };
      if (!polys.some(p => inside(pt, p))) misses++; } }
  assert.equal(misses, 0, `${misses} uncovered edge samples`);
});

t('ttfWriter: valid TrueType structure, checksums, cmap, glyf round-trip', () => {
  const sq = (x, y, s) => [{ x, y }, { x, y: y + s }, { x: x + s, y: y + s }, { x: x + s, y }];   // clockwise (y-up)
  const bytes = buildTrueTypeFont({
    familyName: 'Test Font', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, xHeight: 400, capHeight: 700,
    names: { copyright: 'c', version: 'Version 1.000' },
    glyphs: [
      { name: '.notdef', unicode: null, advance: 500, contours: [sq(50, 0, 400)] },
      { name: 'space', unicode: 32, advance: 300, contours: [] },
      { name: 'uni0D9A', unicode: 0x0D9A, advance: 600, contours: [sq(60, -20, 300), sq(300, 100, 280)] },
      { name: 'uni0D9B', unicode: 0x0D9B, advance: 600, contours: [sq(60, 0, 1000)] },
      { name: 'uniF100', unicode: 0xF100, advance: 700, contours: [sq(60, 0, 100)] },
    ],
  });
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(dv.getUint32(0), 0x00010000);                           // TrueType, not OTTO
  const n = dv.getUint16(4), dir = {};
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; dir[String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12), sum: dv.getUint32(o + 4) }; }
  assert.deepEqual(Object.keys(dir), [...Object.keys(dir)].sort());   // sorted tags
  for (const k of ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']) assert.ok(dir[k], k);
  const sum = (from, len) => { let s = 0; for (let i = 0; i < len; i += 4) s = (s + (((bytes[from + i] << 24) | ((bytes[from + i + 1] || 0) << 16) | ((bytes[from + i + 2] || 0) << 8) | (bytes[from + i + 3] || 0)) >>> 0)) >>> 0; return s; };
  for (const [k, e] of Object.entries(dir)) {
    assert.equal(e.off % 4, 0, `${k} aligned`);
    if (k !== 'head') assert.equal(sum(e.off, e.len), e.sum, `${k} checksum`);
  }
  assert.equal(sum(0, bytes.length), 0xB1B0AFBA);                      // whole-file checksum rule
  assert.equal(dv.getUint32(dir.head.off + 12), 0x5F0F3CF5);
  assert.equal(dv.getUint16(dir.maxp.off + 4), 5);                     // numGlyphs
  // cmap format 4: map U+0D9A -> glyph 2, U+0D9B -> 3, U+F100 -> 4
  const cm = dir.cmap.off + 12, segX2 = dv.getUint16(cm + 6), segs = segX2 / 2;
  const lookup = (c) => { for (let i = 0; i < segs; i++) { const end = dv.getUint16(cm + 14 + i * 2), start = dv.getUint16(cm + 16 + segX2 + i * 2);
    if (c >= start && c <= end) { const delta = dv.getUint16(cm + 16 + 2 * segX2 + i * 2); return (c + delta) & 0xffff; } } return 0; };
  assert.equal(lookup(32), 1); assert.equal(lookup(0x0D9A), 2); assert.equal(lookup(0x0D9B), 3); assert.equal(lookup(0xF100), 4); assert.equal(lookup(0x41), 0);
  // glyf round-trip for glyph 2 (two squares, one with negative y and a >255 delta jump)
  const loca = (i) => dv.getUint16(dir.loca.off + i * 2) * 2, g0 = dir.glyf.off + loca(2);
  assert.equal(dv.getInt16(g0), 2);                                    // 2 contours
  assert.equal(dv.getInt16(g0 + 2), 60); assert.equal(dv.getInt16(g0 + 4), -20); assert.equal(dv.getInt16(g0 + 6), 580); assert.equal(dv.getInt16(g0 + 8), 380);
  const ends = [dv.getUint16(g0 + 10), dv.getUint16(g0 + 12)]; assert.deepEqual(ends, [3, 7]);
  let p = g0 + 14; const il = dv.getUint16(p); p += 2 + il;
  const flags = []; while (flags.length < 8) { const f = dv.getUint8(p++); flags.push(f); if (f & 8) { let r = dv.getUint8(p++); while (r--) flags.push(f); } }
  const xs = [], ys = []; let x = 0, y = 0;
  for (const f of flags) { if (f & 2) { const d = dv.getUint8(p++); x += (f & 16) ? d : -d; } else if (!(f & 16)) { x += dv.getInt16(p); p += 2; } xs.push(x); }
  for (const f of flags) { if (f & 4) { const d = dv.getUint8(p++); y += (f & 32) ? d : -d; } else if (!(f & 32)) { y += dv.getInt16(p); p += 2; } ys.push(y); }
  assert.deepEqual(xs, [60, 60, 360, 360, 300, 300, 580, 580]); assert.deepEqual(ys, [-20, 280, 280, -20, 100, 380, 380, 100]);
  assert.ok(flags[0] & 0x40);                                          // OVERLAP_SIMPLE on first point
});
t('ttfWriter: contour cleaning + names', () => {
  assert.equal(cleanContour([{ x: 0, y: 0 }, { x: 0.2, y: 0.1 }, { x: 5, y: 0 }]), null);       // collapses to <3 points
  assert.equal(cleanContour([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]), null);         // zero area
  assert.equal(cleanContour([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 0, y: 0 }]).length, 3);
  assert.ok(signedArea([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }]) < 0);   // clockwise in y-up
  assert.equal(postScriptName('My Font ක!', 'Regular'), 'MyFont-Regular');
  assert.ok(postScriptName('x'.repeat(100), 'Regular').length <= 63);
});

// ── Executor with a fake app API ───────────────────────────────────────────
const asyncT = [];
const ta = (name, fn) => asyncT.push([name, fn]);
const fakeApi = (over = {}) => {
  const st = { glyphs: {}, metrics: { ...DEFAULT_METRICS }, undo: [], sel: null, tab: null, ...over };
  return { st, api: {
    get glyphs() { return st.glyphs; }, get metrics() { return st.metrics; },
    selectChar: (c) => { st.sel = c; }, goTab: (x) => { st.tab = x; },
    setMetrics: (m) => { st.metrics = m; }, setGlyphs: (f) => { st.glyphs = typeof f === 'function' ? f(st.glyphs) : f; },
    setStrokeWidth() {}, setBrushMode() {}, pushUndo: (c, s2) => st.undo.push([c, s2]),
    learnStyle() {}, pushCloud: async () => {}, exportTTF: async () => {}, exportPDF: async () => {}, exportPNG: async () => {}, exportJSON() {}, showHelp() {}, setShapeGuide(on) { globalThis.__sg = on; },
    confirm: async () => st.confirmAnswer ?? true,
  } };
};
ta('executor: select_char + clamp + undo entries', async () => {
  const { st, api } = fakeApi({ glyphs: { 'ය': [[{ x: -20, y: 10 }, { x: 700, y: 20 }]] } });
  assert.equal((await runAgentAction({ id: 'select_char', args: { char: 'ම' } }, api)).ok, true);
  assert.equal(st.sel, 'ම'); assert.equal(st.tab, 'canvas');
  const r = await runAgentAction({ id: 'clamp_glyph', args: { char: '*' } }, api);
  assert.ok(r.ok && st.undo.length === 1);
  assert.deepEqual(st.glyphs['ය'][0].map((p) => p.x), [0, 500]);
});
ta('executor: fix_metrics, risky confirm, copy_glyph safety', async () => {
  const { st, api } = fakeApi({ metrics: { ascender: 400, capHeight: 100, xHeight: 90, baseline: 80, descender: 70 }, glyphs: { 'ග': stroke(), 'ඝ': stroke() } });
  await runAgentAction({ id: 'fix_metrics', args: {} }, api);
  assert.equal(validateMetrics(st.metrics).length, 0);
  st.confirmAnswer = false;
  const before = JSON.stringify(st.metrics);
  assert.equal((await runAgentAction({ id: 'reset_metrics', args: {} }, api)).ok, false);
  assert.equal(JSON.stringify(st.metrics), before);
  assert.equal((await runAgentAction({ id: 'copy_glyph', args: { from: 'ග', to: 'ඝ' } }, api)).ok, false); // never overwrites
  assert.equal((await runAgentAction({ id: 'hack', args: {} }, api)).ok, false);
});

// ── Serverless handler (mocked fetch) ──────────────────────────────────────
const mkRes = () => { const r = { code: 200, body: null, h: {}, setHeader(k, v) { r.h[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const realFetch = globalThis.fetch;
const setEnv = (o) => { for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'ZAI_API_KEY', 'AI_PROVIDER', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) delete process.env[k]; Object.assign(process.env, o); };
const ENV = { ANTHROPIC_API_KEY: 'k', VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'a' };
const req = (o = {}) => ({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hi', snapshot: {} }, ...o });

ta('api/agent: 405 / 501 / 401 / 400', async () => {
  setEnv({}); let r = mkRes(); await handler(req({ method: 'GET' }), r); assert.equal(r.code, 405);
  r = mkRes(); await handler(req(), r); assert.equal(r.code, 501); assert.equal(r.body.error, 'llm_not_configured');
  setEnv(ENV);
  r = mkRes(); await handler(req({ headers: {} }), r); assert.equal(r.code, 401);
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  r = mkRes(); await handler(req(), r); assert.equal(r.code, 401);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'user-400' }) });
  r = mkRes(); await handler(req({ body: { message: '   ' } }), r); assert.equal(r.code, 400);
  r = mkRes(); await handler(req({ body: { message: 'x'.repeat(30000) } }), r); assert.equal(r.code, 413);
});
ta('api/agent: success path filters non-whitelisted actions', async () => {
  setEnv(ENV);
  globalThis.fetch = async (url) => url.includes('/auth/v1/user')
    ? ({ ok: true, json: async () => ({ id: 'user-ok' }) })
    : ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Here you go: {"reply":"ක අඳින්න","actions":[{"id":"select_char","args":{"char":"ක"}},{"id":"delete_all","args":{}},{"id":"go_tab","args":{"tab":"hax"}}]}' }] }) });
  const r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 200); assert.equal(r.body.reply, 'ක අඳින්න');
  assert.deepEqual(r.body.actions, [{ id: 'select_char', args: { char: 'ක' } }]);
});
ta('api/agent: rate limit after 20 calls, upstream errors map cleanly', async () => {
  setEnv(ENV);
  globalThis.fetch = async (url) => url.includes('/auth/v1/user') ? ({ ok: true, json: async () => ({ id: 'user-rl' }) }) : ({ ok: false, status: 500, json: async () => ({}) });
  let last;
  for (let i = 0; i < 21; i++) { last = mkRes(); await handler(req(), last); if (i === 0) assert.equal(last.code, 502); }
  assert.equal(last.code, 429);
});

ta('providers: order, preference, key aliases', async () => {
  assert.deepEqual(configuredProviders({}), []);
  assert.deepEqual(configuredProviders({ ZAI_API_KEY: 'z', ANTHROPIC_API_KEY: 'a', GOOGLE_API_KEY: 'g' }), ['gemini', 'anthropic', 'zai']);
  assert.deepEqual(configuredProviders({ ZAI_API_KEY: 'z', ANTHROPIC_API_KEY: 'a', AI_PROVIDER: 'zai' }), ['zai', 'anthropic']);
  assert.deepEqual(configuredProviders({ ANTHROPIC_API_KEY: 'a', AI_PROVIDER: 'gemini' }), ['anthropic']); // unavailable pref ignored
});
const SBOK = (id) => ({ ok: true, json: async () => ({ id }) });
const GOOD_JSON = '{"reply":"ක අඳින්න, ඉන්පසු ම","actions":[{"id":"select_char","args":{"char":"ක"}}]}';
ta('api/agent: Gemini request shape + Sinhala Unicode reply', async () => {
  setEnv({ ...ENV, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gk', GEMINI_MODEL: 'gemini-x' }); delete process.env.ANTHROPIC_API_KEY;
  let seen;
  globalThis.fetch = async (url, init) => {
    if (url.includes('/auth/v1/user')) return SBOK('u-gem');
    seen = { url, init }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: GOOD_JSON }] } }] }) };
  };
  const r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 200); assert.equal('provider' in r.body, false, 'provider name must never reach the browser');
  assert.equal(r.body.reply, 'ක අඳින්න, ඉන්පසු ම');
  assert.ok(seen.url.includes('/models/gemini-x:generateContent'));
  assert.equal(seen.init.headers['x-goog-api-key'], 'gk');
  const sent = JSON.parse(seen.init.body);
  assert.ok(sent.systemInstruction.parts[0].text.includes('KRTD Agent') && sent.generationConfig.responseMimeType === 'application/json');
  assert.deepEqual(r.body.actions, [{ id: 'select_char', args: { char: 'ක' } }]);
});
ta('api/agent: Gemini blocked -> falls back to Z.AI (OpenAI-compatible)', async () => {
  setEnv({ ...ENV, GEMINI_API_KEY: 'gk', ZAI_API_KEY: 'zk' }); delete process.env.ANTHROPIC_API_KEY;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (url.includes('/auth/v1/user')) return SBOK('u-fb');
    calls.push(url);
    if (url.includes('generativelanguage')) return { ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) };
    assert.equal(init.headers.authorization, 'Bearer zk');
    assert.equal(JSON.parse(init.body).model, 'glm-5.2');
    return { ok: true, json: async () => ({ choices: [{ message: { content: GOOD_JSON } }] }) };
  };
  const r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 200); assert.equal('provider' in r.body, false);
  assert.ok(calls[0].includes('generativelanguage') && calls[1] === 'https://api.z.ai/api/paas/v4/chat/completions');
});
ta('api/agent: ping hides provider names from non-admins, shows them to admins', async () => {
  setEnv({ ...ENV, ZAI_API_KEY: 'zk' }); delete process.env.ANTHROPIC_API_KEY;
  let modelCalls = 0; let role = null;
  globalThis.fetch = async (url) => {
    if (url.includes('/auth/v1/user')) return SBOK('u-ping');
    if (url.includes('/rest/v1/user_roles')) return { ok: true, json: async () => (role ? [{ role }] : []) };
    modelCalls++; return { ok: false, status: 429, json: async () => ({}) };
  };
  let r = mkRes(); await handler(req({ body: { message: '__ping__', detail: true } }), r);
  assert.deepEqual(r.body, { ok: true, enabled: true });                      // regular designer: no names
  role = 'designer'; r = mkRes(); await handler(req({ body: { message: '__ping__', detail: true } }), r);
  assert.deepEqual(r.body, { ok: true, enabled: true });
  role = 'super_admin'; r = mkRes(); await handler(req({ body: { message: '__ping__', detail: true } }), r);
  assert.deepEqual(r.body.providers, ['zai']); assert.equal(r.body.models.zai, 'glm-5.2');
  r = mkRes(); await handler(req({ body: { message: '__ping__' } }), r);       // no detail flag -> still hidden
  assert.equal('providers' in r.body, false); assert.equal(modelCalls, 0);
  r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 502); assert.equal(r.body.error, 'llm_http_429');
});
t('brushPresets: presets valid, matching, safe custom palette, preview polygons', () => {
  const ids = new Set(), combos = new Set();
  for (const p of BP.BRUSH_PRESETS) {
    assert.ok(BP.BRUSH_MODES.includes(p.mode));
    assert.ok(p.width >= BP.WIDTH_MIN && p.width <= BP.WIDTH_MAX);
    assert.ok(!ids.has(p.id)); ids.add(p.id);
    const k = p.mode + ':' + p.width; assert.ok(!combos.has(k)); combos.add(k);
  }
  assert.equal(BP.matchPreset('tapered', 16).id, 'ink-brush');
  assert.equal(BP.matchPreset('tapered', 17), null);
  const c = BP.sanitizeCustom([
    { mode: 'uniform', width: 999, label: '<b>x</b>' }, { mode: 'uniform', width: 48 },
    { mode: 'bogus', width: 10 }, null, { mode: 'tapered', width: 'abc' }, { mode: 'tapered', width: 3.4 },
  ]);
  assert.equal(c.length, 2);
  assert.equal(c[0].width, 48); assert.ok(!/[<>]/.test(c[0].label)); assert.equal(c[1].width, 3);
  assert.equal(BP.sanitizeCustom('x').length, 0);
  const many = Array.from({ length: 30 }, (_, i) => ({ mode: 'uniform', width: 2 + i }));
  assert.equal(BP.sanitizeCustom(many).length, BP.MAX_CUSTOM);
  let l = BP.addCustom([], 'uniform', 7, 'mine');
  assert.equal(l.length, 1);
  assert.equal(BP.addCustom(l, 'uniform', 7).length, 1);
  assert.equal(BP.addCustom(l, 'tapered', 16).length, 1);
  assert.equal(BP.removeCustom(l, l[0].id).length, 0);
  const mid = (pts) => { const n = (pts.length / 2) - 1; return pts[Math.round(n / 2)]; };
  const thick = (pts, i) => { const n = pts.length / 2; return pts[pts.length - 1 - i][1] - pts[i][1]; };
  const tp = BP.previewPolygonPoints('tapered', 20);
  const half = tp.length / 2;
  assert.ok(tp.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  assert.ok(thick(tp, 0) < 0.35 * thick(tp, Math.floor(half / 2)));
  const up = BP.previewPolygonPoints('uniform', 12);
  assert.ok(Math.abs(thick(up, 0) - thick(up, 10)) < 1e-9);
  for (const [x, y] of BP.previewPolygonPoints('uniform', 48)) assert.ok(x >= 0 && x <= 60 && y >= 0 && y <= 24);
  assert.ok(typeof BP.previewPolygon('calligraphy', 14) === 'string');
});
for (const [name, fn] of asyncT) { try { await fn(); n++; console.log('ok  ' + name); } finally { globalThis.fetch = realFetch; } }

console.log(`\n${n} test groups passed`);
