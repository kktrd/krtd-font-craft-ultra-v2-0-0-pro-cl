/**
 * KRTD Agent — Tier B (cloud AI: Gemini / Z.AI / Claude) client. Calls the Vercel function /api/agent
 * with the user's Supabase access token. Any failure returns {ok:false} so the
 * caller silently falls back to the local brain (the agent never "breaks").
 */
import { sanitizeActions } from './actionSchema.js';

const TIMEOUT_MS = 28000;
/** Developer-only labels (Admin -> Diagnostics). Never shown to regular users. */
export const PROVIDER_LABELS = { gemini: 'Google Gemini', zai: 'Z.AI GLM', anthropic: 'Anthropic Claude' };

export async function askAI({ supabase, message, history, snapshot }) {
  return callAgent({ supabase, message, history, snapshot });
}

/**
 * Is cloud AI switched on? (no model call, no cost). With detail=true the server only
 * returns provider names/models to admins; everyone else just gets { enabled }.
 */
export async function pingAI(supabase, detail = false) {
  return callAgent({ supabase, message: '__ping__', history: [], snapshot: {}, ping: true, detail });
}

async function callAgent({ supabase, message, history, snapshot, ping = false, detail = false }) {
  if (!supabase) return { ok: false, reason: 'no_cloud' };
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch { /* ignore */ }
  if (!token) return { ok: false, reason: 'not_signed_in' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: String(message).slice(0, 600),
        history: (history || []).slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'agent', text: String(m.text).slice(0, 500) })),
        snapshot,
        ...(ping && detail ? { detail: true } : {}),
      }),
    });
    if (!res.ok) {
      let code = `http_${res.status}`;
      try { const j = await res.json(); if (j?.error) code = j.error; } catch { /* ignore */ }
      return { ok: false, reason: code };
    }
    const data = await res.json();
    if (ping) return data?.ok ? { ok: true, enabled: !!data.enabled, providers: Array.isArray(data.providers) ? data.providers : null, models: data.models || null } : { ok: false, reason: 'bad_response' };
    if (typeof data?.reply !== 'string') return { ok: false, reason: 'bad_response' };
    return { ok: true, reply: data.reply, actions: sanitizeActions(data.actions, 4) };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export const REASON_TEXT = {
  llm_not_configured: 'AI සහාය දැනට ලබාගත නොහැක — මගේ built-in දැනුමෙන් උත්සාහ කරනවා.',
  not_signed_in: 'ඕනෑම ප්‍රශ්නයකට AI සහාය ඕන නම් Login වෙන්න. දැන් built-in agent එකෙන් උත්සාහ කරනවා.',
  llm_blocked: 'මේ ප්‍රශ්නයට AI එකෙන් පිළිතුරක් ලැබුණේ නෑ — built-in agent එකෙන් උත්සාහ කරනවා.',
  llm_timeout: 'AI එක ප්‍රමාද වැඩියි — built-in agent එකෙන් උත්සාහ කරනවා.',
  llm_empty: 'AI එකෙන් පිළිතුරක් ආවේ නෑ — built-in agent එකෙන් උත්සාහ කරනවා.',
  no_cloud: 'Cloud සම්බන්ධ නෑ — built-in agent එකෙන් උත්සාහ කරනවා.',
  rate_limited: 'ඉල්ලීම් ගොඩක් — ටිකක් ඉඩ දීලා ආයෙ try කරන්න. දැන් built-in agent එකෙන් උත්සාහ කරනවා.',
  unauthorized: 'Login session එක කල් ඉකුත් වෙලා — ආයෙ login වෙන්න. දැන් built-in agent එකෙන් උත්සාහ කරනවා.',
};
