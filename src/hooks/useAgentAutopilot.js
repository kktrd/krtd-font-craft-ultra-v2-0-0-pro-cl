import { useEffect, useRef } from 'react';
import { isDrawn } from '../agent/pathPredictor.js';

/**
 * Autopilot: after the user finishes strokes on a glyph and stays idle for `idleMs`,
 * jump to the next predicted glyph. Any new stroke resets the timer; switching glyphs cancels it.
 */
export function useAgentAutopilot({ enabled, idleMs, strokes, selectedChar, getNext, onAdvance }) {
  const cbRef = useRef({ getNext, onAdvance });
  cbRef.current = { getNext, onAdvance };

  useEffect(() => {
    if (!enabled || !isDrawn(strokes)) return undefined;
    const t = setTimeout(() => {
      const next = cbRef.current.getNext(selectedChar);
      if (next) cbRef.current.onAdvance(next);
    }, idleMs);
    return () => clearTimeout(t);
  }, [enabled, idleMs, strokes, selectedChar]);
}
