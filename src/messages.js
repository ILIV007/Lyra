export const MESSAGES = {
  en: {
    start: `Hello! I'm **Lyra** 🤖
**Prompt Optimizer** — I transform your simple text into professional, optimized prompts!

Choose a category from the menu below:`,

    start_with_name: (name) => `Hello ${name}! I'm **Lyra** 🤖
**Prompt Optimizer** — I transform your simple text into professional, optimized prompts!

Choose a category from the menu below:`,

    choose_category: '📂 Select a prompt category:',

    send_text_prompt: (category) => `Category: ${category}

📝 Send me your idea or text and I'll create a complete, optimized prompt.
Examples:
- "A Python function to sort arrays"
- "Image of a cat in space, cyberpunk style"
- "Video introducing Apple's new product"`,

    processing: '⏳ Analyzing and optimizing your prompt... Please wait',

    result: '✨ **Optimized Prompt:**\n\n',

    followup_questions: '🤔 For a more complete prompt, please answer these (optional):\n\n',

    no_category: '⚠️ Please select a category from the main menu first.\n\n/start - Back to menu',

    error: '❌ An error occurred. Please try again.',

    api_error: '❌ AI server error. Please try later.',

    help: `**Lyra — Prompt Optimizer Guide** 🤖

1. Select a category (Code, Image, Video)
2. Send your simple text
3. Lyra creates a professional prompt
4. Follow-up questions may be asked

**Categories:**
💻 Code | 🖼️ Image | 🎬 Video

**Commands:**
/start — Restart
/help — Guide
/language — Change language`,

    language_changed: '🌐 Language changed.',
    language_prompt: '🌐 Select your language:',

    choose_preset: 'Select a preset:',
    custom_prompt_title: '✨ Build Your Prompt',
    preset_prompt: (title) => `⚡ **${title}**

Send me your text and I'll optimize it into a professional prompt.`,

    back: '🔙 Back',
    cancel: '❌ Cancel',
    main_menu: '🔝 Main Menu',
    new_prompt: '✨ New Prompt',
    copy: '📋 Copied!',
    copy_btn: '📋 Copy',
    answer_followup: 'Send your answer to refine the prompt.',

    category_display: {
      code: '💻 Code',
      image: '🖼️ Image',
      video: '🎬 Video'
    }
  },

  fa: {
    start: `سلام! من **لیرا** هستم 🤖
**بهینه‌ساز پرامپت** — متن ساده‌ات رو به پرامپت حرفه‌ای و بهینه تبدیل می‌کنم!

از منوی زیر یک دسته‌بندی انتخاب کن:`,

    start_with_name: (name) => `سلام ${name} جان! من **لیرا** هستم 🤖
**بهینه‌ساز پرامپت** — متن ساده‌ات رو به پرامپت حرفه‌ای و بهینه تبدیل می‌کنم!

از منوی زیر یک دسته‌بندی انتخاب کن:`,

    choose_category: '📂 دسته‌بندی پرامپت رو انتخاب کن:',

    send_text_prompt: (category) => `دسته: ${category}

📝 متن یا ایده‌ات رو بفرست تا برات پرامپت کامل و بهینه بسازم.`,

    processing: '⏳ دارم پرامپتت رو تحلیل و بهینه‌سازی می‌کنم... لطفاً صبر کن',

    result: '✨ **پرامپت بهینه‌شده:**\n\n',

    followup_questions: '🤔 برای پرامپت کامل‌تر، لطف به این سوالات هم پاسخ بده (اختیاری):\n\n',

    no_category: '⚠️ لطفاً اول از منوی اصلی یک دسته‌بندی انتخاب کن.\n\n/start - برگشت به منو',

    error: '❌ خطایی رخ داد. لطفاً دوباره تلاش کن.',

    api_error: '❌ خطا در ارتباط با سرور هوش مصنوعی. بعداً تلاش کن.',

    help: `**راهنمای لیرا — بهینه‌ساز پرامپت** 🤖

۱. از منو یه دسته‌بندی انتخاب کن (کد، عکس، ویدیو)
۲. متن ساده‌ات رو بفرست
۳. لیرا برات پرامپت حرفه‌ای میسازه
۴. در صورت نیاز سوالات تکمیلی پرسیده میشه

**دسته‌ها:**
💻 کد | 🖼️ عکس | 🎬 ویدیو

**دستورات:**
/start — شروع مجدد
/help — راهنما
/language — تغییر زبان`,

    language_changed: '🌐 زبان تغییر کرد.',
    language_prompt: '🌐 زبان مورد نظرت رو انتخاب کن:',

    choose_preset: 'یک پرامپت آماده انتخاب کن:',
    custom_prompt_title: '✨ ساخت پرامپت اختصاصی',
    preset_prompt: (title) => `⚡ **${title}**

متن مورد نظرت رو بفرست تا برات پرامپت حرفه‌ای بسازم.`,

    back: '🔙 بازگشت',
    cancel: '❌ لغو',
    main_menu: '🔝 منوی اصلی',
    new_prompt: '✨ پرامپت جدید',
    copy: '📋 کپی شد!',
    copy_btn: '📋 کپی',
    answer_followup: 'پاسخت رو بفرست تا پرامپت کامل‌تر بشه.',

    category_display: {
      code: '💻 کد',
      image: '🖼️ عکس',
      video: '🎬 ویدیو'
    }
  },

  ru: {
    start: `Привет! Я **Lyra** 🤖
**Prompt Optimizer** — превращаю ваш простой текст в профессиональные оптимизированные промпты!

Выберите категорию из меню ниже:`,

    start_with_name: (name) => `Привет, ${name}! Я **Lyra** 🤖
**Prompt Optimizer** — превращаю ваш простой текст в профессиональные промпты!

Выберите категорию из меню ниже:`,

    choose_category: '📂 Выберите категорию промпта:',

    send_text_prompt: (category) => `Категория: ${category}

📝 Отправьте вашу идею или текст, и я создам оптимизированный промпт.`,

    processing: '⏳ Анализирую и оптимизирую ваш промпт... Пожалуйста, подождите',

    result: '✨ **Оптимизированный промпт:**\n\n',

    followup_questions: '🤔 Для более полного промпта, ответьте на эти вопросы (необязательно):\n\n',

    no_category: '⚠️ Сначала выберите категорию из главного меню.\n\n/start - Назад в меню',

    error: '❌ Произошла ошибка. Пожалуйста, попробуйте снова.',

    api_error: '❌ Ошибка сервера ИИ. Попробуйте позже.',

    help: `**Lyra — Prompt Optimizer Guide** 🤖

1. Выберите категорию (Code, Image, Video)
2. Отправьте ваш простой текст
3. Lyra создаст профессиональный промпт
4. При необходимости будут заданы уточняющие вопросы

**Категории:**
💻 Code | 🖼️ Image | 🎬 Video

**Команды:**
/start — Начать заново
/help — Помощь
/language — Сменить язык`,

    language_changed: '🌐 Язык изменён.',
    language_prompt: '🌐 Выберите язык:',

    choose_preset: 'Выберите готовый промпт:',
    custom_prompt_title: '✨ Свой промпт',
    preset_prompt: (title) => `⚡ **${title}**

Отправьте ваш текст, и я создам профессиональный промпт.`,

    back: '🔙 Назад',
    cancel: '❌ Отмена',
    main_menu: '🔝 Главное меню',
    new_prompt: '✨ Новый промпт',
    copy: '📋 Скопировано!',
    copy_btn: '📋 Копировать',
    answer_followup: 'Отправьте ответ, чтобы уточнить промпт.',

    category_display: {
      code: '💻 Code',
      image: '🖼️ Image',
      video: '🎬 Video'
    }
  }
};

export function getMsg(lang, key, ...args) {
  const fallbacks = ['ru', 'en'];
  let msg = MESSAGES[lang]?.[key];
  if (msg) return typeof msg === 'function' ? msg(...args) : msg;
  for (const fb of fallbacks) {
    msg = MESSAGES[fb]?.[key];
    if (msg) return typeof msg === 'function' ? msg(...args) : msg;
  }
  return key;
}