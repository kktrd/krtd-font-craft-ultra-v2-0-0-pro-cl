import React, { useState } from 'react';
import { Copyright, Shield, Activity, ChevronRight } from 'lucide-react';
import { fullVersionLine } from '../../utils/versionInfo.js';
import LegalModal from './LegalModal.jsx';

export default function Footer({ T }) {
  const [showLegal, setShowLegal] = useState(false);

  return (
    <footer className={`border-t mt-8 md:mt-0 md:flex-shrink-0 transition-all ${T.card}`}>
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">

        {/* Copyright — high-contrast, bold, clickable to open full legal + contact info */}
        <button
          onClick={() => setShowLegal(true)}
          className={`flex items-center gap-2 text-[10px] font-black tracking-widest uppercase transition hover:underline underline-offset-2 ${T.accent}`}
        >
          <Copyright className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true"/>
          <span>{fullVersionLine()}</span>
          <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" aria-hidden="true"/>
        </button>

        {/* NOTE: opacity is applied per-element here, not on this shared wrapper —
            CSS opacity compounds down the tree and can't be "brightened back up" by
            a child's own opacity value, which would have silently broken the hover
            effect on the clickable Shield button below. */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[9px] font-bold tracking-widest uppercase">
          <button
            onClick={() => setShowLegal(true)}
            className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition"
          >
            <Shield className="w-3 h-3" aria-hidden="true"/>
            Unauthorized duplication prohibited
          </button>
          <span className="w-1 h-1 rounded-full bg-current opacity-70 hidden sm:inline-block" />
          <span className="flex items-center gap-1.5 opacity-70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true"/>
            <Activity className="w-3 h-3" aria-hidden="true"/>
            Engine: Nominal
          </span>
        </div>
      </div>

      <LegalModal open={showLegal} onClose={() => setShowLegal(false)} T={T}/>
    </footer>
  );
}
