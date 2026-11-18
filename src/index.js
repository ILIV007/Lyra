// index.js — Worker entry: health + webhook with secret verification.
// No debug endpoints (v1 shipped open /debug/* routes; v2 has none).
import { processUpdate } from "./bot.js";
import { runHeartbeat } from "./handlers.js";

const VERSION = "2.7.1";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({ ok: true, service: "lyra", version: VERSION });
    }
    if (request.method === "POST" && url.pathname === "/webhook") {
      if (!env.WEBHOOK_SECRET || !env.TELEGRAM_TOKEN) {
        return Response.json({ ok: false, error: "not configured" }, { status: 503 });
      }
      const secret = request.headers.get("x-telegram-bot-api-secret-token");
      if (secret !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      let update;
      try {
        update = await request.json();
      } catch {
        return new Response("bad request", { status: 400 });
      }
      // Instant 200; the work happens in waitUntil so Telegram never
      // retries a slow (AI-bound) delivery.
      ctx.waitUntil(processUpdate(env, update));
      return Response.json({ ok: true });
    }
    // Ops only: manually fire the heartbeat logic (same secret as the
    // webhook). The 15-day gate inside runHeartbeat still applies, so
    // this can never spam — it exists to verify the cron path live.
    if (request.method === "POST" && url.pathname === "/heartbeat") {
      if (!env.WEBHOOK_SECRET || request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      ctx.waitUntil(runHeartbeat(env));
      return Response.json({ ok: true });
    }
    return new Response("not found", { status: 404 });
  },

  // Daily cron trigger; runHeartbeat itself gates to one send per
  // 15-day epoch, so the other 14 days are silent no-ops.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runHeartbeat(env));
  },
};
