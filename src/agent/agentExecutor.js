/**
 * KRTD Agent — action executor. The ONLY place agent actions touch app state.
 * Every action is whitelisted + sanitized (actionSchema) and risky ones need confirmation.
 */
import { ACTION_CATALOG, sanitizeAction, ALL_CHARS } from './actionSchema.js';
import { fixMetrics, fitMetricsToGlyphs, validateMetrics, realStrokes } from './projectAnalyzer.js';
import { isDrawn } from './pathPredictor.js';
import { DEFAULT_METRICS } from '../utils/glyphData.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function clampStrokes(strokes) {
  return strokes.map((s) => s.map((p) => ({ ...p, x: clamp(p.x, 0, 500), y: clamp(p.y, 0, 500) })));
}
function outside(strokes) {
  return realStrokes(strokes).some((s) => s.some((p) => p.x < 0 || p.x > 500 || p.y < 0 || p.y > 500));
}

/**
 * Runs one whitelisted agent action.
 * action: an object with id and args. api: the live handles built in App.jsx (agentApiRef).
 * Resolves to an object with ok (boolean) and message (string).
 */
export async function runAgentAction(action, api) {
  const a = sanitizeAction(action);
  if (!a) return { ok: false, message: 'මේ ක්‍රියාව අවසර නෑ.' };

  if (ACTION_CATALOG[a.id].risky) {
    const yes = await api.confirm('Agent ක්‍රියාවක්', `"${ACTION_CATALOG[a.id].label}" කරන්න ද? (පසුව ආපසු හරවන්න බැරි වෙන්න පුළුවන්)`);
    if (!yes) return { ok: false, message: 'අවලංගු කළා.' };
  }

  try {
    switch (a.id) {
      case 'select_char':
        api.selectChar(a.args.char); api.goTab('canvas');
        return { ok: true, message: `"${a.args.char}" තෝරා ගත්තා` };

      case 'go_tab':
        api.goTab(a.args.tab);
        return { ok: true, message: `${a.args.tab} tab එකට ගියා` };

      case 'fix_metrics': {
        if (validateMetrics(api.metrics).length === 0) return { ok: true, message: 'Metrics දැනටමත් නිවැරදියි' };
        api.setMetrics(fixMetrics(api.metrics));
        return { ok: true, message: 'Metrics නිවැරදි කළා' };
      }

      case 'fit_metrics': {
        const fitted = fitMetricsToGlyphs(api.glyphs, api.metrics);
        if (!fitted) return { ok: false, message: 'Fit කරන්න අකුරු 3ක්වත් ඇඳලා තියෙන්න ඕන' };
        api.setMetrics(fitted);
        return { ok: true, message: 'Ascender/Descender අකුරු වලට fit කළා' };
      }

      case 'reset_metrics':
        api.setMetrics({ ...DEFAULT_METRICS });
        return { ok: true, message: 'Metrics reset කළා' };

      case 'apply_style_profile':
        api.learnStyle();
        return { ok: true, message: 'Style learn කිරීම ක්‍රියාත්මකයි' };

      case 'set_brush':
        api.setBrushMode(a.args.mode); api.setStrokeWidth(a.args.width);
        return { ok: true, message: `Brush: ${a.args.mode} ${a.args.width}px` };

      case 'clamp_glyph': {
        const targets = a.args.char === '*'
          ? ALL_CHARS.filter((c) => outside(api.glyphs[c]))
          : [a.args.char].filter((c) => outside(api.glyphs[c]));
        if (!targets.length) return { ok: true, message: 'Canvas එකෙන් එළියට ගිය points නෑ' };
        targets.forEach((c) => api.pushUndo(c, api.glyphs[c]));
        api.setGlyphs((prev) => {
          const next = { ...prev };
          targets.forEach((c) => { next[c] = clampStrokes(prev[c] || []); });
          return next;
        });
        return { ok: true, message: `අකුරු ${targets.length}ක් canvas ඇතුළට ගත්තා (Undo කරන්න පුළුවන්)` };
      }

      case 'copy_glyph': {
        const { from, to } = a.args;
        if (!isDrawn(api.glyphs[from])) return { ok: false, message: `"${from}" තවම ඇඳලා නෑ` };
        if (isDrawn(api.glyphs[to])) return { ok: false, message: `"${to}" හි දැනටමත් strokes තියෙනවා — අහුරන්නේ නෑ` };
        api.pushUndo(to, api.glyphs[to] || []);
        const clone = JSON.parse(JSON.stringify(api.glyphs[from]));
        api.setGlyphs((prev) => ({ ...prev, [to]: clone }));
        api.selectChar(to); api.goTab('canvas');
        return { ok: true, message: `"${from}" → "${to}" copy කළා; දැන් edit කරන්න` };
      }

      case 'push_cloud':   await api.pushCloud();   return { ok: true, message: 'Cloud save ඉල්ලීම යැව්වා' };
      case 'export_ttf':   await api.exportTTF();   return { ok: true, message: 'TTF export ඉල්ලීම යැව්වා' };
      case 'export_pdf':   await api.exportPDF();   return { ok: true, message: 'PDF export ඉල්ලීම යැව්වා' };
      case 'export_png':   await api.exportPNG();   return { ok: true, message: 'PNG ZIP export ඉල්ලීම යැව්වා' };
      case 'export_json':  api.exportJSON();        return { ok: true, message: 'JSON backup බාගත වෙනවා' };
      case 'show_help':    api.showHelp();          return { ok: true, message: 'Help guide විවෘත කළා' };
      default:             return { ok: false, message: 'නොදන්නා ක්‍රියාවක්' };
    }
  } catch (err) {
    return { ok: false, message: `අසාර්ථකයි: ${err?.message || err}` };
  }
}
