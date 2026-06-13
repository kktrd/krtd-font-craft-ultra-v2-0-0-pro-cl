import React from 'react';
import {
  Sun, Moon, Eye, Wifi, WifiOff, HelpCircle, User, LogOut,
  Sparkles
} from 'lucide-react';

export default function Header({
  theme, setTheme, activeTab, setActiveTab,
  supabase, authUser, onLoginClick, onLogout,
  onHelpClick, T
}) {
  const TAB_LIST = [
    { id: 'canvas', label: 'Canvas Studio' },
    { id: 'text',   label: 'Text Studio'   },
    { id: 'admin',  label: 'Admin'          },
  ];

  return (
    <header className={`sticky top-0 z-30 border-b transition-all ${T.header}`}>
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 xs:gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-700 to-amber-950 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight truncate leading-none">KRTD FONT CRAFT ULTRA</h1>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 ${T.accentBg}`}>v2.0 PRO</span>
            </div>
            <p className="text-[9px] opacity-40 font-medium hidden sm:block leading-none mt-0.5">
              Sinhala Font Design Studio · Cloud Sync · RDP Vector Engine
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 w-full xs:w-auto flex-wrap xs:flex-nowrap">

          {/* Tab nav */}
          <div className={`flex p-0.5 rounded-xl border text-xs font-black flex-1 xs:flex-none ${T.sub}`}>
            {TAB_LIST.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                  activeTab === id ? T.btn : 'opacity-40 hover:opacity-70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Theme switcher */}
          <div className={`flex p-0.5 rounded-xl border flex-shrink-0 ${T.sub}`}>
            {[
              ['light',   <Sun   className="w-3.5 h-3.5" />, 'bg-white text-indigo-600'],
              ['dark',    <Moon  className="w-3.5 h-3.5" />, 'bg-slate-800 text-cyan-400'],
              ['comfort', <Eye   className="w-3.5 h-3.5" />, 'bg-[#4a3e2e] text-[#fdfbf7]'],
            ].map(([t, icon, activeClass]) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                title={`${t} theme`}
                className={`p-2 rounded-lg transition ${theme === t ? activeClass + ' shadow-sm' : 'opacity-35 hover:opacity-60'}`}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Cloud badge */}
          <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border flex-shrink-0 ${supabase ? T.online : T.offline}`}>
            {supabase
              ? <Wifi className="w-3 h-3 animate-pulse" />
              : <WifiOff className="w-3 h-3" />}
            <span className="hidden xs:inline">{supabase ? 'Cloud' : 'Offline'}</span>
          </span>

          {/* Auth */}
          {authUser
            ? (
              <button
                onClick={onLogout}
                className={`text-[10px] border px-2.5 py-1.5 rounded-xl flex items-center gap-1 flex-shrink-0 ${T.btnGhost}`}
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )
            : (
              <button
                onClick={onLoginClick}
                className={`text-[10px] border px-2.5 py-1.5 rounded-xl flex items-center gap-1 flex-shrink-0 ${T.accentBg}`}
              >
                <User className="w-3 h-3" />
                <span className="hidden sm:inline">Login</span>
              </button>
            )
          }

          {/* Help */}
          <button
            onClick={onHelpClick}
            className={`text-[10px] border p-1.5 rounded-xl flex-shrink-0 ${T.accentBg}`}
            title="Help Guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
