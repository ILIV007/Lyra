// ─── Manual Bank Prompts ─────────────────────────────────────────────
// To add a new prompt, paste this template inside the BANK_PRESETS array
// (between existing entries, separated by comma):
//
//   {
//     id: 'your_prompt_id',       // unique lowercase-with-dashes
//     title: '✨ Your Prompt Name', // shown in the bank menu button
//     prompt: `Your complete prompt text here.
// It can span multiple lines.
// Use [brackets] for placeholders the user should fill.`
//   },
//
// After editing, run: npx wrangler deploy

export const BANK_PRESETS = [
  {
    id: 'stable_face',
    title: '🧑‍🦰 Stable Face',
    prompt: `Create a portrait of [subject description] with strict facial consistency. Use seed: [seed_number]. Apply the following face preservation parameters: --fix-face --face-restore --codeformer-weight 0.8 --face-denoising-strength 0.3. Maintain identical facial structure across all variations. Key facial features to preserve: eye shape, nose bridge width, lip curvature, jawline definition, cheekbone structure. Negative prompt: asymmetric face, merged facial features, floating face, distorted face, mismatched eyes, face swap artifacts, identity break, face morphing, inconsistent features. Style: photorealistic, 8K, sharp focus.`
  }
];
