import React, { useState, useEffect, useRef } from 'react';
import { MoveHorizontal, RotateCcw } from 'lucide-react';
import { SPACING_LIMITS, loadSpacing, saveSpacing, setSpacing, getSpacing } from '../../utils/spacing.js';
import { SETTINGS_EVENT, notifyConfigChanged } from '../../utils/settingsSync.js';

/** Extra left / right spacing for the selected letter; applied when the font is exported / previewed. */
export default function SpacingCard({ selectedChar, T }) {
  const [map, setMap] = useState(loadSpacing);
  const first = useRef(true);
  useEffect(() => {
    saveSpacing(map);
    if (first.current) { first.current = false; return; }
    notifyConfigChanged();
  }, [map]);
  useEffect(() => {
    const reload = () => { first.current = true; setMap(loadSpacing()); };
    window.addEventListener(SETTINGS_EVENT, reload);
    return () => window.removeEventListener(SETTINGS_EVENT, reload);
  }, []);
  const cur = getSpacing(map, selectedChar);
  const set = (patch) => setMap((m) => setSpacing(m, selectedChar, patch));
  const row = (k, label) => (
    <label className="flex items-center gap-2">
      <span className="w-24 flex-shrink-0 opacity-70">{label}</span>
      <input type="range" min={SPACING_LIMITS.min} max={SPACING_LIMITS.max} step={SPACING_LIMITS.step} value={cur[k]}
        onChange={(e) => set({ [k]: Number(e.target.value) })} aria-label={label} className="flex-1 min-w-0 accent-sky-500" />
      <span className="w-9 text-right font-mono opacity-70">{cur[k] > 0 ? `+${cur[k]}` : cur[k]}</span>
    </label>
  );
  return (
    <div className={`p-3 rounded-xl border space-y-2 text-[10px] font-black ${T.sub}`} role="group" aria-label="Glyph spacing">
      <div className="flex items-center gap-2">
        <MoveHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
        <span>SPACING · පරතරය</span>
        <span className="text-base ml-1">{selectedChar}</span>
        <button type="button" onClick={() => set({ l: 0, r: 0 })} disabled={cur.l === 0 && cur.r === 0} aria-label="Reset spacing"
          className="ml-auto p-1 rounded-lg border disabled:opacity-30"><RotateCcw className="w-3 h-3" aria-hidden="true" /></button>
      </div>
      {row('l', 'වම (Left)')}
      {row('r', 'දකුණ (Right)')}
      <p className="text-[9px] opacity-60 font-bold">Export / Text Studio preview එකට බලපායි. මේ browser එකේ පමණක් save වෙයි (cloud sync නැත).</p>
    </div>
  );
}
