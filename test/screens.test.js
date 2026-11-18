import { test } from "node:test";
import assert from "node:assert/strict";
import { richHome, home, settings, settingsLine, modeScreen, resultCard, bankItem } from "../src/screens.js";
import { BANK } from "../src/styles.js";

const user = {
  id: 1, lang: "en", bundle: "standard", style: "standard",
  level: { ponytail: "full", caveman: "standard" },
  platform: "chatgpt", mode: "basic", flow: null, flowMsg: null,
};

test("rich home: no table, carries the one-line settings summary", () => {
  const { html, keyboard } = richHome(user);
  assert.ok(!html.includes("<table"), "home must not use a table");
  assert.ok(html.includes(settingsLine(user)));
  assert.ok(html.includes("<h3>"));
  // Three rows: primary action / Mode+Bank / Settings+Guide.
  assert.equal(keyboard.inline_keyboard.length, 3);
  assert.equal(keyboard.inline_keyboard[1].length, 2);
});

test("plain home mirrors the rich one", () => {
  const s = home(user);
  assert.ok(s.text.includes(settingsLine(user)));
  assert.equal(s.keyboard.inline_keyboard.length, 3);
});

test("settings screen: no platform picker, detail toggle + language only", () => {
  const s = settings(user);
  assert.ok(s.text.includes(settingsLine(user)));
  const datas = s.keyboard.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(datas.some((d) => d.startsWith("dt:")), "detail toggle present");
  assert.ok(!datas.some((d) => d.startsWith("plat:")), "platform picker must be gone");
  assert.ok(!datas.some((d) => d.startsWith("style:")), "style row moved to Mode");
});

test("mode screen offers all six bundles", () => {
  const s = modeScreen(user);
  const datas = s.keyboard.inline_keyboard.flat().map((b) => b.callback_data);
  for (const b of ["standard", "ponytail", "caveman", "code", "image", "video"]) {
    assert.ok(datas.includes(`mode:${b}`), `missing mode:${b}`);
  }
});

// Regression (v2.4): copy_text buttons cap at 256 chars and Telegram
// rejects the whole message past that — the result card and bank items
// silently never arrived. No screen may carry a copy_text button.
test("no copy_text buttons on result card or bank items, even when long", () => {
  const longPrompt = "x".repeat(3000);
  const card = resultCard(user, { idea: "idea", prompt: longPrompt });
  assert.ok(!JSON.stringify(card.keyboard).includes("copy_text"));
  for (const preset of BANK) {
    const item = bankItem(user, preset);
    assert.ok(!JSON.stringify(item.keyboard).includes("copy_text"), preset.id);
    assert.ok(item.text.includes(preset.content.slice(0, 60)), preset.id);
  }
});

test("bank has real ready-to-use presets, not only style meta-prompts", () => {
  assert.ok(BANK.length >= 12);
  for (const id of ["code_review", "debug", "eli5", "email_pro", "study", "image_photo", "summarize"]) {
    assert.ok(BANK.some((p) => p.id === id), `missing preset ${id}`);
  }
});
