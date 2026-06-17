const FALLBACK_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct-v0.3:free',
  'qwen/qwen-2.5-7b-instruct:free'
];

const REQUEST_TIMEOUT = 60000;

function dedupeModels(models) {
  const seen = new Set();
  return models.filter(m => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

function buildModels(env) {
  return dedupeModels([
    env.OPENROUTER_MODEL || FALLBACK_MODELS[0],
    ...FALLBACK_MODELS
  ]);
}

async function apiFetch(model, messages, env, signal) {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/lyra-prompt-bot',
      'X-Title': 'Lyra Prompt Bot'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2048
    }),
    signal
  });
}

export async function enhanceWithAI(userText, systemPrompt, env) {
  const models = buildModels(env);
  let lastError = '';

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await apiFetch(model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ], env, controller.signal);

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) return content;
        lastError = `Empty response from ${model}`;
      } else {
        const errText = await response.text();
        lastError = `${model} (${response.status}): ${errText.slice(0, 200)}`;
      }
    } catch (e) {
      lastError = `${model}: ${e.message}`;
    }
  }

  throw new Error(`AI error. Last: ${lastError}`);
}

export async function streamAI(userText, systemPrompt, env, onChunk) {
  const models = buildModels(env);
  let lastError = '';

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

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
          max_tokens: 2048,
          stream: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        lastError = `${model} (${response.status}): ${errText.slice(0, 200)}`;
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk(fullText);
            }
          } catch {}
        }
      }

      return fullText;
    } catch (e) {
      lastError = `${model}: ${e.message}`;
    }
  }

  throw new Error(`AI streaming error. Last: ${lastError}`);
}