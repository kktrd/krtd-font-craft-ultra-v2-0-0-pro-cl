import React, { useState, useCallback, useRef, useEffect, useId } from 'react';
import {
  CloudLightning, Copy, Check, FileText, Edit3,
  AlignLeft, AlignCenter, AlignRight,
  Minus, Plus, X, Monitor, Smartphone, Cloud, Cpu,
  Type as TypeIcon, ArrowLeftRight, Sparkles, Loader2
} from 'lucide-react';
import { countSinhalaWords } from '../../utils/transliteration.js';
import { globalTrie } from '../../utils/trieEngine.js';
import { fetchCloudSuggestions } from '../../utils/predictionEngine.js';
import { useTransliterationWorker } from '../../hooks/useTransliterationWorker.js';
import { unicodeToLegacy, legacyToUnicode, LEGACY_SCHEME_NAME, LEGACY_SCHEME_DISCLAIMER } from '../../utils/legacyEncoding.js';
import { shortVersionLabel } from '../../utils/versionInfo.js';
import { getDisambiguationSuggestions } from '../../utils/disambiguationEngine.js';
import { FEATURE_FLAGS } from '../../utils/featureFlags.js';
import SuggestionBar from './SuggestionBar.jsx';
import FontTestDrive from './FontTestDrive.jsx';

