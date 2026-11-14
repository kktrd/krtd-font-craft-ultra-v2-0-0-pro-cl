import React, { useRef, useEffect, useCallback, useState, useId } from 'react';
import { useToast } from '../Shared/NotificationProvider.jsx';
import {
  Paintbrush, Eraser, Undo2, Redo2, Minus, Plus,
  Grid3X3, Sparkles, Layers, ChevronUp, Image,
  Keyboard, ClipboardPaste, Ruler, FlipHorizontal2, Layers3, Pen, Shapes
} from 'lucide-react';
import { rdpSimplify } from '../../utils/rdpSimplifier.js';
import { GLYPH_VARIATION_RULES } from '../../utils/glyphData.js';
import {
  drawShapeGuide, guideSupported, clearGuideCache, scoreAgainstGuide, computeStyleMatch,
  fontStack, mergeParams, clampSettings, clampAdj, clampPreset, defaultSettings,
} from '../../utils/shapeGuide.js';
import ShapeGuidePanel from './ShapeGuidePanel.jsx';
import ShapeCompare from './ShapeCompare.jsx';
import BrushPalette from './BrushPalette.jsx';
import { CUSTOM_KEY, sanitizeCustom, stepPreset, BRUSH_PRESETS } from '../../utils/brushPresets.js';

const GUIDE_KEY = 'krtd_shape_guide_v1';
const loadGuidePreset = () => {
  try { return clampPreset(JSON.parse(localStorage.getItem(GUIDE_KEY) || 'null')); }
  catch { return clampPreset(null); }
};

