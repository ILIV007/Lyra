import { test } from "node:test";
import assert from "node:assert/strict";
import { compose, tx, b, pre, splitMessage } from "../src/telegram.js";
import { buildSystem, buildUser, parsePrompt } from "../src/prompts.js";

test("compose computes UTF-16 offsets during assembly (incl. Persian)", () => {
  const { text, entities } = compose(b("Title"), tx("\n"), b("پرامپت"));
  assert.equal(text, "Title\nپرامپت");
  assert.deepEqual(entities[0], { type: "bold", offset: 0, length: 5 });
  // Persian word starts right after "Title\n" — no indexOf anywhere.
  assert.equal(entities[1].offset, 6);
  assert.equal(entities[1].length, "پرامپت".length);
  assert.equal(text.slice(entities[1].offset, entities[1].offset + entities[1].length), "پرامپت");
});

test("splitMessage keeps chunks within limit and entities in range", () => {
  const para = "word ".repeat(50).trim(); // 249 chars
  const text = Array(10).fill(para).join("\n\n");
  const { text: full, entities } = compose(tx(text.slice(0, 100)), pre(text.slice(100)));
  void full;
  const chunks = splitMessage(text, entities, 1000);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(c.text.length <= 1000, `chunk too long: ${c.text.length}`);
    for (const e of c.entities) {
      assert.ok(e.offset >= 0 && e.offset + e.length <= c.text.length, "entity out of range");
    }
  }
  // No content lost apart from separator newlines at cuts.
  const joined = chunks.map((c) => c.text).join("");
  assert.ok(joined.replace(/\n/g, "").length >= text.replace(/\n/g, "").length - 20);
});

test("splitMessage short text passes through untouched", () => {
  const chunks = splitMessage("hello", [{ type: "bold", offset: 0, length: 5 }], 4000);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, "hello");
});

test("buildSystem enforces the always-English contract and answer language", () => {
  const s = buildSystem({ platform: "chatgpt", style: "standard", answerLang: "Persian" });
  assert.match(s, /ALWAYS in English/);
  assert.match(s, /answer in Persian/);
  assert.match(s, /<PROMPT>/);
  assert.match(s, /DECONSTRUCT/);
});

test("buildSystem applies style overlays only when selected", () => {
  const plain = buildSystem({ platform: "code", style: "standard", answerLang: "English" });
  assert.doesNotMatch(plain, /PONYTAIL/);
  const pony = buildSystem({ platform: "code", style: "ponytail", level: "ultra", answerLang: "English" });
  assert.match(pony, /PONYTAIL \(ultra\)/);
  const cave = buildSystem({ platform: "chatgpt", style: "caveman", level: "standard", answerLang: "Arabic" });
  assert.match(cave, /CAVEMAN \(standard\)/);
});

test("parsePrompt extracts the contract tags", () => {
  assert.equal(parsePrompt("noise <PROMPT>Do X well.</PROMPT> tail"), "Do X well.");
});

test("parsePrompt falls back gracefully without tags", () => {
  assert.equal(parsePrompt("Just a plain prompt here."), "Just a plain prompt here.");
  assert.equal(parsePrompt(""), null);
  assert.equal(parsePrompt("short"), null);
});

test("buildUser carries idea, category and answers", () => {
  const s = buildUser({ idea: "an app", category: "code", answers: ["devs", "dark mode"] });
  assert.match(s, /an app/);
  assert.match(s, /TASK CATEGORY: code/);
  assert.match(s, /dark mode/);
});
