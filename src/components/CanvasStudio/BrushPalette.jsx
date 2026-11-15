import React from 'react';
import { Brush, Plus, X } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
import {
  BRUSH_PRESETS, BRUSH_GROUPS, MAX_CUSTOM,
  matchPreset, addCustom, removeCustom, previewPolygon,
} from '../../utils/brushPresets.js';

const Swatch = ({ T, preset, active, onPick, onRemove }) => (
  <div className="relative">
    <button type="button" onClick={() => onPick(preset)} aria-pressed={active}
      title={`${preset.si || preset.label} · ${preset.mode} · ${preset.width}`}
      className={`w-[84px] px-1.5 py-1.5 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${active ? T.btn : 'opacity-80 hover:opacity-100'}`}>
      <svg viewBox="0 0 60 24" width="60" height="24" aria-hidden="true" className="fill-current">
        <polygon points={previewPolygon(preset.mode, preset.width)} />
      </svg>
      <span className="truncate max-w-full">{preset.label}</span>
      <span className="font-mono opacity-60">{preset.width}</span>
    </button>
    {onRemove && (
      <button type="button" onClick={() => onRemove(preset.id)} aria-label={`Remove ${preset.label}`}
        className="absolute -top-1 -right-1 rounded-full border bg-black/70 text-white p-0.5">
        <X className="w-2.5 h-2.5" aria-hidden="true" />
      </button>
    )}
  </div>
);

/** Collapsible brush preset palette: built-in presets + the user's own saved brushes. */
export default function BrushPalette({ T, brushMode, strokeWidth, setBrushMode, setStrokeWidth, custom, setCustom }) {
  const all = BRUSH_PRESETS.concat(custom);
  const current = matchPreset(brushMode, strokeWidth, all);
  const pick = (p) => { setBrushMode(p.mode); setStrokeWidth(p.width); };
  const canSave = !current && custom.length < MAX_CUSTOM;

  return (
    <Collapsible id="brushpresets" title="BRUSH PRESETS" si="බ්‍රෂ් සකස්" icon={Brush}
      summary={current ? current.label : `${brushMode} ${strokeWidth}`} T={T}>
      <div className="space-y-3 text-xs font-semibold">
        <p className="opacity-70 font-medium leading-snug">Shortcuts: Alt+1…0 = preset · , / . = පෙර / ඊළඟ · [ ] = size</p>
        {BRUSH_GROUPS.map((g) => (
          <div key={g.id}>
            <div className="opacity-70 mb-1.5">{g.label} · {g.si}</div>
            <div className="flex flex-wrap gap-1.5">
              {BRUSH_PRESETS.filter((p) => p.group === g.id).map((p) => (
                <Swatch key={p.id} T={T} preset={p} active={current && current.id === p.id} onPick={pick} />
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="opacity-70">MY BRUSHES · මගේ බ්‍රෂ් ({custom.length}/{MAX_CUSTOM})</span>
            <button type="button" disabled={!canSave}
              onClick={() => setCustom((l) => addCustom(l, brushMode, strokeWidth))}
              className={`ml-auto px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${canSave ? T.btn : 'opacity-40 cursor-not-allowed'}`}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Save current
            </button>
          </div>
          {custom.length === 0
            ? <div className="opacity-60 font-medium">තවම නැහැ. දැන් තියෙන බ්‍රෂ් එක save කරන්න.</div>
            : <div className="flex flex-wrap gap-1.5">
                {custom.map((p) => (
                  <Swatch key={p.id} T={T} preset={p} active={current && current.id === p.id}
                    onPick={pick} onRemove={(id) => setCustom((l) => removeCustom(l, id))} />
                ))}
              </div>}
        </div>
      </div>
    </Collapsible>
  );
}
