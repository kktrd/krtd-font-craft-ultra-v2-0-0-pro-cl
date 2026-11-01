// Pure-logic regression tests. Run by GitHub Actions on every push (no local install needed):
//   node tests/logic.test.mjs
import assert from 'node:assert/strict';
import { convertSinglishToSinhala as c } from '../src/utils/transliteration.js';
import { verifyRoundTrip } from '../src/utils/legacyEncoding.js';
import { rdpSimplify } from '../src/utils/rdpSimplifier.js';
import { Trie } from '../src/utils/trieEngine.js';

import { analyzeProject, fixMetrics, validateMetrics, nextBestActions, workflowSteps } from '../src/agent/projectAnalyzer.js';
import { predictNextChars } from '../src/agent/pathPredictor.js';
import { parseIntent } from '../src/agent/intentParser.js';
import { localReply } from '../src/agent/agentBrain.js';
import { sanitizeAction, sanitizeActions } from '../src/agent/actionSchema.js';
import { runAgentAction } from '../src/agent/agentExecutor.js';
import handler from '../api/agent.js';
import { configuredProviders } from '../api/_providers.js';
import { DEFAULT_METRICS } from '../src/utils/glyphData.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('transliteration basics', () => {
  assert.equal(c('kohomada'), 'කොහොමද');
  assert.equal(c('kaalaya'), 'කාලය');
  assert.equal(c('guru'), 'ගුරු');
  assert.equal(c('kriya'), 'ක්‍රිය');
});
t('long o (oo) uses ෝ', () => assert.equal(c('pooja'), 'පෝජ'));
t('ng handling (anusvara / nga)', () => {
  assert.equal(c('lankaawa'.replace('nk', 'ngk')), 'ලංකාව');
  assert.equal(c('sinhala'), 'සිංහල');
  assert.equal(c('dangaa'), 'දඟා');
});
t('capital letters never break words', () => {
  assert.equal(c('Mama Pasal yanawa'), 'මම පසල් යනව');
  assert.equal(c('cinema'), 'චිනෙම');
});
t('legacy round-trip incl. ං and composites', () => {
  for (const w of ['කො', 'කෝ', 'කෙ', 'කාං', 'කිං', 'ක්‍ර', 'ශ්‍රී ලංකා', 'ඉස්කෝලේ']) {
    const r = verifyRoundTrip(w);
    assert.ok(r.matches, `${w} -> ${r.legacy} -> ${r.restored}`);
  }
  assert.ok(!/ං/.test(verifyRoundTrip('කාං').legacy), 'ං must be encoded');
});
t('rdp keeps endpoints, reduces points, handles closed loop', () => {
  const pts = Array.from({ length: 200 }, (_, i) => ({ x: i, y: Math.sin(i / 20) * 50 }));
  const s = rdpSimplify(pts, 1.5);
  assert.ok(s.length < 40 && s[0] === pts[0] && s[s.length - 1] === pts[199]);
  const loop = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
  assert.ok(rdpSimplify(loop, 1.5).length >= 4);
});
t('trie returns highest-frequency words first', () => {
  const tr = new Trie();
  for (let i = 0; i < 60; i++) tr.insert('කඅ' + String.fromCharCode(0x0d9a + (i % 20)) + i, 1);
  tr.insert('කඅඅ-top', 999);
  assert.equal(tr.suggest('කඅ', 3)[0], 'කඅඅ-top');
});

// ── Agent ──────────────────────────────────────────────────────────────────
const stroke = (w = 12, x0 = 150) => [[{ x: x0, y: 150, strokeWidth: w }, { x: x0 + 100, y: 300, strokeWidth: w }]];
const draw = (chars, w) => Object.fromEntries(chars.map((c) => [c, stroke(w)]));
const ANCH = ['ක', 'ම', 'න', 'ර', 'ය'];

