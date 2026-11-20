import React, { useId } from 'react';
import GlyphInspector from './GlyphInspector.jsx';
import CoverageCard from './CoverageCard.jsx';
import QualityCard from './QualityCard.jsx';
import MetaCard from './MetaCard.jsx';
import SpacingCard from './SpacingCard.jsx';
import TransformCard from './TransformCard.jsx';
import OptimizeCard from './OptimizeCard.jsx';
import { Sliders, RotateCcw, UploadCloud, DownloadCloud, Download, Upload, FileType2, History, FileText, Brain } from 'lucide-react';
import { METRIC_LABELS } from '../../utils/glyphData.js';
import Collapsible from '../Shared/Collapsible.jsx';

const METRIC_COLORS = {
  ascender:  '#c084fc',
  capHeight: '#f472b6',
  xHeight:   '#3b82f6',
  baseline:  '#ef4444',
  descender: '#fb923c',
};

const Btn = ({ onClick, icon: Icon, children, cls }) => (
  <button type="button" onClick={onClick}
    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${cls}`}>
    <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {children}
  </button>
);

/**
 * Right-hand tool panel. Export actions stay pinned at the top; everything else is a
 * collapsible section (click / tap to open, again to close) so the panel needs very little scrolling.
 */
export default function MetricsEngine({
  metrics, updateMetric, resetMetrics,
  fontName, setFontName,
  onPushCloud, onPullCloud,
  onExportJSON, onImportJSON,
  onCompileSVG, onCompileTTF, onCompileOTF, onCompileWOFF, onExportTestSheet, onOpenHistory, onExportSpecimenPDF,
  onLearnStyleProfile, styleProfile, savedLabel,
  selectedChar, glyphs, setGlyphs, toast, onExportFEA, onExportAllPNGs, onSelectChar,
  T,
}) {
  const fontNameId = useId();
  return (
    <div className="space-y-2.5">
      <div className="space-y-2">
        <button type="button" onClick={onCompileTTF}
          className={`w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 uppercase tracking-wider shadow-md transition ${T.btn}`}>
          <FileType2 className="w-4 h-4" aria-hidden="true" /> Export TTF Font
        </button>
        <div className="grid grid-cols-2 gap-2">
          {onCompileOTF && <Btn onClick={onCompileOTF} icon={FileType2} cls={T.accentBg}>OTF</Btn>}
          {onCompileWOFF && <Btn onClick={onCompileWOFF} icon={FileType2} cls={T.accentBg}>WOFF</Btn>}
        </div>
      </div>

      <Collapsible id="metrics" title="METRICS ENGINE" si="රේඛා" icon={Sliders} defaultOpen T={T}>
        <div className="flex justify-end mb-2">
          <button type="button" onClick={resetMetrics}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${T.accentBg}`}>
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset
          </button>
        </div>
        <div className="space-y-3.5">
          {Object.entries(metrics).map(([key, val]) => {
            const color = METRIC_COLORS[key] || T.accentHex;
            const pct   = (val / 500) * 100;
            const label = METRIC_LABELS[key] || key;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                    <span className="text-xs font-semibold opacity-80">{label}</span>
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color }} aria-hidden="true">{val}px</span>
                </div>
                <input type="range" min="0" max="500" value={val}
                  onChange={e => updateMetric(key, e.target.value)}
                  aria-label={label} aria-valuetext={`${val} pixels`}
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
      </Collapsible>

      <TransformCard T={T} glyphs={glyphs} setGlyphs={setGlyphs} selectedChar={selectedChar} baseline={metrics.baseline} toast={toast}/>
      <OptimizeCard T={T} glyphs={glyphs} setGlyphs={setGlyphs} selectedChar={selectedChar} toast={toast}/>
      <SpacingCard selectedChar={selectedChar} fontName={fontName} metrics={metrics} glyphs={glyphs} T={T}/>
      <GlyphInspector selectedChar={selectedChar} glyphs={glyphs} T={T}/>
      <CoverageCard glyphs={glyphs} selectedChar={selectedChar} onSelectChar={onSelectChar} T={T}/>
      <QualityCard fontName={fontName} metrics={metrics} glyphs={glyphs} onSelectChar={onSelectChar} T={T}/>
      <MetaCard T={T}/>

      <Collapsible id="project" title="PROJECT" si="ව්‍යාපෘතිය" icon={Brain} summary={fontName} T={T}>
        <div className="space-y-3">
          <div>
            <label htmlFor={fontNameId} className="text-xs font-semibold block mb-1.5 opacity-80">Font Name</label>
            <input id={fontNameId} type="text" value={fontName}
              onChange={e => setFontName(e.target.value.replace(/\s+/g, '-'))}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder="My-Sinhala-Font"
              className={`w-full border px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none transition ${T.input}`}
            />
          </div>
          <Btn onClick={onLearnStyleProfile} icon={Brain} cls={T.accentBg}>Learn style from ක/ම/න/ර/ය</Btn>
          {styleProfile && (
            <p className="text-[11px] opacity-80 text-center px-2">
              Active: width {styleProfile.strokeWidth} · {styleProfile.brushMode} mode — auto-applies to new glyphs
            </p>
          )}
        </div>
      </Collapsible>

      <Collapsible id="sheets" title="SHEETS & OTHER FORMATS" si="වෙනත්" icon={FileText} T={T}>
        <div className="space-y-2">
          {onExportTestSheet && <Btn onClick={onExportTestSheet} icon={Download} cls={T.accentBg}>Typing Test Sheet (PNG)</Btn>}
          <Btn onClick={onExportSpecimenPDF} icon={FileText} cls={T.accentBg}>Specimen Sheet (PDF)</Btn>
          <Btn onClick={onExportAllPNGs} icon={Download} cls={T.btnGhost}>All PNGs (ZIP)</Btn>
          {onExportFEA && <Btn onClick={onExportFEA} icon={FileText} cls={T.btnGhost}>OpenType Features (.fea)</Btn>}
          <Btn onClick={onCompileSVG} icon={Download} cls={T.btnGhost}>SVG Font (legacy)</Btn>
          <p className="text-[11px] opacity-70 leading-snug">
            TTF = installable font (Word, Canva, Windows, Mac). OTF = OpenType (CFF). WOFF = compressed, for websites.
          </p>
        </div>
      </Collapsible>

      <Collapsible id="cloud" title="CLOUD & BACKUP" si="cloud / backup" icon={UploadCloud} T={T}>
        <div className="space-y-2">
          <button type="button" onClick={onPushCloud}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm">
            <UploadCloud className="w-4 h-4" aria-hidden="true" /> Push to Supabase
          </button>
          <Btn onClick={onPullCloud} icon={DownloadCloud} cls={T.btnGhost}>Pull from Cloud</Btn>
          <Btn onClick={onOpenHistory} icon={History} cls={T.accentBg}>Saved Versions</Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={onExportJSON} icon={Download} cls={T.btnGhost}>Export JSON</Btn>
            <Btn onClick={onImportJSON} icon={Upload} cls={T.btnGhost}>Import JSON</Btn>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
