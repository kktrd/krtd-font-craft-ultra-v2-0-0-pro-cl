/**
 * KRTD Agent — local brain: turns analysis + a chat message into a reply
 * (text, buttons, and commands to run). 100% offline, deterministic.
 */
import { parseIntent } from './intentParser.js';
import { nextBestActions, workflowSteps } from './projectAnalyzer.js';
import { reasonText } from './pathPredictor.js';
import { ACTION_CATALOG } from './actionSchema.js';

export const label = (act) => {
  const base = ACTION_CATALOG[act.id]?.label || act.id;
  if (act.id === 'select_char') return `${base}: ${act.args.char}`;
  if (act.id === 'go_tab') return `${base}: ${act.args.tab}`;
  if (act.id === 'set_brush') return `${base}: ${act.args.mode} ${act.args.width}px`;
  if (act.id === 'copy_glyph') return `${base}: ${act.args.from} → ${act.args.to}`;
  return base;
};

const PHASE_TEXT = {
  setup: 'Metrics වැරදියි — මුලින්ම ඒක හදමු.',
  anchors: 'Anchor අකුරු (ක ම න ර ය) අඳිමු — ඔයාගේ style එක ඒවායින් හඳුනාගන්නවා.',
  core: 'ප්‍රධාන ව්‍යංජන අකුරු සම්පූර්ණ කරමු.',
  vowels: 'ස්වර සහ පිල්ලම් අකුරු අඳිමු.',
  extended: 'මහාප්‍රාණ සහ බැඳි අකුරු ඉතිරියි.',
  polish: 'හැම අකුරක්ම ඇඳලා — දැන් quality issues ටික හදමු.',
  ship: 'සූදානම්! Text Studio එකේ test කරලා TTF export කරන්න.',
};

export function summaryText(a) {
  return `Health score ${a.score}/100 (${a.grade}). අකුරු ${a.drawnCount}/${a.total} ඇඳලා. ${PHASE_TEXT[a.phase]}`;
}

export function issuesText(a) {
  if (!a.issues.length) return 'දැනට ගැටළු නෑ. ✅';
  return a.issues.map((i) => `${i.severity === 'error' ? '❌' : i.severity === 'warn' ? '⚠️' : 'ℹ️'} ${i.title}${i.chars ? ` (${i.chars.slice(0, 8).join(' ')})` : ''}`).join('\n');
}

export function nextText(a) {
  if (!a.predicted.length) return 'සියලුම අකුරු ඇඳලා! 🎉';
  return a.predicted.slice(0, 4).map((p, i) => `${i + 1}. ${p.char} — ${reasonText(p)}`).join('\n');
}

export function planText(a) {
  const steps = workflowSteps(a);
  return steps.map((s) => `${s.status === 'done' ? '✅' : s.status === 'current' ? '👉' : '⬜'} ${s.title}`).join('\n');
}

/** Actions that are safe to run automatically for "fix all". */
export const AUTO_FIX_IDS = ['fix_metrics', 'clamp_glyph', 'fit_metrics', 'apply_style_profile', 'push_cloud'];

export function autoFixList(a) {
  const list = [];
  for (const i of a.issues) {
    if (i.fix && AUTO_FIX_IDS.includes(i.fix.id)) list.push(i.fix);
  }
  return list;
}

export function localReply(text, a) {
  const { actions, intent } = parseIntent(text);

  if (actions.length) {
    return { understood: true, text: `හරි, ${actions.map(label).join(' + ')} කරනවා…`, run: actions, buttons: [] };
  }
  switch (intent) {
    case 'fixall': {
      const fixes = autoFixList(a);
      return fixes.length
        ? { understood: true, text: `ස්වයංක්‍රීයව හදන්න පුළුවන් දේවල් ${fixes.length}ක් තියෙනවා — දැන් කරනවා…`, run: fixes, buttons: [] }
        : { understood: true, text: 'Auto-fix කරන්න දෙයක් නෑ. ඉතිරි ගැටළු අතින් හදන්න ඕන (අකුරු නැවත අඳින්න).', run: [], buttons: [] };
    }
    case 'next': {
      const buttons = a.predicted.slice(0, 4).map((p) => ({ id: 'select_char', args: { char: p.char } }));
      return { understood: true, text: `ඊළඟට අඳින්න කියලා මම හිතන අකුරු:\n${nextText(a)}`, run: [], buttons };
    }
    case 'plan':
      return { understood: true, text: `${summaryText(a)}\n\n${planText(a)}`, run: [], buttons: nextBestActions(a).slice(0, 3).map((x) => ({ id: x.id, args: x.args })) };
    case 'issues':
      return { understood: true, text: issuesText(a), run: [], buttons: a.issues.filter((i) => i.fix).slice(0, 4).map((i) => i.fix) };
    case 'status':
      return { understood: true, text: summaryText(a), run: [], buttons: nextBestActions(a).slice(0, 3).map((x) => ({ id: x.id, args: x.args })) };
    default:
      return {
        understood: false,
        text: 'මට මේවා කරන්න පුළුවන්: "ඊළඟ අකුර", "score", "issues", "fix all", "metrics fix", "save", "export ttf", "text studio", නැත්නම් අකුරක් type කරන්න (ex: ක).',
        run: [], buttons: nextBestActions(a).slice(0, 3).map((x) => ({ id: x.id, args: x.args })),
      };
  }
}
