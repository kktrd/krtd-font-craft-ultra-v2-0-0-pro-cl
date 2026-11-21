import React, { useRef } from 'react';
import { refCss, dragTo, pinchTo, setRef } from '../../utils/referenceArt.js';

// Tracing-paper image above the drawing canvas. Normally it ignores the pointer (you draw through it);
// in "Adjust" mode it captures drag (move), wheel and two-finger pinch (size).
export default function ReferenceOverlay({ art, dark, canvasPx }) {
  const ptrs = useRef(new Map());
  const last = useRef(null);
  if (!art.src || !art.visible) return null;

  const dist = () => { const [a, b] = [...ptrs.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const down = (e) => {
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = ptrs.current.size === 2 ? { d: dist() } : { x: e.clientX, y: e.clientY };
  };
  const move = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    e.preventDefault();
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && last.current && last.current.d) {
      const d = dist();
      if (d > 0) { setRef({ scale: pinchTo(art, d / last.current.d) }); last.current = { d }; }
    } else if (last.current && last.current.x !== undefined) {
      setRef(dragTo(art, e.clientX - last.current.x, e.clientY - last.current.y, canvasPx));
      last.current = { x: e.clientX, y: e.clientY };
    }
  };
  const up = (e) => { ptrs.current.delete(e.pointerId); last.current = ptrs.current.size === 1 ? (() => { const p = [...ptrs.current.values()][0]; return { x: p.x, y: p.y }; })() : null; };
  const wheel = (e) => { e.preventDefault(); setRef({ scale: pinchTo(art, e.deltaY < 0 ? 1.05 : 0.95) }); };

  return (
    <div aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: art.adjust ? 5 : 2, overflow: 'hidden',
        pointerEvents: art.adjust ? 'auto' : 'none', touchAction: 'none', cursor: art.adjust ? 'move' : 'default',
        outline: art.adjust ? '2px dashed #f59e0b' : 'none', outlineOffset: -2 }}
      onPointerDown={art.adjust ? down : undefined} onPointerMove={art.adjust ? move : undefined}
      onPointerUp={art.adjust ? up : undefined} onPointerCancel={art.adjust ? up : undefined}
      onWheel={art.adjust ? wheel : undefined}>
      <img src={art.src} alt="" draggable={false} style={refCss(art, dark)} />
    </div>
  );
}
