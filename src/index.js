import bot from './bot.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path === '/webhook') {
      const update = await request.json();
      ctx.waitUntil(bot.handleUpdate(update, env));
      return new Response('OK');
    }

    if (path === '/' || path === '/status') {
      return new Response(JSON.stringify({
        status: 'running',
        bot: 'Lyra',
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};