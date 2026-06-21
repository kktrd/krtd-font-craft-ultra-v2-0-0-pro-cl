/**
 * KRTD Disambiguation Engine — Part 1.2
 * ============================================================================
 * ⚠️ SCOPE NOTE: This is a hand-curated heuristic lookup, NOT a trained
 * language model or true semantic NLP. It surfaces a non-destructive
 * suggestion chip when the converted output matches a KNOWN ambiguous
 * pattern (e.g. ල vs ළ). The primary trie/transliteration output is NEVER
 * silently overwritten — the user always clicks to accept an alternative.
 * ============================================================================
 */

const AMBIGUOUS_PATTERNS = {
  'කලා':  [
    { word: 'කළා',  hint: 'did (verb, retroflex ළ)' },
    { word: 'කලා',  hint: 'art / craft' },
  ],
  'කාලා': [
    { word: 'කාලා', hint: 'having eaten' },
    { word: 'කලා',  hint: 'art / craft' },
  ],
  'බැලා': [
    { word: 'බැලුවා', hint: 'looked / watched (past tense)' },
    { word: 'බැලා',   hint: 'having looked (participle)' },
  ],
  'හැලා': [
    { word: 'හැලුවා', hint: 'fell / dropped (past tense)' },
    { word: 'හැලා',   hint: 'having dropped (participle)' },
  ],
  'වැලා': [
    { word: 'වැළා', hint: 'a climbing plant (noun)' },
    { word: 'වැලා', hint: 'having wrapped (participle)' },
  ],
  'දැලා': [
    { word: 'දැළා', hint: 'net-like (rare/adjective)' },
    { word: 'දැලා', hint: 'having put / placed (participle)' },
  ],
  'ගලා':  [
    { word: 'ගලා',  hint: 'flowing (e.g. water)' },
    { word: 'ගළා',  hint: 'swallowed (rare/regional)' },
  ],
  'මැලා': [
    { word: 'මැලවුණා', hint: 'wilted (past tense)' },
    { word: 'මැලා',    hint: 'having wilted (participle)' },
  ],
};

/** Returns alternative spellings for a known ambiguous Sinhala word, or null. */
export function getDisambiguationSuggestions(sinhalaWord) {
  return AMBIGUOUS_PATTERNS[sinhalaWord] || null;
}

export function hasDisambiguation(sinhalaWord) {
  return Object.prototype.hasOwnProperty.call(AMBIGUOUS_PATTERNS, sinhalaWord);
}
