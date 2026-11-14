/**
 * KRTD Font Compiler — Real TTF (TrueType glyf) + OTF (CFF) Engine v2.0
 * Converts canvas centerline+width strokes into closed outline polygons,
 * then assembles a true installable TrueType font using opentype.js.
 *
 * No server, no CLI — runs 100% in-browser.
 *
 * v1.1 changes (Part 2 + Part 3 — additive, non-breaking):
 *   - Winding-direction normalization per contour (Part 2.2 fix)
 *   - PUA-safe codepoint assignment for multi-codepoint ligature glyph keys,
 *     fixing a real collision bug where e.g. "ක්ෂ" silently clobbered the
 *     plain "ක" glyph's cmap entry (Part 2.1, rescoped from full GSUB)
 *   - compileFontDataURL() — base64 data: URL variant for live @font-face
 *     hot-reload preview (Part 3.1), reusing the exact same compiler core
 */
import { buildTrueTypeFont, cleanContour, postScriptName } from './ttfWriter.js';
import { resolveLigatures, buildGSUB, injectTable } from './gsubWriter.js';
import { buildGPOS, buildGDEF, isMarkCode, SIGNS_POST, SIGNS_PRE } from './gposWriter.js';
import { FEATURE_FLAGS } from './featureFlags.js';
import { strokeToContours, normalizeWinding } from './strokeOutline.js';

const UNITS_PER_EM = 1000;
const CANVAS_SIZE  = 500;
const SCALE        = UNITS_PER_EM / CANVAS_SIZE; // 2
const PUA_START    = 0xF100; // Private Use Area base for ligature/composite glyph keys

/**
 * Contours (font units, y-up, outer = clockwise) for one glyph from all its strokes.
 * Geometry lives in strokeOutline.js (smoothed centerline, round caps, union of convex pieces);
 * every contour is winding-normalized so the NONZERO fill rule unions them cleanly.
 */
export function buildGlyphContours(strokes, baselineY) {
  const out = [];
  strokes.forEach((stroke) => {
    if (stroke[0]?.isEraser) return; // skip eraser-only strokes
    strokeToContours(stroke, baselineY, SCALE).forEach((contour) => {
      let poly = contour;
      if (poly.length < 3) return;
      if (FEATURE_FLAGS.ENABLE_WINDING_FIX) poly = normalizeWinding(poly, true);
      out.push(poly);
    });
  });
  return out;
}

/**
 * Part 2.1 fix (rescoped from full GSUB) — safe codepoint assignment.
 * Multi-codepoint Atlas keys (e.g. "ක්ෂ", "ශ්‍රී") are ligature/composite
 * glyphs. Naively using `char.codePointAt(0)` collides with the BASE
 * consonant's own real Unicode mapping (a genuine bug we caught and fixed
 * here). Instead: single-codepoint keys keep their real Unicode mapping;
 * multi-codepoint keys get a stable Private-Use-Area codepoint so they
 * never clobber another glyph's cmap entry.
 *
 * Typing the original Unicode sequence (with or without ZWJ) in apps that use OpenType
 * shaping substitutes the drawn ligature automatically via the GSUB table (gsubWriter.js).
 * This only fires when every component character (e.g. ක, ්, ෂ) is also drawn in the font.
 */
function resolveGlyphCodepoint(char, puaCounterRef) {
  const codepoints = Array.from(char); // grapheme-safe iteration
  if (codepoints.length === 1) {
    return { unicode: char.codePointAt(0), isPUA: false };
  }
  const puaCode = PUA_START + puaCounterRef.count;
  puaCounterRef.count += 1;
  return { unicode: puaCode, isPUA: true };
}

const SIDE_BEARING = 60;   // font units on each side of the drawn shape
const MIN_ADVANCE  = 260;  // narrowest allowed glyph advance
const SIGN_TIGHT = 15, SIGN_LOOSE = 45, SIGN_MIN_ADVANCE = 110;   // spacing vowel signs
const SPACE_ADVANCE = 300;


/** .notdef: a hollow rectangle so missing characters are visible (outer clockwise, inner counter-clockwise). */
function notdefContours() {
  return [
    [{ x: 50, y: 0 }, { x: 50, y: 700 }, { x: 450, y: 700 }, { x: 450, y: 0 }],
    [{ x: 100, y: 50 }, { x: 400, y: 50 }, { x: 400, y: 650 }, { x: 100, y: 650 }],
  ];
}

