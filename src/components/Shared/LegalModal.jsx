import React, { useId } from 'react';
import { X, Shield, MessageCircle, ScrollText } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { fullVersionLine, buildStamp } from '../../utils/versionInfo.js';

const AUTHOR       = 'Prabhath Lokuge';
const WHATSAPP_RAW = '+94 77 002 0223';
const WHATSAPP_URL = 'https://wa.me/94770020223'; // wa.me format: no '+', no spaces/dashes

export default function LegalModal({ open, onClose, T }) {
  const titleId = useId();
  const containerRef = useFocusTrap(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[80] flex items-center justify-center p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-w-lg w-full max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${T.card}`}
      >
        {/* Fixed header */}
        <div className={`flex-shrink-0 flex justify-between items-center p-6 pb-4 border-b ${T.divider}`}>
          <div className="flex items-center gap-2">
            <ScrollText className={`w-5 h-5 ${T.accent}`} aria-hidden="true"/>
            <h3 id={titleId} className="text-lg font-black">Legal Notice &amp; Contact</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition"
          >
            <X className="w-4 h-4" aria-hidden="true"/>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-sm">

          {/* Copyright & legal */}
          <section className={`p-4 rounded-xl border space-y-2 ${T.sub}`}>
            <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 opacity-70">
              <Shield className="w-3.5 h-3.5" aria-hidden="true"/> Copyright &amp; Legal Notice
            </h4>
            <p className="text-xs leading-relaxed opacity-80">
              {fullVersionLine(AUTHOR)}. All rights reserved.
            </p>
            <p className="text-xs leading-relaxed opacity-70">
              This application, its complete source code, design system, transliteration
              engine, vector font compiler, and all associated original artwork and
              documentation are the exclusive intellectual property of {AUTHOR} / KRTD
              Studio. Unauthorized reproduction, duplication, redistribution, reverse
              engineering, or commercial resale of this software — in whole or in part —
              is strictly prohibited without prior written consent.
            </p>
            <p className="text-xs leading-relaxed opacity-70">
              Fonts, glyph data, and typographic assets created by individual users of this
              tool remain the intellectual property of their respective creators. This
              notice covers the KRTD Font Craft Ultra application itself, not user-generated
              content produced with it.
            </p>
            <p className="text-[10px] font-mono opacity-40 pt-1">
              Build: {buildStamp()}
            </p>
          </section>

          {/* Contact */}
          <section className={`p-4 rounded-xl border space-y-3 ${T.sub}`}>
            <h4 className="text-xs font-black uppercase tracking-wider opacity-70">Contact</h4>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3 rounded-xl border transition hover:opacity-90 ${T.accentBg}`}
            >
              <MessageCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true"/>
              <div>
                <div className="text-xs font-black">WhatsApp</div>
                <div className="text-xs font-mono opacity-80">{WHATSAPP_RAW}</div>
              </div>
            </a>

            <p className="text-[10px] opacity-50 leading-relaxed">
              For licensing inquiries, bug reports, or collaboration requests, reach out via
              WhatsApp above. Response times may vary.
            </p>
          </section>
        </div>

        {/* Fixed footer */}
        <div className={`flex-shrink-0 p-6 pt-4 border-t ${T.divider}`}>
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider ${T.btn}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
