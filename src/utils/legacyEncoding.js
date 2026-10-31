/**
 * KRTD Legacy ASCII Encoding Converter — Part 1.1
 * ============================================================================
 * ⚠️ IMPORTANT SCOPE NOTE (read before wiring into production print workflows)
 * ============================================================================
 * Real legacy Sinhala "ASCII fonts" (FM Abhaya, DL-Manel, Malithi, etc.) each
 * use their OWN non-standardized, vendor-specific byte-to-glyph table tied to
 * that exact font file's cmap. There is no public universal standard, and
 * without the vendor's verified table we cannot claim byte-exact compatibility
 * with any one commercial font.
 *
 * What THIS module provides instead: a fully working, internally consistent,
 * bidirectional "KRTD Legacy Reference Scheme" that implements the SAME real
 * structural mechanics legacy Sinhala fonts rely on:
 *   1. One Sinhala unit (consonant / vowel-sign / independent vowel) <-> one
 *      single ASCII byte (the actual reason these are called "ASCII fonts").
 *   2. Pre-base vowel signs (ෙ ේ ෛ) are physically REORDERED to appear
 *      BEFORE the consonant byte in the legacy stream — exactly matching how
 *      real legacy fonts render Sinhala without Unicode's shaping engine.
 *   3. Composite marks (ො ෝ) are decomposed into their pre-base + post-base
 *      components, the same way real legacy fonts compose them from two
 *      existing glyphs rather than needing a dedicated third glyph.
 *
 * Use this for teaching, internal workflows, or as a starting template — if
 * you need exact compatibility with a specific commercial legacy font, you
 * must substitute that vendor's verified byte table into LEGACY_SCHEME below.
 * ============================================================================
 */

export const LEGACY_SCHEME_NAME = 'KRTD-Legacy-Reference-v1 (FM-style structural pattern)';
export const LEGACY_SCHEME_DISCLAIMER =
  'Reference legacy-style scheme — demonstrates correct FM/DL structural mechanics ' +
  '(byte-per-glyph, pre-base reordering). NOT verified byte-exact against any specific ' +
  'commercial font. Supply your vendor\'s cmap table for production legacy-print compatibility.';

// ── Consonants: one Sinhala consonant -> one ASCII byte ────────────────────
const CONSONANT_TO_LEGACY = {
  // Alpaprana (19) — lowercase a-s
  'ක':'a', 'ග':'b', 'ච':'c', 'ජ':'d', 'ට':'e', 'ඩ':'f', 'ණ':'g', 'ත':'h',
  'ද':'i', 'න':'j', 'ප':'k', 'බ':'l', 'ම':'m', 'ය':'n', 'ර':'o', 'ල':'p',
  'ව':'q', 'ස':'r', 'හ':'s',
  // Mahaprana + ළ + ෆ (13) — uppercase A-M
  'ඛ':'A', 'ඝ':'B', 'ඡ':'C', 'ඣ':'D', 'ඨ':'E', 'ථ':'F', 'ධ':'G', 'ඵ':'H',
  'භ':'I', 'ළ':'J', 'ශ':'K', 'ෂ':'L', 'ෆ':'M',
  // Bandi Akuru simple consonants (7) — uppercase N-T
  'ඟ':'N', 'ඬ':'O', 'ඳ':'P', 'ඹ':'Q', 'ඞ':'R', 'ඥ':'S', 'ඤ':'T',
};

// ── Independent vowels (14) — digits + 4 symbols ────────────────────────────
const INDEP_VOWEL_TO_LEGACY = {
  'අ':'0', 'ආ':'1', 'ඇ':'2', 'ඈ':'3', 'ඉ':'4', 'ඊ':'5', 'උ':'6', 'ඌ':'7',
  'එ':'8', 'ඒ':'9', 'ඓ':'!', 'ඔ':'@', 'ඕ':'#', 'ඖ':'$',
};

// ── Dependent vowel signs — split into PRE-base (reorder before consonant)
//    and POST-base (stay after consonant, same as Unicode logical order) ───
const PRE_BASE_TO_LEGACY = {
  'ෙ': '-',  // e
  'ේ': '=',  // ee
  'ෛ': '[',  // ai
};
const POST_BASE_TO_LEGACY = {
  'ා': '%', 'ැ': '^', 'ෑ': '&', 'ි': '*', 'ී': '(', 'ු': ')', 'ූ': '_',
  'ෘ': '+', 'ෞ': '}', '්': ';', 'ං': ':', 'ඃ': '~',
};

