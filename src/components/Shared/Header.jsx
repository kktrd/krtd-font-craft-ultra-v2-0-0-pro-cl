import React from 'react';
import { Sun, Moon, Eye, Wifi, WifiOff, HelpCircle, User, LogOut, Sparkles, Download, Users } from 'lucide-react';
import { shortVersionLabel } from '../../utils/versionInfo.js';

export default function Header({
  theme, setTheme, activeTab, setActiveTab,
  supabase, authUser, isOnline,
  onLoginClick, onLogout, onHelpClick,
  canInstall, onInstallClick, onlineCount,
  T
}) {
  const TABS = [
    { id: 'canvas', label: 'Canvas Studio' },
    { id: 'text',   label: 'Text Studio'   },
    { id: 'admin',  label: 'Admin'          },
  ];

  const THEME_OPTIONS = [
    { id: 'light',   icon: <Sun  className="w-3.5 h-3.5" aria-hidden="true"/>, active: 'bg-white text-indigo-600',     label: 'Light theme'   },
    { id: 'dark',    icon: <Moon className="w-3.5 h-3.5" aria-hidden="true"/>, active: 'bg-slate-800 text-cyan-400',    label: 'Dark theme'    },
    { id: 'comfort', icon: <Eye  className="w-3.5 h-3.5" aria-hidden="true"/>, active: "bg-[#4a3e2e] text-[#fdfbf7]",  label: 'Eye Comfort theme' },
  ];

  return (
    <header className={`sticky top-0 lg:flex-shrink-0 z-30 safe-top border-b transition-all ${T.header}`}>
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 xs:gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-700 to-amber-950 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight leading-none">KRTD FONT CRAFT ULTRA</h1>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 ${T.accentBg}`}>{shortVersionLabel()}</span>
            </div>
            <p className="text-[9px] opacity-70 font-medium hidden sm:block leading-none mt-0.5">
              Sinhala Font Studio · TTF Export · Mirror Draw · Realtime Collab
            </p>
          </div>
        </div>

        {/* Controls */}
        <nav aria-label="Main navigation and settings" className="flex items-center gap-2 w-full xs:w-auto flex-wrap xs:flex-nowrap">

          {/* Tabs */}
          <div role="tablist" aria-label="Workspace tabs" className={`flex p-0.5 rounded-xl border text-[10px] font-black flex-1 xs:flex-none ${T.sub}`}>
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${activeTab === id ? T.btn : 'opacity-70 hover:opacity-100'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Theme */}
          <div role="radiogroup" aria-label="Color theme" className={`flex p-0.5 rounded-xl border flex-shrink-0 ${T.sub}`}>
            {THEME_OPTIONS.map(({ id, icon, active, label }) => (
              <button
                key={id}
                role="radio"
                aria-checked={theme === id}
                aria-label={label}
                title={label}
                onClick={() => setTheme(id)}
                className={`p-2 rounded-lg transition ${theme === id ? active + ' shadow-sm' : 'opacity-35 hover:opacity-60'}`}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Online collaborators badge */}
          {onlineCount > 1 && (
            <span
              className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex-shrink-0"
              role="status"
              aria-label={`${onlineCount} designers online now`}
            >
              <Users className="w-3 h-3" aria-hidden="true"/>
              <span>{onlineCount}</span>
            </span>
          )}

          {/* Network badge */}
          <span
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border flex-shrink-0 ${isOnline ? T.online : T.offline}`}
            role="status"
            aria-label={isOnline ? 'Cloud connected' : 'Offline mode — changes saved locally'}
          >
            {isOnline
              ? <Wifi    className="w-3 h-3 motion-safe:animate-pulse" aria-hidden="true"/>
              : <WifiOff className="w-3 h-3" aria-hidden="true"/>}
            <span className="hidden xs:inline" aria-hidden="true">{isOnline ? 'Cloud' : 'Offline'}</span>
          </span>

          {/* Install App */}
          {canInstall && (
            <button
              onClick={onInstallClick}
              aria-label="Install KRTD Font Craft as an app"
              title="Install as App"
              className={`text-[10px] border px-2.5 py-1.5 rounded-xl flex items-center gap-1 flex-shrink-0 ${T.accentBg}`}
            >
              <Download className="w-3 h-3" aria-hidden="true"/>
              <span className="hidden sm:inline" aria-hidden="true">Install</span>
            </button>
          )}

          {/* Auth */}
          {authUser
            ? <button
                onClick={onLogout}
                aria-label="Log out"
                title="Log out"
                className={`text-[10px] border px-2.5 py-1.5 rounded-xl flex items-center gap-1 flex-shrink-0 ${T.btnGhost}`}
              >
                <LogOut className="w-3 h-3" aria-hidden="true"/>
                <span className="hidden sm:inline" aria-hidden="true">Logout</span>
              </button>
            : <button
                onClick={onLoginClick}
                aria-label="Log in"
                title="Log in"
                className={`text-[10px] border px-2.5 py-1.5 rounded-xl flex items-center gap-1 flex-shrink-0 ${T.accentBg}`}
              >
                <User className="w-3 h-3" aria-hidden="true"/>
                <span className="hidden sm:inline" aria-hidden="true">Login</span>
              </button>
          }

          <button
            onClick={onHelpClick}
            aria-label="Open help guide"
            title="Help"
            className={`text-[10px] border p-1.5 rounded-xl flex-shrink-0 ${T.accentBg}`}
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true"/>
          </button>
        </nav>
      </div>
    </header>
  );
}
