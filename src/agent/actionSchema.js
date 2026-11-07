/**
 * KRTD Agent — action catalog + sanitizer.
 * SHARED by the browser (src/agent/*) and the Vercel function (api/agent.js),
 * so the model can never make the app do anything outside this whitelist.
 */
import { GLYPH_SECTIONS } from '../utils/glyphData.js';

export const ALL_CHARS = GLYPH_SECTIONS.flatMap((s) => s.chars);
const CHAR_SET = new Set(ALL_CHARS);

export const TABS = ['canvas', 'text', 'admin'];
export const BRUSH_MODES = ['calligraphy', 'tapered', 'uniform'];

/** id -> { label, desc, risky, args } (args = documentation for the LLM) */
export const ACTION_CATALOG = {
  select_char:         { label: 'අකුර තෝරන්න',        desc: 'Select a glyph on the canvas to draw.', risky: false, args: { char: 'one glyph from the Atlas' } },
  go_tab:              { label: 'Tab මාරු කරන්න',      desc: 'Switch workspace tab.',                 risky: false, args: { tab: 'canvas | text | admin' } },
  fix_metrics:         { label: 'Metrics නිවැරදි කරන්න', desc: 'Repair invalid metric order / gaps.',   risky: false, args: {} },
  fit_metrics:         { label: 'Metrics fit කරන්න',    desc: 'Fit ascender/descender to the drawn glyphs.', risky: false, args: {} },
  reset_metrics:       { label: 'Metrics reset',        desc: 'Reset metrics to defaults.',            risky: true,  args: {} },
  apply_style_profile: { label: 'Style learn කරන්න',    desc: 'Learn brush style from the 5 anchor glyphs.', risky: false, args: {} },
  set_brush:           { label: 'Brush set කරන්න',      desc: 'Set brush mode and width.',             risky: false, args: { mode: 'calligraphy | tapered | uniform', width: '4-40' } },
  clamp_glyph:         { label: 'Canvas ඇතුළට ගන්න',    desc: 'Pull points that left the 500x500 canvas back inside (char or "*" for all flagged).', risky: false, args: { char: 'glyph or *' } },
  copy_glyph:          { label: 'Glyph copy කරන්න',     desc: 'Copy strokes of one glyph into an EMPTY glyph as a starting point.', risky: false, args: { from: 'glyph', to: 'glyph' } },
  push_cloud:          { label: 'Cloud save',           desc: 'Push the project to Supabase.',         risky: false, args: {} },
  export_ttf:          { label: 'TTF export',           desc: 'Compile and download the .ttf font.',   risky: false, args: {} },
  export_pdf:          { label: 'Specimen PDF',         desc: 'Download the specimen sheet PDF.',      risky: false, args: {} },
  export_png:          { label: 'PNG ZIP',              desc: 'Download all glyphs as PNG ZIP.',       risky: false, args: {} },
  export_json:         { label: 'JSON backup',          desc: 'Download a JSON backup.',               risky: false, args: {} },
  shape_guide:         { label: 'Shape Guide',          desc: 'Show/hide the hollow standard-shape tracing guide of the selected glyph (not saved).', risky: false, args: { on: 'true | false (omit to toggle)' } },
  show_help:           { label: 'Help guide',           desc: 'Open the help guide.',                  risky: false, args: {} },
};

export function isGlyph(c) { return typeof c === 'string' && CHAR_SET.has(c); }

/** Returns a clean {id,args} or null. Never trusts the input. */
export function sanitizeAction(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(ACTION_CATALOG, a.id)) return null;
  const src = a.args && typeof a.args === 'object' ? a.args : {};
  const args = {};
  switch (a.id) {
    case 'select_char':
      if (!isGlyph(src.char)) return null;
      args.char = src.char; break;
    case 'go_tab':
      if (!TABS.includes(src.tab)) return null;
      args.tab = src.tab; break;
    case 'set_brush': {
      if (!BRUSH_MODES.includes(src.mode)) return null;
      const w = Number(src.width);
      args.mode = src.mode;
      args.width = Number.isFinite(w) ? Math.max(4, Math.min(40, Math.round(w))) : 14;
      break;
    }
    case 'clamp_glyph':
      if (src.char === '*' || src.char == null) args.char = '*';
      else if (isGlyph(src.char)) args.char = src.char;
      else return null;
      break;
    case 'copy_glyph':
      if (!isGlyph(src.from) || !isGlyph(src.to) || src.from === src.to) return null;
      args.from = src.from; args.to = src.to; break;
    case 'shape_guide':
      if (typeof src.on === 'boolean') args.on = src.on;
      break;
    default: break;
  }
  return { id: a.id, args };
}

export function sanitizeActions(list, max = 4) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const a of list) {
    const s = sanitizeAction(a);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
