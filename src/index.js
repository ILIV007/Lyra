import bot from './bot.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Webhook handler
    if (request.method === 'POST' && path === '/webhook') {
      const update = await request.json();
      ctx.waitUntil(bot.handleUpdate(update, env));
      return new Response('OK');
    }

    // Debug endpoints (single handler call)
    if (path.startsWith('/debug')) {
      return handleDebug(request, env, path);
    }

    // Status page
    if (path === '/' || path === '/status') {
      return new Response(JSON.stringify({
        status: 'running',
        bot: 'Lyra',
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fallback
    return new Response('Not Found', { status: 404 });
  }
};

// Separate debug router function (no changes needed)
async function handleDebug(request, env, path) {
  const url = new URL(request.url);
  const subPath = path.replace('/debug', '') || '/';
  const authKey = url.searchParams.get('key');

  // Optional: require ?key=DEBUG_KEY from secret
  if (env.DEBUG_KEY && authKey !== env.DEBUG_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    switch (subPath) {
      case '/':
      case '/overview':
        return debugOverview(env);
      case '/telegram':
        return debugTelegram(env);
      case '/openrouter':
        return debugOpenRouter(env);
      case '/kv':
        return debugKV(env);
      case '/env':
        return debugEnv(env);
      case '/test-update':
        return debugTestUpdate(env, url);
      default:
        return new Response(JSON.stringify({
          error: 'Unknown debug endpoint',
          available: ['/', '/telegram', '/openrouter', '/kv', '/env', '/test-update']
        }), { status: 404 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500 });
  }
}

// Individual debug handlers
async function debugOverview(env) {
  const info = {
    status: 'running',
    bot: 'Lyra',
    version: '1.0.0',
    telegram: env.TELEGRAM_TOKEN ? '✅ configured' : '❌ missing',
    openrouter: env.OPENROUTER_API_KEY ? '✅ configured' : '❌ missing',
    debug: env.DEBUG_KEY ? '✅ protected' : '⚠️ no key (open access)',
    kv: env.LYRA_STATE ? '✅ bound' : '❌ not bound',
    model: env.OPENROUTER_MODEL || 'default',
    lang: env.BOT_LANGUAGE || 'en',
    timestamp: new Date().toISOString()
  };
  return json(info);
}

async function debugTelegram(env) {
  if (!env.TELEGRAM_TOKEN) {
    return json({ error: 'TELEGRAM_TOKEN not set' }, 400);
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getMe`);
    const data = await res.json();
    if (data.ok) {
      const webhookRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getWebhookInfo`);
      const webhookData = await webhookRes.json();
      return json({
        bot: data.result,
        webhook: webhookData.ok ? webhookData.result : webhookData,
        token_preview: env.TELEGRAM_TOKEN.slice(0, 8) + '...'
      });
    }
    return json({ error: 'Invalid token', response: data }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function debugOpenRouter(env) {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY not set' }, 400);
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}` }
    });
    const data = await res.json();
    return json({
      auth: data,
      model: env.OPENROUTER_MODEL || 'default',
      key_preview: env.OPENROUTER_API_KEY.slice(0, 8) + '...'
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function debugKV(env) {
  if (!env.LYRA_STATE) {
    return json({ error: 'LYRA_STATE KV namespace not bound' }, 400);
  }
  try {
    const keys = [];
    let cursor;
    do {
      const list = await env.LYRA_STATE.list({ cursor, limit: 100 });
      keys.push(...list.keys);
      cursor = list.cursor;
    } while (cursor);
    const entries = [];
    for (const key of keys.slice(0, 20)) {
      const val = await env.LYRA_STATE.get(key.name, 'json');
      entries.push({ key: key.name, value: val });
    }
    return json({
      total_keys: keys.length,
      shown: entries.length,
      entries,
      truncated: keys.length > 20
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function debugEnv(env) {
  const safe = {};
  for (const [k, v] of Object.entries(env)) {
    if (k === 'TELEGRAM_TOKEN' || k === 'OPENROUTER_API_KEY' || k === 'DEBUG_KEY') {
      safe[k] = v ? v.slice(0, 8) + '...' : null;
    } else {
      safe[k] = v;
    }
  }
  return json({ env: safe });
}

async function debugTestUpdate(env, url) {
  const chatId = url.searchParams.get('chat_id');
  const text = url.searchParams.get('text') || 'Hello from Lyra debug!';
  if (!chatId) {
    return json({ error: 'Provide ?chat_id=... to send a test message' }, 400);
  }
  if (!env.TELEGRAM_TOKEN) {
    return json({ error: 'TELEGRAM_TOKEN not set' }, 400);
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: parseInt(chatId),
        text: '`⚙️ Debug Test`\n\n' + text,
        parse_mode: 'Markdown'
      })
    });
    const data = await res.json();
    return json({ ok: data.ok, result: data.ok ? 'Message sent' : data.description });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}