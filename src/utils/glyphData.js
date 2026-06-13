/**
 * KRTD Glyph Data — Sinhala character sets and variation rules.
 */

export const GLYPH_SECTIONS = [
  {
    title: 'Vowels (පණකුරු)',
    chars: ['අ','ආ','ඇ','ඈ','ඉ','ඊ','උ','ඌ','එ','ඒ','ඓ','ඔ','ඕ','ඖ'],
  },
  {
    title: 'Alpaprana (අල්පප්‍රාණ)',
    chars: ['ක','ග','ච','ජ','ට','ඩ','ණ','ත','ද','න','ප','බ','ම','ය','ර','ල','ව','ස','හ'],
  },
  {
    title: 'Mahaprana (මහාප්‍රාණ)',
    chars: ['ඛ','ඝ','ඡ','ඣ','ඨ','ථ','ධ','ඵ','භ','ළ','ශ','ෂ','ෆ'],
  },
  {
    title: 'Bandi Akuru (බැඳි / සඤ්ඤක)',
    chars: ['ඟ','ඬ','ඳ','ඹ','ඞ','ඥ','ඤ','ක්ෂ','ශ්‍රී','කෘ','ද්‍ර'],
  },
  {
    title: 'Pillam & Symbols (පිල්ලම්)',
    chars: ['්','ා','ැ','ෑ','ි','ී','ු','ූ','ෘ','ෙ','ේ','ෛ','ො','ෝ','ෞ','ං','ඃ','෴'],
  },
];

export const GLYPH_VARIATION_RULES = {
  'අ': ['ආ','ඇ','ඈ'],
  'ඉ': ['ඊ'],
  'උ': ['ඌ'],
  'එ': ['ඒ'],
  'ඔ': ['ඕ'],
  'ක': ['කා','කැ','කෑ','කි','කී','කු','කූ'],
  '්': ['ා','ැ','ෑ','ො','ෝ'],
};

export const DEFAULT_METRICS = {
  ascender:  80,
  capHeight: 140,
  xHeight:   240,
  baseline:  380,
  descender: 450,
};

export const METRIC_LABELS = {
  ascender:  'Ascender',
  capHeight: 'Cap Height',
  xHeight:   'x-Height / Body',
  baseline:  'Baseline',
  descender: 'Descender',
};
