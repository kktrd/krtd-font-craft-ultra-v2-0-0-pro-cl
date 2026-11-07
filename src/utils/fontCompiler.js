/**
 * KRTD Font Compiler — Real OTF/TTF Engine v1.1
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
import opentype from 'opentype.js';
import { FEATURE_FLAGS } from './featureFlags.js';
import { strokeToContours, normalizeWinding } from './strokeOutline.js';

const UNITS_PER_EM = 1000;
const CANVAS_SIZE  = 500;
const SCALE        = UNITS_PER_EM / CANVAS_SIZE; // 2
const PUA_START    = 0xF100; // Private Use Area base for ligature/composite glyph keys

/**
 * Builds an opentype.Path for a single glyph from all its strokes.
 * Geometry lives in strokeOutline.js (smoothed centerline, round caps, union of convex pieces);
 * every contour is winding-normalized so the NONZERO fill rule unions them cleanly.
 */
export function buildGlyphPath(strokes, baselineY) {
  const path = new opentype.Path();
  strokes.forEach((stroke) => {
    if (stroke[0]?.isEraser) return; // skip eraser-only strokes
    strokeToContours(stroke, baselineY, SCALE).forEach((contour) => {
      let poly = contour;
      if (poly.length < 3) return;
      if (FEATURE_FLAGS.ENABLE_WINDING_FIX) poly = normalizeWinding(poly, true);
      path.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) path.lineTo(poly[i].x, poly[i].y);
      path.close();
    });
  });
  return path;
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
 * Known limitation (documented, not hidden): without true OpenType GSUB
 * shaping, these ligature glyphs are reachable via their PUA codepoint
 * but won't auto-substitute when the user types the original multi-char
 * Unicode sequence in third-party software. Use the PUA char directly,
 * or copy it from this app's Atlas/Text Studio output.
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

/** Shift every x coordinate of a path (all command types) by dx. */
function shiftPathX(path, dx) {
  path.commands.forEach((c) => {
    if (typeof c.x  === 'number') c.x  += dx;
    if (typeof c.x1 === 'number') c.x1 += dx;
    if (typeof c.x2 === 'number') c.x2 += dx;
  });
}

const SIDE_BEARING = 60;   // font units on each side of the drawn shape
const MIN_ADVANCE  = 260;  // narrowest allowed glyph advance
const SPACE_ADVANCE = 300;

/**
 * Compiles the full glyph set into an opentype.Font instance.
 */
export function compileOpenTypeFont({ fontName, metrics, glyphs }) {
  const baselineY = metrics.baseline;
  const ascender  = Math.round((metrics.baseline - metrics.ascender) * SCALE);
  const descender = -Math.round((metrics.descender - metrics.baseline) * SCALE);

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: Math.round(UNITS_PER_EM * 0.5),
    path: new opentype.Path(),
  });

  const spaceGlyph = new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: SPACE_ADVANCE,
    path: new opentype.Path(),
  });
  const glyphList = [notdefGlyph, spaceGlyph];
  const puaCounterRef = { count: 0 };
  const puaMap = []; // [{ char, puaCodepoint }] — returned for UI disclosure
  let compiledCount = 0;

  Object.entries(glyphs).forEach(([char, strokes]) => {
    const realStrokes = strokes.filter(s => !s[0]?.isEraser);
    if (!realStrokes.length) return;
    const path = buildGlyphPath(realStrokes, baselineY);
    if (path.commands.length === 0) return;

    // Real-world spacing: left-align the drawn shape to a fixed side bearing and
    // set the advance from the shape's actual width (instead of one fixed width
    // for every glyph, which made wide glyphs overlap and narrow ones gappy).
    const bb = path.getBoundingBox();
    shiftPathX(path, SIDE_BEARING - bb.x1);
    const advanceWidth = Math.max(MIN_ADVANCE, Math.round((bb.x2 - bb.x1) + SIDE_BEARING * 2));

    const { unicode, isPUA } = FEATURE_FLAGS.ENABLE_LIGATURE_SAFE_EXPORT
      ? resolveGlyphCodepoint(char, puaCounterRef)
      : { unicode: char.codePointAt(0), isPUA: false };

    if (isPUA) puaMap.push({ char, puaCodepoint: unicode });

    const glyph = new opentype.Glyph({
      name: `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`,
      unicode,
      advanceWidth,
      path,
    });
    glyphList.push(glyph);
    compiledCount++;
  });

  if (compiledCount === 0) {
    throw new Error('No drawable glyphs found. Draw at least one character first.');
  }

  const font = new opentype.Font({
    familyName: fontName.replace(/[^a-zA-Z0-9-_]/g, '') || 'KRTDFont',
    styleName:  'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender,
    descender,
    glyphs: glyphList,
  });

  return { font, compiledCount, puaMap };
}

/**
 * Compiles and triggers a browser download of the .ttf file.
 * @returns {number} number of glyphs compiled
 */
export function downloadTTF(fontName, metrics, glyphs) {
  const { font, compiledCount, puaMap } = compileOpenTypeFont({ fontName, metrics, glyphs });
  const arrayBuffer = font.toArrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'font/ttf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fontName}.ttf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  { const u = a.href; setTimeout(() => URL.revokeObjectURL(u), 1500); }

  if (puaMap.length > 0) {
    console.info(
      `[KRTD] ${puaMap.length} ligature glyph(s) exported to Private Use Area codepoints:`,
      puaMap.map(p => `${p.char} → U+${p.puaCodepoint.toString(16).toUpperCase()}`).join(', ')
    );
  }
  return compiledCount;
}

/**
 * Part 3.1 — Compiles to a base64 `data:font/ttf;base64,...` URL instead of
 * triggering a download. Used by useLiveFontPreview to inject a live
 * @font-face rule for Canvas → Text Studio hot-reload preview.
 * @returns {{ dataUrl: string, compiledCount: number }}
 */
export function compileFontDataURL(fontName, metrics, glyphs) {
  const { font, compiledCount } = compileOpenTypeFont({ fontName, metrics, glyphs });
  const arrayBuffer = font.toArrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return { dataUrl: `data:font/ttf;base64,${base64}`, compiledCount };
}
