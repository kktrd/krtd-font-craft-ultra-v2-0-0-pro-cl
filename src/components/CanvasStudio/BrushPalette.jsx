import React, { useState } from 'react';
import { Brush, ChevronDown, Plus, X } from 'lucide-react';
import {
  BRUSH_PRESETS, BRUSH_GROUPS, MAX_CUSTOM,
  matchPreset, addCustom, removeCustom, previewPolygon,
} from '../../utils/brushPresets.js';

const Swatch = ({ T, preset, active, onPick, onRemove }) => (
  <div className="relative">
    <button type="button" onClick={() => onPick(preset)} aria-pressed={active}
      title={`${preset.si || preset.label} · ${preset.mode} · ${preset.width}`}
      className={`w-[76px] px-1.5 py-1 rounded-lg border text-[9px] font-black flex flex-col items-center gap-0.5 transition ${active ? T.btn : 'opacity-80 hover:opacity-100'}`}>
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
  const [open, setOpen] = useState(false);
  const all = BRUSH_PRESETS.concat(custom);
  const current = matchPreset(brushMode, strokeWidth, all);
  const pick = (p) => { setBrushMode(p.mode); setStrokeWidth(p.width); };
  const canSave = !current && custom.length < MAX_CUSTOM;

  return (
    <div className={`rounded-xl border text-[10px] font-black ${T.sub}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-2">
        <Brush className="w-3.5 h-3.5" aria-hidden="true" />
        <span>BRUSH PRESETS</span>
        <span className="opacity-60 font-mono">{current ? current.label : `${brushMode} ${strokeWidth}`}</span>
        <ChevronDown className={`w-3.5 h-3.5 ml-auto transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          <p className="opacity-60 font-bold">Shortcuts: Alt+1…0 = preset · , / . = පෙර / ඊළඟ preset · [ ] = size</p>
          {BRUSH_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="opacity-60 mb-1">{g.label} · {g.si}</div>
              <div className="flex flex-wrap gap-1.5">
                {BRUSH_PRESETS.filter((p) => p.group === g.id).map((p) => (
                  <Swatch key={p.id} T={T} preset={p} active={current && current.id === p.id} onPick={pick} />
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="opacity-60">MY BRUSHES · මගේ බ්‍රෂ් ({custom.length}/{MAX_CUSTOM})</span>
              <button type="button" disabled={!canSave}
                onClick={() => setCustom((l) => addCustom(l, brushMode, strokeWidth))}
                className={`ml-auto px-2 py-1 rounded-lg border flex items-center gap-1 ${canSave ? T.btn : 'opacity-40 cursor-not-allowed'}`}>
                <Plus className="w-3 h-3" aria-hidden="true" /> Save current
              </button>
            </div>
            {custom.length === 0
              ? <div className="opacity-50 font-bold">තවම නැහැ. දැන් තියෙන බ්‍රෂ් එක save කරන්න.</div>
              : <div className="flex flex-wrap gap-1.5">
                  {custom.map((p) => (
                    <Swatch key={p.id} T={T} preset={p} active={current && current.id === p.id}
                      onPick={pick} onRemove={(id) => setCustom((l) => removeCustom(l, id))} />
                  ))}
                </div>}
          </div>
        </div>
      )}
    </div>
  );
}
