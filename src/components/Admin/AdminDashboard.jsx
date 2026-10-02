import React, { useState, useEffect, useCallback, useId } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { fullVersionLine, buildStamp } from '../../utils/versionInfo.js';
import DiagnosticsPanel from './DiagnosticsPanel.jsx';
import {
  Database, FileText, Users, Palette, Wifi, RefreshCw, Trash2,
  Lock, LogOut, Loader2, Shield, Activity, AlertTriangle,
  CheckCircle, UserCheck, HardDrive, BarChart2, Eye, EyeOff, Cpu
} from 'lucide-react';

export default function AdminDashboard({ supabase, authUser, onLoginClick, onLogout, glyphs, T }) {
  const [projects,    setProjects]    = useState([]);
  const [userRoles,   setUserRoles]   = useState([]);
  const [auditLog,    setAuditLog]    = useState([]);
  const [dbStats,     setDbStats]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [toast,       setToast]       = useState(null);
  const [activeView,  setActiveView]  = useState('projects'); // 'projects'|'users'|'metrics'|'audit'
  const deleteTitleId = useId();
  const deleteModalRef = useFocusTrap(!!deleteTarget, () => setDeleteTarget(null));

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!supabase || !authUser) return;
    setLoading(true);
    try {
      const [projRes, rolesRes, auditRes] = await Promise.all([
        supabase.from('font_projects').select('id,font_name,user_id,updated_at,glyphs,is_public,role').order('updated_at',{ascending:false}).limit(100),
        supabase.from('user_roles').select('*').order('created_at',{ascending:false}).limit(200),
        supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(50),
      ]);
      if (projRes.data)  setProjects(projRes.data);
      if (rolesRes.data) setUserRoles(rolesRes.data);
      if (auditRes.data) setAuditLog(auditRes.data);

      // Live storage metrics
      const { data: sm } = await supabase.rpc('get_table_sizes').catch(() => ({ data: null }));
      if (sm) setDbStats(sm);
    } catch (err) { showToast('Load error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }, [supabase, authUser]);

  useEffect(() => { if (authUser && supabase) loadData(); }, [authUser, loadData]);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await supabase.from('font_projects').delete().eq('id', deleteTarget.id);
      await supabase.from('audit_log').insert({ user_id: authUser?.id, action: 'DELETE_PROJECT', target: deleteTarget.font_name });
      setProjects(p => p.filter(x => x.id !== deleteTarget.id));
      showToast(`"${deleteTarget.font_name}" deleted.`);
    } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
    finally { setDeleteTarget(null); }
  };

  const togglePublic = async (proj) => {
    try {
      await supabase.from('font_projects').update({ is_public: !proj.is_public }).eq('id', proj.id);
      setProjects(p => p.map(x => x.id===proj.id ? {...x, is_public: !x.is_public} : x));
      showToast(`"${proj.font_name}" → ${!proj.is_public ? 'public' : 'private'}`);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      await supabase.from('user_roles').upsert({ user_id: userId, role: newRole, granted_by: authUser?.id }, { onConflict: 'user_id' });
      await supabase.from('audit_log').insert({ user_id: authUser?.id, action: 'SET_ROLE', target: `${userId}→${newRole}` });
      setUserRoles(r => r.map(x => x.user_id===userId ? {...x, role: newRole} : x));
      showToast(`Role updated → ${newRole}`);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const uniqueUsers  = new Set(projects.map(p => p.user_id)).size;
  const totalGlyphs  = projects.reduce((a, p) => a + Object.keys(p.glyphs||{}).length, 0);
  const localGlyphs  = Object.keys(glyphs).length;

  const VIEWS = [
    { id: 'projects',    label: 'Projects',    Icon: FileText  },
    { id: 'users',       label: 'Users',       Icon: Users     },
    { id: 'metrics',     label: 'Metrics',     Icon: BarChart2 },
    { id: 'audit',       label: 'Audit Log',   Icon: Activity  },
    { id: 'diagnostics', label: 'Diagnostics', Icon: Cpu       },
  ];

  const ROLE_OPTIONS = ['guest','designer','admin','super_admin'];
  const ROLE_COLORS  = { guest:'text-slate-400', designer:'text-blue-400', admin:'text-amber-400', super_admin:'text-emerald-400' };

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!authUser) return (
    <div className={`p-10 rounded-2xl border text-center space-y-5 ${T.card}`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${T.accentBg}`}>
        <Lock className="w-7 h-7" aria-hidden="true"/>
      </div>
      <div>
        <h3 className="font-black text-lg mb-1">Admin Access Required</h3>
        <p className="text-sm opacity-50">Login කරලා admin console access කරන්න.</p>
      </div>
      <button onClick={onLoginClick} className={`px-8 py-3 rounded-xl font-bold text-sm ${T.btn}`}>Login</button>
    </div>
  );

  return (
    <div className="space-y-5 relative">

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className={`fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-bold border ${toast.type==='error' ? 'bg-red-600 border-red-700 text-white' : 'bg-emerald-600 border-emerald-700 text-white'}`}>
          {toast.type==='error' ? <AlertTriangle className="w-4 h-4" aria-hidden="true"/> : <CheckCircle className="w-4 h-4" aria-hidden="true"/>}
          {toast.msg}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div ref={deleteModalRef} role="dialog" aria-modal="true" aria-labelledby={deleteTitleId} tabIndex={-1}
            className={`max-w-sm w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border shadow-2xl space-y-4 ${T.card}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500"><Trash2 className="w-5 h-5" aria-hidden="true"/></div>
              <div>
                <h4 id={deleteTitleId} className="font-black">Delete Project?</h4>
                <p className="text-xs opacity-60">"{deleteTarget.font_name}" permanent delete.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className={`flex-1 py-2.5 rounded-xl font-bold text-sm border ${T.btnGhost}`}>Cancel</button>
              <button onClick={executeDelete} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin header */}
      <div className={`p-5 rounded-2xl border ${T.card}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${T.accentBg}`}><Database className="w-5 h-5" aria-hidden="true"/></div>
            <div>
              <h2 className="font-black text-base">Admin Console</h2>
              <p className="text-[10px] opacity-70">{authUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} disabled={loading}
              className={`text-[10px] border px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${T.accentBg}`}>
              <RefreshCw className={`w-3.5 h-3.5 motion-safe:${loading?'animate-spin':''}`} aria-hidden="true"/> Refresh
            </button>
            <button onClick={onLogout}
              className={`text-[10px] border px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${T.btnGhost}`}>
              <LogOut className="w-3.5 h-3.5" aria-hidden="true"/> Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label:'Total Projects', val: projects.length, Icon: FileText,  col:'text-indigo-400' },
            { label:'Unique Users',   val: uniqueUsers,     Icon: Users,     col:'text-cyan-400'   },
            { label:'Total Glyphs',   val: totalGlyphs,     Icon: Palette,   col:'text-amber-400'  },
            { label:'Local Glyphs',   val: localGlyphs,     Icon: HardDrive, col:'text-emerald-400'},
          ].map(({ label, val, Icon, col }) => (
            <div key={label} className={`p-4 rounded-xl border ${T.sub}`}>
              <Icon className={`w-4 h-4 mb-2 ${col}`}/>
              <div className="text-2xl font-black">{val}</div>
              <div className="text-[10px] opacity-70 font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* View tabs */}
        <div className={`flex p-0.5 rounded-xl border text-[10px] font-black ${T.sub}`}>
          {VIEWS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActiveView(id)} aria-pressed={activeView===id} aria-label={label}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition ${activeView===id ? T.btn : 'opacity-70 hover:opacity-100'}`}>
              <Icon className="w-3.5 h-3.5" aria-hidden="true"/><span className="hidden sm:inline" aria-hidden="true">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className={`w-6 h-6 motion-safe:animate-spin ${T.accent}`} aria-hidden="true" role="status" aria-label="Loading"/>
        </div>
      )}

      {/* ── PROJECTS VIEW ──────────────────────────────────────────── */}
      {!loading && activeView === 'projects' && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="font-black text-sm flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 opacity-70" aria-hidden="true"/> Font Projects
            <span className="ml-auto text-[10px] opacity-70">{projects.length} total</span>
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {projects.length === 0 && <p className="text-center py-8 opacity-60 text-sm">Projects නෑ.</p>}
            {projects.map(proj => (
              <div key={proj.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition ${T.sub} ${T.cardHover}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{proj.font_name}</div>
                  <div className="text-[10px] opacity-70 flex flex-wrap gap-x-3 mt-0.5">
                    <span>{proj.user_id?.slice(0,10)||'guest'}</span>
                    <span>{Object.keys(proj.glyphs||{}).length} glyphs</span>
                    <span>{new Date(proj.updated_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => togglePublic(proj)} aria-pressed={proj.is_public}
                    className={`text-[9px] font-black px-2 py-1 rounded-lg border flex items-center gap-1 transition ${proj.is_public ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'opacity-60 hover:opacity-90'}`}>
                    {proj.is_public ? <Eye className="w-3 h-3" aria-hidden="true"/> : <EyeOff className="w-3 h-3" aria-hidden="true"/>}
                    {proj.is_public ? 'Public' : 'Private'}
                  </button>
                  <button onClick={() => setDeleteTarget(proj)} aria-label={`Delete project ${proj.font_name}`}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition">
                    <Trash2 className="w-4 h-4" aria-hidden="true"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS VIEW ─────────────────────────────────────────────── */}
      {!loading && activeView === 'users' && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="font-black text-sm flex items-center gap-2 mb-4">
            <UserCheck className="w-4 h-4 opacity-70" aria-hidden="true"/> User Roles & Access
            <span className="ml-auto text-[10px] opacity-70">{userRoles.length} users</span>
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {userRoles.length === 0 && <p className="text-center py-8 opacity-60 text-sm">User roles නෑ.</p>}
            {userRoles.map(u => (
              <div key={u.id} className={`flex items-center gap-3 p-3.5 rounded-xl border ${T.sub}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs truncate font-mono">{u.user_id?.slice(0,20)}…</div>
                  <div className="text-[10px] opacity-70 mt-0.5">
                    Granted by: {u.granted_by?.slice(0,8)||'system'} · {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <select
                  value={u.role}
                  onChange={e => updateUserRole(u.user_id, e.target.value)}
                  aria-label={`Role for user ${u.user_id?.slice(0,10)}`}
                  className={`text-[10px] font-black border px-2 py-1.5 rounded-lg focus:outline-none ${T.input} ${ROLE_COLORS[u.role]||''}`}
                >
                  {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIVE METRICS VIEW ──────────────────────────────────────── */}
      {!loading && activeView === 'metrics' && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="font-black text-sm flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 opacity-70" aria-hidden="true"/> Live Platform Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label:'font_projects rows',  val: projects.length,   max: 10000, color: '#3b82f6' },
              { label:'user_roles rows',     val: userRoles.length,  max: 1000,  color: '#8b5cf6' },
              { label:'audit_log rows',      val: auditLog.length,   max: 50000, color: '#f59e0b' },
              { label:'Glyphs in DB',        val: totalGlyphs,       max: 100000,color: '#10b981' },
            ].map(({ label, val, max, color }) => {
              const pct = Math.min(100, Math.round((val / max) * 100));
              return (
                <div key={label} className={`p-4 rounded-xl border ${T.sub}`}>
                  <div className="flex justify-between text-[10px] font-bold mb-2 opacity-70">
                    <span>{label}</span>
                    <span className="font-mono">{val.toLocaleString()} / {max.toLocaleString()}</span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden`} style={{ background:'rgba(148,163,184,0.15)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, backgroundColor: color }}/>
                  </div>
                  <p className="text-[9px] opacity-60 mt-1">{pct}% used</p>
                </div>
              );
            })}
          </div>
          {dbStats && (
            <div className={`mt-4 p-4 rounded-xl border text-xs font-mono opacity-60 ${T.sub}`}>
              <p className="font-black mb-2 opacity-80">Table Sizes (pg_total_relation_size):</p>
              {dbStats.map((row, i) => (
                <div key={i} className="flex justify-between">{row.table_name}: {row.total_size}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG VIEW ─────────────────────────────────────────── */}
      {!loading && activeView === 'audit' && (
        <div className={`p-5 rounded-2xl border ${T.card}`}>
          <h3 className="font-black text-sm flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 opacity-70" aria-hidden="true"/> Audit Log
            <span className="ml-auto text-[10px] opacity-70">{auditLog.length} entries</span>
          </h3>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {auditLog.length === 0 && <p className="text-center py-8 opacity-60 text-sm">Audit entries නෑ.</p>}
            {auditLog.map(log => (
              <div key={log.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] ${T.sub}`}>
                <span className="font-mono opacity-60 flex-shrink-0">{new Date(log.created_at).toLocaleTimeString('en-GB')}</span>
                <span className={`font-black ${T.accent} flex-shrink-0`}>{log.action}</span>
                <span className="opacity-60 truncate flex-1">{log.target}</span>
                <span className="opacity-25 flex-shrink-0 font-mono">{log.user_id?.slice(0,8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DIAGNOSTICS VIEW ───────────────────────────────────────── */}
      {!loading && activeView === 'diagnostics' && (
        <DiagnosticsPanel supabase={supabase} T={T} />
      )}

      {/* Copyright footer */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${T.sub}`}>
        <Shield className="w-4 h-4 opacity-60 flex-shrink-0 mt-0.5" aria-hidden="true"/>
        <div className="space-y-1">
          <p className="text-[9px] opacity-60 leading-relaxed">
            {fullVersionLine()}. Admin console access is logged.
            Unauthorized access or redistribution is strictly prohibited.
          </p>
          <p className="text-[8px] font-mono opacity-30" title="Auto-generated on every deploy — confirms exactly which build is live">
            Build: {buildStamp()}
          </p>
        </div>
      </div>
    </div>
  );
}
