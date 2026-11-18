// store.js — KV wrapper with write discipline (free tier: ~1k writes/day).
// One merged record per user (u:<id>), an id index (uids), TTL'd rate keys.

export function defaultUser(id, lang = "en") {
  return {
    id,
    lang,
    bundle: "standard", // the Mode: standard | ponytail | caveman | code | image | video
    style: "standard", // legacy (pre-v2.4) — the bundle now drives style/category
    level: { ponytail: "full", caveman: "standard" },
    platform: "chatgpt", // legacy (pre-v2.4) — no platform picker any more
    mode: "basic", // basic | detail (question depth)
    flow: null, // { name, answers?, lastIdea?, lastPrompt? }
    flowMsg: null, // last flow/menu screen message id (deleted on generation)
    keep: [], // deliverable message ids (result cards, bank items): never deleted
    home: null, // home message id (edited in place)
    n: 0, // prompts generated
    first: Date.now(),
    last: Date.now(),
  };
}

export function createStore(env) {
  const kv = env.LYRA_STATE;
  return {
    async getUser(id) {
      const raw = await kv.get(`u:${id}`);
      if (!raw) return null;
      try { return { ...defaultUser(id), ...JSON.parse(raw) }; } catch { return null; }
    },
    async saveUser(u) {
      u.last = Date.now();
      await kv.put(`u:${u.id}`, JSON.stringify(u));
    },
    async registerId(id) {
      const raw = await kv.get("uids");
      const ids = raw ? JSON.parse(raw) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        await kv.put("uids", JSON.stringify(ids));
      }
      return ids.length;
    },
    async getIds() {
      const raw = await kv.get("uids");
      return raw ? JSON.parse(raw) : [];
    },
    // Per-user generation rate limit: returns true if allowed.
    // One read + one write, only on generate actions.
    async rateOk(id, max = 8) {
      const key = `rl:${id}`;
      const cur = parseInt((await kv.get(key)) || "0", 10);
      if (cur >= max) return false;
      await kv.put(key, String(cur + 1), { expirationTtl: 70 });
      return true;
    },
  };
}
