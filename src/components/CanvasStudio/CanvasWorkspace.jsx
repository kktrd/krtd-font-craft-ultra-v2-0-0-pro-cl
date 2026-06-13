import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Paintbrush, Eraser, Undo2, Redo2, Minus, Plus,
  Grid3X3, Sparkles, Layers, ChevronUp, Image, Keyboard
} from 'lucide-react';
import { rdpSimplify } from '../../utils/rdpSimplifier.js';
import { GLYPH_VARIATION_RULES } from '../../utils/glyphData.js';

const CS = 500; // internal canvas coordinate size — never changes

export default function CanvasWorkspace({
  theme, T,
  selectedChar,
  glyphs, setGlyphs,
  undoStack, setUndoStack,
  redoStack, setRedoStack,
  strokeWidth, setStrokeWidth,
  brushMode, setBrushMode,
  isEraser, setIsEraser,
  snapEnabled, setSnapEnabled,
  aiSmooth, setAiSmooth,
  showMetrics, setShowMetrics,
  zoomLevel, setZoomLevel,
  metrics,
  onOpenAtlas,
  onOpenMetrics,
}) {
  const canvasRef      = useRef(null);
  const containerRef   = useRef(null);
  const contextRef     = useRef(null);
  const isDrawingRef   = useRef(false);
  const strokeRef      = useRef([]);
  const lastPtRef      = useRef(null);
  const lastMidRef     = useRef({ x: 0, y: 0 });
  const widthRef       = useRef(strokeWidth);

  // FIX #2 — Responsive: track container width to auto-scale canvas
  const [containerW, setContainerW] = useState(CS);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerW(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // FIX #1 — base scale = fit canvas into container; zoom multiplies on top
  const baseScale   = Math.min(1, (containerW - 4) / CS);
  const totalScale  = baseScale * zoomLevel;
  const displaySize = CS * totalScale; // actual CSS pixels the canvas renders at

  // ── Draw grid ───────────────────────────────────────────────────────────
  const drawGrid = useCallback((ctx) => {
    ctx.clearRect(0, 0, CS, CS);
    const minor = theme==='dark' ? '#0f172a' : theme==='comfort' ? '#ede8db' : '#f1f5f9';
    const major = theme==='dark' ? '#1e293b' : theme==='comfort' ? '#e0d8c8' : '#e2e8f0';

    ctx.lineWidth = 0.5; ctx.strokeStyle = minor;
    for (let i = 0; i <= CS; i += 20) {
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,CS); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CS,i); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.strokeStyle = major;
    for (let i = 0; i <= CS; i += 100) {
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,CS); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CS,i); ctx.stroke();
    }

    if (showMetrics) {
      const lines = [
        { y: metrics.ascender,  c: '#c084fc', w: 1,   dash: [4,4], label: 'Ascender'  },
        { y: metrics.capHeight, c: '#f472b6', w: 1,   dash: [4,4], label: 'Cap'       },
        { y: metrics.xHeight,   c: '#3b82f6', w: 1.5, dash: [4,4], label: 'x-Height' },
        { y: metrics.baseline,  c: '#ef4444', w: 2,   dash: [],    label: 'Baseline'  },
        { y: metrics.descender, c: '#fb923c', w: 1,   dash: [4,4], label: 'Descender'},
      ];
      lines.forEach(({ y, c, w, dash, label }) => {
        ctx.setLineDash(dash); ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CS, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c;
        ctx.font = '700 9px "DM Sans", system-ui, sans-serif';
        ctx.fillText(label, 4, y - 3);
      });
    }
  }, [theme, showMetrics, metrics]);

  // ── Redraw glyph ────────────────────────────────────────────────────────
  const redrawGlyph = useCallback((pack, ctx) => {
    const c = ctx || contextRef.current;
    if (!c || !pack) return;
    drawGrid(c);
    pack.forEach(line => {
      if (line.length < 2) return;
      let lx = line[0].x, ly = line[0].y, lmx = lx, lmy = ly;
      for (let i = 1; i < line.length; i++) {
        const pt = line[i];
        const mx = (lx + pt.x) / 2, my = (ly + pt.y) / 2;
        c.beginPath(); c.moveTo(lmx, lmy);
        if (aiSmooth) { c.quadraticCurveTo(lx, ly, mx, my); lmx = mx; lmy = my; }
        else          { c.lineTo(pt.x, pt.y); lmx = pt.x; lmy = pt.y; }
        c.lineWidth   = pt.strokeWidth || strokeWidth;
        c.strokeStyle = pt.isEraser ? T.eraseColor : T.inkColorRedraw;
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.stroke();
        lx = pt.x; ly = pt.y;
      }
    });
  }, [drawGrid, aiSmooth, strokeWidth, T]);

  // Init / re-init canvas when char/theme/metrics changes
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    contextRef.current = ctx;
    if (glyphs[selectedChar]?.length) redrawGlyph(glyphs[selectedChar], ctx);
    else drawGrid(ctx);
  }, [selectedChar, theme, showMetrics, metrics]);

  // Redraw when aiSmooth changes
  useEffect(() => {
    if (!contextRef.current) return;
    if (glyphs[selectedChar]?.length) redrawGlyph(glyphs[selectedChar]);
    else drawGrid(contextRef.current);
  }, [aiSmooth]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs/textareas
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleUndo(); }
        if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); }
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'e': setIsEraser(true);  break;
        case 'b': setIsEraser(false); break;
        case 'm': setShowMetrics(s => !s); break;
        case 's': setSnapEnabled(s => !s); break;
        case '[': setStrokeWidth(w => Math.max(2,  w - 2)); break;
        case ']': setStrokeWidth(w => Math.min(48, w + 2)); break;
        case '1': setZoomLevel(1);   break;
        case '2': setZoomLevel(1.5); break;
        case '3': setZoomLevel(2);   break;
        case '4': setZoomLevel(3);   break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack, glyphs, selectedChar]);

  // ── Pointer coordinate mapping ──────────────────────────────────────────
  // FIX: divide by totalScale because CSS canvas is displaySize px, not CS px
  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    // Map from display-pixel space → internal 500x500 space
    let rx = ((cx - rect.left) / displaySize) * CS;
    let ry = ((cy - rect.top)  / displaySize) * CS;
    if (snapEnabled) { rx = Math.round(rx/20)*20; ry = Math.round(ry/20)*20; }
    return { x: Math.max(0, Math.min(CS, rx)), y: Math.max(0, Math.min(CS, ry)), time: Date.now() };
  }, [displaySize, snapEnabled]);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const c = getCoords(e);
    isDrawingRef.current = true;
    lastPtRef.current    = c;
    lastMidRef.current   = { x: c.x, y: c.y };
    widthRef.current     = strokeWidth;
    strokeRef.current    = [{ x: c.x, y: c.y, isEraser, strokeWidth }];
  }, [getCoords, strokeWidth, isEraser]);

  const draw = useCallback((e) => {
    if (!isDrawingRef.current) return; e.preventDefault();
    const c  = getCoords(e);
    const lp = lastPtRef.current; if (!lp) return;
    const dx = c.x - lp.x, dy = c.y - lp.y;
    const dist = Math.hypot(dx, dy); if (dist < 0.3) return;
    const vel  = dist / ((c.time - lp.time) || 1);

    let targetW = strokeWidth;
    if (!isEraser) {
      if (brushMode === 'calligraphy') {
        const spd  = Math.max(0.3, 1 - vel * 0.13);
        const ang  = Math.atan2(dy, dx);
        const angF = 0.4 + 0.6 * Math.abs(Math.sin(ang - Math.PI / 4));
        targetW = Math.max(2.5, Math.min(strokeWidth * 1.5, strokeWidth * spd * angF));
      } else if (brushMode === 'tapered') {
        const prog = strokeRef.current.length;
        if (prog < 12) targetW = Math.max(2, strokeWidth * (prog / 12));
      }
    }
    widthRef.current = widthRef.current + (targetW - widthRef.current) * 0.25;
    const cw  = widthRef.current;
    const mx  = (lp.x + c.x) / 2, my = (lp.y + c.y) / 2;
    const ctx = contextRef.current;
    ctx.beginPath(); ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
    if (aiSmooth) { ctx.quadraticCurveTo(lp.x, lp.y, mx, my); lastMidRef.current = { x: mx, y: my }; }
    else          { ctx.lineTo(c.x, c.y); lastMidRef.current = { x: c.x, y: c.y }; }
    ctx.lineWidth   = cw;
    ctx.strokeStyle = isEraser ? T.eraseColor : T.inkColor;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    lastPtRef.current = c;
    strokeRef.current.push({ x: c.x, y: c.y, isEraser, strokeWidth: cw });
  }, [getCoords, strokeWidth, isEraser, brushMode, aiSmooth, T]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return; isDrawingRef.current = false;
    const raw = [...strokeRef.current];
    if (raw.length < 2) return;

    // FIX #3 — RDP returns references to original objects, no remapping needed
    let stroke = raw[0]?.isEraser ? raw : rdpSimplify(raw, 1.5);

    // Tapered tail
    if (!isEraser && brushMode === 'tapered' && stroke.length > 12) {
      stroke = stroke.map((pt, i) => {
        const fromTail = stroke.length - 1 - i;
        return fromTail < 12 ? { ...pt, strokeWidth: Math.max(2, strokeWidth * (fromTail / 12)) } : pt;
      });
    }

    const prev    = glyphs[selectedChar] || [];
    setUndoStack(u => [...u.slice(-49), { char: selectedChar, strokes: prev }]);
    setRedoStack([]);
    const updated = { ...glyphs, [selectedChar]: [...prev, stroke] };
    setGlyphs(updated);
    strokeRef.current = []; lastPtRef.current = null;
    redrawGlyph(updated[selectedChar]);
  }, [glyphs, selectedChar, isEraser, brushMode, strokeWidth, redrawGlyph]);

  // ── Undo / Redo ─────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r.slice(-49), { char: selectedChar, strokes: glyphs[selectedChar] || [] }]);
    setUndoStack(u => u.slice(0, -1));
    const updated = { ...glyphs, [prev.char]: prev.strokes };
    setGlyphs(updated);
    if (prev.strokes.length) redrawGlyph(prev.strokes);
    else drawGrid(contextRef.current);
  }, [undoStack, redoStack, glyphs, selectedChar, drawGrid, redrawGlyph]);

  const handleRedo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u.slice(-49), { char: selectedChar, strokes: glyphs[selectedChar] || [] }]);
    setRedoStack(r => r.slice(0, -1));
    const updated = { ...glyphs, [next.char]: next.strokes };
    setGlyphs(updated);
    if (next.strokes.length) redrawGlyph(next.strokes);
    else drawGrid(contextRef.current);
  }, [redoStack, undoStack, glyphs, selectedChar, drawGrid, redrawGlyph]);

  const clearCanvas = useCallback(() => {
    setUndoStack(u => [...u.slice(-49), { char: selectedChar, strokes: glyphs[selectedChar] || [] }]);
    setRedoStack([]);
    drawGrid(contextRef.current);
    const updated = { ...glyphs }; delete updated[selectedChar];
    setGlyphs(updated);
  }, [glyphs, selectedChar, drawGrid]);

  // ── PNG export ───────────────────────────────────────────────────────────
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const url  = canvas.toDataURL('image/png');
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `glyph_${selectedChar.codePointAt(0).toString(16)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }, [selectedChar]);

  // ── Skeleton & variations ────────────────────────────────────────────────
  const loadSkeleton = () => {
    let strokes = [];
    if (selectedChar === 'අ') {
      const l1 = [], l2 = [];
      for (let t=0; t<=Math.PI*2; t+=0.18) l1.push({ x:200+Math.cos(t)*52, y:220+Math.sin(t)*52, isEraser:false, strokeWidth:14 });
      for (let x=200; x<=380; x+=14) l2.push({ x, y:260+Math.sin(x/40)*38, isEraser:false, strokeWidth:14 });
      strokes = [l1, l2];
    } else {
      const c = [];
      for (let t=0; t<=Math.PI*2; t+=0.16) c.push({ x:250+Math.cos(t)*78, y:255+Math.sin(t)*78, isEraser:false, strokeWidth:10 });
      strokes = [c];
    }
    setUndoStack(u => [...u.slice(-49), { char: selectedChar, strokes: glyphs[selectedChar] || [] }]);
    const updated = { ...glyphs, [selectedChar]: strokes };
    setGlyphs(updated); redrawGlyph(strokes);
  };

  const autoVariations = () => {
    const targets = GLYPH_VARIATION_RULES[selectedChar];
    if (!targets || !glyphs[selectedChar]?.length) { alert(`⚠️ "${selectedChar}" glyph data නෑ.`); return; }
    const updated = { ...glyphs };
    targets.forEach(t => { updated[t] = JSON.parse(JSON.stringify(glyphs[selectedChar])); });
    setGlyphs(updated);
    alert(`✨ ${targets.join(', ')} copy වුනා!`);
  };

  const BRUSH_MODES = ['calligraphy','tapered','uniform'];
  const ZOOM_LEVELS = [1, 1.5, 2, 3];

  // FIX #12 — eraser bg color per theme
  const eraserActiveClass = theme==='dark'
    ? 'bg-slate-800 text-red-400 shadow-sm'
    : theme==='comfort' ? 'bg-[#fdfbf7] text-red-500 shadow-sm'
    : 'bg-white text-red-500 shadow-sm';

  const brushActiveClass = theme==='dark'
    ? 'bg-slate-800 text-cyan-400 shadow-sm'
    : theme==='comfort' ? 'bg-[#fdfbf7] text-amber-800 shadow-sm'
    : 'bg-white text-indigo-600 shadow-sm';

  return (
    <div className="space-y-3">

      {/* Keyboard shortcuts panel */}
      {showShortcuts && (
        <div className={`p-3 rounded-xl border text-[10px] animate-[slideDown_0.2s_ease-out] ${T.sub}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 font-mono">
            {[
              ['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['E','Eraser'],
              ['B','Brush'],['M','Toggle Metrics'],['S','Toggle Snap'],
              ['[ / ]','Size -/+'],['1-4','Zoom levels'],
            ].map(([k,v]) => (
              <div key={k} className="flex items-center gap-2">
                <kbd className={`px-1.5 py-0.5 rounded font-black border text-[9px] ${T.card}`}>{k}</kbd>
                <span className="opacity-50">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Title + toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${T.divider}`}>
        <div>
          <span className="text-[9px] font-bold uppercase opacity-40">Canvas Workspace</span>
          <h2 className="text-xl font-black font-sinhala leading-tight">&ldquo;{selectedChar}&rdquo;</h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Brush / Eraser */}
          <div className={`flex p-0.5 rounded-xl border ${T.sub}`}>
            <button onClick={() => setIsEraser(false)} title="Brush (B)"
              className={`p-2 rounded-lg transition ${!isEraser ? brushActiveClass : 'opacity-35'}`}>
              <Paintbrush className="w-4 h-4"/>
            </button>
            <button onClick={() => setIsEraser(true)} title="Eraser (E)"
              className={`p-2 rounded-lg transition ${isEraser ? eraserActiveClass : 'opacity-35'}`}>
              <Eraser className="w-4 h-4"/>
            </button>
          </div>
          {/* Undo / Redo */}
          <button onClick={handleUndo} disabled={!undoStack.length} title="Undo (Ctrl+Z)"
            className={`border p-2 rounded-xl disabled:opacity-20 transition ${T.btnGhost}`}>
            <Undo2 className="w-4 h-4"/>
          </button>
          <button onClick={handleRedo} disabled={!redoStack.length} title="Redo (Ctrl+Y)"
            className={`border p-2 rounded-xl disabled:opacity-20 transition ${T.btnGhost}`}>
            <Redo2 className="w-4 h-4"/>
          </button>
          {/* PNG export */}
          <button onClick={exportPNG} title="Export PNG"
            className={`border p-2 rounded-xl transition ${T.btnGhost}`}>
            <Image className="w-4 h-4"/>
          </button>
          {/* Keyboard shortcuts toggle */}
          <button onClick={() => setShowShortcuts(s => !s)} title="Keyboard shortcuts"
            className={`border p-2 rounded-xl transition ${showShortcuts ? T.accentBg : T.btnGhost}`}>
            <Keyboard className="w-4 h-4"/>
          </button>
          {/* Clear */}
          <button onClick={clearCanvas}
            className={`text-[10px] px-3 py-2 rounded-xl font-bold transition border ${T.btnDanger}`}>
            Clear
          </button>
        </div>
      </div>

      {/* Brush controls */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5 rounded-xl border text-[10px] font-black ${T.sub}`}>
        <div className="flex items-center gap-1">
          <span className="opacity-40">MODE:</span>
          {BRUSH_MODES.map(m => (
            <button key={m} onClick={() => setBrushMode(m)}
              className={`px-2 py-1 rounded-lg border transition capitalize ${brushMode===m ? T.btn : 'opacity-40 hover:opacity-70'}`}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="opacity-40">SIZE:</span>
          <button onClick={() => setStrokeWidth(w => Math.max(2,  w-2))} className="p-1"><Minus className="w-3.5 h-3.5 opacity-50"/></button>
          <span className="font-mono w-5 text-center">{strokeWidth}</span>
          <button onClick={() => setStrokeWidth(w => Math.min(48, w+2))} className="p-1"><Plus  className="w-3.5 h-3.5 opacity-50"/></button>
        </div>
        <div className="flex items-center gap-1">
          {[['Snap',snapEnabled,()=>setSnapEnabled(s=>!s)],['Smooth',aiSmooth,()=>setAiSmooth(s=>!s)],['Metrics',showMetrics,()=>setShowMetrics(s=>!s)]].map(([l,a,fn])=>(
            <button key={l} onClick={fn} className={`px-2 py-1 rounded-lg border transition ${a ? T.btn : 'opacity-40 hover:opacity-70'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Zoom */}
      <div className={`flex items-center gap-1.5 p-2 rounded-xl border text-[10px] font-black ${T.sub}`}>
        <span className="opacity-40 mr-1">ZOOM:</span>
        {ZOOM_LEVELS.map(z => (
          <button key={z} onClick={() => setZoomLevel(z)}
            className={`px-2.5 py-1 rounded-lg border transition ${zoomLevel===z ? T.btn : 'opacity-40 hover:opacity-70'}`}>
            {z}x
          </button>
        ))}
        <span className={`ml-auto text-[9px] opacity-30`}>{Math.round(totalScale*100)}% display</span>
      </div>

      {/* FIX #1 + #2 — Responsive canvas container */}
      <div
        ref={containerRef}
        className={`rounded-2xl border overflow-auto w-full ${T.canvasBg}`}
        style={{ touchAction: 'none', height: `${displaySize + 4}px` }}
      >
        {/* Canvas sized to displaySize in CSS — internal coords stay 500x500 */}
        <canvas
          ref={canvasRef}
          width={CS}
          height={CS}
          style={{
            width:   `${displaySize}px`,
            height:  `${displaySize}px`,
            display: 'block',
            cursor:  'crosshair',
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={loadSkeleton}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${T.btnGhost}`}>
          <Layers className="w-3.5 h-3.5"/> Skeleton Template
        </button>
        <button onClick={autoVariations}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${T.accentBg}`}>
          <Sparkles className="w-3.5 h-3.5"/> Auto Variations
        </button>
      </div>

      {/* Mobile sheet triggers */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <button onClick={onOpenAtlas}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 ${T.btnGhost}`}>
          <Grid3X3 className="w-3.5 h-3.5"/> Atlas Matrix <ChevronUp className="w-3.5 h-3.5"/>
        </button>
        <button onClick={onOpenMetrics}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 ${T.btnGhost}`}>
          <Layers className="w-3.5 h-3.5"/> Metrics <ChevronUp className="w-3.5 h-3.5"/>
        </button>
      </div>
    </div>
  );
}
