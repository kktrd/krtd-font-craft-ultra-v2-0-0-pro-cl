import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, X, User, Sparkles } from 'lucide-react';

import { getTokens }   from './utils/themeTokens.js';
import { DEFAULT_METRICS, METRIC_LABELS } from './utils/glyphData.js';
import {
  installKeyboardGuard,
  installContextMenuGuard,
  installDragGuard,
  printConsoleBranding,
  verifyStorageIntegrity,
} from './utils/security.js';

import Header           from './components/Shared/Header.jsx';
import Footer           from './components/Shared/Footer.jsx';
import CanvasWorkspace  from './components/CanvasStudio/CanvasWorkspace.jsx';
import AtlasMatrix      from './components/CanvasStudio/AtlasMatrix.jsx';
import MetricsEngine    from './components/CanvasStudio/MetricsEngine.jsx';
import BottomSheetDrawer from './components/CanvasStudio/BottomSheetDrawer.jsx';
import TextStudioWorkspace from './components/TextStudio/TextStudioWorkspace.jsx';
import AdminDashboard   from './components/Admin/AdminDashboard.jsx';
import ErrorBoundary    from './components/Shared/ErrorBoundary.jsx';

// ── Supabase ────────────────────────────────────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_URL.includes('supabase.co'))
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  // Theme & tab
  const [theme, setTheme]       = useState(() => localStorage.getItem('krtd_theme') || 'comfort');
  const [activeTab, setActiveTab] = useState('canvas');

  // Auth
  const [authUser, setAuthUser]   = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass]   = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Help
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem('krtd_guide_seen'));

  // Cloud
  const [cloudLoading, setCloudLoading] = useState(false);

  // Canvas state (lifted so MetricsEngine & CanvasWorkspace share)
  const [selectedChar, setSelectedChar] = useState('අ');
  const [fontName, setFontName]         = useState('KRTD-FontCraft-Pro');
  const [glyphs, setGlyphs]             = useState(() => {
    try {
      const raw = localStorage.getItem('krtd_font_craft_glyphs');
      const parsed = raw ? JSON.parse(raw) : {};
      return verifyStorageIntegrity(parsed) ? parsed : {};
    } catch { return {}; }
  });
  const [metrics, setMetrics]           = useState({ ...DEFAULT_METRICS });
  const [undoStack, setUndoStack]       = useState([]);
  const [redoStack, setRedoStack]       = useState([]);
  const [strokeWidth, setStrokeWidth]   = useState(14);
  const [brushMode, setBrushMode]       = useState('calligraphy');
  const [isEraser, setIsEraser]         = useState(false);
  const [snapEnabled, setSnapEnabled]   = useState(false);
  const [aiSmooth, setAiSmooth]         = useState(true);
  const [showMetrics, setShowMetrics]   = useState(true);
  const [zoomLevel, setZoomLevel]       = useState(1);

  // Mobile sheets
  const [mobileSheet, setMobileSheet] = useState(null); // 'atlas' | 'metrics'

  const fileInputRef = useRef(null);

  // Derived tokens
  const T = getTokens(theme);

  // ── Security install ─────────────────────────────────────────────────────
  useEffect(() => {
    printConsoleBranding();
    const removeKb  = installKeyboardGuard();
    const removeCtx = installContextMenuGuard();
    const removeDrag = installDragGuard();
    return () => { removeKb(); removeCtx(); removeDrag(); };
  }, []);

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setAuthUser(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ── Theme persist ────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('krtd_theme', theme); }, [theme]);

  // ── Glyph auto-save ──────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('krtd_font_craft_glyphs', JSON.stringify(glyphs));
    if (!supabase || Object.keys(glyphs).length === 0) return;
    const t = setTimeout(async () => {
      try {
        await supabase.from('font_projects').upsert({
          font_name: fontName,
          user_id: authUser?.id || 'guest',
          metrics,
          glyphs,
          updated_at: new Date(),
        }, { onConflict: 'font_name' });
      } catch (err) { console.warn('[KRTD] BG sync:', err.message); }
    }, 2000);
    return () => clearTimeout(t);
  }, [glyphs, metrics, fontName]);

  // ── Auth handlers ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!supabase) return;
    setAuthLoading(true); setLoginError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
      if (error) throw error;
      setAuthUser(data.user); setShowLogin(false); setLoginEmail(''); setLoginPass('');
    } catch (err) { setLoginError(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setAuthUser(null);
  };

  // ── Metrics ──────────────────────────────────────────────────────────────
  const updateMetric = (key, value) => {
    const val = parseInt(value);
    setMetrics(prev => {
      const n = { ...prev, [key]: val };
      if (n.ascender  >= n.capHeight) n.ascender  = n.capHeight  - 10;
      if (n.capHeight <= n.ascender)  n.capHeight = n.ascender   + 10;
      if (n.capHeight >= n.xHeight)   n.capHeight = n.xHeight    - 10;
      if (n.xHeight   <= n.capHeight) n.xHeight   = n.capHeight  + 10;
      if (n.xHeight   >= n.baseline)  n.xHeight   = n.baseline   - 10;
      if (n.baseline  <= n.xHeight)   n.baseline  = n.xHeight    + 10;
      if (n.baseline  >= n.descender) n.baseline  = n.descender  - 10;
      if (n.descender <= n.baseline)  n.descender = n.baseline   + 10;
      return n;
    });
  };

  // ── Cloud ─────────────────────────────────────────────────────────────────
  const pushToCloud = async () => {
    if (!supabase) { alert('⚠️ Supabase configure කරලා නෑ.'); return; }
    setCloudLoading(true);
    try {
      const { error } = await supabase.from('font_projects').upsert({
        font_name: fontName, user_id: authUser?.id || 'guest',
        metrics, glyphs, updated_at: new Date(),
      }, { onConflict: 'font_name' });
      if (error) throw error;
      alert(`☁️ "${fontName}" cloud save වුනා!`);
    } catch (err) { alert(`❌ Push error: ${err.message}`); }
    finally { setCloudLoading(false); }
  };

  const pullFromCloud = async () => {
    if (!supabase) { alert('⚠️ Cloud configure කරලා නෑ.'); return; }
    setCloudLoading(true);
    try {
      const { data, error } = await supabase.from('font_projects').select('*').eq('font_name', fontName).single();
      if (error) { if (error.code === 'PGRST116') alert(`🔍 "${fontName}" cloud හි නෑ.`); else throw error; }
      else if (data) {
        if (data.metrics) setMetrics(data.metrics);
        if (data.glyphs)  setGlyphs(data.glyphs);
        alert(`✨ "${fontName}" sync වුනා!`);
      }
    } catch (err) { alert(`❌ Pull error: ${err.message}`); }
    finally { setCloudLoading(false); }
  };

  // ── JSON backup ──────────────────────────────────────────────────────────
  const exportJSON = () => {
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ fontName, metrics, glyphs }, null, 2));
    a.download = `${fontName}_backup.json`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const importJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.glyphs) {
          if (d.fontName) setFontName(d.fontName);
          if (d.metrics)  setMetrics(d.metrics);
          setGlyphs(d.glyphs);
          alert('🎯 Backup loaded!');
        } else { alert('❌ Invalid backup file.'); }
      } catch { alert('❌ JSON parse error.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── SVG Font export ──────────────────────────────────────────────────────
  const compileSVG = () => {
    if (Object.keys(glyphs).length === 0) { alert('⚠️ Glyphs නෑ — draw කරලා try කරන්න.'); return; }
    let svg = `<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">\n<defs>\n<font id="${fontName}" horiz-adv-x="500">\n<font-face font-family="${fontName}" units-per-em="500" ascent="${500 - metrics.baseline}" descent="-${metrics.descender - metrics.baseline}"/>\n`;
    Object.entries(glyphs).forEach(([char, strokes]) => {
      let d = '';
      strokes.forEach(s => {
        if (s.length < 2) return;
        d += `M ${s[0].x.toFixed(1)} ${(500 - s[0].y).toFixed(1)} `;
        for (let i = 1; i < s.length; i++) d += `L ${s[i].x.toFixed(1)} ${(500 - s[i].y).toFixed(1)} `;
      });
      if (d) {
        const cp = char.codePointAt(0).toString(16).toUpperCase();
        svg += `<glyph glyph-name="u${cp}" unicode="${char}" d="${d.trim()}" horiz-adv-x="520"/>\n`;
      }
    });
    svg += `</font>\n</defs>\n</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${fontName}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${T.bg}`} style={{ overscrollBehavior:'none' }}>

      {/* Cloud loading overlay */}
      {cloudLoading && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin"/>
          <p className="text-sm font-black tracking-widest text-white uppercase">Cloud Sync Processing…</p>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={importJSON} className="hidden"/>

      {/* ── Help modal ─────────────────────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`max-w-lg w-full p-6 rounded-2xl border shadow-2xl animate-[fadeIn_0.25s_ease-out] ${T.card}`}>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2.5">
                <Sparkles className={`w-5 h-5 animate-pulse ${T.accent}`}/>
                <h3 className="text-lg font-black">KRTD Font Craft — Quick Guide</h3>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${T.accentBg}`}>v2.0 PRO</span>
            </div>
            <div className="space-y-3">
              {[
                ['01','Canvas Studio','Left panel — අක්ෂරය select. Middle — draw. Right — metrics & cloud sync.'],
                ['02','Text Studio','Singlish type කරන්න → instant සිංහල. Trie predictions, .txt/.md export.'],
                ['03','Admin Panel','Login වෙලා font projects manage, delete, public/private toggle.'],
                ['04','Security','Right-click, F12, Ctrl+U disabled. RDP path compression active.'],
              ].map(([n,t,d]) => (
                <div key={n} className={`p-3 rounded-xl border flex gap-3 ${T.sub}`}>
                  <span className={`font-black flex-shrink-0 ${T.accent}`}>{n}</span>
                  <div><strong className="block mb-0.5 text-sm">{t}:</strong><span className="text-xs opacity-60">{d}</span></div>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowHelp(false); localStorage.setItem('krtd_guide_seen', 'true'); }}
              className={`w-full mt-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider ${T.btn}`}
            >
              හරි — ස්ටුඩියෝ එකට යමු →
            </button>
          </div>
        </div>
      )}

      {/* ── Login modal ────────────────────────────────────────────────── */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`max-w-sm w-full p-6 rounded-2xl border shadow-2xl animate-[fadeIn_0.2s_ease-out] ${T.card}`}>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <User className={`w-5 h-5 ${T.accent}`}/>
                <h3 className="font-black text-base">Login</h3>
              </div>
              <button onClick={() => setShowLogin(false)} className="p-1.5 rounded-lg opacity-40 hover:opacity-70">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="email" placeholder="Email" value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                className={`w-full border px-4 py-2.5 rounded-xl text-sm focus:outline-none transition ${T.input}`}
              />
              <input
                type="password" placeholder="Password" value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={`w-full border px-4 py-2.5 rounded-xl text-sm focus:outline-none transition ${T.input}`}
              />
              {loginError && (
                <p className="text-xs text-red-500 font-medium">{loginError}</p>
              )}
              <button
                onClick={handleLogin} disabled={authLoading}
                className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition ${T.btn}`}
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Header
        theme={theme} setTheme={setTheme}
        activeTab={activeTab} setActiveTab={setActiveTab}
        supabase={supabase} authUser={authUser}
        onLoginClick={() => setShowLogin(true)}
        onLogout={handleLogout}
        onHelpClick={() => setShowHelp(true)}
        T={T}
      />

      {/* ── CANVAS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'canvas' && (
        <ErrorBoundary T={T}><main className="max-w-[1600px] mx-auto p-3 md:p-5 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">

            {/* Left — Atlas (desktop) */}
            <aside className={`hidden md:block md:col-span-3 p-4 rounded-2xl border lg:max-h-[820px] overflow-y-auto ${T.card}`}>
              <AtlasMatrix
                selectedChar={selectedChar}
                setSelectedChar={setSelectedChar}
                glyphs={glyphs}
                T={T}
              />
            </aside>

            {/* Center — Canvas */}
            <section className={`col-span-12 md:col-span-6 p-4 md:p-5 rounded-2xl border ${T.card}`}>
              <CanvasWorkspace
                theme={theme} T={T}
                selectedChar={selectedChar}
                glyphs={glyphs} setGlyphs={setGlyphs}
                undoStack={undoStack} setUndoStack={setUndoStack}
                redoStack={redoStack} setRedoStack={setRedoStack}
                strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
                brushMode={brushMode} setBrushMode={setBrushMode}
                isEraser={isEraser} setIsEraser={setIsEraser}
                snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled}
                aiSmooth={aiSmooth} setAiSmooth={setAiSmooth}
                showMetrics={showMetrics} setShowMetrics={setShowMetrics}
                zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
                metrics={metrics}
                onOpenAtlas={() => setMobileSheet('atlas')}
                onOpenMetrics={() => setMobileSheet('metrics')}
              />
            </section>

            {/* Right — Metrics (desktop) */}
            <aside className={`hidden md:block md:col-span-3 p-4 rounded-2xl border ${T.card}`}>
              <MetricsEngine
                metrics={metrics} updateMetric={updateMetric}
                resetMetrics={() => { setMetrics({ ...DEFAULT_METRICS }); }}
                fontName={fontName} setFontName={setFontName}
                onPushCloud={pushToCloud}
                onPullCloud={pullFromCloud}
                onExportJSON={exportJSON}
                onImportJSON={() => fileInputRef.current.click()}
                onCompileSVG={compileSVG}
                T={T}
              />
            </aside>
          </div>

          {/* Mobile bottom sheets */}
          <BottomSheetDrawer
            open={mobileSheet === 'atlas'}
            onClose={() => setMobileSheet(null)}
            title="Atlas Matrix — අක්ෂර"
            T={T}
          >
            <AtlasMatrix
              selectedChar={selectedChar}
              setSelectedChar={setSelectedChar}
              glyphs={glyphs}
              T={T}
              onSelect={() => setMobileSheet(null)}
            />
          </BottomSheetDrawer>

          <BottomSheetDrawer
            open={mobileSheet === 'metrics'}
            onClose={() => setMobileSheet(null)}
            title="Metrics Engine"
            T={T}
          >
            <MetricsEngine
              metrics={metrics} updateMetric={updateMetric}
              resetMetrics={() => setMetrics({ ...DEFAULT_METRICS })}
              fontName={fontName} setFontName={setFontName}
              onPushCloud={pushToCloud}
              onPullCloud={pullFromCloud}
              onExportJSON={exportJSON}
              onImportJSON={() => { setMobileSheet(null); setTimeout(() => fileInputRef.current.click(), 200); }}
              onCompileSVG={compileSVG}
              T={T}
            />
          </BottomSheetDrawer>
        </main></ErrorBoundary>
      )}

      {/* ── TEXT STUDIO TAB ────────────────────────────────────────────── */}
      {activeTab === 'text' && (
        <ErrorBoundary T={T}><main className="max-w-[1600px] mx-auto p-3 md:p-5 lg:p-6">
          <TextStudioWorkspace T={T} glyphs={glyphs} theme={theme} />
        </main></ErrorBoundary>
      )}

      {/* ── ADMIN TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'admin' && (
        <ErrorBoundary T={T}><main className="max-w-[1200px] mx-auto p-3 md:p-5 lg:p-6">
          <AdminDashboard
            supabase={supabase}
            authUser={authUser}
            onLoginClick={() => setShowLogin(true)}
            onLogout={handleLogout}
            glyphs={glyphs}
            T={T}
          />
        </main></ErrorBoundary>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <Footer T={T} />
    </div>
  );
}
