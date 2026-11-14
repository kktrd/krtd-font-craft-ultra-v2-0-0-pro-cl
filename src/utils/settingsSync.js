// Font settings that live outside the glyph data (spacing, font info) travel with the JSON backup.
import { loadSpacing, saveSpacing, sanitizeSpacing, getSpacing, setSpacing } from './spacing.js';
import { loadMeta, saveMeta, sanitizeMeta } from './fontMeta.js';

export const SETTINGS_EVENT = 'krtd-settings-imported';   // cards reload their state
export const CONFIG_EVENT   = 'krtd-font-config-changed'; // live preview recompiles

export const exportSettings = () => ({ spacing: loadSpacing(), meta: loadMeta() });

/** Apply the `settings` block of a backup (safe: everything is re-sanitised). */
export function importSettings(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const spacing = saveSpacing(sanitizeSpacing(s.spacing));
  const meta = saveMeta(sanitizeMeta(s.meta));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SETTINGS_EVENT));
    window.dispatchEvent(new Event(CONFIG_EVENT));
  }
  return { spacing, meta };
}

export const notifyConfigChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONFIG_EVENT));
};

/** True when a Supabase error means the `settings` column does not exist yet (migration not run). */
export function isMissingSettingsColumn(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  return error.code === '42703' || error.code === 'PGRST204' || (/settings/i.test(msg) && /column|schema cache/i.test(msg));
}

/** Copy one letter's manual spacing to another (used when a glyph is pasted). */
export function copySpacing(fromChar, toChar) {
  if (!fromChar || !toChar || fromChar === toChar) return false;
  const map = loadSpacing();
  const cur = getSpacing(map, fromChar);
  const saved = saveSpacing(setSpacing(map, toChar, { l: cur.l, r: cur.r }));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SETTINGS_EVENT));
    window.dispatchEvent(new Event(CONFIG_EVENT));
  }
  return !!saved[toChar] || (cur.l === 0 && cur.r === 0);
}
