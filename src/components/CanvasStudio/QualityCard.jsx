import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Info, XCircle } from 'lucide-react';

const ICON = { error: [XCircle, 'text-rose-400'], warn: [AlertTriangle, 'text-amber-400'], info: [Info, 'text-sky-400'] };

/** "Check before export": runs the same build the exporter uses and lists problems in plain Sinhala. */
export default function QualityCard({ fontName, metrics, glyphs, onSelectChar, T }) {
  const [rep, setRep] = useState(null);
  const run = async () => { try { const { qualityReport } = await import('../../utils/fontQuality.js'); setRep(qualityReport({ fontName, metrics, glyphs })); } catch { setRep({ ok: false, issues: [{ level: 'error', code: 'x', text: 'පරීක්ෂාව අසාර්ථකයි.', chars: [] }], counts: { error: 1, warn: 0, info: 0 } }); } };
  return (
    <div className={`p-3 rounded-xl border space-y-2 ${T.sub}`} role="group" aria-label="Quality check">
      <div className="flex items-center gap-2 text-[10px] font-black">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        <span>EXPORT CHECK · පරීක්ෂා කරන්න</span>
        <button type="button" onClick={run} className={`ml-auto px-2 py-1 rounded-lg border ${T.btn}`}>Run check</button>
      </div>
      {rep && (
        <>
          <p className="text-[9px] font-bold opacity-80">
            {rep.counts.error} දෝෂ · {rep.counts.warn} අවවාද · {rep.counts.info} සටහන්
          </p>
          <ul className="space-y-1.5">
            {rep.issues.map((i, k) => {
              const [Icon, color] = ICON[i.level];
              return (
                <li key={k} className="text-[10px] leading-snug">
                  <div className="flex gap-1.5"><Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} aria-hidden="true" /><span>{i.text}</span></div>
                  {i.chars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 ml-5">
                      {i.chars.slice(0, 16).map((c) => (
                        <button key={c} type="button" onClick={() => onSelectChar && onSelectChar(c)}
                          className="min-w-[26px] px-1.5 py-0.5 rounded-lg border text-sm font-bold opacity-90 hover:opacity-100">{c}</button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
