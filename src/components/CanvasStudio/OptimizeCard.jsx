import React, { useMemo, useState } from 'react';
import { Scissors, RotateCcw } from 'lucide-react';
import Collapsible from '../Shared/Collapsible.jsx';
import { OPT_LIMITS, countPoints, optimizeGlyphs } from '../../utils/glyphOptimize.js';

// Optimize Contours + Round XY (FontCreator-style): fewer points, same shape, snapped coordinates.
export default function OptimizeCard({ T, glyphs, setGlyphs, selectedChar, toast }) {
  const [eps, setEps] = useState(1.5);
  const [grid, setGrid] = useState(0);
  const [backup, setBackup] = useState(null);
  const total = useMemo(() => countPoints(glyphs), [glyphs]);
  const here = useMemo(() => countPoints({ [selectedChar]: glyphs[selectedChar] }), [glyphs, selectedChar]);
  const preview = useMemo(() => optimizeGlyphs(glyphs, { epsilon: eps, grid }), [glyphs, eps, grid]);

  const run = (only) => {
    const r = optimizeGlyphs(glyphs, { epsilon: eps, grid }, only);
    if (!r.count || r.after >= r.before && grid === 0) { toast && toast('ඉවත් කරන්න අනවශ්‍ය ලක්ෂ්‍ය නැහැ', 'info'); return; }
    setBackup({ glyphs, label: only ? `“${only}”` : 'සියලු අකුරු' });
    setGlyphs(r.glyphs);
    toast && toast(`ලක්ෂ්‍ය ${r.before} → ${r.after} (−${r.before - r.after})`, 'success');
  };
  const undo = () => { if (!backup) return; setGlyphs(backup.glyphs); setBackup(null); toast && toast('පෙර තත්ත්වය ආපසු ලැබුණා', 'success'); };
  const btn = `px-2.5 py-1.5 rounded-lg border text-[11px] font-bold disabled:opacity-40 ${T.btnGhost}`;
  const saved = Math.max(0, preview.before - preview.after);

  return (
    <Collapsible id="optimize" title="OPTIMIZE CONTOURS" si="ලක්ෂ්‍ය අඩු කරන්න" icon={Scissors} T={T} summary={`${total} pts`}>
      <div className="space-y-3 text-xs font-semibold">
        <label className="flex items-center gap-2">
          <span className="w-16 flex-shrink-0 opacity-80">Tolerance</span>
          <input type="range" min={OPT_LIMITS.epsMin} max={OPT_LIMITS.epsMax} step={0.5} value={eps} onChange={(e) => setEps(Number(e.target.value))} className="flex-1 min-w-[80px] w-full" aria-label="Tolerance" />
          <span className="w-10 text-right tabular-nums font-bold">{eps}</span>
        </label>
        <div role="group" aria-label="Round XY grid" className="flex flex-wrap items-center gap-1.5">
          <span className="opacity-80 mr-1">Round XY</span>
          {OPT_LIMITS.grids.map((g) => (
            <button key={g} type="button" aria-pressed={grid === g} onClick={() => setGrid(g)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${grid === g ? T.btn : T.btnGhost}`}>{g === 0 ? 'Off' : g}</button>
          ))}
        </div>
        <p className="opacity-70 font-medium leading-snug">
          Font එකේ ලක්ෂ්‍ය {total}ක් (“{selectedChar}” ≈ {here}). දැන් සැකසුම් වලින් අඩු කළොත් ≈ {saved}ක් ඉවත් වෙනවා. හැඩය රැක ගනිමින් file එක සැහැල්ලු වෙනවා.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={btn} disabled={!here} onClick={() => run(selectedChar)}>“{selectedChar}” පමණක්</button>
          <button type="button" className={btn} disabled={!total} onClick={() => run(null)}>සියලු අකුරු</button>
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
