// Font coverage report: which Sinhala characters are drawn, what is missing, what to draw next. Pure.
import { GLYPH_SECTIONS } from './glyphData.js';

/** Everyday letters first (a practical ordering for getting a usable font quickly, not a corpus statistic). */
export const PRIORITY = [
  'ක','ත','ර','ද','න','ව','ම','ය','ස','ල','හ','ප','ට','බ','ග','ජ','ච','ඩ','ශ','ෂ',
  'ා','ි','ී','ු','ූ','ෙ','ේ','්','ො','ෝ','ැ','ෑ','ෛ','ෘ','ං',
  'අ','ආ','ඉ','ඊ','උ','එ','ඒ','ඔ','ඇ','ඈ','ඌ','ඕ','ඓ','ඖ',
  'ඛ','ඝ','ඡ','ඣ','ඨ','ථ','ධ','ඵ','භ','ළ','ෆ','ණ','ඞ','ඤ','ඥ','ඟ','ඬ','ඳ','ඹ','ඃ','ෞ','ක්ෂ','ශ්‍රී','කෘ','ද්‍ර','෴',
];

export const hasInk = (strokes) => Array.isArray(strokes) && strokes.some((s) => Array.isArray(s) && s.length && !s[0]?.isEraser);

/** Split vowel signs can be built by the shaper from their parts, so they count as covered. */
const COMPOSED = { 'ො': ['ෙ', 'ා'], 'ෝ': ['ෙ', 'ා', '්'] };

export function coverageReport(glyphs, sections = GLYPH_SECTIONS) {
  const drawn = (c) => hasInk(glyphs[c]);
  const composedOk = (c) => !!COMPOSED[c] && COMPOSED[c].every(drawn) && !drawn(c);
  const rows = sections.map((sec) => {
    const have = sec.chars.filter((c) => drawn(c));
    const viaParts = sec.chars.filter((c) => composedOk(c));
    const missing = sec.chars.filter((c) => !drawn(c) && !composedOk(c));
    return { title: sec.title, total: sec.chars.length, drawn: have.length, viaParts, missing };
  });
  const all = sections.flatMap((s) => s.chars);
  const done = all.filter((c) => drawn(c) || composedOk(c)).length;
  const missingAll = all.filter((c) => !drawn(c) && !composedOk(c));
  const rank = (c) => { const i = PRIORITY.indexOf(c); return i < 0 ? 999 : i; };
  const next = missingAll.slice().sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  const core = PRIORITY.slice(0, 35);
  const coreMissing = core.filter((c) => all.includes(c) && !drawn(c) && !composedOk(c));
  const coreTotal = core.filter((c) => all.includes(c)).length;
  const percent = all.length ? Math.round((done / all.length) * 100) : 0;
  const level = percent >= 95 ? 'complete' : coreMissing.length === 0 ? 'usable' : percent >= 40 ? 'partial' : 'starting';
  return { rows, total: all.length, done, percent, next, coreMissing, coreTotal, level };
}
