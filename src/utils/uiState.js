// Remembered open/closed state of collapsible panels. Pure helpers + safe localStorage.

export const ACC_KEY = 'krtd_acc_v1';
const MAX = 80;

/** raw → { [id]: boolean } with only valid short ids. */
export function sanitizeAcc(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const k of Object.keys(raw)) {
    if (typeof raw[k] !== 'boolean' || k.length === 0 || k.length > 60 || /[<>\u0000-\u001f]/.test(k)) continue;
    out[k] = raw[k];
    if (++n >= MAX) break;
  }
  return out;
}

export const isOpen = (map, id, def = false) => (map && typeof map[id] === 'boolean' ? map[id] : def);

export function loadAcc() {
  try { return sanitizeAcc(JSON.parse(localStorage.getItem(ACC_KEY) || '{}')); }
  catch { return {}; }
}

/** Store one panel's state, merging with whatever is already saved (panels save independently). */
export function saveOpen(id, open) {
  const next = sanitizeAcc({ ...loadAcc(), [id]: !!open });
  try { localStorage.setItem(ACC_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
