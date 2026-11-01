import React, { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { ActionButton } from './AgentParts.jsx';
import { PROVIDER_LABELS } from '../../agent/llmClient.js';

const QUICK = ['ඊළඟ අකුර?', 'score බලන්න', 'issues', 'fix all', 'save', 'export ttf'];

export default function AgentChatTab({ messages, input, setInput, onSend, busy, T, onRun, llmReady }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, busy]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1" role="log" aria-live="polite" aria-label="Agent conversation">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${m.role === 'user' ? T.btn : T.sub + ' border'}`}>
              {m.text}
              {m.source && m.source !== 'local' && <div className="mt-1 text-[9px] font-black uppercase tracking-widest opacity-60">{PROVIDER_LABELS[m.source] || 'AI'}</div>}
              {m.buttons?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.buttons.map((b, i) => <ActionButton key={i} act={b} onRun={onRun} T={T} busy={busy} />)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-[11px] opacity-60 px-2" aria-live="polite">Agent සිතමින්…</div>}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5 py-2">
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={busy} onClick={() => onSend(q)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border disabled:opacity-50 ${T.btnGhost}`}>{q}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSend(input); }} className="flex gap-2">
        <label htmlFor="agent-input" className="sr-only">Message the Agent</label>
        <input id="agent-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
          autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={llmReady ? 'ඕනෑම දෙයක් අහන්න… (Cloud AI ON)' : 'Command එකක් type කරන්න… (ex: ක, fix all)'}
          className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl border text-sm outline-none ${T.input}`} />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className={`px-3 rounded-xl disabled:opacity-50 ${T.btn}`}>
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
