/**
 * KRTD Agent — Path Predictor.
 * Predicts which glyphs to draw next. Heuristic scoring (documented, not ML):
 *   anchors first -> glyphs derived from a base you already drew (family boost)
 *   -> variations of the glyph you just worked on -> overall usage priority.
 */
import { ANCHORS, FAMILIES, PRIORITY, priorityIndex } from './knowledge.js';
import { ALL_CHARS } from './actionSchema.js';
import { GLYPH_VARIATION_RULES } from '../utils/glyphData.js';

/** A glyph counts as drawn when it has at least one non-eraser stroke. */
export function isDrawn(strokes) {
  return Array.isArray(strokes) && strokes.some((s) => s?.length && !s[0]?.isEraser);
}

export function drawnChars(glyphs) {
  return ALL_CHARS.filter((c) => isDrawn(glyphs?.[c]));
}

const DERIVED_FROM = {};
Object.entries(FAMILIES).forEach(([base, list]) => list.forEach((d) => {
  if (!DERIVED_FROM[d]) DERIVED_FROM[d] = base;
}));

export function predictNextChars(glyphs, selectedChar, n = 8) {
  const drawn = new Set(drawnChars(glyphs));
  const missingAnchors = ANCHORS.filter((a) => !drawn.has(a));
  const variations = new Set(GLYPH_VARIATION_RULES[selectedChar] || []);
  const familyOfSelected = new Set(FAMILIES[selectedChar] || []);

  const scored = [];
  for (const c of ALL_CHARS) {
    if (drawn.has(c)) continue;
    let score = 1000 - priorityIndex(c) * 6;
    let reason = 'common';
    if (missingAnchors.includes(c)) { score += 5000 - ANCHORS.indexOf(c); reason = 'anchor'; }
    else if (familyOfSelected.has(c) && drawn.has(selectedChar)) { score += 900; reason = 'family-now'; }
    else if (DERIVED_FROM[c] && drawn.has(DERIVED_FROM[c])) { score += 450; reason = 'family'; }
    else if (variations.has(c) && drawn.has(selectedChar)) { score += 300; reason = 'variation'; }
    scored.push({ char: c, score, reason, base: DERIVED_FROM[c] || null });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}

export function reasonText(item) {
  switch (item.reason) {
    case 'anchor':     return 'Style anchor — ඔයාගේ අකුරු විලාසය learn කරන්න';
    case 'family-now': return `දැන් ඇන්දු "${item.base}" වගේම හැඩයක් — ලේසියි`;
    case 'family':     return `"${item.base}" ඇඳලා තියෙන නිසා ඒකෙන් පටන් ගන්න පුළුවන්`;
    case 'variation':  return 'මේ අකුරේ වෙනස් රූපයක්';
    default:           return 'වැඩිපුර භාවිතා වන අකුරක්';
  }
}

export { PRIORITY };
