export const MESSAGES = {
  en: {
    start: `Hello! I'm Lyra — Prompt Optimizer.

I transform your simple text into professional, optimized prompts.

Just send me any text and I'll create a complete prompt for you!`,

    start_with_name: (name) => `Hello ${name}! I'm Lyra — Prompt Optimizer.

I transform your simple text into professional, optimized prompts.

Just send me any text and I'll create a complete prompt for you!`,

    choose_category: 'Select a prompt category:',

    send_text_prompt: (category) => `Category: ${category}

Send me your idea or text and I'll create a complete, optimized prompt.
Examples:
• A Python function to sort arrays
• Image of a cat in space, cyberpunk style
• Video introducing Apple's new product`,

    processing: 'Generating your prompt...',

    followup_hint: 'Want to refine this prompt? Just send more details or click below.',

    no_category: 'Please select a category from the menu first.',

    error: 'An error occurred. Please try again.',

    api_error: 'AI server error. Please try later.',

    help: `Lyra — Prompt Optimizer Guide

1. Send any text and I'll optimize it
2. Or select a category for specialized prompts
3. Follow-up questions refine your prompt further

Categories:
• Code — Programming, debugging, review
• Image — Generation, editing, style transfer
• Video — Scripts, generation, post-production

Commands:
/start — Restart
/help — Guide
/language — Change language`,

    language_changed: 'Language changed.',
    language_prompt: 'Select your language:',

    choose_preset: 'Select a preset:',
    custom_prompt_title: 'Build Your Prompt',
    preset_prompt: (title) => `${title} — ready.

Send me your text and I'll optimize it into a professional prompt.`,

    back: 'Back',
    cancel: 'Cancel',
    main_menu: 'Main Menu',
    new_prompt: 'New Prompt',
    copy: 'Copied!',
    copy_btn: 'Copy',
    generating: 'Generating...',
    answer_followup: 'Send your answer to refine the prompt.',

    result_label_input: 'Your Input:',
    result_label_prompt: 'Optimized Prompt:',
    result_label_followup: 'Questions to refine:',
    result_footer: '@Lyra_IVbot',

    category_display: {
      code: 'Code',
      image: 'Image',
      video: 'Video'
    },

    reply_freeform: 'Send any text',
    reply_code: 'Code',
    reply_image: 'Image',
    reply_video: 'Video',
    reply_history: 'History',
    reply_settings: 'Settings'
  },

  fa: {
    start: `سلام! من لیرا هستم — بهینه‌ساز پرامپت.

متن ساده‌ات رو به پرامپت حرفه‌ای و بهینه تبدیل می‌کنم.

هر متنی برام بفرست تا برات پرامپت کامل بسازم!`,

    start_with_name: (name) => `سلام ${name} جان! من لیرا هستم — بهینه‌ساز پرامپت.

متن ساده‌ات رو به پرامپت حرفه‌ای و بهینه تبدیل می‌کنم.

هر متنی برام بفرست تا برات پرامپت کامل بسازم!`,

    choose_category: 'دسته‌بندی پرامپت رو انتخاب کن:',

    send_text_prompt: (category) => `دسته: ${category}

متن یا ایده‌ات رو بفرست تا برات پرامپت کامل و بهینه بسازم.`,

    processing: 'در حال تولید پرامپت...',

    followup_hint: 'میخوای پرامپت رو بهتر کنی؟ جزئیات بیشتری بفرست یا دکمه زیر رو بزن.',

    no_category: 'لطفاً اول از منوی اصلی یک دسته‌بندی انتخاب کن.',

    error: 'خطایی رخ داد. لطفاً دوباره تلاش کن.',

    api_error: 'خطا در ارتباط با سرور هوش مصنوعی. بعداً تلاش کن.',

    help: `لیرا — راهنمای بهینه‌ساز پرامپت

۱. هر متنی بفرست تا بهینه‌اش کنم
۲. یا یک دسته‌بندی برای پرامپت تخصصی انتخاب کن
۳. سوالات تکمیلی برای بهتر شدن پرامپت

دسته‌ها:
• کد — برنامه‌نویسی، دیباگ، بررسی
• عکس — تولید، ویرایش، انتقال سبک
• ویدیو — اسکریپت، تولید، پست‌پروداکشن

دستورات:
/start — شروع مجدد
/help — راهنما
/language — تغییر زبان`,

    language_changed: 'زبان تغییر کرد.',
    language_prompt: 'زبان مورد نظرت رو انتخاب کن:',

    choose_preset: 'یک پرامپت آماده انتخاب کن:',
    custom_prompt_title: 'ساخت پرامپت اختصاصی',
    preset_prompt: (title) => `${title} — آماده.

متن مورد نظرت رو بفرست تا برات پرامپت حرفه‌ای بسازم.`,

    back: 'بازگشت',
    cancel: 'لغو',
    main_menu: 'منوی اصلی',
    new_prompt: 'پرامپت جدید',
    copy: 'کپی شد!',
    copy_btn: 'کپی',
    generating: 'در حال تولید...',
    answer_followup: 'پاسخت رو بفرست تا پرامپت کامل‌تر بشه.',

    result_label_input: 'متن شما:',
    result_label_prompt: 'پرامپت بهینه‌شده:',
    result_label_followup: 'سوالات برای بهتر شدن:',
    result_footer: '@Lyra_IVbot',

    category_display: {
      code: 'کد',
      image: 'عکس',
      video: 'ویدیو'
    },

    reply_freeform: 'ارسال متن',
    reply_code: 'کد',
    reply_image: 'عکس',
    reply_video: 'ویدیو',
    reply_history: 'تاریخچه',
    reply_settings: 'تنظیمات'
  },

  ru: {
    start: `Привет! Я Lyra — Оптимизатор промптов.

Превращаю ваш простой текст в профессиональные оптимизированные промпты.

Отправьте любой текст, и я создам готовый промпт!`,

    start_with_name: (name) => `Привет, ${name}! Я Lyra — Оптимизатор промптов.

Превращаю ваш простой текст в профессиональные оптимизированные промпты.

Отправьте любой текст, и я создам готовый промпт!`,

    choose_category: 'Выберите категорию промпта:',

    send_text_prompt: (category) => `Категория: ${category}

Отправьте вашу идею или текст, и я создам оптимизированный промпт.`,

    processing: 'Генерирую промпт...',

    followup_hint: 'Хотите уточнить промпт? Отправьте ещё информацию или нажмите ниже.',

    no_category: 'Сначала выберите категорию из главного меню.',

    error: 'Произошла ошибка. Пожалуйста, попробуйте снова.',

    api_error: 'Ошибка сервера ИИ. Попробуйте позже.',

    help: `Lyra — Руководство по оптимизатору промптов

1. Отправьте любой текст — я его оптимизирую
2. Или выберите категорию для специализированных промптов
3. Уточняющие вопросы помогут сделать промпт лучше

Категории:
• Code — Программирование, отладка, ревью
• Image — Генерация, редактирование, стилизация
• Video — Скрипты, генерация, пост-продакшн

Команды:
/start — Начать заново
/help — Помощь
/language — Сменить язык`,

    language_changed: 'Язык изменён.',
    language_prompt: 'Выберите язык:',

    choose_preset: 'Выберите готовый промпт:',
    custom_prompt_title: 'Свой промпт',
    preset_prompt: (title) => `${title} — готово.

Отправьте ваш текст, и я создам профессиональный промпт.`,

    back: 'Назад',
    cancel: 'Отмена',
    main_menu: 'Главное меню',
    new_prompt: 'Новый промпт',
    copy: 'Скопировано!',
    copy_btn: 'Копировать',
    generating: 'Генерирую...',
    answer_followup: 'Отправьте ответ, чтобы уточнить промпт.',

    result_label_input: 'Ваш текст:',
    result_label_prompt: 'Оптимизированный промпт:',
    result_label_followup: 'Вопросы для уточнения:',
    result_footer: '@Lyra_IVbot',

    category_display: {
      code: 'Code',
      image: 'Image',
      video: 'Video'
    },

    reply_freeform: 'Отправить текст',
    reply_code: 'Code',
    reply_image: 'Image',
    reply_video: 'Video',
    reply_history: 'История',
    reply_settings: 'Настройки'
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