export default function TextStudioWorkspace({
  T, glyphs = {}, theme = 'light', supabaseUrl = '', anonKey = '',
  // Part 3 — live font preview bridge (props passed down from App.jsx)
  previewReady = false, previewFamily = '', isCompiling = false,
  useLivePreview = false, setUseLivePreview = () => {},
  // Part 3.3 — Quick Reference -> Canvas routing
  onJumpToCanvas = null,
  // Part 3.2 — Metrics -> CSS sync
  suggestedLineHeight = null,
}) {
  const [singlish,    setSinglish]    = useState('');
  const [sinhala,     setSinhala]     = useState('');
  const [copied,      setCopied]      = useState(false);
  const [fontSize,    setFontSize]    = useState(24);
  const [align,       setAlign]       = useState('left');
  const [lineHeight,  setLineHeight]  = useState(1.8);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg,    setShowSugg]    = useState(false);
  const [tierB,       setTierB]       = useState(false);
  const [disambig,    setDisambig]    = useState(null); // {original, alternatives}
  const [encodingView, setEncodingView] = useState('unicode'); // 'unicode' | 'legacy'
  const [legacyInput,  setLegacyInput]  = useState('');

  const singlishId = useId();
  const sinhalaId   = useId();
  const legacyOutId = useId();
  const legacyInId  = useId();

  const cloudTimerRef    = useRef(null);
  const latestConvertId  = useRef(0);
  const { convert } = useTransliterationWorker(); // Part 1.3 — off-thread engine

  const wordCount = countSinhalaWords(sinhala);
  const charCount = sinhala.length;

  // ── Tier A+B prediction pipeline (unchanged from v2.0 PRO) ──────────────
  const runPrediction = useCallback(async (sinhalaText) => {
    const words = sinhalaText.trim().split(/\s+/).filter(Boolean);
    const last  = words[words.length - 1] || '';
    if (!last) { setSuggestions([]); setShowSugg(false); setTierB(false); setDisambig(null); return; }

    const tierA = globalTrie.suggest(last, 6);
    if (tierA.length) { setSuggestions(tierA); setShowSugg(true); }

    // Part 1.2 — heuristic disambiguation chip (non-destructive, additive)
    if (FEATURE_FLAGS.ENABLE_DISAMBIGUATION) {
      const alts = getDisambiguationSuggestions(last);
      setDisambig(alts ? { original: last, alternatives: alts } : null);
    }

    if (!supabaseUrl) return;
    clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(async () => {
      const context = words.slice(-5, -1);
      const tierBResults = await fetchCloudSuggestions(supabaseUrl, anonKey, last, context, 6);
      if (tierBResults.length) {
        const merged = [...new Set([...tierBResults, ...tierA])].slice(0, 6);
        setSuggestions(merged); setShowSugg(true); setTierB(true);
      }
    }, 600);
  }, [supabaseUrl, anonKey]);

  useEffect(() => () => clearTimeout(cloudTimerRef.current), []);

  // ── Part 1.3 — async, off-thread Singlish->Sinhala conversion ───────────
  // Race-safe: a stale worker response from an earlier keystroke is dropped
  // if a newer keystroke has already started a fresher conversion request.
  const handleSinglishChange = useCallback(async (val) => {
    setSinglish(val);
    const myId = ++latestConvertId.current;
    const out = await convert(val);
    if (myId !== latestConvertId.current) return; // stale — newer input superseded this
    setSinhala(out);
    runPrediction(out);
  }, [convert, runPrediction]);

  const applySuggestion = (word) => {
    const words = sinhala.trim().split(/\s+/);
    words[words.length - 1] = word;
    const newOut = words.join(' ') + ' ';
    setSinhala(newOut); setSinglish('');
    setSuggestions([]); setShowSugg(false); setTierB(false); setDisambig(null);
  };

  const applyDisambiguation = (altWord) => {
    const words = sinhala.trim().split(/\s+/);
    words[words.length - 1] = altWord;
    setSinhala(words.join(' ') + ' ');
    setDisambig(null);
  };

  const copyToClipboard = async () => {
    if (!sinhala) return;
    try { await navigator.clipboard.writeText(sinhala); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { /* ignore */ }
  };

  const exportFile = (ext) => {
    if (!sinhala) return;
    const ismd  = ext === 'md';
    const body  = ismd ? `# සිංහල ලේඛනය\n\n${sinhala}\n\n---\n*KRTD Font Craft Ultra ${shortVersionLabel()}*` : sinhala;
    const mime  = ismd ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob  = new Blob([body], { type: mime });
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = `sinhala_output.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const clearAll = () => {
    setSinglish(''); setSinhala(''); setSuggestions([]); setShowSugg(false);
    setTierB(false); setDisambig(null); setLegacyInput('');
  };

  // ── Part 1.1 — Legacy ASCII encoding panel ───────────────────────────────
  const legacyOutput = sinhala ? unicodeToLegacy(sinhala) : '';
  const handleLegacyPaste = (val) => {
    setLegacyInput(val);
    const restored = legacyToUnicode(val);
    setSinhala(restored);
  };

  // ── Effective line-height: manual slider unless user hasn't touched it
  //    and a Metrics-derived suggestion is available (Part 3.2, additive) ──
  const effectiveLineHeight = lineHeight;

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className={`flex items-center justify-between pb-3 border-b mb-4 ${T.divider}`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${T.accentBg}`}><CloudLightning className="w-4 h-4" aria-hidden="true"/></div>
            <div>
              <h2 className="text-sm font-black tracking-tight">Singhela Professional Text Studio</h2>
              <p className="text-[10px] opacity-50 font-medium">
                Worker-Isolated Engine · Trie A · Cloud B · Legacy ASCII · Live Font Preview
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[9px] font-black opacity-60 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Monitor className="w-3 h-3" aria-hidden="true"/> PC</span>
            <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" aria-hidden="true"/> Mobile</span>
          </div>
        </div>

        {/* Typography toolbar */}
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-xl border mb-4 text-[10px] font-black ${T.sub}`}>
          <span className="opacity-70">TYPOGRAPHY:</span>

          <div className="flex items-center gap-1.5">
            <span className="opacity-70" id="font-size-label">Sz:</span>
            <button onClick={() => setFontSize(s => Math.max(16, s-2))} aria-label="Decrease font size"><Minus className="w-3.5 h-3.5 opacity-50" aria-hidden="true"/></button>
            <span className="font-mono w-7 text-center" aria-live="polite" aria-labelledby="font-size-label">{fontSize}px</span>
            <button onClick={() => setFontSize(s => Math.min(40, s+2))} aria-label="Increase font size"><Plus  className="w-3.5 h-3.5 opacity-50" aria-hidden="true"/></button>
          </div>

          <div className={`flex p-0.5 rounded-lg border ${T.sub}`} role="group" aria-label="Text alignment">
            {[['left','Align left',<AlignLeft className="w-3.5 h-3.5" aria-hidden="true"/>],['center','Align center',<AlignCenter className="w-3.5 h-3.5" aria-hidden="true"/>],['right','Align right',<AlignRight className="w-3.5 h-3.5" aria-hidden="true"/>]].map(([a,label,icon])=>(
              <button key={a} onClick={()=>setAlign(a)} aria-label={label} aria-pressed={align===a}
                className={`p-1.5 rounded transition ${align===a?T.btn:'opacity-35 hover:opacity-60'}`}>{icon}</button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="opacity-70" id="lh-label">LH:</span>
            <button onClick={() => setLineHeight(h => Math.max(1.2, +(h-0.2).toFixed(1)))} aria-label="Decrease line height"><Minus className="w-3.5 h-3.5 opacity-50" aria-hidden="true"/></button>
            <span className="font-mono w-7 text-center" aria-live="polite" aria-labelledby="lh-label">{lineHeight}</span>
            <button onClick={() => setLineHeight(h => Math.min(3.0, +(h+0.2).toFixed(1)))} aria-label="Increase line height"><Plus  className="w-3.5 h-3.5 opacity-50" aria-hidden="true"/></button>
            {/* Part 3.2 — sync line-height from Canvas Metrics Engine */}
            {FEATURE_FLAGS.ENABLE_METRICS_CSS_BINDING && suggestedLineHeight && (
              <button
                onClick={() => setLineHeight(suggestedLineHeight)}
                title="Sync line-height from Canvas Metrics sliders"
                aria-label="Sync line-height from Canvas Metrics sliders"
                className={`ml-1 px-1.5 py-0.5 rounded border text-[8px] flex items-center gap-0.5 ${T.accentBg}`}
              >
                <ArrowLeftRight className="w-2.5 h-2.5" aria-hidden="true"/> Sync
              </button>
            )}
          </div>

          {tierB && (
            <span className="flex items-center gap-1 text-emerald-400" role="status">
              <Cloud className="w-3 h-3" aria-hidden="true"/> Cloud B Active
            </span>
          )}

          <div className="ml-auto flex items-center gap-3 opacity-50">
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>
            <button onClick={clearAll} className="text-red-500 font-bold hover:text-red-600">Clear</button>
          </div>
        </div>

        {/* Live Font Preview toggle — Part 3.1 */}
        {FEATURE_FLAGS.ENABLE_LIVE_FONT_PREVIEW && (
          <div className={`flex items-center gap-3 p-2.5 rounded-xl border mb-4 ${previewReady ? T.accentBg : T.sub}`}>
            {isCompiling
              ? <Loader2 className="w-4 h-4 flex-shrink-0 motion-safe:animate-spin" aria-hidden="true"/>
              : <TypeIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true"/>}
            <span className="text-[10px] font-bold flex-1" role="status">
              {previewReady
                ? 'Live Font Preview ready — render output using YOUR drawn glyphs'
                : 'Draw glyphs in Canvas Studio to enable Live Font Preview'}
            </span>
            <button
              onClick={() => setUseLivePreview(!useLivePreview)}
              disabled={!previewReady}
              aria-pressed={useLivePreview}
              aria-label={`Live Font Preview ${useLivePreview ? 'on' : 'off'}`}
              className={`text-[9px] font-black px-3 py-1.5 rounded-lg flex-shrink-0 transition disabled:opacity-60 ${useLivePreview ? T.btn : T.btnGhost}`}
            >
              {useLivePreview ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        {/* I/O panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className={`p-4 rounded-xl border flex flex-col gap-2 ${T.sub}`}>
            <label htmlFor={singlishId} className="text-[9px] font-black opacity-70 uppercase tracking-widest">Singlish Input</label>
            <textarea
              id={singlishId}
              rows={6} value={singlish}
              onChange={e => handleSinglishChange(e.target.value)}
              placeholder={"mama kolambata yanawa\nkru → කෘ  |  dra → ද්‍ර  |  shree → ශ්‍රී\ngnya → ඥ  |  mmb → ඹ  |  nng → ඟ"}
              autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
              className={`w-full text-sm font-bold p-3 rounded-xl focus:outline-none border transition resize-none leading-relaxed ${T.input}`}
            />
            <div className="text-[9px] opacity-70 flex items-center gap-1">
              <Cpu className="w-3 h-3" aria-hidden="true"/> Off-thread Web Worker engine — large pastes won't freeze the UI.
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col gap-2 ${T.sub}`}>
            <label htmlFor={sinhalaId} className="text-[9px] font-black opacity-70 uppercase tracking-widest">
              Sinhala Output & Live Editor
            </label>

            {showSugg && (
              <SuggestionBar suggestions={suggestions} onSelect={applySuggestion} onDismiss={() => { setShowSugg(false); setTierB(false); }} T={T}/>
            )}

            {/* Part 1.2 — disambiguation chip */}
            {disambig && (
              <div className={`flex flex-wrap items-center gap-1.5 p-2 rounded-xl border ${T.sub}`} role="group" aria-label="Spelling alternatives">
                <Sparkles className="w-3 h-3 opacity-70 flex-shrink-0" aria-hidden="true"/>
                <span className="text-[9px] opacity-70 flex-shrink-0">Did you mean:</span>
                {disambig.alternatives.map((alt) => (
                  <button key={alt.word} onClick={() => applyDisambiguation(alt.word)} title={alt.hint} aria-label={`${alt.word} — ${alt.hint}`}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition font-sinhala ${T.accentBg}`}>
                    {alt.word}
                  </button>
                ))}
                <button onClick={() => setDisambig(null)} aria-label="Dismiss spelling suggestions" className="ml-auto opacity-60 hover:opacity-90"><X className="w-3 h-3" aria-hidden="true"/></button>
              </div>
            )}

            <textarea
              id={sinhalaId}
              rows={6} value={sinhala}
              onChange={e => { setSinhala(e.target.value); runPrediction(e.target.value); }}
              placeholder="සිංහල output..."
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className={`w-full font-black p-3 rounded-xl focus:outline-none border transition resize-none ${T.input} ${T.accent} ${!useLivePreview ? 'font-sinhala' : ''}`}
              style={{
                fontSize: `${fontSize}px`, textAlign: align, lineHeight: effectiveLineHeight, direction: 'ltr',
                fontFamily: (useLivePreview && previewReady) ? `'${previewFamily}', 'Noto Sans Sinhala', serif` : undefined,
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button onClick={copyToClipboard} disabled={!sinhala} aria-label={copied ? 'Copied to clipboard' : 'Copy Sinhala text to clipboard'}
                className={`flex-1 min-w-[80px] py-2.5 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-60 ${copied?'bg-emerald-600 text-white':T.btn}`}>
                {copied?<Check className="w-3.5 h-3.5" aria-hidden="true"/>:<Copy className="w-3.5 h-3.5" aria-hidden="true"/>}
                <span aria-live="polite">{copied?'Copied!':'Copy'}</span>
              </button>
              <button onClick={() => exportFile('txt')} disabled={!sinhala} aria-label="Export as plain text file"
                className={`flex-1 min-w-[60px] py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition disabled:opacity-60 ${T.btnGhost}`}>
                <FileText className="w-3.5 h-3.5" aria-hidden="true"/> .txt
              </button>
              <button onClick={() => exportFile('md')} disabled={!sinhala} aria-label="Export as Markdown file"
                className={`flex-1 min-w-[60px] py-2.5 text-[10px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition disabled:opacity-60 ${T.btnGhost}`}>
                <FileText className="w-3.5 h-3.5" aria-hidden="true"/> .md
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      {sinhala && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-3">Live Preview</h3>
          <div className={`p-5 rounded-xl border min-h-[60px] ${!useLivePreview ? 'font-sinhala' : ''} ${T.sub} ${T.accent}`}
            style={{
              fontSize: `${fontSize}px`, textAlign: align, lineHeight: effectiveLineHeight, direction: 'ltr',
              fontFamily: (useLivePreview && previewReady) ? `'${previewFamily}', 'Noto Sans Sinhala', serif` : undefined,
            }}>
            {sinhala}
          </div>
        </div>
      )}

      {/* Vector font test-drive */}
      <FontTestDrive text={sinhala} glyphs={glyphs} theme={theme} T={T}/>

      {/* Part 1.1 — Legacy ASCII Encoding Panel */}
      {FEATURE_FLAGS.ENABLE_LEGACY_ENCODING && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[9px] font-black uppercase tracking-widest opacity-70 flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true"/> Legacy ASCII Encoding — {LEGACY_SCHEME_NAME}
            </h3>
            <div className={`flex p-0.5 rounded-lg border text-[9px] font-black ${T.sub}`} role="group" aria-label="Encoding view">
              {['unicode', 'legacy'].map(v => (
                <button key={v} onClick={() => setEncodingView(v)} aria-pressed={encodingView===v}
                  className={`px-2.5 py-1 rounded capitalize transition ${encodingView===v ? T.btn : 'opacity-70'}`}>{v}</button>
              ))}
            </div>
          </div>

          <p className="text-[9px] opacity-60 mb-3 leading-relaxed">{LEGACY_SCHEME_DISCLAIMER}</p>

          {encodingView === 'legacy' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`p-3 rounded-xl border ${T.sub}`}>
                <label htmlFor={legacyOutId} className="text-[9px] font-black opacity-70 uppercase tracking-widest block mb-1.5">
                  Unicode → Legacy (auto, from output above)
                </label>
                <textarea id={legacyOutId} readOnly rows={3} value={legacyOutput}
                  className={`w-full text-sm font-mono p-2.5 rounded-lg border resize-none ${T.input}`}/>
              </div>
              <div className={`p-3 rounded-xl border ${T.sub}`}>
                <label htmlFor={legacyInId} className="text-[9px] font-black opacity-70 uppercase tracking-widest block mb-1.5">
                  Legacy → Unicode (paste legacy text here)
                </label>
                <textarea id={legacyInId} rows={3} value={legacyInput}
                  onChange={e => handleLegacyPaste(e.target.value)}
                  placeholder="Paste KRTD-Legacy-Reference encoded text…"
                  className={`w-full text-sm font-mono p-2.5 rounded-lg border resize-none ${T.input}`}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Singlish cheat-sheet — Part 3.3: click jumps to Canvas Studio */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[9px] font-black uppercase tracking-widest opacity-70">Quick Reference</h3>
          {FEATURE_FLAGS.ENABLE_QUICK_REF_ROUTING && onJumpToCanvas && (
            <span className="text-[9px] opacity-60">Click any card to edit in Canvas Studio →</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[['aa','ආ'],['ae','ඇ'],['ii','ඊ'],['uu','ඌ'],['ee','ඒ'],['oo','ඕ'],
            ['ai','ඓ'],['au','ඖ'],['ksh','ක්ෂ'],['sh','ශ'],['th','ත'],['dh','ද'],
            ['kru','කෘ'],['dra','ද්‍ර'],['shree','ශ්‍රී'],['gnya','ඥ'],['mmb','ඹ'],['nng','ඟ'],
          ].map(([k,v])=>(
            <button key={k}
              onClick={() => FEATURE_FLAGS.ENABLE_QUICK_REF_ROUTING && onJumpToCanvas?.(v)}
              aria-label={`${k} maps to ${v}.${onJumpToCanvas ? ' Click to edit in Canvas Studio.' : ''}`}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition text-left ${T.sub} ${onJumpToCanvas ? 'hover:scale-[1.03] cursor-pointer' : ''}`}>
              <span className="font-mono font-bold opacity-60" aria-hidden="true">{k}</span>
              <span className="opacity-25" aria-hidden="true">→</span>
              <span className={`font-sinhala font-black ${T.accent}`} aria-hidden="true">{v}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
