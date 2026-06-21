// Free OpenRouter models ranked by quality (June 2026)
const MODELS = [
  'openrouter/free',
  'meta-llama/llama-4-maverick:free',
  'google/gemini-2.5-pro-preview-05-06:free',
  'qwen/qwq:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen3-235b-a22b:free'
];

const TIMEOUT = 30000;

function getModels(env) {
  const primary = env.OPENROUTER_MODEL;
  if (!primary || primary === MODELS[0]) return MODELS;
  const filtered = MODELS.filter(m => m !== primary);
  return [primary, ...filtered];
}

export async function enhanceWithAI(userText, systemPrompt, env) {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set in environment');
  const models = getModels(env);
  let lastError = '';

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/lyra-prompt-bot',
          'X-Title': 'Lyra Prompt Bot'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          temperature: 0.7,
          max_tokens: 2048
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
        lastError = `Empty response from ${model}`;
      } else {
        const errBody = await response.text().catch(() => '');
        lastError = `${model} (${response.status}): ${errBody.slice(0, 100)}`;
        console.warn(`OpenRouter model ${model} failed: ${lastError}`);
      }
    } catch (e) {
      lastError = `${model}: ${e.message}`;
      console.warn(`OpenRouter model ${model} error: ${e.message}`);
    }
  }

  throw new Error(`AI error. Last: ${lastError}`);
}
