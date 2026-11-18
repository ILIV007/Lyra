// handlers.js — update routing, flows, generation, inline mode, admin.
import { createTelegram, splitMessage, compose, tx, b, btn, kb } from "./telegram.js";
import { createStore, defaultUser } from "./store.js";
import { t, guessTextLang, ANSWER_LANG_NAME } from "./i18n.js";
import * as S from "./screens.js";
import { buildSystem, buildUser, refineUser, parsePrompt } from "./prompts.js";
import { generate } from "./providers.js";
import { BANK } from "./styles.js";

const IDEA_LIMIT = 4000;
const BCAST_BATCH = 45; // stay under the free-plan subrequest cap per invocation

export async function handleUpdate(env, update) {
  const tg = createTelegram(env.TELEGRAM_TOKEN);
  const store = createStore(env);
  const admins = (env.ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

  async function ensureUser(from) {
    let u = await store.getUser(from.id);
    if (!u) {
      // Default UI language is English for everyone (wolf's rule); users
      // can switch any time on the Language screen.
      u = defaultUser(from.id);
      await store.saveUser(u);
      await store.registerId(from.id);
    }
    return u;
  }

  // Edit `msgId` in place when possible; fall back to a fresh message.
  // If the tapped message cannot be edited (e.g. it is a rich message),
  // delete it first so stale menus do not pile up in the chat.
  async function showScreen(chatId, msgId, screen) {
    const body = { chat_id: chatId, text: screen.text, entities: screen.entities, reply_markup: screen.keyboard };
    if (msgId) {
      try {
        await tg.call("editMessageText", { ...body, message_id: msgId });
        return msgId;
      } catch (e) {
        if (String(e.detail || "").includes("not modified")) return msgId;
        console.error("editMessageText failed, resending:", String(e.detail || e.message || e));
        try { await tg.call("deleteMessage", { chat_id: chatId, message_id: msgId }); } catch { /* too old / already gone */ }
      }
    }
    const sent = await tg.call("sendMessage", body);
    return sent.message_id;
  }

  // Deliverables (results, bank items): new message(s), split at 4000,
  // keyboard on the last part only. Chunk failures are LOGGED, never
  // silently swallowed (a silent catch hid the copy_text bug for days).
  async function deliver(chatId, screen) {
    const parts = splitMessage(screen.text, screen.entities, 4000);
    let last = null;
    for (let n = 0; n < parts.length; n++) {
      try {
        last = await tg.call("sendMessage", {
          chat_id: chatId,
          text: parts[n].text,
          entities: parts[n].entities,
          reply_markup: n === parts.length - 1 ? screen.keyboard : undefined,
        });
      } catch (e) {
        console.error(`deliver chunk ${n + 1}/${parts.length} failed:`, String(e.detail || e.message || e));
      }
    }
    return last && last.message_id;
  }

  // Rich surfaces (Home, Guide) are read-once deliverables: rich messages
  // cannot be edited, so they are sent fresh; the previous menu message is
  // deleted to keep the chat tidy. Any rich failure falls back to the
  // plain entity screen so navigation never breaks.
  async function sendRich(chatId, rich, plainScreen, deleteMsgId) {
    try {
      const sent = await tg.call("sendRichMessage", {
        chat_id: chatId,
        rich_message: { html: rich.html },
        reply_markup: rich.keyboard,
      });
      if (deleteMsgId && deleteMsgId !== sent.message_id) {
        try { await tg.call("deleteMessage", { chat_id: chatId, message_id: deleteMsgId }); } catch { /* already gone */ }
      }
      return sent.message_id;
    } catch (e) {
      console.error("rich send failed, falling back:", String(e && e.message || e));
      return showScreen(chatId, null, plainScreen);
    }
  }

  const sendRichHome = (u, chatId, deleteMsgId) => sendRich(chatId, S.richHome(u), S.home(u), deleteMsgId);
  const sendRichGuide = (u, chatId, deleteMsgId) => sendRich(chatId, S.richGuide(u), S.guide(u), deleteMsgId);

  async function sendText(chatId, text) {
    try { await tg.call("sendMessage", { chat_id: chatId, text }); } catch { /* user blocked etc. */ }
  }

  // The Mode bundle drives both the style overlay and the craft category.
  // There is no target-platform picker any more (owner's call): prompts
  // are built in a universal style, specialised only by category.
  function styleFor(u) {
    return u.bundle === "ponytail" || u.bundle === "caveman" ? u.bundle : "standard";
  }
  function catFor(u) {
    return ["code", "image", "video"].includes(u.bundle) ? u.bundle : "general";
  }
  function platformFor(cat) {
    return ["code", "image", "video"].includes(cat) ? cat : "chatgpt";
  }

  // The generation UX is a REAL message that lives: a "writing…" placeholder
  // is sent first and then edited in place into the result card (the v1 way,
  // which the owner prefers). No sendMessageDraft — drafts are ephemeral,
  // render as an empty live bubble on some clients and vanish on their own.
  async function finishPlaceholder(chatId, phId, screen) {
    if (phId && screen.text.length <= 4000) {
      try {
        await tg.call("editMessageText", {
          chat_id: chatId, message_id: phId,
          text: screen.text, entities: screen.entities, reply_markup: screen.keyboard,
        });
        return;
      } catch { /* fall through to a fresh card */ }
    }
    if (phId) { try { await tg.call("deleteMessage", { chat_id: chatId, message_id: phId }); } catch { /* gone */ } }
    await deliver(chatId, screen);
  }

  async function failPlaceholder(chatId, phId, text) {
    if (phId) {
      try { await tg.call("editMessageText", { chat_id: chatId, message_id: phId, text }); return; } catch { /* send fresh */ }
    }
    await sendText(chatId, text);
  }

  async function runGeneration(u, chatId, { idea, answers = null, refine = null }) {
    if (!(await store.rateOk(u.id))) {
      await sendText(chatId, t(u.lang, "err_rate"));
      return;
    }
    // Tidy: the flow/menu screen that led here has done its job — remove
    // it so the chat keeps only the idea, the placeholder and the card.
    if (u.flowMsg) {
      try { await tg.call("deleteMessage", { chat_id: chatId, message_id: u.flowMsg }); } catch { /* already gone */ }
      u.flowMsg = null;
    }
    let phId = null;
    try {
      const ph = await tg.call("sendMessage", { chat_id: chatId, text: t(u.lang, "generating") });
      phId = ph && ph.message_id;
    } catch { /* placeholder is a nicety, generation continues */ }
    const cat = catFor(u);
    const style = styleFor(u);
    const answerLang = ANSWER_LANG_NAME[guessTextLang(idea, u.lang)] || "English";
    const system = buildSystem({
      platform: platformFor(cat),
      style,
      level: u.level[style],
      answerLang,
    });
    const userMsg = refine
      ? refineUser({ idea: refine.idea, previousPrompt: refine.prompt, feedback: idea })
      : buildUser({ idea, category: cat, answers });
    let out;
    try {
      out = await generate(env, { system, user: userMsg, maxTokens: 1400, validate: (txt) => !!parsePrompt(txt) });
    } catch (e) {
      console.error("generate failed:", String(e && e.message || e));
      await failPlaceholder(chatId, phId, t(u.lang, "err_generic"));
      return;
    }
    const prompt = parsePrompt(out.text);
    if (!prompt) {
      await failPlaceholder(chatId, phId, t(u.lang, "err_generic"));
      return;
    }
    const baseIdea = refine ? refine.idea : idea;
    u.n += 1;
    u.flow = { name: "done", lastIdea: baseIdea, lastPrompt: prompt };
    await store.saveUser(u);
    await finishPlaceholder(chatId, phId, S.resultCard(u, { idea: baseIdea, prompt }));
  }

  async function startIdeaFlow(u, chatId, msgId) {
    u.flow = u.mode === "detail" ? { name: "idea", thenQuestions: true } : { name: "idea" };
    u.flowMsg = await showScreen(chatId, msgId, S.quickAsk(u));
    await store.saveUser(u);
  }

  async function advanceQuestions(u, chatId) {
    const f = u.flow;
    if (f.idx >= 3) {
      const answers = (f.answers || []).filter((a) => a && a !== "—");
      const idea = f.idea;
      u.flow = null;
      await store.saveUser(u);
      await runGeneration(u, chatId, { idea, answers });
      return;
    }
    u.flowMsg = await showScreen(chatId, u.flowMsg, S.question(u, f.idx));
    await store.saveUser(u);
  }

  // ---- messages ------------------------------------------------------------
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    if (msg.chat.type !== "private") return; // v2 is a private-chat bot (+ inline)
    const u = await ensureUser(msg.from);
    const text = (msg.text || "").trim();

    if (text === "/start" || text.startsWith("/start ")) {
      u.flow = null;
      u.home = await sendRichHome(u, chatId, null);
      await store.saveUser(u);
      return;
    }
    if (text === "/admin" && admins.includes(String(u.id))) {
      const ids = await store.getIds();
      u.home = await showScreen(chatId, null, S.adminHome(u, ids.length));
      await store.saveUser(u);
      return;
    }
    if (text === "/help") {
      await sendRichGuide(u, chatId, null);
      return;
    }
    if (text === "/mode") {
      u.flowMsg = await showScreen(chatId, null, S.modeScreen(u));
      await store.saveUser(u);
      return;
    }
    if (!text) return;
    if (text.length > IDEA_LIMIT) {
      await sendText(chatId, t(u.lang, "err_long"));
      return;
    }

    const f = u.flow || {};
    if (f.name === "bcast" && admins.includes(String(u.id))) {
      u.flow = { name: "bcast_confirm", text, cursor: 0, sent: 0 };
      await store.saveUser(u);
      await showScreen(chatId, null, S.bcastConfirm(u, text));
      return;
    }
    if (f.name === "refine" && f.lastPrompt) {
      try { await tg.call("setMessageReaction", { chat_id: chatId, message_id: msg.message_id, reaction: [{ type: "emoji", emoji: "⚡" }] }); } catch { /* optional */ }
      const refine = { idea: f.lastIdea, prompt: f.lastPrompt };
      u.flow = null;
      await store.saveUser(u);
      await runGeneration(u, chatId, { idea: text, refine });
      return;
    }
    if (f.name === "answers") {
      f.answers = f.answers || [];
      f.answers[f.idx] = text;
      f.idx += 1;
      await store.saveUser(u);
      await advanceQuestions(u, chatId);
      return;
    }
    if (f.name === "idea") {
      if (f.thenQuestions) {
        u.flow = { name: "answers", idea: text, answers: [], idx: 0 };
        await store.saveUser(u);
        await advanceQuestions(u, chatId);
        return;
      }
      u.flow = null;
      await store.saveUser(u);
      try { await tg.call("setMessageReaction", { chat_id: chatId, message_id: msg.message_id, reaction: [{ type: "emoji", emoji: "⚡" }] }); } catch { /* optional */ }
      await runGeneration(u, chatId, { idea: text });
      return;
    }
    // No active flow: any text is an idea (quick-generate).
    try { await tg.call("setMessageReaction", { chat_id: chatId, message_id: msg.message_id, reaction: [{ type: "emoji", emoji: "⚡" }] }); } catch { /* optional */ }
    if (u.mode === "detail") {
      u.flow = { name: "answers", idea: text, answers: [], idx: 0 };
      await store.saveUser(u);
      await advanceQuestions(u, chatId);
      return;
    }
    await runGeneration(u, chatId, { idea: text });
    return;
  }

  // ---- callbacks -------------------------------------------------------------
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message.chat.id;
    const msgId = cq.message.message_id;
    const u = await ensureUser(cq.from);
    const data = cq.data || "";
    try { await tg.call("answerCallbackQuery", { callback_query_id: cq.id }); } catch { /* stale tap */ }

    const [ns, a, bArg] = data.split(":");
    if (ns === "nav") {
      if (a === "home") { u.flow = null; u.home = await sendRichHome(u, chatId, msgId); await store.saveUser(u); }
      else if (a === "quick") { await startIdeaFlow(u, chatId, msgId); }
      else if (a === "mode") { await showScreen(chatId, msgId, S.modeScreen(u)); }
      else if (a === "bank") { await showScreen(chatId, msgId, S.bank(u)); }
      else if (a === "settings") { await showScreen(chatId, msgId, S.settings(u)); }
      else if (a === "lang") { await showScreen(chatId, msgId, S.language(u)); }
      else if (a === "guide") { await sendRichGuide(u, chatId, msgId); }
      return;
    }
    if (ns === "mode") {
      // Ponytail/Caveman first pick an intensity; the rest apply at once.
      if (a === "ponytail" || a === "caveman") {
        await showScreen(chatId, msgId, S.styleLevels(u, a));
      } else {
        u.bundle = a;
        await store.saveUser(u);
        await showScreen(chatId, msgId, S.modeScreen(u));
      }
      return;
    }
    if (ns === "lvl") {
      u.bundle = a;
      u.level[a] = bArg;
      await store.saveUser(u);
      await showScreen(chatId, msgId, S.modeScreen(u));
      return;
    }
    if (ns === "dt") { u.mode = a; await store.saveUser(u); await showScreen(chatId, msgId, S.settings(u)); return; }
    if (ns === "lang") {
      u.lang = a;
      u.home = await sendRichHome(u, chatId, msgId);
      await store.saveUser(u);
      return;
    }
    if (ns === "bank") {
      const preset = BANK.find((p) => p.id === a);
      if (preset) await deliver(chatId, S.bankItem(u, preset));
      return;
    }
    if (ns === "res" && a === "refine") {
      const f = u.flow || {};
      if (f.lastPrompt) {
        u.flow = { name: "refine", lastIdea: f.lastIdea, lastPrompt: f.lastPrompt };
        await store.saveUser(u);
        await showScreen(chatId, msgId, S.refineAsk(u));
      }
      return;
    }
    if (ns === "q" && a === "skip") {
      const f = u.flow || {};
      if (f.name === "answers") {
        f.answers = f.answers || [];
        f.answers[f.idx] = "—";
        f.idx += 1;
        await store.saveUser(u);
        await advanceQuestions(u, chatId);
      }
      return;
    }
    if (ns === "adm" && admins.includes(String(u.id))) {
      if (a === "bcast") {
        u.flow = { name: "bcast" };
        await store.saveUser(u);
        await sendText(chatId, t(u.lang, "bcast_ask"));
      } else if (a === "send" || a === "more") {
        const f = u.flow || {};
        if (f.name === "bcast_confirm" || f.name === "bcast_more") {
          const ids = await store.getIds();
          const batch = ids.slice(f.cursor || 0, (f.cursor || 0) + BCAST_BATCH);
          let sent = f.sent || 0;
          for (const id of batch) {
            try { await tg.call("sendMessage", { chat_id: id, text: f.text }); sent++; } catch { /* blocked/deleted */ }
          }
          const cursor = (f.cursor || 0) + batch.length;
          const done = cursor >= ids.length;
          u.flow = done ? null : { name: "bcast_more", text: f.text, cursor, sent };
          await store.saveUser(u);
          if (done) {
            await sendText(chatId, t(u.lang, "bcast_done", { sent }));
          } else {
            const c = compose(b(t(u.lang, "bcast_done", { sent })), tx("\n"), tx(t(u.lang, "bcast_more")));
            await tg.call("sendMessage", {
              chat_id: chatId, text: c.text, entities: c.entities,
              reply_markup: kb([[btn(t(u.lang, "bcast_more"), "adm:more")]]),
            });
          }
        }
      } else if (a === "cancel") {
        u.flow = null;
        await store.saveUser(u);
        const ids = await store.getIds();
        await showScreen(chatId, msgId, S.adminHome(u, ids.length));
      }
      return;
    }
    return;
  }

  // ---- inline mode -------------------------------------------------------------
  if (update.inline_query) {
    const iq = update.inline_query;
    const query = (iq.query || "").trim();
    let u = await store.getUser(iq.from.id);
    const lang = u ? u.lang : "en";
    const results = [];
    if (query.length >= 3 && query.length <= IDEA_LIMIT) {
      try {
        if (await store.rateOk(iq.from.id)) {
          if (!u) u = defaultUser(iq.from.id);
          const answerLang = ANSWER_LANG_NAME[guessTextLang(query, lang)] || "English";
          const style = styleFor(u);
          const system = buildSystem({ platform: platformFor(catFor(u)), style, level: u.level[style], answerLang });
          const out = await generate(env, { system, user: buildUser({ idea: query, category: catFor(u) }), fast: true, maxTokens: 900, validate: (txt) => !!parsePrompt(txt) });
          const prompt = parsePrompt(out.text);
          if (prompt) {
            results.push({
              type: "article",
              id: `p${Date.now() % 100000000}`,
              title: t(lang, "inline_title"),
              description: prompt.slice(0, 120),
              input_message_content: { message_text: prompt },
            });
          }
        }
      } catch (e) {
        console.error("inline generate failed:", String(e && e.message || e));
      }
    }
    if (!results.length) {
      results.push({
        type: "article",
        id: "hint",
        title: t(lang, "inline_title"),
        description: t(lang, "inline_hint"),
        input_message_content: { message_text: t(lang, "inline_hint") },
      });
    }
    try {
      await tg.call("answerInlineQuery", { inline_query_id: iq.id, results, cache_time: 30, is_personal: true });
    } catch { /* expired query */ }
    return;
  }
}
