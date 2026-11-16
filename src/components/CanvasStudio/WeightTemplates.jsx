import React, { useState } from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
import { WEIGHTS, TYPES, meanWidth, nearestWeight, reweightGlyphs } from '../../utils/weightTemplates.js';

// Weight templates: pick a standard weight (Thin → Extra Bold) + pen type; optionally
// re-weight everything already drawn (whole font or only the selected character).
export default function WeightTemplates({ T, glyphs, setGlyphs, selectedChar, brushMode, strokeWidth, setBrushMode, setStrokeWidth, onChanged, toast }) {
  const [typeId, setTypeId] = useState(brushMode);
  const [backup, setBackup] = useState(null);   // { glyphs, label } — one-step undo for "apply"
  const mean = meanWidth(glyphs);
  const current = mean ? nearestWeight(mean) : null;
  const active = WEIGHTS.find((w) => w.width === strokeWidth && brushMode === typeId) || null;

  const pick = (w) => { setBrushMode(typeId); setStrokeWidth(w.width); };
  const pickType = (id) => { setTypeId(id); setBrushMode(id); };

  const apply = (w, only) => {
    const r = reweightGlyphs(glyphs, w.width, only);
    if (!r.count) { toast && toast('වෙනස් කරන්න strokes නැහැ', 'info'); return; }
    setBackup({ glyphs, label: `${w.label}${only ? ` · ${only}` : ''}` });
    setGlyphs(r.glyphs);
    setBrushMode(typeId); setStrokeWidth(w.width);
    onChanged && onChanged(r.glyphs);
    toast && toast(`${w.si} (${w.label}) — අකුරු ${r.count}ක් යාවත්කාලීන වුණා`, 'success');
  };

  const undo = () => {
    if (!backup) return;
    setGlyphs(backup.glyphs);
    onChanged && onChanged(backup.glyphs);
    setBackup(null);
    toast && toast('පෙර බර නැවත ලැබුණා', 'success');
  };

  const chip = (on) => `px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition ${on ? T.btn : T.btnGhost}`;

  return (
    <Collapsible id="weights" title="WEIGHT TEMPLATES" si="බර ආකෘති" icon={Layers} defaultOpen T={T}
      summary={current ? `font ≈ ${current.label}` : (active ? active.label : `${strokeWidth}`)}>
      <div className="space-y-3 text-xs font-semibold">
        <div role="group" aria-label="Pen type" className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => pickType(t.id)} aria-pressed={typeId === t.id} className={chip(typeId === t.id)}>
              {t.label} <span className="opacity-70 font-medium">{t.si}</span>
            </button>
          ))}
        </div>

        <div role="group" aria-label="Stroke weight" className="grid grid-cols-5 gap-1.5">
          {WEIGHTS.map((w) => (
            <button key={w.id} type="button" onClick={() => pick(w)} aria-pressed={!!active && active.id === w.id}
              title={`${w.label} · ${w.width}px`}
              className={`flex flex-col items-center justify-between gap-1.5 px-1 py-2 rounded-xl border min-h-[64px] transition ${active && active.id === w.id ? T.btn : T.btnGhost}`}>
              <span className="w-8 rounded-full bg-current" style={{ height: `${Math.max(2, w.width / 3.2)}px`, opacity: 0.85 }} aria-hidden="true" />
              <span className="text-[10px] leading-tight text-center font-bold">{w.label}<br /><span className="opacity-70 font-medium">{w.si}</span></span>
            </button>
          ))}
        </div>

        <p className="opacity-70 font-medium leading-snug">
          {mean ? `දැන් අඳින ලද අකුරු වල සාමාන්‍ය පළල ≈ ${mean.toFixed(1)}px (${current.label}).` : 'තවම අකුරු අඳින්න නැහැ.'}
          {' '}පහත බොත්තම් වලින් දැනටමත් ඇඳපු අකුරු වල බර මාරු කරන්න (හැඩය/තුඩු රටාව ආරක්ෂා වෙනවා).
        </p>

        <div className="flex flex-wrap gap-1.5">
          {WEIGHTS.map((w) => (
            <button key={w.id} type="button" onClick={() => apply(w, null)} disabled={!mean}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${T.btnGhost}`}>
              සියලු අකුරු → {w.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="opacity-70 font-medium">“{selectedChar}” පමණක්:</span>
          {WEIGHTS.map((w) => (
            <button key={w.id} type="button" onClick={() => apply(w, selectedChar)} disabled={!(glyphs[selectedChar] || []).length}
              className={`px-2 py-1 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${T.btnGhost}`}>{w.label}</button>
          ))}
          {backup && (
            <button type="button" onClick={undo} className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${T.btnGhost}`}>
              <RotateCcw className="w-3 h-3" aria-hidden="true" /> Undo ({backup.label})
            </button>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
