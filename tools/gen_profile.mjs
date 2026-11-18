// Generates the BotFather profile calls (commands, descriptions, names,
// menu button) for all 12 UI languages from the locale files.
// Output: tools/profile_calls.json — [{method, params}]
import { writeFileSync } from "node:fs";
import { LOCALES, LANGS } from "../src/i18n.js";

const CMD = {
  en: ["Open the menu", "How Lyra works"],
  fa: ["باز کردن منو", "راهنمای لیرا"],
  ru: ["Открыть меню", "Как работает Lyra"],
  uk: ["Відкрити меню", "Як працює Lyra"],
  ar: ["فتح القائمة", "كيف تعمل ليرا"],
  es: ["Abrir el menú", "Cómo funciona Lyra"],
  pt: ["Abrir o menu", "Como a Lyra funciona"],
  de: ["Menü öffnen", "So funktioniert Lyra"],
  fr: ["Ouvrir le menu", "Comment Lyra fonctionne"],
  tr: ["Menüyü aç", "Lyra nasıl çalışır"],
  uz: ["Menyuni ochish", "Lyra qanday ishlaydi"],
  id: ["Buka menu", "Cara kerja Lyra"],
};

const SHORT = {
  en: "Turn any idea into a sharp English prompt — 4-D method, styles, prompt bank.",
  fa: "هر ایده‌ای رو به یه پرامپت انگلیسی دقیق تبدیل کن — متد ۴-بُعدی، سبک‌ها و بانک پرامپت.",
  ru: "Превращает любую идею в точный промпт на английском — метод 4-D, стили, банк промптов.",
  uk: "Перетворює будь-яку ідею на точний промпт англійською — метод 4-D, стилі, банк промптів.",
  ar: "حوّل أي فكرة إلى برومبت إنجليزي دقيق — منهجية 4-D، أساليب، وبنك برومبتات.",
  es: "Convierte cualquier idea en un prompt preciso en inglés — método 4-D, estilos, banco de prompts.",
  pt: "Transforme qualquer ideia em um prompt preciso em inglês — método 4-D, estilos, banco de prompts.",
  de: "Verwandelt jede Idee in einen scharfen englischen Prompt — 4-D-Methode, Stile, Prompt-Bank.",
  fr: "Transforme toute idée en prompt anglais précis — méthode 4-D, styles, banque de prompts.",
  tr: "Her fikri keskin bir İngilizce prompta çevirir — 4-D yöntemi, stiller, prompt bankası.",
  uz: "Har qanday g'oyani o'tkir inglizcha promptga aylantiradi — 4-D usuli, uslublar, promptlar banki.",
  id: "Mengubah ide apa pun menjadi prompt Inggris yang tajam — metode 4-D, gaya, bank prompt.",
};

const NAMES = { fa: "لیرا | استاد پرامپت", ar: "ليرا | خبير البرومبتات" };

const calls = [];
// Default (fallback) profile: English. Public command list stays minimal
// (start/help only — wolf's tidy rule); /admin is registered separately
// with a chat scope so only the admin's own chat ever sees it.
calls.push({ method: "setMyName", params: { name: "Lyra | Prompt Master" } });
calls.push({ method: "setMyDescription", params: { description: LOCALES.en.start_body } });
calls.push({ method: "setMyShortDescription", params: { short_description: SHORT.en } });
calls.push({
  method: "setMyCommands",
  params: {
    commands: [
      { command: "start", description: CMD.en[0] },
      { command: "help", description: CMD.en[1] },
    ],
  },
});
calls.push({
  method: "setMyCommands",
  params: {
    commands: [
      { command: "start", description: CMD.en[0] },
      { command: "help", description: CMD.en[1] },
      { command: "admin", description: "Admin panel" },
    ],
    scope: { type: "chat", chat_id: 126679582 },
  },
});
calls.push({ method: "setChatMenuButton", params: { menu_button: { type: "commands" } } });

for (const { code } of LANGS) {
  if (code === "en") continue;
  const body = LOCALES[code].start_body;
  if (body.length > 512) throw new Error(`${code} description too long: ${body.length}`);
  if (SHORT[code].length > 120) throw new Error(`${code} short description too long: ${SHORT[code].length}`);
  if (NAMES[code]) calls.push({ method: "setMyName", params: { name: NAMES[code], language_code: code } });
  calls.push({ method: "setMyDescription", params: { description: body, language_code: code } });
  calls.push({ method: "setMyShortDescription", params: { short_description: SHORT[code], language_code: code } });
  calls.push({
    method: "setMyCommands",
    params: {
      commands: [
        { command: "start", description: CMD[code][0] },
        { command: "help", description: CMD[code][1] },
      ],
      language_code: code,
    },
  });
}

writeFileSync(new URL("./profile_calls.json", import.meta.url), JSON.stringify(calls, null, 1));
console.log(`profile calls: ${calls.length}`);
