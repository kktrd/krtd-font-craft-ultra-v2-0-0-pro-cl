import React from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { label } from '../../agent/agentBrain.js';

/** Circular 0-100 health score. */
export function HealthRing({ score, grade, T }) {
  const r = 34, c = 2 * Math.PI * r;
  const color = score >= 75 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Health score ${score} out of 100, ${grade}`}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 42 42)"
          style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <text x="42" y="47" textAnchor="middle" fontSize="20" fontWeight="900" fill="currentColor">{score}</text>
      </svg>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Project health</div>
        <div className="text-sm font-black" style={{ color }}>{grade}</div>
      </div>
    </div>
  );
}

export function ActionButton({ act, onRun, T, busy, primary = false }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onRun(act)}
      className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition disabled:opacity-60 text-left ${primary ? T.btn : T.btnGhost}`}
    >
      {label(act)}
    </button>
  );
}

export function SeverityIcon({ severity }) {
  if (severity === 'error') return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-label="error" />;
  if (severity === 'warn')  return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" aria-label="warning" />;
  return <Info className="w-4 h-4 text-sky-500 flex-shrink-0" aria-label="info" />;
}
