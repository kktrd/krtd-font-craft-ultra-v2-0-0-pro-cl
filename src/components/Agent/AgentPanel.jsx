import React, { useState, useMemo, useRef, useCallback, useEffect, useDeferredValue } from 'react';
import { Bot, X, Compass, MessageCircle, Workflow } from 'lucide-react';
import { useToast } from '../Shared/NotificationProvider.jsx';
import { analyzeProject } from '../../agent/projectAnalyzer.js';
import { localReply, autoFixList, label } from '../../agent/agentBrain.js';
import { runAgentAction } from '../../agent/agentExecutor.js';
import { askAI, pingAI, REASON_TEXT } from '../../agent/llmClient.js';
import { buildSnapshot } from '../../agent/snapshot.js';
import { useAgentAutopilot } from '../../hooks/useAgentAutopilot.js';
import AgentGuideTab from './AgentGuideTab.jsx';
import AgentChatTab from './AgentChatTab.jsx';
import AgentAutopilotTab from './AgentAutopilotTab.jsx';

const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const TABS = [
  { id: 'guide', label: 'Guide', Icon: Compass },
  { id: 'chat',  label: 'Chat',  Icon: MessageCircle },
  { id: 'auto',  label: 'Autopilot', Icon: Workflow },
];

let msgId = 0;
const mk = (role, text, extra = {}) => ({ id: ++msgId, role, text, ...extra });

