/**
 * KRTD Security & Copyright Protection Module v2.0
 * © 2026 Prabhath Lokuge / KRTD Studio. All rights reserved.
 * Unauthorized duplication or redistribution is strictly prohibited.
 */

const BUILD_SIGNATURE = 'KRTD-FCU-2.0.0-PRO';
const COPYRIGHT_YEAR  = 2026;
const AUTHOR          = 'Prabhath Lokuge';

/** Disable browser DevTools keyboard shortcuts */
export function installKeyboardGuard() {
  const handler = (e) => {
    if (e.repeat) return;
    // F12
    if (e.keyCode === 123) { e.preventDefault(); return false; }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) { e.preventDefault(); return false; }
    // Ctrl+U (view source)
    if (e.ctrlKey && e.keyCode === 85) { e.preventDefault(); return false; }
    // Ctrl+S (save page)
    if (e.ctrlKey && e.keyCode === 83) { e.preventDefault(); return false; }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

/** Block right-click context menu */
export function installContextMenuGuard() {
  const handler = (e) => e.preventDefault();
  window.addEventListener('contextmenu', handler);
  return () => window.removeEventListener('contextmenu', handler);
}

/** Block drag-and-drop on document (prevent accidental image reveals) */
export function installDragGuard() {
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  ['dragover', 'drop'].forEach(ev => document.addEventListener(ev, prevent));
  return () => ['dragover', 'drop'].forEach(ev => document.removeEventListener(ev, prevent));
}

/** Disable text/element selection on non-input areas */
export function installSelectionGuard() {
  const handler = (e) => {
    const tag = e.target.tagName;
    if (!['INPUT', 'TEXTAREA'].includes(tag)) e.preventDefault();
  };
  document.addEventListener('selectstart', handler);
  return () => document.removeEventListener('selectstart', handler);
}

/** Print copyright watermark to console (visible but styled) */
export function printConsoleBranding() {
  const styles = [
    'background: linear-gradient(135deg,#1a0a00,#4a2800); color:#FFD700; font-size:13px; font-weight:900; padding:8px 16px; border-radius:4px;',
    'color:#92400e; font-size:11px; font-weight:600; padding:4px 8px;',
    'color:#6b7280; font-size:10px; padding:2px 8px;',
  ];
  console.log('%c KRTD FONT CRAFT ULTRA v2.0.0 PRO ', styles[0]);
  console.log('%c © ' + COPYRIGHT_YEAR + ' ' + AUTHOR + ' | All Rights Reserved ', styles[1]);
  console.log('%c Build: ' + BUILD_SIGNATURE + ' | Unauthorized use is prohibited. ', styles[2]);
}

/** Obfuscated session token to detect cloned sessions */
export function generateSessionToken() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${BUILD_SIGNATURE}-${ts}-${rand}`.toUpperCase();
}

/** Verify localStorage hasn't been tampered with */
export function verifyStorageIntegrity(glyphs) {
  if (!glyphs) return true;
  try {
    JSON.stringify(glyphs); // will throw if circular
    return true;
  } catch {
    console.warn('[KRTD Security] Storage integrity check failed. Resetting.');
    localStorage.removeItem('krtd_font_craft_glyphs');
    return false;
  }
}

export const COPYRIGHT_NOTICE = `© ${COPYRIGHT_YEAR} KRTD Font Craft Ultra v2.0.0 PRO — ${AUTHOR}. Unauthorized code duplication or redistribution is strictly prohibited under applicable copyright law.`;
