import { useEffect, useSyncExternalStore } from 'react';
import { getRef, subscribeRef, loadRef } from './referenceArt.js';

/** Current reference-artwork state (restored from storage on first use). */
export function useReferenceArt() {
  useEffect(() => { loadRef(); }, []);
  return useSyncExternalStore(subscribeRef, getRef, getRef);
}
