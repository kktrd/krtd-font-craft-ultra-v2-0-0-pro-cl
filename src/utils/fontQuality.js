// Pre-export quality check. Pure: inspects the same model the exporter will write.
import { buildFontModel } from './fontCompiler.js';
import { coverageReport, hasInk } from './coverage.js';

const label = (g) => (g.sequence ? String.fromCodePoint(...g.sequence) : String.fromCodePoint(g.unicode));
const bbox = (contours) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pts = 0;
  contours.forEach((c) => c.forEach((p) => { pts++; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }));
  return { x0, y0, x1, y1, pts };
};

/**
 * @returns {{ ok: boolean, issues: {level:'error'|'warn'|'info', code:string, text:string, chars:string[]}[], counts:{error:number,warn:number,info:number} }}
 */
export function qualityReport({ fontName, metrics, glyphs }) {
  const issues = [];
  const add = (level, code, text, chars = []) => issues.push({ level, code, text, chars });
  let model;
  try { model = buildFontModel({ fontName, metrics, glyphs }).model; }
  catch (e) {
    add('error', 'no-glyphs', 'තවම ඇඳපු අකුරු නැහැ. අඩුම තරමින් එකක් අඳින්න.');
    return finish(issues);
  }
  const drawnKeys = Object.keys(glyphs).filter((k) => hasInk(glyphs[k]));
  const exported = new Set(model.glyphs.filter((g) => g.unicode != null && g.contours.length).map((g) => label(g)));
  const skipped = drawnKeys.filter((k) => !exported.has(k));
  if (skipped.length) add('error', 'skipped', 'Export එකට ඇතුළත් නොවන අකුරු (හිස් හෝ අවලංගු හැඩ):', skipped);

  const real = model.glyphs.filter((g) => g.unicode != null && g.unicode !== 32 && g.contours.length);
  // ligatures that can never fire
  const have = new Set(model.glyphs.map((g) => g.unicode));
  real.filter((g) => g.sequence).forEach((g) => {
    const lacking = g.sequence.filter((c) => c !== 0x200d && !have.has(c)).map((c) => String.fromCodePoint(c));
    if (lacking.length) add('warn', 'lig-missing-parts', `"${label(g)}" type කරද්දි auto වැටෙන්නේ නැහැ. මේ අකුරු අඳින්න: ${[...new Set(lacking)].join(' ')}`, lacking);
  });

  const em = model.unitsPerEm;
  const out = [], tiny = [], heavy = [];
  const widths = [];
  real.forEach((g) => {
    const b = bbox(g.contours);
    if (b.y1 > model.ascender + em * 0.25 || b.y0 < model.descender - em * 0.25) out.push(label(g));
    if (b.x1 - b.x0 < 30 && b.y1 - b.y0 < 30) tiny.push(label(g));
    if (b.pts > 3000) heavy.push(label(g));
    if (g.advance > 0) widths.push(g.advance);
  });
  if (out.length) add('warn', 'out-of-bounds', 'ascender / descender ඉරි වලින් බොහෝ පිටතට යන අකුරු:', out);
  if (tiny.length) add('warn', 'tiny', 'ඉතා කුඩා (ලක්ෂයක් වගේ) අකුරු:', tiny);
  if (heavy.length) add('info', 'heavy', 'ඉතා සංකීර්ණ හැඩ (file එක විශාල වෙයි). Smooth/RDP භාවිතා කරන්න:', heavy);
  if (widths.length > 3) {
    const sorted = widths.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    const odd = real.filter((g) => g.advance > med * 2.2).map(label);
    if (odd.length) add('info', 'wide', 'අනිත් අකුරු වලට වඩා ඉතා පළල් අකුරු (spacing බලන්න):', odd);
  }
  const cov = coverageReport(glyphs);
  if (cov.coreMissing.length) add('warn', 'core-missing', `සාමාන්‍ය සිංහල ලියන්න අවශ්‍ය මූලික අකුරු ${cov.coreMissing.length}ක් තාම නැහැ:`, cov.coreMissing.slice(0, 12));
  const missingPill = ['ා', 'ි', 'ු', 'ෙ'].filter((c) => !hasInk(glyphs[c]));
  if (missingPill.length && cov.done > 0) add('info', 'pili', 'මේ පිල්ලම් නැතුව වචන සම්පූර්ණ වෙන්නේ නැහැ:', missingPill);
  if (!issues.length) add('info', 'all-good', 'ගැටළු කිසිවක් නැහැ. Export කරන්න ලෑස්තියි.');
  return finish(issues);
}

function finish(issues) {
  const counts = { error: 0, warn: 0, info: 0 };
  issues.forEach((i) => { counts[i.level]++; });
  return { ok: counts.error === 0, issues, counts };
}
