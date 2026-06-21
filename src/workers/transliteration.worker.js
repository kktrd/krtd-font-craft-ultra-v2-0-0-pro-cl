/**
 * KRTD Transliteration Web Worker — Part 1.3
 * Runs the Singlish -> Sinhala grapheme engine OFF the main UI thread.
 * Prevents layout jank on large multi-page paste operations.
 *
 * Vite bundles this as a separate module-worker chunk automatically when
 * instantiated via: new Worker(new URL('./transliteration.worker.js', import.meta.url), { type: 'module' })
 */
import { convertSinglishToSinhala } from '../utils/transliteration.js';

self.onmessage = (event) => {
  const { requestId, text } = event.data || {};
  try {
    const result = convertSinglishToSinhala(text || '');
    self.postMessage({ requestId, result, ok: true });
  } catch (err) {
    self.postMessage({ requestId, result: '', ok: false, error: err.message });
  }
};