// Composite marks that decompose into [PRE byte][consonant][POST byte]
const COMPOSITE_DECOMPOSE = {
  'ො': { pre: '-', post: '%' }, // o  = kombuva(e) + aelapilla(aa)
  'ෝ': { pre: '-', post: '&' }, // oo = kombuva(e) + diga-aelapilla(aae)
};

// ── Build reverse lookup tables once (avoid hand-duplicated typos) ──────────
function invert(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[v] = k;
  return out;
}
const LEGACY_TO_CONSONANT   = invert(CONSONANT_TO_LEGACY);
const LEGACY_TO_INDEP_VOWEL = invert(INDEP_VOWEL_TO_LEGACY);
const LEGACY_TO_PRE_BASE    = invert(PRE_BASE_TO_LEGACY);
const LEGACY_TO_POST_BASE   = invert(POST_BASE_TO_LEGACY);

const PRE_E_BYTE = PRE_BASE_TO_LEGACY['ෙ'];   // '-'  — the only byte that can start a 3-byte composite
const POST_AA_BYTE  = POST_BASE_TO_LEGACY['ා']; // '%'
const POST_AAE_BYTE = POST_BASE_TO_LEGACY['ෑ']; // '&'

// ============================================================================
// UNICODE -> LEGACY
// ============================================================================
export function unicodeToLegacy(text) {
  if (!text) return '';
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (CONSONANT_TO_LEGACY[ch]) {
      const cByte = CONSONANT_TO_LEGACY[ch];
      let j = i + 1;
      let pre = '';
      let post = '';
      if (text[j] === 'ො')      { pre = PRE_E_BYTE; post += POST_AA_BYTE;  j++; }
      else if (text[j] === 'ෝ') { pre = PRE_E_BYTE; post += POST_AAE_BYTE; j++; }
      else if (PRE_BASE_TO_LEGACY[text[j]]) { pre = PRE_BASE_TO_LEGACY[text[j]]; j++; }
      // any number of further post-base marks (e.g. ිං, ාං, ්)
      while (j < text.length && POST_BASE_TO_LEGACY[text[j]]) { post += POST_BASE_TO_LEGACY[text[j]]; j++; }

      out += pre + cByte + post;
      i = j; continue;
    }

    if (INDEP_VOWEL_TO_LEGACY[ch]) { out += INDEP_VOWEL_TO_LEGACY[ch]; i += 1; continue; }

    // Not a recognized Sinhala unit (space, Latin text, punctuation, digit) — pass through
    out += ch; i += 1;
  }
  return out;
}

// ============================================================================
// LEGACY -> UNICODE
// ============================================================================
export function legacyToUnicode(text) {
  if (!text) return '';
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // PRE-base byte — consonant follows, optionally a 3rd byte completes a composite
    if (LEGACY_TO_PRE_BASE[ch]) {
      const consonantByte = text[i + 1];
      const consonantChar = consonantByte ? LEGACY_TO_CONSONANT[consonantByte] : null;

      if (!consonantChar) { out += ch; i += 1; continue; } // malformed input, pass through safely

      let j = i + 2;
      let marks = '';
      if (ch === PRE_E_BYTE && text[j] === POST_AA_BYTE)       { marks = 'ො'; j++; }
      else if (ch === PRE_E_BYTE && text[j] === POST_AAE_BYTE) { marks = 'ෝ'; j++; }
      else marks = LEGACY_TO_PRE_BASE[ch];
      while (j < text.length && LEGACY_TO_POST_BASE[text[j]]) { marks += LEGACY_TO_POST_BASE[text[j]]; j++; }
      out += consonantChar + marks;
      i = j; continue;
    }

    // Consonant byte — any number of POST-base bytes follow
    if (LEGACY_TO_CONSONANT[ch]) {
      let j = i + 1;
      let marks = '';
      while (j < text.length && LEGACY_TO_POST_BASE[text[j]]) { marks += LEGACY_TO_POST_BASE[text[j]]; j++; }
      out += LEGACY_TO_CONSONANT[ch] + marks;
      i = j; continue;
    }

    // Independent vowel byte
    if (LEGACY_TO_INDEP_VOWEL[ch]) { out += LEGACY_TO_INDEP_VOWEL[ch]; i += 1; continue; }

    // Unrecognized byte — pass through unchanged
    out += ch; i += 1;
  }
  return out;
}

/** Quick sanity round-trip check — useful for debugging/tests. */
export function verifyRoundTrip(unicodeText) {
  const legacy   = unicodeToLegacy(unicodeText);
  const restored = legacyToUnicode(legacy);
  return { legacy, restored, matches: restored === unicodeText };
}
