import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useAutoSave — tracks last save timestamp and exposes human-readable label.
 * Returns { savedLabel, markSaved }
 */
export function useAutoSave() {
  const [savedAt, setSavedAt] = useState(null);
  const [label,   setLabel]   = useState('');
  const timerRef = useRef(null);

  const tick = useCallback(() => {
    if (!savedAt) return;
    const diff = Math.floor((Date.now() - savedAt) / 1000);
    if      (diff <  5)  setLabel('Saved just now');
    else if (diff < 60)  setLabel(`Saved ${diff}s ago`);
    else if (diff < 120) setLabel('Saved 1 min ago');
    else                 setLabel(`Saved ${Math.floor(diff/60)}m ago`);
  }, [savedAt]);

  useEffect(() => {
    tick();
    timerRef.current = setInterval(tick, 5000);
    return () => clearInterval(timerRef.current);
  }, [tick]);

  const markSaved = useCallback(() => setSavedAt(Date.now()), []);
  return { savedLabel: label, markSaved };
}
