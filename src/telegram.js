const BASE = (token) => `https://api.telegram.org/bot${token}`;

function assertToken(env) {
  if (!env.TELEGRAM_TOKEN && !env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_TOKEN not set in environment');
  }
}

async function apiCall(method, body, env) {
  assertToken(env);
  const token = env.TELEGRAM_TOKEN || env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`${BASE(token)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || 'unknown error'} (code: ${data.error_code || 'unknown'})`);
  return data;
}

function E(type, offset, length, extra) {
  const e = { type, offset, length };
  if (extra) Object.assign(e, extra);
  return e;
}

function buildMessage(segments) {
  let text = '';
  const entities = [];
  for (const seg of segments) {
    const off = text.length;
    text += seg.t;
    if (seg.e) {
      if (Array.isArray(seg.e)) {
        for (const ent of seg.e) {
          entities.push({ ...ent, offset: off + ent.offset });
        }
      } else {
        entities.push({ ...seg.e, offset: off });
      }
    }
  }
  return { text, entities };
}

function B(t) { return { t, e: E('bold', 0, t.length) }; }
function I(t) { return { t, e: E('italic', 0, t.length) }; }
function S(t) { return { t, e: E('strikethrough', 0, t.length) }; }
function U(t) { return { t, e: E('underline', 0, t.length) }; }
function C(t) { return { t, e: E('code', 0, t.length) }; }
function PRE(t, lang) { return { t, e: E('pre', 0, t.length, lang ? { language: lang } : undefined) }; }
function BQ(t) { return { t, e: E('expandable_blockquote', 0, t.length) }; }
function P(t) { return { t }; }

function buildPreBlock(text, lang) {
  const t = '\n' + text + '\n';
  const e = E('pre', 0, t.length, lang ? { language: lang } : undefined);
  return { t, e };
}

function buildBlockQuote(text) {
  const t = '\n' + text;
  const e = E('expandable_blockquote', 0, t.length);
  return { t, e };
}

async function sendMessage(chatId, content, options, env) {
  const body = { chat_id: chatId, disable_web_page_preview: true, ...options };
  if (typeof content === 'string') {
    body.text = content;
  } else {
    body.text = content.text;
    body.entities = content.entities;
  }
  return apiCall('sendMessage', body, env);
}

async function editMessageText(chatId, messageId, content, options, env) {
  const body = { chat_id: chatId, message_id: messageId, disable_web_page_preview: true, ...options };
  if (typeof content === 'string') {
    body.text = content;
  } else {
    body.text = content.text;
    body.entities = content.entities;
  }
  return apiCall('editMessageText', body, env);
}

async function answerCallbackQuery(callbackQueryId, text, options, env) {
  return apiCall('answerCallbackQuery', {
    callback_query_id: callbackQueryId, ...(text ? { text } : {}), ...options
  }, env);
}

async function deleteMessage(chatId, messageId, env) {
  if (!messageId) return;
  try {
    await apiCall('deleteMessage', { chat_id: chatId, message_id: messageId }, env);
  } catch {}
}

async function sendChatAction(chatId, action, env) {
  try {
    await apiCall('sendChatAction', { chat_id: chatId, action }, env);
  } catch {}
}

export {
  buildMessage, E,
  B, I, S, U, C, PRE, BQ, P, buildPreBlock, buildBlockQuote,
  sendMessage, editMessageText, answerCallbackQuery,
  deleteMessage, sendChatAction
};
