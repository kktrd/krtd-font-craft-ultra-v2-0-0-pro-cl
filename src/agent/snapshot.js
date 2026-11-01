/** Compact, secret-free project snapshot sent to the LLM (numbers + glyph names only). */
import { nextBestActions } from './projectAnalyzer.js';

export function buildSnapshot(a, ctx) {
  return {
    fontName: String(ctx.fontName || '').slice(0, 40),
    selectedChar: ctx.selectedChar,
    score: a.score, grade: a.grade, phase: a.phase,
    drawn: a.drawnCount, total: a.total,
    missingAnchors: a.missingAnchors,
    coverage: a.coverage.map((s) => ({ id: s.id, done: s.done, total: s.total, missing: s.missing.slice(0, 10) })),
    issues: a.issues.map((i) => ({ id: i.id, severity: i.severity, title: i.title, chars: (i.chars || []).slice(0, 12) })),
    predictedPath: a.predicted.slice(0, 6).map((p) => p.char),
    suggestedActions: nextBestActions(a).slice(0, 4).map((x) => ({ id: x.id, args: x.args })),
    metrics: ctx.metrics,
    brush: { mode: ctx.brushMode, width: ctx.strokeWidth },
    signedIn: !!ctx.signedIn, online: ctx.isOnline !== false,
  };
}
