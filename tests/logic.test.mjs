// Pure-logic regression tests. Run by GitHub Actions on every push (no local install needed):
//   node tests/logic.test.mjs
import assert from 'node:assert/strict';
import { convertSinglishToSinhala as c } from '../src/utils/transliteration.js';
import { verifyRoundTrip } from '../src/utils/legacyEncoding.js';
import { rdpSimplify } from '../src/utils/rdpSimplifier.js';
import { Trie } from '../src/utils/trieEngine.js';

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
console.log(`\n${n} test groups passed`);
