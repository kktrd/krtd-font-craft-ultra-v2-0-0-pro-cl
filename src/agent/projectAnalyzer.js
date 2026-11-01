/**
 * KRTD Agent — Project Analyzer. Pure functions, no React.
 * Produces: coverage, per-glyph quality flags, metrics validation, consistency,
 * a 0-100 health score, the current workflow phase, issues and next best actions.
 */
import { ALL_CHARS } from './actionSchema.js';
import { ANCHORS, SECTIONS, SECTION_OF, MARK_CHARS, TOTAL_GLYPHS } from './knowledge.js';
import { isDrawn, predictNextChars } from './pathPredictor.js';
import { DEFAULT_METRICS } from '../utils/glyphData.js';

const CANVAS = 500;
const METRIC_KEYS = ['ascender', 'capHeight', 'xHeight', 'baseline', 'descender'];
const MIN_GAP = 10;

// ── Metrics ────────────────────────────────────────────────────────────────
export function validateMetrics(m) {
  const problems = [];
  if (!m || typeof m !== 'object') return ['missing'];
  for (const k of METRIC_KEYS) if (!Number.isFinite(m[k])) problems.push(`${k}: invalid number`);
  if (problems.length) return problems;
  for (let i = 1; i < METRIC_KEYS.length; i++) {
    const a = METRIC_KEYS[i - 1], b = METRIC_KEYS[i];
    if (m[b] - m[a] < MIN_GAP) problems.push(`${a} / ${b} order or gap`);
  }
  if (m.ascender < 0 || m.descender > CANVAS) problems.push('outside canvas');
  return problems;
}

/** Repairs metrics: strictly increasing top->bottom with a >=20 gap, inside the canvas. */
export function fixMetrics(m) {
  const out = {};
  for (const k of METRIC_KEYS) out[k] = Number.isFinite(m?.[k]) ? Math.round(m[k]) : DEFAULT_METRICS[k];
  out.ascender = Math.max(0, out.ascender);
  const GAP = 20;
  for (let i = 1; i < METRIC_KEYS.length; i++) {
    const prev = out[METRIC_KEYS[i - 1]];
    if (out[METRIC_KEYS[i]] < prev + GAP) out[METRIC_KEYS[i]] = prev + GAP;
  }
  if (out.descender > CANVAS) return { ...DEFAULT_METRICS }; // cannot fit -> safe defaults
  return out;
}

// ── Glyph statistics ──────────────────────────────────────────────────────
export function realStrokes(strokes) {
  return (strokes || []).filter((s) => s?.length && !s[0]?.isEraser);
}

export function glyphStats(strokes) {
  const rs = realStrokes(strokes);
  if (!rs.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let pts = 0, wSum = 0, wN = 0, out = false;
  for (const s of rs) for (const p of s) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    if (p.x < 0 || p.x > CANVAS || p.y < 0 || p.y > CANVAS) out = true;
    if (p.strokeWidth) { wSum += p.strokeWidth; wN++; }
    pts++;
  }
  return {
    strokes: rs.length, points: pts,
    minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY,
    avgWidth: wN ? wSum / wN : 0, outOfCanvas: out,
  };
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};

/** Metrics that wrap the drawn letters (used by fit_metrics). */
export function fitMetricsToGlyphs(glyphs, metrics) {
  const tops = [], bottoms = [];
  for (const c of ALL_CHARS) {
    if (MARK_CHARS.has(c)) continue;
    const st = glyphStats(glyphs?.[c]);
    if (st) { tops.push(st.minY); bottoms.push(st.maxY); }
  }
  if (tops.length < 3) return null;
  const base = fixMetrics(metrics);
  const asc = Math.max(0, Math.round(percentile(tops, 5) - 10));
  const desc = Math.min(CANVAS, Math.round(percentile(bottoms, 95) + 10));
  return fixMetrics({ ...base, ascender: Math.min(asc, base.ascender), descender: Math.max(desc, base.descender) });
}

