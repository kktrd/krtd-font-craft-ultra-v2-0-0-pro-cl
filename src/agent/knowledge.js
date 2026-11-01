/**
 * KRTD Agent — domain knowledge (heuristic, documented as such).
 * Priority = a practical drawing order: style anchors first, then the most
 * frequently used letters, then vowel signs, then the rarer / derived letters.
 */
import { ALL_CHARS } from './actionSchema.js';
import { GLYPH_SECTIONS } from '../utils/glyphData.js';

export const ANCHORS = ['ක', 'ම', 'න', 'ර', 'ය'];

export const PRIORITY = [
  ...ANCHORS,
  'ව', 'ත', 'ද', 'ස', 'ල', 'ප', 'බ', 'හ', 'ග', 'ට', 'ජ', 'ච', 'ඩ', 'ණ',
  'අ', 'ඉ', 'උ', 'එ', 'ඔ', 'ආ',
  '්', 'ා', 'ි', 'ු', 'ෙ', 'ී', 'ූ', 'ො', 'ේ', 'ැ', 'ං',
  'ඊ', 'ඌ', 'ඒ', 'ඕ', 'ඇ', 'ඈ', 'ඓ', 'ඖ', 'ෑ', 'ෛ', 'ෝ', 'ෞ', 'ෘ', 'ඃ',
  'ශ', 'ෂ', 'ළ', 'ඛ', 'ඝ', 'ඨ', 'ථ', 'ධ', 'ඵ', 'භ', 'ඡ', 'ඣ', 'ෆ',
  'ඟ', 'ඬ', 'ඳ', 'ඹ', 'ඞ', 'ඥ', 'ඤ', 'ක්ෂ', 'ශ්‍රී', 'කෘ', 'ද්‍ර', '෴',
];

/** Derived letters are normally drawn from a base shape: base -> derived[] */
export const FAMILIES = {
  'ග': ['ඝ', 'ඟ'], 'ජ': ['ඣ'], 'ට': ['ඨ'], 'ත': ['ථ'], 'ද': ['ධ', 'ද්‍ර'],
  'ප': ['ඵ'], 'බ': ['භ'], 'ච': ['ඡ'], 'ල': ['ළ'], 'ස': ['ශ', 'ෂ'],
  'න': ['ණ', 'ඤ', 'ඳ'], 'ම': ['ඹ'], 'ඩ': ['ඬ'], 'ක': ['ක්ෂ', 'කෘ'],
  'අ': ['ආ', 'ඇ', 'ඈ'], 'ඉ': ['ඊ'], 'උ': ['ඌ'], 'එ': ['ඒ', 'ඓ'], 'ඔ': ['ඕ', 'ඖ'],
  'ා': ['ැ', 'ෑ'], 'ි': ['ී'], 'ු': ['ූ'], 'ෙ': ['ේ', 'ෛ', 'ො', 'ෝ'],
};

export const SECTION_IDS = ['vowels', 'alpa', 'maha', 'bandi', 'pillam'];
export const SECTIONS = GLYPH_SECTIONS.map((s, i) => ({ id: SECTION_IDS[i], title: s.title, chars: s.chars }));
export const SECTION_OF = {};
SECTIONS.forEach((s) => s.chars.forEach((c) => { SECTION_OF[c] = s.id; }));

export const MARK_CHARS = new Set(SECTIONS.find((s) => s.id === 'pillam').chars);
export const TOTAL_GLYPHS = ALL_CHARS.length;

// Any glyph not in PRIORITY keeps a stable fallback position.
export function priorityIndex(c) {
  const i = PRIORITY.indexOf(c);
  return i === -1 ? PRIORITY.length + ALL_CHARS.indexOf(c) : i;
}
