/**
 * KRTD Theme Token System v2.0
 * Centralized design tokens for light / dark / comfort themes.
 */

export const THEMES = ['light', 'dark', 'comfort'];

export function getTokens(theme) {
  const t = theme;
  return {
    // Layout backgrounds
    bg:         t==='dark' ? 'bg-[#020617] text-slate-100'        : t==='comfort' ? 'bg-[#f4f1ea] text-[#3a352a]'         : 'bg-slate-50 text-slate-800',
    card:       t==='dark' ? 'bg-slate-900/60 border-slate-800/80 backdrop-blur-xl' : t==='comfort' ? 'bg-[#fdfbf7] border-[#e2d9c5] shadow-sm' : 'bg-white border-slate-200 shadow-sm',
    cardHover:  t==='dark' ? 'hover:bg-slate-800/60'              : t==='comfort' ? 'hover:bg-[#f9f6ef]'                  : 'hover:bg-slate-50',
    sub:        t==='dark' ? 'bg-slate-950/70 border-slate-900'   : t==='comfort' ? 'bg-[#f7f4ed] border-[#e6dfd3]'       : 'bg-slate-50 border-slate-200',
    header:     t==='dark' ? 'bg-slate-950/90 border-slate-800/80 backdrop-blur-xl' : t==='comfort' ? 'bg-[#faf7f0]/95 border-[#e2d9c5] backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md',

    // Text & accent
    accent:     t==='dark' ? 'text-cyan-400'    : t==='comfort' ? 'text-amber-800'   : 'text-indigo-600',
    accentHex:  t==='dark' ? '#22d3ee'          : t==='comfort' ? '#92400e'          : '#4f46e5',
    accentBg:   t==='dark' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'   : t==='comfort' ? 'bg-amber-700/10 border-amber-700/20 text-amber-800' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600',
    muted:      t==='dark' ? 'text-slate-400'   : t==='comfort' ? 'text-[#8a7a65]'  : 'text-slate-500',
    divider:    t==='dark' ? 'border-slate-800/60' : t==='comfort' ? 'border-[#e2d9c5]' : 'border-slate-200',

    // Inputs
    input:      t==='dark' ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20' : t==='comfort' ? 'bg-[#fdfbf7] border-[#d5cabb] text-[#3a352a] placeholder-[#b0a18a] focus:border-amber-600 focus:ring-1 focus:ring-amber-600/20' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20',

    // Buttons
    btn:        t==='dark' ? 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold' : t==='comfort' ? 'bg-amber-800 hover:bg-amber-900 text-white font-bold' : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold',
    btnGhost:   t==='dark' ? 'bg-white/5 hover:bg-white/10 border-slate-800 text-slate-300' : t==='comfort' ? 'bg-[#f4f1ea] hover:bg-[#ede9e1] border-[#e2d9c5] text-[#5a4e3c]' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700',
    btnDanger:  'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-500',

    // Glyph buttons
    glyphSel:   t==='dark' ? 'bg-gradient-to-br from-cyan-600 to-indigo-700 border-cyan-400 text-white shadow-lg shadow-cyan-500/20' : t==='comfort' ? 'bg-gradient-to-br from-amber-700 to-amber-950 border-amber-600 text-white shadow-md shadow-amber-900/20' : 'bg-gradient-to-br from-indigo-600 to-indigo-800 border-indigo-500 text-white shadow-md shadow-indigo-500/20',
    glyphIdle:  t==='dark' ? 'bg-slate-950/50 border-slate-800/60 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300' : t==='comfort' ? 'bg-[#faf8f2] border-[#e9e3d5] text-[#6b5f4c] hover:border-amber-400/50 hover:text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700',

    // Canvas
    canvasBg:   t==='dark' ? 'bg-[#020617] border-slate-800'  : t==='comfort' ? 'bg-[#fdfbf7] border-[#e2d9c5]'  : 'bg-white border-slate-200',

    // Canvas draw/erase colors
    inkColor:   t==='dark' ? '#38bdf8' : t==='comfort' ? '#4a3e2e' : '#1e1b4b',
    eraseColor: t==='dark' ? '#020617' : t==='comfort' ? '#fdfbf7' : '#ffffff',

    // Redraw ink
    inkColorRedraw: t==='dark' ? '#38bdf8' : t==='comfort' ? '#3d3025' : '#1e3a8a',

    // Metric line colors
    metricColors: {
      ascender:  '#c084fc',
      capHeight: '#f472b6',
      xHeight:   '#3b82f6',
      baseline:  '#ef4444',
      descender: '#fb923c',
    },

    // Status badges
    online:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    offline: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
  };
}
