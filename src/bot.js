import { CATEGORY_MAP, BASE_4D } from './templates.js';
import { getMsg } from './messages.js';
import {
  buildMessage, B, I, C, PRE, BQ, P,
  buildPreBlock, buildBlockQuote,
  sendMessage, editMessageText, answerCallbackQuery,
  deleteMessage, sendChatAction, withTyping
} from './telegram.js';
import { enhanceWithAI } from './openrouter.js';
import {
  mainMenuKeyboard, presetsKeyboard, backToPresetsKeyboard,
  backToMainKeyboard, languageKeyboard, replyKeyboard, followupKeyboard
} from './keyboards.js';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 500;

function cleanCache() {
  if (cache.size > MAX_CACHE) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
}

function stateKey(id) {
  return `lyra_state:${id}`;
}

async function getState(chatId, env) {
  const c = cache.get(chatId);
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  try {
    const d = await env.LYRA_STATE.get(stateKey(chatId), 'json') || {};
    cache.set(chatId, { data: d, ts: Date.now() });
    return d;
  } catch {
    return {};
  }
}

async function getUserLang(chatId, env) {
  const s = await getState(chatId, env);
  return s?.lang || 'en';
}

async function setState(chatId, data, env) {
  const existing = await getState(chatId, env);
  const merged = { ...existing, ...data };
  cache.set(chatId, { data: merged, ts: Date.now() });
  cleanCache();
  try {
    await env.LYRA_STATE.put(stateKey(chatId), JSON.stringify(merged));
  } catch {}
}

function parseAI(r) {
  const pm = r.match(/<PROMPT>([\s\S]*?)<\/PROMPT>/);
  const fm = r.match(/<FOLLOWUP>([\s\S]*?)<\/FOLLOWUP>/);
  return {
    prompt: pm ? pm[1].trim() : r.trim(),
    followup: fm ? fm[1].trim() : null
  };
}

function formatResultMessage(userText, prompt, followup, lang) {
  const segs = [];

  segs.push(B(`${getMsg(lang, 'result_label_input')}\n`));
  segs.push(I(userText + '\n'));
  segs.push(P('\n'));
  segs.push(B(`${getMsg(lang, 'result_label_prompt')}\n`));

  const preBlock = buildPreBlock(prompt);
  segs.push(preBlock);

  if (followup) {
    segs.push(P('\n'));
    segs.push(I(`${getMsg(lang, 'result_label_followup')}: ${followup}\n`));
  }

  segs.push(buildBlockQuote(getMsg(lang, 'result_footer')));
  return buildMessage(segs);
}

function formatHelpMessage(text) {
  const entities = [];
  const re = /\/(\w+)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    entities.push({ type: 'code', offset: match.index, length: match[0].length });
  }
  return entities.length ? { text, entities } : text;
}

