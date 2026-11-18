import { test } from "node:test";
import assert from "node:assert/strict";
import { richHome, home, settings, settingsLine, modeScreen, resultCard, bankItem } from "../src/screens.js";
import { splitMessage } from "../src/telegram.js";
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
  assert.ok(html.includes("<h4>"), "settings section is separated by a subheading");
  // Four rows: Quick / Detailed (danger) / Mode+Bank / Settings+Guide.
  assert.equal(keyboard.inline_keyboard.length, 4);
  const detail = keyboard.inline_keyboard[1][0];
  assert.equal(detail.callback_data, "nav:detail");
  assert.equal(detail.style, "danger");
});

test("plain home mirrors the rich one", () => {
  const s = home(user);
  assert.ok(s.text.includes(settingsLine(user)));
  assert.equal(s.keyboard.inline_keyboard.length, 4);
});

test("result card prompt is quote + mono (overlapping entities)", () => {
  const prompt = "You are an expert. Do the thing.";
  const card = resultCard(user, { idea: "idea", prompt });
  const off = card.text.indexOf(prompt);
  const types = card.entities.filter((e) => e.offset === off && e.length === prompt.length).map((e) => e.type);
  assert.ok(types.includes("expandable_blockquote"), "prompt must be a quote");
  assert.ok(types.includes("code"), "prompt must be mono");
});

test("a 4050-char card stays ONE message at the 4096 limit", () => {
  const parts = splitMessage("x".repeat(4050), [], 4096);
  assert.equal(parts.length, 1);
  const two = splitMessage("x".repeat(5000), [], 4096);
  assert.equal(two.length, 2);
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
