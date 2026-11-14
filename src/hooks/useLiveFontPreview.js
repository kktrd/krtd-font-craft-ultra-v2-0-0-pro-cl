import { useState, useEffect, useRef } from 'react';
import { FEATURE_FLAGS } from '../utils/featureFlags.js';
import { CONFIG_EVENT } from '../utils/settingsSync.js';

const PREVIEW_FAMILY = 'KRTDLivePreview';
const DEBOUNCE_MS = 1500;

/**
 * useLiveFontPreview — Part 3.1 (v1.1 — perf-audited)
 * Bridges Canvas Studio -> Text Studio: as the user draws/adjusts metrics,
 * compiles an in-memory base64 TTF and injects it as a live @font-face rule
 * so Text Studio can render real output using the user's ACTUAL drawn font
 * instead of a generic Noto Sans Sinhala placeholder.
 *
 * Perf notes (v1.1):
 *   - `compileFontDataURL` (and the opentype.js it pulls in) is now
 *     dynamically import()'d, not statically bundled — users who never
 *     touch Text Studio never download that code at all.
 *   - The whole effect is gated behind `enabled`. App.jsx only flips this
 *     true once the user has actually opened the Text Studio tab, so
 *     pure Canvas Studio users pay ZERO background compilation cost.
 *
 * Non-breaking: if disabled via feature flag or `enabled=false`, returns
 * previewReady=false permanently and Text Studio's existing fallback font
 * rendering is completely untouched.
 */
export function useLiveFontPreview(fontName, metrics, glyphs, enabled = true) {
  const [previewReady, setPreviewReady] = useState(false);
  const [isCompiling,  setIsCompiling]  = useState(false);
  const [glyphCount,   setGlyphCount]   = useState(0);
  const [compileError, setCompileError] = useState(null);

  const [configTick, setConfigTick] = useState(0);
  useEffect(() => {
    const bump = () => setConfigTick((t) => t + 1);
    window.addEventListener(CONFIG_EVENT, bump);
    return () => window.removeEventListener(CONFIG_EVENT, bump);
  }, []);

  const styleElRef = useRef(null);
  const timerRef    = useRef(null);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_LIVE_FONT_PREVIEW || !enabled) {
      setPreviewReady(false);
      return;
    }

    const drawnCount = Object.values(glyphs).filter((s) => s?.length > 0).length;
    if (drawnCount === 0) {
      setPreviewReady(false);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setIsCompiling(true);
      setCompileError(null);
      try {
        const { compileFontDataURL } = await import('../utils/fontCompiler.js');
        const { dataUrl, compiledCount } = compileFontDataURL(fontName, metrics, glyphs);

        if (!styleElRef.current) {
          const styleEl = document.createElement('style');
          styleEl.id = 'krtd-live-font-preview-style';
          document.head.appendChild(styleEl);
          styleElRef.current = styleEl;
        }
        styleElRef.current.textContent = `
          @font-face {
            font-family: '${PREVIEW_FAMILY}';
            src: url('${dataUrl}') format('truetype');
            font-display: swap;
          }
        `;
        setGlyphCount(compiledCount);
        setPreviewReady(true);
      } catch (err) {
        setPreviewReady(false);
        setCompileError(err.message);
      } finally {
        setIsCompiling(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [fontName, metrics, glyphs, enabled, configTick]);

  // Clean up the injected <style> tag when the app unmounts entirely
  useEffect(() => {
    return () => {
      if (styleElRef.current) {
        styleElRef.current.remove();
        styleElRef.current = null;
      }
    };
  }, []);

  return { previewReady, previewFamily: PREVIEW_FAMILY, isCompiling, glyphCount, compileError };
}
