// i18n.js — 12 UI languages. en is the source of truth; every other locale
// must carry exactly the same keys (enforced by test/i18n.test.js).
import en from "./locales/en.js";
import fa from "./locales/fa.js";
import ru from "./locales/ru.js";
import uk from "./locales/uk.js";
import ar from "./locales/ar.js";
import es from "./locales/es.js";
import pt from "./locales/pt.js";
import de from "./locales/de.js";
import fr from "./locales/fr.js";
import tr from "./locales/tr.js";
import uz from "./locales/uz.js";
import id from "./locales/id.js";

export const LOCALES = { en, fa, ru, uk, ar, es, pt, de, fr, tr, uz, id };

export const LANGS = [
  { code: "en", name: "English", rtl: false },
  { code: "fa", name: "فارسی", rtl: true },
  { code: "ru", name: "Русский", rtl: false },
  { code: "uk", name: "Українська", rtl: false },
  { code: "ar", name: "العربية", rtl: true },
  { code: "es", name: "Español", rtl: false },
  { code: "pt", name: "Português", rtl: false },
  { code: "de", name: "Deutsch", rtl: false },
  { code: "fr", name: "Français", rtl: false },
  { code: "tr", name: "Türkçe", rtl: false },
  { code: "uz", name: "O'zbek", rtl: false },
  { code: "id", name: "Bahasa Indonesia", rtl: false },
];

export const RTL = new Set(LANGS.filter((l) => l.rtl).map((l) => l.code));
export const LANG_NAME = Object.fromEntries(LANGS.map((l) => [l.code, l.name]));

// Map a Telegram language_code ("pt-BR", "en-US", "fa") to a supported UI
// language; anything unknown falls back to English.
export function detectLang(languageCode) {
  if (!languageCode) return "en";
  const base = String(languageCode).toLowerCase().split("-")[0];
  return LOCALES[base] ? base : "en";
}

export function t(lang, key, vars = {}) {
  const dict = LOCALES[lang] || en;
  let s = dict[key] ?? en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// Rough script-based guess of the language a free-text idea is written in,
// used only to set the *answer language* inside the crafted prompt (the
// prompt itself is always English). Falls back to the UI language.
export function guessTextLang(text, fallback = "en") {
  if (/[\u0600-\u06FF]/.test(text)) {
    // Arabic script: Persian if it carries Persian-only letters, else Arabic
    return /[پچگژکی]/u.test(text) || fallback === "fa" ? "fa" : "ar";
  }
  if (/[\u0400-\u04FF]/.test(text)) return /[іїєґ]/i.test(text) ? "uk" : "ru";
  return fallback;
}

export const ANSWER_LANG_NAME = {
  en: "English", fa: "Persian", ru: "Russian", uk: "Ukrainian", ar: "Arabic",
  es: "Spanish", pt: "Portuguese", de: "German", fr: "French", tr: "Turkish",
  uz: "Uzbek", id: "Indonesian",
};
