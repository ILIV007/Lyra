import { CATEGORIES } from './templates.js';
import { getMsg } from './messages.js';

export function mainMenuKeyboard(lang) {
  const cats = CATEGORIES.map(cat => [
    { text: `${cat.emoji} ${cat.name_en}`, callback_data: `cat_${cat.id}` }
  ]);
  return {
    inline_keyboard: [
      [{ text: `⚡ ${getMsg(lang, 'reply_freeform')}`, callback_data: 'menu_freeform' }],
      ...cats,
      [
        { text: `❓ ${getMsg(lang, 'reply_help')}`, callback_data: 'menu_help' },
        { text: `🌐 ${getMsg(lang, 'reply_language')}`, callback_data: 'menu_language' }
      ]
    ]
  };
}

export function categoriesKeyboard(lang) {
  const cats = CATEGORIES.map(cat => [
    { text: `${cat.emoji} ${cat.name_en}`, callback_data: `cat_${cat.id}` }
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
    { text: `✨ ${lang === 'fa' ? 'ساخت اختصاصی' : lang === 'ru' ? 'Свой промпт' : 'Custom'}`, callback_data: `custom_${categoryId}` }
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

export function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇮🇷 فارسی', callback_data: 'lang_fa' },
        { text: '🇬🇧 English', callback_data: 'lang_en' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' }
      ],
      [
        { text: `🔙 ${getMsg('en', 'back')}`, callback_data: 'menu_main' }
      ]
    ]
  };
}

export function replyKeyboard(lang) {
  return {
    keyboard: [
      [
        { text: `✍️ ${getMsg(lang, 'reply_freeform')}`, color: 'primary' },
        { text: `💻 ${getMsg(lang, 'reply_code')}` }
      ],
      [
        { text: `🎨 ${getMsg(lang, 'reply_image')}` },
        { text: `🎬 ${getMsg(lang, 'reply_video')}` }
      ]
    ],
    resize_keyboard: true,
    persistent: true,
    input_field_placeholder: lang === 'fa' ? 'متن خود را وارد کنید...' : lang === 'ru' ? 'Введите текст...' : 'Type your text here...'
  };
}

export function followupKeyboard(lang) {
  return {
    keyboard: [
      [
        { text: `💬 ${getMsg(lang, 'reply_refine')}`, color: 'primary' },
        { text: `✨ ${getMsg(lang, 'reply_new_prompt')}`, color: 'primary' }
      ],
      [
        { text: `✍️ ${getMsg(lang, 'reply_freeform')}` },
        { text: `💻 ${getMsg(lang, 'reply_code')}` }
      ]
    ],
    resize_keyboard: true,
    persistent: true
  };
}