t('agent: empty project -> score 0, anchors first', () => {
  const a = analyzeProject({ glyphs: {}, metrics: { ...DEFAULT_METRICS }, selectedChar: 'අ' });
  assert.equal(a.score, 0); assert.equal(a.phase, 'anchors');
  assert.deepEqual(a.predicted.slice(0, 5).map((p) => p.char), ANCH);
  assert.equal(nextBestActions(a)[0].args.char, 'ක');
});
t('agent: phases advance with progress', () => {
  const g = draw(ANCH);
  const a = analyzeProject({ glyphs: g, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක', styleLearned: true });
  assert.equal(a.phase, 'core');
  assert.ok(a.score > 0 && a.score < 15, String(a.score));
  assert.equal(workflowSteps(a).find((x) => x.status === 'current').id, 'core');
});
t('agent: family prediction (ග drawn -> ඝ suggested early)', () => {
  const p = predictNextChars(draw([...ANCH, 'ග']), 'ග', 6).map((x) => x.char);
  assert.ok(p.includes('ඝ'), p.join());
});
t('agent: full perfect project scores 100 / ship phase', () => {
  const all = analyzeProject({ glyphs: {}, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක' });
  const chars = all.coverage.flatMap((c) => c.missing);
  const g = Object.fromEntries(chars.map((c) => [c, stroke(12)[0] && stroke(12)]));
  const a = analyzeProject({ glyphs: g, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක', styleLearned: true, env: { isOnline: true, hasSupabase: true } });
  assert.equal(a.drawnCount, 75); assert.equal(a.score, 100); assert.equal(a.phase, 'ship');
  assert.equal(nextBestActions(a).find((x) => x.id === 'export_ttf').id, 'export_ttf');
});
t('agent: metrics validation + repair', () => {
  const bad = { ascender: 300, capHeight: 100, xHeight: 240, baseline: 380, descender: 370 };
  assert.ok(validateMetrics(bad).length > 0);
  assert.equal(validateMetrics(fixMetrics(bad)).length, 0);
  assert.equal(validateMetrics(fixMetrics({})).length, 0);
  assert.equal(analyzeProject({ glyphs: draw(ANCH), metrics: bad, selectedChar: 'ක' }).phase, 'setup');
});
t('agent: detects out-of-canvas, tiny and inconsistent glyphs', () => {
  const g = draw(['ක', 'ම', 'න', 'ර'], 12);
  g['ය'] = [[{ x: -20, y: 100, strokeWidth: 12 }, { x: 600, y: 200, strokeWidth: 12 }]];
  g['ව'] = [[{ x: 100, y: 100, strokeWidth: 12 }, { x: 105, y: 104, strokeWidth: 12 }]];
  g['ස'] = stroke(40);
  const a = analyzeProject({ glyphs: g, metrics: { ...DEFAULT_METRICS }, selectedChar: 'ක' });
  const ids = a.issues.map((i) => i.id);
  assert.ok(ids.includes('out-of-canvas') && ids.includes('tiny') && ids.includes('weight'), ids.join());
});
t('agent: intent parser (Sinhala / Singlish / English)', () => {
  assert.deepEqual(parseIntent('ක').actions[0], { id: 'select_char', args: { char: 'ක' } });
  assert.equal(parseIntent('draw ක්ෂ').actions[0].args.char, 'ක්ෂ');
  assert.equal(parseIntent('ඊළඟ අකුර?').intent, 'next');
  assert.equal(parseIntent('fix all').intent, 'fixall');
  assert.equal(parseIntent('export ttf').actions[0].id, 'export_ttf');
  assert.equal(parseIntent('text studio').actions[0].args.tab, 'text');
  assert.equal(parseIntent('metrics fix karanna').actions[0].id, 'fix_metrics');
  assert.equal(parseIntent('blah blah').intent, null);
});
t('agent: action whitelist rejects anything unsafe', () => {
  assert.equal(sanitizeAction({ id: 'rm_rf', args: {} }), null);
  assert.equal(sanitizeAction({ id: 'select_char', args: { char: 'Z' } }), null);
  assert.equal(sanitizeAction({ id: 'go_tab', args: { tab: 'evil' } }), null);
  assert.equal(sanitizeAction({ id: 'set_brush', args: { mode: 'uniform', width: 9999 } }).args.width, 40);
  assert.equal(sanitizeAction({ id: '__proto__', args: {} }), null);
  assert.equal(sanitizeActions(Array(20).fill({ id: 'fix_metrics', args: {} })).length, 4);
});
t('agent: local reply understood flag', () => {
  const a = analyzeProject({ glyphs: {}, metrics: { ...DEFAULT_METRICS }, selectedChar: 'අ' });
  assert.equal(localReply('score', a).understood, true);
  assert.equal(localReply('why is the sky blue', a).understood, false);
  assert.equal(localReply('save', a).run[0].id, 'push_cloud');
});

// ── Executor with a fake app API ───────────────────────────────────────────
const asyncT = [];
const ta = (name, fn) => asyncT.push([name, fn]);
const fakeApi = (over = {}) => {
  const st = { glyphs: {}, metrics: { ...DEFAULT_METRICS }, undo: [], sel: null, tab: null, ...over };
  return { st, api: {
    get glyphs() { return st.glyphs; }, get metrics() { return st.metrics; },
    selectChar: (c) => { st.sel = c; }, goTab: (x) => { st.tab = x; },
    setMetrics: (m) => { st.metrics = m; }, setGlyphs: (f) => { st.glyphs = typeof f === 'function' ? f(st.glyphs) : f; },
    setStrokeWidth() {}, setBrushMode() {}, pushUndo: (c, s2) => st.undo.push([c, s2]),
    learnStyle() {}, pushCloud: async () => {}, exportTTF: async () => {}, exportPDF: async () => {}, exportPNG: async () => {}, exportJSON() {}, showHelp() {},
    confirm: async () => st.confirmAnswer ?? true,
  } };
};
ta('executor: select_char + clamp + undo entries', async () => {
  const { st, api } = fakeApi({ glyphs: { 'ය': [[{ x: -20, y: 10 }, { x: 700, y: 20 }]] } });
  assert.equal((await runAgentAction({ id: 'select_char', args: { char: 'ම' } }, api)).ok, true);
  assert.equal(st.sel, 'ම'); assert.equal(st.tab, 'canvas');
  const r = await runAgentAction({ id: 'clamp_glyph', args: { char: '*' } }, api);
  assert.ok(r.ok && st.undo.length === 1);
  assert.deepEqual(st.glyphs['ය'][0].map((p) => p.x), [0, 500]);
});
ta('executor: fix_metrics, risky confirm, copy_glyph safety', async () => {
  const { st, api } = fakeApi({ metrics: { ascender: 400, capHeight: 100, xHeight: 90, baseline: 80, descender: 70 }, glyphs: { 'ග': stroke(), 'ඝ': stroke() } });
  await runAgentAction({ id: 'fix_metrics', args: {} }, api);
  assert.equal(validateMetrics(st.metrics).length, 0);
  st.confirmAnswer = false;
  const before = JSON.stringify(st.metrics);
  assert.equal((await runAgentAction({ id: 'reset_metrics', args: {} }, api)).ok, false);
  assert.equal(JSON.stringify(st.metrics), before);
  assert.equal((await runAgentAction({ id: 'copy_glyph', args: { from: 'ග', to: 'ඝ' } }, api)).ok, false); // never overwrites
  assert.equal((await runAgentAction({ id: 'hack', args: {} }, api)).ok, false);
});

// ── Serverless handler (mocked fetch) ──────────────────────────────────────
const mkRes = () => { const r = { code: 200, body: null, h: {}, setHeader(k, v) { r.h[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const realFetch = globalThis.fetch;
const setEnv = (o) => { for (const k of ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'ZAI_API_KEY', 'AI_PROVIDER', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) delete process.env[k]; Object.assign(process.env, o); };
const ENV = { ANTHROPIC_API_KEY: 'k', VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'a' };
const req = (o = {}) => ({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hi', snapshot: {} }, ...o });

ta('api/agent: 405 / 501 / 401 / 400', async () => {
  setEnv({}); let r = mkRes(); await handler(req({ method: 'GET' }), r); assert.equal(r.code, 405);
  r = mkRes(); await handler(req(), r); assert.equal(r.code, 501); assert.equal(r.body.error, 'llm_not_configured');
  setEnv(ENV);
  r = mkRes(); await handler(req({ headers: {} }), r); assert.equal(r.code, 401);
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  r = mkRes(); await handler(req(), r); assert.equal(r.code, 401);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'user-400' }) });
  r = mkRes(); await handler(req({ body: { message: '   ' } }), r); assert.equal(r.code, 400);
  r = mkRes(); await handler(req({ body: { message: 'x'.repeat(30000) } }), r); assert.equal(r.code, 413);
});
ta('api/agent: success path filters non-whitelisted actions', async () => {
  setEnv(ENV);
  globalThis.fetch = async (url) => url.includes('/auth/v1/user')
    ? ({ ok: true, json: async () => ({ id: 'user-ok' }) })
    : ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'Here you go: {"reply":"ක අඳින්න","actions":[{"id":"select_char","args":{"char":"ක"}},{"id":"delete_all","args":{}},{"id":"go_tab","args":{"tab":"hax"}}]}' }] }) });
  const r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 200); assert.equal(r.body.reply, 'ක අඳින්න');
  assert.deepEqual(r.body.actions, [{ id: 'select_char', args: { char: 'ක' } }]);
});
ta('api/agent: rate limit after 20 calls, upstream errors map cleanly', async () => {
  setEnv(ENV);
  globalThis.fetch = async (url) => url.includes('/auth/v1/user') ? ({ ok: true, json: async () => ({ id: 'user-rl' }) }) : ({ ok: false, status: 500, json: async () => ({}) });
  let last;
  for (let i = 0; i < 21; i++) { last = mkRes(); await handler(req(), last); if (i === 0) assert.equal(last.code, 502); }
  assert.equal(last.code, 429);
});

ta('providers: order, preference, key aliases', async () => {
  assert.deepEqual(configuredProviders({}), []);
  assert.deepEqual(configuredProviders({ ZAI_API_KEY: 'z', ANTHROPIC_API_KEY: 'a', GOOGLE_API_KEY: 'g' }), ['gemini', 'anthropic', 'zai']);
  assert.deepEqual(configuredProviders({ ZAI_API_KEY: 'z', ANTHROPIC_API_KEY: 'a', AI_PROVIDER: 'zai' }), ['zai', 'anthropic']);
  assert.deepEqual(configuredProviders({ ANTHROPIC_API_KEY: 'a', AI_PROVIDER: 'gemini' }), ['anthropic']); // unavailable pref ignored
});
const SBOK = (id) => ({ ok: true, json: async () => ({ id }) });
const GOOD_JSON = '{"reply":"ක අඳින්න, ඉන්පසු ම","actions":[{"id":"select_char","args":{"char":"ක"}}]}';
ta('api/agent: Gemini request shape + Sinhala Unicode reply', async () => {
  setEnv({ ...ENV, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gk', GEMINI_MODEL: 'gemini-x' }); delete process.env.ANTHROPIC_API_KEY;
  let seen;
  globalThis.fetch = async (url, init) => {
    if (url.includes('/auth/v1/user')) return SBOK('u-gem');
    seen = { url, init }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: GOOD_JSON }] } }] }) };
  };
  const r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 200); assert.equal(r.body.provider, 'gemini');
  assert.equal(r.body.reply, 'ක අඳින්න, ඉන්පසු ම');
  assert.ok(seen.url.includes('/models/gemini-x:generateContent'));
  assert.equal(seen.init.headers['x-goog-api-key'], 'gk');
  const sent = JSON.parse(seen.init.body);
  assert.ok(sent.systemInstruction.parts[0].text.includes('KRTD Agent') && sent.generationConfig.responseMimeType === 'application/json');
  assert.deepEqual(r.body.actions, [{ id: 'select_char', args: { char: 'ක' } }]);
});
ta('api/agent: Gemini blocked -> falls back to Z.AI (OpenAI-compatible)', async () => {
  setEnv({ ...ENV, GEMINI_API_KEY: 'gk', ZAI_API_KEY: 'zk' }); delete process.env.ANTHROPIC_API_KEY;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (url.includes('/auth/v1/user')) return SBOK('u-fb');
    calls.push(url);
    if (url.includes('generativelanguage')) return { ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) };
    assert.equal(init.headers.authorization, 'Bearer zk');
    assert.equal(JSON.parse(init.body).model, 'glm-5.2');
    return { ok: true, json: async () => ({ choices: [{ message: { content: GOOD_JSON } }] }) };
  };
  const r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 200); assert.equal(r.body.provider, 'zai');
  assert.ok(calls[0].includes('generativelanguage') && calls[1] === 'https://api.z.ai/api/paas/v4/chat/completions');
});
ta('api/agent: ping lists providers without calling any model; all-fail maps to 502', async () => {
  setEnv({ ...ENV, ZAI_API_KEY: 'zk' }); delete process.env.ANTHROPIC_API_KEY;
  let modelCalls = 0;
  globalThis.fetch = async (url) => { if (url.includes('/auth/v1/user')) return SBOK('u-ping'); modelCalls++; return { ok: false, status: 429, json: async () => ({}) }; };
  let r = mkRes(); await handler(req({ body: { message: '__ping__' } }), r);
  assert.deepEqual(r.body, { ok: true, providers: ['zai'] }); assert.equal(modelCalls, 0);
  r = mkRes(); await handler(req(), r);
  assert.equal(r.code, 502); assert.equal(r.body.error, 'llm_http_429');
});
for (const [name, fn] of asyncT) { try { await fn(); n++; console.log('ok  ' + name); } finally { globalThis.fetch = realFetch; } }

console.log(`\n${n} test groups passed`);
