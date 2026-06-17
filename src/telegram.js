const BASE = (token) => `https://api.telegram.org/bot${token}`;

export async function sendMessage(chatId, text, options = {}, env) {
  const res = await fetch(`${BASE(env.TELEGRAM_TOKEN)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options
    })
  });
  return res.json();
}

export async function editMessageText(chatId, messageId, text, options = {}, env) {
  const res = await fetch(`${BASE(env.TELEGRAM_TOKEN)}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options
    })
  });
  return res.json();
}

export async function answerCallbackQuery(callbackQueryId, text = null, options = {}, env) {
  const res = await fetch(`${BASE(env.TELEGRAM_TOKEN)}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      ...options
    })
  });
  return res.json();
}

export async function sendMessageDraft(chatId, text, options = {}, env) {
  const res = await fetch(`${BASE(env.TELEGRAM_TOKEN)}/sendMessageDraft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options
    })
  });
  return res.json();
}

export async function sendChatAction(chatId, action, env) {
  await fetch(`${BASE(env.TELEGRAM_TOKEN)}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action })
  }).catch(() => {});
}

export async function deleteMessage(chatId, messageId, env) {
  const res = await fetch(`${BASE(env.TELEGRAM_TOKEN)}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId
    })
  });
  return res.json();
}