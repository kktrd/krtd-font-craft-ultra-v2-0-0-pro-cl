/**
 * KRTD Agent — AI provider layer (server-side only).
 * Supports Google Gemini, Z.AI (GLM, OpenAI-compatible) and Anthropic Claude.
 *
 * Env vars (Vercel -> Settings -> Environment Variables), set ANY of them:
 *   GEMINI_API_KEY  (or GOOGLE_API_KEY)   optional GEMINI_MODEL   default: gemini-flash-latest
 *   ZAI_API_KEY                           optional ZAI_MODEL      default: glm-5.2
 *                                         optional ZAI_BASE_URL   default: https://api.z.ai/api/paas/v4
 *   ANTHROPIC_API_KEY                     optional ANTHROPIC_MODEL default: claude-sonnet-5-5
 *   AI_PROVIDER = auto | gemini | zai | anthropic   (default auto)
 *
 * auto order = gemini -> anthropic -> zai  (Gemini first: best Sinhala/Unicode quality).
 * If the chosen provider fails (quota, outage, blocked answer) the next configured one is tried.
 * File name starts with "_" so Vercel does not expose it as a route.
 */

export const PROVIDER_LABELS = { gemini: 'Gemini AI', zai: 'Z.AI GLM', anthropic: 'Claude AI' };
const AUTO_ORDER = ['gemini', 'anthropic', 'zai'];

const keyOf = (env, id) => (id === 'gemini'
  ? (env.GEMINI_API_KEY || env.GOOGLE_API_KEY)
  : id === 'zai' ? env.ZAI_API_KEY : env.ANTHROPIC_API_KEY) || '';

/** Providers that have a key, in the order they should be tried. */
export function configuredProviders(env = process.env) {
  const available = AUTO_ORDER.filter((id) => keyOf(env, id));
  const pref = String(env.AI_PROVIDER || 'auto').toLowerCase().trim();
  if (pref !== 'auto' && available.includes(pref)) return [pref, ...available.filter((x) => x !== pref)];
  return available;
}

const trimBase = (u) => String(u).replace(/\/+$/, '');

async function post(url, headers, body, signal) {
  const r = await fetch(url, { method: 'POST', signal, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!r.ok) { const e = new Error(`http_${r.status}`); e.code = `llm_http_${r.status}`; throw e; }
  return r.json();
}

const CALLERS = {
  async gemini({ env, system, user, signal }) {
    const model = env.GEMINI_MODEL || 'gemini-flash-latest';
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { 'x-goog-api-key': keyOf(env, 'gemini') },
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        // generous token budget: "thinking" models spend part of it before answering
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: 'application/json' },
      },
      signal,
    );
    if (data?.promptFeedback?.blockReason) { const e = new Error('blocked'); e.code = 'llm_blocked'; throw e; }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
    if (!text) { const e = new Error('empty'); e.code = 'llm_empty'; throw e; }
    return text;
  },

  async zai({ env, system, user, signal }) {
    const base = trimBase(env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4');
    const data = await post(
      `${base}/chat/completions`,
      { authorization: `Bearer ${keyOf(env, 'zai')}` },
      {
        model: env.ZAI_MODEL || 'glm-5.2',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.3, max_tokens: 2048, stream: false,
        response_format: { type: 'json_object' },
      },
      signal,
    );
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) { const e = new Error('empty'); e.code = 'llm_empty'; throw e; }
    return text;
  },

  async anthropic({ env, system, user, signal }) {
    const data = await post(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': keyOf(env, 'anthropic'), 'anthropic-version': '2023-06-01' },
      { model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1024, temperature: 0.3, system, messages: [{ role: 'user', content: user }] },
      signal,
    );
    const text = (data?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (!text) { const e = new Error('empty'); e.code = 'llm_empty'; throw e; }
    return text;
  },
};

/** Tries each configured provider until one answers. Returns { provider, text }. */
export async function generate({ system, user, env = process.env, signal }) {
  const list = configuredProviders(env);
  if (!list.length) { const e = new Error('none'); e.code = 'llm_not_configured'; throw e; }
  let lastCode = 'llm_unreachable';
  for (const id of list) {
    try {
      const text = await CALLERS[id]({ env, system, user, signal });
      return { provider: id, text };
    } catch (err) {
      if (err?.name === 'AbortError') { lastCode = 'llm_timeout'; break; }
      lastCode = err?.code || 'llm_unreachable';
    }
  }
  const e = new Error(lastCode); e.code = lastCode; throw e;
}
