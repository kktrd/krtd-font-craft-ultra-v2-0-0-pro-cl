import React, { useState, useEffect } from 'react';
import {
  Database, FileText, Users, Palette, Wifi, RefreshCw,
  Trash2, Lock, LogOut, Loader2, Shield, Activity,
  AlertTriangle, CheckCircle
} from 'lucide-react';

export default function AdminDashboard({ supabase, authUser, onLoginClick, onLogout, glyphs, T }) {

  const [projects, setProjects]     = useState([]);
  const [auditLog, setAuditLog]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (authUser && supabase) loadData();
  }, [authUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: projs } = await supabase
        .from('font_projects')
        .select('id, font_name, user_id, updated_at, glyphs, is_public')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (projs) setProjects(projs);

      const { data: logs } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (logs) setAuditLog(logs);
    } catch (err) {
      showToast('Load error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (proj) => setDeleteTarget(proj);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('font_projects').delete().eq('id', deleteTarget.id);
      await supabase.from('audit_log').insert({
        user_id: authUser?.id || 'admin',
        action: 'DELETE_PROJECT',
        target: deleteTarget.font_name,
      });
      setProjects(p => p.filter(x => x.id !== deleteTarget.id));
      showToast(`"${deleteTarget.font_name}" deleted.`);
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const togglePublic = async (proj) => {
    try {
      await supabase.from('font_projects').update({ is_public: !proj.is_public }).eq('id', proj.id);
      setProjects(p => p.map(x => x.id === proj.id ? { ...x, is_public: !x.is_public } : x));
      showToast(`"${proj.font_name}" is now ${!proj.is_public ? 'public' : 'private'}.`);
    } catch (err) {
      showToast('Update failed: ' + err.message, 'error');
    }
  };

  const uniqueUsers = new Set(projects.map(p => p.user_id)).size;
  const totalGlyphs = projects.reduce((a, p) => a + Object.keys(p.glyphs || {}).length, 0);

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!authUser) {
    return (
      <div className={`p-10 rounded-2xl border text-center space-y-5 ${T.card}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${T.accentBg}`}>
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-black text-lg mb-1">Admin Access Required</h3>
          <p className="text-sm opacity-50">Admin panel access කරන්න login වෙන්න.</p>
        </div>
        <button onClick={onLoginClick} className={`px-8 py-3 rounded-xl font-bold text-sm ${T.btn}`}>
          Login to Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-bold animate-[slideDown_0.25s_ease-out]
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error'
            ? <AlertTriangle className="w-4 h-4"/>
            : <CheckCircle className="w-4 h-4"/>}
          {toast.msg}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`max-w-sm w-full p-6 rounded-2xl border shadow-2xl space-y-4 ${T.card}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500"><Trash2 className="w-5 h-5"/></div>
              <div>
                <h4 className="font-black">Delete Project?</h4>
                <p className="text-xs opacity-60">"{deleteTarget.font_name}" permanent ලෙස delete වෙයි.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border ${T.btnGhost}`}>Cancel</button>
              <button onClick={executeDelete} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${T.accentBg}`}><Database className="w-5 h-5"/></div>
            <div>
              <h2 className="font-black text-base">Admin Console</h2>
              <p className="text-[10px] opacity-50">{authUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} disabled={loading}
              className={`text-[10px] border px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${T.accentBg}`}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/> Refresh
            </button>
            <button onClick={onLogout}
              className={`text-[10px] border px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition ${T.btnGhost}`}>
              <LogOut className="w-3.5 h-3.5"/> Logout
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:'Total Projects', val: projects.length,       Icon: FileText,  col:'text-indigo-400' },
            { label:'Unique Users',   val: uniqueUsers,            Icon: Users,     col:'text-cyan-400'   },
            { label:'Total Glyphs',   val: totalGlyphs,            Icon: Palette,   col:'text-amber-400'  },
            { label:'Cloud Status',   val: supabase?'Live':'Off',  Icon: Wifi,      col:'text-emerald-400'},
          ].map(({ label, val, Icon, col }) => (
            <div key={label} className={`p-4 rounded-xl border ${T.sub}`}>
              <Icon className={`w-4 h-4 mb-2 ${col}`}/>
              <div className="text-2xl font-black">{val}</div>
              <div className="text-[10px] opacity-40 font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects table */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 opacity-50"/> Font Projects
          </h3>
          <span className="text-[10px] opacity-40">{projects.length} total</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className={`w-6 h-6 animate-spin ${T.accent}`}/>
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {projects.length === 0 && (
              <p className="text-center py-8 opacity-30 text-sm">Projects හමු නොවිය.</p>
            )}
            {projects.map(proj => (
              <div key={proj.id}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition ${T.sub} ${T.cardHover}`}>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{proj.font_name}</div>
                  <div className="text-[10px] opacity-40 flex flex-wrap gap-x-3 mt-0.5">
                    <span>User: {proj.user_id?.slice(0,10) || 'guest'}</span>
                    <span>{Object.keys(proj.glyphs||{}).length} glyphs</span>
                    <span>{new Date(proj.updated_at).toLocaleDateString('si-LK')}</span>
                  </div>
                </div>
                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => togglePublic(proj)}
                    className={`text-[9px] font-black px-2 py-1 rounded-lg border transition
                      ${proj.is_public ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'opacity-30 hover:opacity-60'}`}
                  >
                    {proj.is_public ? 'Public' : 'Private'}
                  </button>
                  <button
                    onClick={() => confirmDelete(proj)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="font-black text-sm flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 opacity-50"/> Audit Log
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {auditLog.map(log => (
              <div key={log.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] ${T.sub}`}>
                <span className="font-mono opacity-40">{new Date(log.created_at).toLocaleTimeString()}</span>
                <span className={`font-black ${T.accent}`}>{log.action}</span>
                <span className="opacity-60 truncate">{log.target}</span>
                <span className="ml-auto opacity-30 truncate max-w-[80px]">{log.user_id?.slice(0,8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Copyright notice */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${T.sub}`}>
        <Shield className="w-4 h-4 opacity-40 flex-shrink-0 mt-0.5"/>
        <p className="text-[10px] opacity-40 leading-relaxed">
          © 2026 KRTD Font Craft Ultra v2.0.0 PRO — Prabhath Lokuge. This admin console and all associated
          source code is proprietary. Unauthorized access, duplication, or redistribution is strictly
          prohibited under applicable copyright and computer fraud laws.
        </p>
      </div>
    </div>
  );
}
