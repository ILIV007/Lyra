# Lyra — Prompt Master 🌀

**Telegram:** [@Lyra_IVbot](https://t.me/Lyra_IVbot)

Lyra turns a rough idea — in any language — into a precision-crafted prompt
for ChatGPT, Claude, Gemini and other AIs. The crafted prompt is **always in
English** (where prompts work best); inside it, the target AI is told to
answer in *your* language.

Built on the original Lyra 4-D methodology:
**Deconstruct → Diagnose → Develop → Deliver.**

## Features

- **4-D prompt engine** — full methodology, specialised by craft category (general / code / image / video)
  (ChatGPT / Claude / Gemini / Code / Image / Video), restored and hardened
  behind a strict `<PROMPT>` output contract.
- **Two modes** — ⚡ Basic (instant) and 🔎 Detail (asks 3 clarifying
  questions first).
- **Styles** — ✨ Standard, 🐴 **Ponytail** (lite/full/ultra: the crafted
  prompt makes the AI build the laziest solution that works) and 🪨
  **Caveman** (standard/ultra: answer first, zero fluff, facts intact).
- **Prompt Bank** — 12 copy-ready presets: Lyra Classic, Code Review Pro, Debug Detective, Socratic Tutor, Ponytail, Caveman and more
- **One Mode picker** — `/mode` or the Mode button: Standard, Ponytail, Caveman, Code, Image or Video shapes every prompt
  with a real one-tap Copy button. No AI call, zero cost.
- **12 UI languages** — English, فارسی, Русский, Українська, العربية,
  Español, Português, Deutsch, Français, Türkçe, O'zbek, Bahasa Indonesia.
  Auto-detected from Telegram, switchable any time; full RTL for fa/ar.
- **Modern Telegram UX** — one-message edit-in-place navigation, ⚡ reaction
  acknowledgements, draft previews, expandable quotes, semantic button
  colours, chat menu button, and **inline mode**: `@Lyra_IVbot <idea>` in
  any chat.
- **Admin** — stats and a throttled, batched broadcast.

## Architecture

Single Cloudflare Worker, raw Bot API, no framework, no dependencies.

```
src/
  index.js     router: /health + /webhook (secret_token verified, instant
               200, work in ctx.waitUntil) — no debug endpoints
  bot.js       update_id dedupe + stale-update age gate
  handlers.js  commands, callbacks, text flows, inline mode, admin
  screens.js   13 screens as pure functions of user state
  prompts.js   4-D engine: core × category × mode bundle × style
  styles.js    Ponytail/Caveman overlays + bank presets
  providers.js Workers AI (primary) → OpenRouter free chain (fallback)
  telegram.js  API client, entity-based formatting, 4096-safe splitter
  store.js     KV wrapper with strict write discipline
  i18n.js      language detection + string tables (locales/*.js)
```

State lives in one KV namespace (`LYRA_STATE`): one merged record per user,
≤2 writes per user message, TTL'd rate-limit keys. The webhook verifies the
`secret_token` header on every call and dedupes retried deliveries.

## Development

```bash
npm test   # node:test — engine, splitter, entities, i18n completeness
           # (every key × 12 languages), language detection
```

Deploys go through the Workers Scripts API on the dedicated Lyra
Cloudflare account (KV + Workers AI bindings per `wrangler.toml`);
secrets (`TELEGRAM_TOKEN`, `WEBHOOK_SECRET`, `OPENROUTER_API_KEY`) are set
via the dashboard/API and never live in the repo.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). Current version: **v2.0.0**.

## License

MIT
