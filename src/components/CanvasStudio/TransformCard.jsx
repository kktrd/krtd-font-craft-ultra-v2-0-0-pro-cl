import React, { useState } from 'react';
import { Move, RotateCcw } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
import { TRANSFORM_PRESETS, DEFAULT_OP, normalizeOp, isIdentity, transformGlyphs } from '../../utils/glyphTransform.js';

// Glyph Transformer (FontCreator-style): scale / rotate / skew / mirror / move — one glyph or the whole font.
export default function TransformCard({ T, glyphs, setGlyphs, selectedChar, baseline, toast }) {
  const [op, setOp] = useState({ ...DEFAULT_OP });
  const [backup, setBackup] = useState(null);
  const hasInk = (glyphs[selectedChar] || []).length > 0;
  const set = (patch) => setOp((o) => ({ ...o, ...patch }));

  const run = (useOp, only, label) => {
    const o = normalizeOp(useOp);
    if (isIdentity(o)) { toast && toast('වෙනසක් තෝරන්න', 'info'); return; }
    const r = transformGlyphs(glyphs, o, baseline, only);
    if (!r.count) { toast && toast('වෙනස් කරන්න strokes නැහැ', 'info'); return; }
    setBackup({ glyphs, label });
    setGlyphs(r.glyphs);
    toast && toast(`${label} — අකුරු ${r.count}ක්${r.clipped ? ` (canvas කෙළවරින් පිටට ගිය ලක්ෂ්‍ය ${r.clipped}ක් කොටා දැමුවා)` : ''}`, r.clipped ? 'info' : 'success');
  };
  const undo = () => { if (!backup) return; setGlyphs(backup.glyphs); setBackup(null); toast && toast('පෙර තත්ත්වය ආපසු ලැබුණා', 'success'); };

  const Row = ({ label, k, min, max, step = 1, unit = '' }) => (
    <label className="flex items-center gap-2">
      <span className="w-14 flex-shrink-0 opacity-80">{label}</span>
      <input type="range" min={min} max={max} step={step} value={op[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="flex-1 min-w-[80px] w-full" aria-label={label} />
      <span className="w-14 text-right tabular-nums font-bold">{op[k]}{unit}</span>
    </label>
  );
  const btn = `px-2.5 py-1.5 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${T.btnGhost}`;

  return (
    <Collapsible id="transform" title="GLYPH TRANSFORMER" si="පරිවර්තකය" icon={Move} T={T} summary={selectedChar}>
      <div className="space-y-3 text-xs font-semibold">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick presets">
          {TRANSFORM_PRESETS.map((p) => (
            <button key={p.id} type="button" className={btn} onClick={() => run(p.op, null, p.label)}
              title={`සියලු අකුරු → ${p.label}`}>{p.label}</button>
          ))}
        </div>
        <p className="opacity-70 font-medium leading-snug">ඉහත preset ඔබන විට සියලු අකුරු වලට (නව weight/style එකක් හදන්න). පහත slider වලින් අකුරක් හෝ font එකම custom කරන්න.</p>
        <div className="space-y-1.5">
          <Row label="Width" k="sx" min={50} max={200} unit="%" />
          <Row label="Height" k="sy" min={50} max={200} unit="%" />
          <Row label="Rotate" k="rot" min={-45} max={45} unit="°" />
          <Row label="Skew" k="skewX" min={-30} max={30} unit="°" />
          <Row label="Move X" k="dx" min={-100} max={100} />
          <Row label="Move Y" k="dy" min={-100} max={100} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={op.mirrorH} onChange={(e) => set({ mirrorH: e.target.checked })} /> Mirror ↔</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={op.mirrorV} onChange={(e) => set({ mirrorV: e.target.checked })} /> Flip ↕</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={op.scaleWidth} onChange={(e) => set({ scaleWidth: e.target.checked })} /> Stroke scale</label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={btn} disabled={!hasInk} onClick={() => run(op, selectedChar, `“${selectedChar}” transform`)}>“{selectedChar}” පමණක්</button>
          <button type="button" className={btn} onClick={() => run(op, null, 'සියලු අකුරු transform')}>සියලු අකුරු</button>
          <button type="button" className={btn} onClick={() => setOp({ ...DEFAULT_OP })}>Reset</button>
          {backup && (
            <button type="button" onClick={undo} className={`ml-auto inline-flex items-center gap-1 ${btn}`}>
              <RotateCcw className="w-3 h-3" aria-hidden="true" /> Undo ({backup.label})
            </button>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