const FONT_NAMES = {
  copyright:   'Created with KRTD Font Craft Ultra',
  description: 'Custom Sinhala font designed in KRTD Font Craft Ultra',
  version:     'Version 1.000',
};

/**
 * Turns the drawn glyphs into a plain, format-neutral font model (integer outlines).
 * Both the TrueType (.ttf) and the CFF (.otf) writers consume this, so they always match.
 */
export function buildFontModel({ fontName, metrics, glyphs }) {
  const baselineY = metrics.baseline;
  const ascender  = Math.round((metrics.baseline - metrics.ascender) * SCALE);
  const descender = -Math.round((metrics.descender - metrics.baseline) * SCALE);

  const list = [
    { name: '.notdef', unicode: null, advance: Math.round(UNITS_PER_EM * 0.5), contours: notdefContours() },
    { name: 'space', unicode: 32, advance: SPACE_ADVANCE, contours: [] },
  ];
  const puaCounterRef = { count: 0 };
  const puaMap = [];
  const used = new Set([32]);
  let compiledCount = 0;

  Object.entries(glyphs).forEach(([char, strokes]) => {
    const realStrokes = strokes.filter(s => !s[0]?.isEraser);
    if (!realStrokes.length) return;
    let contours = buildGlyphContours(realStrokes, baselineY);
    if (!contours.length) return;

    // Real-world spacing: left-align the drawn shape to a fixed side bearing and
    // set the advance from the shape's actual width.
    let minX = Infinity, maxX = -Infinity;
    contours.forEach(c => c.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }));
    // Vowel signs that sit beside a letter get a tight bearing on the side that touches it.
    const cp0 = char.length === 1 ? char.codePointAt(0) : null;
    const post = cp0 != null && SIGNS_POST.has(cp0), pre = cp0 != null && SIGNS_PRE.has(cp0);
    const lsbU = post ? SIGN_TIGHT : (pre ? SIGN_LOOSE : SIDE_BEARING);
    const rsbU = post ? SIGN_LOOSE : (pre ? SIGN_TIGHT : SIDE_BEARING);
    const dx = lsbU - minX;
    contours = contours.map(c => cleanContour(c.map(p => ({ x: p.x + dx, y: p.y })))).filter(Boolean);
    if (!contours.length) return;
    // Combining signs get zero advance and are attached to their base letter by GPOS.
    const advance = char.length === 1 && isMarkCode(char.codePointAt(0)) ? 0
      : Math.max(post || pre ? SIGN_MIN_ADVANCE : MIN_ADVANCE, Math.round((maxX - minX) + lsbU + rsbU));

    let { unicode, isPUA } = FEATURE_FLAGS.ENABLE_LIGATURE_SAFE_EXPORT
      ? resolveGlyphCodepoint(char, puaCounterRef)
      : { unicode: char.codePointAt(0), isPUA: false };
    if (used.has(unicode) || unicode > 0xFFFF) return;   // duplicate / outside the BMP cmap: skip safely
    used.add(unicode);
    if (isPUA) puaMap.push({ char, puaCodepoint: unicode });

    const seqCps = Array.from(char).map((c) => c.codePointAt(0));
    list.push({ name: `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`, unicode, advance, contours, ...(isPUA ? { sequence: seqCps } : {}) });
    compiledCount++;
  });

  // Zero-width joiner glyph so sequences that contain U+200D can match a ligature.
  if (list.some((g) => g.sequence) && !used.has(0x200d)) {
    list.push({ name: 'uni200D', unicode: 0x200d, advance: 0, contours: [] });
  }

  if (compiledCount === 0) {
    throw new Error('No drawable glyphs found. Draw at least one character first.');
  }

  const familyName = (fontName || '').replace(/[^a-zA-Z0-9-_]/g, '') || 'KRTDFont';
  return {
    model: {
      familyName, styleName: 'Regular', unitsPerEm: UNITS_PER_EM, ascender, descender,
      xHeight: Math.round((metrics.baseline - metrics.xHeight) * SCALE),
      capHeight: Math.round((metrics.baseline - metrics.capHeight) * SCALE),
      names: FONT_NAMES, glyphs: list,
    },
    compiledCount, puaMap,
  };
}

