import React, { useMemo } from 'react';
import { Activity, Minimize2 } from 'lucide-react';
import { inspectGlyph } from '../../utils/glyphInspector.js';

const CS = 500; // canvas coordinate space

export default function GlyphInspector({ selectedChar, glyphs, T }) {
  const info = useMemo(() => inspectGlyph(glyphs[selectedChar]), [glyphs, selectedChar]);

  if (!info) return (
    <div className={`p-3 rounded-xl border text-center ${T.sub}`}>
      <p className="text-[9px] opacity-60 font-medium">
        &ldquo;{selectedChar}&rdquo; — draw strokes to see glyph metrics
      </p>
    </div>
  );

  const { strokeCount, pointCount, bbox, centroid, widthStats, aspectRatio, complexity } = info;

  // Bounding box preview — scaled to 80×80 display inside a 100×100 coordinate frame
  const scale   = 80 / CS;
  const bboxStyle = {
    left:   `${bbox.x * scale}px`,
    top:    `${bbox.y * scale}px`,
    width:  `${Math.max(2, bbox.w * scale)}px`,
    height: `${Math.max(2, bbox.h * scale)}px`,
  };
  const centroidStyle = {
    left: `${centroid.x * scale - 3}px`,
    top:  `${centroid.y * scale - 3}px`,
  };

  const rows = [
    ['Strokes',      strokeCount,                     ''],
    ['Points',       pointCount,                      ''],
    ['Bounding Box', `${bbox.w} × ${bbox.h}`,          'px'],
    ['Aspect Ratio', aspectRatio,                     ''],
    ['Avg Width',    widthStats.avg,                  'px'],
    ['Contrast',     `${widthStats.contrast}%`,       ''],
    ['Complexity',   `${complexity}/100`,             ''],
  ];

  return (
    <div className={`rounded-xl border overflow-hidden ${T.sub}`} aria-label="Glyph Inspector">
      <div className={`flex items-center justify-between px-3 py-2 border-b ${T.divider}`}>
        <h3 className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
          <Activity className="w-3 h-3" aria-hidden="true"/> Glyph Inspector
        </h3>
        <span className={`text-[9px] font-black font-sinhala ${T.accent}`}>{selectedChar}</span>
      </div>

      <div className="flex gap-3 p-3">
        {/* Bounding box visual */}
        <div className="flex-shrink-0 relative bg-slate-900/10 rounded-lg border"
          style={{ width:'82px', height:'82px' }} aria-hidden="true">
          {/* centroid crosshair */}
          <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 opacity-70"
            style={centroidStyle}/>
          {/* bounding box outline */}
          <div className="absolute border border-cyan-400/60 rounded-sm" style={bboxStyle}/>
          {/* center lines */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-current"/>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-current"/>
          </div>
        </div>

        {/* Metric rows */}
        <div className="flex-1 space-y-0.5 min-w-0">
          {rows.map(([label, val, unit]) => (
            <div key={label} className="flex justify-between items-baseline">
              <span className="text-[8px] font-bold opacity-60 truncate">{label}</span>
              <span className={`text-[9px] font-mono font-black ml-2 flex-shrink-0 ${T.accent}`}>
                {val}{unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Complexity bar */}
      <div className={`px-3 pb-3`}>
        <div className="flex justify-between text-[8px] opacity-50 mb-1">
          <span>Path complexity</span>
          <span>{complexity}/100</span>
        </div>
        <div className="w-full h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width:`${complexity}%`, backgroundColor: complexity > 70 ? '#f87171' : complexity > 40 ? '#fbbf24' : '#34d399' }}/>
        </div>
      </div>
    </div>
  );
}
