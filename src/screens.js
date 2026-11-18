// screens.js — every screen is a pure function of the user record.
// Returns { text, entities, keyboard } built with entity segments.
import { compose, tx, b, i, pre, bq, btn, copyBtn, kb } from "./telegram.js";
import { t, LANGS, LANG_NAME } from "./i18n.js";
import { BANK, STYLE_LEVELS } from "./styles.js";

const tr = (u) => (key, vars) => t(u.lang, key, vars);
const homeRow = (u) => [btn(tr(u)("btn_home"), "nav:home")];
const backHome = (u) => [btn(tr(u)("btn_back"), "nav:home"), btn(tr(u)("btn_home"), "nav:home")];

function styleLabel(u) {
  const x = tr(u);
  if (u.style === "ponytail") return `🐴 Ponytail · ${x(u.level.ponytail === "lite" ? "lvl_lite" : u.level.ponytail === "ultra" ? "lvl_ultra" : "lvl_full")}`;
  if (u.style === "caveman") return `🪨 Caveman · ${x(u.level.caveman === "ultra" ? "lvl_ultra" : "lvl_std")}`;
  return x("style_standard");
}

export function home(u) {
  const x = tr(u);
  const { text, entities } = compose(
    b(x("start_title")), tx("\n\n"), tx(x("start_body")), tx("\n\n"), i(x("home_hint"))
  );
  const keyboard = kb([
    [btn(`🌐 ${LANG_NAME[u.lang]}`, "nav:lang"), btn(styleLabel(u), "nav:styles"), btn(u.mode === "detail" ? "🔎 Detail" : "⚡ Basic", "nav:settings")],
    [btn(x("btn_quick"), "nav:quick", { style: "primary" }), btn(x("btn_cats"), "nav:cats")],
    [btn(x("btn_bank"), "nav:bank"), btn(x("btn_styles"), "nav:styles")],
    [btn(x("btn_settings"), "nav:settings"), btn(x("btn_guide"), "nav:guide")],
  ]);
  return { text, entities, keyboard };
}

export function quickAsk(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("btn_quick")), tx("\n\n"), tx(x("quick_ask")));
  return { text, entities, keyboard: kb([homeRow(u)]) };
}

export function categories(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("cats_title")));
  const keyboard = kb([
    [btn(x("cat_general"), "cat:general"), btn(x("cat_code"), "cat:code")],
    [btn(x("cat_image"), "cat:image"), btn(x("cat_video"), "cat:video")],
    homeRow(u),
  ]);
  return { text, entities, keyboard };
}

export function question(u, idx) {
  const x = tr(u);
  const head = idx === 0 ? `${x("questions_intro")}\n\n` : "";
  const { text, entities } = compose(tx(head), b(x(["q1", "q2", "q3"][idx])));
  const keyboard = kb([
    [btn(x("btn_skip"), "q:skip")],
    homeRow(u),
  ]);
  return { text, entities, keyboard };
}

export function styles(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("btn_styles")), tx("\n\n"), tx(x("styles_title")));
  const mark = (s) => (u.style === s ? "✓ " : "");
  const keyboard = kb([
    [btn(mark("standard") + x("style_standard"), "style:standard")],
    [btn(mark("ponytail") + x("style_ponytail"), "style:ponytail")],
    [btn(mark("caveman") + x("style_caveman"), "style:caveman")],
    backHome(u),
  ]);
  return { text, entities, keyboard };
}

export function styleLevels(u, style) {
  const x = tr(u);
  const name = style === "ponytail" ? x("style_ponytail") : x("style_caveman");
  const { text, entities } = compose(b(name), tx("\n\n"), tx(x("lvl_title")));
  const lvlKey = { lite: "lvl_lite", full: "lvl_full", ultra: "lvl_ultra", standard: "lvl_std" };
  const cur = u.level[style];
  const rows = STYLE_LEVELS[style].map((lv) => [
    btn((lv === cur ? "✓ " : "") + x(lvlKey[lv]), `lvl:${style}:${lv}`),
  ]);
  rows.push([btn(x("btn_back"), "nav:styles"), btn(x("btn_home"), "nav:home")]);
  return { text, entities, keyboard: kb(rows) };
}

