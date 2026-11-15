import React, { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { loadAcc, saveOpen, isOpen } from '../../utils/uiState.js';

/**
 * Click / tap to expand, click again to collapse. Open state is remembered per `id`.
 * variant "card" = bordered panel, "flat" = light divider header (used inside long lists).
 */
export default function Collapsible({
  id, title, si, summary, icon: Icon, defaultOpen = false, forceOpen = false, variant = 'card', T, children, className = '',
}) {
  const [open, setOpen] = useState(() => isOpen(loadAcc(), id, defaultOpen));
  const uid = useId();
  const shown = forceOpen || open;
  const toggle = () => { const n = !open; setOpen(n); saveOpen(id, n); };
  const flat = variant === 'flat';
  return (
    <section className={`${flat ? `border-b ${T.divider}` : `rounded-xl border ${T.sub}`} ${className}`}>
      <h3 className="m-0">
        <button type="button" onClick={toggle} aria-expanded={shown} aria-controls={`${uid}-body`}
          className={`w-full flex items-center gap-2 text-left ${flat ? 'px-1 py-2' : 'px-3 py-2.5'} min-h-[40px]`}>
          {Icon && <Icon className="w-4 h-4 flex-shrink-0 opacity-80" aria-hidden="true" />}
          <span className="text-xs font-bold tracking-wide truncate">{title}{si && <span className="ml-1.5 font-semibold opacity-60">{si}</span>}</span>
          {summary != null && <span className="ml-auto pl-2 text-[11px] font-semibold opacity-70 whitespace-nowrap">{summary}</span>}
          <ChevronDown className={`w-4 h-4 flex-shrink-0 opacity-70 transition-transform ${summary != null ? '' : 'ml-auto'} ${shown ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      <div id={`${uid}-body`} hidden={!shown} className={flat ? 'pb-3 pt-1' : 'px-3 pb-3'}>
        {shown && children}
      </div>
    </section>
  );
}
