import React from 'react';
import { CheckCircle2, Circle, Play, Zap } from 'lucide-react';
import { workflowSteps } from '../../agent/projectAnalyzer.js';

export default function AgentAutopilotTab({ analysis, T, busy, enabled, setEnabled, idleMs, setIdleMs, onRunStep, onFixAll }) {
  const steps = workflowSteps(analysis);
  const current = steps.find((s) => s.status === 'current');
  return (
    <div className="space-y-5">
      <section className={`p-3 rounded-2xl border ${T.sub}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-1 w-4 h-4" />
          <span>
            <span className="block text-sm font-black">Auto-advance (Autopilot)</span>
            <span className="block text-[11px] opacity-70 leading-relaxed">
              අකුරක් ඇඳලා තත්පර {Math.round(idleMs / 1000)}ක් නිශ්ශබ්ද වුණාම, ඊළඟ predicted අකුරට ස්වයංක්‍රීයව යනවා.
            </span>
          </span>
        </label>
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <label htmlFor="agent-idle" className="opacity-70">Idle:</label>
          <select id="agent-idle" value={idleMs} onChange={(e) => setIdleMs(Number(e.target.value))}
            className={`px-2 py-1 rounded-lg border text-[11px] ${T.input}`}>
            <option value={4000}>4s</option><option value={6000}>6s</option><option value={10000}>10s</option><option value={15000}>15s</option>
          </select>
        </div>
      </section>

      <section aria-label="Workflow">
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Workflow</div>
        <ol className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.id} className={`flex items-center gap-2.5 p-2 rounded-xl border text-[12px] ${s.status === 'current' ? T.accentBg : T.sub} ${s.status === 'done' ? 'opacity-60' : ''}`}>
              {s.status === 'done'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-label="done" />
                : <Circle className="w-4 h-4 flex-shrink-0 opacity-50" aria-label={s.status === 'current' ? 'current' : 'todo'} />}
              <span className="flex-1 font-bold">{s.title}</span>
              {s.auto && <span className="text-[9px] font-black px-1.5 py-0.5 rounded border border-current/20 opacity-70">AUTO</span>}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-2">
        <button type="button" disabled={busy || !current} onClick={() => onRunStep(current)}
          className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 ${T.btn}`}>
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          {current ? `Run next step: ${current.title}` : 'සියලු පියවර අවසන්'}
        </button>
        <button type="button" disabled={busy} onClick={onFixAll}
          className={`py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 disabled:opacity-50 ${T.btnGhost}`}>
          <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Fix everything automatically
        </button>
      </div>
      <p className="text-[10px] opacity-60 leading-relaxed">
        Auto-fix කරන්නේ ආරක්ෂිත දේවල් විතරයි (metrics, canvas bounds, style learn, cloud save). අකුරු අඳින එක ඔයාගේ වැඩේ — Agent ඒවා ඔයා වෙනුවෙන් අඳින්නේ නෑ.
      </p>
    </div>
  );
}
