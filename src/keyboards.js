import { CATEGORIES } from './templates.js';
import { getMsg } from './messages.js';

export function mainMenuKeyboard(lang) {
  const cats = CATEGORIES.map(cat => [
    { text: `${cat.emoji} ${getMsg(lang, 'category_display', cat.id) || cat.name_en}`, callback_data: `cat_${cat.id}` }
  ]);
  return {
    inline_keyboard: [
      ...cats,
      [
        { text: '❓ Help', callback_data: 'menu_help' },
        { text: '🌐 Language', callback_data: 'menu_language' }
      ]
    ]
  };
}

export function categoriesKeyboard(lang) {
  const cats = CATEGORIES.map(cat => [
    { text: `${cat.emoji} ${getMsg(lang, 'category_display', cat.id) || cat.name_en}`, callback_data: `cat_${cat.id}` }
  ]);
  cats.push([
    { text: getMsg(lang, 'back'), callback_data: 'menu_main' }
  ]);
  return { inline_keyboard: cats };
}

export function presetsKeyboard(categoryId, lang) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return categoriesKeyboard(lang);

  const rows = cat.presets.map(p => [
    { text: p.title, callback_data: `preset_${categoryId}_${p.id}` }
  ]);

  rows.push([
    { text: `✨ ${lang === 'fa' ? 'ساخت اختصاصی' : lang === 'ru' ? 'Свой промпт' : 'Custom Prompt'}`, callback_data: `cat_${categoryId}_custom` }
  ]);
  rows.push([
    { text: getMsg(lang, 'back'), callback_data: 'menu_main' }
  ]);

  return { inline_keyboard: rows };
}

export function backToPresetsKeyboard(categoryId, lang) {
  return {
    inline_keyboard: [
      [{ text: getMsg(lang, 'back'), callback_data: `menu_presets_${categoryId}` }]
    ]
  };
}

export function backToMainKeyboard(lang) {
  return {
    inline_keyboard: [
      [{ text: getMsg(lang, 'back'), callback_data: 'menu_main' }]
    ]
  };
}

export function resultKeyboard(promptText, lang) {
  const maxCopyLen = 256;
  const copyText = promptText.length > maxCopyLen ? promptText.slice(0, maxCopyLen) : promptText;
  return {
    inline_keyboard: [
      [
        { text: `📋 ${getMsg(lang, 'copy_btn')}`, copy_text: { text: copyText } }
      ],
      [
        { text: `✨ ${getMsg(lang, 'new_prompt')}`, callback_data: 'menu_main' }
      ]
    ]
  };
}

export function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇮🇷 فارسی', callback_data: 'lang_fa' },
        { text: '🇬🇧 English', callback_data: 'lang_en' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' }
      ],
      [
        { text: '🔙 Back', callback_data: 'menu_main' }
      ]
    ]
  };
}

export function replyKeyboard(lang) {
  return {
    keyboard: [
      [
        { text: `✨ ${getMsg(lang, 'reply_freeform')}` },
        { text: `💻 ${getMsg(lang, 'reply_code')}` }
      ],
      [
        { text: `🖼️ ${getMsg(lang, 'reply_image')}` },
        { text: `🎬 ${getMsg(lang, 'reply_video')}` }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}