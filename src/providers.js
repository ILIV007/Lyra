// providers.js — generate() walks a fallback CHAIN, in order:
//   1. Workers AI models (the [ai] binding on the dedicated Lyra account)
//   2. OpenRouter models (only when OPENROUTER_API_KEY is set)
// A model "fails" on error, timeout, empty output, or validate()
// rejection — the chain moves on to the next model. generate() throws
// only when every model in the chain has failed.
//
// Every Workers AI model below was verified live on this account
// (bake-off + chain check, 2026-11-18). Deliberately excluded:
// gemma-3-12b-it (403 on this account) and the gpt-oss reasoning models
// (empty `response` field / token-hungry reasoning breaks the contract).
// Also verified and held in reserve: @cf/qwen/qwen2.5-coder-32b-instruct.
// OpenRouter free ids churn monthly; re-verify when the key is set.

export const WAI_QUALITY_CHAIN = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast", // bake-off winner
  "@cf/meta/llama-3.1-70b-instruct-fp8-fast",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/mistralai/mistral-small-3.1-24b-instruct", // different vendor: diversity
  "@cf/meta/llama-3.1-8b-instruct-fp8", // last-resort, always answers
];

export const WAI_FAST_CHAIN = [
  "@cf/meta/llama-3.1-8b-instruct-fp8",
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
];

export const OR_CHAIN = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "google/gemma-3-27b-it:free",
];

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function workersAI(env, model, system, user, maxTokens, timeoutMs) {
  const out = await withTimeout(env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
  }), timeoutMs, `Workers AI ${model}`);
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

// Returns { text, via }. `validate` (optional) checks the raw output —
// e.g. that it parses as a prompt; a rejection counts as a model failure
// and the chain moves on, so a weak fallback model that ignores the
// output format cannot end the request.
export async function generate(env, { system, user, fast = false, maxTokens = 1200, validate = null }) {
  const errors = [];
  const attempts = [];
  if (env.AI) {
    const chain = fast ? WAI_FAST_CHAIN : WAI_QUALITY_CHAIN;
    const timeoutMs = fast ? 20000 : 30000;
    for (const model of chain) {
      attempts.push(() => workersAI(env, model, system, user, maxTokens, timeoutMs));
    }
  }
  if (env.OPENROUTER_API_KEY) {
    for (const model of OR_CHAIN) {
      attempts.push(() => openRouter(env, model, system, user, maxTokens));
    }
  }
  const names = [
    ...(env.AI ? (fast ? WAI_FAST_CHAIN : WAI_QUALITY_CHAIN) : []),
    ...(env.OPENROUTER_API_KEY ? OR_CHAIN : []),
  ];
  for (let idx = 0; idx < attempts.length; idx++) {
    try {
      const text = await attempts[idx]();
      if (validate && !validate(text)) {
        errors.push(`${names[idx]}: output failed validation`);
        continue;
      }
      if (idx > 0) console.log(`generate: served by fallback #${idx} (${names[idx]})`);
      return { text, via: names[idx] };
    } catch (e) {
      errors.push(String(e && e.message || e));
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ").slice(0, 500)}`);
}
