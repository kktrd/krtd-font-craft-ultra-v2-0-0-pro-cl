import React, { useMemo, useState } from 'react';
import { Type, Search, X, Copy, Users } from 'lucide-react';
import { GLYPH_SECTIONS } from '../../utils/glyphData.js';

export default function AtlasMatrix({
  selectedChar, setSelectedChar, glyphs, T, onSelect, onCopyGlyph,
  activeEditors = [], // [{id,name,color,char}] — collaborators currently on some char
}) {
  const [search, setSearch] = useState('');

  const totalChars = useMemo(() => GLYPH_SECTIONS.reduce((a, s) => a + s.chars.length, 0), []);
  const drawnCount = Object.keys(glyphs).length;
  const pct        = Math.round((drawnCount / totalChars) * 100);

  // Map char -> editor (first match) for O(1) lookup per glyph button
  const editorByChar = useMemo(() => {
    const map = {};
    activeEditors.forEach(e => { if (e.char && !map[e.char]) map[e.char] = e; });
    return map;
  }, [activeEditors]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return GLYPH_SECTIONS;
    return GLYPH_SECTIONS.map(sec => ({
      ...sec,
      chars: sec.chars.filter(c => c.includes(search.trim())),
    })).filter(sec => sec.chars.length > 0);
  }, [search]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className={`pb-2 border-b ${T.divider}`}>
        <div className="flex justify-between items-center mb-1.5">
          <h2 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
            <Type className="w-3.5 h-3.5"/> Atlas Matrix
          </h2>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${T.accentBg}`}>
            {drawnCount}/{totalChars}
          </span>
        </div>

        <div className={`w-full h-1.5 rounded-full overflow-hidden border ${T.sub}`}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: T.accentHex }}/>
        </div>
        <p className="text-[9px] opacity-30 mt-0.5">{pct}% complete</p>
      </div>

      {/* Search */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${T.sub}`}>
        <Search className="w-3.5 h-3.5 opacity-30 flex-shrink-0"/>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search char…"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
        />
        {search && (
          <button onClick={() => setSearch('')} className="opacity-30 hover:opacity-70">
            <X className="w-3.5 h-3.5"/>
          </button>
        )}
      </div>

      {/* Copy glyph from selected */}
      {glyphs[selectedChar]?.length > 0 && onCopyGlyph && (
        <button
          onClick={() => onCopyGlyph(selectedChar)}
          className={`w-full py-2 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1.5 transition ${T.accentBg}`}
        >
          <Copy className="w-3.5 h-3.5"/>
          Copy &ldquo;{selectedChar}&rdquo; strokes → paste into another
        </button>
      )}

      {/* Glyph grid */}
      {filteredSections.length === 0 && (
        <p className="text-center py-6 text-xs opacity-30">No results for &ldquo;{search}&rdquo;</p>
      )}
      {filteredSections.map((section, si) => (
        <div key={si} className="space-y-1.5">
          <h3 className={`text-[9px] font-bold uppercase tracking-wider ${T.muted} opacity-60`}>
            {section.title}
          </h3>
          <div className="grid grid-cols-5 gap-2 relative">
            {section.chars.map((char) => {
              const isSelected  = selectedChar === char;
              const strokeCount = glyphs[char]?.length || 0;
              const editor      = editorByChar[char];

              return (
                <button
                  key={char}
                  onClick={() => { setSelectedChar(char); onSelect?.(); }}
                  className={`glyph-btn h-11 w-full text-lg font-medium rounded-xl border flex items-center justify-center relative font-sinhala
                    ${isSelected ? T.glyphSel : T.glyphIdle}`}
                  style={editor ? { boxShadow: `0 0 0 2px ${editor.color}` } : undefined}
                  title={`${char}${strokeCount ? ` — ${strokeCount} stroke${strokeCount>1?'s':''}` : ''}${editor ? ` — ${editor.name} is editing` : ''}`}
                >
                  <span className="leading-none select-none pointer-events-none">{char}</span>

                  {/* Has-content dot (top-right) */}
                  {strokeCount > 0 && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.75)' : T.accentHex }}
                    />
                  )}

                  {/* Stroke count badge */}
                  {strokeCount > 1 && (
                    <span
                      className="absolute bottom-0.5 left-1 text-[8px] font-black leading-none"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : T.accentHex }}
                    >
                      {strokeCount}
                    </span>
                  )}

                  {/* Live "being edited" avatar (top-left) */}
                  {editor && (
                    <span
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center animate-pulse"
                      style={{ backgroundColor: editor.color, borderColor: 'white' }}
                      title={editor.name}
                    >
                      <Users className="w-2 h-2 text-white" />
                    </span>
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
