import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, CheckCircle2, XCircle, RefreshCw, Cpu, Database,
  Type as TypeIcon, ToggleLeft, Clock
} from 'lucide-react';
import { APP_VERSION, BUILD_SHA, BUILD_DATE, EDITION } from '../../utils/versionInfo.js';
import { FEATURE_FLAGS } from '../../utils/featureFlags.js';
import { pingAI, PROVIDER_LABELS } from '../../agent/llmClient.js';

/**
 * DiagnosticsPanel — the app verifies its OWN state live, in the browser,
 * rather than the user having to trust a claim made in chat. Every check
 * here actually RUNS against the real environment at the moment the panel
 * is opened (or Re-run is clicked) — nothing here is hardcoded/asserted.
 */

async function runChecks(supabase) {
  const results = [];

  try {
    const k = '__krtd_diag_test__';
    localStorage.setItem(k, '1');
    const ok = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
    results.push({ id: 'localStorage', label: 'localStorage read/write', ok, detail: ok ? 'working' : 'unexpected value' });
  } catch (err) {
    results.push({ id: 'localStorage', label: 'localStorage read/write', ok: false, detail: err.message });
  }

  try {
    const raw = localStorage.getItem('krtd_font_craft_glyphs');
    const parsed = raw ? JSON.parse(raw) : {};
    const count = Object.keys(parsed).length;
    results.push({ id: 'glyphData', label: 'Saved glyph data', ok: true, detail: count + ' character(s) stored locally' });
  } catch (err) {
    results.push({ id: 'glyphData', label: 'Saved glyph data', ok: false, detail: 'corrupted JSON: ' + err.message });
  }

  try {
    const c = document.createElement('canvas');
    const ok = !!c.getContext('2d');
    results.push({ id: 'canvas2d', label: 'Canvas 2D rendering', ok, detail: ok ? 'available' : 'not supported' });
  } catch (err) {
    results.push({ id: 'canvas2d', label: 'Canvas 2D rendering', ok: false, detail: err.message });
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      const ok = regs.length > 0;
      results.push({ id: 'sw', label: 'Service worker (offline support)', ok, detail: ok ? (regs.length + ' active') : 'not yet registered' });
    } else {
      results.push({ id: 'sw', label: 'Service worker (offline support)', ok: false, detail: 'not supported in this browser' });
    }
  } catch (err) {
    results.push({ id: 'sw', label: 'Service worker (offline support)', ok: false, detail: err.message });
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('font_projects').select('id').limit(1);
      results.push({ id: 'supabase', label: 'Supabase connection', ok: !error, detail: error ? error.message : 'reachable' });
    } catch (err) {
      results.push({ id: 'supabase', label: 'Supabase connection', ok: false, detail: err.message });
    }
  } else {
    results.push({ id: 'supabase', label: 'Supabase connection', ok: false, detail: 'not configured (offline mode)' });
  }

  // Cloud AI backend — developer/admin info only (end users never see provider names)
  if (supabase) {
    const r = await pingAI(supabase, true);
    let detail;
    if (r.ok && r.providers && r.providers.length) {
      detail = r.providers.map(function (id) { return (PROVIDER_LABELS[id] || id) + (r.models && r.models[id] ? ' (' + r.models[id] + ')' : ''); }).join(' → ') + ' · fallback order';
    } else if (r.ok) {
      detail = 'enabled (provider details are visible to admin accounts only)';
    } else if (r.reason === 'llm_not_configured') {
      detail = 'no key set — add GEMINI_API_KEY / ZAI_API_KEY / ANTHROPIC_API_KEY in Vercel env vars, then redeploy';
    } else if (r.reason === 'not_signed_in') {
      detail = 'login required to test';
    } else {
      detail = 'unreachable: ' + r.reason + ' (is /api/agent deployed?)';
    }
    results.push({ id: 'ai', label: 'Agent cloud AI backend', ok: !!r.ok, detail: detail });
  }

  results.push({ id: 'worker', label: 'Web Worker support', ok: typeof Worker !== 'undefined', detail: typeof Worker !== 'undefined' ? 'available' : 'unavailable — falls back to main thread' });

  return results;
}

function CheckRow({ label, ok, detail }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden="true"/>
        : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-hidden="true"/>}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">{label}</div>
        <div className="text-[10px] opacity-50 truncate">{detail}</div>
      </div>
    </div>
  );
}

export default function DiagnosticsPanel({ supabase, T }) {
  const [checks, setChecks] = useState(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  const run = useCallback(async () => {
    setRunning(true);
    const results = await runChecks(supabase);
    setChecks(results);
    setLastRun(new Date());
    setRunning(false);
  }, [supabase]);

  useEffect(() => { run(); }, [run]);

  const passCount = checks ? checks.filter(function(c){ return c.ok; }).length : 0;
  const totalCount = checks ? checks.length : 0;

  return (
    <div className="space-y-5">
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <h3 className="font-black text-sm flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 opacity-60" aria-hidden="true"/> Live Build Info
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Version', val: APP_VERSION + ' ' + EDITION, Icon: TypeIcon },
            { label: 'Build SHA', val: BUILD_SHA, Icon: Database },
            { label: 'Built', val: new Date(BUILD_DATE).toLocaleDateString(), Icon: Clock },
            { label: 'Feature Flags', val: Object.values(FEATURE_FLAGS).filter(Boolean).length + '/' + Object.keys(FEATURE_FLAGS).length + ' on', Icon: ToggleLeft },
          ].map(function({ label, val, Icon }) {
            return (
              <div key={label} className={`p-3 rounded-xl border ${T.sub}`}>
                <Icon className={`w-4 h-4 mb-1.5 ${T.accent}`} aria-hidden="true"/>
                <div className="text-sm font-black font-mono truncate">{val}</div>
                <div className="text-[9px] opacity-40 uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] opacity-30 mt-3">
          These values are read directly from the running bundle in your browser right now — not a claim, a live read.
        </p>
      </div>

      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 opacity-60" aria-hidden="true"/> Runtime Health Checks
          </h3>
          <button onClick={run} disabled={running}
            className={`text-[10px] border px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${T.accentBg}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true"/> Re-run
          </button>
        </div>
        {checks && (
          <div className={`mb-3 px-3 py-2 rounded-xl border text-xs font-bold ${passCount === totalCount ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>
            {passCount}/{totalCount} checks passing
            {lastRun && <span className="opacity-60 font-normal ml-2">· checked {lastRun.toLocaleTimeString()}</span>}
          </div>
        )}
        <div className={`divide-y ${T.divider}`}>
          {checks
            ? checks.map(function(c){ return <CheckRow key={c.id} label={c.label} ok={c.ok} detail={c.detail} />; })
            : <p className="text-xs opacity-40 py-4 text-center">Running checks…</p>}
        </div>
      </div>

      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <h3 className="font-black text-sm flex items-center gap-2 mb-3">
          <ToggleLeft className="w-4 h-4 opacity-60" aria-hidden="true"/> Feature Flags (this build)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(FEATURE_FLAGS).map(function([key, val]) {
            return (
              <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[10px] font-mono ${T.sub}`}>
                <span className="truncate opacity-70">{key}</span>
                <span className={`font-black flex-shrink-0 ml-2 ${val ? 'text-emerald-500' : 'text-red-500'}`}>{val ? 'ON' : 'OFF'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
