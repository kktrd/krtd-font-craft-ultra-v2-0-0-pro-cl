import React from 'react';
import { Shapes, RotateCcw, EyeOff, Wand2 } from 'lucide-react';
import { GUIDE_LIMITS, GUIDE_STYLES } from '../../utils/guideMath.js';

const ADJ_ROWS = [
  ['scale', 'ලොකු / කුඩා (මේ අකුර)', (v) => `${Math.round(v * 100)}%`],
  ['dx',    'වමට / දකුණට',        (v) => `${v}`],
  ['dy',    'උඩට / පහළට',        (v) => `${v}`],
  ['rot',   'හරවන්න',             (v) => `${v}°`],
];
const SET_ROWS = [
  ['gscale',  'ලොකු / කුඩා (සියලුම)', (v) => `${Math.round(v * 100)}%`],
  ['weight',  'ඉරේ ඝනකම',          (v) => `${v}`],
  ['opacity', 'පැහැදිලි බව',        (v) => `${Math.round(v * 100)}%`],
];

const Slider = ({ k, label, fmt, value, onChange }) => (
  <label className="flex items-center gap-2 text-[10px] font-bold">
    <span className="w-28 flex-shrink-0 opacity-80">{label}</span>
    <input type="range" min={GUIDE_LIMITS[k].min} max={GUIDE_LIMITS[k].max} step={GUIDE_LIMITS[k].step}
      value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 min-w-0 accent-sky-500" aria-label={label} />
    <span className="w-10 text-right font-mono opacity-70">{fmt(value)}</span>
  </label>
);

/** Controls for the hollow Shape Guide. Guide only — never saved into the font. */
export default function ShapeGuidePanel({
  T, char, settings, adj, supported, score, matchMsg,
  onSettings, onAdj, onResetChar, onResetAll, onMatch, onHide, children,
}) {
  const tog = (key, label) => (
    <button key={key} onClick={() => onSettings({ [key]: !settings[key] })} aria-pressed={settings[key]}
      className={`px-2 py-1 rounded-lg border text-[10px] font-black ${settings[key] ? T.btn : T.btnGhost}`}>{label}</button>
  );
  const pct = score ? score.score : 0;
  return (
    <div className="p-2.5 rounded-xl border bg-sky-500/10 border-sky-500/30 space-y-2.5" role="group" aria-label="Shape guide">
      <div className="flex items-center gap-2">
        <Shapes className="w-4 h-4 text-sky-500 flex-shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-bold text-sky-500 flex-1">
          Shape Guide: <span className="font-sinhala text-sm">{char}</span> — හිස් සම්මත හැඩය. මේක මත ඇඳලා ඔයාගේ විදියට customize කරගන්න.
        </span>
        <button onClick={onHide} aria-label="Hide shape guide" className={`p-1.5 rounded-lg border ${T.btnGhost}`}>
          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" /></button>
      </div>

      {!supported && (
        <p className="text-[10px] text-amber-500 font-bold" role="status">
          මේ style එකේ සිංහල font එක මේ device එකේ නැහැ — වෙන style එකක් තෝරන්න.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Guide style">
        <span className="text-[10px] font-black opacity-70">STYLE:</span>
        {GUIDE_STYLES.map((s) => (
          <button key={s.id} onClick={() => onSettings({ style: s.id })} aria-pressed={settings.style === s.id}
            className={`px-2 py-1 rounded-lg border text-[10px] font-black ${settings.style === s.id ? T.btn : T.btnGhost}`}>{s.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Guide options">
        {tog('snap', 'Metrics snap')}{tog('order', '1·2·3 order')}{tog('meter', 'Accuracy')}{tog('compare', 'Compare')}{tog('dashed', 'Dashed')}
      </div>

      {settings.meter && (
        <div role="status" aria-live="polite">
          <div className="flex items-center justify-between text-[10px] font-bold mb-1">
            <span className="opacity-80">ගැලපීම (guide එකට ළඟ බව)</span>
            <span className="font-mono">{score ? `${pct}%` : '—'}</span>
          </div>
          <div className="h-1.5 rounded-full bg-sky-500/20 overflow-hidden">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[9px] opacity-60 mt-1">
            {score ? `හැඩය ${score.precision}% · වැසීම ${score.recall}% — ඔයාගේ style එකට ලකුණු දෙන්නේ නැහැ, ඇඳීමට උපකාරයක් පමණයි.` : 'අකුර ඇන්දම පෙන්වයි.'}
          </p>
        </div>
      )}

      {settings.order && (
        <p className="text-[9px] opacity-70">රතු අංක = ඇඳිය යුතු කොටස් අනුපිළිවෙල (ආසන්න ඇස්තමේන්තුවක්: ප්‍රධාන හැඩය → ඊළඟට සලකුණු).</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {ADJ_ROWS.map(([k, label, fmt]) => (
          <Slider key={k} k={k} label={label} fmt={fmt} value={adj[k]} onChange={(v) => onAdj({ [k]: v })} />
        ))}
        {SET_ROWS.map(([k, label, fmt]) => (
          <Slider key={k} k={k} label={label} fmt={fmt} value={settings[k]} onChange={(v) => onSettings({ [k]: v })} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onMatch}
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 ${T.accentBg}`}>
          <Wand2 className="w-3 h-3" aria-hidden="true" /> Match my style
        </button>
        <button onClick={onResetChar}
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 ${T.btnGhost}`}>
          <RotateCcw className="w-3 h-3" aria-hidden="true" /> Reset (මේ අකුර)
        </button>
        <button onClick={onResetAll} className={`px-2 py-1 rounded-lg border text-[10px] font-black ${T.btnGhost}`}>Reset all</button>
        {matchMsg && <span className="text-[10px] font-bold text-sky-500" role="status">{matchMsg}</span>}
      </div>
      <p className="text-[9px] opacity-60">Guide settings මේ device එකේ විතරක් මතක තියාගන්නවා. Glyph / font / cloud එකට යන්නේ නැහැ.</p>

      {settings.compare && children}
    </div>
  );
}