/** True TrueType (glyf) font bytes — the real .ttf. */
export function compileTrueTypeFont(args) {
  const { model, compiledCount, puaMap } = buildFontModel(args);
  return { bytes: buildTrueTypeFont(model), compiledCount, puaMap, model };
}

/**
 * CFF-flavoured OpenType (.otf) via opentype.js (lazy-loaded). CFF wants outer contours
 * counter-clockwise, so outlines are reversed from the shared (TrueType) model.
 */
export async function compileOpenTypeCFF(args) {
  const { default: opentype } = await import('opentype.js');
  const { model, compiledCount, puaMap } = buildFontModel(args);
  const glyphList = model.glyphs.map((g) => {
    const path = new opentype.Path();
    g.contours.forEach((c) => {
      const pts = [...c].reverse();
      path.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
      path.close();
    });
    return new opentype.Glyph({ name: g.name, unicode: g.unicode == null ? undefined : g.unicode, advanceWidth: g.advance, path });
  });
  const font = new opentype.Font({
    familyName: model.familyName, styleName: model.styleName, unitsPerEm: model.unitsPerEm,
    ascender: model.ascender, descender: model.descender, glyphs: glyphList,
    copyright: model.names.copyright, description: model.names.description, version: model.names.version,
    weightClass: 400, manufacturer: 'KRTD Font Craft Ultra',
    postScriptName: postScriptName(model.familyName, model.styleName),
  });
  font.names.uniqueID = { en: `${model.familyName}-${model.styleName};${model.names.version.replace(/^Version\s*/i, '')}` };
  let bytes = new Uint8Array(font.toArrayBuffer());
  const gsub = buildGSUB(resolveLigatures(model.glyphs));
  if (gsub) bytes = injectTable(bytes, 'GSUB', gsub);
  const gpos = buildGPOS(model.glyphs), gdef = buildGDEF(model.glyphs);
  if (gpos) bytes = injectTable(bytes, 'GPOS', gpos);
  if (gdef) bytes = injectTable(bytes, 'GDEF', gdef);
  return { bytes, compiledCount, puaMap, model };
}

function saveBytes(bytes, fileName, mime) {
  const blob = new Blob([bytes], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  const u = a.href; setTimeout(() => URL.revokeObjectURL(u), 1500);
}

function logPua(puaMap) {
  if (puaMap.length > 0) {
    console.info(
      `[KRTD] ${puaMap.length} ligature glyph(s) exported to Private Use Area codepoints:`,
      puaMap.map(p => `${p.char} → U+${p.puaCodepoint.toString(16).toUpperCase()}`).join(', ')
    );
  }
}

/** Compiles a real TrueType font and downloads it as <name>.ttf. @returns {number} glyph count */
export function downloadTTF(fontName, metrics, glyphs) {
  const { bytes, compiledCount, puaMap } = compileTrueTypeFont({ fontName, metrics, glyphs });
  saveBytes(bytes, `${fontName}.ttf`, 'font/ttf');
  logPua(puaMap);
  return compiledCount;
}

/** Compiles a CFF OpenType font and downloads it as <name>.otf. @returns {Promise<number>} glyph count */
export async function downloadOTF(fontName, metrics, glyphs) {
  const { bytes, compiledCount, puaMap } = await compileOpenTypeCFF({ fontName, metrics, glyphs });
  saveBytes(bytes, `${fontName}.otf`, 'font/otf');
  logPua(puaMap);
  return compiledCount;
}

/** Compiles a TrueType font, packs it as WOFF (web font) and downloads <name>.woff. @returns {Promise<number>} glyph count */
export async function downloadWOFF(fontName, metrics, glyphs) {
  const { bytes, compiledCount, puaMap } = compileTrueTypeFont({ fontName, metrics, glyphs });
  const { toWOFF } = await import('./woffWriter.js');
  saveBytes(await toWOFF(bytes), `${fontName}.woff`, 'font/woff');
  logPua(puaMap);
  return compiledCount;
}

/**
 * Compiles to a base64 `data:font/ttf;base64,...` URL (live @font-face hot-reload preview).
 * @returns {{ dataUrl: string, compiledCount: number }}
 */
export function compileFontDataURL(fontName, metrics, glyphs) {
  const { bytes, compiledCount } = compileTrueTypeFont({ fontName, metrics, glyphs });
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { dataUrl: `data:font/ttf;base64,${btoa(binary)}`, compiledCount };
}
