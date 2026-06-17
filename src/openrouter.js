const FALLBACK_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free'
];

const TIMEOUT = 15000;

function getModels(env) {
  const primary = env.OPENROUTER_MODEL || FALLBACK_MODELS[0];
  return primary === FALLBACK_MODELS[0] ? FALLBACK_MODELS : [primary, FALLBACK_MODELS[0]];
}

export async function enhanceWithAI(userText, systemPrompt, env) {
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
        lastError = `${model} (${response.status})`;
      }
    } catch (e) {
      lastError = `${model}: ${e.message}`;
    }
  }

  throw new Error(`AI error. Last: ${lastError}`);
}
