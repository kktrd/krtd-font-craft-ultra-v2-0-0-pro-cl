// Small pure helpers for the right-hand tool panel tabs.

export const PANEL_TABS = [
  { id: 'metrics', label: 'Metrics', si: 'මිනුම්' },
  { id: 'check',   label: 'Check',   si: 'පරීක්ෂා' },
  { id: 'info',    label: 'Info',    si: 'විස්තර' },
  { id: 'export',  label: 'Export',  si: 'Export' },
];
export const TAB_KEY = 'krtd_panel_tab_v1';

export const isTabId = (id) => PANEL_TABS.some((t) => t.id === id);

/** Keyboard navigation for a tablist (WAI-ARIA): arrows wrap, Home / End jump. Returns the new tab id or null. */
export function nextTab(current, key, tabs = PANEL_TABS) {
  const i = tabs.findIndex((t) => t.id === current);
  if (i < 0) return tabs.length ? tabs[0].id : null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return tabs[(i + 1) % tabs.length].id;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return tabs[(i - 1 + tabs.length) % tabs.length].id;
  if (key === 'Home') return tabs[0].id;
  if (key === 'End') return tabs[tabs.length - 1].id;
  return null;
}

export function loadTab() {
  try { const v = localStorage.getItem(TAB_KEY); return isTabId(v) ? v : 'metrics'; }
  catch { return 'metrics'; }
}
export function saveTab(id) {
  try { if (isTabId(id)) localStorage.setItem(TAB_KEY, id); } catch { /* storage blocked */ }
}
