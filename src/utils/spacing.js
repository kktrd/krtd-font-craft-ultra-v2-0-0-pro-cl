// Per-glyph manual spacing (extra left / right side bearing, in font units). Pure + safe localStorage persistence.

export const SPACING_KEY = 'krtd_glyph_spacing_v1';
export const SPACING_LIMITS = { min: -50, max: 150, step: 5 };
export const MAX_ENTRIES = 600;

const clampN = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(SPACING_LIMITS.min, Math.min(SPACING_LIMITS.max, n));
};

/** raw → { [char]: { l, r } } with only non-zero, valid entries. */
export function sanitizeSpacing(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const k of Object.keys(raw)) {
    if (k.length === 0 || k.length > 12 || /[<>\u0000-\u001f]/.test(k)) continue;
    const v = raw[k];
    if (!v || typeof v !== 'object') continue;
    const l = clampN(v.l), r = clampN(v.r);
    if (l === 0 && r === 0) continue;
    out[k] = { l, r };
    if (++n >= MAX_ENTRIES) break;
  }
  return out;
}

export function setSpacing(map, char, patch) {
  const base = sanitizeSpacing(map);
  const cur = base[char] || { l: 0, r: 0 };
  const next = { l: clampN(patch.l ?? cur.l), r: clampN(patch.r ?? cur.r) };
  const copy = { ...base };
  if (next.l === 0 && next.r === 0) delete copy[char]; else copy[char] = next;
  return sanitizeSpacing(copy);
}

export const getSpacing = (map, char) => (map && map[char]) || { l: 0, r: 0 };

export function loadSpacing() {
  try { return sanitizeSpacing(JSON.parse(localStorage.getItem(SPACING_KEY) || '{}')); }
  catch { return {}; }
}
export function saveSpacing(map) {
  const m = sanitizeSpacing(map);
  try { localStorage.setItem(SPACING_KEY, JSON.stringify(m)); } catch { /* storage blocked */ }
  return m;
}
