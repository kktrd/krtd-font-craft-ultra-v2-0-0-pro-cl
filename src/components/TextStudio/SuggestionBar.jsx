import React from 'react';
import { X } from 'lucide-react';

export default function SuggestionBar({ suggestions, onSelect, onDismiss, T }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 p-2 rounded-xl border animate-[slideDown_0.2s_ease-out] ${T.card}`}>
      <span className="text-[9px] font-black opacity-30 uppercase tracking-widest mr-1">Predict:</span>
      {suggestions.map(word => (
        <button
          key={word}
          onClick={() => onSelect(word)}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition font-sinhala ${T.accentBg}`}
        >
          {word}
        </button>
      ))}
      <button onClick={onDismiss} className="ml-auto p-1 opacity-30 hover:opacity-60 transition">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