export default {
  async handleUpdate(update, env) {
    try {
      if (!update || (!update.message && !update.callback_query)) {
        console.warn('Invalid update:', JSON.stringify(update).slice(0, 200));
        return;
      }
      if (update.message) await this.handleMessage(update.message, env);
      else if (update.callback_query) await this.handleCallback(update.callback_query, env);
    } catch (err) {
      console.error('Update error:', err.message, err.stack);
      try {
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (!chatId) return;
        await sendMessage(chatId, '⚠️ Error occurred. Try /start', {}, env);
      } catch {}
    }
  },

  async handleMessage(msg, env) {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const lang = await getUserLang(chatId, env);

    if (!text) {
      await sendMessage(chatId, getMsg(lang, 'error'), { reply_markup: replyKeyboard(lang) }, env);
      return;
    }

    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, msg, env);
      return;
    }

    if (text === `✍️ ${getMsg(lang, 'reply_freeform')}`) {
      await sendMessage(chatId, getMsg(lang, 'send_text_prompt', 'Free-Form'), {
        reply_markup: replyKeyboard(lang)
      }, env);
      await setState(chatId, { step: 'awaiting_text', systemPrompt: BASE_4D, categoryId: 'freeform' }, env);
      return;
    }

    if (text === `💻 ${getMsg(lang, 'reply_code')}`) {
      await this.enterCategory(chatId, 'code', lang, env);
      return;
    }

    if (text === `🎨 ${getMsg(lang, 'reply_image')}`) {
      await this.enterCategory(chatId, 'image', lang, env);
      return;
    }

    if (text === `🎬 ${getMsg(lang, 'reply_video')}`) {
      await this.enterCategory(chatId, 'video', lang, env);
      return;
    }

    if (text === `💬 ${getMsg(lang, 'reply_refine')}`) {
      await sendMessage(chatId, getMsg(lang, 'followup_hint'), {
        reply_markup: followupKeyboard(lang)
      }, env);
      return;
    }

    if (text === `✨ ${getMsg(lang, 'reply_new_prompt')}`) {
      await setState(chatId, { step: null }, env);
      await sendMessage(chatId, getMsg(lang, 'start'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    const state = await getState(chatId, env);
    const msgId = msg.message_id;

    if (state?.step === 'awaiting_text' && state.systemPrompt) {
      await this.processPrompt(chatId, text, state.systemPrompt, state.categoryId, env, msgId);
      return;
    }

    if (state?.step === 'awaiting_followup' && state.systemPrompt) {
      await this.processFollowup(chatId, text, state.systemPrompt, state.originalText, env, msgId);
      return;
    }

    await this.processPrompt(chatId, text, BASE_4D, 'freeform', env, msgId);
  },

  async enterCategory(chatId, categoryId, lang, env) {
    await setState(chatId, { step: 'awaiting_text', systemPrompt: CATEGORY_MAP[categoryId].customSystemPrompt, categoryId }, env);
    const catName = CATEGORY_MAP[categoryId]?.name_en || categoryId;
    await sendMessage(chatId, getMsg(lang, 'send_text_prompt', catName), {
      reply_markup: replyKeyboard(lang)
    }, env);
  },

  async handleCommand(chatId, cmd, msg, env) {
    try {
      const lang = await getUserLang(chatId, env);
      const name = msg.from?.first_name || '';

      const lowerCmd = cmd.toLowerCase().split(' ')[0].split('@')[0];
      switch (lowerCmd) {
        case '/start':
          await setState(chatId, { step: null }, env);
          await sendMessage(chatId, name ? getMsg(lang, 'start_with_name', name) : getMsg(lang, 'start'), {
            reply_markup: mainMenuKeyboard(lang)
          }, env);
          break;
      case '/help':
        await sendMessage(chatId, formatHelpMessage(getMsg(lang, 'help')), {
          reply_markup: backToMainKeyboard(lang)
        }, env);
        break;
        case '/language':
          await sendMessage(chatId, getMsg(lang, 'language_prompt'), {
            reply_markup: languageKeyboard()
          }, env);
          break;
        default:
          await sendMessage(chatId, getMsg(lang, 'error'), {
            reply_markup: mainMenuKeyboard(lang)
          }, env);
      }
    } catch (err) {
      console.error('Command error:', err.message, err.stack);
      await sendMessage(chatId, '⚠️ Command failed. Try /start', {}, env);
    }
  },

  async handleCallback(cb, env) {
    const chatId = cb.message.chat.id;
    const mid = cb.message.message_id;
    const data = cb.data;
    const lang = await getUserLang(chatId, env);

    await answerCallbackQuery(cb.id, null, {}, env);

    if (data === 'menu_main') {
      await setState(chatId, { step: null }, env);
      await editMessageText(chatId, mid, getMsg(lang, 'start'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_freeform') {
      await setState(chatId, { step: 'awaiting_text', systemPrompt: BASE_4D, categoryId: 'freeform' }, env);
      await editMessageText(chatId, mid, getMsg(lang, 'send_text_prompt', 'Free-Form'), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_help') {
      await editMessageText(chatId, mid, formatHelpMessage(getMsg(lang, 'help')), {
        reply_markup: backToMainKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_language') {
      await editMessageText(chatId, mid, getMsg(lang, 'language_prompt'), {
        reply_markup: languageKeyboard()
      }, env);
      return;
    }

    if (data.startsWith('menu_presets_')) {
      const cid = data.replace('menu_presets_', '');
      await setState(chatId, { step: null }, env);
      await editMessageText(chatId, mid, getMsg(lang, 'choose_preset'), {
        reply_markup: presetsKeyboard(cid, lang)
      }, env);
      return;
    }

    if (data.startsWith('custom_')) {
      const cid = data.slice(7);
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      await setState(chatId, { step: 'awaiting_text', systemPrompt: cat.customSystemPrompt, categoryId: cid }, env);
      await editMessageText(chatId, mid, getMsg(lang, 'send_text_prompt', cat.name_en), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    if (data.startsWith('cat_')) {
      const cid = data.split('_')[1];
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      await setState(chatId, { step: null }, env);
      await editMessageText(chatId, mid, getMsg(lang, 'choose_preset'), {
        reply_markup: presetsKeyboard(cid, lang)
      }, env);
      return;
    }

    if (data.startsWith('preset_')) {
      const parts = data.split('_');
      const cid = parts[1];
      const pid = parts.slice(2).join('_');
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      const preset = cat.presets.find(p => p.id === pid);
      if (!preset) return;
      await setState(chatId, {
        step: 'awaiting_text', systemPrompt: preset.systemPrompt, categoryId: cid
      }, env);
      await editMessageText(chatId, mid, getMsg(lang, 'preset_prompt', preset.title), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    if (data.startsWith('lang_')) {
      const nl = data.replace('lang_', '');
      await setState(chatId, { lang: nl }, env);
      await editMessageText(chatId, mid, getMsg(nl, 'language_changed'), {
        reply_markup: mainMenuKeyboard(nl)
      }, env);
    }
  },

  async processPrompt(chatId, text, systemPrompt, categoryId, env, replyToMsgId) {
    const lang = await getUserLang(chatId, env);
    let statusId;

    try {
      await sendChatAction(chatId, 'typing', env).catch(() => {});
      const status = await sendMessage(chatId, getMsg(lang, 'generating'), {}, env);
      statusId = status.result?.message_id;

      const ai = await withTyping(chatId, env, () => enhanceWithAI(text, systemPrompt, env));
      const { prompt, followup } = parseAI(ai);

      await deleteMessage(chatId, statusId, env);

      const content = formatResultMessage(text, prompt, followup, lang);

      await sendMessage(chatId, content, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🏠 ${getMsg(lang, 'main_menu')}`, callback_data: 'menu_main' }]
          ]
        },
        reply_parameters: replyToMsgId ? {
          message_id: replyToMsgId,
          quote: text.length > 120 ? text.slice(0, 120) + '...' : text,
          allow_sending_without_reply: true
        } : undefined
      }, env);

      if (followup) {
        await setState(chatId, { step: 'awaiting_followup', systemPrompt, originalText: text, categoryId }, env);
      } else {
        await setState(chatId, { step: null }, env);
      }
    } catch (err) {
      console.error('Prompt error:', err);
      await deleteMessage(chatId, statusId, env);
      try {
        await sendMessage(chatId, getMsg(lang, 'api_error'), {
          reply_markup: replyKeyboard(lang)
        }, env);
      } catch {}
    }
  },

  async processFollowup(chatId, text, systemPrompt, originalText, env, replyToMsgId) {
    const lang = await getUserLang(chatId, env);
    const state = await getState(chatId, env);
    const catId = state?.categoryId || 'freeform';
    let statusId;

    try {
      await sendChatAction(chatId, 'typing', env).catch(() => {});
      const status = await sendMessage(chatId, getMsg(lang, 'generating'), {}, env);
      statusId = status.result?.message_id;

      const refined = originalText + '\n\nAdditional context: ' + text;
      const noFollowup = systemPrompt + '\n\nIMPORTANT: Do NOT generate follow-up questions. Output ONLY the optimized prompt.';
      const ai = await withTyping(chatId, env, () => enhanceWithAI(refined, noFollowup, env));
      const clean = ai.replace(/<\/?PROMPT>/g, '').replace(/<\/?FOLLOWUP>[\s\S]*?<\/FOLLOWUP>/g, '').trim();
      const combined = originalText + '\n' + text;

      await deleteMessage(chatId, statusId, env);

      const content = formatResultMessage(combined, clean, null, lang);

      await sendMessage(chatId, content, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🏠 ${getMsg(lang, 'main_menu')}`, callback_data: 'menu_main' }]
          ]
        },
        reply_parameters: replyToMsgId ? {
          message_id: replyToMsgId,
          quote: text.length > 120 ? text.slice(0, 120) + '...' : text,
          allow_sending_without_reply: true
        } : undefined
      }, env);
      await setState(chatId, { step: null }, env);
    } catch (err) {
      console.error('Followup error:', err);
      await deleteMessage(chatId, statusId, env);
      try {
        await sendMessage(chatId, getMsg(lang, 'api_error'), {
          reply_markup: replyKeyboard(lang)
        }, env);
      } catch {}
    }
  }
};
