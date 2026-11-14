import React, { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { coverageReport } from '../../utils/coverage.js';

const LEVELS = {
  starting: ['පටන් ගන්න', 'bg-rose-500'],
  partial:  ['අඩක් විතර', 'bg-amber-500'],
  usable:   ['පාවිච්චියට ගන්න පුළුවන්', 'bg-sky-500'],
  complete: ['සම්පූර්ණයි', 'bg-emerald-500'],
};

/** Shows how much of the Sinhala set is drawn and which letters to draw next. */
export default function CoverageCard({ glyphs, selectedChar, onSelectChar, T }) {
  const r = useMemo(() => coverageReport(glyphs || {}), [glyphs]);
  const [label, bar] = LEVELS[r.level];
  return (
    <div className={`p-3 rounded-xl border space-y-2.5 ${T.sub}`} role="group" aria-label="Font coverage">
      <div className="flex items-center gap-2 text-[10px] font-black">
        <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
        <span>COVERAGE · අකුරු ප්‍රමාණය</span>
        <span className="ml-auto font-mono">{r.done}/{r.total} · {r.percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/20 overflow-hidden" role="progressbar" aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${bar} transition-all`} style={{ width: `${r.percent}%` }} />
      </div>
      <p className="text-[9px] font-bold opacity-80">
        {label}
        {r.coreMissing.length > 0 && ` · මූලික අකුරු ${r.coreTotal - r.coreMissing.length}/${r.coreTotal}`}
      </p>
      {r.next.length > 0 && (
        <div>
          <div className="text-[9px] font-black opacity-60 mb-1">ඊළඟට අඳින්න</div>
          <div className="flex flex-wrap gap-1">
            {r.next.map((c) => (
              <button key={c} type="button" onClick={() => onSelectChar && onSelectChar(c)} aria-pressed={selectedChar === c}
                className={`min-w-[28px] px-1.5 py-1 rounded-lg border text-sm font-bold ${selectedChar === c ? T.btn : 'opacity-80 hover:opacity-100'}`}>{c}</button>
            ))}
          </div>
        </div>
      )}
      <details className="text-[9px]">
        <summary className="cursor-pointer font-black opacity-70">කොටස් අනුව</summary>
        <ul className="mt-1.5 space-y-1">
          {r.rows.map((x) => (
            <li key={x.title} className="flex items-center gap-2">
              <span className="flex-1 truncate">{x.title}</span>
              <span className="font-mono opacity-70">{x.drawn + x.viaParts.length}/{x.total}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
