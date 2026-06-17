export async function enhanceWithAI(userText, systemPrompt, env) {
  const model = env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

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
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function enhancePreset(userText, systemPrompt, env) {
  return enhanceWithAI(userText, systemPrompt, env);
}
