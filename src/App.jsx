import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Loader2, X, User, Sparkles, WifiOff, RefreshCw } from 'lucide-react';

import { getTokens }        from './utils/themeTokens.js';
import { DEFAULT_METRICS }  from './utils/glyphData.js';
import { useLiveFontPreview } from './hooks/useLiveFontPreview.js';
import { computeStrokeProfile, suggestBrushSettings, ANCHOR_GLYPHS } from './utils/styleProfileEngine.js';
import { FEATURE_FLAGS } from './utils/featureFlags.js';
import { shortVersionLabel } from './utils/versionInfo.js';
import { exportAllPNGsAsZip } from './utils/exportAllPNGs.js';
import {
  installKeyboardGuard, installContextMenuGuard,
  installDragGuard, printConsoleBranding, verifyStorageIntegrity,
} from './utils/security.js';
import { useNetworkStatus }   from './hooks/useNetworkStatus.js';
import { useAutoSave }        from './hooks/useAutoSave.js';
import { useInstallPrompt }   from './hooks/useInstallPrompt.js';
import { useFocusTrap }       from './hooks/useFocusTrap.js';
import { useRealtimeCollab }  from './hooks/useRealtimeCollab.js';
import { useVersionHistory }  from './hooks/useVersionHistory.js';
// NOTE: fontCompiler.js (opentype.js) and specimenGenerator.js (jspdf) are
// intentionally NOT imported here. They're dynamically import()'d inside
// compileTTF/exportSpecimenPDF below — these libs are only needed when the
// user actually clicks Export, so users who never export never pay their
// bundle cost on initial page load (real measurable perf win).

import Header               from './components/Shared/Header.jsx';
import Footer               from './components/Shared/Footer.jsx';
import { ownerIdFor } from './utils/ownerId.js';
import ErrorBoundary        from './components/Shared/ErrorBoundary.jsx';
import CollabPresence       from './components/Shared/CollabPresence.jsx';
import SkipLink             from './components/Shared/SkipLink.jsx';
import { NotificationProvider, useToast, useConfirm } from './components/Shared/NotificationProvider.jsx';
import CanvasWorkspace      from './components/CanvasStudio/CanvasWorkspace.jsx';
import AtlasMatrix          from './components/CanvasStudio/AtlasMatrix.jsx';
import MetricsEngine        from './components/CanvasStudio/MetricsEngine.jsx';
import BottomSheetDrawer    from './components/CanvasStudio/BottomSheetDrawer.jsx';
import VersionHistoryPanel  from './components/CanvasStudio/VersionHistoryPanel.jsx';
import TextStudioWorkspace from './components/TextStudio/TextStudioWorkspace.jsx';
import AdminDashboard      from './components/Admin/AdminDashboard.jsx';
import AgentPanel          from './components/Agent/AgentPanel.jsx';

// ── Safe storage helpers (blocked storage / private mode / quota exceeded must never crash the UI)
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

// ── Supabase singleton ───────────────────────────────────────────────────────
const SB_URL = import.meta.env.VITE_SUPABASE_URL      || '';
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (SB_URL && SB_URL.includes('supabase.co'))
  ? createClient(SB_URL, SB_KEY) : null;