// ── Main analysis ─────────────────────────────────────────────────────────
export function analyzeProject({ glyphs = {}, metrics, selectedChar, env = {}, styleLearned = false }) {
  const issues = [];
  const stats = {};
  const drawn = [];
  for (const c of ALL_CHARS) {
    if (!isDrawn(glyphs[c])) continue;
    drawn.push(c);
    stats[c] = glyphStats(glyphs[c]);
  }

  // Coverage per section
  const coverage = SECTIONS.map((s) => {
    const done = s.chars.filter((c) => stats[c]);
    return { id: s.id, title: s.title, done: done.length, total: s.chars.length, missing: s.chars.filter((c) => !stats[c]) };
  });
  const missingAnchors = ANCHORS.filter((c) => !stats[c]);

  // Metrics
  const mProblems = validateMetrics(metrics);
  const metricsOk = mProblems.length === 0;
  if (!metricsOk) {
    issues.push({ id: 'metrics-invalid', severity: 'error', title: 'Metrics වැරදියි', detail: mProblems.join(', '), fix: { id: 'fix_metrics', args: {} } });
  }

  // Per-glyph quality
  const outOfCanvas = [], tiny = [], beyond = [];
  for (const c of drawn) {
    const st = stats[c];
    if (st.outOfCanvas) outOfCanvas.push(c);
    if (!MARK_CHARS.has(c) && Math.max(st.w, st.h) < 30) tiny.push(c);
    if (metricsOk && !MARK_CHARS.has(c) && (st.minY < metrics.ascender - 30 || st.maxY > metrics.descender + 30)) beyond.push(c);
  }
  if (outOfCanvas.length) issues.push({ id: 'out-of-canvas', severity: 'warn', title: 'Canvas එකෙන් එළියට ගිය points', detail: 'Export එකේදී අකුර කැපිලා යයි.', chars: outOfCanvas, fix: { id: 'clamp_glyph', args: { char: '*' } } });
  if (tiny.length) issues.push({ id: 'tiny', severity: 'warn', title: 'ඉතා කුඩා අකුරු', detail: 'අනෙක් අකුරු වලට වඩා ගොඩක් පොඩියි — නැවත ලොකුවට අඳින්න.', chars: tiny, fix: { id: 'select_char', args: { char: tiny[0] } } });
  if (beyond.length) issues.push({ id: 'beyond-metrics', severity: 'warn', title: 'Metrics ඉරි වලින් එළියට ගිය අකුරු', detail: 'Ascender/Descender fit කරන්න, නැත්නම් අකුර නැවත අඳින්න.', chars: beyond, fix: { id: 'fit_metrics', args: {} } });

  // Stroke-weight consistency (vs median of drawn glyphs)
  const widths = drawn.map((c) => stats[c].avgWidth).filter((w) => w > 0);
  const medW = median(widths);
  const inconsistent = medW > 0 && drawn.length >= 4
    ? drawn.filter((c) => stats[c].avgWidth > 0 && Math.abs(stats[c].avgWidth - medW) / medW > 0.5)
    : [];
  if (inconsistent.length) {
    issues.push({ id: 'weight', severity: 'info', title: 'Stroke ඝනකම් අසමානයි', detail: `මධ්‍යන්‍ය ඝනකම ≈ ${Math.round(medW)}px. අසමාන අකුරු නැවත ඒ ඝනකමෙන් අඳින්න.`, chars: inconsistent, fix: { id: 'set_brush', args: { mode: 'calligraphy', width: Math.max(4, Math.min(40, Math.round(medW))) } } });
  }

  // Style profile
  if (!styleLearned && ANCHORS.filter((c) => stats[c]).length >= 3) {
    issues.push({ id: 'style-not-learned', severity: 'info', title: 'Style තවම learn කරලා නෑ', detail: 'Anchor අකුරු 3+ ඇඳලා තියෙනවා — brush style auto-learn කරන්න.', fix: { id: 'apply_style_profile', args: {} } });
  }

  // Cloud / safety
  if (env.pendingCloud) issues.push({ id: 'cloud-pending', severity: 'warn', title: 'Cloud sync නොවූ වෙනස්කම් තියෙනවා', detail: 'Network error එකක් නිසා local copy එකක් විතරයි තියෙන්නේ.', fix: { id: 'push_cloud', args: {} } });
  else if (env.hasSupabase === false && drawn.length >= 3) issues.push({ id: 'no-cloud', severity: 'info', title: 'Cloud සම්බන්ධ කරලා නෑ', detail: 'දැනට වැඩ browser එකේ විතරයි. Vercel env vars set කරන්න, නැත්නම් JSON backup එකක් ගන්න.', fix: { id: 'export_json', args: {} } });
  if (!env.isOnline && env.isOnline !== undefined) issues.push({ id: 'offline', severity: 'info', title: 'Offline mode', detail: 'වැඩ local එකේ සුරැකෙනවා; online ආවම auto sync වෙයි.' });

  // Score
  const coverageRatio = Math.min(1, drawn.length / TOTAL_GLYPHS);
  const flagged = new Set([...outOfCanvas, ...tiny, ...beyond]).size;
  const quality = drawn.length ? 1 - Math.min(1, flagged / drawn.length) : 0;
  const consistency = drawn.length ? 1 - Math.min(1, inconsistent.length / drawn.length) : 0;
  const cloudOk = env.pendingCloud ? 0.4 : 1;
  // Score = completion x quality. Quality can cost at most 40% of the achievable points,
  // so 5 perfect glyphs never look like a "finished" font.
  const qualityBlend = 0.5 * quality + 0.3 * consistency + 0.1 * (metricsOk ? 1 : 0) + 0.1 * cloudOk;
  const score = drawn.length === 0 ? 0 : Math.round(100 * coverageRatio * (0.6 + 0.4 * qualityBlend));
  const grade = score < 15 ? 'පටන් ගන්නවා' : score < 40 ? 'ගොඩනඟමින්' : score < 70 ? 'හොඳ ප්‍රගතිය' : score < 90 ? 'ශක්තිමත්' : 'Release සූදානම්';

  // Workflow phase
  const secMissing = (id) => coverage.find((s) => s.id === id).missing.length;
  let phase;
  if (!metricsOk) phase = 'setup';
  else if (missingAnchors.length) phase = 'anchors';
  else if (secMissing('alpa')) phase = 'core';
  else if (secMissing('vowels') || secMissing('pillam')) phase = 'vowels';
  else if (secMissing('maha') || secMissing('bandi')) phase = 'extended';
  else if (issues.some((i) => i.severity !== 'info')) phase = 'polish';
  else phase = 'ship';

  const predicted = predictNextChars(glyphs, selectedChar, 8);

  return {
    drawnCount: drawn.length, total: TOTAL_GLYPHS, drawn, stats, coverage, missingAnchors,
    metricsOk, issues, score, grade, phase, predicted,
    flaggedChars: { outOfCanvas, tiny, beyond, inconsistent }, medianWidth: Math.round(medW),
  };
}

