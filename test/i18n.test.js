import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCALES, LANGS, detectLang, t, guessTextLang } from "../src/i18n.js";
import en from "../src/locales/en.js";

test("every locale carries exactly the English key set", () => {
  const enKeys = Object.keys(en).sort();
  for (const [code, dict] of Object.entries(LOCALES)) {
    assert.deepEqual(Object.keys(dict).sort(), enKeys, `locale ${code} key mismatch`);
    for (const k of enKeys) {
      assert.ok(typeof dict[k] === "string" && dict[k].trim().length > 0, `${code}.${k} empty`);
    }
  }
});

test("12 languages are registered", () => {
  assert.equal(LANGS.length, 12);
  assert.deepEqual(LANGS.map((l) => l.code), ["en", "fa", "ru", "uk", "ar", "es", "pt", "de", "fr", "tr", "uz", "id"]);
});

test("detectLang maps Telegram codes with prefix + fallback", () => {
  assert.equal(detectLang("pt-BR"), "pt");
  assert.equal(detectLang("en-US"), "en");
  assert.equal(detectLang("fa"), "fa");
  assert.equal(detectLang("zh-Hans"), "en"); // not in launch set → English
  assert.equal(detectLang(undefined), "en");
});

test("t interpolates variables and falls back to en", () => {
  assert.match(t("fa", "stats_fmt", { users: 5 }), /5/);
  assert.equal(t("xx", "btn_home"), en.btn_home);
});

test("guessTextLang detects scripts", () => {
  assert.equal(guessTextLang("سلام دنیا", "en"), "fa");
  assert.equal(guessTextLang("مرحبا بالعالم", "en"), "ar");
  assert.equal(guessTextLang("Привет мир", "en"), "ru");
  assert.equal(guessTextLang("Привіт світ", "en"), "uk");
  assert.equal(guessTextLang("hello world", "de"), "de");
});

test("placeholders match across locales", () => {
  const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort();
  for (const [code, dict] of Object.entries(LOCALES)) {
    for (const k of Object.keys(en)) {
      assert.deepEqual(ph(dict[k]), ph(en[k]), `${code}.${k} placeholders differ`);
    }
  }
});
