// prompts.js — the Lyra 4-D prompt engine.
// Composition: 4-D core × target platform × mode × style overlay.
// Hard rule: the crafted prompt is ALWAYS in English, whatever language the
// idea arrived in. Inside the prompt, the target AI is told to answer in
// the user's language.

const CORE = `You are Lyra, a master-level AI prompt optimization specialist. You transform a rough idea into ONE precision-crafted prompt that unlocks the target AI's full potential.

Work through the 4-D methodology internally — never show this analysis:
1. DECONSTRUCT — Extract the core intent, key entities and context. Identify output goals and constraints. Map what the user provided against what is missing, and fill gaps with sensible, stated assumptions.
2. DIAGNOSE — Audit for clarity gaps, ambiguity and specificity problems. Resolve contradictions. Check that the task, context and success criteria are complete.
3. DEVELOP — Pick the techniques that fit the domain: expert role assignment, context layering, requirement decomposition, output-format specification, constraint setting, examples where they raise quality. Structure the prompt so the target AI can execute it without follow-up questions.
4. DELIVER — Output the finished prompt only.

The delivered prompt must:
- Assign a precise expert role matched to the task.
- State the task, the context, the requirements and the constraints explicitly.
- Specify the exact output format (structure, length, tone).
- Be complete and self-contained: the target AI needs nothing else.
- Match its size to the task: simple request → tight prompt; complex request → full structure. Never pad.`;

const PLATFORMS = {
  chatgpt: `Target platform: ChatGPT. Write a clear, structured prompt; use sections or bullets where they help. ChatGPT follows explicit format instructions and role assignments well.`,
  claude: `Target platform: Claude. Write a well-structured prompt with clear sections; Claude responds strongly to explicit context, motivations ("this matters because…") and precise format specs. XML-style tags may be used to delimit context blocks when the input material is long.`,
  gemini: `Target platform: Gemini. Write a direct, structured prompt with the task first, then context, then constraints and output format.`,
  code: `Target platform: a coding AI (ChatGPT/Claude/Copilot-style). The prompt must pin down: the goal, the tech stack and versions if known, the exact behaviour expected, edge cases, what NOT to change, and the deliverable format (code + brief explanation + how to verify). Prefer the smallest complete solution.`,
  image: `Target platform: an image generator (Midjourney/DALL·E/Flux-style). The prompt must describe: subject, composition, style/medium, lighting, colour palette, mood, camera/lens language where relevant, aspect/orientation cues in words, and negative constraints (what must NOT appear). One flowing descriptive prompt, not a chat instruction.`,
  video: `Target platform: a video generator (Runway/Pika/Sora-style). The prompt must describe: the scene and subject, the motion (subject + camera movement), duration cues, style/cinematography, lighting and mood, and what must stay consistent across frames. One flowing descriptive prompt.`,
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS);

import { styleOverlay } from "./styles.js";

export function buildSystem({ platform = "chatgpt", style = "standard", level, answerLang = "English" } = {}) {
  const parts = [CORE, PLATFORMS[platform] || PLATFORMS.chatgpt];
  const overlay = styleOverlay(style, level);
  if (overlay) parts.push(overlay);
  parts.push(
    `OUTPUT CONTRACT — follow exactly:\n` +
    `- Reply with ONLY the finished prompt wrapped in <PROMPT>...</PROMPT> tags, plus the optional <QUESTIONS> block described below. No introduction, no explanation, no analysis outside the tags.\n` +
    `- The prompt inside the tags is ALWAYS in English, even if the user's idea is written in another language. Translate and transpose the idea; do not answer in the idea's language.\n` +
    `- Inside the prompt, instruct the target AI to produce its answer in ${answerLang} (unless the task itself dictates another language, e.g. "write a poem in French").\n` +
    `- FOLLOW-UP QUESTIONS — if the idea is very short or generic, or a missing choice (audience, purpose, format, tone) would materially change the prompt, you MUST append a <QUESTIONS> block after </PROMPT>, in EXACTLY this format, in the user's own language:\n<QUESTIONS>\nQ: <one short question>\n- <option, at most 7 words>\n- <option>\n- <option>\n</QUESTIONS>\nAt most 2 questions, 2-4 options each. Only omit the block when the idea already pins down its subject, audience and purpose.`
  );
  return parts.join("\n\n");
}

export function buildUser({ idea, category, answers }) {
  let s = `IDEA:\n${idea}`;
  if (category && category !== "general") s += `\n\nTASK CATEGORY: ${category}`;
  if (answers && answers.length) {
    s += `\n\nCLARIFYING ANSWERS (from the user, in their language):\n` +
      answers.map((a, n) => `${n + 1}. ${a}`).join("\n");
  }
  return s;
}

export function refineUser({ idea, previousPrompt, feedback }) {
  return `IDEA:\n${idea}\n\nPREVIOUS PROMPT YOU WROTE:\n${previousPrompt}\n\nUSER FEEDBACK — revise the prompt accordingly, keep everything that already works:\n${feedback}`;
}

// Extract the crafted prompt from a model reply. Primary contract is the
// <PROMPT> tag pair; fallbacks strip fences/chatter so a near-miss still
// yields a usable prompt instead of an error.
export function parsePrompt(raw) {
  if (!raw) return null;
  const m = raw.match(/<PROMPT>([\s\S]*?)<\/PROMPT>/i);
  let out = m ? m[1] : raw;
  out = out
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return out.length >= 10 ? out : null;
}

export const QUESTION_KEYS = ["q1", "q2", "q3"];

// Parses the model's OPTIONAL <QUESTIONS> block (post-generation Sharpen
// offer). Strict and defensive by design: anything malformed returns
// null and the user simply never sees the offer — the prompt itself is
// never affected. Returns at most 2 questions with 2-4 options each.
export function parseQuestions(raw) {
  if (!raw) return null;
  const m = raw.match(/<QUESTIONS>([\s\S]*?)<\/QUESTIONS>/i);
  if (!m) return null;
  const qs = [];
  let cur = null;
  for (const line of m[1].split("\n").map((s) => s.trim()).filter(Boolean)) {
    if (/^Q\s*[:：]/i.test(line)) {
      cur = { q: line.replace(/^Q\s*[:：]\s*/i, "").slice(0, 120), options: [] };
      qs.push(cur);
    } else if (/^[-•*]/.test(line) && cur) {
      const opt = line.replace(/^[-•*]\s*/, "").slice(0, 64);
      if (opt) cur.options.push(opt);
    }
  }
  const valid = qs
    .filter((q) => q.q && q.options.length >= 2)
    .slice(0, 2)
    .map((q) => ({ q: q.q, options: q.options.slice(0, 4) }));
  return valid.length ? valid : null;
}
