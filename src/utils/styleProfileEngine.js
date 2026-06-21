/**
 * KRTD Style Profile Learning Engine — Part 4.1 (rescoped Auto-Variations)
 * ============================================================================
 * ⚠️ SCOPE NOTE: This does NOT generate new letterforms from examples —
 * true shape-extrapolation from 5 anchors is research-grade generative
 * typography (font interpolation models), not honestly buildable here.
 *
 * What this DOES do, for real: analyzes the actual stroke point data of
 * your 5 anchor glyphs (ක ම න ර ය) and extracts three measurable
 * parameters — average stroke width, calligraphic contrast ratio, and
 * path curvature — then suggests matching BRUSH DEFAULTS (width + mode)
 * for every glyph you haven't drawn yet, so your whole alphabet starts
 * from a consistent baseline instead of whatever the last-used slider
 * position happened to be.
 * ============================================================================
 */

export const ANCHOR_GLYPHS = ['ක', 'ම', 'න', 'ර', 'ය'];
const MIN_ANCHORS_REQUIRED = 3; // allow partial learning if user hasn't drawn all 5 yet

function strokeWidths(stroke) {
  return stroke.filter(p => !p.isEraser).map(p => p.strokeWidth || 8);
}

/** Average per-segment direction-angle change along a stroke — higher = curvier. */
function strokeCurvature(stroke) {
  const pts = stroke.filter(p => !p.isEraser);
  if (pts.length < 3) return 0;
  let totalTurn = 0;
  let prevAngle = null;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    if (dx === 0 && dy === 0) continue;
    const angle = Math.atan2(dy, dx);
    if (prevAngle !== null) {
      let delta = Math.abs(angle - prevAngle);
      if (delta > Math.PI) delta = 2 * Math.PI - delta; // wrap to [0, π]
      totalTurn += delta;
    }
    prevAngle = angle;
  }
  return totalTurn / Math.max(1, pts.length - 2);
}

/**
 * Computes an aggregate stroke profile from the available anchor glyphs.
 * @returns {object|null} profile, or null if fewer than MIN_ANCHORS_REQUIRED anchors are drawn
 */
export function computeStrokeProfile(glyphs) {
  const drawnAnchors = ANCHOR_GLYPHS.filter(c => glyphs[c]?.length > 0);
  if (drawnAnchors.length < MIN_ANCHORS_REQUIRED) {
    return null;
  }

  let allWidths = [];
  let contrastSamples = [];
  let curvatureSamples = [];

  drawnAnchors.forEach((char) => {
    glyphs[char].forEach((stroke) => {
      if (stroke[0]?.isEraser) return;
      const widths = strokeWidths(stroke);
      if (widths.length === 0) return;
      allWidths.push(...widths);

      const maxW = Math.max(...widths);
      const minW = Math.min(...widths);
      if (maxW > 0) contrastSamples.push((maxW - minW) / maxW);

      curvatureSamples.push(strokeCurvature(stroke));
    });
  });

  if (allWidths.length === 0) return null;

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    anchorsUsed:   drawnAnchors,
    avgWidth:      Math.round(avg(allWidths)),
    contrastRatio: contrastSamples.length ? avg(contrastSamples) : 0,
    curvature:     curvatureSamples.length ? avg(curvatureSamples) : 0,
    sampleCount:   allWidths.length,
  };
}

/**
 * Maps a stroke profile into concrete brush defaults.
 * Heuristic thresholds — documented as heuristic, not learned/trained.
 */
export function suggestBrushSettings(profile) {
  if (!profile) return null;

  let brushMode = 'uniform';
  if (profile.contrastRatio > 0.35) {
    brushMode = 'calligraphy'; // high width variance => calligraphic pen style
  } else if (profile.curvature > 0.45) {
    brushMode = 'tapered'; // curvy but low contrast => tapered brush suits better
  }

  const strokeWidth = Math.max(2, Math.min(48, profile.avgWidth));

  return { strokeWidth, brushMode, basis: profile };
}
