import React, { useState, useEffect, useRef } from 'react';
import { MoveHorizontal, RotateCcw, Wand2 } from 'lucide-react';
import { SPACING_LIMITS, loadSpacing, saveSpacing, setSpacing, getSpacing } from '../../utils/spacing.js';
import { SETTINGS_EVENT, notifyConfigChanged } from '../../utils/settingsSync.js';
import Collapsible from '../Shared/Collapsible.jsx';

/** Extra left / right spacing for the selected letter; applied when the font is exported / previewed. */
export default function SpacingCard({ selectedChar, fontName, metrics, glyphs, T }) {
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
  const [note, setNote] = useState('');
  const autoAll = async () => {
    try {
      const [{ buildFontModel }, { autoSpacing }] = await Promise.all([import('../../utils/fontCompiler.js'), import('../../utils/autoSpacing.js')]);
      const res = autoSpacing(buildFontModel({ fontName, metrics, glyphs }).model.glyphs);
      setMap(saveSpacing(res));
      setNote(`අකුරු ${Object.keys(res).length}ක් සකස් කළා`);
    } catch { setNote('අකුරු 3කට වඩා අඳින්න, ඊට පස්සේ උත්සාහ කරන්න'); }
  };
  const set = (patch) => setMap((m) => setSpacing(m, selectedChar, patch));
  const row = (k, label) => (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-24 flex-shrink-0 opacity-80 font-semibold">{label}</span>
      <input type="range" min={SPACING_LIMITS.min} max={SPACING_LIMITS.max} step={SPACING_LIMITS.step} value={cur[k]}
        onChange={(e) => set({ [k]: Number(e.target.value) })} aria-label={label} className="flex-1 min-w-0 accent-sky-500" />
      <span className="w-9 text-right font-mono opacity-70">{cur[k] > 0 ? `+${cur[k]}` : cur[k]}</span>
    </label>
  );
  return (
    <Collapsible id="spacing" title="SPACING" si="පරතරය" icon={MoveHorizontal}
      summary={`${selectedChar} ${cur.l || cur.r ? `${cur.l}/${cur.r}` : ''}`} T={T}>
      <div className="space-y-2 text-xs font-semibold">
      <div className="flex items-center">
        <span className="opacity-70">තෝරපු අකුර: <b className="text-base font-sinhala">{selectedChar}</b></span>
        <button type="button" onClick={() => set({ l: 0, r: 0 })} disabled={cur.l === 0 && cur.r === 0} aria-label="Reset spacing"
          className="ml-auto p-1.5 rounded-lg border disabled:opacity-30"><RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /></button>
      </div>
      {row('l', 'වම (Left)')}
      {row('r', 'දකුණ (Right)')}
      <div className="flex gap-2">
        <button type="button" onClick={autoAll} className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center gap-1 ${T.btn}`}>
          <Wand2 className="w-3 h-3" aria-hidden="true" /> Auto-space all
        </button>
        <button type="button" onClick={() => { setMap(saveSpacing({})); setNote('සියල්ල reset කළා'); }} className="px-2 py-1.5 rounded-lg border opacity-80 hover:opacity-100">Clear all</button>
      </div>
      {note && <p className="text-[9px] opacity-80 font-bold" aria-live="polite">{note}</p>}
      <p className="text-[11px] opacity-70 font-medium leading-snug">Export / Text Studio preview එකට බලපායි. Browser, JSON backup සහ Cloud Push එකත් සමඟ save වෙයි.</p>
      </div>
    </Collapsible>
  );
}
