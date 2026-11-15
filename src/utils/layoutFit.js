// Layout maths for the drawing column (desktop). Pure.

export const MIN_CANVAS = 260;      // never smaller than this (px)
export const CONTROLS_MIN = 150;    // room kept for the accordions below the canvas (px)

/**
 * Largest canvas height that still leaves CONTROLS_MIN px for the controls.
 * @param {number} columnH  inner height of the drawing column
 * @param {number} chromeH  height of everything above/below the canvas that does not scroll (toolbar, zoom row …)
 */
export function fitCanvasHeight(columnH, chromeH) {
  const col = Number(columnH), chrome = Number(chromeH);
  if (!Number.isFinite(col) || col <= 0) return Infinity;
  const room = col - (Number.isFinite(chrome) && chrome > 0 ? chrome : 0) - CONTROLS_MIN;
  return Math.max(MIN_CANVAS, Math.floor(room));
}
