/**
 * Ramer-Douglas-Peucker path simplification algorithm.
 * Reduces dense pointer-tracking coordinates to optimized vector nodes.
 */

function perpendicularDistance(pt, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  }
  const t = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  return Math.hypot(pt.x - (lineStart.x + clampedT * dx), pt.y - (lineStart.y + clampedT * dy));
}

/**
 * @param {Array<{x:number, y:number, [key:string]:any}>} points
 * @param {number} epsilon — tolerance in canvas units (1.5 recommended)
 * @returns {Array} simplified point array (preserves all extra properties from first/last point)
 */
export function rdpSimplify(points, epsilon = 1.5) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let splitIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; splitIdx = i; }
  }

  if (maxDist > epsilon) {
    const left  = rdpSimplify(points.slice(0, splitIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(splitIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}
