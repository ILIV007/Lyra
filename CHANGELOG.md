# Changelog

## v2.5.0 — 2026-11-18

Owner live-review fixes + a full review/debug pass:

- **No-delete policy.** Tapping Home on a result card deleted the card
  itself (the rich-home sender removed its source message) — the owner
  is right, that is a bug. The bot now NEVER deletes a user-visible
  message (`deleteMessage` has zero call sites): when leaving a screen
  behind, only its keyboard is stripped via `editMessageReplyMarkup`,
  so texts/prompts/presets stay and stale buttons disappear. The
  long-card path no longer deletes the placeholder either — it is
  edited into chunk 1. Refine no longer edits the result card.
  This reverses the v2.4 orphan-cleanup approach (deletion) in favour
  of keyboard stripping.
- **4096, not 4000.** Long prompts were split into two messages below
  Telegram's real limit; splitter, delivery and the placeholder path
  now all use 4096, so borderline prompts stay in one message.
- **Prompts render as quote + mono:** the crafted prompt carries
  overlapping `expandable_blockquote` + `code` entities (probed live
  against the Bot API first — accepted).
- **More Rich:** the Mode screen and Bank items are rich messages now
  (Home, Guide, Mode, Bank items rich; form-like screens stay
  editable). Home sections are separated with a settings subheading.
- **Detailed Prompt button on Home** — red (`danger` style), next to
  Quick Prompt; it starts the 3-question flow directly, whatever the
  Settings depth toggle says. New `btn_detail` string in 12 locales.
- Review pass: dead code removed from prompts.js; rich-send fallback
  also strips the source keyboard; bot.js / i18n.js / index.js audited
  clean.

Agent: Rick

## v2.4.0 — 2026-11-18

Owner live-review fixes, including the missing-prompt root cause:

- **BUGFIX — prompts never arrived: `BUTTON_COPY_TEXT_INVALID`.**
  Telegram caps `copy_text` button payloads at 256 chars and rejects
  the *entire* message beyond that. Every real prompt (and every bank
  preset) is longer, so result cards and bank items were rejected while
  KV bookkeeping said "done" — and delivery errors were swallowed
  silently. Found by replaying the exact payloads against the live API.
  Fix: copy buttons removed everywhere (the `pre` block is natively
  copyable in clients), delivery failures are now logged, and a
  regression test forbids copy_text on cards/presets. Earlier "verified
  live" notes verified state, not delivery — this release verifies the
  actual API responses end to end.
- **Platform picker removed.** No more ChatGPT/Claude/Gemini choice in
  Settings; prompts are built in a universal style, specialised only
  by category.
- **One Mode to rule the flow.** A new Mode screen (Home button and the
  new `/mode` command, registered in all 12 languages) picks the
  generation bundle: Standard, Ponytail, Caveman, Code, Image, Video.
  Category chips on the quick-ask screen and the style row in Settings
  are gone — Mode is the single place.
- **Prompt Bank is a real bank now:** 7 ready-to-use presets added
  (Code Review Pro, Debug Detective, Explain It Simply, Professional
  Email, Socratic Tutor, Photoreal Image Prompt, Precision Summarizer)
  alongside the 5 style classics — 12 total, in a two-column grid.
- **Tidier chat:** a menu that cannot be edited (e.g. a rich message)
  is now deleted before its replacement is sent, and the flow screen
  is removed when generation starts — no more orphan menus piling up.

Agent: Rick

## v2.3.0 — 2026-11-18

Owner live-review fixes:

- **The draft preview is gone.** `sendMessageDraft` turned out to be the
  "empty live text that deletes itself": drafts are ephemeral by design,
  render as an empty live bubble on some clients, and auto-vanish when
  the real message lands. Generation is back to the v1 way the owner
  prefers — a real "⏳ Writing your prompt…" placeholder message that is
  **edited in place** into the result card (or into the error text on
  failure). New `generating` string in all 12 locales.
- **/start redesigned.** The rich Home drops the clunky emoji table:
  title, one short paragraph, the current setup as a single line
  (🌐 language · style · platform · mode), the hint as a blockquote,
  and a two-row keyboard (primary action + Bank/Settings/Guide row).
- **Settings screen decluttered** the same way: title + the one-line
  state summary; the buttons speak for themselves.

Agent: Rick

## v2.2.0 — 2026-11-18

