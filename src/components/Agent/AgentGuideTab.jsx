import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HealthRing, ActionButton, SeverityIcon } from './AgentParts.jsx';
import { reasonText } from '../../agent/pathPredictor.js';
import { nextBestActions } from '../../agent/projectAnalyzer.js';
import { summaryText } from '../../agent/agentBrain.js';

export default function AgentGuideTab({ analysis, T, busy, onRun, selectedChar }) {
  const actions = nextBestActions(analysis);
  const primary = actions[0];
  return (
    <div className="space-y-5">
      <HealthRing score={analysis.score} grade={analysis.grade} T={T} />
      <p className="text-xs leading-relaxed opacity-80">{summaryText(analysis)}</p>

      {primary && (
        <section aria-label="Next best action" className={`p-3 rounded-2xl border ${T.accentBg}`}>
          <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Next best action</div>
          <div className="text-sm font-black mb-0.5">{primary.title}</div>
          <p className="text-[11px] opacity-80 mb-2">{primary.why}</p>
          <ActionButton act={primary} onRun={onRun} T={T} busy={busy} primary />
        </section>
      )}

      <section aria-label="Coverage">
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Coverage</div>
        <ul className="space-y-1.5">
          {analysis.coverage.map((s) => (
            <li key={s.id}>
              <div className="flex justify-between text-[10px] font-bold mb-0.5">
                <span>{s.title.split(' (')[0]}</span><span>{s.done}/{s.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-current/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.done} aria-label={s.title}>
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(s.done / s.total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {analysis.predicted.length > 0 && (
        <section aria-label="Predicted path">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Predicted path — ඊළඟට අඳින්න</div>
          <ol className="space-y-1.5">
            {analysis.predicted.slice(0, 5).map((p, i) => (
              <li key={p.char}>
                <button type="button" onClick={() => onRun({ id: 'select_char', args: { char: p.char } })}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition ${T.btnGhost} ${p.char === selectedChar ? 'ring-1 ring-current' : ''}`}>
                  <span className="text-xl font-black w-9 text-center font-sinhala">{p.char}</span>
                  <span className="flex-1 text-[11px] opacity-80">{reasonText(p)}</span>
                  <span className="text-[10px] opacity-50">{i === 0 ? 'NEXT' : ''}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-50" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-label="Issues">
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Issues ({analysis.issues.length})</div>
        {analysis.issues.length === 0
          ? <p className="text-xs opacity-70">ගැටළු නෑ ✅</p>
          : (
            <ul className="space-y-2">
              {analysis.issues.map((i) => (
                <li key={i.id} className={`p-2.5 rounded-xl border text-[11px] ${T.sub}`}>
                  <div className="flex gap-2 items-start">
                    <SeverityIcon severity={i.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{i.title}</div>
                      <div className="opacity-70">{i.detail}</div>
                      {i.chars && <div className="mt-1 font-sinhala text-sm break-words">{i.chars.slice(0, 14).join(' ')}</div>}
                      {i.fix && <div className="mt-2"><ActionButton act={i.fix} onRun={onRun} T={T} busy={busy} /></div>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
