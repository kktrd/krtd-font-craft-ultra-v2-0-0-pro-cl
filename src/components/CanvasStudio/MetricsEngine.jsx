import React, { useId } from 'react';
import GlyphInspector from './GlyphInspector.jsx';
import CoverageCard from './CoverageCard.jsx';
import QualityCard from './QualityCard.jsx';
import MetaCard from './MetaCard.jsx';
import SpacingCard from './SpacingCard.jsx';
import { Sliders, RotateCcw, UploadCloud, DownloadCloud, Download, Upload, FileType2, History, FileText, Brain } from 'lucide-react';
import { METRIC_LABELS } from '../../utils/glyphData.js';

const METRIC_COLORS = {
  ascender:  '#c084fc',
  capHeight: '#f472b6',
  xHeight:   '#3b82f6',
  baseline:  '#ef4444',
  descender: '#fb923c',
};

export default function MetricsEngine({
  metrics, updateMetric, resetMetrics,
  fontName, setFontName,
  onPushCloud, onPullCloud,
  onExportJSON, onImportJSON,
  onCompileSVG, onCompileTTF, onCompileOTF, onCompileWOFF, onExportTestSheet, onOpenHistory, onExportSpecimenPDF,
  onLearnStyleProfile, styleProfile, savedLabel,
  selectedChar, glyphs, onExportAllPNGs, onSelectChar,
  T,
}) {
  const fontNameId = useId();
  return (
    <div className="space-y-5">
      <div>
        {/* Glyph Inspector — live analytics for the currently selected character */}
      <GlyphInspector selectedChar={selectedChar} glyphs={glyphs} T={T}/>
      <CoverageCard glyphs={glyphs} selectedChar={selectedChar} onSelectChar={onSelectChar} T={T}/>
      <SpacingCard selectedChar={selectedChar} fontName={fontName} metrics={metrics} glyphs={glyphs} T={T}/>
      <MetaCard T={T}/>
      <QualityCard fontName={fontName} metrics={metrics} glyphs={glyphs} onSelectChar={onSelectChar} T={T}/>

      <div className={`flex items-center justify-between pb-2 mb-3 border-b ${T.divider}`}>
          <h2 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
            <Sliders className="w-3.5 h-3.5" aria-hidden="true" /> Metrics Engine
          </h2>
          <button onClick={resetMetrics}
            className={`px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 transition ${T.accentBg}`}>
            <RotateCcw className="w-3 h-3" aria-hidden="true" /> Reset
          </button>
        </div>
        <div className="space-y-3.5">
          {Object.entries(metrics).map(([key, val]) => {
            const color = METRIC_COLORS[key] || T.accentHex;
            const pct   = (val / 500) * 100;
            const label = METRIC_LABELS[key] || key;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="text-[10px] font-bold opacity-60">{label}</span>
                  </div>
                  <span className="text-[10px] font-mono font-black" style={{ color }} aria-hidden="true">{val}px</span>
                </div>
                <input type="range" min="0" max="500" value={val}
                  onChange={e => updateMetric(key, e.target.value)}
                  aria-label={label}
                  aria-valuetext={`${val} pixels`}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    accentColor: color,
                    background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, rgba(148,163,184,0.18) ${pct}%, rgba(148,163,184,0.18) 100%)`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor={fontNameId} className="text-[9px] font-black uppercase tracking-widest block mb-1.5 opacity-70">Font Name</label>
        <input id={fontNameId} type="text" value={fontName}
          onChange={e => setFontName(e.target.value.replace(/\s+/g, '-'))}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="My-Sinhala-Font"
          className={`w-full border px-3 py-2 rounded-xl text-xs font-bold focus:outline-none transition ${T.input}`}
        />
      </div>

      <div className={`pt-4 border-t space-y-2 ${T.divider}`}>
        <h3 className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2 ${T.muted}`}>
          <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" /> Cloud Sync
        </h3>
        <button onClick={onPushCloud}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition shadow-sm">
          <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" /> Push to Supabase
        </button>
        <button onClick={onPullCloud}
          className={`w-full py-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 border transition ${T.btnGhost}`}>
          <DownloadCloud className="w-3.5 h-3.5" aria-hidden="true" /> Pull from Cloud
        </button>
      </div>

      <div className={`pt-4 border-t space-y-2 ${T.divider}`}>
        <h3 className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2 ${T.muted}`}>
          <History className="w-3.5 h-3.5" aria-hidden="true" /> Version History
        </h3>
        <button onClick={onOpenHistory}
          className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.accentBg}`}>
          <History className="w-3.5 h-3.5" aria-hidden="true" /> View Saved Versions
        </button>
      </div>

      <div className={`pt-4 border-t space-y-2 ${T.divider}`}>
        <h3 className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2 ${T.muted}`}>
          <Brain className="w-3.5 h-3.5" aria-hidden="true" /> Style Profile Learning
        </h3>
        <button onClick={onLearnStyleProfile}
          className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.accentBg}`}>
          <Brain className="w-3.5 h-3.5" aria-hidden="true" /> Learn from ක/ම/න/ර/ය
        </button>
        {styleProfile && (
          <p className="text-[8px] opacity-70 text-center px-2">
            Active: width {styleProfile.strokeWidth} · {styleProfile.brushMode} mode — auto-applies to new glyphs
          </p>
        )}
      </div>

      <div className={`pt-4 border-t space-y-2 ${T.divider}`}>
        <h3 className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2 ${T.muted}`}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Local Backup
        </h3>
        <button onClick={onExportJSON}
          className={`w-full py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.btnGhost}`}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export JSON
        </button>
        <button onClick={onImportJSON}
          className={`w-full py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.btnGhost}`}>
          <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Import JSON
        </button>
      </div>

      <div className="space-y-2">
        <button onClick={onCompileTTF}
          className={`w-full py-3.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 uppercase tracking-wider shadow-md transition ${T.btn}`}>
          <FileType2 className="w-4 h-4" aria-hidden="true" /> Build &amp; Export TTF Font
        </button>
        {onCompileOTF && (
          <button onClick={onCompileOTF}
            className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.accentBg}`}>
            <FileType2 className="w-3.5 h-3.5" aria-hidden="true" /> Export OTF (OpenType)
          </button>
        )}
        {onCompileWOFF && (
          <button onClick={onCompileWOFF}
            className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.accentBg}`}>
            <FileType2 className="w-3.5 h-3.5" aria-hidden="true" /> Export WOFF (web font)
          </button>
        )}
        {onExportTestSheet && (
          <button onClick={onExportTestSheet}
            className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.accentBg}`}>
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> Typing Test Sheet (PNG)
          </button>
        )}
        <button onClick={onExportSpecimenPDF}
          className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.accentBg}`}>
          <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Export Specimen Sheet (PDF)
        </button>
        <button onClick={onExportAllPNGs}
          className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.btnGhost}`}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export All PNGs (ZIP)
        </button>
        <button onClick={onCompileSVG}
          className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${T.btnGhost}`}>
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> Export SVG Font (legacy)
        </button>
        <p className="text-[8px] opacity-60 text-center px-2">
          TTF = real TrueType font (works everywhere). OTF = OpenType (CFF) version. WOFF = compressed font for websites. PDF = showcase sheet for clients. SVG = preview outline.
        </p>
      </div>
    </div>
  );
}
