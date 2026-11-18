// bot.js — update gatekeeper: dedupe + stale-update age gate, then dispatch.
// Telegram retries webhook deliveries, so the same update_id can arrive
// twice; an in-isolate LRU is enough (retries are short-lived).
import { handleUpdate } from "./handlers.js";

const seen = new Map();
const MAX_SEEN = 1000;
const MAX_AGE_MS = 5 * 60 * 1000; // drop message updates older than 5 minutes

export async function processUpdate(env, update) {
  const id = update.update_id;
  if (id != null) {
    if (seen.has(id)) return;
    seen.set(id, 1);
    if (seen.size > MAX_SEEN) seen.delete(seen.keys().next().value);
  }
  const msg = update.message || update.edited_message;
  if (msg && msg.date && Date.now() - msg.date * 1000 > MAX_AGE_MS) return;
  try {
    await handleUpdate(env, update);
  } catch (e) {
    // Never let one bad update poison the webhook; log and move on.
    console.error("handleUpdate failed:", String(e && e.stack || e));
  }
}
