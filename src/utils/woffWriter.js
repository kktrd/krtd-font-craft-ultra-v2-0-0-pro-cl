// WOFF 1.0 packaging (web font). Pure; uses the standard CompressionStream('deflate') (zlib format).

const u16 = (v) => [(v >> 8) & 255, v & 255];
const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

async function deflate(data) {
  const cs = new CompressionStream('deflate');
  const w = cs.writable.getWriter();
  w.write(data); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

/** Wrap a TrueType/OpenType file (Uint8Array) into WOFF 1.0. */
export async function toWOFF(sfnt) {
  const dv = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const flavor = dv.getUint32(0);
  const num = dv.getUint16(4);
  const tables = [];
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    const tag = [sfnt[o], sfnt[o + 1], sfnt[o + 2], sfnt[o + 3]];
    const sum = dv.getUint32(o + 4), off = dv.getUint32(o + 8), len = dv.getUint32(o + 12);
    const orig = sfnt.slice(off, off + len);
    const comp = await deflate(orig);
    tables.push({ tag, sum, orig, data: comp.length < orig.length ? comp : orig, origLen: len });
  }
  tables.sort((a, b) => String.fromCharCode(...a.tag) < String.fromCharCode(...b.tag) ? -1 : 1);
  let offset = 44 + num * 20;
  const dir = [];
  const body = [];
  let totalSfnt = 12 + num * 16;
  tables.forEach((t) => {
    dir.push(...t.tag, ...u32(offset), ...u32(t.data.length), ...u32(t.origLen), ...u32(t.sum));
    body.push(t.data);
    const pad = (4 - (t.data.length % 4)) % 4;
    if (pad) body.push(new Uint8Array(pad));
    offset += t.data.length + pad;
    totalSfnt += Math.ceil(t.origLen / 4) * 4;
  });
  const head = [0x77, 0x4f, 0x46, 0x46, ...u32(flavor), ...u32(offset), ...u16(num), ...u16(0),
    ...u32(totalSfnt), ...u16(1), ...u16(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0)];
  const out = new Uint8Array(offset);
  out.set(head, 0); out.set(dir, 44);
  let p = 44 + num * 20;
  body.forEach((b) => { out.set(b, p); p += b.length; });
  return out;
}
