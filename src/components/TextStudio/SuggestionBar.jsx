import React from 'react';
import { X } from 'lucide-react';

export default function SuggestionBar({ suggestions, onSelect, onDismiss, T }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 p-2 rounded-xl border motion-safe:animate-[slideDown_0.2s_ease-out] ${T.card}`} role="group" aria-label="Word suggestions">
      <span className="text-[9px] font-black opacity-60 uppercase tracking-widest mr-1" aria-hidden="true">Predict:</span>
      {suggestions.map(word => (
        <button
          key={word}
          onClick={() => onSelect(word)}
          aria-label={`Use suggestion: ${word}`}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition font-sinhala ${T.accentBg}`}
        >
          {word}
        </button>
      ))}
      <button onClick={onDismiss} aria-label="Dismiss suggestions" className="ml-auto p-1 opacity-60 hover:opacity-90 transition">
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
