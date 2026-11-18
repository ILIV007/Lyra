import { test } from "node:test";
import assert from "node:assert/strict";
import { richHome, home, settings, settingsLine } from "../src/screens.js";

const user = {
  id: 1, lang: "en", style: "standard",
  level: { ponytail: "full", caveman: "standard" },
  platform: "chatgpt", mode: "basic", flow: null,
};

test("rich home: no table, carries the one-line settings summary", () => {
  const { html, keyboard } = richHome(user);
  assert.ok(!html.includes("<table"), "home must not use a table");
  assert.ok(html.includes(settingsLine(user)));
  assert.ok(html.includes("<h3>"));
  // Two keyboard rows: primary action, then Bank/Settings/Guide together.
  assert.equal(keyboard.inline_keyboard.length, 2);
  assert.equal(keyboard.inline_keyboard[1].length, 3);
});

test("plain home mirrors the rich one", () => {
  const s = home(user);
  assert.ok(s.text.includes(settingsLine(user)));
  assert.equal(s.keyboard.inline_keyboard.length, 2);
});

test("settings screen shows the state line, not a legend", () => {
  const s = settings(user);
  assert.ok(s.text.includes(settingsLine(user)));
});
