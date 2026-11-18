// index.js — Worker entry: health + webhook with secret verification.
// No debug endpoints (v1 shipped open /debug/* routes; v2 has none).
import { processUpdate } from "./bot.js";

const VERSION = "2.3.0";

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
    return new Response("not found", { status: 404 });
  },
};
