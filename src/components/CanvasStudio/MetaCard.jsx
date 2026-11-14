import React, { useState, useId, useEffect } from 'react';
import { BadgeInfo, ChevronDown } from 'lucide-react';
import { FS_TYPES, loadMeta, saveMeta, sanitizeMeta } from '../../utils/fontMeta.js';
import { SETTINGS_EVENT, notifyConfigChanged } from '../../utils/settingsSync.js';

const FIELDS = [
  ['designer', 'Designer · නිර්මාණකරු', 80],
  ['copyright', 'Copyright', 200],
  ['license', 'License', 300],
  ['url', 'Website (https://…)', 200],
  ['description', 'Description', 300],
  ['version', 'Version (1.000)', 7],
];

/** Editable font info written into the exported name/OS-2 tables (TTF, WOFF; OTF gets the text fields). */
export default function MetaCard({ T, onSaved }) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState(loadMeta);
  const [saved, setSaved] = useState(false);
  const uid = useId();
  useEffect(() => {
    const reload = () => setMeta(loadMeta());
    window.addEventListener(SETTINGS_EVENT, reload);
    return () => window.removeEventListener(SETTINGS_EVENT, reload);
  }, []);
  const save = () => { const m = saveMeta(meta); setMeta(m); notifyConfigChanged(); setSaved(true); setTimeout(() => setSaved(false), 1800); if (onSaved) onSaved(m); };
  const cleaned = sanitizeMeta(meta);
  const urlBad = meta.url && !cleaned.url;
  return (
    <div className={`rounded-xl border text-[10px] font-black ${T.sub}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 px-3 py-2.5">
        <BadgeInfo className="w-3.5 h-3.5" aria-hidden="true" />
        <span>FONT INFO · font විස්තර</span>
        <ChevronDown className={`w-3.5 h-3.5 ml-auto transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {FIELDS.map(([k, label, max]) => (
            <label key={k} className="block">
              <span className="opacity-60">{label}</span>
              <input id={`${uid}-${k}`} value={meta[k]} maxLength={max}
                onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))}
                aria-invalid={k === 'url' && urlBad ? true : undefined}
                className="mt-0.5 w-full px-2 py-1.5 rounded-lg border bg-transparent text-[11px] font-bold" />
            </label>
          ))}
          {urlBad && <p className="text-rose-400">URL එක http:// හෝ https:// වලින් පටන් ගන්න ඕනේ.</p>}
          <label className="block">
            <span className="opacity-60">Embedding permission</span>
            <select value={meta.fsType} onChange={(e) => setMeta((m) => ({ ...m, fsType: Number(e.target.value) }))}
              className="mt-0.5 w-full px-2 py-1.5 rounded-lg border bg-transparent text-[11px] font-bold">
              {FS_TYPES.map((t) => <option key={t.value} value={t.value} className="text-black">{t.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={save} className={`w-full py-2 rounded-lg border ${T.btn}`}>{saved ? 'Saved ✓' : 'Save'}</button>
        </div>
      )}
    </div>
  );
}
