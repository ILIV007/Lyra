export const MESSAGES = {
  en: {
    start: `🚀 Lyra — AI Prompt Optimizer

I transform your rough ideas into precision-crafted prompts.

Just send any text, or pick a mode below ✨`,

    start_with_name: (name) => `🚀 Hey ${name}! Welcome to Lyra — AI Prompt Optimizer 🎯

I transform your rough ideas into precision-crafted prompts.

Just send any text, or pick a mode below ✨`,

    choose_category: '🎯 Pick a category:',

    send_text_prompt: (category) => `📌 Category: ${category}

Send me your idea — I'll craft a perfect prompt for it.
Examples:
• A Python function to sort arrays
• A cinematic sci-fi cityscape
• A 30s product launch video`,

    processing: '⚙️ Crafting your prompt...',

    followup_hint: '💬 Want to refine further? Just send more details.',

    no_category: '⚠️ Please pick a category from the menu first.',

    error: '⚠️ Something went wrong. Try /start',

    api_error: '🌐 AI server hiccup. Try again in a moment.',

    help: `🚀 Lyra — Prompt Optimizer Guide

Just send any text → I optimize it into a pro-grade prompt.

💻 Code — Generate, review, debug
🖼️ Image — Generate, edit, style transfer
🎬 Video — Scripts, generate, post-prod

Commands:
/start — Restart
/help — This guide
/language — Change language`,

    language_changed: '✅ Language changed!',
    language_prompt: '🌐 Select your language:',

    choose_preset: '📋 Pick a preset:',

    preset_prompt: (title) => `✨ ${title} selected!

Send me your text and I'll optimize it into a professional prompt.`,

    back: '◀️ Back',
    cancel: '✖️ Cancel',
    main_menu: '🏠 Main Menu',
    new_prompt: '✨ New Prompt',
    generating: '⚙️ Crafting your prompt...',
    answer_followup: '💡 Send more details to refine',

    result_label_input: '📥 Your Input',
    result_label_prompt: '📤 Optimized Prompt',
    result_label_followup: '💡 Refine it',
    result_footer: '✦ Lyra — Precision AI Prompts ✦',

    reply_freeform: 'Quick Prompt',
    reply_code: 'Code',
    reply_image: 'Image',
    reply_video: 'Video',
    reply_help: 'Guide',
    reply_language: 'Language',
    reply_new_prompt: 'New Prompt',
    reply_refine: 'Refine',
    reply_prompt_for: 'Prompt For...',
    reply_bank: 'Prompt Bank'
  },

  fa: {
    start: `🚀 لیرا — بهینه‌ساز پرامپت هوشمند 🎯

ایده‌های ساده‌ات رو به پرامپت‌های حرفه‌ای تبدیل می‌کنم.

فقط متن رو بفرست، یا از منو یکی رو انتخاب کن ✨`,

    start_with_name: (name) => `🚀 ${name} جان! به لیرا خوش اومدی 🎯

ایده‌های ساده‌ات رو به پرامپت‌های حرفه‌ای تبدیل می‌کنم.

فقط متن رو بفرست، یا از منو یکی رو انتخاب کن ✨`,

    choose_category: '🎯 یه دسته‌بندی انتخاب کن:',

    send_text_prompt: (category) => `📌 دسته: ${category}

ایده یا متن مورد نظرت رو بفرست تا برات پرامپت عالی بسازم.`,

    processing: '⚙️ در حال ساخت پرامپت...',

    followup_hint: '💬 می‌خوای بهترش کنی؟ جزئیات بیشتری بفرست.',

    no_category: '⚠️ لطفاً اول از منو یه دسته‌بندی انتخاب کن.',

    error: '⚠️ خطایی رخ داد. /start رو بزن',

    api_error: '🌐 خطا در ارتباط با سرور. بعداً امتحان کن.',

    help: `🚀 لیرا — راهنما

هر متنی بفرست → برات پرامپت حرفه‌ای می‌سازم.

💻 کد — تولید، بررسی، دیباگ
🖼️ عکس — تولید، ویرایش، انتقال سبک
🎬 ویدیو — اسکریپت، تولید، پست‌پروداکشن

دستورات:
/start — شروع مجدد
/help — راهنما
/language — تغییر زبان`,

    language_changed: '✅ زبان تغییر کرد!',
    language_prompt: '🌐 زبان مورد نظرت رو انتخاب کن:',

    choose_preset: '📋 یه پرامپت آماده انتخاب کن:',

    preset_prompt: (title) => `✨ ${title} انتخاب شد!

متن مورد نظرت رو بفرست تا برات پرامپت حرفه‌ای بسازم.`,

    back: '◀️ برگشت',
    cancel: '✖️ لغو',
    main_menu: '🏠 منوی اصلی',
    new_prompt: '✨ پرامپت جدید',
    generating: '⚙️ در حال ساخت پرامپت...',
    answer_followup: '💡 جزئیات بیشتر بفرست تا بهترش کنم',

    result_label_input: '📥 متن شما',
    result_label_prompt: '📤 پرامپت بهینه',
    result_label_followup: '💡 برای بهتر شدن',
    result_footer: '✦ لیرا — پرامپت با دقت ✦',

    reply_freeform: 'متن آزاد',
    reply_code: 'کد',
    reply_image: 'عکس',
    reply_video: 'ویدیو',
    reply_help: 'راهنما',
    reply_language: 'زبان',
    reply_new_prompt: 'پرامپت جدید',
    reply_refine: 'بهبود',
    reply_prompt_for: 'ساخت پرامپت...',
    reply_bank: 'بانک پرامپت'
  },

  ru: {
    start: `🚀 Lyra — Оптимизатор промптов 🎯

Превращаю ваши простые идеи в профессиональные промпты.

Просто отправьте текст или выберите режим ниже ✨`,

    start_with_name: (name) => `🚀 Привет, ${name}! Lyra — Оптимизатор промптов 🎯

Превращаю ваши простые идеи в профессиональные промпты.

Просто отправьте текст или выберите режим ниже ✨`,

    choose_category: '🎯 Выберите категорию:',

    send_text_prompt: (category) => `📌 Категория: ${category}

Отправьте вашу идею — я создам идеальный промпт.`,

    processing: '⚙️ Создаю промпт...',

    followup_hint: '💬 Хотите улучшить? Отправьте ещё детали.',

    no_category: '⚠️ Сначала выберите категорию из меню.',

    error: '⚠️ Ошибка. Попробуйте /start',

    api_error: '🌐 Ошибка сервера ИИ. Попробуйте позже.',

    help: `🚀 Lyra — Руководство

Отправьте любой текст → я оптимизирую его в промпт.

💻 Код — Генерация, ревью, отладка
🖼️ Изображения — Генерация, редактирование, стиль
🎬 Видео — Сценарии, генерация, пост-продакшн

Команды:
/start — Начать
/help — Помощь
/language — Язык`,

    language_changed: '✅ Язык изменён!',
    language_prompt: '🌐 Выберите язык:',

    choose_preset: '📋 Выберите готовый промпт:',

    preset_prompt: (title) => `✨ ${title} выбран!

Отправьте ваш текст, и я создам профессиональный промпт.`,

    back: '◀️ Назад',
    cancel: '✖️ Отмена',
    main_menu: '🏠 Главное меню',
    new_prompt: '✨ Новый промпт',
    generating: '⚙️ Создаю промпт...',
    answer_followup: '💡 Отправьте детали для уточнения',

    result_label_input: '📥 Ваш текст',
    result_label_prompt: '📤 Оптимизированный промпт',
    result_label_followup: '💡 Уточнения',
    result_footer: '✦ Lyra — Точные промпты ✦',

    reply_freeform: 'Быстрый промпт',
    reply_code: 'Код',
    reply_image: 'Изображение',
    reply_video: 'Видео',
    reply_help: 'Помощь',
    reply_language: 'Язык',
    reply_new_prompt: 'Новый промпт',
    reply_refine: 'Уточнить',
    reply_prompt_for: 'Создать промпт...',
    reply_bank: 'Банк промптов'
  }
};

export function getMsg(lang, key, ...args) {
  const fallbacks = ['en', 'ru'];
  let msg = MESSAGES[lang]?.[key];
  if (msg) return typeof msg === 'function' ? msg(...args) : msg;
  for (const fb of fallbacks) {
    msg = MESSAGES[fb]?.[key];
    if (msg) return typeof msg === 'function' ? msg(...args) : msg;
  }
  return key;
}
