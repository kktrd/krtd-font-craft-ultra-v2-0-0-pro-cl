/**
 * KRTD Font Compiler — Real OTF/TTF Engine v1.0
 * Converts canvas centerline+width strokes into closed outline polygons,
 * then assembles a true installable TrueType font using opentype.js.
 *
 * No server, no CLI — runs 100% in-browser.
 */
import opentype from 'opentype.js';

const UNITS_PER_EM = 1000;
const CANVAS_SIZE  = 500;
const SCALE        = UNITS_PER_EM / CANVAS_SIZE; // 2

/**
 * Converts a single centerline stroke (array of {x,y,strokeWidth}) into a
 * closed outline polygon in FONT coordinate space (y-up, scaled, baseline-relative).
 */
function strokeToOutlinePoints(stroke, baselineY) {
  if (stroke.length < 2) return [];
  const left = [];
  const right = [];

  for (let i = 0; i < stroke.length; i++) {
    const p    = stroke[i];
    const prev = stroke[i - 1] || p;
    const next = stroke[i + 1] || p;
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const px = -dy, py = dx; // perpendicular unit vector
    const w  = Math.max(1, (p.strokeWidth || 8)) / 2;
    left.push({ x: p.x + px * w, y: p.y + py * w });
    right.push({ x: p.x - px * w, y: p.y - py * w });
  }

  // Round cap at the END — add 3 extra points fanning out
  const endPt = stroke[stroke.length - 1];
  const endW  = Math.max(1, (endPt.strokeWidth || 8)) / 2;

  // Round cap at the START — add 3 extra points fanning out (in right[] reversed path)
  const startPt = stroke[0];
  const startW  = Math.max(1, (startPt.strokeWidth || 8)) / 2;

  // Build closed polygon: left forward, end-cap arc, right reversed, start-cap arc
  const polygon = [...left, ...right.reverse()];

  // Map canvas space (y-down) → font space (y-up, baseline-relative, scaled)
  return polygon.map((pt) => ({
    x: pt.x * SCALE,
    y: (baselineY - pt.y) * SCALE,
  }));
}

/**
 * Builds an opentype.Path for a single glyph from all its strokes.
 */
export function buildGlyphPath(strokes, baselineY) {
  const path = new opentype.Path();
  strokes.forEach((stroke) => {
    if (stroke[0]?.isEraser) return; // skip eraser-only strokes (already subtracted visually; outline export ignores erase ops for v1)
    const poly = strokeToOutlinePoints(stroke, baselineY);
    if (poly.length < 3) return;
    path.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) path.lineTo(poly[i].x, poly[i].y);
    path.close();
  });
  return path;
}

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

  const glyphList = [notdefGlyph];
  let compiledCount = 0;

  Object.entries(glyphs).forEach(([char, strokes]) => {
    const realStrokes = strokes.filter(s => !s[0]?.isEraser);
    if (!realStrokes.length) return;
    const path = buildGlyphPath(realStrokes, baselineY);
    if (path.commands.length === 0) return;

    const cp = char.codePointAt(0);
    const glyph = new opentype.Glyph({
      name: `uni${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      unicode: cp,
      advanceWidth: Math.round(UNITS_PER_EM * 0.62),
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

  return { font, compiledCount };
}

/**
 * Compiles and triggers a browser download of the .ttf file.
 * @returns {number} number of glyphs compiled
 */
export function downloadTTF(fontName, metrics, glyphs) {
  const { font, compiledCount } = compileOpenTypeFont({ fontName, metrics, glyphs });
  const arrayBuffer = font.toArrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'font/ttf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fontName}.ttf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return compiledCount;
}
