// Browser glue: render the Reference Artwork exactly as placed on the 500×500 canvas, then trace it.
import { traceBitmap, binarize, removeSpecks } from './traceImage.js';
import { sanitizeRef } from './referenceArt.js';

export const TRACE_SIZE = 500;
const cache = { src: '', img: null };

const loadImg = (src) => new Promise((res, rej) => {
  if (cache.src === src && cache.img) { res(cache.img); return; }
  const im = new Image();
  im.onload = () => { cache.src = src; cache.img = im; res(im); };
  im.onerror = () => rej(new Error('Reference පින්තූරය කියවන්න බැරි වුණා'));
  im.src = src;
});

/** Grey (0-255) pixels of what the reference looks like inside the canvas square. */
export async function referenceToGray(art) {
  const a = sanitizeRef(art);
  if (!a.src) throw new Error('මුලින් Reference පින්තූරයක් දාන්න');
  const img = await loadImg(a.src);
  const S = TRACE_SIZE, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  g.save();
  g.translate(S / 2 + (a.x / 100) * S, S / 2 + (a.y / 100) * S);
  g.rotate((a.rot * Math.PI) / 180); g.scale(a.flip ? -1 : 1, 1);
  const dw = (a.scale / 100) * S, dh = dw * (img.naturalHeight / img.naturalWidth);
  g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  g.restore();
  const d = g.getImageData(0, 0, S, S).data, gray = new Uint8ClampedArray(S * S), k = a.contrast / 100;
  for (let i = 0; i < gray.length; i++) {
    let v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    v = (v - 128) * k + 128; if (a.invert) v = 255 - v;
    gray[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return gray;
}

export async function traceReference(art, options) {
  const gray = await referenceToGray(art);
  return traceBitmap(gray, TRACE_SIZE, TRACE_SIZE, options);
}

/** Small black/white preview of what the trace will treat as ink. */
export async function paintMaskPreview(art, sensitivity, canvas) {
  const gray = await referenceToGray(art), S = TRACE_SIZE;
  const { mask } = binarize(gray, S, S, sensitivity);
  removeSpecks(mask, S, S, 24);
  const out = canvas.getContext('2d'), W = canvas.width, img = out.createImageData(W, W), k = S / W;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const v = mask[((y * k) | 0) * S + ((x * k) | 0)] ? 20 : 245, o = (y * W + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  out.putImageData(img, 0, 0);
}
