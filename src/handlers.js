// handlers.js — update routing, flows, generation, inline mode, admin.
import { createTelegram, splitMessage, compose, tx, b, btn, kb } from "./telegram.js";
import { createStore, defaultUser } from "./store.js";
import { t, guessTextLang, ANSWER_LANG_NAME } from "./i18n.js";
import * as S from "./screens.js";
import { buildSystem, buildUser, refineUser, parsePrompt, parseQuestions } from "./prompts.js";
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

  // Forced join: Lyra is for @ILIVIR3 members. The check FAILS OPEN —
  // until the bot is a channel admin, getChatMember errors and everyone
  // passes, so the bot never locks people out by accident. The moment
  // the bot becomes admin, the gate is live with no further change.
  const JOIN_CHAT = "@ILIVIR3";
  async function isMember(userId) {
    if (admins.includes(String(userId))) return true;
    try {
      const m = await tg.call("getChatMember", { chat_id: JOIN_CHAT, user_id: userId });
      if (!m) return true;
      if (m.status === "restricted") return !!m.is_member;
      return m.status === "creator" || m.status === "administrator" || m.status === "member";
    } catch { return true; }
  }

  // MESSAGE LIFECYCLE (owner's rules, final form after his reviews):
  // - There is exactly ONE menu message per user (u.home). EVERY menu
  //   and flow screen (Home, Settings, Mode, Bank list, Guide, ask and
  //   question screens) is edited into it in place — navigation never
  //   sends a new message and never deletes the old one.
  // - DELIVERABLES (result cards, bank items — ids in u.keep) are the
  //   user's property: never edited, never deleted. Leaving one strips
  //   only its keyboard.
  async function stripMarkup(chatId, msgId) {
    if (!msgId) return;
    try {
      await tg.call("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
    } catch { /* already stripped / too old — harmless */ }
  }

  async function deleteMenu(chatId, msgId) {
    if (!msgId) return;
    try { await tg.call("deleteMessage", { chat_id: chatId, message_id: msgId }); } catch { /* already gone */ }
  }

  // Leaving a tapped message that is not the menu: deliverables keep
  // their text (strip the keyboard); a stray legacy menu is removed so
  // only one live menu ever exists.
  async function leaveBehind(u, chatId, msgId) {
    if (!msgId) return;
    if ((u.keep || []).includes(msgId)) await stripMarkup(chatId, msgId);
    else await deleteMenu(chatId, msgId);
  }

  // Render a menu screen into the ONE persistent menu message. The tap
  // source is retired first when it is not the menu itself. If the menu
  // message is uneditable (deleted by the user, or a legacy rich home
  // from <=v2.6), a fresh menu is born: it is sent with remove_keyboard
  // (which also clears any leftover v1 reply keyboard in the typing
  // area) and then receives its inline keyboard by edit.
  async function showMenu(u, chatId, screen, fromMsgId) {
    if (fromMsgId && fromMsgId !== u.home) await leaveBehind(u, chatId, fromMsgId);
    if (u.home) {
      try {
        await tg.call("editMessageText", {
          chat_id: chatId, message_id: u.home,
          text: screen.text, entities: screen.entities, reply_markup: screen.keyboard,
        });
        return u.home;
      } catch (e) {
        if (String(e.detail || "").includes("not modified")) return u.home;
        console.error("menu edit failed, birthing a fresh menu:", String(e.detail || e.message || e));
      }
    }
    const sent = await tg.call("sendMessage", {
      chat_id: chatId, text: screen.text, entities: screen.entities,
      reply_markup: { remove_keyboard: true },
    });
    u.home = sent.message_id;
    await store.saveUser(u);
    try {
      await tg.call("editMessageReplyMarkup", { chat_id: chatId, message_id: u.home, reply_markup: screen.keyboard });
    } catch { /* menu still works; next navigation retries */ }
    return u.home;
  }

  // Deliverables: new message(s), split at Telegram's real 4096 limit,
  // keyboard on the last part only. Chunk failures are LOGGED, never
  // silently swallowed (a silent catch hid the copy_text bug for days).
  async function deliver(chatId, screen) {
    const parts = splitMessage(screen.text, screen.entities, 4096);
    const ids = [];
    for (let n = 0; n < parts.length; n++) {
      try {
        const sent = await tg.call("sendMessage", {
          chat_id: chatId,
          text: parts[n].text,
          entities: parts[n].entities,
          reply_markup: n === parts.length - 1 ? screen.keyboard : undefined,
        });
        if (sent && sent.message_id) ids.push(sent.message_id);
      } catch (e) {
        console.error(`deliver chunk ${n + 1}/${parts.length} failed:`, String(e.detail || e.message || e));
      }
    }
    return ids;
  }

  // Rich is used ONLY for Bank items: deliverables are never edited,
  // so rich's no-edit limit costs nothing there. The menu (the bank
  // list) is untouched by an item send. Any rich failure falls back to
  // the plain entity screen, delivered the same way.
  async function sendRich(u, chatId, rich, plainScreen) {
    try {
      const sent = await tg.call("sendRichMessage", {
        chat_id: chatId,
        rich_message: { html: rich.html },
        reply_markup: rich.keyboard,
      });
      return sent.message_id;
    } catch (e) {
      console.error("rich send failed, falling back:", String(e && e.message || e));
      const ids = await deliver(chatId, plainScreen);
      return ids[0] || null;
    }
  }

  async function sendText(chatId, text) {
    // remove_keyboard: sweeps away any leftover v1 reply keyboard from
    // the typing area whenever a bare notice is sent.
    try { await tg.call("sendMessage", { chat_id: chatId, text, reply_markup: { remove_keyboard: true } }); } catch { /* user blocked etc. */ }
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
  // Returns the delivered card's message ids (for the u.keep registry).
  async function finishPlaceholder(chatId, phId, screen) {
    if (phId) {
      // Edit the placeholder into chunk 1 and send any remaining chunks —
      // the placeholder is never deleted; it BECOMES the card.
      const parts = splitMessage(screen.text, screen.entities, 4096);
      try {
        await tg.call("editMessageText", {
          chat_id: chatId, message_id: phId,
          text: parts[0].text, entities: parts[0].entities,
          reply_markup: parts.length === 1 ? screen.keyboard : undefined,
        });
        const ids = [phId];
        for (let n = 1; n < parts.length; n++) {
          try {
            const sent = await tg.call("sendMessage", {
              chat_id: chatId, text: parts[n].text, entities: parts[n].entities,
              reply_markup: n === parts.length - 1 ? screen.keyboard : undefined,
            });
            if (sent && sent.message_id) ids.push(sent.message_id);
          } catch (e) {
            console.error(`finishPlaceholder chunk ${n + 1}/${parts.length} failed:`, String(e.detail || e.message || e));
          }
        }
        return ids;
      } catch (e) {
        console.error("finishPlaceholder edit failed, delivering fresh:", String(e.detail || e.message || e));
      }
    }
    return deliver(chatId, screen);
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
    // The flow screen that led here lives in the menu message: revert
    // the menu to Home so it stays useful while the card is delivered
    // separately. (A legacy separate flow message is deleted instead.)
    if (u.flowMsg) {
      if (u.flowMsg === u.home) await showMenu(u, chatId, S.home(u), null);
      else await deleteMenu(chatId, u.flowMsg);
      u.flowMsg = null;
    }
    let phId = null;
    try {
      const ph = await tg.call("sendMessage", { chat_id: chatId, text: t(u.lang, "generating"), reply_markup: { remove_keyboard: true } });
      phId = ph && ph.message_id;
    } catch { /* placeholder is a nicety, generation continues */ }
    // Live status cycler: the placeholder is a REAL message whose text
    // rotates (Writing → Thinking → Cooking → Polishing) while the chain
    // works — edited in place, NOT a draft/stream (owner's explicit ask).
    // The loop always exits before the card edit, so it can never
    // overwrite the finished card.
    let animDone = false;
    const anim = (async () => {
      if (!phId) return;
      const stages = [t(u.lang, "generating"), t(u.lang, "gen_thinking"), t(u.lang, "gen_cooking"), t(u.lang, "gen_polishing")];
      let i = 0;
      while (!animDone && i < 12) {
        await new Promise((r) => setTimeout(r, 1200));
        if (animDone) break;
        i += 1;
        try {
          await tg.call("editMessageText", { chat_id: chatId, message_id: phId, text: stages[i % stages.length] });
        } catch { break; /* rate-limited or message gone: stop quietly */ }
      }
    })();
    const stopAnim = async () => { animDone = true; await anim; };
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
      await stopAnim();
      await failPlaceholder(chatId, phId, t(u.lang, "err_generic"));
      return;
    }
    const prompt = parsePrompt(out.text);
    if (!prompt) {
      await stopAnim();
      await failPlaceholder(chatId, phId, t(u.lang, "err_generic"));
      return;
    }
    await stopAnim();
    const baseIdea = refine ? refine.idea : idea;
    u.n += 1;
    // Sharpen offer: only for plain quick generations (no preset
    // answers, not a refine) with a short, likely-vague idea, and only
    // when the model returned a well-formed QUESTIONS block. The card
    // is complete without it — the offer is an optional upgrade.
    const questions = (!answers && !refine && baseIdea.length <= 140) ? parseQuestions(out.text) : null;
    u.flow = { name: "done", lastIdea: baseIdea, lastPrompt: prompt, ...(questions ? { questions } : {}) };
    await store.saveUser(u);
    const cardIds = await finishPlaceholder(chatId, phId, S.resultCard(u, { idea: baseIdea, prompt, sharpen: questions ? questions.length : 0 }));
    if (cardIds && cardIds.length) {
      // Register the card as a deliverable: it must never be deleted.
      // lastCard lets a REPLY to the card act as refine feedback.
      u.keep = [...(u.keep || []), ...cardIds].slice(-12);
      u.flow = { ...(u.flow || {}), lastCard: cardIds[0] };
      await store.saveUser(u);
    }
  }

  async function startIdeaFlow(u, chatId, msgId, { forceQuestions = false } = {}) {
    const detailed = u.mode === "detail" || forceQuestions;
    u.flow = detailed ? { name: "idea", thenQuestions: true } : { name: "idea" };
    u.flowMsg = await showMenu(u, chatId, detailed ? S.quickAskDetailed(u) : S.quickAsk(u), msgId);
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
    u.flowMsg = await showMenu(u, chatId, S.question(u, f.idx), null);
    await store.saveUser(u);
  }

  // ---- messages ------------------------------------------------------------
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    if (msg.chat.type !== "private") return; // v2 is a private-chat bot (+ inline)
    const u = await ensureUser(msg.from);
    const text = (msg.text || "").trim();

    if (!(await isMember(u.id))) {
      u.flow = null;
      u.flowMsg = null;
      await showMenu(u, chatId, S.joinScreen(u), null);
      await store.saveUser(u);
      return;
    }

    if (text === "/start" || text.startsWith("/start ")) {
      u.flow = null;
      u.flowMsg = null;
      await showMenu(u, chatId, S.home(u), null);
      await store.saveUser(u);
      return;
    }
    if (text === "/admin" && admins.includes(String(u.id))) {
      const ids = await store.getIds();
      await showMenu(u, chatId, S.adminHome(u, ids.length), null);
      await store.saveUser(u);
      return;
    }
    if (text === "/help") {
      await showMenu(u, chatId, S.guide(u), null);
      return;
    }
    if (text === "/mode") {
      await showMenu(u, chatId, S.modeScreen(u), null);
      return;
    }
    if (!text) return;
    if (text.length > IDEA_LIMIT) {
      await sendText(chatId, t(u.lang, "err_long"));
      return;
    }

    const f = u.flow || {};
    if (f.name === "sharpen") {
      // Typing while Sharpen questions are open cancels them silently;
      // the text is treated as a brand-new idea below.
      if (u.flowMsg === u.home) await showMenu(u, chatId, S.home(u), null);
      else if (u.flowMsg) await deleteMenu(chatId, u.flowMsg);
      u.flow = null;
      u.flowMsg = null;
      await store.saveUser(u);
    }
    // Replying to the latest result card = refine feedback for it (the
    // card carries no Refine button any more — the reply IS the button).
    if (msg.reply_to_message && f.name === "done" && f.lastPrompt && f.lastCard
      && msg.reply_to_message.message_id === f.lastCard) {
      try { await tg.call("setMessageReaction", { chat_id: chatId, message_id: msg.message_id, reaction: [{ type: "emoji", emoji: "⚡" }] }); } catch { /* optional */ }
      const refine = { idea: f.lastIdea, prompt: f.lastPrompt };
      u.flow = null;
      await store.saveUser(u);
      await runGeneration(u, chatId, { idea: text, refine });
      return;
    }
    if (f.name === "bcast" && admins.includes(String(u.id))) {
      u.flow = { name: "bcast_confirm", text, cursor: 0, sent: 0 };
      await store.saveUser(u);
      await showMenu(u, chatId, S.bcastConfirm(u, text), null);
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
    if (data === "join:check") {
      if (await isMember(u.id)) {
        try { await tg.call("answerCallbackQuery", { callback_query_id: cq.id }); } catch { /* stale tap */ }
        u.flow = null;
        u.flowMsg = null;
        await showMenu(u, chatId, S.home(u), msgId);
        await store.saveUser(u);
      } else {
        try { await tg.call("answerCallbackQuery", { callback_query_id: cq.id, text: t(u.lang, "join_alert"), show_alert: true }); } catch { /* stale tap */ }
      }
      return;
    }
    try { await tg.call("answerCallbackQuery", { callback_query_id: cq.id }); } catch { /* stale tap */ }
    if (!(await isMember(u.id))) {
      await showMenu(u, chatId, S.joinScreen(u), msgId);
      return;
    }

    const [ns, a, bArg] = data.split(":");
    if (ns === "nav") {
      if (a === "home") { u.flow = null; u.flowMsg = null; await showMenu(u, chatId, S.home(u), msgId); await store.saveUser(u); }
      else if (a === "quick") { await startIdeaFlow(u, chatId, msgId); }
      else if (a === "detail") { await startIdeaFlow(u, chatId, msgId, { forceQuestions: true }); }
      else if (a === "mode") { await showMenu(u, chatId, S.modeScreen(u), msgId); }
      else if (a === "bank") { await showMenu(u, chatId, S.bank(u), msgId); }
      else if (a === "settings") { await showMenu(u, chatId, S.settings(u), msgId); }
      else if (a === "lang") { await showMenu(u, chatId, S.language(u), msgId); }
      else if (a === "guide") { await showMenu(u, chatId, S.guide(u), msgId); }
      return;
    }
    if (ns === "mode") {
      // Ponytail/Caveman first pick an intensity; the rest apply at once
      // and the Mode screen re-renders in the menu with the new ✓.
      if (a === "ponytail" || a === "caveman") {
        await showMenu(u, chatId, S.styleLevels(u, a), msgId);
      } else {
        u.bundle = a;
        await store.saveUser(u);
        await showMenu(u, chatId, S.modeScreen(u), msgId);
      }
      return;
    }
    if (ns === "lvl") {
      u.bundle = a;
      u.level[a] = bArg;
      await store.saveUser(u);
      await showMenu(u, chatId, S.modeScreen(u), msgId);
      return;
    }
    if (ns === "dt") { u.mode = a; await store.saveUser(u); await showMenu(u, chatId, S.settings(u), msgId); return; }
    if (ns === "lang") {
      u.lang = a;
      await showMenu(u, chatId, S.home(u), msgId);
      await store.saveUser(u);
      return;
    }
    if (ns === "bank") {
      const preset = BANK.find((p) => p.id === a);
      if (preset) {
        // The item is a deliverable sent fresh; the menu (the list)
        // stays exactly as it is — no source is retired.
        const itemId = await sendRich(u, chatId, S.bankItemRich(u, preset), S.bankItem(u, preset));
        if (itemId) {
          u.keep = [...(u.keep || []), itemId].slice(-12);
          await store.saveUser(u);
        }
      }
      return;
    }
    if (ns === "shrp" && a === "start") {
      const f = u.flow || {};
      if (f.name === "done" && f.questions && f.questions.length) {
        u.flow = { name: "sharpen", idx: 0, answers: [], idea: f.lastIdea, prompt: f.lastPrompt, questions: f.questions, lastCard: f.lastCard };
        u.flowMsg = await showMenu(u, chatId, S.sharpenQuestion(u, u.flow), msgId);
        await store.saveUser(u);
      }
      return;
    }
    if (ns === "ans") {
      let f = u.flow || {};
      // Rapid successive taps can outrun KV propagation: if this tap
      // looks stale against the loaded record, reload ONCE and
      // re-check before dropping it (found live in the v2.6.0 E2E —
      // a Q2 tap arrived while the record still showed idx 0).
      if (f.name !== "sharpen" || (a !== "cancel" && parseInt(a, 10) !== f.idx)) {
        const fresh = await store.getUser(u.id);
        if (fresh) { Object.assign(u, fresh); f = u.flow || {}; }
      }
      if (f.name !== "sharpen") return;
      if (a === "cancel") {
        u.flow = { name: "done", lastIdea: f.idea, lastPrompt: f.prompt, lastCard: f.lastCard };
        u.flowMsg = null;
        await showMenu(u, chatId, S.home(u), msgId);
        await store.saveUser(u);
        return;
      }
      const qIdx = parseInt(a, 10);
      if (Number.isNaN(qIdx) || qIdx !== f.idx) return; // stale tap on an older question
      f.answers[f.idx] = bArg === "skip" ? "—" : (f.questions[f.idx].options[parseInt(bArg, 10)] || "—");
      f.idx += 1;
      if (f.idx >= f.questions.length) {
        const answers = f.answers.filter((x) => x && x !== "—");
        const idea = f.idea;
        u.flow = null;
        await store.saveUser(u);
        await runGeneration(u, chatId, { idea, answers });
      } else {
        await store.saveUser(u);
        u.flowMsg = await showMenu(u, chatId, S.sharpenQuestion(u, f), msgId);
        await store.saveUser(u);
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
        await showMenu(u, chatId, S.adminHome(u, ids.length), msgId);
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
    if (!(await isMember(iq.from.id))) {
      results.push({
        type: "article",
        id: "join",
        title: t(lang, "join_title"),
        description: t(lang, "join_body"),
        input_message_content: { message_text: `${t(lang, "join_body")}\nhttps://t.me/ILIVIR3` },
      });
      try { await tg.call("answerInlineQuery", { inline_query_id: iq.id, results, cache_time: 30, is_personal: true }); } catch { /* expired query */ }
      return;
    }
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

// ---- heartbeat (Worker cron) -------------------------------------------------
// Every 15 days, each known user gets ONE tiny "still alive" message
// with a rotating tip and a single Quick Prompt button. The cron fires
// daily; the 15-day epoch gate in KV (hb:last) makes 14 of 15 runs
// silent no-ops, so the spacing is exact regardless of month lengths.
export async function runHeartbeat(env) {
  const epoch = Math.floor(Date.now() / (15 * 864e5));
  const last = parseInt((await env.LYRA_STATE.get("hb:last")) || "-1", 10);
  if (last === epoch) return;
  const tg = createTelegram(env.TELEGRAM_TOKEN);
  const store = createStore(env);
  const ids = await store.getIds();
  let sent = 0;
  for (const id of ids) {
    const u = (await store.getUser(id)) || defaultUser(id);
    const s = S.heartbeat(u, epoch);
    try {
      await tg.call("sendMessage", { chat_id: id, text: s.text, entities: s.entities, reply_markup: s.keyboard });
      sent += 1;
    } catch { /* user blocked the bot — skip quietly */ }
  }
  await env.LYRA_STATE.put("hb:last", String(epoch));
  console.log(`heartbeat epoch ${epoch}: sent ${sent}/${ids.length}`);
}
