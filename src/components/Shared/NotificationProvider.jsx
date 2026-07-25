import React, { useState, useCallback, createContext, useContext, useRef } from 'react';
import { CheckCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

/**
 * KRTD Toast + Modal System — replaces all native alert/confirm/prompt calls.
 * Self-contained styling: no T theme-token prop needed, works across all 3 themes.
 */

const ToastContext   = createContext(null);
const ConfirmContext = createContext(null);

export function useToast()   { return useContext(ToastContext);   }
export function useConfirm() { return useContext(ConfirmContext); }

export function NotificationProvider({ children }) {
  const [toasts,  setToasts]  = useState([]);
  const [dialog,  setDialog]  = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, type }]);
    if (duration > 0) setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
    return id;
  }, []);

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const confirm = useCallback((title, message) =>
    new Promise(resolve => setDialog({ type:'confirm', title, message, resolve, inputDefault:null })), []);

  const prompt = useCallback((title, inputDefault='') =>
    new Promise(resolve => setDialog({ type:'prompt', title, message:null, resolve, inputDefault })), []);

  const resolveDialog = (value) => { const r = dialog?.resolve; setDialog(null); r?.(value); };

  const STYLES = {
    success: { cls:'bg-emerald-700 border-emerald-600', icon:<CheckCircle  className="w-4 h-4 flex-shrink-0" aria-hidden="true"/> },
    error:   { cls:'bg-red-700 border-red-600',         icon:<AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true"/> },
    info:    { cls:'bg-slate-800 border-slate-700',     icon:<Info          className="w-4 h-4 flex-shrink-0" aria-hidden="true"/> },
    loading: { cls:'bg-slate-800 border-slate-700',     icon:<Loader2       className="w-4 h-4 flex-shrink-0 motion-safe:animate-spin" aria-hidden="true"/> },
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ConfirmContext.Provider value={{ confirm, prompt }}>
        {children}

        {/* Toast stack — bottom-right, accessible live region */}
        <div aria-live="polite" aria-atomic="false"
          className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-[340px] w-full pointer-events-none">
          {toasts.map(t => {
            const s = STYLES[t.type] || STYLES.info;
            return (
              <div key={t.id} role="status"
                className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-sm font-bold text-white pointer-events-auto motion-safe:animate-[slideUp_0.25s_ease-out] ${s.cls}`}>
                {s.icon}
                <span className="flex-1 leading-snug">{t.message}</span>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 flex-shrink-0">
                  <X className="w-3.5 h-3.5" aria-hidden="true"/>
                </button>
              </div>
            );
          })}
        </div>

        {/* Confirm / Prompt modal */}
        {dialog && <ConfirmModal dialog={dialog} onResolve={resolveDialog}/>}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

function ConfirmModal({ dialog, onResolve }) {
  const [inputValue, setInputValue] = useState(dialog.inputDefault || '');
  const titleId = React.useId();
  const containerRef = useRef(null);

  React.useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const focusable = () => Array.from(el.querySelectorAll('button, input'));
    focusable()[0]?.focus();
    const kd = (e) => {
      if (e.key === 'Escape') { onResolve(null); return; }
      if (e.key !== 'Tab') return;
      const items = focusable(); if (!items.length) return;
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length-1].focus(); }
      else if (!e.shiftKey && document.activeElement === items[items.length-1]) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', kd);
    return () => document.removeEventListener('keydown', kd);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm motion-safe:animate-[fadeIn_0.2s_ease-out]">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="max-w-sm w-full p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4 bg-slate-900 text-white">
        <h4 id={titleId} className="font-black text-base">{dialog.title}</h4>
        {dialog.message && <p className="text-sm opacity-70 leading-relaxed">{dialog.message}</p>}
        {dialog.type === 'prompt' && (
          <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onResolve(inputValue || null)} autoFocus
            className="w-full border border-slate-700 bg-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 text-white"/>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={() => onResolve(null)}
            className="px-4 py-2 rounded-xl font-bold text-sm border border-slate-700 hover:bg-slate-800 transition">Cancel</button>
          <button onClick={() => onResolve(dialog.type === 'prompt' ? (inputValue||null) : true)}
            className="px-4 py-2 rounded-xl font-bold text-sm bg-amber-700 hover:bg-amber-800 text-white transition">
            {dialog.type === 'prompt' ? 'OK' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
