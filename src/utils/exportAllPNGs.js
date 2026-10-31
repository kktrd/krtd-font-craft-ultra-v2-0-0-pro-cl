/**
 * KRTD Export All PNGs as ZIP — uses JSZip (lazy-imported on demand).
 * Renders every drawn glyph onto an offscreen canvas at 256×256px,
 * bundles them all into a downloadable ZIP archive.
 * No server — 100% browser-side.
 */

const THUMB_SIZE = 256;
const CS = 500; // internal coordinate space

function renderGlyphToDataURL(strokes, inkColor = '#1e1b4b') {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE; canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  const scale = THUMB_SIZE / CS;
  strokes.forEach(stroke => {
    if (stroke.length < 2 || stroke[0]?.isEraser) return;
    let lx = stroke[0].x*scale, ly = stroke[0].y*scale, lmx = lx, lmy = ly;
    for (let i = 1; i < stroke.length; i++) {
      const pt = stroke[i];
      const mx = (lx + pt.x*scale)/2, my = (ly + pt.y*scale)/2;
      ctx.beginPath(); ctx.moveTo(lmx, lmy);
      ctx.quadraticCurveTo(lx, ly, mx, my);
      ctx.lineWidth = Math.max(0.8, (pt.strokeWidth||8)*scale*0.7);
      ctx.strokeStyle = inkColor;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
      lmx = mx; lmy = my; lx = pt.x*scale; ly = pt.y*scale;
    }
  });
  // Strip base64 prefix for JSZip
  return canvas.toDataURL('image/png').split(',')[1];
}

export async function exportAllPNGsAsZip(fontName, glyphs) {
  const entries = Object.entries(glyphs).filter(([,s]) => s?.length > 0);
  if (!entries.length) throw new Error('No drawn glyphs to export.');

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder(fontName || 'KRTD-Font');

  entries.forEach(([char, strokes]) => {
    const cp   = char.codePointAt(0).toString(16).toUpperCase().padStart(4,'0');
    const name = `U${cp}_${char}.png`;
    const data = renderGlyphToDataURL(strokes);
    folder.file(name, data, { base64: true });
  });

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fontName || 'KRTD-Font'}_glyphs.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  { const u = a.href; setTimeout(() => URL.revokeObjectURL(u), 1500); }
  return entries.length;
}
