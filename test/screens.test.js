import { test } from "node:test";
import assert from "node:assert/strict";
import { home, settings, settingsLine, modeScreen, resultCard, bankItem, quickAsk, quickAskDetailed, sharpenQuestion, heartbeat } from "../src/screens.js";
import { parseQuestions } from "../src/prompts.js";
import { splitMessage } from "../src/telegram.js";
import { BANK } from "../src/styles.js";

const user = {
  id: 1, lang: "en", bundle: "standard", style: "standard",
  level: { ponytail: "full", caveman: "standard" },
  platform: "chatgpt", mode: "basic", flow: null, flowMsg: null,
};

test("home: one-line settings summary, four keyboard rows, red Detailed", () => {
  const s = home(user);
  assert.ok(s.text.includes(settingsLine(user)));
  // Four rows: Quick / Detailed (danger) / Mode+Bank / Settings+Guide.
  assert.equal(s.keyboard.inline_keyboard.length, 4);
  const detail = s.keyboard.inline_keyboard[1][0];
  assert.equal(detail.callback_data, "nav:detail");
  assert.equal(detail.style, "danger");
});

test("result card keyboard is minimal: Home only (no Refine/New clutter)", () => {
  const card = resultCard(user, { idea: "idea", prompt: "p".repeat(60) });
  const kb = JSON.stringify(card.keyboard);
  assert.ok(!kb.includes("res:refine"), "no Refine button — refine is by reply now");
  assert.ok(!kb.includes("nav:quick"), "no New button on the card");
  assert.ok(kb.includes("nav:home"), "Home stays");
  assert.equal(card.keyboard.inline_keyboard.length, 1, "one row without sharpen");
});

test("heartbeat screen: tiny, one tip, one button", () => {
  const hb = heartbeat(user, 0);
  assert.ok(hb.text.includes("Still here"));
  assert.ok(hb.text.includes("💡"), "carries a rotating tip");
  assert.equal(hb.keyboard.inline_keyboard.length, 1);
  assert.equal(hb.keyboard.inline_keyboard[0][0].callback_data, "nav:quick");
  assert.ok(hb.text.length < 300, "stays small — not spam");
});

test("result card prompt is quote + mono (overlapping entities)", () => {
  const prompt = "You are an expert. Do the thing.";
  const card = resultCard(user, { idea: "idea", prompt });
  const off = card.text.indexOf(prompt);
  const types = card.entities.filter((e) => e.offset === off && e.length === prompt.length).map((e) => e.type);
  assert.ok(types.includes("expandable_blockquote"), "prompt must be a quote");
  assert.ok(types.includes("code"), "prompt must be mono");
  // Designed card: meta line (mode + length) and the copy tip are present.
  assert.ok(card.text.includes("📏"), "meta line shows prompt length");
  assert.ok(card.text.includes("Hold the prompt block"), "rotating tip present (n=0 → tip_1)");
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

test("settings line: one emoji per fact, no stacked icons", () => {
  const line = settingsLine(user);
  assert.ok(!line.includes("🎛 ✨"), "mode icon must not stack on the bundle icon");
  assert.ok(!line.includes("🎛 🐴"));
});

test("quick vs detailed ask screens have distinct headers, no duplicate emoji", () => {
  const q = quickAsk(user);
  const d = quickAskDetailed(user);
  assert.ok(q.text.startsWith("✍️ Quick Prompt"));
  assert.ok(d.text.startsWith("🔍 Detailed Prompt"));
  assert.ok(!q.text.includes("✍️ Quick Prompt\n\n✍️"), "ask body must not repeat the header emoji");
  assert.ok(!d.text.includes("🔍 Detailed Prompt\n\n✍️"));
});

test("bank has real ready-to-use presets, not only style meta-prompts", () => {
  assert.ok(BANK.length >= 12);
  for (const id of ["code_review", "debug", "eli5", "email_pro", "study", "image_photo", "summarize"]) {
    assert.ok(BANK.some((p) => p.id === id), `missing preset ${id}`);
  }
});

test("tip rotates by prompt count, loading-screen style", () => {
  const c0 = resultCard({ ...user, n: 7 }, { idea: "x", prompt: "p".repeat(50) });
  assert.ok(c0.text.includes("Hold the prompt block"), "n=7 → tip_1 again");
  const c1 = resultCard({ ...user, n: 1 }, { idea: "x", prompt: "p".repeat(50) });
  assert.ok(c1.text.includes("/mode switches style"), "n=1 → tip_2");
});

test("sharpen: card row only when questions exist; question screen is tap-only", () => {
  const plain = resultCard({ ...user, n: 0 }, { idea: "x", prompt: "p".repeat(50) });
  assert.ok(!JSON.stringify(plain.keyboard).includes("shrp:start"), "no sharpen row by default");
  const sharp = resultCard({ ...user, n: 0 }, { idea: "x", prompt: "p".repeat(50), sharpen: 2 });
  const kb = JSON.stringify(sharp.keyboard);
  assert.ok(kb.includes("shrp:start") && kb.includes("Sharpen · 2 quick questions"), "green sharpen row with count");
  const qs = sharpenQuestion({ ...user }, { idx: 0, questions: [{ q: "Who is it for?", options: ["Beginners", "Pros"] }, { q: "Format?", options: ["List", "Essay"] }] });
  assert.ok(qs.text.includes("1/2") && qs.text.includes("Who is it for?"));
  const qkb = JSON.stringify(qs.keyboard);
  assert.ok(qkb.includes("ans:0:0") && qkb.includes("ans:0:1") && qkb.includes("ans:0:skip") && qkb.includes("ans:cancel"), "index callbacks + skip/cancel");
});

test("parseQuestions: strict, capped, defensive", () => {
  const good = "<PROMPT>x</PROMPT>\n<QUESTIONS>\nQ: Who is it for?\n- Beginners\n- Pros\nQ: Tone?\n- Formal\n- Casual\n- Fun\n</QUESTIONS>";
  const qs = parseQuestions(good);
  assert.equal(qs.length, 2);
  assert.equal(qs[0].options.length, 2);
  assert.equal(qs[1].options.length, 3);
  assert.equal(parseQuestions("<PROMPT>x</PROMPT>"), null, "no block → null");
  assert.equal(parseQuestions("<QUESTIONS>\nQ: Lonely?\n</QUESTIONS>"), null, "question without options → null");
  const many = "<QUESTIONS>\n" + "Q: A?\n- 1\n- 2\n".repeat(4) + "</QUESTIONS>";
  assert.equal(parseQuestions(many).length, 2, "capped at 2 questions");
});
