/**
 * KRTD Agent — Tier B (cloud AI: Gemini / Z.AI / Claude) client. Calls the Vercel function /api/agent
 * with the user's Supabase access token. Any failure returns {ok:false} so the
 * caller silently falls back to the local brain (the agent never "breaks").
 */
import { sanitizeActions } from './actionSchema.js';

const TIMEOUT_MS = 28000;
export const PROVIDER_LABELS = { gemini: 'Gemini AI', zai: 'Z.AI GLM', anthropic: 'Claude AI' };

export async function askClaude({ supabase, message, history, snapshot }) {
  return callAgent({ supabase, message, history, snapshot });
}

/** Which AI providers does the server have keys for? (no model call, no cost) */
export async function pingAI(supabase) {
  const r = await callAgent({ supabase, message: '__ping__', history: [], snapshot: {}, ping: true });
  return r.ok ? { ok: true, providers: r.providers } : r;
}

async function callAgent({ supabase, message, history, snapshot, ping = false }) {
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
      }),
    });
    if (!res.ok) {
      let code = `http_${res.status}`;
      try { const j = await res.json(); if (j?.error) code = j.error; } catch { /* ignore */ }
      return { ok: false, reason: code };
    }
    const data = await res.json();
    if (ping) return Array.isArray(data?.providers) ? { ok: true, providers: data.providers } : { ok: false, reason: 'bad_response' };
    if (typeof data?.reply !== 'string') return { ok: false, reason: 'bad_response' };
    return { ok: true, reply: data.reply, actions: sanitizeActions(data.actions, 4), provider: typeof data.provider === 'string' ? data.provider : null };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export const REASON_TEXT = {
  llm_not_configured: 'Cloud AI තවම ON කරලා නෑ (Vercel හි GEMINI_API_KEY / ZAI_API_KEY / ANTHROPIC_API_KEY නෑ) — local agent භාවිතා කරනවා.',
  not_signed_in: 'Cloud AI (Gemini / Claude / Z.AI) ඕන නම් Login වෙන්න (Designer). දැන් local agent භාවිතා කරනවා.',
  llm_blocked: 'AI එක මේ ප්‍රශ්නයට පිළිතුරු දුන්නේ නෑ (safety block) — local agent.',
  llm_timeout: 'AI එක ප්‍රමාද වැඩියි — local agent.',
  llm_empty: 'AI එකෙන් හිස් පිළිතුරක් ආවා — local agent.',
  no_cloud: 'Cloud සම්බන්ධ නෑ — local agent භාවිතා කරනවා.',
  rate_limited: 'Claude AI ඉල්ලීම් ගොඩක් — ටිකක් ඉඩ දීලා ආයෙ try කරන්න. දැන් local agent.',
  unauthorized: 'Login session එක කල් ඉකුත් වෙලා — ආයෙ login වෙන්න. දැන් local agent.',
};
