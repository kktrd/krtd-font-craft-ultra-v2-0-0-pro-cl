import { useRef, useEffect, useCallback } from 'react';
import { convertSinglishToSinhala } from '../utils/transliteration.js';
import { FEATURE_FLAGS } from '../utils/featureFlags.js';

/**
 * useTransliterationWorker — Part 1.3
 * Offloads Singlish->Sinhala conversion to a Web Worker so large pastes
 * never block the main UI thread. Falls back to synchronous main-thread
 * conversion automatically if:
 *   - the feature flag is off,
 *   - the browser doesn't support Workers,
 *   - or the worker fails to start for any reason.
 *
 * Every existing call site keeps working identically — convert() always
 * resolves with the same string convertSinglishToSinhala() would have
 * returned synchronously; only the execution location changes.
 */
export function useTransliterationWorker() {
  const workerRef    = useRef(null);
  const callbacksRef  = useRef(new Map());
  const requestIdRef  = useRef(0);
  const workerFailedRef = useRef(false);

  useEffect(() => {
    if (!FEATURE_FLAGS.ENABLE_WORKER_TRANSLITERATION) return;
    if (typeof Worker === 'undefined') { workerFailedRef.current = true; return; }

    let worker;
    try {
      worker = new Worker(
        new URL('../workers/transliteration.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch {
      workerFailedRef.current = true;
      return;
    }

    worker.onmessage = (e) => {
      const { requestId, result } = e.data || {};
      const cb = callbacksRef.current.get(requestId);
      if (cb) {
        cb(result);
        callbacksRef.current.delete(requestId);
      }
    };

    worker.onerror = () => {
      // Worker crashed at runtime — flip to fallback for all FUTURE calls.
      // Any in-flight callbacks are resolved synchronously so callers never hang.
      workerFailedRef.current = true;
      callbacksRef.current.forEach((cb) => cb(null)); // null signals "redo synchronously" to convert()
      callbacksRef.current.clear();
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  /**
   * convert — always returns a Promise<string>.
   * Race-safety is the CALLER's responsibility (compare requestId / use the
   * latest-call-wins pattern), since multiple convert() calls can resolve
   * out of order under heavy typing.
   */
  const convert = useCallback((text) => {
    return new Promise((resolve) => {
      if (
        !FEATURE_FLAGS.ENABLE_WORKER_TRANSLITERATION ||
        workerFailedRef.current ||
        !workerRef.current
      ) {
        resolve(convertSinglishToSinhala(text));
        return;
      }

      const id = ++requestIdRef.current;
      callbacksRef.current.set(id, (result) => {
        if (result === null) {
          // Worker died mid-flight — finish this request synchronously.
          resolve(convertSinglishToSinhala(text));
        } else {
          resolve(result);
        }
      });
      workerRef.current.postMessage({ requestId: id, text });
    });
  }, []);

  return { convert };
}
