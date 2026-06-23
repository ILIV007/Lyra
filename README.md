# Lyra — AI Prompt Optimizer Telegram Bot

> Transform rough ideas into precision-crafted prompts. Built on Cloudflare Workers.

**Lyra** is a Telegram bot that takes raw user input and turns it into optimized, professional-grade prompts for any AI platform. It uses a **4-D methodology** (Deconstruct → Diagnose → Develop → Deliver) to analyze intent, fill gaps, and produce structured prompts with copy-friendly code blocks.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-blue)
![Bot API](https://img.shields.io/badge/Telegram%20API-7.10%2B-blue)

---

## Features

- **✍️ Free-Form Mode** — Send any text, get a fully optimized prompt instantly.
- **💻 Category Presets** — Code, Image, Video with specialized system prompts and canned presets.
- **🎯 Entity-Based Formatting** — Bold, italic, code blocks, and expandable blockquotes via `MessageEntity` arrays (no Markdown/HTML parsing).
- **🌐 Multilingual** — English, فارسی (Persian), Русский (Russian) with automatic fallback.
- **⚡ Blazing Fast** — Runs on Cloudflare Workers with in-memory caching and KV persistence.
- **🔄 Smart Follow-Ups** — AI generates targeted questions; subsequent messages refine the prompt.
- **📋 One-Tap Copy** — Native `copy_text` button for instant prompt extraction.

---

## Architecture

```
┌──────────┐     ┌──────────────────┐     ┌─────────────┐
│ Telegram │────▶│  Cloudflare      │────▶│  OpenRouter │
│ Bot API  │◀────│  Worker (index)  │◀────│  AI APIs    │
└──────────┘     └──────────────────┘     └─────────────┘
                      │
                      ▼
               ┌──────────────┐
               │  KV Storage  │
               │  (state)     │
               └──────────────┘
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Entry | `src/index.js` | Webhook router, debug endpoints, env check |
| Bot   | `src/bot.js` | Message routing, state machine, response assembly |
| API   | `src/telegram.js` | HTTP client, entity builders, message helpers |
| i18n  | `src/messages.js` | Multilingual strings with function-based interpolation |
| UI    | `src/keyboards.js` | Reply keyboards, inline keyboards, copy button |
| AI    | `src/openrouter.js` | Model fallback chain, API call with timeout |
| Prompts | `src/templates.js` | 4-D base system prompt, category presets |

---

## Project Structure

```
src/
├── index.js          # Worker entry, webhook handler, debug endpoints
├── bot.js            # Message routing, state machine, command handling
├── telegram.js       # Telegram API client, entity formatting helpers
├── messages.js       # i18n strings (en/fa/ru)
├── keyboards.js      # Reply & inline keyboard builders
├── templates.js      # AI system prompts (BASE_4D, categories, presets)
└── openrouter.js     # OpenRouter API with model fallback chain
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A [Telegram Bot Token](https://t.me/BotFather)
- An [OpenRouter API Key](https://openrouter.ai/keys)

### 1. Clone & Install

```bash
git clone <repo-url> lyra-bot
cd lyra-bot
npm install
```

### 2. Configure Environment

Set these secrets in your Cloudflare Worker or `.dev.vars`:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_TOKEN` | Telegram Bot API token (from BotFather) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_MODEL` | *(optional)* Preferred model ID |
| `BOT_LANGUAGE` | *(optional)* Default language (`en`, `fa`, `ru`) |
| `DEBUG_KEY` | *(optional)* Auth key for `/debug/*` endpoints |
| `LYRA_STATE` | *(bound KV namespace)* Persistent state storage |

### 3. Run Locally

```bash
npx wrangler dev
```

The dev server starts at `http://localhost:8787`. Use `/setup` to register the webhook:

```
GET http://localhost:8787/setup
```

Or manually:

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://your-worker.workers.dev/webhook"
```

### 4. Deploy

```bash
npx wrangler deploy
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook` | Telegram update webhook (main entry) |
| GET | `/` or `/status` | Health check |
| GET | `/debug/overview` | System status overview |
| GET | `/debug/telegram` | Bot info & webhook status |
| GET | `/debug/openrouter` | OpenRouter API key validation |
| GET | `/debug/kv` | KV namespace entries |
| GET | `/debug/env` | Environment variables (sanitized) |
| GET | `/debug/test-update?chat_id=...&text=...` | Test message delivery |

Access debug endpoints with `?key=<DEBUG_KEY>` (if `DEBUG_KEY` is configured).

---

## Usage

### /start — Main Menu

```
🚀 Lyra — AI Prompt Optimizer

I transform your rough ideas into precision-crafted prompts.

Just send any text, or pick a mode below ✨
```

Inline keyboard: **Quick Prompt**, **Code**, **Image**, **Video**, **Guide**, **Language**.

### Free-Form Mode

Simply type any text. Lyra applies the **BASE_4D** system prompt and returns:

```
📥 Your Input
> your original text

📤 Optimized Prompt
```code block```

Lyra — Crafted with Precision
```

### Category Mode

Tap **Code**, **Image**, or **Video** to choose preset system prompts tailored to that domain.

### Follow-Up Refinement

When the AI generates follow-up questions, just continue typing to refine the prompt. The bot merges your additional context and re-optimizes.

---

## Message Formatting

Lyra uses **`MessageEntity` arrays** exclusively — no `parse_mode` (MarkdownV2 or HTML). This eliminates escaping issues and gives precise control over formatting.

| Entity | Usage | Helper |
|--------|-------|--------|
| **bold** | Labels, emphasis | `B(text)` |
| *italic* | User input, notes | `I(text)` |
| `code` | Inline snippets | `C(text)` |
| Pre-formatted | Prompt output | `buildPreBlock(text)` |
| Expandable blockquote | Footer, notes | `buildBlockQuote(text)` |

---

## AI System Prompt

The **BASE_4D** template (`src/templates.js`) implements Lyra's core methodology:

1. **Deconstruct** — Extract intent, entities, context
2. **Diagnose** — Audit clarity, specificity, completeness
3. **Develop** — Apply optimal techniques per request type
4. **Deliver** — Construct formatted prompt inside `<PROMPT>` tags

The AI outputs wrapped in `<PROMPT>...</PROMPT>` and optional `<FOLLOWUP>...</FOLLOWUP>` tags, which the bot parses and presents cleanly.

---

## Language Support

Messages are defined in `src/messages.js` as either plain strings or functions (for interpolated values). The `getMsg(lang, key, ...args)` helper:

1. Looks up `MESSAGES[lang][key]`
2. Falls back to `en`, then `ru`
3. Returns the key name if nothing is found

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-idea`)
3. Commit your changes (`git commit -m 'Add my idea'`)
4. Push to the branch (`git push origin feature/my-idea`)
5. Open a Pull Request

---

## License

MIT
