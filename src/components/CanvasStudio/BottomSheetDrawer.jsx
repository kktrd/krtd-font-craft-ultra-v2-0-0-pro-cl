import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export default function BottomSheetDrawer({ open, onClose, title, children, T }) {
  const titleId = useId();
  const containerRef = useFocusTrap(open, onClose); // Tab-cycle trap + Escape-to-close + focus restore

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm sheet-overlay-enter"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-50 max-h-[75vh] flex flex-col rounded-t-2xl border-t shadow-2xl sheet-enter ${T.card}`}
      >
        {/* Handle + Header */}
        <div className={`flex-shrink-0 px-5 pt-3 pb-3 border-b ${T.divider}`}>
          <div className="w-10 h-1 rounded-full bg-current opacity-20 mx-auto mb-3" aria-hidden="true" />
          <div className="flex justify-between items-center">
            <h3 id={titleId} className="font-black text-sm">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
