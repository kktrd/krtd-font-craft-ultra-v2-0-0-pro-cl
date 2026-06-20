import React, { useRef, useEffect, useMemo } from 'react';
import { Type } from 'lucide-react';

const CS = 500;

// Polyfill: manual rounded rect path (works in ALL browsers)
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

export default function FontTestDrive({ text, glyphs, theme, T }) {
  const canvasRef = useRef(null);
  const chars = useMemo(() => {
    const unique = new Set();
    for (const ch of (text||'')) if (ch.trim()) unique.add(ch);
    return unique;
  }, [text]);

  const GLYPH_W  = 60;
  const GLYPH_H  = 76;
  const GAP      = 4;
  const PADDING  = 10;
  const PER_ROW  = Math.max(1, Math.floor((640 - PADDING*2) / (GLYPH_W + GAP)));
  const rows     = Math.ceil(chars.size / PER_ROW);
  const canvasH  = Math.max(GLYPH_H + PADDING*2, rows*(GLYPH_H+10) + PADDING*2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text || chars.size===0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg     = theme==='dark'?'#0f172a':theme==='comfort'?'#f7f4ed':'#f8fafc';
    const ink    = theme==='dark'?'#38bdf8':theme==='comfort'?'#4a3e2e':'#1e3a8a';
    const slotBg = theme==='dark'?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.025)';
    const lbl    = theme==='dark'?'rgba(148,163,184,0.5)':'rgba(100,90,70,0.45)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let col=0, row=0;
    for (const char of chars) {
      const sx = PADDING + col*(GLYPH_W+GAP);
      const sy = PADDING + row*(GLYPH_H+10);

      // Slot background — polyfill roundRect
      ctx.fillStyle = slotBg;
      roundRect(ctx, sx, sy, GLYPH_W, GLYPH_H, 6);
      ctx.fill();

      // Bottom char label
      ctx.fillStyle = lbl;
      ctx.font = '700 9px "Noto Sans Sinhala",serif';
      ctx.textAlign = 'center';
      ctx.fillText(char, sx+GLYPH_W/2, sy+GLYPH_H-2);

      const pack = glyphs[char];
      if (pack?.length) {
        const scaleX = GLYPH_W / CS;
        const scaleY = (GLYPH_H-14) / CS;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.beginPath();
        ctx.rect(0, 0, GLYPH_W, GLYPH_H-12);
        ctx.clip();

        pack.forEach(line => {
          if (line.length<2) return;
          let lx=line[0].x*scaleX, ly=line[0].y*scaleY, lmx=lx, lmy=ly;
          for (let i=1; i<line.length; i++) {
            const pt=line[i];
            const mx=(lx+pt.x*scaleX)/2, my=(ly+pt.y*scaleY)/2;
            ctx.beginPath(); ctx.moveTo(lmx,lmy);
            ctx.quadraticCurveTo(lx,ly,mx,my);
            ctx.lineWidth   = Math.max(0.8,(pt.strokeWidth||8)*scaleX*0.7);
            ctx.strokeStyle = pt.isEraser?bg:ink;
            ctx.lineCap='round'; ctx.lineJoin='round';
            ctx.stroke();
            lmx=mx; lmy=my; lx=pt.x*scaleX; ly=pt.y*scaleY;
          }
        });
        ctx.restore();
      } else {
        // Not drawn — show unicode character as placeholder
        ctx.fillStyle = lbl;
        ctx.font = '600 20px "Noto Sans Sinhala",serif';
        ctx.textAlign = 'center';
        ctx.fillText(char, sx+GLYPH_W/2, sy+GLYPH_H/2+2);
      }

      col++;
      if (col>=PER_ROW) { col=0; row++; }
    }
  }, [text, glyphs, theme, chars, canvasH]);

  if (!text || chars.size===0) return null;

  const drawn = [...chars].filter(c=>glyphs[c]?.length).length;

  return (
    <div className={`p-4 rounded-2xl border ${T.card}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
          <Type className="w-3 h-3"/> Vector Font Test-Drive
        </h3>
        <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${T.accentBg}`}>
          {drawn}/{chars.size} glyphs drawn
        </span>
      </div>
      <div className={`rounded-xl border overflow-hidden ${T.sub}`}>
        <canvas ref={canvasRef} width={640} height={canvasH}
          style={{ width:'100%', height:'auto', display:'block' }}/>
      </div>
      <p className="text-[9px] opacity-25 mt-2">
        Faded chars = Canvas Studio හි draw නොකළ ඒවා. Vector paths draw කළ ඒවාට use කරයි.
      </p>
    </div>
  );
}
