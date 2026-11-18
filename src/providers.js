// providers.js — one generate() interface over Workers AI (primary, via the
// [ai] binding on the dedicated Lyra account) and OpenRouter (fallback).
// Models verified live on the account on 2026-11-18 (bake-off):
//   quality: llama-3.3-70b fp8-fast — followed the output contract exactly
//   fast:    llama-3.1-8b fp8       — inline mode / short tasks
//   alt:     llama-4-scout          — second Workers AI attempt
// OpenRouter free ids churn monthly; the chain is best-effort and only runs
// when OPENROUTER_API_KEY is set. Re-verify per model before relying on it.

const WAI_QUALITY = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const WAI_FAST = "@cf/meta/llama-3.1-8b-instruct-fp8";
const WAI_ALT = "@cf/meta/llama-4-scout-17b-16e-instruct";

const OR_CHAIN = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemma-3-27b-it:free",
];

async function workersAI(env, model, system, user, maxTokens) {
  const out = await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
  });
  const text = out && (out.response || "");
  if (!text) throw new Error(`Workers AI ${model}: empty response`);
  return text;
}

async function openRouter(env, model, system, user, maxTokens) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "X-Title": "Lyra Prompt Master",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!res.ok || !text) throw new Error(`OpenRouter ${model}: HTTP ${res.status}`);
  return text;
}

// Returns { text, via }. Throws only when every provider failed.
export async function generate(env, { system, user, fast = false, maxTokens = 1200 }) {
  const errors = [];
  const waiOrder = fast ? [WAI_FAST, WAI_QUALITY] : [WAI_QUALITY, WAI_ALT];
  if (env.AI) {
    for (const model of waiOrder) {
      try {
        return { text: await workersAI(env, model, system, user, maxTokens), via: model };
      } catch (e) {
        errors.push(String(e && e.message || e));
      }
    }
  }
  if (env.OPENROUTER_API_KEY) {
    for (const model of OR_CHAIN) {
      try {
        return { text: await openRouter(env, model, system, user, maxTokens), via: model };
      } catch (e) {
        errors.push(String(e && e.message || e));
      }
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ").slice(0, 500)}`);
}
