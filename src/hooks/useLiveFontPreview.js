import { useState, useEffect, useRef } from 'react';
import { compileFontDataURL } from '../utils/fontCompiler.js';
import { FEATURE_FLAGS } from '../utils/featureFlags.js';

const PREVIEW_FAMILY = 'KRTDLivePreview';
const DEBOUNCE_MS = 1500;

/**
 * useLiveFontPreview — Part 3.1
 * Bridges Canvas Studio -> Text Studio: as the user draws/adjusts metrics,
 * compiles an in-memory base64 TTF and injects it as a live @font-face rule
 * so Text Studio can render real output using the user's ACTUAL drawn font
 * instead of a generic Noto Sans Sinhala placeholder.
 *
 * Non-breaking: if disabled via feature flag, returns previewReady=false
 * permanently and Text Studio's existing fallback font rendering is
 * completely untouched.
 */
export function useLiveFontPreview(fontName, metrics, glyphs) {
  const [previewReady, setPreviewReady] = useState(false);
  const [isCompiling,  setIsCompiling]  = useState(false);
  const [glyphCount,   setGlyphCount]   = useState(0);
  const [compileError, setCompileError] = useState(null);

  const styleElRef = useRef(null);
  const timerRef    = useRef(null);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_LIVE_FONT_PREVIEW) return;

    const drawnCount = Object.values(glyphs).filter((s) => s?.length > 0).length;
    if (drawnCount === 0) {
      setPreviewReady(false);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsCompiling(true);
      setCompileError(null);
      try {
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
  }, [fontName, metrics, glyphs]);

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
