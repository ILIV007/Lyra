import { CATEGORY_MAP, base4D, getPresetTitle, getCategoryDisplay } from './templates.js';
import { BANK_PRESETS } from './bank-presets.js';
import { getMsg } from './messages.js';
import {
  buildMessage, B, I, C, PRE, BQ, P,
  buildPreBlock, buildBlockQuote,
  sendMessage, editMessageText, answerCallbackQuery,
  deleteMessage, withTyping
} from './telegram.js';
import { enhanceWithAI } from './openrouter.js';
import {
  mainMenuKeyboard, presetsKeyboard, backToPresetsKeyboard,
  backToMainKeyboard, languageKeyboard, replyKeyboard, followupKeyboard,
  categoryChoiceKeyboard, bankPresetsKeyboard, adminPanelKeyboard
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
  const raw = r.replace(/<\/?FOLLOWUP>[\s\S]*?$/i, '').trim();
  const pm = raw.match(/<PROMPT>([\s\S]*?)<\/PROMPT>/);
  const fm = r.match(/<FOLLOWUP>([\s\S]*?)<\/FOLLOWUP>/);
  return {
    prompt: pm ? pm[1].trim() : raw.trim(),
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

  segs.push(P('\n'));

  const BOT_URL = 'https://t.me/Lyra_IVbot';
  const footerText = getMsg(lang, 'result_footer');
  segs.push({
    t: footerText,
    e: [
      { type: 'blockquote', offset: 0, length: footerText.length },
      { type: 'text_link', offset: footerText.indexOf('Lyra'), length: 4, url: BOT_URL }
    ]
  });
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

function normMatch(text, expected) {
  const a = text.normalize('NFC').replace(/\uFE0F/g, '');
  const b = expected.normalize('NFC').replace(/\uFE0F/g, '');
  return a === b;
}

function isAdmin(chatId, env) {
  const ids = env.ADMIN_IDS?.split(',').map(s => s.trim()).filter(Boolean) || [];
  return ids.includes(String(chatId));
}

async function trackUser(chatId, env) {
  try {
    await env.LYRA_STATE.put(`lyra_user:${chatId}`, '1');
  } catch {}
}

async function getBankPresets(env) {
  const presets = [...BANK_PRESETS];
  try {
    const keys = await env.LYRA_STATE.list({ prefix: 'bank_prompt:' });
    for (const key of keys.keys) {
      const val = await env.LYRA_STATE.get(key.name, 'json');
      if (val) presets.push(val);
    }
  } catch {}
  return presets;
}

function buildFullPrompt(suffix, lang) {
  return base4D(lang) + (suffix || '');
}

async function updateStatus(chatId, messageId, text, env) {
  try {
    await editMessageText(chatId, messageId, text, {}, env);
  } catch {}
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

    if (!isAdmin(chatId, env)) await trackUser(chatId, env);

    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, msg, env);
      return;
    }

    const state = await getState(chatId, env);
    const msgId = msg.message_id;

    // — reply keyboard buttons (robust emoji matching) —

    if (normMatch(text, `✍️ ${getMsg(lang, 'reply_freeform')}`)) {
      await setState(chatId, { step: 'awaiting_text', systemPrompt: base4D(lang), categoryId: 'freeform' }, env);
      await sendMessage(chatId, getMsg(lang, 'send_text_prompt', 'Free-Form'), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    if (normMatch(text, `🎯 ${getMsg(lang, 'reply_prompt_for')}`) ||
        normMatch(text, `💻 ${getMsg(lang, 'reply_code')}`) ||
        normMatch(text, `🎨 ${getMsg(lang, 'reply_image')}`) ||
        normMatch(text, `🎬 ${getMsg(lang, 'reply_video')}`)) {
      await setState(chatId, { step: null }, env);
      await sendMessage(chatId, getMsg(lang, 'choose_category'), {
        reply_markup: categoryChoiceKeyboard(lang)
      }, env);
      return;
    }

    if (normMatch(text, `🎯 ${getMsg(lang, 'reply_prompt_for')}`)) {
      await setState(chatId, { step: null }, env);
      await sendMessage(chatId, getMsg(lang, 'choose_category'), {
        reply_markup: categoryChoiceKeyboard(lang)
      }, env);
      return;
    }

    if (normMatch(text, `💬 ${getMsg(lang, 'reply_refine')}`)) {
      await sendMessage(chatId, getMsg(lang, 'followup_hint'), {
        reply_markup: followupKeyboard(lang)
      }, env);
      return;
    }

    if (normMatch(text, `✨ ${getMsg(lang, 'reply_new_prompt')}`)) {
      await setState(chatId, { step: null }, env);
      await sendMessage(chatId, getMsg(lang, 'start'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    // — state-based handlers —

    if (state?.step === 'awaiting_text' && state.systemPrompt) {
      await this.processPrompt(chatId, text, state.systemPrompt, state.categoryId, env, msgId);
      return;
    }

    if (state?.step === 'awaiting_followup' && state.systemPrompt) {
      await this.processFollowup(chatId, text, state.systemPrompt, state.originalText, env, msgId);
      return;
    }

    // — admin state handlers —

    if (state?.step === 'admin_add_title') {
      const tempId = `custom_${Date.now()}`;
      await setState(chatId, { step: 'admin_add_prompt', tempTitle: text, tempId }, env);
      await sendMessage(chatId, getMsg(lang, 'admin_add_prompt_text'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (state?.step === 'admin_add_prompt') {
      try {
        const promptData = { id: state.tempId, title: state.tempTitle, prompt: text };
        await env.LYRA_STATE.put(`bank_prompt:${state.tempId}`, JSON.stringify(promptData));
        await setState(chatId, { step: null, tempTitle: null, tempId: null }, env);
        await sendMessage(chatId, getMsg(lang, 'admin_prompt_added', state.tempTitle, state.tempId), {
          reply_markup: mainMenuKeyboard(lang)
        }, env);
      } catch {
        await sendMessage(chatId, getMsg(lang, 'error'), {}, env);
      }
      return;
    }

    if (state?.step === 'admin_broadcast_msg') {
      await setState(chatId, { step: null }, env);
      try {
        let count = 0;
        let cursor;
        do {
          const result = await env.LYRA_STATE.list({ prefix: 'lyra_user:', cursor });
          for (const key of result.keys) {
            const uid = parseInt(key.name.replace('lyra_user:', ''), 10);
            if (uid) {
              try { await sendMessage(uid, text, {}, env); count++; } catch {}
            }
          }
          cursor = result.cursor;
        } while (cursor);
        if (count === 0) {
          await sendMessage(chatId, getMsg(lang, 'admin_broadcast_empty'), {}, env);
        } else {
          await sendMessage(chatId, getMsg(lang, 'admin_broadcast_done', count), {
            reply_markup: mainMenuKeyboard(lang)
          }, env);
        }
      } catch {
        await sendMessage(chatId, getMsg(lang, 'error'), {}, env);
      }
      return;
    }

    // — freeform fallback —
    await this.processPrompt(chatId, text, base4D(lang), 'freeform', env, msgId);
  },

  async enterCategory(chatId, categoryId, lang, env) {
    const cat = CATEGORY_MAP[categoryId];
    if (!cat) return;
    // Bank category: show bank presets inline
    if (categoryId === 'bank') {
      await setState(chatId, { step: null }, env);
      const presets = await getBankPresets(env);
      await sendMessage(chatId, getMsg(lang, 'choose_preset'), {
        reply_markup: bankPresetsKeyboard(presets, lang)
      }, env);
      return;
    }
    await setState(chatId, { step: 'awaiting_text', systemPrompt: buildFullPrompt(cat.customSystemPrompt, lang), categoryId }, env);
    await sendMessage(chatId, getMsg(lang, 'send_text_prompt', cat.name_en), {
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
        case '/myid':
          await sendMessage(chatId, `🔑 Your Telegram ID: \`${chatId}\``, {
            reply_markup: mainMenuKeyboard(lang)
          }, env);
          break;
        case '/admin':
          if (!isAdmin(chatId, env)) {
            await sendMessage(chatId, getMsg(lang, 'admin_not_admin'), {
              reply_markup: mainMenuKeyboard(lang)
            }, env);
            return;
          }
          await sendMessage(chatId, getMsg(lang, 'admin_panel'), {
            reply_markup: adminPanelKeyboard(lang)
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
      await sendMessage(chatId, getMsg(lang, 'start'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_freeform') {
      await setState(chatId, { step: 'awaiting_text', systemPrompt: base4D(lang), categoryId: 'freeform' }, env);
      await sendMessage(chatId, getMsg(lang, 'send_text_prompt', 'Free-Form'), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_help') {
      await sendMessage(chatId, formatHelpMessage(getMsg(lang, 'help')), {
        reply_markup: backToMainKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_categories') {
      await setState(chatId, { step: null }, env);
      await sendMessage(chatId, getMsg(lang, 'choose_category'), {
        reply_markup: categoryChoiceKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'menu_language') {
      await sendMessage(chatId, getMsg(lang, 'language_prompt'), {
        reply_markup: languageKeyboard()
      }, env);
      return;
    }

    if (data.startsWith('menu_presets_')) {
      const cid = data.replace('menu_presets_', '');
      await setState(chatId, { step: null }, env);
      await sendMessage(chatId, getMsg(lang, 'choose_preset'), {
        reply_markup: presetsKeyboard(cid, lang)
      }, env);
      return;
    }

    if (data.startsWith('custom_')) {
      const cid = data.slice(7);
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      if (cid === 'bank') {
        const presets = await getBankPresets(env);
        await sendMessage(chatId, getMsg(lang, 'choose_preset'), {
          reply_markup: bankPresetsKeyboard(presets, lang)
        }, env);
        return;
      }
      if (!cat.customSystemPrompt) return;
      await setState(chatId, { step: 'awaiting_text', systemPrompt: buildFullPrompt(cat.customSystemPrompt, lang), categoryId: cid }, env);
      await sendMessage(chatId, getMsg(lang, 'send_text_prompt', cat.name_en), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    // — admin callbacks —

    if (data === 'admin_add_prompt') {
      if (!isAdmin(chatId, env)) {
        await sendMessage(chatId, getMsg(lang, 'admin_not_admin'), {}, env);
        return;
      }
      await setState(chatId, { step: 'admin_add_title' }, env);
      await sendMessage(chatId, getMsg(lang, 'admin_add_title'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (data === 'admin_broadcast') {
      if (!isAdmin(chatId, env)) {
        await sendMessage(chatId, getMsg(lang, 'admin_not_admin'), {}, env);
        return;
      }
      await setState(chatId, { step: 'admin_broadcast_msg' }, env);
      await sendMessage(chatId, getMsg(lang, 'admin_broadcast_msg'), {
        reply_markup: mainMenuKeyboard(lang)
      }, env);
      return;
    }

    if (data.startsWith('bank_page_')) {
      const page = parseInt(data.replace('bank_page_', ''), 10) || 0;
      const presets = await getBankPresets(env);
      await sendMessage(chatId, getMsg(lang, 'choose_preset'), {
        reply_markup: bankPresetsKeyboard(presets, lang, page)
      }, env);
      return;
    }

    if (data.startsWith('cat_')) {
      const cid = data.split('_')[1];
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      await setState(chatId, { step: null }, env);
      if (cid === 'bank') {
        const presets = await getBankPresets(env);
        await sendMessage(chatId, getMsg(lang, 'choose_preset'), {
          reply_markup: bankPresetsKeyboard(presets, lang)
        }, env);
      } else {
        await sendMessage(chatId, getMsg(lang, 'choose_preset'), {
          reply_markup: presetsKeyboard(cid, lang)
        }, env);
      }
      return;
    }

    if (data.startsWith('preset_')) {
      const parts = data.split('_');
      const cid = parts[1];
      const pid = parts.slice(2).join('_');
      const cat = CATEGORY_MAP[cid];
      if (!cat) return;
      let preset;
      if (cid === 'bank') {
        const all = await getBankPresets(env);
        preset = all.find(p => p.id === pid);
      } else {
        preset = cat.presets.find(p => p.id === pid);
      }
      if (!preset) return;

      // Bank: show ready prompt directly (bypass AI)
      if (cid === 'bank') {
        const promptText = preset.prompt || preset.systemPrompt;
        if (!promptText) return;
        const segs = [];
        segs.push(B(`${preset.title}\n`));
        segs.push(P('\n'));
        segs.push(buildPreBlock(promptText));
        segs.push(P('\n'));
        segs.push(I(getMsg(lang, 'bank_prompt_ready')));
        await sendMessage(chatId, buildMessage(segs), {
          reply_markup: {
            inline_keyboard: [
              [{ text: `🏠 ${getMsg(lang, 'main_menu')}`, callback_data: 'menu_main', style: 'danger' }],
              [{ text: `🏦 ${getMsg(lang, 'reply_bank')}`, callback_data: 'cat_bank', style: 'success' }]
            ]
          }
        }, env);
        return;
      }

      await setState(chatId, {
        step: 'awaiting_text', systemPrompt: buildFullPrompt(preset.systemPrompt, lang), categoryId: cid
      }, env);
      await sendMessage(chatId, getMsg(lang, 'preset_prompt', preset.title), {
        reply_markup: replyKeyboard(lang)
      }, env);
      return;
    }

    if (data.startsWith('lang_')) {
      const nl = data.replace('lang_', '');
      await setState(chatId, { lang: nl }, env);
      await sendMessage(chatId, getMsg(nl, 'language_changed'), {
        reply_markup: replyKeyboard(nl)
      }, env);
      await sendMessage(chatId, getMsg(nl, 'start'), {
        reply_markup: mainMenuKeyboard(nl)
      }, env);
      return;
    }
  },

  async processPrompt(chatId, text, systemPrompt, categoryId, env, replyToMsgId) {
    const lang = await getUserLang(chatId, env);
    let statusId;

    try {
      const statusTexts = [
        '⏳ 1/3 Processing your request.',
        '⏳ 1/3 Processing your request..',
        '⏳ 1/3 Processing your request...',
        '⏳ 2/3 Optimizing via AI.',
        '⏳ 2/3 Optimizing via AI..',
        '⏳ 2/3 Optimizing via AI...',
        '⏳ 3/3 Formatting result.',
        '⏳ 3/3 Formatting result..',
        '⏳ 3/3 Formatting result...'
      ];

      const status = await sendMessage(chatId, statusTexts[0], {}, env);
      statusId = status.result?.message_id;

      for (let i = 1; i <= 2; i++) {
        await sleep(250);
        await updateStatus(chatId, statusId, statusTexts[i], env);
      }

      const ai = await withTyping(chatId, env, () => enhanceWithAI(text, systemPrompt, env));

      for (let i = 3; i <= 5; i++) {
        await sleep(250);
        await updateStatus(chatId, statusId, statusTexts[i], env);
      }

      const { prompt, followup } = parseAI(ai);

      for (let i = 6; i <= 8; i++) {
        await sleep(200);
        await updateStatus(chatId, statusId, statusTexts[i], env);
      }

      await deleteMessage(chatId, statusId, env);

      const content = formatResultMessage(text, prompt, followup, lang);

      await sendMessage(chatId, content, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🏠 ${getMsg(lang, 'main_menu')}`, callback_data: 'menu_main', style: 'danger' }]
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
      const statusTexts = [
        '⏳ 1/3 Processing your request.',
        '⏳ 1/3 Processing your request..',
        '⏳ 1/3 Processing your request...',
        '⏳ 2/3 Optimizing via AI.',
        '⏳ 2/3 Optimizing via AI..',
        '⏳ 2/3 Optimizing via AI...',
        '⏳ 3/3 Formatting result.',
        '⏳ 3/3 Formatting result..',
        '⏳ 3/3 Formatting result...'
      ];

      const status = await sendMessage(chatId, statusTexts[0], {}, env);
      statusId = status.result?.message_id;

      for (let i = 1; i <= 2; i++) {
        await sleep(250);
        await updateStatus(chatId, statusId, statusTexts[i], env);
      }

      const refined = originalText + '\n\nAdditional context: ' + text;
      const noFollowup = systemPrompt + '\n\nIMPORTANT: Do NOT generate follow-up questions. Output ONLY the optimized prompt.';

      for (let i = 3; i <= 5; i++) {
        await sleep(250);
        await updateStatus(chatId, statusId, statusTexts[i], env);
      }

      const ai = await withTyping(chatId, env, () => enhanceWithAI(refined, noFollowup, env));
      const clean = ai.replace(/<\/?PROMPT>/g, '').replace(/<\/?FOLLOWUP>[\s\S]*?<\/FOLLOWUP>/g, '').trim();
      const combined = originalText + '\n' + text;

      for (let i = 6; i <= 8; i++) {
        await sleep(200);
        await updateStatus(chatId, statusId, statusTexts[i], env);
      }

      await deleteMessage(chatId, statusId, env);

      const content = formatResultMessage(combined, clean, null, lang);

      await sendMessage(chatId, content, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🏠 ${getMsg(lang, 'main_menu')}`, callback_data: 'menu_main', style: 'danger' }]
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
