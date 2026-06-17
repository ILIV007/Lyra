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

// Individual debug handlers (placeholders filled with minimal valid bodies)
async function debugOverview(env) {
  return new Response('debugOverview not implemented yet', { status: 501 });
}
async function debugTelegram(env) {
  return new Response('debugTelegram not implemented yet', { status: 501 });
}
async function debugOpenRouter(env) {
  return new Response('debugOpenRouter not implemented yet', { status: 501 });
}
async function debugKV(env) {
  return new Response('debugKV not implemented yet', { status: 501 });
}
async function debugEnv(env) {
  return new Response('debugEnv not implemented yet', { status: 501 });
}
async function debugTestUpdate(env, url) {
  return new Response('debugTestUpdate not implemented yet', { status: 501 });
}