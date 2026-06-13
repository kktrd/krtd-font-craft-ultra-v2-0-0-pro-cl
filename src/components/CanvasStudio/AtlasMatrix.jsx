import React, { useMemo } from 'react';
import { Type } from 'lucide-react';
import { GLYPH_SECTIONS } from '../../utils/glyphData.js';

export default function AtlasMatrix({ selectedChar, setSelectedChar, glyphs, T, onSelect }) {
  const totalChars = useMemo(() => GLYPH_SECTIONS.reduce((a, s) => a + s.chars.length, 0), []);
  const drawnCount = Object.keys(glyphs).length;
  const pct = Math.round((drawnCount / totalChars) * 100);

  return (
    <div className="space-y-4">
      {/* Header + progress */}
      <div className={`pb-2 border-b ${T.divider}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
            <Type className="w-3.5 h-3.5" /> Atlas Matrix
          </h2>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${T.accentBg}`}>
            {drawnCount}/{totalChars}
          </span>
        </div>
        {/* Progress bar */}
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${T.sub} border`}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: T.accentHex }}
          />
        </div>
        <p className="text-[9px] opacity-30 mt-1 font-medium">{pct}% complete</p>
      </div>

      {GLYPH_SECTIONS.map((section, si) => (
        <div key={si} className="space-y-1.5">
          <h3 className={`text-[9px] font-bold uppercase tracking-wider ${T.muted} opacity-60`}>
            {section.title}
          </h3>
          <div className="grid grid-cols-5 gap-2 relative">
            {section.chars.map((char) => {
              const isSelected = selectedChar === char;
              const hasGlyph   = glyphs[char]?.length > 0;
              return (
                <button
                  key={char}
                  onClick={() => { setSelectedChar(char); onSelect?.(); }}
                  className={`glyph-btn h-11 w-full text-lg font-medium rounded-xl border flex items-center justify-center relative font-sinhala
                    ${isSelected ? T.glyphSel : T.glyphIdle}`}
                >
                  <span className="leading-none select-none pointer-events-none">{char}</span>
                  {/* FIX: use inline style for dot color - no broken className logic */}
                  {hasGlyph && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.75)' : T.accentHex }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
