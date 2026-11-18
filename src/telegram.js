// telegram.js — raw Bot API client + entity-based formatting helpers.
// Formatting is built from segments so offsets are computed during assembly
// (UTF-16 code units = JS string length) — never by searching the final
// string, which breaks on localized text (the v1 Persian footer bug).

export class TgError extends Error {
  constructor(method, detail) {
    super(`Telegram ${method} failed: ${detail}`);
    this.method = method;
    this.detail = detail;
  }
}

export function createTelegram(token) {
  const base = `https://api.telegram.org/bot${token}`;
  async function call(method, body = {}) {
    const res = await fetch(`${base}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!data || !data.ok) {
      throw new TgError(method, data ? data.description : `HTTP ${res.status}`);
    }
    return data.result;
  }
  return { call };
}

// ---- segments -------------------------------------------------------------
// A segment is { text, type?, url? }. compose() flattens segments into
// { text, entities } with correct UTF-16 offsets.
export const tx = (text) => ({ text: String(text) });
export const b = (text) => ({ text: String(text), type: "bold" });
export const i = (text) => ({ text: String(text), type: "italic" });
export const code = (text) => ({ text: String(text), type: "code" });
export const pre = (text, language) => ({ text: String(text), type: "pre", language });
export const bq = (text, expandable = false) => ({
  text: String(text), type: expandable ? "expandable_blockquote" : "blockquote",
});
export const spoiler = (text) => ({ text: String(text), type: "spoiler" });
export const lnk = (text, url) => ({ text: String(text), type: "text_link", url });

export function compose(...segs) {
  let text = "";
  const entities = [];
  for (const s of segs.flat()) {
    if (!s || !s.text) continue;
    if (s.type) {
      const e = { type: s.type, offset: text.length, length: s.text.length };
      if (s.url) e.url = s.url;
      if (s.language) e.language = s.language;
      entities.push(e);
    }
    text += s.text;
  }
  return { text, entities };
}

// ---- splitter -------------------------------------------------------------
// Split text into chunks of at most `limit` UTF-16 units, preferring
// paragraph/line boundaries, remapping entities per chunk. Entities that
// span a cut are clipped into both chunks.
export function splitMessage(text, entities = [], limit = 4000) {
  if (text.length <= limit) return [{ text, entities }];
  const chunks = [];
  let rest = text;
  let restEntities = entities.map((e) => ({ ...e }));
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit * 0.4) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.4) cut = rest.lastIndexOf(" ", limit);
    if (cut <= 0) cut = limit;
    const head = rest.slice(0, cut);
    const headEntities = [];
    const tailEntities = [];
    for (const e of restEntities) {
      const end = e.offset + e.length;
      if (end <= cut) headEntities.push(e);
      else if (e.offset >= cut) tailEntities.push({ ...e, offset: e.offset - cut });
      else {
        headEntities.push({ ...e, length: cut - e.offset });
        tailEntities.push({ ...e, offset: 0, length: end - cut });
      }
    }
    chunks.push({ text: head, entities: headEntities });
    const tail = rest.slice(cut);
    const trim = tail.length - tail.replace(/^\n+/, "").length;
    rest = tail.slice(trim);
    restEntities = tailEntities
      .map((e) => ({ ...e, offset: Math.max(0, e.offset - trim) }))
      .filter((e) => e.offset < rest.length)
      .map((e) => ({ ...e, length: Math.min(e.length, rest.length - e.offset) }));
  }
  if (rest) chunks.push({ text: rest, entities: restEntities });
  return chunks;
}

// ---- keyboards ------------------------------------------------------------
export const btn = (text, callback_data, extra = {}) => ({ text, callback_data, ...extra });
export const copyBtn = (text, copyText) => ({ text, copy_text: { text: copyText } });
export const kb = (rows) => ({ inline_keyboard: rows });