// ── Next best actions (ranked) ────────────────────────────────────────────
export function nextBestActions(a) {
  const out = [];
  const push = (id, args, title, why) => out.push({ id, args, title, why });

  const errFix = a.issues.find((i) => i.severity === 'error' && i.fix);
  if (errFix) push(errFix.fix.id, errFix.fix.args, errFix.title, errFix.detail);

  const next = a.predicted[0];
  switch (a.phase) {
    case 'anchors':  push('select_char', { char: a.missingAnchors[0] }, `"${a.missingAnchors[0]}" අඳින්න`, `Anchor අකුරු ${a.missingAnchors.length}ක් ඉතිරියි — ඒවායින් ඔයාගේ style එක හඳුනාගන්නවා.`); break;
    case 'core':     if (next) push('select_char', { char: next.char }, `"${next.char}" අඳින්න`, 'ප්‍රධාන ව්‍යංජන අකුරු සම්පූර්ණ කරමු.'); break;
    case 'vowels':   if (next) push('select_char', { char: next.char }, `"${next.char}" අඳින්න`, 'ස්වර සහ පිල්ලම් අකුරු.'); break;
    case 'extended': if (next) push('select_char', { char: next.char }, `"${next.char}" අඳින්න`, 'මහාප්‍රාණ / බැඳි අකුරු.'); break;
    case 'polish':   break;
    case 'ship':
      push('go_tab', { tab: 'text' }, 'Text Studio එකේ test-drive කරන්න', 'Font එක ඇත්ත වචන වලින් පරීක්ෂා කරන්න.');
      push('export_ttf', {}, 'TTF export කරන්න', 'සියලු අකුරු සූදානම් — font file එක බාගන්න.');
      break;
    default: break;
  }
  for (const i of a.issues) {
    if (i.fix && i.severity !== 'error') push(i.fix.id, i.fix.args, i.title, i.detail);
  }
  // de-duplicate by id+args
  const seen = new Set();
  return out.filter((x) => { const k = x.id + JSON.stringify(x.args); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ── Workflow steps for Autopilot ──────────────────────────────────────────
export function workflowSteps(a) {
  const done = {
    setup: a.metricsOk,
    anchors: a.missingAnchors.length === 0,
    style: !a.issues.some((i) => i.id === 'style-not-learned') && a.missingAnchors.length < 3,
    core: a.coverage.find((s) => s.id === 'alpa').missing.length === 0,
    vowels: a.coverage.find((s) => s.id === 'vowels').missing.length === 0 && a.coverage.find((s) => s.id === 'pillam').missing.length === 0,
    extended: a.coverage.find((s) => s.id === 'maha').missing.length === 0 && a.coverage.find((s) => s.id === 'bandi').missing.length === 0,
    polish: !a.issues.some((i) => i.severity !== 'info'),
  };
  const steps = [
    { id: 'setup',    title: 'Metrics නිවැරදි කිරීම',        auto: true,  done: done.setup },
    { id: 'anchors',  title: 'Anchor අකුරු 5 (ක ම න ර ය)',   auto: false, done: done.anchors },
    { id: 'style',    title: 'Style learn කිරීම',            auto: true,  done: done.style },
    { id: 'core',     title: 'ප්‍රධාන ව්‍යංජන අකුරු',        auto: false, done: done.core },
    { id: 'vowels',   title: 'ස්වර සහ පිල්ලම්',              auto: false, done: done.vowels },
    { id: 'extended', title: 'මහාප්‍රාණ සහ බැඳි අකුරු',      auto: false, done: done.extended },
    { id: 'polish',   title: 'Quality fixes',                auto: true,  done: done.polish },
    { id: 'ship',     title: 'Test-drive සහ TTF export',     auto: false, done: false },
  ];
  const cur = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, status: s.done ? 'done' : i === cur ? 'current' : 'todo' }));
}