- **Workers AI is a real fallback chain now** (owner's request). Quality
  mode walks 5 models in order — llama-3.3-70b fp8-fast →
  llama-3.1-70b fp8-fast → llama-4-scout → mistral-small-3.1-24b →
  llama-3.1-8b — and inline/fast mode walks its own 4-model chain.
  The OpenRouter chain runs after Workers AI, once its key is set.
- Every chain model was verified live on the account before inclusion;
  gemma-3-12b (403 here) and the gpt-oss reasoning models (empty
  `response`) are deliberately excluded.
- A model fails on error, per-attempt timeout (30s quality / 20s fast),
  empty output, **or unparseable output**: `generate()` now accepts a
  `validate` callback, so a weak fallback model that ignores the output
  format moves the chain on instead of failing the user's request.
- Chain behaviour is covered by unit tests (order, empty-output,
  validation fallthrough, fast chain, all-fail).

Agent: Rick

## v2.1.0 — 2026-11-18

Polish pass from the first live review (all changes requested by the owner):

- **Default UI language is now English for everyone.** New users no longer
  inherit Telegram's `language_code`; the Language screen remains the one
  place to switch. (Prompt answer-language detection is unchanged.)
- **Tidier menus.** Home is down to 4 buttons (New prompt / Bank /
  Settings / Guide); the settings chips row is gone. Categories moved
  into the quick-ask screen as toggle chips; Styles moved into Settings;
  the result card dropped its Restyle button.
- **Rich Messages where they belong.** Home and Guide are now rich
  messages — heading, a compact settings table on Home, structured
  lists in the Guide — sent fresh each time (rich cannot be edited),
  with the previous menu message deleted to keep the chat clean and a
  plain-message fallback if a rich send ever fails. This reverses the
  v2.0.0 note below for these two read-once surfaces only; all
  interactive screens remain entity-based and editable.
- **Slimmer command menu.** BotFather commands are now just `/start`
  and `/help` in all 12 languages; `/admin` is registered with a chat
  scope so only the admin's own chat sees it.

Agent: Rick

## v2.0.0 — 2026-11-18

Complete rebuild. v1's skeleton was kept (bot identity, the 4-D concept,
Code/Image/Video + Prompt Bank, single Worker + KV) and everything else
was rewritten. The bot now runs on a dedicated Cloudflare account with a
fresh Workers AI quota; v1 data was not migrated.

### Added
- Full original 4-D prompt engine with target-platform adaptation
  (ChatGPT / Claude / Gemini / Code / Image / Video) and a hardened
  `<PROMPT>` output contract with graceful fallbacks.
- **Always-English prompts**: ideas are accepted in any language; the
  crafted prompt is rendered in English and instructs the target AI to
  answer in the user's language.
- **Styles**: Ponytail (lite/full/ultra) and Caveman (standard/ultra) as
  engine overlays *and* as copy-ready Prompt Bank presets.
- **12 UI languages** (en, fa, ru, uk, ar, es, pt, de, fr, tr, uz, id)
  with auto-detection, a Language screen, per-language BotFather profile
  and commands, and full RTL handling for Persian and Arabic. i18n
  completeness is enforced by tests.
- One-message edit-in-place UX (13 screens), ⚡ reaction acknowledgements,
  `sendMessageDraft` previews, real `copy_text` Copy buttons, semantic
  button colours, chat menu button, and inline mode in any chat.
- Providers: Workers AI primary (models picked by a live bake-off),
  OpenRouter free-chain fallback, per-user rate limiting.
- Admin panel: stats + batched, resumable broadcast.
- Test suite (`node:test`): prompt composition, output parser, entity
  offsets (including the Persian case that broke v1), the 4096 splitter,
  i18n completeness and placeholder parity.

### Fixed (v1 issues closed by the rewrite)
- Webhook now verifies `secret_token`; no debug endpoints exist; no
  stack traces are returned.
- Entity offsets are computed during assembly — the v1 Persian footer
  `text_link` offset −1 bug class is gone, with a regression test.
- Long outputs are split safely at 4,000 chars with entities remapped.
- Deliveries are deduped by `update_id` and answered instantly
  (work runs in `waitUntil`), so slow AI calls no longer double-fire.
- KV writes are budgeted (one merged user record; no per-message
  tracking writes); broadcasts are batched under the subrequest cap.
- Stale Cloudflare PR #1 and its branch were closed/removed; the
  misplaced `github/` workflow folder is gone.

### Notes
- Rich Messages were evaluated for the Guide screen and deliberately not
  adopted: rich messages cannot be edited in place (no
  `editMessageRichText` in the Bot API), and every Lyra screen is an
  edit-in-place surface.

Agent: Rick
