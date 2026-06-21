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
      const next = text[i + 1];

      if (next === 'ො') { out += PRE_E_BYTE + cByte + POST_AA_BYTE;  i += 2; continue; }
      if (next === 'ෝ') { out += PRE_E_BYTE + cByte + POST_AAE_BYTE; i += 2; continue; }
      if (next && PRE_BASE_TO_LEGACY[next])  { out += PRE_BASE_TO_LEGACY[next] + cByte; i += 2; continue; }
      if (next && POST_BASE_TO_LEGACY[next]) { out += cByte + POST_BASE_TO_LEGACY[next]; i += 2; continue; }

      out += cByte; i += 1; continue; // inherent 'a', no dependent sign follows
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

      if (ch === PRE_E_BYTE) {
        const third = text[i + 2];
        if (third === POST_AA_BYTE)  { out += consonantChar + 'ො'; i += 3; continue; }
        if (third === POST_AAE_BYTE) { out += consonantChar + 'ෝ'; i += 3; continue; }
      }
      out += consonantChar + LEGACY_TO_PRE_BASE[ch]; // reorder back to Unicode logical order
      i += 2; continue;
    }

    // Consonant byte — optional POST-base byte follows
    if (LEGACY_TO_CONSONANT[ch]) {
      const consonantChar = LEGACY_TO_CONSONANT[ch];
      const next = text[i + 1];
      if (next && LEGACY_TO_POST_BASE[next]) { out += consonantChar + LEGACY_TO_POST_BASE[next]; i += 2; continue; }
      out += consonantChar; i += 1; continue;
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
