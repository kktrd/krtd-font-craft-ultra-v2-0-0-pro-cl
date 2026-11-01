/**
 * KRTD Feature Flags — Step 0 Rollback Architecture
 * Every V3 module is gated by a flag here. Disabling a flag instantly
 * reverts behavior to v2.0 PRO baseline WITHOUT removing code or
 * requiring a redeploy rollback — flip to false, save, redeploy (or
 * override via env var if wired through import.meta.env in the future).
 *
 * Rule: v2.0 PRO core (themes, Supabase sync, JSON backup, Trie tokenizer)
 * NEVER reads these flags — only net-new V3 modules check them, so turning
 * everything off here always returns the app to the exact v2.0 PRO behavior.
 */
export const FEATURE_FLAGS = {
  // Part 1
  ENABLE_WORKER_TRANSLITERATION: true,   // Off-thread Singlish->Sinhala engine
  ENABLE_LEGACY_ENCODING:        true,   // Unicode <-> Legacy ASCII converter
  ENABLE_DISAMBIGUATION:         true,   // ල/ළ heuristic suggestion chip

  // Part 2
  ENABLE_WINDING_FIX:            true,   // TTF outline winding normalization
  ENABLE_LIGATURE_SAFE_EXPORT:   true,   // PUA fallback for composite glyphs

  // Part 3
  ENABLE_LIVE_FONT_PREVIEW:      true,   // Canvas -> Text Studio hot-reload
  ENABLE_METRICS_CSS_BINDING:    true,   // Metrics sliders -> CSS sync button
  ENABLE_QUICK_REF_ROUTING:      true,   // Quick Reference -> Canvas jump

  // Part 4
  ENABLE_STYLE_PROFILE_LEARNING: true,   // Brush-profile learning from anchors

  // v4 — in-app assistant (local brain + optional Claude via /api/agent)
  ENABLE_AGENT:                  true,
};

/** Safe accessor — always returns false for unknown keys instead of throwing. */
export function isEnabled(flagName) {
  return FEATURE_FLAGS[flagName] === true;
}
