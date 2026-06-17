import { CATEGORY_MAP, getPresetTitle } from './templates.js';
import { getMsg } from './messages.js';
import { sendMessage, editMessageText, answerCallbackQuery, sendMessageDraft, sendChatAction } from './telegram.js';
import { enhanceWithAI, streamAI } from './openrouter.js';
import {
  mainMenuKeyboard,
  categoriesKeyboard,
  presetsKeyboard,
  backToPresetsKeyboard,
  backToMainKeyboard,
  resultKeyboard,
  languageKeyboard
} from './keyboards.js';

const BOT_FOOTER = '\n\n—\n> @Lyra_IVbot';
const stateCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 500;
const STREAM_UPDATE_MS = 400;

function cleanCache() {
  if (stateCache.size > MAX_CACHE) {
    const now = Date.now();
    for (const [key, val] of stateCache) {
      if (now - val.ts > CACHE_TTL) stateCache.delete(key);
    }
  }
}

function stateKey(chatId) {
  return `lyra_state:${chatId}`;
}

async function getState(chatId, env) {
  const cached = stateCache.get(chatId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  try {
    const data = await env.LYRA_STATE.get(stateKey(chatId), 'json') || {};
    stateCache.set(chatId, { data, ts: Date.now() });
    return data;
  } catch { return {}; }
}

async function getUserLang(chatId, env) {
  const state = await getState(chatId, env);
  return state?.lang || 'en';
}

async function setUserState(chatId, data, env) {
  const existing = await getState(chatId, env);
  const merged = { ...existing, ...data };
  stateCache.set(chatId, { data: merged, ts: Date.now() });
  cleanCache();
  try { await env.LYRA_STATE.put(stateKey(chatId), JSON.stringify(merged)); } catch {}
}

function addFooter(text) {
  return text + BOT_FOOTER;
}

function parseAIResponse(response) {
  const promptMatch = response.match(/<PROMPT>([\s\S]*?)<\/PROMPT>/);
  const followupMatch = response.match(/<FOLLOWUP>([\s\S]*?)<\/FOLLOWUP>/);
  return {
    prompt: promptMatch ? promptMatch[1].trim() : response.trim(),
    followup: followupMatch ? followupMatch[1].trim() : null
  };
}

export default {
  async handleUpdate(update, env) {
    try {
      if (update.message) await this.handleMessage(update.message, env);
      else if (update.callback_query) await this.handleCallback(update.callback_query, env);
    } catch (err) {
      console.error('Update error:', err);
      if (update.message) {
        const lang = await getUserLang(update.message.chat.id, env);
        await sendMessage(update.message.chat.id, addFooter(getMsg(lang, 'error')), { reply_markup: mainMenuKeyboard(lang) }, env);
      } else if (update.callback_query) {
        const lang = await getUserLang(update.callback_query.message.chat.id, env);
        await answerCallbackQuery(update.callback_query.id, getMsg(lang, 'error'), {}, env);
      }
    }
  },

  async handleMessage(message, env) {
    const chatId = message.chat.id;
    const text = message.text?.trim();
    const lang = await getUserLang(chatId, env);

    if (!text) {
      await sendMessage(chatId, addFooter(getMsg(lang, 'error')), { reply_markup: mainMenuKeyboard(lang) }, env);
      return;
    }

    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, message, env);
      return;
    }

    const state = await getState(chatId, env);

    if (state?.step === 'awaiting_text' && state.systemPrompt) {
      await this.processPrompt(chatId, text, state.systemPrompt, state.isCustom, state.categoryId, state.presetId, env);
      return;
    }

    if (state?.step === 'awaiting_followup' && state.systemPrompt) {
      await this.processFollowup(chatId, text, state.systemPrompt, state.originalText, env);
      return;
    }

    await sendMessage(chatId, addFooter(getMsg(lang, 'no_category')), {
      reply_markup: mainMenuKeyboard(lang)
    }, env);
  },

  async handleCommand(chatId, command, message, env) {
    const lang = await getUserLang(chatId, env);
    const name = message.from?.first_name || '';

    switch (command.toLowerCase()) {
      case '/start':
        await setUserState(chatId, { step: null }, env);
        await sendMessage(chatId, addFooter(name ? getMsg(lang, 'start_with_name', name) : getMsg(lang, 'start')), {
          reply_markup: mainMenuKeyboard(lang)
        }, env);
        break;
      case '/help':
        await sendMessage(chatId, addFooter(getMsg(lang, 'help')), {
          reply_markup: backToMainKeyboard(lang)
        }, env);
        break;
      case '/language':
        await sendMessage(chatId, addFooter(getMsg(lang, 'language_prompt')), {
          reply_markup: languageKeyboard()
        }, env);
        break;
      default:
        await sendMessage(chatId, addFooter(getMsg(lang, 'error')), {
          reply_markup: mainMenuKeyboard(lang)
        }, env);
    }
  },

  async handleCallback(callback, env) {
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;
    const data = callback.data;
    const lang = await getUserLang(chatId, env);

    if (data === 'copy') {
      await answerCallbackQuery(callback.id, getMsg(lang, 'copy'), { show_alert: false }, env);
      return;
    }

    await answerCallbackQuery(callback.id, null, {}, env);

    if (data === 'menu_main') {
      await setUserState(chatId, { step: null }, env);
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'start')), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_categories') {
      await setUserState(chatId, { step: null }, env);
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'choose_category')), {
        reply_markup: categoriesKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_help') {
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'help')), {
        reply_markup: backToMainKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_language') {
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'language_prompt')), {
        reply_markup: languageKeyboard()
      }, env);
      return;
    }

    if (data.startsWith('menu_presets_')) {
      const categoryId = data.replace('menu_presets_', '');
      await setUserState(chatId, { step: null }, env);
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'choose_preset')), {
        reply_markup: presetsKeyboard(categoryId, lang)
      }, env);
      return;
    }

    if (data.endsWith('_custom')) {
      const categoryId = data.split('_')[1];
      const cat = CATEGORY_MAP[categoryId];
      if (!cat) return;

      await setUserState(chatId, { step: 'awaiting_text', systemPrompt: cat.customSystemPrompt, isCustom: true, categoryId }, env);
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'send_text_prompt', cat.name_en)), {
        reply_markup: backToPresetsKeyboard(categoryId, lang)
      }, env);
      return;
    }

    if (data.startsWith('cat_')) {
      const categoryId = data.split('_')[1];
      await setUserState(chatId, { step: null }, env);
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'choose_preset')), {
        reply_markup: presetsKeyboard(categoryId, lang)
      }, env);
      return;
    }

    if (data.startsWith('preset_')) {
      const parts = data.split('_');
      const categoryId = parts[1];
      const presetId = parts.slice(2).join('_');
      const cat = CATEGORY_MAP[categoryId];
      if (!cat) return;

      const preset = cat.presets.find(p => p.id === presetId);
      if (!preset) return;

      await setUserState(chatId, { step: 'awaiting_text', systemPrompt: preset.systemPrompt, isCustom: false, categoryId, presetId }, env);
      await editMessageText(chatId, messageId, addFooter(getMsg(lang, 'preset_prompt', preset.title)), {
        reply_markup: backToPresetsKeyboard(categoryId, lang)
      }, env);
      return;
    }

    if (data.startsWith('lang_')) {
      const newLang = data.replace('lang_', '');
      await setUserState(chatId, { lang: newLang }, env);
      await editMessageText(chatId, messageId, addFooter(newLang === 'fa' ? '🌐 زبان به فارسی تغییر کرد.' : newLang === 'ru' ? '🌐 Язык изменён на русский.' : '🌐 Language changed to English.'), {
        reply_markup: mainMenuKeyboard(newLang)
      }, env);
      return;
    }
  },

  async processPrompt(chatId, userText, systemPrompt, isCustom, categoryId, presetId, env) {
    const lang = await getUserLang(chatId, env);
    let statusMsg;

    try {
      await sendChatAction(chatId, 'typing', env);
      statusMsg = await sendMessage(chatId, `_${getMsg(lang, 'generating')}_`, {}, env);

      const aiResponse = await enhanceWithAI(userText, systemPrompt, env);

      const { prompt, followup } = parseAIResponse(aiResponse);
      const finalText = '`> ' + userText + '`\n\n```\n' + prompt + '\n```' + BOT_FOOTER;

      await this.deleteMessage(chatId, statusMsg?.result?.message_id, env);
      await sendMessage(chatId, finalText, {
        reply_markup: resultKeyboard(categoryId, lang)
      }, env);

      if (followup) {
        await setUserState(chatId, { step: 'awaiting_followup', systemPrompt, originalText: userText, categoryId }, env);
        await sendMessage(chatId, addFooter(getMsg(lang, 'followup_questions') + followup), {
          reply_markup: backToPresetsKeyboard(categoryId, lang)
        }, env);
      } else {
        await setUserState(chatId, { step: null }, env);
      }
    } catch (err) {
      console.error('Process prompt error:', err);
      await this.deleteMessage(chatId, statusMsg?.result?.message_id, env);
      await sendMessage(chatId, addFooter(getMsg(lang, 'api_error')), {
        reply_markup: backToPresetsKeyboard(categoryId, lang)
      }, env);
    }
  },

  async processFollowup(chatId, followupText, systemPrompt, originalText, env) {
    const lang = await getUserLang(chatId, env);
    const categoryId = (await getState(chatId, env))?.categoryId || 'code';
    const statusMsg = await sendMessage(chatId, getMsg(lang, 'generating'), {}, env);

    try {
      const refinedPrompt = `${originalText}\n\nAdditional context: ${followupText}`;
      const noFollowupPrompt = systemPrompt + `\n\nIMPORTANT: Do NOT generate follow-up questions. Output ONLY the optimized prompt.`;

      const aiResponse = await enhanceWithAI(refinedPrompt, noFollowupPrompt, env);

      const cleanPrompt = aiResponse.replace(/<\/?PROMPT>/g, '').replace(/<\/?FOLLOWUP>[\s\S]*?<\/?FOLLOWUP>/g, '').trim();
      const combinedDisplay = originalText + '\n' + followupText;
      const responseText = '`> ' + combinedDisplay + '`\n\n```\n' + cleanPrompt + '\n```' + BOT_FOOTER;

      await sendMessage(chatId, responseText, {
        reply_markup: resultKeyboard(categoryId, lang)
      }, env);

      await this.deleteMessage(chatId, statusMsg.result.message_id, env);
      await setUserState(chatId, { step: null }, env);
    } catch (err) {
      console.error('Process followup error:', err);
      await this.deleteMessage(chatId, statusMsg?.result?.message_id, env);
      await sendMessage(chatId, addFooter(getMsg(lang, 'api_error')), {
        reply_markup: backToPresetsKeyboard(categoryId, lang)
      }, env);
    }
  },

  async deleteMessage(chatId, messageId, env) {
    if (!messageId) return;
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    }).catch(() => {});
  }
};