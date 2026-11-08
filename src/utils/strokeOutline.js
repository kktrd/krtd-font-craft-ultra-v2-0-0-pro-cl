/**
 * Stroke -> glyph outline geometry (pure math, no font library).
 *
 * "What you draw is what you export": the canvas renders strokes with quadratic
 * smoothing + round caps, so the exported outline does the same.
 *  1. The centerline is sampled with the SAME midpoint-quadratic smoothing the canvas uses.
 *  2. Every segment becomes a quadrilateral (width interpolated), round caps / joints are
 *     small polygons. All pieces are wound the same way and unioned by the NONZERO rule,
 *     so tight curves never leave self-intersection holes (a classic offset-curve bug).
 * All coordinates returned are FONT units (y-up, baseline-relative, scaled).
 */

export const SMOOTH_STEPS = 4;     // samples per smoothed segment
export const CAP_SIDES = 12;       // polygon sides of a round cap / joint
const JOINT_TURN = 0.2;            // radians; sharper turns get a round joint

const wOf = (p) => Math.max(1, (p.strokeWidth || 8));

/** Centerline samples [{x,y,w}] following the canvas' quadratic smoothing. */
export function centerlineSamples(stroke) {
  const pts = stroke.map((p) => ({ x: p.x, y: p.y, w: wOf(p) }));
  if (pts.length < 3) return pts.slice();

  const out = [pts[0]];
  let start = pts[0];                 // current curve start (a midpoint)
  let ctrl = pts[0];                  // control point = previous raw point
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const mid = { x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2, w: (ctrl.w + p.w) / 2 };
    for (let s = 1; s <= SMOOTH_STEPS; s++) {
      const t = s / SMOOTH_STEPS, u = 1 - t;
      out.push({
        x: u * u * start.x + 2 * u * t * ctrl.x + t * t * mid.x,
        y: u * u * start.y + 2 * u * t * ctrl.y + t * t * mid.y,
        w: u * start.w + t * mid.w,
      });
    }
    start = mid;
    ctrl = p;
  }
  const last = pts[pts.length - 1];
  out.push({ x: last.x, y: last.y, w: last.w }); // reach the real end of the stroke

  // drop consecutive duplicates
  return out.filter((s, i) => i === 0 || Math.hypot(s.x - out[i - 1].x, s.y - out[i - 1].y) > 0.01);
}

function circle(cx, cy, r, sides = CAP_SIDES) {
  const poly = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    poly.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return poly;
}

/** Closed polygons (canvas space, y-down) whose NONZERO union is the stroke body. */
export function strokeToPolygons(stroke) {
  if (!stroke || !stroke.length) return [];
  const s = centerlineSamples(stroke);

  // dot / tap / zero-length stroke -> a single round dot
  let spread = 0;
  for (let i = 1; i < s.length; i++) spread = Math.max(spread, Math.hypot(s[i].x - s[0].x, s[i].y - s[0].y));
  if (s.length < 2 || spread < 0.5) return [circle(s[0].x, s[0].y, s[0].w / 2, 16)];

  const polys = [];
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const nx = -dy / len, ny = dx / len;
    polys.push([
      { x: a.x + nx * a.w / 2, y: a.y + ny * a.w / 2 },
      { x: b.x + nx * b.w / 2, y: b.y + ny * b.w / 2 },
      { x: b.x - nx * b.w / 2, y: b.y - ny * b.w / 2 },
      { x: a.x - nx * a.w / 2, y: a.y - ny * a.w / 2 },
    ]);
  }
  // round caps at both ends
  polys.push(circle(s[0].x, s[0].y, s[0].w / 2));
  polys.push(circle(s[s.length - 1].x, s[s.length - 1].y, s[s.length - 1].w / 2));
  // round joints where the direction changes sharply
  for (let i = 1; i < s.length - 1; i++) {
    const a1 = Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x);
    const a2 = Math.atan2(s[i + 1].y - s[i].y, s[i + 1].x - s[i].x);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > JOINT_TURN) { polys.push(circle(s[i].x, s[i].y, s[i].w / 2)); continue; }
    if (d < 0.005) continue;                       // practically straight: quads already meet
    // gentle turn: neighbouring quads leave a thin wedge on the outer side -> fill it
    const la = Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y), lb = Math.hypot(s[i + 1].x - s[i].x, s[i + 1].y - s[i].y);
    if (la < 1e-6 || lb < 1e-6) continue;
    const h = s[i].w / 2;
    const nax = -(s[i].y - s[i - 1].y) / la, nay = (s[i].x - s[i - 1].x) / la;
    const nbx = -(s[i + 1].y - s[i].y) / lb, nby = (s[i + 1].x - s[i].x) / lb;
    const v = s[i];
    polys.push([{ x: v.x, y: v.y }, { x: v.x + nax * h, y: v.y + nay * h }, { x: v.x + nbx * h, y: v.y + nby * h }]);
    polys.push([{ x: v.x, y: v.y }, { x: v.x - nax * h, y: v.y - nay * h }, { x: v.x - nbx * h, y: v.y - nby * h }]);
  }
  return polys;
}

/** Signed-area winding fix (all contours clockwise in the y-up font space). */
export function normalizeWinding(points, clockwise = true) {
  if (points.length < 3) return points;
  let signedArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    signedArea += (a.x * b.y - b.x * a.y);
  }
  const isClockwise = signedArea < 0; // y-up: CW => negative shoelace sum
  return isClockwise !== clockwise ? [...points].reverse() : points;
}

/** Contours in FONT space for one stroke: [[{x,y}...], ...] */
export function strokeToContours(stroke, baselineY, scale) {
  return strokeToPolygons(stroke).map((poly) =>
    poly.map((pt) => ({ x: pt.x * scale, y: (baselineY - pt.y) * scale })));
}
