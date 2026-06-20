/**
 * KRTD Prediction Engine — Tier B Cloud Hook v1.0
 * Async next-word prediction via Supabase edge function endpoint.
 * Falls back silently to [] if offline or endpoint missing.
 *
 * Endpoint shape (deploy as Supabase Edge Function "predict"):
 *   POST { prefix: string, context: string[], limit: number }
 *   → { suggestions: string[] }
 */

const ENDPOINT_PATH = '/functions/v1/predict';
const TIMEOUT_MS    = 1800;

/**
 * fetchCloudSuggestions
 * @param {string} supabaseUrl  - VITE_SUPABASE_URL
 * @param {string} anonKey      - VITE_SUPABASE_ANON_KEY
 * @param {string} prefix       - current partial word (sinhala unicode)
 * @param {string[]} context    - last 3-5 words for context
 * @param {number} limit        - max suggestions
 * @returns {Promise<string[]>}
 */
export async function fetchCloudSuggestions(supabaseUrl, anonKey, prefix, context = [], limit = 5) {
  if (!supabaseUrl || !prefix || prefix.length < 1) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseUrl}${ENDPOINT_PATH}`, {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ prefix, context, limit }),
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.suggestions) ? data.suggestions.slice(0, limit) : [];
  } catch {
    clearTimeout(timer);
    return []; // silent fallback — Tier A trie still active
  }
}

/**
 * Edge Function scaffold — paste into Supabase Dashboard → Edge Functions → New Function "predict"
 *
 * import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 * serve(async (req) => {
 *   const { prefix, context, limit } = await req.json();
 *   // TODO: replace with real ML model or dictionary lookup
 *   const mockSuggestions = [prefix + "ය", prefix + "ට", prefix + "ෙන්"];
 *   return new Response(JSON.stringify({ suggestions: mockSuggestions.slice(0, limit) }),
 *     { headers: { "Content-Type": "application/json" } });
 * });
 */
