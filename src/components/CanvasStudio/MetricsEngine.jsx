import React, { useId, useState, useRef, useMemo } from 'react';
import GlyphInspector from './GlyphInspector.jsx';
import CoverageCard from './CoverageCard.jsx';
import QualityCard from './QualityCard.jsx';
import MetaCard from './MetaCard.jsx';
import SpacingCard from './SpacingCard.jsx';
import { Sliders, RotateCcw, UploadCloud, DownloadCloud, Download, Upload, FileType2, History, FileText, Brain } from 'lucide-react';
import { METRIC_LABELS } from '../../utils/glyphData.js';
import { PANEL_TABS, nextTab, loadTab, saveTab, isTabId } from '../../utils/uiTabs.js';
import { coverageReport } from '../../utils/coverage.js';

const METRIC_COLORS = {
  ascender:  '#c084fc',
  capHeight: '#f472b6',
  xHeight:   '#3b82f6',
  baseline:  '#ef4444',
  descender: '#fb923c',
};

const Section = ({ icon: Icon, title, T, children }) => (
  <section className={`pt-4 border-t space-y-2 ${T.divider}`}>
    <h3 className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2 ${T.muted}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {title}
    </h3>
    {children}
  </section>
);

const Btn = ({ onClick, icon: Icon, children, cls }) => (
  <button type="button" onClick={onClick}
    className={`w-full py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border transition ${cls}`}>
    <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {children}
  </button>
);

/**
 * Right-hand tool panel, organised in four tabs:
 *   Metrics (inspector, spacing, metric sliders) · Check (coverage, export check) ·
 *   Info (font name, font info, style learning) · Export (cloud, history, backup, formats)
 */
