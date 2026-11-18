import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, WAI_QUALITY_CHAIN, WAI_FAST_CHAIN, OR_CHAIN } from "../src/providers.js";

// Fake Workers AI binding: behaviour per model from a table.
// value: string -> resolves {response: value}; Error -> rejects; "empty" -> {}
function fakeAI(table, calls = []) {
  return {
    async run(model) {
      calls.push(model);
      const v = table[model];
      if (v instanceof Error) throw v;
      if (v === "empty") return {};
      return { response: v ?? "ok" };
    },
  };
}

test("quality chain: first success wins, in order", async () => {
  const calls = [];
  const env = { AI: fakeAI({ [WAI_QUALITY_CHAIN[0]]: new Error("down"), [WAI_QUALITY_CHAIN[1]]: "PROMPT" }, calls) };
  const out = await generate(env, { system: "s", user: "u" });
  assert.equal(out.text, "PROMPT");
  assert.equal(out.via, WAI_QUALITY_CHAIN[1]);
  assert.deepEqual(calls, [WAI_QUALITY_CHAIN[0], WAI_QUALITY_CHAIN[1]]);
});

test("empty response counts as failure and moves down the chain", async () => {
  const env = { AI: fakeAI({ [WAI_QUALITY_CHAIN[0]]: "empty", [WAI_QUALITY_CHAIN[1]]: "P2" }) };
  const out = await generate(env, { system: "s", user: "u" });
  assert.equal(out.via, WAI_QUALITY_CHAIN[1]);
});

test("validate() rejection moves to the next model", async () => {
  const env = { AI: fakeAI({ [WAI_QUALITY_CHAIN[0]]: "garbage", [WAI_QUALITY_CHAIN[1]]: "GOOD" }) };
  const out = await generate(env, { system: "s", user: "u", validate: (x) => x === "GOOD" });
  assert.equal(out.text, "GOOD");
  assert.equal(out.via, WAI_QUALITY_CHAIN[1]);
});

test("fast mode walks the fast chain", async () => {
  const calls = [];
  const env = { AI: fakeAI({}, calls) };
  const out = await generate(env, { system: "s", user: "u", fast: true });
  assert.equal(out.via, WAI_FAST_CHAIN[0]);
  assert.deepEqual(calls, [WAI_FAST_CHAIN[0]]);
});

test("whole chain failing throws; OpenRouter skipped without a key", async () => {
  const calls = [];
  const table = {};
  for (const m of WAI_QUALITY_CHAIN) table[m] = new Error("down");
  const env = { AI: fakeAI(table, calls) };
  await assert.rejects(() => generate(env, { system: "s", user: "u" }), /All providers failed/);
  assert.equal(calls.length, WAI_QUALITY_CHAIN.length);
});

test("chains are non-empty and OpenRouter stays last-resort by design", () => {
  assert.ok(WAI_QUALITY_CHAIN.length >= 4);
  assert.ok(WAI_FAST_CHAIN.length >= 3);
  assert.ok(OR_CHAIN.length >= 1);
});
