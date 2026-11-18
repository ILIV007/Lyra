// screens.js — every screen is a pure function of the user record.
// Regular screens return { text, entities, keyboard } (entity-based,
// edit-in-place). Home and Guide are RICH messages (richHome/richGuide
// return HTML) — read-once surfaces, sent fresh each time.
//
// NOTE: no copy_text buttons anywhere. Telegram limits copy_text to
// 256 chars and rejects the WHOLE message otherwise (BUTTON_COPY_TEXT_
// INVALID) — prompts and presets are far longer. The `pre` block is the
// copy mechanism: clients render it with a native copy affordance.
import { compose, tx, b, i, pre, bq, btn, kb } from "./telegram.js";
import { t, LANGS, LANG_NAME } from "./i18n.js";
import { BANK, STYLE_LEVELS } from "./styles.js";

const tr = (u) => (key, vars) => t(u.lang, key, vars);
const homeRow = (u) => [btn(tr(u)("btn_home"), "nav:home")];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The user's "mode" is one bundle: a style (standard/ponytail/caveman)
// or a craft category (code/image/video). See handlers.bundleOf().
export function bundleLabel(u) {
  const x = tr(u);
  switch (u.bundle) {
    case "ponytail": return `🐴 Ponytail · ${x(u.level.ponytail === "lite" ? "lvl_lite" : u.level.ponytail === "ultra" ? "lvl_ultra" : "lvl_full")}`;
    case "caveman": return `🪨 Caveman · ${x(u.level.caveman === "ultra" ? "lvl_ultra" : "lvl_std")}`;
    case "code": return x("cat_code");
    case "image": return x("cat_image");
    case "video": return x("cat_video");
    default: return x("style_standard");
  }
}

function detailLabel(u) {
  return u.mode === "detail" ? tr(u)("mode_detail") : tr(u)("mode_basic");
}

// One compact line summarising the current setup — Home, Mode, Settings.
export function settingsLine(u) {
  return [`🌐 ${LANG_NAME[u.lang]}`, `🎛 ${bundleLabel(u)}`, detailLabel(u)].join("  ·  ");
}

// ---- rich surfaces ----------------------------------------------------------

export function homeKeyboard(u) {
  const x = tr(u);
  return kb([
    [btn(x("btn_quick"), "nav:quick", { style: "primary" })],
    [btn(x("btn_mode"), "nav:mode"), btn(x("btn_bank"), "nav:bank")],
    [btn(x("btn_settings"), "nav:settings"), btn(x("btn_guide"), "nav:guide")],
  ]);
}

export function richHome(u) {
  const x = tr(u);
  const html =
    `<h3>🌀 ${esc(x("start_title"))}</h3>` +
    `<p>${esc(x("start_body"))}</p>` +
    `<p>${esc(settingsLine(u))}</p>` +
    `<blockquote>${esc(x("home_hint"))}</blockquote>`;
  return { html, keyboard: homeKeyboard(u) };
}

export function richGuide(u) {
  const x = tr(u);
  const body = x("guide_body");
  const parts = [];
  for (const para of body.split(/\n{2,}/)) {
    const lines = para.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => l.startsWith("•"))) {
      parts.push(`<ul>${lines.map((l) => `<li>${esc(l.replace(/^•\s*/, ""))}</li>`).join("")}</ul>`);
    } else if (lines.length) {
      parts.push(`<p>${esc(lines.join(" "))}</p>`);
    }
  }
  const html = `<h3>${esc(x("guide_title"))}</h3>` + parts.join("");
  return { html, keyboard: kb([homeRow(u)]) };
}

// Plain fallback for Home if a client/API rejects the rich payload.
export function home(u) {
  const x = tr(u);
  const { text, entities } = compose(
    b("🌀 " + x("start_title")), tx("\n\n"), tx(x("start_body")), tx("\n\n"),
    tx(settingsLine(u)), tx("\n\n"), i(x("home_hint"))
  );
  return { text, entities, keyboard: homeKeyboard(u) };
}

// ---- regular screens ----------------------------------------------------------

export function quickAsk(u) {
  const x = tr(u);
  const { text, entities } = compose(
    b(x("btn_quick")), tx("\n\n"), tx(x("quick_ask")), tx("\n\n"), i(settingsLine(u))
  );
  return { text, entities, keyboard: kb([homeRow(u)]) };
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

export function modeScreen(u) {
  const x = tr(u);
  const { text, entities } = compose(
    b(x("mode_title")), tx("\n\n"), tx(settingsLine(u))
  );
  const mark = (key) => (u.bundle === key ? "✓ " : "");
  const keyboard = kb([
    [btn(mark("standard") + x("style_standard"), "mode:standard"), btn(mark("ponytail") + x("style_ponytail"), "mode:ponytail")],
    [btn(mark("caveman") + x("style_caveman"), "mode:caveman"), btn(mark("code") + x("cat_code"), "mode:code")],
    [btn(mark("image") + x("cat_image"), "mode:image"), btn(mark("video") + x("cat_video"), "mode:video")],
    homeRow(u),
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
  rows.push([btn(x("btn_back"), "nav:mode"), btn(x("btn_home"), "nav:home")]);
  return { text, entities, keyboard: kb(rows) };
}

export function bank(u) {
  const x = tr(u);
  const { text, entities } = compose(b(x("bank_title")), tx("\n\n"), i(x("bank_note")));
  const rows = [];
  for (let n = 0; n < BANK.length; n += 2) {
    rows.push(BANK.slice(n, n + 2).map((p) => btn(x(p.titleKey), `bank:${p.id}`)));
  }
  rows.push(homeRow(u));
  return { text, entities, keyboard: kb(rows) };
}

export function bankItem(u, preset) {
  const x = tr(u);
  const { text, entities } = compose(b(x(preset.titleKey)), tx("\n\n"), pre(preset.content));
  const keyboard = kb([
    [btn(x("btn_back"), "nav:bank"), btn(x("btn_home"), "nav:home")],
  ]);
  return { text, entities, keyboard };
}

export function settings(u) {
  const x = tr(u);
  const { text, entities } = compose(
    b(x("settings_title")), tx("\n\n"), tx(settingsLine(u))
  );
  const keyboard = kb([
    [btn((u.mode === "basic" ? "✓ " : "") + x("mode_basic"), "dt:basic"),
     btn((u.mode === "detail" ? "✓ " : "") + x("mode_detail"), "dt:detail")],
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
    [btn(x("btn_refine"), "res:refine"), btn(x("btn_new"), "nav:quick")],
    homeRow(u),
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