export function bank(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("bank_title")), tx("\n\n"), i(x("bank_note")));
  const rows = BANK.map((p) => [btn(x(p.titleKey), `bank:${p.id}`)]);
  rows.push(homeRow(u));
  return { text, entities, keyboard: kb(rows) };
}

export function bankItem(u, preset) {
  const x = tr(u);
  const { text, entities } = compose(b(x(preset.titleKey)), tx("\n\n"), pre(preset.content));
  const keyboard = kb([
    [copyBtn(x("btn_copy"), preset.content)],
    [btn(x("btn_back"), "nav:bank"), btn(x("btn_home"), "nav:home")],
  ]);
  return { text, entities, keyboard };
}

const PLATFORMS = [
  ["chatgpt", "ChatGPT"], ["claude", "Claude"], ["gemini", "Gemini"],
  ["code", "💻 Code"], ["image", "🖼 Image"], ["video", "🎬 Video"],
];

export function settings(u) {
  const x = tr(u);
  const { text, entities } = compose(
    b(x("settings_title")), tx("\n\n"), tx(x("set_platform")), tx("\n"), tx(x("set_mode"))
  );
  const prow = PLATFORMS.map(([k, label]) => btn((u.platform === k ? "✓ " : "") + label, `plat:${k}`));
  const keyboard = kb([
    prow.slice(0, 3),
    prow.slice(3),
    [btn((u.mode === "basic" ? "✓ " : "") + x("mode_basic"), "mode:basic"),
     btn((u.mode === "detail" ? "✓ " : "") + x("mode_detail"), "mode:detail")],
    [btn(x("set_lang"), "nav:lang"), btn(x("btn_home"), "nav:home")],
  ]);
  return { text, entities, keyboard };
}

export function language(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("lang_title")));
  const rows = [];
  for (let n = 0; n < LANGS.length; n += 2) {
    rows.push(LANGS.slice(n, n + 2).map((l) => btn((u.lang === l.code ? "✓ " : "") + l.name, `lang:${l.code}`)));
  }
  rows.push(homeRow(u));
  return { text, entities, keyboard: kb(rows) };
}

export function guide(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("guide_title")), tx("\n\n"), tx(x("guide_body")));
  return { text, entities, keyboard: kb([homeRow(u)]) };
}

export function resultCard(u, { idea, prompt }) {
  const x = tr(u);
  const shownIdea = idea.length > 500 ? idea.slice(0, 500) + "…" : idea;
  const { text, entities } = compose(
    b(x("result_title")), tx("\n\n"),
    i(x("result_input") + ":"), tx("\n"), bq(shownIdea, true), tx("\n\n"),
    pre(prompt)
  );
  const keyboard = kb([
    [copyBtn(x("btn_copy"), prompt), btn(x("btn_refine"), "res:refine")],
    [btn(x("btn_restyle"), "nav:styles"), btn(x("btn_new"), "nav:quick"), btn(x("btn_home"), "nav:home")],
  ]);
  return { text, entities, keyboard };
}

export function refineAsk(u) {
  const x = tr(u);
  const { text, entities } = compose(tx(x("refine_ask")));
  return { text, entities, keyboard: kb([homeRow(u)]) };
}

export function adminHome(u, users) {
  const x = tr(u);
  const { text, entities } = compose(
    b(x("admin_title")), tx("\n\n"), tx(x("stats_fmt", { users }))
  );
  const keyboard = kb([
    [btn(x("admin_bcast"), "adm:bcast")],
    homeRow(u),
  ]);
  return { text, entities, keyboard };
}

export function bcastConfirm(u, btext) {
  const x = tr(u);
  const shown = btext.length > 800 ? btext.slice(0, 800) + "…" : btext;
  const { text, entities } = compose(b(x("bcast_confirm")), tx("\n\n"), bq(shown));
  const keyboard = kb([
    [btn(x("btn_send"), "adm:send", { style: "danger" }), btn(x("btn_cancel"), "adm:cancel")],
  ]);
  return { text, entities, keyboard };
}
