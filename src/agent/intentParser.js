/**
 * KRTD Agent — local intent parser (English / Singlish / Sinhala keywords).
 * Works fully offline. Returns { actions:[{id,args}], intent:string|null }.
 */
import { ALL_CHARS, sanitizeAction } from './actionSchema.js';

const GLYPHS_LONGEST_FIRST = [...ALL_CHARS].sort((a, b) => b.length - a.length);
const FILLER = /\b(draw|select|open|go|to|the|letter|char|character|glyph|please|pls|plz)\b|අඳින්න|අඳින|ඇඳිය|ඇඳ|තෝරන්න|තෝරා|ගන්න|අකුර|කරන්න|["'“”.,!?]/g;

function glyphOnly(text) {
  const rest = text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  return GLYPHS_LONGEST_FIRST.find((g) => g === rest) || null;
}

const ACTION_RULES = [
  { re: /reset.*metric|metric.*reset|metrics? reset/, a: { id: 'reset_metrics', args: {} } },
  { re: /fit.*metric|metric.*fit/,                    a: { id: 'fit_metrics', args: {} } },
  { re: /(fix|repair|නිවැරදි|හදන).*(metric|මෙට්‍රික්)|(metric|මෙට්‍රික්).*(fix|repair|නිවැරදි|හදන)/, a: { id: 'fix_metrics', args: {} } },
  { re: /clamp|out of canvas|outside canvas|එළියට|boundary|canvas එකෙන්/,   a: { id: 'clamp_glyph', args: { char: '*' } } },
  { re: /style|විලාස|learn/,                          a: { id: 'apply_style_profile', args: {} } },
  { re: /\bttf\b|font file|download font|font එක export|font export/, a: { id: 'export_ttf', args: {} } },
  { re: /\bpdf\b|specimen/,                           a: { id: 'export_pdf', args: {} } },
  { re: /\bpng\b/,                                    a: { id: 'export_png', args: {} } },
  { re: /\bjson\b|backup|බැකප්/,                      a: { id: 'export_json', args: {} } },
  { re: /shape guide|hollow|outline guide|trace|guide shape|සම්මත හැඩ|හිස් හැඩ|හැඩ ?ගයිඩ/, a: { id: 'shape_guide', args: {} } },
  { re: /text studio|text tab|ටෙක්ස්ට්|test.?drive/,  a: { id: 'go_tab', args: { tab: 'text' } } },
  { re: /\badmin\b|ඇඩ්මින්/,                           a: { id: 'go_tab', args: { tab: 'admin' } } },
  { re: /canvas (tab|studio)|කැන්වස්/,                a: { id: 'go_tab', args: { tab: 'canvas' } } },
  { re: /\b(save|sync|push|cloud)\b|සුරකින|සේව්|ක්ලවුඩ්/, a: { id: 'push_cloud', args: {} } },
  { re: /^(help|\?|guide)$|උදව්|උපදෙස්/,              a: { id: 'show_help', args: {} } },
];

const INTENT_RULES = [
  { re: /fix (all|everything)|සියල්ල (හදන|නිවැරදි)|auto ?fix/, name: 'fixall' },
  { re: /\b(next|what next|predict|path)\b|ඊළඟ|ඊලඟ|ඉදිරි|මොකක්ද කරන්න|mokada karanna|iliyanga/, name: 'next' },
  { re: /\b(plan|workflow|autopilot|roadmap|steps?)\b|වැඩ පිළිවෙළ|පියවර/, name: 'plan' },
  { re: /\b(issue|issues|problem|problems|bug|bugs|wrong|errors?)\b|වැරදි|ගැටළු|අවුල්/, name: 'issues' },
  { re: /\b(score|health|status|analy[sz]e|audit|report|progress|check)\b|ප්‍රගති|තත්ත්ව|ඇගයීම|පරීක්ෂා/, name: 'status' },
];

export function parseIntent(raw) {
  const text = String(raw || '').toLowerCase().trim();
  if (!text) return { actions: [], intent: null };

  const g = glyphOnly(String(raw).trim());
  if (g) return { actions: [{ id: 'select_char', args: { char: g } }], intent: null };

  const intentFix = INTENT_RULES.find((r) => r.name === 'fixall' && r.re.test(text));
  if (intentFix) return { actions: [], intent: 'fixall' };

  const actions = [];
  for (const r of ACTION_RULES) {
    if (r.re.test(text)) {
      const s = sanitizeAction(r.a);
      if (s && !actions.some((x) => x.id === s.id)) actions.push(s);
    }
    if (actions.length >= 3) break;
  }
  if (actions.length) return { actions, intent: null };

  for (const r of INTENT_RULES) if (r.re.test(text)) return { actions: [], intent: r.name };
  return { actions: [], intent: null };
}
