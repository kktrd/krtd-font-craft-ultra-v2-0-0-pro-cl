// Typing test sheet: sample Sinhala lines rendered with the exported font via real text shaping.
import { hasInk } from './coverage.js';

export const SAMPLE_LINES = [
  { id: 'greet',  text: 'ආයුබෝවන්' },
  { id: 'lanka',  text: 'ශ්‍රී ලංකාව' },
  { id: 'thanks', text: 'ස්තූතියි' },
  { id: 'udhr',   text: 'සියලු මනුෂ්‍යයෝ නිදහස්ව උපත ලබා ඇත' },
  { id: 'kssa',   text: 'ක්ෂණික ප්‍රකාශය' },
  { id: 'nums',   text: 'අ ආ ඇ ඈ ඉ ඊ උ ඌ එ ඒ ඔ ඕ' },
];

const IGNORE = new Set([' ', '‍', '‌', '\n']);
const PARTS = { 'ො': ['ෙ', 'ා'], 'ෝ': ['ෙ', 'ා', '්'], 'ෞ': ['ෙ', 'ෟ'] };

/** Characters of a line that the font cannot draw (a split vowel counts as drawn when its parts are). */
export function missingChars(text, glyphs) {
  const drawn = (c) => hasInk(glyphs[c]);
  const miss = new Set();
  for (const c of Array.from(text)) {
    if (IGNORE.has(c) || drawn(c)) continue;
    const parts = PARTS[c];
    if (parts && parts.every(drawn)) continue;
    miss.add(c);
  }
  return [...miss];
}

export function sheetPlan(glyphs, lines = SAMPLE_LINES) {
  return lines.map((l) => ({ ...l, missing: missingChars(l.text, glyphs) }));
}

/** Combining signs are shown on a dotted circle so they stay readable on their own. */
export const showable = (c) => (/\p{M}/u.test(c) ? `\u25cc${c}` : c);

/** Draws the sheet on a canvas (browser only). Returns the canvas. */
export function drawSheet(canvas, { family, fontName, glyphs, plan }) {
  const W = 1400, PAD = 60;
  const sizes = [72, 44, 28];
  const perLine = 14 + sizes.reduce((a, z) => a + z + 14, 0) + 30;
  const H = 150 + plan.length * perLine + 40;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 34px system-ui, sans-serif'; ctx.fillText(`${fontName || 'KRTD Font'} — Typing Test`, PAD, 70);
  ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = '#475569';
  ctx.fillText('Rendered with the font itself (OpenType shaping). Lines marked "missing" use fallback glyphs for the listed letters.', PAD, 100);
  let y = 150;
  plan.forEach((line) => {
    ctx.fillStyle = line.missing.length ? '#b45309' : '#047857';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(line.missing.length ? `Missing: ${line.missing.map(showable).join('  ')}` : 'All letters drawn', PAD, y);
    y += 14;
    sizes.forEach((sz) => {
      y += sz + 14;
      ctx.fillStyle = '#0f172a';
      ctx.font = `${sz}px "${family}", sans-serif`;
      ctx.fillText(line.text, PAD, y, W - PAD * 2);
    });
    y += 30;
  });
  return canvas;
}
