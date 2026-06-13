import React, { useRef, useEffect, useMemo } from 'react';
import { Type } from 'lucide-react';

const CS = 500; // internal coordinate space

/**
 * FontTestDrive — Renders the current glyph vector paths as live preview text.
 * When user types in Text Studio, this draws their words using the actual
 * canvas vector coordinate paths they have designed — spec Module 1 requirement.
 */
export default function FontTestDrive({ text, glyphs, theme, T }) {
  const canvasRef = useRef(null);

  // Build a unique character set from text
  const chars = useMemo(() => {
    const unique = new Set();
    for (const ch of text) unique.add(ch);
    return unique;
  }, [text]);

  const GLYPH_W   = 60;   // px per glyph slot in preview
  const GLYPH_H   = 80;
  const PADDING   = 8;
  const PER_ROW   = Math.max(1, Math.floor((640 - PADDING * 2) / (GLYPH_W + 4)));
  const totalRows = Math.ceil(chars.size / PER_ROW);
  const canvasH   = Math.max(GLYPH_H + PADDING * 2, totalRows * (GLYPH_H + 10) + PADDING * 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg = theme === 'dark' ? '#0f172a' : theme === 'comfort' ? '#f7f4ed' : '#f8fafc';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const inkColor = theme === 'dark' ? '#38bdf8' : theme === 'comfort' ? '#4a3e2e' : '#1e3a8a';
    const labelColor = theme === 'dark' ? 'rgba(148,163,184,0.5)' : 'rgba(100,90,70,0.4)';

    let col = 0, row = 0;

    for (const char of chars) {
      const pack = glyphs[char];
      const slotX = PADDING + col * (GLYPH_W + 4);
      const slotY = PADDING + row * (GLYPH_H + 10);

      // Draw slot background
      ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)';
      ctx.beginPath();
      ctx.roundRect(slotX, slotY, GLYPH_W, GLYPH_H, 6);
      ctx.fill();

      // Character label
      ctx.fillStyle = labelColor;
      ctx.font = '700 9px "Noto Sans Sinhala", serif';
      ctx.textAlign = 'center';
      ctx.fillText(char, slotX + GLYPH_W / 2, slotY + GLYPH_H - 4);

      if (pack?.length) {
        // Scale glyph from 500x500 space into GLYPH_W x (GLYPH_H - 14) slot
        const scaleX = GLYPH_W  / CS;
        const scaleY = (GLYPH_H - 14) / CS;

        ctx.save();
        ctx.translate(slotX, slotY);
        ctx.beginPath();
        ctx.rect(0, 0, GLYPH_W, GLYPH_H - 12);
        ctx.clip();

        pack.forEach(line => {
          if (line.length < 2) return;
          let lx = line[0].x * scaleX, ly = line[0].y * scaleY;
          let lmx = lx, lmy = ly;
          for (let i = 1; i < line.length; i++) {
            const pt = line[i];
            const mx = (lx + pt.x * scaleX) / 2;
            const my = (ly + pt.y * scaleY) / 2;
            ctx.beginPath(); ctx.moveTo(lmx, lmy);
            ctx.quadraticCurveTo(lx, ly, mx, my);
            ctx.lineWidth   = Math.max(0.8, (pt.strokeWidth || 8) * scaleX * 0.7);
            ctx.strokeStyle = pt.isEraser ? bg : inkColor;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.stroke();
            lmx = mx; lmy = my; lx = pt.x * scaleX; ly = pt.y * scaleY;
          }
        });
        ctx.restore();
      } else {
        // Placeholder — glyph not drawn yet
        ctx.fillStyle = labelColor;
        ctx.font = '600 18px "Noto Sans Sinhala", serif';
        ctx.textAlign = 'center';
        ctx.fillText(char, slotX + GLYPH_W / 2, slotY + GLYPH_H / 2 - 4);
      }

      col++;
      if (col >= PER_ROW) { col = 0; row++; }
    }
  }, [text, glyphs, theme, chars, canvasH]);

  if (!text || chars.size === 0) return null;

  return (
    <div className={`p-4 rounded-2xl border transition-all ${T.card}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
          <Type className="w-3 h-3" /> Vector Font Test-Drive
        </h3>
        <span className={`text-[9px] px-2 py-0.5 rounded border font-bold ${T.accentBg}`}>
          {[...chars].filter(c => glyphs[c]?.length).length}/{chars.size} glyphs drawn
        </span>
      </div>
      <div className={`rounded-xl border overflow-hidden ${T.sub}`}>
        <canvas
          ref={canvasRef}
          width={640}
          height={canvasH}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
      <p className="text-[9px] opacity-30 mt-2 font-medium">
        Grey glyphs = Canvas Studio හි draw නොකළ ඒවා. Draw කළ ඒවා vector paths use කරයි.
      </p>
    </div>
  );
}