export default function AgentPanel({
  T, glyphs, metrics, selectedChar, fontName, strokeWidth, brushMode, styleLearned,
  supabase, authUser, isOnline, getApi,
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('guide');
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [
    mk('agent', 'ආයුබෝවන්! මම KRTD Agent. ඔයාගේ font project එක බලලා, ඊළඟට අඳින්න ඕන අකුරු predict කරලා, ගැටළු හදලා දෙන්න පුළුවන්. "ඊළඟ අකුර?" කියලා අහන්න, නැත්නම් Guide tab එක බලන්න.'),
  ]);
  const [autopilot, setAutopilotState] = useState(() => lsGet('krtd_agent_autopilot') === '1');
  const [idleMs, setIdleMsState] = useState(() => Number(lsGet('krtd_agent_idle')) || 6000);
  const setAutopilot = (v) => { setAutopilotState(v); lsSet('krtd_agent_autopilot', v ? '1' : '0'); };
  const setIdleMs = (v) => { setIdleMsState(v); lsSet('krtd_agent_idle', String(v)); };

  const [aiEnabled, setAiEnabled] = useState(null); // null = unknown, false = not switched on (no names shown to users)
  const llmOffRef = useRef(false);
  const noticedRef = useRef(new Set());
  const panelRef = useRef(null);

  // ── Analysis (deferred so heavy drawing never waits on it) ─────────────
  const deferredGlyphs = useDeferredValue(glyphs);
  const pendingCloud = (() => { try { return !!localStorage.getItem('krtd_cloud_pending'); } catch { return false; } })();
  const analysis = useMemo(() => analyzeProject({
    glyphs: deferredGlyphs, metrics, selectedChar, styleLearned,
    env: { isOnline, hasSupabase: !!supabase, pendingCloud },
  }), [deferredGlyphs, metrics, selectedChar, styleLearned, isOnline, supabase, pendingCloud]);
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  const attention = analysis.issues.filter((i) => i.severity !== 'info').length;

  // ── Run actions ───────────────────────────────────────────────────────
  const run = useCallback(async (act, { silent = false } = {}) => {
    setBusy(true);
    try {
      const res = await runAgentAction(act, getApi());
      if (!silent) toast(`${res.ok ? '🤖' : '⚠️'} ${res.message}`, res.ok ? 'success' : 'error');
      return res;
    } finally { setBusy(false); }
  }, [getApi, toast]);

  const runMany = useCallback(async (acts) => {
    const results = [];
    for (const a of acts) { // sequential: later actions see the effect of earlier ones
      // eslint-disable-next-line no-await-in-loop
      const r = await run(a, { silent: true });
      results.push(`${r.ok ? '✅' : '⚠️'} ${label(a)} — ${r.message}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((ok) => setTimeout(ok, 60)); // let React commit state between steps
    }
    return results;
  }, [run]);

  const fixAll = useCallback(async () => {
    const fixes = autoFixList(analysisRef.current);
    if (!fixes.length) { toast('🤖 Auto-fix කරන්න දෙයක් නෑ', 'info'); return; }
    const lines = await runMany(fixes);
    setMessages((m) => [...m, mk('agent', `Auto-fix අවසන්:\n${lines.join('\n')}`)]);
    toast(`🤖 Auto-fix ${fixes.length}ක් අවසන්`, 'success');
  }, [runMany, toast]);

  const runStep = useCallback(async (step) => {
    const a = analysisRef.current;
    if (step.id === 'setup')  return run({ id: 'fix_metrics', args: {} });
    if (step.id === 'style')  return run({ id: 'apply_style_profile', args: {} });
    if (step.id === 'polish') return fixAll();
    if (step.id === 'ship')   { await run({ id: 'go_tab', args: { tab: 'text' } }); return run({ id: 'export_ttf', args: {} }); }
    const next = a.predicted[0];
    if (next) return run({ id: 'select_char', args: { char: next.char } });
    return undefined;
  }, [run, fixAll]);

  // ── Autopilot ─────────────────────────────────────────────────────────
  useAgentAutopilot({
    enabled: autopilot,
    idleMs,
    strokes: glyphs[selectedChar],
    selectedChar,
    getNext: (cur) => analysisRef.current.predicted.find((p) => p.char !== cur)?.char,
    onAdvance: (ch) => {
      getApi().selectChar(ch);
      toast(`🤖 Autopilot → "${ch}" (ඊළඟ අකුර)`, 'info', 2500);
    },
  });

  // ── Chat ──────────────────────────────────────────────────────────────
  const send = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    setInput('');
    const history = messages;
    setMessages((m) => [...m, mk('user', text)]);
    const local = localReply(text, analysisRef.current);

    if (local.understood) {
      setMessages((m) => [...m, mk('agent', local.text, { buttons: local.buttons })]);
      if (local.run.length) {
        const lines = await runMany(local.run);
        setMessages((m) => [...m, mk('agent', lines.join('\n'))]);
      }
      return;
    }

    // Free-form question -> cloud AI (Designers only), with silent local fallback
    if (supabase && authUser && !llmOffRef.current) {
      setBusy(true);
      const ctx = { fontName, selectedChar, metrics, brushMode, strokeWidth, signedIn: !!authUser, isOnline };
      const res = await askAI({ supabase, message: text, history, snapshot: buildSnapshot(analysisRef.current, ctx) });
      setBusy(false);
      if (res.ok) { setMessages((m) => [...m, mk('agent', res.reply, { buttons: res.actions, source: 'ai' })]); return; }
      if (res.reason === 'llm_not_configured') llmOffRef.current = true;
      const note = REASON_TEXT[res.reason];
      if (note && !noticedRef.current.has(res.reason)) {
        noticedRef.current.add(res.reason);
        setMessages((m) => [...m, mk('agent', note)]);
      }
    } else if (!authUser && !noticedRef.current.has('not_signed_in')) {
      noticedRef.current.add('not_signed_in');
      setMessages((m) => [...m, mk('agent', REASON_TEXT.not_signed_in)]);
    }
    setMessages((m) => [...m, mk('agent', local.text, { buttons: local.buttons })]);
  }, [busy, messages, runMany, supabase, authUser, fontName, selectedChar, metrics, brushMode, strokeWidth, isOnline]);

  // ── Open / close, keyboard ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (open) panelRef.current?.focus(); }, [open]);

  // Which cloud AI is actually switched on? (asked once per login, free)
  useEffect(() => {
    if (!open || !supabase || !authUser) return undefined;
    let alive = true;
    pingAI(supabase).then((r) => {
      if (!alive) return;
      if (r.ok) { setAiEnabled(r.enabled); llmOffRef.current = !r.enabled; }
      else if (r.reason === 'llm_not_configured') { setAiEnabled(false); llmOffRef.current = true; }
    });
    return () => { alive = false; };
  }, [open, supabase, authUser]);

  const llmReady = !!(supabase && authUser && !llmOffRef.current && aiEnabled !== false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close Agent' : `Open Agent${attention ? `, ${attention} items need attention` : ''}`}
        aria-expanded={open}
        title="KRTD Agent (Alt+A)"
        className={`fixed right-4 bottom-20 lg:bottom-16 lg:right-5 z-[65] w-12 h-12 rounded-full shadow-xl flex items-center justify-center border transition hover:scale-105 ${T.btn}`}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Bot className="w-6 h-6" aria-hidden="true" />}
        {!open && attention > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center" aria-hidden="true">{attention}</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="KRTD Agent"
          tabIndex={-1}
          className={`fixed z-[70] inset-x-0 bottom-0 agent-sheet rounded-t-2xl lg:inset-x-auto lg:right-5 lg:bottom-32 lg:w-[410px] lg:h-[min(660px,calc(100dvh-9rem))] lg:rounded-2xl flex flex-col border shadow-2xl sheet-enter outline-none safe-bottom ${T.card}`}
        >
          <div className={`flex-shrink-0 px-4 pt-3 pb-2 border-b ${T.divider}`}>
            <div className="w-10 h-1 rounded-full bg-current opacity-20 mx-auto mb-2 lg:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm flex items-center gap-2"><Bot className="w-4 h-4" aria-hidden="true" /> KRTD Agent
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded border border-current/20 opacity-70">{llmReady ? 'AI' : 'SMART'}</span>
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Agent" className="p-1.5 rounded-lg opacity-70 hover:opacity-100"><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
            <div role="tablist" aria-label="Agent sections" className={`mt-2 flex p-0.5 rounded-xl border text-[11px] font-black ${T.sub}`}>
              {TABS.map(({ id, label: l, Icon }) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${tab === id ? T.btn : 'opacity-70 hover:opacity-100'}`}>
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />{l}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex-1 min-h-0 p-4 ${tab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`} role="tabpanel">
            {tab === 'guide' && <AgentGuideTab analysis={analysis} T={T} busy={busy} onRun={run} selectedChar={selectedChar} />}
            {tab === 'auto' && <AgentAutopilotTab analysis={analysis} T={T} busy={busy} enabled={autopilot} setEnabled={setAutopilot} idleMs={idleMs} setIdleMs={setIdleMs} onRunStep={runStep} onFixAll={fixAll} />}
            {tab === 'chat' && (
              <AgentChatTab messages={messages} input={input} setInput={setInput} onSend={send} busy={busy} T={T} onRun={run} llmReady={llmReady} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
