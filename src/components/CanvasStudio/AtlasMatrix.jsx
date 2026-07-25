import React, { useMemo, useState, memo } from 'react';
import { Type, Search, X, Copy, Users } from 'lucide-react';
import { GLYPH_SECTIONS } from '../../utils/glyphData.js';

function AtlasMatrix({
  selectedChar, setSelectedChar, glyphs, T, onSelect, onCopyGlyph,
  activeEditors = [], // [{id,name,color,char}] — collaborators currently on some char
}) {
  const [search, setSearch] = useState('');

  const totalChars = useMemo(() => GLYPH_SECTIONS.reduce((a, s) => a + s.chars.length, 0), []);
  const drawnCount = Object.keys(glyphs).length;
  const pct        = Math.round((drawnCount / totalChars) * 100);

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
            <Type className="w-3.5 h-3.5" aria-hidden="true"/> Atlas Matrix
          </h2>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${T.accentBg}`}
            role="status"
            aria-label={`${drawnCount} of ${totalChars} characters drawn, ${pct} percent complete`}
          >
            {drawnCount}/{totalChars}
          </span>
        </div>

        <div
          className={`w-full h-1.5 rounded-full overflow-hidden border ${T.sub}`}
          role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label="Font completion progress"
        >
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: T.accentHex }}/>
        </div>
        <p className="text-[9px] opacity-60 mt-0.5" aria-hidden="true">{pct}% complete</p>
      </div>

      {/* Search */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${T.sub}`}>
        <Search className="w-3.5 h-3.5 opacity-60 flex-shrink-0" aria-hidden="true"/>
        <label htmlFor="atlas-search" className="sr-only">Search for a character</label>
        <input
          id="atlas-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search char…"
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" className="opacity-60 hover:opacity-70">
            <X className="w-3.5 h-3.5" aria-hidden="true"/>
          </button>
        )}
      </div>

      {/* Copy glyph from selected */}
      {glyphs[selectedChar]?.length > 0 && onCopyGlyph && (
        <button
          onClick={() => onCopyGlyph(selectedChar)}
          aria-label={`Copy strokes from ${selectedChar} to paste into another character`}
          className={`w-full py-2 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1.5 transition ${T.accentBg}`}
        >
          <Copy className="w-3.5 h-3.5" aria-hidden="true"/>
          Copy &ldquo;{selectedChar}&rdquo; strokes → paste into another
        </button>
      )}

      {/* Glyph grid */}
      {filteredSections.length === 0 && (
        <p className="text-center py-6 text-xs opacity-60" role="status">No results for &ldquo;{search}&rdquo;</p>
      )}
      {filteredSections.map((section, si) => (
        <div key={si} className="space-y-1.5">
          <h3 className={`text-[9px] font-bold uppercase tracking-wider ${T.muted} opacity-60`}>
            {section.title}
          </h3>
          <div className="grid grid-cols-5 gap-2 relative" role="group" aria-label={section.title}>
            {section.chars.map((char) => {
              const isSelected  = selectedChar === char;
              const strokeCount = glyphs[char]?.length || 0;
              const editor      = editorByChar[char];
              const a11yLabel = `${char}${strokeCount ? `, ${strokeCount} stroke${strokeCount>1?'s':''} drawn` : ', not drawn yet'}${editor ? `, currently being edited by ${editor.name}` : ''}${isSelected ? ', selected' : ''}`;

              return (
                <button
                  key={char}
                  onClick={() => { setSelectedChar(char); onSelect?.(); }}
                  aria-label={a11yLabel}
                  aria-pressed={isSelected}
                  title={`${char}${strokeCount ? ` — ${strokeCount} stroke${strokeCount>1?'s':''}` : ''}${editor ? ` — ${editor.name} is editing` : ''}`}
                  className={`glyph-btn h-11 w-full text-lg font-medium rounded-xl border flex items-center justify-center relative font-sinhala ${isSelected ? T.glyphSel : T.glyphIdle}`}
                  style={editor ? { boxShadow: `0 0 0 2px ${editor.color}` } : undefined}
                >
                  <span className="leading-none select-none pointer-events-none" aria-hidden="true">{char}</span>

                  {strokeCount > 0 && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      aria-hidden="true"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.75)' : T.accentHex }}
                    />
                  )}

                  {strokeCount > 1 && (
                    <span
                      className="absolute bottom-0.5 left-1 text-[8px] font-black leading-none"
                      aria-hidden="true"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : T.accentHex }}
                    >
                      {strokeCount}
                    </span>
                  )}

                  {editor && (
                    <span
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center motion-safe:animate-pulse"
                      aria-hidden="true"
                      style={{ backgroundColor: editor.color, borderColor: 'white' }}
                    >
                      <Users className="w-2 h-2 text-white" aria-hidden="true"/>
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

// Perf: AtlasMatrix renders ~90 glyph buttons. Memoize so it only re-renders
// when its own props actually change, not on every unrelated App.jsx state
// update (e.g. a metrics slider drag shouldn't re-render the whole grid).
export default memo(AtlasMatrix);
