/**
 * KRTD Version Info — single source of truth for version display.
 *
 * __APP_VERSION__, __BUILD_SHA__, __BUILD_DATE__ are injected at BUILD TIME
 * by vite.config.js (see `define` block there), reading directly from
 * package.json's "version" field and Vercel's automatic git-commit env var.
 *
 * This means:
 *   - Bumping the version is a ONE-LINE change in package.json — every
 *     place in the UI that shows a version updates automatically, with
 *     zero risk of the old "3 different hardcoded strings, already out of
 *     sync with each other" problem this replaced.
 *   - The build SHA changes automatically on every single Vercel deploy,
 *     with no manual step at all — useful for confirming exactly which
 *     commit is live, especially handy for cache-busting / support triage.
 *
 * Local dev (`npm run dev`, no Vercel env) falls back to buildSha = 'dev'.
 */

// eslint-disable-next-line no-undef
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
// eslint-disable-next-line no-undef
export const BUILD_SHA   = typeof __BUILD_SHA__   !== 'undefined' ? __BUILD_SHA__   : 'dev';
// eslint-disable-next-line no-undef
export const BUILD_DATE  = typeof __BUILD_DATE__  !== 'undefined' ? __BUILD_DATE__  : new Date().toISOString();

export const EDITION = 'PRO';

/** Short badge text, e.g. "v2.0.0 PRO" — used in compact UI spots (Header, Help modal). */
export function shortVersionLabel() {
  return `v${APP_VERSION} ${EDITION}`;
}

/** Full attribution line, e.g. "© 2026 KRTD Font Craft Ultra v2.0.0 PRO · Prabhath Lokuge" — Footer. */
export function fullVersionLine(author = 'Prabhath Lokuge') {
  const year = new Date(BUILD_DATE).getFullYear();
  return `© ${year} KRTD Font Craft Ultra v${APP_VERSION} ${EDITION} · ${author}`;
}

/** Detailed build stamp for diagnostics, e.g. "v2.0.0 · a1b2c3d · 2026-08-02" — Admin panel. */
export function buildStamp() {
  const date = BUILD_DATE.slice(0, 10); // YYYY-MM-DD
  return `v${APP_VERSION} · ${BUILD_SHA} · ${date}`;
}
