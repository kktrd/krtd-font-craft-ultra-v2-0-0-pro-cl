// OpenType GSUB writer (LigatureSubst only) + sfnt table injector. Pure, no DOM.
// Makes multi-codepoint Sinhala sequences (e.g. ක්ෂ, ශ්‍රී) turn into the drawn ligature glyph
// automatically when typed in apps that use OpenType shaping.

const u16 = (v) => [(v >> 8) & 255, v & 255];
const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

export const ZWJ = 0x200d;
export const VIRAMA = 0x0dca;
const SINHALA_CONSONANT = (c) => c >= 0x0d9a && c <= 0x0dc6;

/** All Unicode sequences that should map to a ligature glyph for a key like "ක්ෂ". */
export function sequenceVariants(seq) {
  const out = [seq];
  const withZwj = [];
  for (let i = 0; i < seq.length; i++) {
    withZwj.push(seq[i]);
    if (seq[i] === VIRAMA && i + 1 < seq.length && SINHALA_CONSONANT(seq[i + 1]) && seq[i + 1] !== ZWJ) withZwj.push(ZWJ);
  }
  if (withZwj.length !== seq.length && !seq.includes(ZWJ)) out.push(withZwj);
  return out;
}

/**
 * Resolve glyph ids for ligature records. glyphs: [{unicode, sequence?}], index = glyph id.
 * Returns [{ components: [gid...], glyph: gid }] — only sequences whose every codepoint has a glyph.
 */
export function resolveLigatures(glyphs) {
  const byCode = new Map();
  glyphs.forEach((g, i) => { if (g.unicode != null && !byCode.has(g.unicode)) byCode.set(g.unicode, i); });
  const seen = new Set();
  const out = [];
  glyphs.forEach((g, gid) => {
    if (!g.sequence || g.sequence.length < 2) return;
    for (const v of sequenceVariants(g.sequence)) {
      const comps = v.map((c) => byCode.get(c));
      if (comps.some((x) => x === undefined)) continue;
      const key = comps.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ components: comps, glyph: gid });
    }
  });
  return out;
}

/** Build a GSUB table with one LigatureSubst lookup used by ccmp + liga for DFLT and sinh scripts. */
export function buildGSUB(ligs) {
  if (!ligs.length) return null;
  // group by first component glyph
  const sets = new Map();
  ligs.forEach((l) => {
    const f = l.components[0];
    if (!sets.has(f)) sets.set(f, []);
    sets.get(f).push(l);
  });
  const firsts = [...sets.keys()].sort((a, b) => a - b);

  // LigatureSet / Ligature tables (longest match first, as required for correct matching)
  const setBlobs = firsts.map((f) => {
    const list = sets.get(f).slice().sort((a, b) => b.components.length - a.components.length);
    const ligBlobs = list.map((l) => {
      const b = [...u16(l.glyph), ...u16(l.components.length)];
      l.components.slice(1).forEach((c) => b.push(...u16(c)));
      return b;
    });
    const head = [...u16(list.length)];
    let off = 2 + list.length * 2;
    ligBlobs.forEach((b) => { head.push(...u16(off)); off += b.length; });
    return head.concat(...ligBlobs);
  });

  // LigatureSubstFormat1
  const coverage = [...u16(1), ...u16(firsts.length), ...firsts.flatMap((g) => u16(g))];
  const lsHeaderLen = 6 + firsts.length * 2;
  const covOff = lsHeaderLen;
  let setOff = covOff + coverage.length;
  const lsHead = [...u16(1), ...u16(covOff), ...u16(firsts.length)];
  setBlobs.forEach((b) => { lsHead.push(...u16(setOff)); setOff += b.length; });
  const subtable = lsHead.concat(coverage, ...setBlobs);

  // Lookup + LookupList
  const lookup = [...u16(4), ...u16(0), ...u16(1), ...u16(8), ...subtable];
  const lookupList = [...u16(1), ...u16(4), ...lookup];

  // FeatureList: ccmp, liga (alphabetical), both -> lookup 0
  const feat = [...u16(0), ...u16(1), ...u16(0)];
  const featureList = [...u16(2), ...[..."ccmp"].flatMap((c) => [c.charCodeAt(0)]), ...u16(14),
    ...[..."liga"].flatMap((c) => [c.charCodeAt(0)]), ...u16(14 + feat.length), ...feat, ...feat];

  // ScriptList: DFLT, sinh (sorted by tag: 'DFLT' < 'sinh')
  const langSys = [...u16(0), ...u16(0xffff), ...u16(2), ...u16(0), ...u16(1)];
  const script = [...u16(4), ...u16(0), ...langSys];
  const tag = (s) => [...s].map((c) => c.charCodeAt(0));
  const scriptList = [...u16(2), ...tag('DFLT'), ...u16(14), ...tag('sinh'), ...u16(14 + script.length), ...script, ...script];

  const headerLen = 10;
  const scriptOff = headerLen;
  const featureOff = scriptOff + scriptList.length;
  const lookupOff = featureOff + featureList.length;
  const header = [...u16(1), ...u16(0), ...u16(scriptOff), ...u16(featureOff), ...u16(lookupOff)];
  return Uint8Array.from(header.concat(scriptList, featureList, lookupList));
}

const sum32 = (bytes) => {
  let s = 0;
  for (let i = 0; i < bytes.length; i += 4) {
    s = (s + (((bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) | ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0)) >>> 0;
  }
  return s >>> 0;
};

/** Add (or replace) a table in an existing TrueType/OpenType file; rebuilds directory + checksums. */
export function injectTable(bytes, tag, data) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sfnt = dv.getUint32(0);
  const num = dv.getUint16(4);
  const tables = [];
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    const t = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    const off = dv.getUint32(o + 8), len = dv.getUint32(o + 12);
    if (t !== tag) tables.push({ t, data: bytes.slice(off, off + len) });
  }
  tables.push({ t: tag, data });
  tables.sort((a, b) => (a.t < b.t ? -1 : 1));
  const n = tables.length;
  const log = Math.floor(Math.log2(n));
  const sr = 16 * 2 ** log;
  const out = [...u32(sfnt), ...u16(n), ...u16(sr), ...u16(log), ...u16(n * 16 - sr)];
  let offset = 12 + n * 16;
  const placed = [];
  tables.forEach(({ t, data: d }) => {
    if (t === 'head') { d = d.slice(); d[8] = d[9] = d[10] = d[11] = 0; }
    out.push(...[...t].map((c) => c.charCodeAt(0)), ...u32(sum32(d)), ...u32(offset), ...u32(d.length));
    placed.push({ t, d, offset });
    offset += Math.ceil(d.length / 4) * 4;
  });
  placed.forEach(({ d }) => { for (const b of d) out.push(b); while (out.length % 4) out.push(0); });
  const res = Uint8Array.from(out);
  const h = placed.find((p) => p.t === 'head');
  if (h) {
    const adj = (0xb1b0afba - sum32(res)) >>> 0;
    res.set(u32(adj), h.offset + 8);
  }
  return res;
}
