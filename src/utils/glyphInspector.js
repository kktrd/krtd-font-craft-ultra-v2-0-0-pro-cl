/**
 * KRTD Glyph Inspector — real-time stroke analytics for the Canvas Workspace.
 * Computes measurable properties from the raw stroke point data.
 * Pure functions — no React, no side effects.
 */

export function inspectGlyph(strokes) {
  if (!strokes?.length) return null;

  const realStrokes = strokes.filter(s => s?.length > 1 && !s[0]?.isEraser);
  if (!realStrokes.length) return null;

  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  let totalPoints = 0, totalWidth = 0, widthSamples = 0;
  let allWidths = [];

  realStrokes.forEach(stroke => {
    stroke.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
      if (pt.strokeWidth) { allWidths.push(pt.strokeWidth); totalWidth += pt.strokeWidth; widthSamples++; }
      totalPoints++;
    });
  });

  const bboxW   = Math.round(maxX - minX);
  const bboxH   = Math.round(maxY - minY);
  const ratio   = bboxH > 0 ? +(bboxW / bboxH).toFixed(2) : 0;
  const avgW    = widthSamples ? +(totalWidth / widthSamples).toFixed(1) : 0;
  const maxW    = allWidths.length ? +Math.max(...allWidths).toFixed(1) : 0;
  const minW    = allWidths.length ? +Math.min(...allWidths).toFixed(1) : 0;
  const contrast = maxW > 0 ? +((maxW - minW) / maxW * 100).toFixed(1) : 0;

  // Centroid (center of mass from all points)
  let sumX = 0, sumY = 0, n = 0;
  realStrokes.forEach(s => s.forEach(p => { sumX += p.x; sumY += p.y; n++; }));
  const centroidX = n ? Math.round(sumX / n) : 250;
  const centroidY = n ? Math.round(sumY / n) : 250;

  // Complexity — average path curvature index (direction change per point)
  let curvatureSum = 0, curvatureCount = 0;
  realStrokes.forEach(stroke => {
    for (let i = 1; i < stroke.length - 1; i++) {
      const dx1 = stroke[i].x - stroke[i-1].x, dy1 = stroke[i].y - stroke[i-1].y;
      const dx2 = stroke[i+1].x - stroke[i].x,   dy2 = stroke[i+1].y - stroke[i].y;
      const len1 = Math.hypot(dx1,dy1), len2 = Math.hypot(dx2,dy2);
      if (len1 > 0 && len2 > 0) {
        const cos = Math.max(-1, Math.min(1, (dx1*dx2 + dy1*dy2) / (len1*len2)));
        curvatureSum += Math.acos(cos);
        curvatureCount++;
      }
    }
  });
  const complexity = curvatureCount
    ? Math.min(100, Math.round(curvatureSum / curvatureCount * 100 / Math.PI))
    : 0;

  return {
    strokeCount:  realStrokes.length,
    pointCount:   totalPoints,
    bbox: { x: Math.round(minX), y: Math.round(minY), w: bboxW, h: bboxH },
    centroid: { x: centroidX, y: centroidY },
    widthStats: { avg: avgW, min: minW, max: maxW, contrast },
    aspectRatio: ratio,
    complexity,
  };
}
