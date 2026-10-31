/**
 * KRTD Trie Prediction Engine v1.0
 * Fast client-side prefix-based Sinhala word suggestion.
 */

class TrieNode {
  constructor() {
    this.children = Object.create(null);
    this.isEnd = false;
    this.word = null;
    this.freq = 0; // frequency weight for ranking
  }
}

export class Trie {
  constructor() { this.root = new TrieNode(); }

  insert(word, freq = 1) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) node.children[ch] = new TrieNode();
      node = node.children[ch];
    }
    node.isEnd = true;
    node.word = word;
    node.freq = (node.freq || 0) + freq;
  }

  suggest(prefix, limit = 6) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch]) return [];
      node = node.children[ch];
    }
    const results = [];
    const dfs = (n) => {
      if (results.length >= 500) return; // high safety cap; ranking happens after full collection
      if (n.isEnd) results.push({ word: n.word, freq: n.freq });
      for (const ch in n.children) dfs(n.children[ch]);
    };
    dfs(node);
    return results
      .sort((a, b) => b.freq - a.freq)
      .slice(0, limit)
      .map(r => r.word);
  }
}

// ── Pre-built dictionary ────────────────────────────────────────────────────
export const SINHALA_DICTIONARY = [
  // Common greetings & basics
  ['ආයුබෝවන්', 10], ['ස්තූතියි', 9], ['ඔව්', 8], ['නෑ', 8], ['හරි', 7],
  ['කරන්න', 9], ['යන්න', 8], ['එන්න', 8], ['කරුණාකර', 7], ['සමාවෙන්න', 6],
  // People & family
  ['අම්මා', 8], ['තාත්තා', 8], ['දරුවා', 7], ['ළමයා', 7], ['ගෙදර', 8],
  ['ගෙදරට', 7], ['ගෙදරින්', 6], ['මිනිහා', 6], ['ගෑනිය', 6], ['නංගී', 7],
  ['අයියා', 7], ['අක්කා', 7], ['මල්ලී', 7], ['දෙමාපිය', 6], ['ගුරුවරයා', 7],
  ['ශිෂ්‍යයා', 6], ['ජනතාව', 7], ['රජය', 6],
  // Nature & place
  ['ගම', 8], ['නගරය', 7], ['ගස', 8], ['ගංගා', 7], ['කඳු', 7], ['මුහුද', 7],
  ['ආකාශය', 6], ['සෙවනැල්ල', 5], ['කොළඹ', 8], ['ශ්‍රී', 9], ['ලංකාව', 9],
  // Abstract / common verbs
  ['ජීවිතය', 7], ['ආදරය', 8], ['සතුට', 8], ['දුකය', 7], ['ශාන්තිය', 6],
  ['නිදහස', 7], ['ශක්තිය', 6], ['ඥානය', 6], ['සිංහල', 9], ['දෙමළ', 7],
  ['ඉංගිරිසි', 6], ['පාසල', 8], ['රෝහල', 7], ['ව්‍යාපෘතිය', 5],
  ['කාර්යාලය', 6], ['ගොඩනැඟිල්ල', 5], ['හෙළ', 6], ['ලොව', 7],
  // Days
  ['ඉරිදා', 6], ['සඳුදා', 6], ['අඟහරුවාදා', 5], ['බදාදා', 6],
  ['බ්‍රහස්පතින්දා', 4], ['සිකුරාදා', 5], ['සෙනසුරාදා', 5],
  // Numbers
  ['එකය', 5], ['දෙකය', 5], ['තුනය', 5], ['හතරය', 5], ['පහය', 5],
];

// Build and export singleton trie
export const globalTrie = new Trie();
SINHALA_DICTIONARY.forEach(([word, freq]) => globalTrie.insert(word, freq));