const loadCustomBrushes = () => {
  try { return sanitizeCustom(JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]')); }
  catch { return []; }
};

const CS = 500;
const MIRROR_AXIS = CS / 2;

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
  onOpenAtlas, onOpenMetrics,
  clipboardGlyph,
  onClearClipboard,
}) {
  const canvasRef    = useRef(null);
  const predictCanvasRef = useRef(null);
  const guideCanvasRef   = useRef(null);
  const containerRef = useRef(null);
  const contextRef   = useRef(null);
  const isDrawingRef = useRef(false);
  const strokeRef    = useRef([]);
  const [customBrushes, setCustomBrushes] = useState(loadCustomBrushes);
  useEffect(() => {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customBrushes)); } catch { /* storage blocked */ }
  }, [customBrushes]);
  const lastPtRef    = useRef(null);
  const lastMidRef   = useRef({ x:0, y:0 });
  const widthRef     = useRef(strokeWidth);
  const pinchRef     = useRef(null);

  const mirrorLastPtRef  = useRef(null);
  const mirrorLastMidRef = useRef({ x:0, y:0 });

  const displaySizeRef = useRef(CS);

  // ── Stylus pressure tracking (Pointer Events, pen only) ─────────────────
  const pressureRef   = useRef(0.5);
  const isPenRef       = useRef(false);
  const penLastSeenRef = useRef(0);

  const [containerW,    setContainerW]    = useState(CS);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRuler,     setShowRuler]     = useState(false);
  const [mirrorMode,    setMirrorMode]    = useState(false);
  const [predictMode,   setPredictMode]   = useState(false);

  // ── Onion-skin reference overlay ─────────────────────────────────────────
  const [referenceMode, setReferenceMode] = useState(false);
  const [referenceChar, setReferenceChar] = useState('');
  // ── Shape Guide (hollow standard shape, tracing aid only — never saved into the font) ──
  const [guidePreset] = useState(loadGuidePreset);       // restored from this device's localStorage
  const [shapeOn,   setShapeOn]   = useState(guidePreset.on);
  const [guideSet,  setGuideSet]  = useState(guidePreset.settings);   // global settings
  const [guideMap,  setGuideMap]  = useState(guidePreset.adj);        // per-letter adjustments
  const [fontTick,  setFontTick]  = useState(0);
  const [guideOk,   setGuideOk]   = useState(true);
  const [fontLoaded, setFontLoaded] = useState(true);
  const [guideScore, setGuideScore] = useState(null);
  const [matchMsg,  setMatchMsg]  = useState('');
  const guideAdj    = guideMap[selectedChar] || clampAdj(null);
  const guideParams = mergeParams(guideSet, guideAdj);
  const patchSettings = (patch) => setGuideSet(g => clampSettings({ ...g, ...patch }));
  const patchAdj      = (patch) => setGuideMap(m => ({ ...m, [selectedChar]: clampAdj({ ...(m[selectedChar] || {}), ...patch }) }));
  const resetGuideChar = () => setGuideMap(m => { const n = { ...m }; delete n[selectedChar]; return n; });
  const resetGuideAll  = () => { setGuideMap({}); setGuideSet(defaultSettings()); };
  const matchGuideStyle = () => {
    const r = computeStyleMatch(glyphs, guideSet, guideMap, metrics);
    if (!r) { setMatchMsg('ක ම න ර ය අකුරු ඇඳපු පසු භාවිතා කරන්න'); return; }
    patchSettings({ gscale: r.gscale, gdy: r.gdy });
    setMatchMsg(`ඔයාගේ ${r.used.join(' ')} අනුව ගැලපුවා`);
  };
  useEffect(() => { if (matchMsg) { const t = setTimeout(() => setMatchMsg(''), 4000); return () => clearTimeout(t); } }, [matchMsg]);
  // remember on this device only
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(GUIDE_KEY, JSON.stringify({ on: shapeOn, settings: guideSet, adj: guideMap })); } catch { /* storage blocked */ }
    }, 400);
    return () => clearTimeout(t);
  }, [shapeOn, guideSet, guideMap]);
  const referenceInputId = useId();
  const { toast } = useToast();

  // Agent / other parts can toggle the guide through a window event
  useEffect(() => {
    const h = (e) => setShapeOn(e.detail && typeof e.detail.on === 'boolean' ? e.detail.on : (s => !s));
    window.addEventListener('krtd:shape-guide', h);
    return () => window.removeEventListener('krtd:shape-guide', h);
  }, []);

  // Make sure the chosen Sinhala web font is loaded before drawing the guide
  useEffect(() => {
    if (!shapeOn || !document.fonts?.load) return;
    let live = true;
    document.fonts.load(`100px ${fontStack(guideSet.style)}`, selectedChar)
      .then((faces) => { if (live) { setFontLoaded(!!(faces && faces.length)); clearGuideCache(); setFontTick(t => t + 1); } })
      .catch(() => { if (live) setFontLoaded(false); });
    return () => { live = false; };
  }, [shapeOn, selectedChar, guideSet.style]);

  // Draw the guide on its own overlay canvas
  useEffect(() => {
    const gc = guideCanvasRef.current; if (!gc) return;
    const gctx = gc.getContext('2d');
    if (!shapeOn) { gctx.clearRect(0, 0, CS, CS); return; }
    setGuideOk(guideSupported(selectedChar, guideSet.style));
    drawShapeGuide(gctx, selectedChar, guideParams, metrics, theme);
  }, [shapeOn, selectedChar, guideSet, guideMap, metrics, theme, fontTick]);

  // Accuracy meter (debounced; reads the strokes, writes nothing)
  const guideStrokes = glyphs[selectedChar];
  useEffect(() => {
    if (!shapeOn || !guideSet.meter) { setGuideScore(null); return; }
    const t = setTimeout(() => {
      try { setGuideScore(scoreAgainstGuide(selectedChar, guideStrokes, guideParams, metrics)); }
      catch { setGuideScore(null); }
    }, 250);
    return () => clearTimeout(t);
  }, [shapeOn, guideSet, guideMap, selectedChar, guideStrokes, metrics, fontTick]);

  // ── Responsive container width ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerW(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const baseScale   = Math.min(1, (containerW - 4) / CS);
  const totalScale  = baseScale * zoomLevel;
  const displaySize = CS * totalScale;
  useEffect(() => { displaySizeRef.current = displaySize; }, [displaySize]);

  // ── Pointer pressure sampler — runs alongside mouse/touch handlers, ─────
  // only ever UPDATES a ref (never draws), so it can't cause double-strokes.
  const handlePointerMove = useCallback((e) => {
    if (e.pointerType === 'pen') {
      isPenRef.current = true;
      pressureRef.current = e.pressure > 0 ? e.pressure : 0.5;
      penLastSeenRef.current = Date.now();
    } else if (Date.now() - penLastSeenRef.current > 400) {
      isPenRef.current = false; // fall back to mouse/touch heuristics
    }
  }, []);

  // ── Grid & metrics ─────────────────────────────────────────────────────
  const drawGrid = useCallback((ctx) => {
    ctx.clearRect(0, 0, CS, CS);
    const minor = theme==='dark' ? '#0f172a' : theme==='comfort' ? '#ede8db' : '#f1f5f9';
    const major = theme==='dark' ? '#1e293b' : theme==='comfort' ? '#e0d8c8' : '#e2e8f0';
    ctx.lineWidth = 0.5; ctx.strokeStyle = minor;
    for (let i=0; i<=CS; i+=20) {
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,CS); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CS,i); ctx.stroke();
    }
    ctx.lineWidth = 1; ctx.strokeStyle = major;
    for (let i=0; i<=CS; i+=100) {
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,CS); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CS,i); ctx.stroke();
    }

    if (mirrorMode) {
      ctx.setLineDash([6,3]);
      ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(MIRROR_AXIS, 0); ctx.lineTo(MIRROR_AXIS, CS); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ec4899';
      ctx.font = '700 9px "DM Sans",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MIRROR AXIS', MIRROR_AXIS, 12);
    }

    if (showRuler) {
      const rulerBg = theme==='dark' ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
      const rulerTx = theme==='dark' ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.7)';
      ctx.fillStyle = rulerBg;
      ctx.fillRect(0, 0, CS, 18);
      ctx.fillRect(0, 0, 18, CS);
      ctx.fillStyle = rulerTx;
      ctx.font = '600 7px "DM Sans",system-ui,sans-serif';
      ctx.textAlign = 'left';
      for (let i=50; i<CS; i+=50) {
        ctx.fillText(i, i+2, 11);
        ctx.save(); ctx.translate(11, i+2); ctx.rotate(-Math.PI/2); ctx.fillText(i,0,0); ctx.restore();
        ctx.fillStyle = rulerTx;
        ctx.fillRect(i, 14, 1, 4);
        ctx.fillRect(14, i, 4, 1);
        ctx.fillStyle = rulerBg;
      }
    }

    if (showMetrics) {
      const MLINES = [
        { y: metrics.ascender,  c: '#c084fc', w: 1,   dash:[4,4], label:'Ascender'  },
        { y: metrics.capHeight, c: '#f472b6', w: 1,   dash:[4,4], label:'Cap'       },
        { y: metrics.xHeight,   c: '#3b82f6', w: 1.5, dash:[4,4], label:'x-Height' },
        { y: metrics.baseline,  c: '#ef4444', w: 2,   dash:[],    label:'Baseline'  },
        { y: metrics.descender, c: '#fb923c', w: 1,   dash:[4,4], label:'Descender'},
      ];
      MLINES.forEach(({ y, c, w, dash, label }) => {
        ctx.setLineDash(dash); ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CS,y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c;
        ctx.font = '700 9px "DM Sans",system-ui,sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, showRuler ? 22 : 4, y-3);
      });
    }
  }, [theme, showMetrics, metrics, showRuler, mirrorMode]);

  // ── Onion-skin ghost reference (drawn between grid and active strokes) ──
  const drawReferenceGhost = useCallback((ctx) => {
    if (!referenceMode || !referenceChar || referenceChar === selectedChar) return;
    const refPack = glyphs[referenceChar];
    if (!refPack?.length) return;
    ctx.save();
    ctx.globalAlpha = 0.20;
    refPack.forEach(line => {
      if (line.length < 2) return;
      let lx=line[0].x, ly=line[0].y, lmx=lx, lmy=ly;
      for (let i=1; i<line.length; i++) {
        const pt=line[i]; const mx=(lx+pt.x)/2, my=(ly+pt.y)/2;
        ctx.beginPath(); ctx.moveTo(lmx,lmy);
        ctx.quadraticCurveTo(lx,ly,mx,my);
        ctx.lineWidth   = pt.strokeWidth || 8;
        ctx.strokeStyle = theme==='dark' ? '#94a3b8' : '#64748b';
        ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
        lmx=mx; lmy=my; lx=pt.x; ly=pt.y;
      }
    });
    ctx.restore();
  }, [referenceMode, referenceChar, selectedChar, glyphs, theme]);

  // Combined background painter — grid + ghost reference together
  const paintBackground = useCallback((ctx) => {
    drawGrid(ctx);
    drawReferenceGhost(ctx);
  }, [drawGrid, drawReferenceGhost]);

  const redrawGlyph = useCallback((pack, ctx) => {
    const c = ctx || contextRef.current;
    if (!c) return;
    paintBackground(c);
    if (!pack) return;
    pack.forEach(line => {
      if (line.length < 2) return;
      let lx=line[0].x, ly=line[0].y, lmx=lx, lmy=ly;
      for (let i=1; i<line.length; i++) {
        const pt=line[i]; const mx=(lx+pt.x)/2, my=(ly+pt.y)/2;
        c.beginPath(); c.moveTo(lmx,lmy);
        if (aiSmooth) { c.quadraticCurveTo(lx,ly,mx,my); lmx=mx; lmy=my; }
        else          { c.lineTo(pt.x,pt.y); lmx=pt.x; lmy=pt.y; }
        c.lineWidth   = pt.strokeWidth || strokeWidth;
        c.strokeStyle = pt.isEraser ? T.eraseColor : T.inkColorRedraw;
        c.lineCap='round'; c.lineJoin='round'; c.stroke();
        lx=pt.x; ly=pt.y;
      }
    });
  }, [paintBackground, aiSmooth, strokeWidth, T]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap='round'; ctx.lineJoin='round';
    contextRef.current = ctx;
    redrawGlyph(glyphs[selectedChar], ctx);
  }, [selectedChar, theme, showMetrics, metrics, showRuler, mirrorMode, referenceMode, referenceChar]);

  useEffect(() => {
    if (!contextRef.current) return;
    redrawGlyph(glyphs[selectedChar]);
  }, [aiSmooth]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key==='z') { e.preventDefault(); handleUndo(); }
        if (e.key==='y' || (e.shiftKey && e.key==='z')) { e.preventDefault(); handleRedo(); }
        return;
      }
      // Alt+1…9 / Alt+0 → built-in brush presets; , and . → previous / next preset
      if (e.altKey && /^Digit[0-9]$/.test(e.code)) {
        const idx = e.code === 'Digit0' ? 9 : Number(e.code.slice(5)) - 1;
        const p = BRUSH_PRESETS[idx];
        if (p) { e.preventDefault(); setBrushMode(p.mode); setStrokeWidth(p.width); setIsEraser(false); }
        return;
      }
      if (e.key === ',' || e.key === '.') {
        const p = stepPreset(brushMode, strokeWidth, e.key === '.' ? 1 : -1, BRUSH_PRESETS.concat(customBrushes));
        if (p) { setBrushMode(p.mode); setStrokeWidth(p.width); setIsEraser(false); }
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'e': setIsEraser(true);  break;
        case 'b': setIsEraser(false); break;
        case 'm': setShowMetrics(s=>!s); break;
        case 's': setSnapEnabled(s=>!s); break;
        case 'r': setShowRuler(s=>!s);   break;
        case 'x': setMirrorMode(s=>!s);  break;
        case 'p': setPredictMode(s=>!s); break;
        case 'g': setReferenceMode(s=>!s); break;
        case 'h': setShapeOn(s=>!s); break;
        case '[': setStrokeWidth(w=>Math.max(2,w-2));  break;
        case ']': setStrokeWidth(w=>Math.min(48,w+2)); break;
        case '1': setZoomLevel(1);   break;
        case '2': setZoomLevel(1.5); break;
        case '3': setZoomLevel(2);   break;
        case '4': setZoomLevel(3);   break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack, glyphs, selectedChar, brushMode, strokeWidth, customBrushes]);

  // ── Coordinate mapping ──────────────────────────────────────────────────
  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const ds     = displaySizeRef.current;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    let rx = ((cx - rect.left) / ds) * CS;
    let ry = ((cy - rect.top)  / ds) * CS;
    if (snapEnabled) { rx=Math.round(rx/20)*20; ry=Math.round(ry/20)*20; }
    return { x: Math.max(0,Math.min(CS,rx)), y: Math.max(0,Math.min(CS,ry)), time: Date.now() };
  }, [snapEnabled]);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const c = getCoords(e);
    isDrawingRef.current=true; lastPtRef.current=c;
    lastMidRef.current={x:c.x,y:c.y}; widthRef.current=strokeWidth;
    strokeRef.current=[{x:c.x,y:c.y,isEraser,strokeWidth}];

    if (mirrorMode && !isEraser) {
      const mx = 2*MIRROR_AXIS - c.x;
      mirrorLastPtRef.current  = { x:mx, y:c.y, time:c.time };
      mirrorLastMidRef.current = { x:mx, y:c.y };
    }
  }, [getCoords, strokeWidth, isEraser, mirrorMode]);

  const draw = useCallback((e) => {
    if (!isDrawingRef.current) return; e.preventDefault();
    const c=getCoords(e); const lp=lastPtRef.current; if (!lp) return;
    const dx=c.x-lp.x, dy=c.y-lp.y;
    const dist=Math.hypot(dx,dy); if (dist<0.3) return;
    const vel=dist/((c.time-lp.time)||1);
    let targetW=strokeWidth;
    if (!isEraser) {
      if (isPenRef.current) {
        // Real stylus pressure overrides velocity/angle heuristics
        const p = Math.max(0.12, pressureRef.current);
        targetW = Math.max(2, Math.min(strokeWidth*1.6, strokeWidth * p * 1.3));
      } else if (brushMode==='calligraphy') {
        const spd=Math.max(0.3,1-vel*0.13);
        const ang=Math.atan2(dy,dx);
        const angF=0.4+0.6*Math.abs(Math.sin(ang-Math.PI/4));
        targetW=Math.max(2.5,Math.min(strokeWidth*1.5,strokeWidth*spd*angF));
      } else if (brushMode==='tapered') {
        const prog=strokeRef.current.length;
        if (prog<12) targetW=Math.max(2,strokeWidth*(prog/12));
      }
    }
    widthRef.current=widthRef.current+(targetW-widthRef.current)*0.25;
    const cw=widthRef.current;
    const mx=(lp.x+c.x)/2, my=(lp.y+c.y)/2;
    const ctx=contextRef.current;
    ctx.beginPath(); ctx.moveTo(lastMidRef.current.x,lastMidRef.current.y);
    if (aiSmooth) { ctx.quadraticCurveTo(lp.x,lp.y,mx,my); lastMidRef.current={x:mx,y:my}; }
    else          { ctx.lineTo(c.x,c.y); lastMidRef.current={x:c.x,y:c.y}; }
    ctx.lineWidth=cw;
    ctx.strokeStyle=isEraser?T.eraseColor:T.inkColor;
    ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
    lastPtRef.current=c;
    strokeRef.current.push({x:c.x,y:c.y,isEraser,strokeWidth:cw});

    if (mirrorMode && !isEraser && mirrorLastPtRef.current) {
      const mlp = mirrorLastPtRef.current;
      const mcx = 2*MIRROR_AXIS - c.x;
      const mmx = (mlp.x+mcx)/2, mmy=(mlp.y+c.y)/2;
      ctx.beginPath(); ctx.moveTo(mirrorLastMidRef.current.x, mirrorLastMidRef.current.y);
      if (aiSmooth) { ctx.quadraticCurveTo(mlp.x,mlp.y,mmx,mmy); mirrorLastMidRef.current={x:mmx,y:mmy}; }
      else          { ctx.lineTo(mcx,c.y); mirrorLastMidRef.current={x:mcx,y:c.y}; }
      ctx.lineWidth=cw;
      ctx.strokeStyle=T.inkColor;
      ctx.globalAlpha=0.85;
      ctx.stroke();
      ctx.globalAlpha=1;
      mirrorLastPtRef.current = { x:mcx, y:c.y, time:c.time };
    }

    // ── Stroke prediction ghost (separate overlay canvas — zero risk to
    // real stroke data, cleared/redrawn each move, cleared on stroke end)
    if (predictMode && !isEraser) {
      const pc = predictCanvasRef.current;
      if (pc) {
        const pctx = pc.getContext('2d');
        pctx.clearRect(0, 0, CS, CS);
        const pts = strokeRef.current;
        const pn = pts.length;
        if (pn >= 3) {
          const p1 = pts[Math.max(0, pn-4)], p2 = pts[pn-1];
          let vx = p2.x - p1.x, vy = p2.y - p1.y;
          const mag = Math.hypot(vx, vy) || 1;
          vx /= mag; vy /= mag;
          const reach = Math.min(60, mag * 3);
          pctx.beginPath();
          pctx.setLineDash([4, 4]);
          pctx.moveTo(p2.x, p2.y);
          pctx.lineTo(p2.x + vx*reach, p2.y + vy*reach);
          pctx.lineWidth = 1.5;
          pctx.strokeStyle = theme==='dark' ? 'rgba(56,189,248,0.55)' : 'rgba(236,72,153,0.55)';
          pctx.stroke();
          pctx.setLineDash([]);
        }
      }
    }
  }, [getCoords, strokeWidth, isEraser, brushMode, aiSmooth, T, mirrorMode, predictMode, theme]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return; isDrawingRef.current=false;
    if (predictCanvasRef.current) predictCanvasRef.current.getContext('2d').clearRect(0,0,CS,CS);
    let raw=[...strokeRef.current];
    // A tap is a valid DOT (ං, ඃ, full-stop...) — keep it as a 2-point stroke on the same spot
    if (raw.length===1 && !raw[0].isEraser) raw=[raw[0],{...raw[0],x:raw[0].x+0.1}];
    if (raw.length<2) { strokeRef.current=[]; lastPtRef.current=null; mirrorLastPtRef.current=null; return; }
    let stroke = raw[0]?.isEraser ? raw : rdpSimplify(raw, 1.5);
    if (!isEraser && brushMode==='tapered' && !isPenRef.current && stroke.length>12) {
      stroke=stroke.map((pt,i)=>{
        const ft=stroke.length-1-i;
        return ft<12 ? {...pt,strokeWidth:Math.max(2,strokeWidth*(ft/12))} : pt;
      });
    }

    const prev=glyphs[selectedChar]||[];
    let newStrokes = [...prev, stroke];

    if (mirrorMode && !isEraser) {
      const mirroredRaw = raw.map(p => ({ ...p, x: 2*MIRROR_AXIS - p.x }));
      const mirroredStroke = rdpSimplify(mirroredRaw, 1.5);
      const finalMirrored = brushMode==='tapered' && !isPenRef.current && mirroredStroke.length>12
        ? mirroredStroke.map((pt,i) => {
            const ft = mirroredStroke.length-1-i;
            return ft<12 ? {...pt, strokeWidth:Math.max(2,strokeWidth*(ft/12))} : pt;
          })
        : mirroredStroke;
      newStrokes = [...newStrokes, finalMirrored];
    }

    setUndoStack(u=>[...u.slice(-49),{char:selectedChar,strokes:prev}]);
    setRedoStack([]);
    const updated={...glyphs,[selectedChar]:newStrokes};
    setGlyphs(updated); strokeRef.current=[]; lastPtRef.current=null;
    mirrorLastPtRef.current=null;
    redrawGlyph(updated[selectedChar]);
  }, [glyphs, selectedChar, isEraser, brushMode, strokeWidth, redrawGlyph, mirrorMode]);

  // ── Pinch-to-zoom (mobile) ─────────────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length===2) {
      e.preventDefault();
      // A second finger touching down means the user is switching to a
      // pinch gesture — cancel any single-finger draw that may already be
      // in progress (e.g. the first finger moved slightly before the
      // second one landed). Without this, stopDrawing() at the end of the
      // pinch would still see leftover points in strokeRef and silently
      // commit a stray, unintended partial stroke to the glyph.
      isDrawingRef.current = false;
      strokeRef.current = [];
      lastPtRef.current = null;
      pinchRef.current = {
        dist: Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY),
        zoom: zoomLevel,
      };
    } else { startDrawing(e); }
  }, [zoomLevel, startDrawing]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length===2 && pinchRef.current) {
      e.preventDefault();
      const newDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      const raw=pinchRef.current.zoom*(newDist/pinchRef.current.dist);
      const levels=[1,1.5,2,3];
      const snapped=levels.reduce((p,c)=>Math.abs(c-raw)<Math.abs(p-raw)?c:p);
      setZoomLevel(snapped);
    } else { draw(e); }
  }, [draw]);

  const handleTouchEnd = useCallback((e) => {
    pinchRef.current=null;
    stopDrawing(e);
  }, [stopDrawing]);

  // ── Undo / Redo ────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!undoStack.length) return;
    const prev=undoStack[undoStack.length-1];
    setRedoStack(r=>[...r.slice(-49),{char:selectedChar,strokes:glyphs[selectedChar]||[]}]);
    setUndoStack(u=>u.slice(0,-1));
    const updated={...glyphs,[prev.char]:prev.strokes};
    setGlyphs(updated);
    redrawGlyph(prev.strokes);
  }, [undoStack, glyphs, selectedChar, redrawGlyph]);

  const handleRedo = useCallback(() => {
    if (!redoStack.length) return;
    const next=redoStack[redoStack.length-1];
    setUndoStack(u=>[...u.slice(-49),{char:selectedChar,strokes:glyphs[selectedChar]||[]}]);
    setRedoStack(r=>r.slice(0,-1));
    const updated={...glyphs,[next.char]:next.strokes};
    setGlyphs(updated);
    redrawGlyph(next.strokes);
  }, [redoStack, glyphs, selectedChar, redrawGlyph]);

  const clearCanvas = useCallback(() => {
    setUndoStack(u=>[...u.slice(-49),{char:selectedChar,strokes:glyphs[selectedChar]||[]}]);
    setRedoStack([]);
    const updated={...glyphs}; delete updated[selectedChar]; setGlyphs(updated);
    redrawGlyph(null);
  }, [glyphs, selectedChar, redrawGlyph]);

  // ── Paste clipboard glyph ──────────────────────────────────────────────
  const pasteClipboard = useCallback(() => {
    if (!clipboardGlyph?.length) return;
    const prev=glyphs[selectedChar]||[];
    setUndoStack(u=>[...u.slice(-49),{char:selectedChar,strokes:prev}]);
    setRedoStack([]);
    const pasted=JSON.parse(JSON.stringify(clipboardGlyph));
    const updated={...glyphs,[selectedChar]:pasted};
    setGlyphs(updated); redrawGlyph(pasted);
    onClearClipboard?.();
  }, [clipboardGlyph, glyphs, selectedChar, redrawGlyph, onClearClipboard]);

  // ── PNG export ─────────────────────────────────────────────────────────
  const exportPNG = useCallback(() => {
    const canvas=canvasRef.current; if (!canvas) return;
    const a=document.createElement('a');
    a.href=canvas.toDataURL('image/png');
    a.download=`glyph_u${selectedChar.codePointAt(0).toString(16)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }, [selectedChar]);

  // ── Skeleton & variations ──────────────────────────────────────────────
  const loadSkeleton = () => {
    let strokes=[];
    if (selectedChar==='අ') {
      const l1=[],l2=[];
      for (let t=0;t<=Math.PI*2;t+=0.18) l1.push({x:200+Math.cos(t)*52,y:220+Math.sin(t)*52,isEraser:false,strokeWidth:14});
      for (let x=200;x<=380;x+=14) l2.push({x,y:260+Math.sin(x/40)*38,isEraser:false,strokeWidth:14});
      strokes=[l1,l2];
    } else {
      const c=[];
      for (let t=0;t<=Math.PI*2;t+=0.16) c.push({x:250+Math.cos(t)*78,y:255+Math.sin(t)*78,isEraser:false,strokeWidth:10});
      strokes=[c];
    }
    setUndoStack(u=>[...u.slice(-49),{char:selectedChar,strokes:glyphs[selectedChar]||[]}]);
    const updated={...glyphs,[selectedChar]:strokes};
    setGlyphs(updated); redrawGlyph(strokes);
  };

  const autoVariations = () => {
    const targets=GLYPH_VARIATION_RULES[selectedChar];
    if (!targets||!glyphs[selectedChar]?.length) { toast(`⚠️ "${selectedChar}" glyph data නෑ — draw කරලා retry.`, 'error'); return; }
    const updated={...glyphs};
    targets.forEach(t=>{updated[t]=JSON.parse(JSON.stringify(glyphs[selectedChar]));});
    setGlyphs(updated); toast(`✨ ${targets.join(', ')} copy වුනා!`, 'success');
  };

  // ── Active class helpers ───────────────────────────────────────────────
  const brushAc = theme==='dark'?'bg-slate-800 text-cyan-400 shadow-sm':theme==='comfort'?'bg-[#fdfbf7] text-amber-800 shadow-sm':'bg-white text-indigo-600 shadow-sm';
  const eraserAc= theme==='dark'?'bg-slate-800 text-red-400 shadow-sm':theme==='comfort'?'bg-[#fdfbf7] text-red-500 shadow-sm':'bg-white text-red-500 shadow-sm';
  const mirrorAc= 'bg-pink-500 text-white shadow-sm';
  const refAc   = 'bg-violet-500 text-white shadow-sm';
  const predictAc = 'bg-sky-500 text-white shadow-sm';

  const ZOOMS=[1,1.5,2,3];
  const MODES=['calligraphy','tapered','uniform'];

  return (
    <div className="space-y-3">

      {showShortcuts && (
        <div className={`p-3 rounded-xl border text-[10px] ${T.sub}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 font-mono">
            {[['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['E','Eraser'],['B','Brush'],
              ['M','Metrics'],['S','Snap'],['R','Ruler'],['X','Mirror'],
              ['G','Reference'],['H','Shape Guide'],['P','Predict'],['[ ]','Size ±'],['1-4','Zoom']].map(([k,v])=>(
              <div key={k} className="flex items-center gap-2">
                <kbd className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${T.card}`}>{k}</kbd>
                <span className="opacity-50">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Title row */}
      <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${T.divider}`}>
        <div>
          <span className="text-[9px] font-bold uppercase opacity-70">Canvas Workspace</span>
          <h2 className="text-xl font-black font-sinhala leading-tight">&ldquo;{selectedChar}&rdquo;
            <span className="ml-2 text-sm opacity-60 font-sans font-normal">
              U+{selectedChar.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}
            </span>
            {isPenRef.current && (
              <span className="ml-2 text-[9px] font-sans font-black text-violet-400 align-middle inline-flex items-center gap-0.5">
                <Pen className="w-3 h-3" aria-hidden="true"/> Pen
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={`flex p-0.5 rounded-xl border ${T.sub}`} role="group" aria-label="Drawing tool">
            <button onClick={()=>setIsEraser(false)} title="Brush (B)" aria-label="Brush tool" aria-pressed={!isEraser}
              className={`p-2 rounded-lg transition ${!isEraser?brushAc:'opacity-35'}`}><Paintbrush className="w-4 h-4" aria-hidden="true"/></button>
            <button onClick={()=>setIsEraser(true)} title="Eraser (E)" aria-label="Eraser tool" aria-pressed={isEraser}
              className={`p-2 rounded-lg transition ${isEraser?eraserAc:'opacity-35'}`}><Eraser className="w-4 h-4" aria-hidden="true"/></button>
          </div>
          <button onClick={handleUndo} disabled={!undoStack.length} title="Undo (Ctrl+Z)" aria-label="Undo last stroke"
            className={`border p-2 rounded-xl disabled:opacity-20 transition ${T.btnGhost}`}><Undo2 className="w-4 h-4" aria-hidden="true"/></button>
          <button onClick={handleRedo} disabled={!redoStack.length} title="Redo (Ctrl+Y)" aria-label="Redo last undone stroke"
            className={`border p-2 rounded-xl disabled:opacity-20 transition ${T.btnGhost}`}><Redo2 className="w-4 h-4" aria-hidden="true"/></button>
          <button onClick={exportPNG} title="Export PNG" aria-label="Export this glyph as PNG image"
            className={`border p-2 rounded-xl transition ${T.btnGhost}`}><Image className="w-4 h-4" aria-hidden="true"/></button>
          <button onClick={()=>setShowShortcuts(s=>!s)} title="Shortcuts" aria-label="Toggle keyboard shortcuts panel" aria-pressed={showShortcuts}
            className={`border p-2 rounded-xl transition ${showShortcuts?T.accentBg:T.btnGhost}`}><Keyboard className="w-4 h-4" aria-hidden="true"/></button>
          <button onClick={clearCanvas}
            className={`text-[10px] px-3 py-2 rounded-xl font-bold transition border ${T.btnDanger}`}>Clear</button>
        </div>
      </div>

      {/* Clipboard paste banner */}
      {clipboardGlyph?.length > 0 && (
        <div className={`flex items-center gap-3 p-2.5 rounded-xl border ${T.accentBg}`}>
          <ClipboardPaste className="w-4 h-4 flex-shrink-0" aria-hidden="true"/>
          <span className="text-[10px] font-bold flex-1">Clipboard ready — paste strokes into &ldquo;{selectedChar}&rdquo;</span>
          <button onClick={pasteClipboard}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg ${T.btn}`}>Paste</button>
          <button onClick={onClearClipboard} aria-label="Dismiss clipboard" className="opacity-70 hover:opacity-100 p-1"><span className="text-xs" aria-hidden="true">✕</span></button>
        </div>
      )}

      {/* Mirror mode banner */}
      {mirrorMode && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl border bg-pink-500/10 border-pink-500/30">
          <FlipHorizontal2 className="w-4 h-4 flex-shrink-0 text-pink-500" aria-hidden="true"/>
          <span className="text-[10px] font-bold flex-1 text-pink-500">
            Mirror Mode ON — symmetric loops (ක, ට, ඩ) auto-draw on both sides
          </span>
        </div>
      )}

      {/* Reference mode banner + char picker */}
      {referenceMode && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl border bg-violet-500/10 border-violet-500/30">
          <Layers3 className="w-4 h-4 flex-shrink-0 text-violet-500" aria-hidden="true"/>
          <label htmlFor={referenceInputId} className="text-[10px] font-bold text-violet-500 flex-shrink-0">Reference:</label>
          <input
            id={referenceInputId}
            type="text" maxLength={1} value={referenceChar}
            onChange={e => setReferenceChar(e.target.value.trim())}
            placeholder="e.g. ක"
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            className="w-12 text-center font-sinhala font-black text-sm bg-transparent border border-violet-400/40 rounded-lg py-1 focus:outline-none text-violet-500"
          />
          <span className="text-[9px] text-violet-400 flex-1" role="status">
            {referenceChar && !glyphs[referenceChar]?.length ? 'මේ char එක draw කරලා නෑ' : 'ඝෝස්ට් overlay ලෙස පෙනේවි'}
          </span>
        </div>
      )}

      {shapeOn && (
        <ShapeGuidePanel T={T} char={selectedChar} settings={guideSet} adj={guideAdj} supported={guideOk} fontLoaded={fontLoaded}
          score={guideScore} matchMsg={matchMsg}
          onSettings={patchSettings} onAdj={patchAdj} onResetChar={resetGuideChar} onResetAll={resetGuideAll}
          onMatch={matchGuideStyle} onHide={() => setShapeOn(false)}>
          <ShapeCompare T={T} char={selectedChar} strokes={guideStrokes} params={guideParams} metrics={metrics} fontTick={fontTick} />
        </ShapeGuidePanel>
      )}

      <BrushPalette T={T} brushMode={brushMode} strokeWidth={strokeWidth}
        setBrushMode={setBrushMode} setStrokeWidth={setStrokeWidth}
        custom={customBrushes} setCustom={setCustomBrushes} />

      {/* Brush controls */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5 rounded-xl border text-[10px] font-black ${T.sub}`}>
        <div className="flex items-center gap-1" role="group" aria-label="Brush mode">
          <span className="opacity-70">MODE:</span>
          {MODES.map(m=>(
            <button key={m} onClick={()=>setBrushMode(m)} aria-pressed={brushMode===m}
              className={`px-2 py-1 rounded-lg border transition capitalize ${brushMode===m?T.btn:'opacity-70 hover:opacity-100'}`}>{m}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto" role="group" aria-label="Stroke size">
          <span className="opacity-70">SIZE:</span>
          <button onClick={()=>setStrokeWidth(w=>Math.max(2,w-2))} aria-label="Decrease stroke size" className="p-1"><Minus className="w-3.5 h-3.5 opacity-50" aria-hidden="true"/></button>
          <span className="font-mono w-5 text-center" aria-live="polite">{strokeWidth}</span>
          <button onClick={()=>setStrokeWidth(w=>Math.min(48,w+2))} aria-label="Increase stroke size" className="p-1"><Plus  className="w-3.5 h-3.5 opacity-50" aria-hidden="true"/></button>
        </div>
        <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Canvas toggles">
          {[['Snap',snapEnabled,()=>setSnapEnabled(s=>!s)],
            ['Smooth',aiSmooth,()=>setAiSmooth(s=>!s)],
            ['Metrics',showMetrics,()=>setShowMetrics(s=>!s)],
            ['Ruler',showRuler,()=>setShowRuler(s=>!s)]].map(([l,a,fn])=>(
            <button key={l} onClick={fn} aria-pressed={a}
              className={`px-2 py-1 rounded-lg border transition ${a?T.btn:'opacity-70 hover:opacity-100'}`}>{l}</button>
          ))}
          <button onClick={()=>setMirrorMode(s=>!s)} title="Mirror Mode (X)" aria-pressed={mirrorMode}
            className={`px-2 py-1 rounded-lg border transition flex items-center gap-1 ${mirrorMode?mirrorAc:'opacity-70 hover:opacity-100'}`}>
            <FlipHorizontal2 className="w-3 h-3" aria-hidden="true"/> Mirror
          </button>
          <button onClick={()=>setPredictMode(s=>!s)} title="Stroke Prediction Preview (P)" aria-pressed={predictMode}
            className={`px-2 py-1 rounded-lg border transition flex items-center gap-1 ${predictMode?predictAc:'opacity-70 hover:opacity-100'}`}>
            <Sparkles className="w-3 h-3" aria-hidden="true"/> Predict
          </button>
          <button onClick={()=>setShapeOn(s=>!s)} title="Shape Guide — hollow standard shape (H)" aria-pressed={shapeOn}
            className={`px-2 py-1 rounded-lg border transition flex items-center gap-1 ${shapeOn?'bg-sky-500/20 border-sky-500/50 text-sky-500':'opacity-70 hover:opacity-100'}`}>
            <Shapes className="w-3 h-3" aria-hidden="true"/> Shape
          </button>
          <button onClick={()=>setReferenceMode(s=>!s)} title="Onion-Skin Reference (G)" aria-pressed={referenceMode}
            className={`px-2 py-1 rounded-lg border transition flex items-center gap-1 ${referenceMode?refAc:'opacity-70 hover:opacity-100'}`}>
            <Layers3 className="w-3 h-3" aria-hidden="true"/> Reference
          </button>
        </div>
      </div>

      {/* Zoom */}
      <div className={`flex items-center gap-1.5 p-2 rounded-xl border text-[10px] font-black ${T.sub}`} role="group" aria-label="Zoom level">
        <span className="opacity-70 mr-1">ZOOM:</span>
        {ZOOMS.map(z=>(
          <button key={z} onClick={()=>setZoomLevel(z)} aria-pressed={zoomLevel===z}
            className={`px-2.5 py-1 rounded-lg border transition ${zoomLevel===z?T.btn:'opacity-70 hover:opacity-100'}`}>{z}x</button>
        ))}
        <span className="ml-auto text-[9px] opacity-60">{Math.round(totalScale*100)}% · Pinch / Pen pressure supported</span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className={`rounded-2xl border overflow-auto w-full ${T.canvasBg}`}
        style={{ touchAction:'none', height:`${displaySize+4}px` }}>
        <div style={{ position:'relative', margin:'0 auto', width:`${displaySize}px`, height:`${displaySize}px` }}>
          <canvas
            ref={guideCanvasRef} width={CS} height={CS}
            aria-hidden="true"
            style={{ position:'absolute', zIndex: guideSet.front ? 2 : 0, top:0, left:0, width:`${displaySize}px`, height:`${displaySize}px`, pointerEvents:'none' }}
          />
          <canvas
            ref={canvasRef} width={CS} height={CS}
            role="img"
            aria-label={`Drawing canvas for character ${selectedChar}. Requires mouse, touch, or stylus input — not keyboard-operable.`}
            style={{ position:'relative', zIndex:1, width:`${displaySize}px`, height:`${displaySize}px`, display:'block', cursor:'crosshair' }}
            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            onPointerMove={handlePointerMove}
          />
          <canvas
            ref={predictCanvasRef} width={CS} height={CS}
            aria-hidden="true"
            style={{ position:'absolute', zIndex:3, top:0, left:0, width:`${displaySize}px`, height:`${displaySize}px`, pointerEvents:'none' }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={loadSkeleton}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 ${T.btnGhost}`}>
          <Layers className="w-3.5 h-3.5" aria-hidden="true"/> Skeleton Template
        </button>
        <button onClick={autoVariations}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 ${T.accentBg}`}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true"/> Auto Variations
        </button>
      </div>

      {/* Mobile sheet triggers */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <button onClick={onOpenAtlas}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 ${T.btnGhost}`}>
          <Grid3X3 className="w-3.5 h-3.5" aria-hidden="true"/> Atlas <ChevronUp className="w-3.5 h-3.5" aria-hidden="true"/>
        </button>
        <button onClick={onOpenMetrics}
          className={`py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 ${T.btnGhost}`}>
          <Ruler className="w-3.5 h-3.5" aria-hidden="true"/> Metrics <ChevronUp className="w-3.5 h-3.5" aria-hidden="true"/>
        </button>
      </div>
    </div>
  );
}
