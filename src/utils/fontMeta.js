// Font metadata (name-table strings + embedding permission). Pure helpers + safe localStorage persistence.

export const META_KEY = 'krtd_font_meta_v1';

export const FS_TYPES = [
  { value: 0, label: 'Installable (සියල්ලටම)', hint: 'Anyone may install and embed' },
  { value: 8, label: 'Editable embedding', hint: 'May be embedded in documents and edited' },
  { value: 4, label: 'Preview & print only', hint: 'Embedded for viewing/printing only' },
];

export const META_DEFAULTS = {
  designer: '',
  copyright: 'Created with KRTD Font Craft Ultra',
  description: 'Custom Sinhala font designed in KRTD Font Craft Ultra',
  url: '',
  license: '',
  version: '1.000',
  fsType: 0,
};

const clean = (s, max) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Validate whatever came from the form / storage; never throws; always returns a complete, safe object. */
export function sanitizeMeta(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = META_DEFAULTS;
  const url = clean(r.url, 200);
  const ver = String(r.version == null ? '' : r.version).trim();
  const m = /^(\d{1,3})\.(\d{1,3})$/.exec(ver);
  const fs = Number(r.fsType);
  return {
    designer: clean(r.designer, 80),
    copyright: clean(r.copyright, 200) || d.copyright,
    description: clean(r.description, 300) || d.description,
    url: /^https?:\/\/[^\s]+$/i.test(url) ? url : '',
    license: clean(r.license, 300),
    version: m ? `${Number(m[1])}.${m[2].padEnd(3, '0').slice(0, 3)}` : d.version,
    fsType: FS_TYPES.some((t) => t.value === fs) ? fs : 0,
  };
}

/** name-table strings used by the font writers */
export function metaToNames(meta) {
  const m = sanitizeMeta(meta);
  return { copyright: m.copyright, description: m.description, version: `Version ${m.version}`, designer: m.designer || undefined, url: m.url || undefined, license: m.license || undefined };
}

export function loadMeta() {
  try { return sanitizeMeta(JSON.parse(localStorage.getItem(META_KEY) || 'null')); }
  catch { return sanitizeMeta(null); }
}
export function saveMeta(meta) {
  const m = sanitizeMeta(meta);
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* storage blocked */ }
  return m;
}
