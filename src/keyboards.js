import { CATEGORIES } from './templates.js';
import { getMsg } from './messages.js';

export function mainMenuKeyboard(lang) {
  return {
    inline_keyboard: [
      [{ text: `⚡ ${getMsg(lang, 'reply_freeform')}`, callback_data: 'menu_freeform' }],
      [{ text: `📂 ${getMsg(lang, 'reply_categories')}`, callback_data: 'menu_categories', style: 'primary' }],
      [{ text: `🏦 ${getMsg(lang, 'reply_bank')}`, callback_data: 'cat_bank', style: 'success' }],
      [
        { text: `❓ ${getMsg(lang, 'reply_help')}`, callback_data: 'menu_help' },
        { text: `🌐 ${getMsg(lang, 'reply_language')}`, callback_data: 'menu_language' }
      ]
    ]
  };
}

export function categoryChoiceKeyboard(lang) {
  const cats = CATEGORIES.filter(c => c.id !== 'bank').map(cat => [
    { text: `${cat.emoji} ${cat.name_en}`, callback_data: `cat_${cat.id}`, style: 'primary' }
  ]);
  cats.push([
    { text: `🏦 ${getMsg(lang, 'reply_bank')}`, callback_data: 'cat_bank', style: 'success' }
  ]);
  cats.push([
    { text: getMsg(lang, 'back'), callback_data: 'menu_main' }
  ]);
  return { inline_keyboard: cats };
}

export function bankPresetsKeyboard(lang) {
  const cat = CATEGORIES.find(c => c.id === 'bank');
  if (!cat) return mainMenuKeyboard(lang);
  const rows = cat.presets.map(p => [
    { text: p.title, callback_data: `preset_bank_${p.id}`, style: 'success' }
  ]);
  rows.push([
    { text: getMsg(lang, 'back'), callback_data: 'menu_main' }
  ]);
  return { inline_keyboard: rows };
}

export function presetsKeyboard(categoryId, lang) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return categoryChoiceKeyboard(lang);

  if (categoryId === 'bank') return bankPresetsKeyboard(lang);

  const rows = cat.presets.map(p => [
    { text: p.title, callback_data: `preset_${categoryId}_${p.id}`, style: 'primary' }
  ]);

  rows.push([
    { text: `✨ ${lang === 'fa' ? 'ساخت اختصاصی' : lang === 'ru' ? 'Свой промпт' : 'Custom'}`, callback_data: `custom_${categoryId}`, style: 'primary' }
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
        { text: `✍️ ${getMsg(lang, 'reply_freeform')}`, color: 'primary', style: 'primary' }
      ],
      [
        { text: `🎯 ${getMsg(lang, 'reply_prompt_for')}` }
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
        { text: `💬 ${getMsg(lang, 'reply_refine')}`, color: 'primary', style: 'primary' },
        { text: `✨ ${getMsg(lang, 'reply_new_prompt')}`, color: 'primary', style: 'primary' }
      ],
      [
        { text: `✍️ ${getMsg(lang, 'reply_freeform')}` },
        { text: `🎯 ${getMsg(lang, 'reply_prompt_for')}` }
      ]
    ],
    resize_keyboard: true,
    persistent: true
  };
}
