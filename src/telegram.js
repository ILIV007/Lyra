const BASE = (token) => `https://api.telegram.org/bot${token}`;

async function apiCall(method, body, env) {
  const res = await fetch(`${BASE(env.TELEGRAM_TOKEN)}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || `${method} failed`);
  return data;
}

export async function sendMessage(chatId, text, options, env) {
  return apiCall('sendMessage', {
    chat_id: chatId, text, parse_mode: 'Markdown',
    disable_web_page_preview: true, ...options
  }, env);
}

export async function editMessageText(chatId, messageId, text, options, env) {
  return apiCall('editMessageText', {
    chat_id: chatId, message_id: messageId, text,
    parse_mode: 'Markdown', disable_web_page_preview: true, ...options
  }, env);
}

export async function answerCallbackQuery(callbackQueryId, text, options, env) {
  return apiCall('answerCallbackQuery', {
    callback_query_id: callbackQueryId, ...(text ? { text } : {}), ...options
  }, env);
}

export async function deleteMessage(chatId, messageId, env) {
  if (!messageId) return;
  try {
    await apiCall('deleteMessage', { chat_id: chatId, message_id: messageId }, env);
  } catch {}
}

export async function sendChatAction(chatId, action, env) {
  try {
    await apiCall('sendChatAction', { chat_id: chatId, action }, env);
  } catch {}
}
