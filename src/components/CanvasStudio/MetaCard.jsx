import React, { useState, useId, useEffect } from 'react';
import { BadgeInfo } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
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
    <Collapsible id="fontinfo" title="FONT INFO" si="font විස්තර" icon={BadgeInfo} summary={`v${cleaned.version}`} T={T}>
      <div className="space-y-2.5 text-xs font-semibold">
        {FIELDS.map(([k, label, max]) => (
          <label key={k} className="block">
            <span className="opacity-70">{label}</span>
            <input id={`${uid}-${k}`} value={meta[k]} maxLength={max}
              onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))}
              aria-invalid={k === 'url' && urlBad ? true : undefined}
              className="mt-1 w-full px-2.5 py-2 rounded-lg border bg-transparent text-sm font-semibold" />
          </label>
        ))}
        {urlBad && <p className="text-rose-500">URL එක http:// හෝ https:// වලින් පටන් ගන්න ඕනේ.</p>}
        <label className="block">
          <span className="opacity-70">Embedding permission</span>
          <select value={meta.fsType} onChange={(e) => setMeta((m) => ({ ...m, fsType: Number(e.target.value) }))}
            className="mt-1 w-full px-2.5 py-2 rounded-lg border bg-transparent text-sm font-semibold">
            {FS_TYPES.map((t) => <option key={t.value} value={t.value} className="text-black">{t.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={save} className={`w-full py-2.5 rounded-lg border text-xs font-bold ${T.btn}`}>{saved ? 'Saved ✓' : 'Save'}</button>
      </div>
    </Collapsible>
  );
}
