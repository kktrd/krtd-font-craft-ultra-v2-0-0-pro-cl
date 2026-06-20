import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  CloudLightning, Copy, Check, FileText, Edit3,
  AlignLeft, AlignCenter, AlignRight,
  Minus, Plus, X, Monitor, Smartphone, Cloud
} from 'lucide-react';
import { convertSinglishToSinhala, countSinhalaWords } from '../../utils/transliteration.js';
import { globalTrie } from '../../utils/trieEngine.js';
import { fetchCloudSuggestions } from '../../utils/predictionEngine.js';
import SuggestionBar from './SuggestionBar.jsx';
import FontTestDrive from './FontTestDrive.jsx';

export default function TextStudioWorkspace({ T, glyphs = {}, theme = 'light', supabaseUrl = '', anonKey = '' }) {
  const [singlish,    setSinglish]    = useState('');
  const [sinhala,     setSinhala]     = useState('');
  const [copied,      setCopied]      = useState(false);
  const [fontSize,    setFontSize]    = useState(24);
  const [align,       setAlign]       = useState('left');
  const [lineHeight,  setLineHeight]  = useState(1.8);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg,    setShowSugg]    = useState(false);
  const [tierB,       setTierB]       = useState(false); // Tier B cloud active indicator
  const cloudTimerRef = useRef(null);

  const wordCount = countSinhalaWords(sinhala);
  const charCount = sinhala.length;

  // ── Tier A+B prediction pipeline ─────────────────────────────────────────
  const runPrediction = useCallback(async (sinhalaText) => {
    const words  = sinhalaText.trim().split(/\s+/).filter(Boolean);
    const last   = words[words.length - 1] || '';
    if (!last) { setSuggestions([]); setShowSugg(false); setTierB(false); return; }

    // Tier A — instant local trie
    const tierA = globalTrie.suggest(last, 6);
    if (tierA.length) { setSuggestions(tierA); setShowSugg(true); }

    // Tier B — cloud, debounced 600 ms
    if (!supabaseUrl) return;
    clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(async () => {
      const context = words.slice(-5, -1);
      const tierBResults = await fetchCloudSuggestions(supabaseUrl, anonKey, last, context, 6);
      if (tierBResults.length) {
        // Merge: Tier B first, then Tier A extras, deduplicate
        const merged = [...new Set([...tierBResults, ...tierA])].slice(0, 6);
        setSuggestions(merged); setShowSugg(true); setTierB(true);
      }
    }, 600);
  }, [supabaseUrl, anonKey]);

  useEffect(() => () => clearTimeout(cloudTimerRef.current), []);

  const handleSinglishChange = useCallback((val) => {
    setSinglish(val);
    const out = convertSinglishToSinhala(val);
    setSinhala(out);
    runPrediction(out);
  }, [runPrediction]);

  const applySuggestion = (word) => {
    const words = sinhala.trim().split(/\s+/);
    words[words.length - 1] = word;
    const newOut = words.join(' ') + ' ';
    setSinhala(newOut); setSinglish('');
    setSuggestions([]); setShowSugg(false); setTierB(false);
  };

  const copyToClipboard = async () => {
    if (!sinhala) return;
    try { await navigator.clipboard.writeText(sinhala); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { /* ignore */ }
  };

  const exportFile = (ext) => {
    if (!sinhala) return;
    const ismd  = ext === 'md';
    const body  = ismd ? `# සිංහල ලේඛනය\n\n${sinhala}\n\n---\n*KRTD Font Craft Ultra v2.0.0 PRO*` : sinhala;
    const mime  = ismd ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob  = new Blob([body], { type: mime });
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = `sinhala_output.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const clearAll = () => {
    setSinglish(''); setSinhala(''); setSuggestions([]); setShowSugg(false); setTierB(false);
  };

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className={`flex items-center justify-between pb-3 border-b mb-4 ${T.divider}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${T.accentBg}`}><CloudLightning className="w-4 h-4"/></div>
            <div>
              <h2 className="text-sm font-black tracking-tight">Singhela Professional Text Studio</h2>
              <p className="text-[10px] opacity-50 font-medium">
                Trie A · Cloud B Prediction · .txt .md Export · Vector Test-Drive
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[9px] font-black opacity-30 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Monitor className="w-3 h-3"/> PC</span>
            <span className="flex items-center gap-1"><Smartphone className="w-3 h-3"/> Mobile</span>
          </div>
        </div>

        {/* Typography toolbar */}
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-xl border mb-4 text-[10px] font-black ${T.sub}`}>
          <span className="opacity-40">TYPOGRAPHY:</span>

          {/* Font size */}
          <div className="flex items-center gap-1.5">
            <span className="opacity-40">Sz:</span>
            <button onClick={() => setFontSize(s => Math.max(16, s-2))}><Minus className="w-3.5 h-3.5 opacity-50"/></button>
            <span className="font-mono w-7 text-center">{fontSize}px</span>
            <button onClick={() => setFontSize(s => Math.min(40, s+2))}><Plus  className="w-3.5 h-3.5 opacity-50"/></button>
          </div>

          {/* Alignment */}
          <div className={`flex p-0.5 rounded-lg border ${T.sub}`}>
            {[['left',<AlignLeft className="w-3.5 h-3.5"/>],['center',<AlignCenter className="w-3.5 h-3.5"/>],['right',<AlignRight className="w-3.5 h-3.5"/>]].map(([a,icon])=>(
              <button key={a} onClick={()=>setAlign(a)}
                className={`p-1.5 rounded transition ${align===a?T.btn:'opacity-35 hover:opacity-60'}`}>{icon}</button>
            ))}
          </div>

          {/* Line height */}
          <div className="flex items-center gap-1.5">
            <span className="opacity-40">LH:</span>
            <button onClick={() => setLineHeight(h => Math.max(1.2, +(h-0.2).toFixed(1)))}><Minus className="w-3.5 h-3.5 opacity-50"/></button>
            <span className="font-mono w-7 text-center">{lineHeight}</span>
            <button onClick={() => setLineHeight(h => Math.min(3.0, +(h+0.2).toFixed(1)))}><Plus  className="w-3.5 h-3.5 opacity-50"/></button>
          </div>

          {/* Cloud B indicator */}
          {tierB && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Cloud className="w-3 h-3"/> Cloud B Active
            </span>
          )}

          {/* Stats + clear */}
          <div className="ml-auto flex items-center gap-3 opacity-50">
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>
            <button onClick={clearAll} className="text-red-500 font-bold hover:text-red-600">Clear</button>
          </div>
        </div>

        {/* I/O panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Singlish Input */}
          <div className={`p-4 rounded-xl border flex flex-col gap-2 ${T.sub}`}>
            <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">Singlish Input</label>
            <textarea
              rows={6} value={singlish}
              onChange={e => handleSinglishChange(e.target.value)}
              placeholder={"mama kolambata yanawa\nkru → කෘ  |  dra → ද්‍ර  |  shree → ශ්‍රී\ngnya → ඥ  |  mmb → ඹ  |  nng → ඟ"}
              autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
              className={`w-full text-sm font-bold p-3 rounded-xl focus:outline-none border transition resize-none leading-relaxed ${T.input}`}
            />
            <div className="text-[9px] opacity-40 flex items-center gap-1">
              <Edit3 className="w-3 h-3"/> Ligatures tokenized at runtime.
            </div>
          </div>

          {/* Sinhala Output */}
          <div className={`p-4 rounded-xl border flex flex-col gap-2 ${T.sub}`}>
            <label className="text-[9px] font-black opacity-40 uppercase tracking-widest">
              Sinhala Output & Live Editor
            </label>

            {showSugg && (
              <SuggestionBar suggestions={suggestions} onSelect={applySuggestion} onDismiss={() => { setShowSugg(false); setTierB(false); }} T={T}/>
            )}

            <textarea
              rows={6} value={sinhala}
              onChange={e => { setSinhala(e.target.value); runPrediction(e.target.value); }}
              placeholder="සිංහල output..."
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className={`w-full font-sinhala font-black p-3 rounded-xl focus:outline-none border transition resize-none ${T.input} ${T.accent}`}
              style={{ fontSize:`${fontSize}px`, textAlign:align, lineHeight, direction:'ltr' }}
            />

            {/* Exports */}
            <div className="flex flex-wrap gap-2">
              <button onClick={copyToClipboard} disabled={!sinhala}
                className={`flex-1 min-w-[80px] py-2.5 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-30 ${copied?'bg-emerald-600 text-white':T.btn}`}>
                {copied?<Check className="w-3.5 h-3.5"/>:<Copy className="w-3.5 h-3.5"/>}
                {copied?'Copied!':'Copy'}
              </button>
              <button onClick={() => exportFile('txt')} disabled={!sinhala}
                className={`flex-1 min-w-[60px] py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition disabled:opacity-30 ${T.btnGhost}`}>
                <FileText className="w-3.5 h-3.5"/> .txt
              </button>
              <button onClick={() => exportFile('md')} disabled={!sinhala}
                className={`flex-1 min-w-[60px] py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition disabled:opacity-30 ${T.btnGhost}`}>
                <FileText className="w-3.5 h-3.5"/> .md
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      {sinhala && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-3">Live Preview</h3>
          <div className={`p-5 rounded-xl border min-h-[60px] font-sinhala ${T.sub} ${T.accent}`}
            style={{ fontSize:`${fontSize}px`, textAlign:align, lineHeight, direction:'ltr' }}>
            {sinhala}
          </div>
        </div>
      )}

      {/* Vector font test-drive */}
      <FontTestDrive text={sinhala} glyphs={glyphs} theme={theme} T={T}/>

      {/* Singlish cheat-sheet */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <h3 className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-3">Quick Reference</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[['aa','ආ'],['ae','ඇ'],['ii','ඊ'],['uu','ඌ'],['ee','ඒ'],['oo','ඕ'],
            ['ai','ඓ'],['au','ඖ'],['ksh','ක්ෂ'],['sh','ශ'],['th','ත'],['dh','ද'],
            ['kru','කෘ'],['dra','ද්‍ර'],['shree','ශ්‍රී'],['gnya','ඥ'],['mmb','ඹ'],['nng','ඟ'],
          ].map(([k,v])=>(
            <div key={k} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs ${T.sub}`}>
              <span className="font-mono font-bold opacity-60">{k}</span>
              <span className="opacity-25">→</span>
              <span className={`font-sinhala font-black ${T.accent}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
