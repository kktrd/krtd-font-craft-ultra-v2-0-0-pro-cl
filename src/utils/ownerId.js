/**
 * Cloud owner id.
 *  - signed-in user  -> their Supabase auth UUID
 *  - guest           -> "g:<random uuid>", created once per device and kept in localStorage
 * The database keys projects by (owner, font name), so two guests (or two users) can use the
 * same font name without overwriting each other. (Needs the v4.5 SQL; see supabase/.)
 */
const KEY = 'krtd_guest_key';
const GUEST_RE = /^g:[0-9a-f-]{32,}$/i;
let memoryKey = null; // used when localStorage is blocked

function randomId() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  const b = new Uint8Array(16);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function isGuestOwner(id) { return typeof id === 'string' && GUEST_RE.test(id); }

export function getGuestOwner() {
  try {
    const v = localStorage.getItem(KEY);
    if (isGuestOwner(v)) return v;
    const fresh = `g:${randomId()}`;
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    if (!memoryKey) memoryKey = `g:${randomId()}`;
    return memoryKey;
  }
}

/** Owner id for cloud rows: auth user id, else the per-device guest id. */
export function ownerIdFor(authUser) {
  return (authUser && authUser.id) || getGuestOwner();
}
