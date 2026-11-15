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
    <header className={`relative lg:sticky lg:top-0 lg:flex-shrink-0 z-30 safe-top border-b transition-all ${T.header}`}>
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 lg:py-2.5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-2 gap-y-2 lg:gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 lg:flex-none order-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-700 to-amber-950 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] sm:text-sm font-black tracking-tight leading-none truncate">KRTD FONT CRAFT<span className="hidden min-[420px]:inline"> ULTRA</span></h1>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border flex-shrink-0 ${T.accentBg}`}>{shortVersionLabel()}</span>
            </div>
            <p className="text-[9px] opacity-70 font-medium hidden sm:block leading-none mt-0.5">
              Sinhala Font Studio · TTF Export · Mirror Draw · Realtime Collab
            </p>
          </div>
        </div>

        {/* Controls */}
        <nav aria-label="Main navigation and settings" className="contents">
          <div aria-hidden="true" className="basis-full h-0 order-3 lg:hidden" />

          {/* Tabs */}
          <div role="tablist" aria-label="Workspace tabs" className={`flex p-0.5 rounded-xl border text-[11px] lg:text-[10px] font-black flex-1 lg:flex-none order-4 lg:order-2 min-w-0 ${T.sub}`}>
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                aria-label={label}
                onClick={() => setActiveTab(id)}
                className={`flex-1 lg:flex-none px-2 lg:px-2.5 py-2 lg:py-1.5 rounded-lg transition whitespace-nowrap ${activeTab === id ? T.btn : 'opacity-70 hover:opacity-100'}`}
              >
                {label.endsWith(' Studio') ? <>{label.replace(' Studio','')}<span className="hidden lg:inline"> Studio</span></> : label}
              </button>
            ))}
          </div>

          {/* Theme */}
          <div role="radiogroup" aria-label="Color theme" className={`flex p-0.5 rounded-xl border flex-shrink-0 order-5 lg:order-3 ${T.sub}`}>
            {THEME_OPTIONS.map(({ id, icon, active, label }) => (
              <button
                key={id}
                role="radio"
                aria-checked={theme === id}
                aria-label={label}
                title={label}
                onClick={() => setTheme(id)}
                className={`p-2.5 lg:p-2 rounded-lg transition ${theme === id ? active + ' shadow-sm' : 'opacity-35 hover:opacity-60'}`}
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 order-2 lg:order-4">
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
            <span className="hidden sm:inline" aria-hidden="true">{isOnline ? 'Cloud' : 'Offline'}</span>
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
          </div>
        </nav>
      </div>
    </header>
  );
}
