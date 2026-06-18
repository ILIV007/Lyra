import { CATEGORY_MAP, BASE_4D } from './templates.js';
import { getMsg } from './messages.js';
import { sendMessage, editMessageText, answerCallbackQuery, deleteMessage, sendChatAction, escapeMD } from './telegram.js';
import { enhanceWithAI } from './openrouter.js';
import {
  mainMenuKeyboard,
  presetsKeyboard,
  backToPresetsKeyboard,
  backToMainKeyboard,
  languageKeyboard
} from './keyboards.js';

const FOOTER_TEXT = '— @Lyra_IVbot';
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

function footer(text) {
  return text + '\n\n> ' + escapeMD(FOOTER_TEXT);
}

function parseAI(r) {
  const pm = r.match(/<PROMPT>([\s\S]*?)<\/PROMPT>/);
  const fm = r.match(/<FOLLOWUP>([\s\S]*?)<\/FOLLOWUP>/);
  return {
    prompt: pm ? pm[1].trim() : r.trim(),
    followup: fm ? fm[1].trim() : null
  };
}

export default {
  async handleUpdate(update, env) {
    try {
      if (!update || (!update.message && !update.callback_query)) {
        console.warn('Invalid update structure:', JSON.stringify(update));
        return;
      }
      if (update.message) await this.handleMessage(update.message, env);
      else if (update.callback_query) await this.handleCallback(update.callback_query, env);
    } catch (err) {
      console.error('Update error:', err);
      try {
        const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
        if (!chatId) {
          console.error('Could not extract chatId from update');
          return;
        }
        const lang = await getUserLang(chatId, env);
        await sendMessage(chatId, footer(getMsg(lang, 'error')), { reply_markup: mainMenuKeyboard(lang) }, env);
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    }
  },

  async handleMessage(msg, env) {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const lang = await getUserLang(chatId, env);

    if (!text) {
      await sendMessage(chatId, footer(getMsg(lang, 'error')), { reply_markup: mainMenuKeyboard(lang) }, env);
      return;
    }

    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, msg, env);
      return;
    }

    const state = await getState(chatId, env);

    if (state?.step === 'awaiting_text' && state.systemPrompt) {
      await this.processPrompt(chatId, text, state.systemPrompt, state.categoryId, env);
      return;
    }

    if (state?.step === 'awaiting_followup' && state.systemPrompt) {
      await this.processFollowup(chatId, text, state.systemPrompt, state.originalText, env);
      return;
    }

    await this.processPrompt(chatId, text, BASE_4D, null, env);
  },

  async handleCommand(chatId, cmd, msg, env) {
    const lang = await getUserLang(chatId, env);
    const name = msg.from?.first_name || '';

    const lowerCmd = cmd.toLowerCase().split(' ')[0].split('@')[0];
    switch (lowerCmd) {
      case '/start':
        await setState(chatId, { step: null }, env);
        await sendMessage(chatId, footer(name ? getMsg(lang, 'start_with_name', escapeMD(name)) : getMsg(lang, 'start')), {
          reply_markup: mainMenuKeyboard(lang)
        }, env);
        break;
      case '/help':
        await sendMessage(chatId, footer(getMsg(lang, 'help')), {
          reply_markup: backToMainKeyboard(lang)
        }, env);
        break;
      case '/language':
        await sendMessage(chatId, footer(getMsg(lang, 'language_prompt')), {
          reply_markup: languageKeyboard()
        }, env);
        break;
      default:
        await sendMessage(chatId, footer(getMsg(lang, 'error')), {
          reply_markup: mainMenuKeyboard(lang)
        }, env);
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
      await editMessageText(chatId, mid, footer(getMsg(lang, 'start')), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_help') {
      await editMessageText(chatId, mid, footer(getMsg(lang, 'help')), {
        reply_markup: backToMainKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_language') {
      await editMessageText(chatId, mid, footer(getMsg(lang, 'language_prompt')), {
        reply_markup: languageKeyboard()
      }, env);
      return;
    }

    if (data.startsWith('menu_presets_')) {
      const cid = data.replace('menu_presets_', '');
      const cat = CATEGORY_MAP[cid];
      await setState(chatId, { step: null }, env);
      await editMessageText(chatId, mid, footer(lang === 'fa' ? '📂 **' + cat.name_fa + '** — یک پرامپت آماده انتخاب کن:' : lang === 'ru' ? '📂 **' + cat.name_en + '** — Выберите готовый промпт:' : '📂 **' + cat.name_en + '** — Select a preset or build your own:'), {
        reply_markup: presetsKeyboard(cid, lang)
      }, env);
      return;
    }

    if (data.endsWith('_custom')) {
      const cid = data.split('_')[1];
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      await setState(chatId, { step: 'awaiting_text', systemPrompt: cat.customSystemPrompt, categoryId: cid }, env);
      await editMessageText(chatId, mid, footer(getMsg(lang, 'send_text_prompt', cat.name_en)), {
        reply_markup: backToPresetsKeyboard(cid, lang)
      }, env);
      return;
    }

    if (data.startsWith('cat_')) {
      const cid = data.split('_')[1];
      const cat = CATEGORY_MAP[cid];
      await setState(chatId, { step: null }, env);
      await editMessageText(chatId, mid, footer(lang === 'fa' ? '📂 **' + cat.name_fa + '** — یک پرامپت آماده انتخاب کن:' : lang === 'ru' ? '📂 **' + cat.name_en + '** — Выберите готовый промпт:' : '📂 **' + cat.name_en + '** — Select a preset or build your own:'), {
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
      await editMessageText(chatId, mid, footer(getMsg(lang, 'preset_prompt', preset.title)), {
        reply_markup: backToPresetsKeyboard(cid, lang)
      }, env);
      return;
    }

    if (data.startsWith('lang_')) {
      const nl = data.replace('lang_', '');
      await setState(chatId, { lang: nl }, env);
      const txt = getMsg(nl, 'language_changed');
      await editMessageText(chatId, mid, footer(txt), {
        reply_markup: mainMenuKeyboard(nl)
      }, env);
    }
  },

  async processPrompt(chatId, text, systemPrompt, categoryId, env) {
    const lang = await getUserLang(chatId, env);
    let statusId;

    try {
      sendChatAction(chatId, 'typing', env).catch(() => {});
      const status = await sendMessage(chatId, '_' + escapeMD(getMsg(lang, 'generating')) + '_', {}, env);
      statusId = status.result?.message_id;

      const ai = await enhanceWithAI(text, systemPrompt, env);
      const { prompt, followup } = parseAI(ai);
      let result = '> ' + escapeMD(text) + '\n\n```\n' + prompt + '\n```';
      if (followup) result += '\n\n> _' + escapeMD(followup) + '_';
      result += '\n> ' + escapeMD(FOOTER_TEXT);

      await deleteMessage(chatId, statusId, env);
      await sendMessage(chatId, result, {}, env);

      if (followup) {
        await setState(chatId, { step: 'awaiting_followup', systemPrompt, originalText: text, categoryId }, env);
      } else {
        await setState(chatId, { step: null }, env);
      }
    } catch (err) {
      console.error('Prompt error:', err);
      await deleteMessage(chatId, statusId, env);
      try {
        await sendMessage(chatId, footer(getMsg(lang, 'api_error')), {}, env);
      } catch {}
    }
  },

  async processFollowup(chatId, text, systemPrompt, originalText, env) {
    const lang = await getUserLang(chatId, env);
    let statusId;

    try {
      const status = await sendMessage(chatId, '_' + escapeMD(getMsg(lang, 'generating')) + '_', {}, env);
      statusId = status.result?.message_id;

      const refined = originalText + '\n\nAdditional context: ' + text;
      const noFollowup = systemPrompt + '\n\nIMPORTANT: Do NOT generate follow-up questions. Output ONLY the optimized prompt.';
      const ai = await enhanceWithAI(refined, noFollowup, env);
      const clean = ai.replace(/<\/?PROMPT>/g, '').replace(/<\/?FOLLOWUP>[\s\S]*?<\/FOLLOWUP>/g, '').trim();
      const combined = originalText + '\n' + text;
      const result = '> ' + escapeMD(combined) + '\n\n```\n' + clean + '\n```\n> ' + escapeMD(FOOTER_TEXT);

      await deleteMessage(chatId, statusId, env);
      await sendMessage(chatId, result, {}, env);
      await setState(chatId, { step: null }, env);
    } catch (err) {
      console.error('Followup error:', err);
      await deleteMessage(chatId, statusId, env);
      try {
        await sendMessage(chatId, footer(getMsg(lang, 'api_error')), {}, env);
      } catch {}
    }
  }
};
