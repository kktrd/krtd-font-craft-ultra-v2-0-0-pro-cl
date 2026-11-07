import React, { useEffect, useRef } from 'react';
import { paintGuideFill, paintStrokes } from '../../utils/shapeGuide.js';

const SZ = 500, VIEW = 130;

/** Three mini canvases: standard shape · your drawing · overlay. Read-only, nothing is saved. */
export default function ShapeCompare({ T, char, strokes, params, metrics, fontTick }) {
  const a = useRef(null), b = useRef(null), c = useRef(null);
  useEffect(() => {
    const clear = (cv) => { const x = cv.getContext('2d'); x.clearRect(0, 0, SZ, SZ); return x; };
    const k = SZ / SZ; // canvases are 500 internal, shown at VIEW px
    if (a.current) paintGuideFill(clear(a.current), char, params, metrics, k, '#0ea5e9');
    if (b.current) paintStrokes(clear(b.current), strokes, k, '#ec4899', 8);
    if (c.current) {
      const x = clear(c.current);
      x.globalAlpha = 0.55; paintGuideFill(x, char, params, metrics, k, '#0ea5e9');
      x.globalAlpha = 0.75; paintStrokes(x, strokes, k, '#ec4899', 8);
    }
  }, [char, strokes, params, metrics, fontTick]);
  const cell = (ref, label) => (
    <figure className="flex flex-col items-center gap-1 m-0">
      <canvas ref={ref} width={SZ} height={SZ} aria-label={label} role="img"
        className={`rounded-lg border ${T.canvasBg}`} style={{ width: VIEW, height: VIEW }} />
      <figcaption className="text-[9px] font-bold opacity-70">{label}</figcaption>
    </figure>
  );
  return (
    <div className="flex flex-wrap gap-3 justify-center" aria-label="Compare view">
      {cell(a, 'Standard')}{cell(b, 'ඔයාගේ')}{cell(c, 'Overlay')}
    </div>
  );
}
