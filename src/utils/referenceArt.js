// Reference Artwork (FontCreator-style tracing image): data model, CSS mapping, image fitting and a
// tiny external store so the image survives tab switches and reloads (settings → localStorage, image → IndexedDB).
// Pure helpers first (unit-tested), browser persistence last (every call is guarded).

export const REF_KEY = 'krtd_refart_v1';
export const REF_LIMITS = { opacity: [5, 100], scale: [10, 400], move: [-150, 150], rot: [-180, 180], contrast: [50, 300], maxPx: 1600 };

export const REF_DEFAULT = Object.freeze({
  src: '', visible: true, adjust: false,
  opacity: 45, scale: 100, x: 0, y: 0, rot: 0, flip: false,
  contrast: 160, gray: true, invert: false,
});

const clampN = (v, [a, b], d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };

/** Safe state from anything (bad localStorage, old versions). */
export function sanitizeRef(o) {
  const s = o && typeof o === 'object' ? o : {};
  return {
    src: typeof s.src === 'string' && /^data:image\/(png|jpe?g|webp);base64,/i.test(s.src) ? s.src : '',
    visible: s.visible !== false, adjust: !!s.adjust,
    opacity: clampN(s.opacity, REF_LIMITS.opacity, REF_DEFAULT.opacity),
    scale: clampN(s.scale, REF_LIMITS.scale, 100),
    x: clampN(s.x, REF_LIMITS.move, 0), y: clampN(s.y, REF_LIMITS.move, 0),
    rot: clampN(s.rot, REF_LIMITS.rot, 0), flip: !!s.flip,
    contrast: clampN(s.contrast, REF_LIMITS.contrast, REF_DEFAULT.contrast),
    gray: s.gray !== false, invert: !!s.invert,
  };
}

/** Longest side ≤ max, aspect kept, never upscaled. */
export function fitSize(w, h, max = REF_LIMITS.maxPx) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/**
 * CSS for the overlay <img>. x / y are % of the canvas, scale is % of the canvas width.
 * On dark themes the picture is inverted and screen-blended so dark handwriting shows as light lines.
 */
export function refCss(st, dark) {
  const s = sanitizeRef(st);
  const inv = s.invert !== !!dark;
  const filter = `${s.gray ? 'grayscale(1) ' : ''}contrast(${s.contrast}%)${inv ? ' invert(1)' : ''}`;
  return {
    position: 'absolute', left: `${50 + s.x}%`, top: `${50 + s.y}%`, width: `${s.scale}%`, height: 'auto',
    transform: `translate(-50%, -50%) rotate(${s.rot}deg) scaleX(${s.flip ? -1 : 1})`,
    opacity: s.opacity / 100, filter, mixBlendMode: dark ? 'screen' : 'multiply',
    maxWidth: 'none', userSelect: 'none', WebkitUserDrag: 'none',
  };
}

/** Pointer drag (px) → new x/y percent of the canvas size; pinch ratio → new scale. */
export function dragTo(st, dxPx, dyPx, canvasPx) {
  const s = sanitizeRef(st);
  if (!(canvasPx > 0)) return { x: s.x, y: s.y };
  return {
    x: clampN(s.x + (dxPx / canvasPx) * 100, REF_LIMITS.move, s.x),
    y: clampN(s.y + (dyPx / canvasPx) * 100, REF_LIMITS.move, s.y),
  };
}
export const pinchTo = (st, ratio) => clampN(sanitizeRef(st).scale * (Number.isFinite(ratio) && ratio > 0 ? ratio : 1), REF_LIMITS.scale, 100);

// ── external store ───────────────────────────────────────────────────────────
let state = { ...REF_DEFAULT };
const subs = new Set();
let loaded = false;

export const getRef = () => state;
export const subscribeRef = (fn) => { subs.add(fn); return () => subs.delete(fn); };

const IDB = 'krtd_refart_db';
const idb = () => new Promise((res, rej) => {
  try {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  } catch (e) { rej(e); }
});
const idbOp = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', mode); const out = fn(tx.objectStore('kv'));
    tx.oncomplete = () => { db.close(); res(out && out.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
};

function persist(prevSrc) {
  try { const { src, ...rest } = state; localStorage.setItem(REF_KEY, JSON.stringify(rest)); } catch (e) { /* private mode */ }
  if (state.src !== prevSrc) {
    if (state.src) idbOp('readwrite', (st) => st.put(state.src, 'img')).catch(() => {});
    else idbOp('readwrite', (st) => st.delete('img')).catch(() => {});
  }
}

export function setRef(patch) {
  const prev = state.src;
  state = sanitizeRef({ ...state, ...patch });
  subs.forEach((f) => f());
  persist(prev);
}
export const resetRefTransform = () => setRef({ scale: 100, x: 0, y: 0, rot: 0, flip: false, opacity: 45, contrast: 160, gray: true, invert: false });
export const clearRef = () => setRef({ ...REF_DEFAULT });

/** Restore settings + image once per page load. */
export async function loadRef() {
  if (loaded) return; loaded = true;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(REF_KEY) || '{}'); } catch (e) { saved = {}; }
  let src = '';
  try { src = (await idbOp('readonly', (st) => st.get('img'))) || ''; } catch (e) { src = ''; }
  state = sanitizeRef({ ...saved, src, adjust: false });
  subs.forEach((f) => f());
}

/** File → downscaled PNG/JPEG data URL (≤ 1600 px). Rejects non-images. */
export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) { reject(new Error('PNG / JPG / WEBP පින්තූරයක් තෝරන්න')); return; }
    if (file.size > 25 * 1024 * 1024) { reject(new Error('පින්තූරය 25MB ට වඩා විශාලයි')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const { w, h } = fitSize(img.naturalWidth, img.naturalHeight);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.88));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('පින්තූරය කියවන්න බැරි වුණා')); };
    img.src = url;
  });
}
