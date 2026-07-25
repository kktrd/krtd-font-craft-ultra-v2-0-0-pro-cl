import React from 'react';
import { Copyright, Shield, Activity } from 'lucide-react';
import { COPYRIGHT_NOTICE } from '../../utils/security.js';

export default function Footer({ T }) {
  return (
    <footer className={`border-t mt-8 transition-all ${T.card}`}>
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className={`flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase opacity-50`}>
          <Copyright className="w-3 h-3 flex-shrink-0" />
          <span>© 2026 KRTD Font Craft Ultra v2.0.0 PRO · Prabhath Lokuge</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[9px] font-bold tracking-widest uppercase opacity-70">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            Unauthorized duplication prohibited
          </span>
          <span className="w-1 h-1 rounded-full bg-current hidden sm:inline-block" />
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Activity className="w-3 h-3" />
            Engine: Nominal
          </span>
        </div>
      </div>
    </footer>
  );
}
