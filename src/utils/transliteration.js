/**
 * KRTD Singhela Transliteration Engine v2.2
 * Grapheme-cluster aware phonetic → Sinhala Unicode converter.
 * Safe for all modern browsers — no lookbehind regex.
 */

const VOWEL_MAP = [
  { key: 'aee', ind: 'ඈ', dep: 'ෑ' },
  { key: 'aa',  ind: 'ආ', dep: 'ා' },
  { key: 'ae',  ind: 'ඇ', dep: 'ැ' },
  { key: 'ii',  ind: 'ඊ', dep: 'ී' },
  { key: 'uu',  ind: 'ඌ', dep: 'ූ' },
  { key: 'ee',  ind: 'ඒ', dep: 'ේ' },
  { key: 'oo',  ind: 'ඕ', dep: 'ෝ' },
  { key: 'ai',  ind: 'ඓ', dep: 'ෛ' },
  { key: 'au',  ind: 'ඖ', dep: 'ෞ' },
  { key: 'a',   ind: 'අ', dep: ''   },
  { key: 'i',   ind: 'ඉ', dep: 'ි' },
  { key: 'u',   ind: 'උ', dep: 'ු' },
  { key: 'e',   ind: 'එ', dep: 'ෙ' },
  { key: 'o',   ind: 'ඔ', dep: 'ො' },
];

const CONSONANT_MAP = [
  { key: 'ksh',  val: 'ක්ෂ' }, { key: 'nndh', val: 'ඳ'  }, { key: 'nnd',  val: 'ඳ'  },
  { key: 'nng',  val: 'ඟ'  }, { key: 'mmb',  val: 'ඹ'  }, { key: 'nh',   val: 'ංහ' },
  { key: 'ng',   val: 'ං'  }, { key: 'ch',   val: 'ච'  }, { key: 'kh',   val: 'ක'  },
  { key: 'gh',   val: 'ඝ'  }, { key: 'jh',   val: 'ඣ'  }, { key: 'th',   val: 'ත'  },
  { key: 'dh',   val: 'ද'  }, { key: 'shh',  val: 'ෂ'  }, { key: 'sh',   val: 'ශ'  },
  { key: 'ph',   val: 'ඵ'  }, { key: 'bh',   val: 'භ'  }, { key: 'lh',   val: 'ළ'  },
  { key: 'c',    val: 'ච'  }, { key: 'k',    val: 'ක'  }, { key: 'g',    val: 'ග'  }, { key: 'j',    val: 'ජ'  },
  { key: 't',    val: 'ට'  }, { key: 'd',    val: 'ද'  }, { key: 'D',    val: 'ඩ'  },
  { key: 'n',    val: 'න'  }, { key: 'p',    val: 'ප'  }, { key: 'b',    val: 'බ'  },
  { key: 'm',    val: 'ම'  }, { key: 'y',    val: 'ය'  }, { key: 'r',    val: 'ර'  },
  { key: 'l',    val: 'ල'  }, { key: 'v',    val: 'ව'  }, { key: 'w',    val: 'ව'  },
  { key: 's',    val: 'ස'  }, { key: 'h',    val: 'හ'  }, { key: 'f',    val: 'ෆ'  },
  { key: 'T',    val: 'ඨ'  }, { key: 'N',    val: 'ණ'  }, { key: 'L',    val: 'ළ'  }, { key: 'R',    val: 'ඍ'  },
];

const EXPLICIT_LIGATURES = [
  { key: 'shree', val: 'ශ්‍රී'  },
  { key: 'shri',  val: 'ශ්‍රි'  },
  { key: 'gnyaa', val: 'ඥා'  },
  { key: 'gnya',  val: 'ඥ'   },
  { key: 'jnyaa', val: 'ඥා'  },
  { key: 'jnya',  val: 'ඥ'   },
  { key: 'kshaa', val: 'ක්ෂා' },
  { key: 'ksha',  val: 'ක්ෂ'  },
  { key: 'ndra',  val: 'න්‍ද්‍ර' },
  { key: 'ntha',  val: 'න්‍ත'  },
];

/**
 * Normalize accidental leading capitals (mobile keyboards, sentence starts).
 *  - First word of a line / sentence: leading capital is always lowercased
 *    ("Mama" -> "mama", "Pasal" -> "pasal").
 *  - Mid-sentence words: lowercased too, EXCEPT when the capital is a real
 *    scheme letter (D N L R T) which is then kept as the retroflex consonant.
 *  - ALL-CAPS words ("DNA") are left untouched.
 */
const SCHEME_CAPS = 'DNLRT';
function normalizeLeadingCaps(text) {
  if (!text) return text;
  return text.replace(/[A-Za-z]+/g, (word, offset) => {
    if (word.length < 2) return word;
    const f = word[0], s2 = word[1];
    if (!(f >= 'A' && f <= 'Z' && s2 >= 'a' && s2 <= 'z')) return word;
    const before = text.slice(0, offset).replace(/[ \t]+$/, '');
    const sentenceStart = before === '' || /[\n.!?]$/.test(before);
    if (sentenceStart || SCHEME_CAPS.indexOf(f) === -1) return f.toLowerCase() + word.slice(1);
    return word;
  });
}

export function convertSinglishToSinhala(text) {
  if (!text) return '';
  text = normalizeLeadingCaps(text);

  let result = '';
  let idx = 0;

  while (idx < text.length) {
    // 1. Explicit ligatures
    let ligMatch = null;
    for (const lig of EXPLICIT_LIGATURES) {
      if (text.startsWith(lig.key, idx)) { ligMatch = lig; break; }
    }
    if (ligMatch) { result += ligMatch.val; idx += ligMatch.key.length; continue; }

    // 2. Consonant
    let cons = null;
    for (const c of CONSONANT_MAP) {
      if (text.startsWith(c.key, idx)) { cons = c; break; }
    }

    if (cons && cons.key === 'ng') {
      // 'ng' + vowel -> ඟ (nga);  'ng' before consonant / end -> ං (anusvara)
      const after = idx + 2;
      const vM = VOWEL_MAP.find(v => text.startsWith(v.key, after));
      if (vM) { result += 'ඟ' + vM.dep; idx = after + vM.key.length; }
      else    { result += 'ං'; idx = after; }
      continue;
    }

    if (cons) {
      let ci = idx + cons.key.length;
      const base = cons.val;
      let mod = '';

      if (text.startsWith('ru', ci)) {
        mod = 'ෘ'; ci += 2;
      } else if (text.startsWith('r', ci) && !text.startsWith('rr', ci)) {
        mod = '්‍ර'; ci += 1;
        const vM = VOWEL_MAP.find(v => text.startsWith(v.key, ci));
        if (vM) { mod += vM.dep; ci += vM.key.length; } else { mod += '්'; }
      } else if (text.startsWith('y', ci) && !text.startsWith('yy', ci)) {
        ci += 1;
        const vM = VOWEL_MAP.find(v => text.startsWith(v.key, ci));
        if (vM) { mod = '්‍ය' + vM.dep; ci += vM.key.length; }
        else { ci -= 1; mod = '්'; }
      } else {
        const vM = VOWEL_MAP.find(v => text.startsWith(v.key, ci));
        if (vM) { mod = vM.dep; ci += vM.key.length; } else { mod = '්'; }
      }

      result += base + mod;
      idx = ci;
    } else {
      // 3. Standalone vowel
      const vowel = VOWEL_MAP.find(v => text.startsWith(v.key, idx));
      if (vowel) { result += vowel.ind; idx += vowel.key.length; }
      else { result += text[idx]; idx++; }
    }
  }
  return result;
}

export function countSinhalaWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