export default function MetricsEngine({
  metrics, updateMetric, resetMetrics,
  fontName, setFontName,
  onPushCloud, onPullCloud,
  onExportJSON, onImportJSON,
  onCompileSVG, onCompileTTF, onCompileOTF, onCompileWOFF, onExportTestSheet, onOpenHistory, onExportSpecimenPDF,
  onLearnStyleProfile, styleProfile, savedLabel,
  selectedChar, glyphs, onExportAllPNGs, onSelectChar,
  T, initialTab,
}) {
  const fontNameId = useId();
  const uid = useId();
  const [tab, setTab] = useState(() => (isTabId(initialTab) ? initialTab : loadTab()));
  const tabRefs = useRef({});
  const pick = (id) => { setTab(id); saveTab(id); };
  const onKey = (e) => {
    const n = nextTab(tab, e.key);
    if (n) { e.preventDefault(); pick(n); const el = tabRefs.current[n]; if (el) el.focus(); }
  };
  const cov = useMemo(() => coverageReport(glyphs || {}), [glyphs]);
  const badge = { check: `${cov.percent}%` };

  const panels = {
    metrics: (
      <div className="space-y-5">
        <GlyphInspector selectedChar={selectedChar} glyphs={glyphs} T={T}/>
        <SpacingCard selectedChar={selectedChar} fontName={fontName} metrics={metrics} glyphs={glyphs} T={T}/>
        <section>
          <div className={`flex items-center justify-between pb-2 mb-3 border-b ${T.divider}`}>
            <h2 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${T.muted}`}>
              <Sliders className="w-3.5 h-3.5" aria-hidden="true" /> Metrics Engine
            </h2>
            <button type="button" onClick={resetMetrics}
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
        </section>
      </div>
    ),

    check: (
      <div className="space-y-4">
        <CoverageCard glyphs={glyphs} selectedChar={selectedChar} onSelectChar={onSelectChar} T={T}/>
        <QualityCard fontName={fontName} metrics={metrics} glyphs={glyphs} onSelectChar={onSelectChar} T={T}/>
      </div>
    ),

    info: (
      <div className="space-y-4">
        <div>
          <label htmlFor={fontNameId} className="text-[9px] font-black uppercase tracking-widest block mb-1.5 opacity-70">Font Name</label>
          <input id={fontNameId} type="text" value={fontName}
            onChange={e => setFontName(e.target.value.replace(/\s+/g, '-'))}
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="My-Sinhala-Font"
            className={`w-full border px-3 py-2 rounded-xl text-xs font-bold focus:outline-none transition ${T.input}`}
          />
        </div>
        <MetaCard T={T}/>
        <Section icon={Brain} title="Style Profile Learning" T={T}>
          <Btn onClick={onLearnStyleProfile} icon={Brain} cls={T.accentBg}>Learn from ක/ම/න/ර/ය</Btn>
          {styleProfile && (
            <p className="text-[9px] opacity-70 text-center px-2">
              Active: width {styleProfile.strokeWidth} · {styleProfile.brushMode} mode — auto-applies to new glyphs
            </p>
          )}
        </Section>
      </div>
    ),

    export: (
      <div className="space-y-4">
        <div className="space-y-2">
          <button type="button" onClick={onCompileTTF}
            className={`w-full py-3.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 uppercase tracking-wider shadow-md transition ${T.btn}`}>
            <FileType2 className="w-4 h-4" aria-hidden="true" /> Build &amp; Export TTF Font
          </button>
          <div className="grid grid-cols-2 gap-2">
            {onCompileOTF && <Btn onClick={onCompileOTF} icon={FileType2} cls={T.accentBg}>OTF</Btn>}
            {onCompileWOFF && <Btn onClick={onCompileWOFF} icon={FileType2} cls={T.accentBg}>WOFF</Btn>}
          </div>
          <p className="text-[9px] opacity-60 text-center px-2">
            TTF = installable font (Word, Canva, Windows, Mac). OTF = OpenType (CFF). WOFF = compressed, for websites.
          </p>
        </div>

        <Section icon={FileText} title="Preview & Sheets" T={T}>
          {onExportTestSheet && <Btn onClick={onExportTestSheet} icon={Download} cls={T.accentBg}>Typing Test Sheet (PNG)</Btn>}
          <Btn onClick={onExportSpecimenPDF} icon={FileText} cls={T.accentBg}>Specimen Sheet (PDF)</Btn>
          <Btn onClick={onExportAllPNGs} icon={Download} cls={T.btnGhost}>All PNGs (ZIP)</Btn>
          <Btn onClick={onCompileSVG} icon={Download} cls={T.btnGhost}>SVG Font (legacy)</Btn>
        </Section>

        <Section icon={UploadCloud} title="Cloud Sync" T={T}>
          <button type="button" onClick={onPushCloud}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition shadow-sm">
            <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" /> Push to Supabase
          </button>
          <Btn onClick={onPullCloud} icon={DownloadCloud} cls={T.btnGhost}>Pull from Cloud</Btn>
        </Section>

        <Section icon={History} title="Versions & Backup" T={T}>
          <Btn onClick={onOpenHistory} icon={History} cls={T.accentBg}>Saved Versions</Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={onExportJSON} icon={Download} cls={T.btnGhost}>Export JSON</Btn>
            <Btn onClick={onImportJSON} icon={Upload} cls={T.btnGhost}>Import JSON</Btn>
          </div>
        </Section>
      </div>
    ),
  };

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Tools" onKeyDown={onKey}
        className={`sticky top-0 z-10 grid grid-cols-4 gap-1 p-1 rounded-xl border backdrop-blur ${T.sub}`}>
        {PANEL_TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" role="tab" id={`${uid}-tab-${t.id}`} aria-selected={on} aria-controls={`${uid}-panel-${t.id}`}
              tabIndex={on ? 0 : -1} ref={(el) => { tabRefs.current[t.id] = el; }} onClick={() => pick(t.id)}
              className={`min-w-0 py-2 px-1 rounded-lg text-[10px] font-black leading-tight transition ${on ? T.btn : 'opacity-70 hover:opacity-100'}`}>
              <span className="block truncate">{t.label}</span>
              <span className="block text-[8px] font-bold opacity-70 truncate">{badge[t.id] || t.si}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${uid}-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`} tabIndex={0} className="outline-none">
        {panels[tab]}
      </div>
    </div>
  );
}
