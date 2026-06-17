import { CATEGORIES, getPresetTitle } from './templates.js';
import { getMsg } from './messages.js';

const LANG_LABELS = {
  fa: { main: '📝 تبدیل متن به پرامپت', help: '❓ راهنما', lang: '🌐 زبان' },
  en: { main: '📝 Text to Prompt', help: '❓ Help', lang: '🌐 Language' },
  ru: { main: '📝 Текст в промпт', help: '❓ Помощь', lang: '🌐 Язык' }
};

export function mainMenuKeyboard(lang) {
  const labels = LANG_LABELS[lang] || LANG_LABELS.en;
  return {
    inline_keyboard: [
      [
        { text: labels.main, callback_data: 'menu_categories' }
      ],
      [
        { text: labels.help, callback_data: 'menu_help' },
        { text: labels.lang, callback_data: 'menu_language' }
      ]
    ]
  };
}

export function categoriesKeyboard(lang) {
  const rows = CATEGORIES.map(cat => [
    { text: `${cat.emoji} ${cat.name_en}`, callback_data: `cat_${cat.id}` }
  ]);
  rows.push([
    { text: getMsg(lang, 'back'), callback_data: 'menu_main' }
  ]);
  return { inline_keyboard: rows };
}

export function presetsKeyboard(categoryId, lang) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return categoriesKeyboard(lang);

  const rows = cat.presets.map(p => [
    { text: p.title, callback_data: `preset_${categoryId}_${p.id}` }
  ]);

  rows.push([
    { text: '✨ ' + (lang === 'fa' ? 'ساخت پرامپت اختصاصی' : lang === 'ru' ? 'Свой промпт' : 'Build Your Prompt'), callback_data: `cat_${categoryId}_custom` }
  ]);
  rows.push([
    { text: getMsg(lang, 'back'), callback_data: 'menu_categories' }
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

export function resultKeyboard(categoryId, lang) {
  return {
    inline_keyboard: [
      [
        { text: getMsg(lang, 'copy_btn'), callback_data: 'copy' }
      ],
      [
        { text: getMsg(lang, 'new_prompt'), callback_data: `menu_presets_${categoryId}` },
        { text: getMsg(lang, 'main_menu'), callback_data: 'menu_main' }
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