// ── Root App ─────────────────────────────────────────────────────────────────
function AppInner() {
  // ── Theme & navigation ───────────────────────────────────────────────────
  const [theme,     setTheme]     = useState(() => lsGet('krtd_theme') || 'comfort');
  const [activeTab, setActiveTab] = useState('canvas');
  const [hasVisitedTextStudio, setHasVisitedTextStudio] = useState(false);
  const T = getTokens(theme);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [authUser,    setAuthUser]    = useState(null);
  const [showLogin,   setShowLogin]   = useState(false);
  const [loginEmail,  setLoginEmail]  = useState('');
  const [loginPass,   setLoginPass]   = useState('');
  const [loginError,  setLoginError]  = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // ── UI flags ─────────────────────────────────────────────────────────────
  const [showHelp,     setShowHelp]     = useState(() => !lsGet('krtd_guide_seen'));
  const [cloudLoading, setCloudLoading] = useState(false);
  const [mobileSheet,  setMobileSheet]  = useState(null);   // 'atlas' | 'metrics'
  const [showHistory,  setShowHistory]  = useState(false);
  const [syncBanner,   setSyncBanner]   = useState(false);  // reconnect auto-sync notice

  // ── Network status ───────────────────────────────────────────────────────
  const { isOnline, wasOffline } = useNetworkStatus();

  // ── Canvas state ─────────────────────────────────────────────────────────
  const [selectedChar, setSelectedChar] = useState('අ');
  const [fontName,     setFontName]     = useState('KRTD-FontCraft-Pro');
  const [glyphs,       setGlyphs]       = useState(() => {
    try {
      const raw    = lsGet('krtd_font_craft_glyphs');
      const parsed = raw ? JSON.parse(raw) : {};
      return verifyStorageIntegrity(parsed) ? parsed : {};
    } catch { return {}; }
  });
  const [metrics,      setMetrics]      = useState({ ...DEFAULT_METRICS });
  const [useLivePreview, setUseLivePreview] = useState(false); // Part 3.1 toggle
  const [styleProfile,   setStyleProfile]   = useState(null);  // Part 4.1 learned profile
  const [undoStack,    setUndoStack]    = useState([]);
  const [redoStack,    setRedoStack]    = useState([]);
  const [clipboardGlyph, setClipboardGlyph] = useState(null); // copy/paste between chars
  const [strokeWidth,  setStrokeWidth]  = useState(14);
  const [brushMode,    setBrushMode]    = useState('calligraphy');
  const [isEraser,     setIsEraser]     = useState(false);
  const [snapEnabled,  setSnapEnabled]  = useState(false);
  const [aiSmooth,     setAiSmooth]     = useState(true);
  const [showMetrics,  setShowMetrics]  = useState(true);
  const [zoomLevel,    setZoomLevel]    = useState(1);

  const fileInputRef = useRef(null);
  const { savedLabel, markSaved } = useAutoSave();
  const { toast }   = useToast();
  const { confirm, prompt: promptDialog } = useConfirm();
  const { canInstall, promptInstall } = useInstallPrompt();
  const helpModalRef  = useFocusTrap(showHelp,  () => setShowHelp(false));
  const loginModalRef = useFocusTrap(showLogin, () => setShowLogin(false));
  const helpTitleId   = useId();
  const loginTitleId  = useId();
  const loginEmailId  = useId();
  const loginPassId   = useId();

  // ── Realtime collaboration ────────────────────────────────────────────────
  const handleRemoteGlyphUpdate = useCallback((char, strokes) => {
    setGlyphs(prev => ({ ...prev, [char]: strokes }));
  }, []);
  const { collaborators, broadcastGlyphUpdate, identity } =
    useRealtimeCollab(supabase, fontName, selectedChar, handleRemoteGlyphUpdate);

  // Broadcast local edits to peers (skip on char-switch, skip on remote-applied)
  const prevSnapshotRef = useRef({ char: selectedChar, strokes: glyphs[selectedChar] });
  useEffect(() => {
    const cur  = glyphs[selectedChar];
    const prev = prevSnapshotRef.current;
    if (prev.char === selectedChar && prev.strokes !== cur) {
      broadcastGlyphUpdate(selectedChar, cur || []);
    }
    prevSnapshotRef.current = { char: selectedChar, strokes: cur };
  }, [glyphs, selectedChar, broadcastGlyphUpdate]);

  // ── Version history ──────────────────────────────────────────────────────
  const { history, loading: historyLoading, loadHistory, saveSnapshot } =
    useVersionHistory(supabase, fontName, ownerIdFor(authUser));

  // Auto-snapshot: 8s after a real change settles, log a version (cloud only)
  const snapshotTimerRef = useRef(null);
  useEffect(() => {
    if (!supabase || !isOnline) return;
    const strokes = glyphs[selectedChar];
    if (!strokes?.length) return;
    clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      saveSnapshot(selectedChar, strokes, ownerIdFor(authUser), null);
    }, 8000);
    return () => clearTimeout(snapshotTimerRef.current);
  }, [glyphs, selectedChar, isOnline, supabase, authUser, saveSnapshot]);

  // ── Part 3.1 — Live Font Preview bridge (Canvas -> Text Studio) ──────────
  // Perf: only starts background compilation once the user has actually
  // opened Text Studio — pure Canvas Studio users pay zero compilation cost.
  useEffect(() => {
    if (activeTab === 'text') setHasVisitedTextStudio(true);
  }, [activeTab]);

  const { previewReady, previewFamily, isCompiling: previewCompiling } =
    useLiveFontPreview(fontName, metrics, glyphs, hasVisitedTextStudio);

  // ── Part 3.2 — Metrics Engine -> Text Studio CSS line-height suggestion ──
  const suggestedLineHeight = FEATURE_FLAGS.ENABLE_METRICS_CSS_BINDING
    ? Math.max(1.2, Math.min(3.0,
        +(((metrics.descender - metrics.ascender) /
           (DEFAULT_METRICS.descender - DEFAULT_METRICS.ascender)) * 1.8).toFixed(1)
      ))
    : null;

  // ── Part 3.3 — Quick Reference -> Canvas Studio routing ──────────────────
  const jumpToCanvas = useCallback((char) => {
    setSelectedChar(char);
    setActiveTab('canvas');
  }, []);

  // ── Part 4.1 — Style Profile Learning ─────────────────────────────────────
  const learnStyleProfile = useCallback(() => {
    const profile = computeStrokeProfile(glyphs);
    if (!profile) {
      toast(`⚠️ අවම වශයෙන් anchor glyphs 3ක් draw කරන්න: ${ANCHOR_GLYPHS.join(', ')}`, 'error');
      return;
    }
    const suggestion = suggestBrushSettings(profile);
    setStyleProfile(suggestion);
    setStrokeWidth(suggestion.strokeWidth);
    setBrushMode(suggestion.brushMode);
    toast(`🧠 Style Profile learned! Width: ${suggestion.strokeWidth} · Mode: ${suggestion.brushMode}`, 'success');
  }, [glyphs]);

  // Auto-apply learned profile when switching to a fresh, undrawn glyph
  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_STYLE_PROFILE_LEARNING || !styleProfile) return;
    if (glyphs[selectedChar]?.length) return; // already has content — don't override
    setStrokeWidth(styleProfile.strokeWidth);
    setBrushMode(styleProfile.brushMode);
  }, [selectedChar, styleProfile, glyphs]);

  // ── Security install ─────────────────────────────────────────────────────
  useEffect(() => {
    printConsoleBranding();
    const r1 = installKeyboardGuard();
    const r2 = installContextMenuGuard();
    const r3 = installDragGuard();
    return () => { r1(); r2(); r3(); };
  }, []);

  // ── Auth init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setAuthUser(data.session.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ── Theme persist ────────────────────────────────────────────────────────
  useEffect(() => { lsSet('krtd_theme', theme); }, [theme]);

  // ── Glyph auto-save — always to localStorage first ───────────────────────
  useEffect(() => {
    if (lsSet('krtd_font_craft_glyphs', JSON.stringify(glyphs))) markSaved();
  }, [glyphs]);

  // ── Cloud auto-sync with debounce (2 s) ─────────────────────────────────
  useEffect(() => {
    if (!supabase || !isOnline || Object.keys(glyphs).length === 0) return;
    const t = setTimeout(() => syncToCloud(false), 2000);
    return () => clearTimeout(t);
  }, [glyphs, metrics, fontName, isOnline]);

  // ── Auto re-sync after reconnect ─────────────────────────────────────────
  useEffect(() => {
    if (isOnline && wasOffline && supabase) {
      setSyncBanner(true);
      syncToCloud(false).finally(() => {
        setTimeout(() => setSyncBanner(false), 3000);
      });
    }
  }, [isOnline, wasOffline]);

  // ── Cloud helpers ────────────────────────────────────────────────────────
  const syncToCloud = async (showAlert = true) => {
    if (!supabase) return;
    try {
      const row = { font_name: fontName, user_id: ownerIdFor(authUser), metrics, glyphs, updated_at: new Date() };
      let { error } = await supabase.from('font_projects').upsert(row, { onConflict: 'user_id,font_name' });
      // 42P10 = the v4.5 SQL (owner+name unique key) has not been run yet -> old single-key upsert
      if (error && error.code === '42P10') {
        ({ error } = await supabase.from('font_projects').upsert(row, { onConflict: 'font_name' }));
      }
      if (error) throw error;
      try { localStorage.removeItem('krtd_cloud_pending'); } catch { /* ignore */ }
      markSaved();
      if (showAlert) toast(`☁️ "${fontName}" cloud save වුනා!`, 'success');
    } catch (err) {
      // silently mirror to localStorage on fail — no work loss
      lsSet('krtd_cloud_pending', JSON.stringify({ fontName, metrics, glyphs }));
      if (showAlert) toast(`❌ Cloud error: ${err.message} — 💾 local copy saved.`, 'error');
    }
  };

  const pushToCloud  = () => { setCloudLoading(true); syncToCloud(true).finally(() => setCloudLoading(false)); };

  const pullFromCloud = async () => {
    if (!supabase) { toast('⚠️ Cloud configure කරලා නෑ.', 'error'); return; }
    setCloudLoading(true);
    try {
      const owner = ownerIdFor(authUser);
      let { data, error } = await supabase
        .from('font_projects').select('*').eq('font_name', fontName).eq('user_id', owner).maybeSingle();
      if (error) throw error;
      let legacy = false;
      if (!data) {  // projects saved before v4.5 live under the shared 'guest' owner (read-only now)
        const old = await supabase.from('font_projects').select('*').eq('font_name', fontName).eq('user_id', 'guest').maybeSingle();
        if (!old.error && old.data) { data = old.data; legacy = true; }
      }
      if (!data) { toast(`🔍 "${fontName}" cloud හි නෑ.`, 'info'); }
      else {
        if (data.metrics) setMetrics(data.metrics);
        if (data.glyphs)  setGlyphs(data.glyphs);
        toast(legacy ? `✨ "${fontName}" (පරණ guest copy) load වුනා — Push කළාම ඔයාගේ අලුත් copy එකක් විදියට save වෙයි.` : `✨ "${fontName}" sync වුනා!`, 'success');
      }
    } catch (err) { toast(`❌ Pull error: ${err.message}`, 'error'); }
    finally { setCloudLoading(false); }
  };

  // ── Auth handlers ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!supabase) return;
    setAuthLoading(true); setLoginError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail, password: loginPass,
      });
      if (error) throw error;
      setAuthUser(data.user); setShowLogin(false);
      setLoginEmail(''); setLoginPass('');
    } catch (err) { setLoginError(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (err) {
      console.warn('[KRTD] Sign-out request failed (clearing local session anyway):', err.message);
    } finally {
      setAuthUser(null);
    }
  };

  // ── Metrics ──────────────────────────────────────────────────────────────
  const updateMetric = useCallback((key, value) => {
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
  }, []);

  // ── Glyph copy/paste between chars
  const copyGlyph = (fromChar) => {
    if (!glyphs[fromChar]?.length) return;
    setClipboardGlyph(JSON.parse(JSON.stringify(glyphs[fromChar])));
  };

  // ── JSON backup ──────────────────────────────────────────────────────────
  const exportJSON = () => {
    const a   = document.createElement('a');
    a.href    = 'data:text/json;charset=utf-8,' +
                encodeURIComponent(JSON.stringify({ fontName, metrics, glyphs }, null, 2));
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
          toast('🎯 Backup loaded!', 'success');
        } else toast('❌ Invalid backup file.', 'error');
      } catch { toast('❌ JSON parse error.', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── SVG Font compiler ────────────────────────────────────────────────────
  const compileSVG = () => {
    if (!Object.keys(glyphs).length) { toast('⚠️ Glyphs නෑ — draw කරලා retry කරන්න.', 'error'); return; }
    const asc  = 500 - metrics.baseline;
    const desc = -(metrics.descender - metrics.baseline);
    let svg = `<?xml version="1.0" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">\n<defs>\n<font id="${fontName}" horiz-adv-x="500">\n<font-face font-family="${fontName}" units-per-em="500" ascent="${asc}" descent="${desc}"/>\n`;
    Object.entries(glyphs).forEach(([char, strokes]) => {
      let d = '';
      strokes.forEach(s => {
        if (s.length < 2) return;
        d += `M ${s[0].x.toFixed(1)} ${(500 - s[0].y).toFixed(1)} `;
        for (let i = 1; i < s.length; i++)
          d += `L ${s[i].x.toFixed(1)} ${(500 - s[i].y).toFixed(1)} `;
      });
      if (d) {
        const cp = char.codePointAt(0).toString(16).toUpperCase();
        svg += `<glyph glyph-name="u${cp}" unicode="${char}" d="${d.trim()}" horiz-adv-x="520"/>\n`;
      }
    });
    svg += `</font>\n</defs>\n</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${fontName}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  // ── Real TTF compiler (opentype.js) — lazy-loaded on first use ───────────
  const compileTTF = async () => {
    setCloudLoading(true); // reuse existing overlay as a generic "working" indicator
    try {
      const { downloadTTF } = await import('./utils/fontCompiler.js');
      const count = downloadTTF(fontName, metrics, glyphs);
      toast(`🎉 "${fontName}.ttf" (TrueType) — ${count} glyphs compiled! Install to use in Word, Canva, Photoshop.`, 'success', 6000);
    } catch (err) {
      toast(`❌ TTF compile error: ${err.message}`, 'error');
    } finally {
      setCloudLoading(false);
    }
  };

  const compileWOFF = async () => {
    setCloudLoading(true);
    try {
      const { downloadWOFF } = await import('./utils/fontCompiler.js');
      const count = await downloadWOFF(fontName, metrics, glyphs);
      toast(`🎉 "${fontName}.woff" (web font) — ${count} glyphs compiled!`, 'success', 6000);
    } catch (err) {
      toast(`❌ WOFF compile error: ${err.message}`, 'error');
    } finally {
      setCloudLoading(false);
    }
  };

  const compileOTF = async () => {
    setCloudLoading(true);
    try {
      const { downloadOTF } = await import('./utils/fontCompiler.js');
      const count = await downloadOTF(fontName, metrics, glyphs);
      toast(`🎉 "${fontName}.otf" (OpenType CFF) — ${count} glyphs compiled!`, 'success', 6000);
    } catch (err) {
      toast(`❌ OTF compile error: ${err.message}`, 'error');
    } finally {
      setCloudLoading(false);
    }
  };

  const exportSpecimenPDF = async () => {
    setCloudLoading(true);
    try {
      const { downloadSpecimenPDF } = await import('./utils/specimenGenerator.js');
      const count = downloadSpecimenPDF(fontName, glyphs, metrics);
      toast(`📄 Specimen sheet generated — ${count} glyphs!`, 'success');
    } catch (err) {
      toast(`❌ PDF export error: ${err.message}`, 'error');
    } finally {
      setCloudLoading(false);
    }
  };

  // ── Version history handlers ──────────────────────────────────────────────
  const openHistorySheet = () => {
    setShowHistory(true);
    loadHistory(selectedChar);
  };

  const handleSaveCheckpoint = async () => {
    const strokes = glyphs[selectedChar];
    if (!strokes?.length) { toast('⚠️ මේ character එකේ draw කරපු දේවල් නෑ.', 'error'); return; }
    const label = await promptDialog('Checkpoint name (e.g. "Final shape v1")') || null;
    // Ensure the parent font_projects row exists first (silent, idempotent
    // upsert) — glyph_history's RLS policy requires a matching font_projects
    // row to already exist, and relying solely on the separate 2s-debounced
    // auto-sync effect leaves a narrow race window (e.g. saving a checkpoint
    // immediately after reconnecting from offline).
    await syncToCloud(false);
    const ok = await saveSnapshot(selectedChar, strokes, ownerIdFor(authUser), label);
    if (ok) { toast('📸 Checkpoint saved!', 'success'); loadHistory(selectedChar); }
    else toast('❌ Save failed — cloud connection check කරන්න.', 'error');
  };

  const handleRestoreVersion = async (snapshot) => {
    const ok = await confirm('Restore this version?', `${new Date(snapshot.created_at).toLocaleString()} — ${snapshot.stroke_count} strokes. දැනට ඇති strokes replace වෙයි.`);
    if (!ok) return;
    const prev = glyphs[selectedChar] || [];
    setUndoStack(u => [...u.slice(-49), { char: selectedChar, strokes: prev }]);
    setRedoStack([]);
    setGlyphs(prevGlyphs => ({ ...prevGlyphs, [selectedChar]: snapshot.strokes }));
    setShowHistory(false);
  };

  const exportAllPNGs = async () => {
    try {
      const count = await exportAllPNGsAsZip(fontName, glyphs);
      toast(`📦 ${count} glyph PNG${count === 1 ? '' : 's'} exported as ZIP!`, 'success');
    } catch (err) {
      toast(`❌ PNG export error: ${err.message}`, 'error');
    }
  };

  // ── Agent bridge: always the LATEST state/handlers (read at call time) ────
  const agentApiRef = useRef(null);
  agentApiRef.current = {
    glyphs, metrics, selectedChar,
    selectChar: setSelectedChar, goTab: setActiveTab,
    setMetrics, setGlyphs, setStrokeWidth, setBrushMode,
    pushUndo: (char, strokes) => { setUndoStack(u => [...u.slice(-49), { char, strokes }]); setRedoStack([]); },
    learnStyle: learnStyleProfile,
    pushCloud: async () => { await syncToCloud(true); },
    exportTTF: compileTTF, exportPDF: exportSpecimenPDF, exportPNG: exportAllPNGs, exportJSON,
    showHelp: () => setShowHelp(true),
    setShapeGuide: (on) => window.dispatchEvent(new CustomEvent('krtd:shape-guide', { detail: { on } })),
    confirm,
  };
  const getAgentApi = useCallback(() => agentApiRef.current, []);

  // ── Common sidebar props ─────────────────────────────────────────────────
  const metricsProps = {
    metrics, updateMetric,
    resetMetrics: () => setMetrics({ ...DEFAULT_METRICS }),
    fontName, setFontName,
    onPushCloud:  pushToCloud,
    onPullCloud:  pullFromCloud,
    onExportJSON: exportJSON,
    onImportJSON: () => fileInputRef.current.click(),
    onCompileSVG: compileSVG,
    onCompileTTF: compileTTF,
    onCompileOTF: compileOTF,
    onCompileWOFF: compileWOFF,
    onSelectChar: setSelectedChar,
    onExportSpecimenPDF: exportSpecimenPDF,
    onOpenHistory: openHistorySheet,
    onLearnStyleProfile: learnStyleProfile,
    styleProfile,
    selectedChar,
    glyphs,
    onExportAllPNGs: exportAllPNGs,
    T,
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen app-root font-sans transition-colors duration-200 ${T.bg}`}
      style={{ overscrollBehavior: 'none' }}
    >
      <SkipLink />

      {/* Cloud overlay */}
      {cloudLoading && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin"/>
          <p className="text-sm font-black tracking-widest text-white uppercase">Cloud Sync…</p>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-40 bg-amber-500 text-amber-950 text-[10px] font-black text-center py-1.5 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5"/> Offline Mode — සියලු data locally save කෙරේ. Internet reconnect වූ විට auto sync වේ.
        </div>
      )}

      {/* Reconnect banner */}
      {syncBanner && (
        <div className="fixed top-0 inset-x-0 z-40 bg-emerald-500 text-white text-[10px] font-black text-center py-1.5 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin"/> Reconnected — Cloud sync running…
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".json" onChange={importJSON} className="hidden"/>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            ref={helpModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={helpTitleId}
            tabIndex={-1}
            className={`max-w-lg w-full max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${T.card}`}
          >
            {/* Fixed header — never scrolls away */}
            <div className={`flex-shrink-0 flex justify-between items-center p-6 pb-4 border-b ${T.divider}`}>
              <div className="flex items-center gap-2">
                <Sparkles className={`w-5 h-5 motion-safe:animate-pulse ${T.accent}`} aria-hidden="true"/>
                <h3 id={helpTitleId} className="text-lg font-black">KRTD Font Craft — Guide</h3>
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${T.accentBg}`}>{shortVersionLabel()}</span>
            </div>

            {/* Scrollable body — the only part that scrolls, however long the guide gets */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <div className="space-y-3 text-sm">
                {[
                  ['01','Canvas Studio','Atlas (left) — char select. Canvas — draw. Metrics (right) — sliders + cloud.'],
                  ['02','Text Studio','Singlish type → Sinhala. Trie + cloud predictions. .txt / .md export. Font test-drive.'],
                  ['03','Admin Panel','Login → projects manage, delete, public toggle, live metrics, user roles.'],
                  ['04','Offline Safe','Internet නැතිව draw කරන්න. Reconnect වූ විට auto cloud sync. Zero data loss.'],
                  ['05','Mirror Draw (X)','Symmetric letters — එක පැත්තක් අඳිනකොට අනික් පැත්ත auto-mirror වෙනවා.'],
                  ['06','Real TTF Export','SVG නෙමෙයි — actual installable .ttf font file Word/Canva වල use කරන්න පුළුවන්.'],
                  ['07','Live Collaboration','එකම font එකේ වෙනත් designers draw කරනකොට real-time පෙනේවි.'],
                  ['08','Stylus Pressure (Pen)','Apple Pencil/Wacom pen pressure → stroke width auto-vary. Mouse/touch වලට වෙනස් නෑ.'],
                  ['09','Reference Overlay (G)','Char එකක් type කරලා, ඒක ghost reference විදිහට පෙන්නා, consistency ඕන character draw කරන්න.'],
                  ['10','Specimen PDF','Metrics panel → "Export Specimen Sheet" — ඔයාගේ font එකේ සියලුම glyphs showcase PDF එකක්.'],
                  ['11','Stroke Prediction (P)','Draw කරද්දී, pen එකේ trajectory එකෙන් ඉදිරි path එක ghost line එකක් විදිහට preview කරනවා — actual stroke එකට effect කරන්නේ නෑ.'],
                  ['12','Shape Guide (H)','Canvas toolbar එකේ Shape බොත්තම: තෝරපු අකුරේ හිස් සම්මත හැඩය පෙන්වනවා — ඒක මත ඇඳලා customize කරන්න. Style 5ක්, 1·2·3 order, Metrics snap, Match my style, Accuracy, Compare. Save / export වෙන්නේ නෑ. Eraser එකෙන් guide එක වැසෙනවා නම් "Front layer" ඔන් කරන්න.'],
                  ['13','KRTD Agent (Alt+A)','දකුණු පහළ 🤖 බොත්තම. ඔයාගේ project එක analyze කරලා health score, ඊළඟට අඳින්න ඕන අකුරු (predicted path), auto-fix, Autopilot workflow සහ chat commands (ක, fix all, save, export ttf) දෙනවා. Login වුණාම ඕනෑම ප්‍රශ්නයක් AI සහායෙන් අහන්න පුළුවන්.'],
                ].map(([n, t, d]) => (
                  <div key={n} className={`p-3 rounded-xl border flex gap-3 ${T.sub}`}>
                    <span className={`font-black flex-shrink-0 text-sm ${T.accent}`}>{n}</span>
                    <div>
                      <strong className="block mb-0.5">{t}:</strong>
                      <span className="opacity-60 text-xs">{d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed footer — button always visible and reachable regardless of body scroll position */}
            <div className={`flex-shrink-0 p-6 pt-4 border-t ${T.divider}`}>
              <button
                onClick={() => { setShowHelp(false); lsSet('krtd_guide_seen', '1'); }}
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider ${T.btn}`}
              >
                හරි, ස්ටුඩියෝ එකට යමු →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div
            ref={loginModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={loginTitleId}
            tabIndex={-1}
            className={`max-w-sm w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl ${T.card}`}
          >
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <User className={`w-5 h-5 ${T.accent}`} aria-hidden="true"/>
                <h3 id={loginTitleId} className="font-black">Login</h3>
              </div>
              <button onClick={() => setShowLogin(false)} aria-label="Close login dialog" className="p-1.5 rounded-lg opacity-70 hover:opacity-100">
                <X className="w-4 h-4" aria-hidden="true"/>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor={loginEmailId} className="sr-only">Email address</label>
                <input id={loginEmailId} type="email" placeholder="Email" value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  className={`w-full border px-4 py-2.5 rounded-xl text-sm focus:outline-none ${T.input}`}
                />
              </div>
              <div>
                <label htmlFor={loginPassId} className="sr-only">Password</label>
                <input id={loginPassId} type="password" placeholder="Password" value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className={`w-full border px-4 py-2.5 rounded-xl text-sm focus:outline-none ${T.input}`}
                />
              </div>
              {loginError && <p role="alert" className="text-xs text-red-500">{loginError}</p>}
              <button onClick={handleLogin} disabled={authLoading}
                className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${T.btn}`}>
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true"/> : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        theme={theme} setTheme={setTheme}
        activeTab={activeTab} setActiveTab={setActiveTab}
        supabase={supabase} authUser={authUser} isOnline={isOnline}
        onLoginClick={() => setShowLogin(true)}
        onLogout={handleLogout}
        onHelpClick={() => setShowHelp(true)}
        canInstall={canInstall}
        onInstallClick={promptInstall}
        onlineCount={collaborators.length}
        T={T}
      />

      {/* Live collaborator presence strip */}
      <div className="app-scroll">
      <CollabPresence collaborators={collaborators} selfId={identity.id} T={T} />

      {/* ── CANVAS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'canvas' && (
        <ErrorBoundary T={T}>
          <main id="main-content" className="max-w-[1600px] mx-auto p-3 md:p-5 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">

              <aside className={`hidden lg:block lg:col-span-3 p-4 rounded-2xl border lg:max-h-[830px] overflow-y-auto ${T.card}`}>
                <AtlasMatrix selectedChar={selectedChar} setSelectedChar={setSelectedChar} glyphs={glyphs} T={T} onCopyGlyph={copyGlyph} activeEditors={collaborators.filter(c => c.id !== identity.id)}/>
              </aside>

              <section className={`col-span-12 lg:col-span-6 p-3 sm:p-4 lg:p-5 min-w-0 rounded-2xl border ${T.card}`}>
                <CanvasWorkspace
                  theme={theme} T={T}
                  selectedChar={selectedChar}
                  glyphs={glyphs}       setGlyphs={setGlyphs}
                  undoStack={undoStack} setUndoStack={setUndoStack}
                  redoStack={redoStack} setRedoStack={setRedoStack}
                  strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
                  brushMode={brushMode}     setBrushMode={setBrushMode}
                  isEraser={isEraser}       setIsEraser={setIsEraser}
                  snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled}
                  aiSmooth={aiSmooth}       setAiSmooth={setAiSmooth}
                  showMetrics={showMetrics} setShowMetrics={setShowMetrics}
                  zoomLevel={zoomLevel}     setZoomLevel={setZoomLevel}
                  metrics={metrics}
                  onOpenAtlas={()   => setMobileSheet('atlas')}
                  onOpenMetrics={() => setMobileSheet('metrics')}
                  clipboardGlyph={clipboardGlyph}
                  onClearClipboard={() => setClipboardGlyph(null)}
                />
              </section>

              <aside className={`hidden lg:block lg:col-span-3 p-4 rounded-2xl border ${T.card}`}>
                <MetricsEngine {...metricsProps} savedLabel={savedLabel}/>
              </aside>
            </div>

            {/* Mobile bottom sheets */}
            <BottomSheetDrawer open={mobileSheet === 'atlas'} onClose={() => setMobileSheet(null)} title="Atlas Matrix" T={T}>
              <AtlasMatrix selectedChar={selectedChar} setSelectedChar={setSelectedChar} glyphs={glyphs} T={T} onSelect={() => setMobileSheet(null)} onCopyGlyph={copyGlyph} activeEditors={collaborators.filter(c => c.id !== identity.id)}/>
            </BottomSheetDrawer>

            <BottomSheetDrawer open={mobileSheet === 'metrics'} onClose={() => setMobileSheet(null)} title="Metrics Engine" T={T}>
              <MetricsEngine {...metricsProps} savedLabel={savedLabel} onImportJSON={() => { setMobileSheet(null); setTimeout(() => fileInputRef.current.click(), 200); }}/>
            </BottomSheetDrawer>

            <BottomSheetDrawer open={showHistory} onClose={() => setShowHistory(false)} title="Version History" T={T}>
              <VersionHistoryPanel
                history={history} loading={historyLoading} selectedChar={selectedChar}
                onRestore={handleRestoreVersion} onSaveCheckpoint={handleSaveCheckpoint}
                supabaseConnected={!!supabase} T={T}
              />
            </BottomSheetDrawer>
          </main>
        </ErrorBoundary>
      )}

      {/* ── TEXT STUDIO TAB ──────────────────────────────────────────────── */}
      {activeTab === 'text' && (
        <ErrorBoundary T={T}>
          <main id="main-content" className="max-w-[1600px] mx-auto p-3 md:p-5 lg:p-6">
            <TextStudioWorkspace
              T={T} glyphs={glyphs} theme={theme} supabaseUrl={SB_URL} anonKey={SB_KEY}
              previewReady={previewReady} previewFamily={previewFamily} isCompiling={previewCompiling}
              useLivePreview={useLivePreview} setUseLivePreview={setUseLivePreview}
              onJumpToCanvas={jumpToCanvas}
              suggestedLineHeight={suggestedLineHeight}
            />
          </main>
        </ErrorBoundary>
      )}

      {/* ── ADMIN TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'admin' && (
        <ErrorBoundary T={T}>
          <main id="main-content" className="max-w-[1200px] mx-auto p-3 md:p-5 lg:p-6">
            <AdminDashboard supabase={supabase} authUser={authUser} onLoginClick={() => setShowLogin(true)} onLogout={handleLogout} glyphs={glyphs} T={T}/>
          </main>
        </ErrorBoundary>
      )}

      </div>

      <Footer T={T}/>

      {FEATURE_FLAGS.ENABLE_AGENT && (
        <AgentPanel
          T={T} glyphs={glyphs} metrics={metrics} selectedChar={selectedChar}
          fontName={fontName} strokeWidth={strokeWidth} brushMode={brushMode}
          styleLearned={!!styleProfile}
          supabase={supabase} authUser={authUser} isOnline={isOnline}
          getApi={getAgentApi}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AppInner />
    </NotificationProvider>
  );
}
