import { readFileSync } from "node:fs";
import { scanCliches } from "../../supabase/functions/_shared/ai-cliches.ts";
const d = JSON.parse(readFileSync(new URL("../../public/research/chatgpt-vs-a-measured-voice.json", import.meta.url), "utf8"));
for (const [i, r] of d.runs.entries()) {
  for (const arm of ["bare", "prompt", "scriptgrain"]) {
    const s = scanCliches(r.arms[arm].draft);
    console.log(`run${i} ${arm}: per1000=${s.per1000} words=${s.words}`);
    for (const h of s.phrases) console.log(`   phrase "${h.phrase}" x${h.count}: ${h.excerpts[0]?.slice(0, 100)}`);
    for (const p of s.patterns) if (p.excerpts.length) console.log(`   ${p.id} x${p.count}: ${p.excerpts[0]?.slice(0, 110)}`);
  }
  console.log("  vm deltas scriptgrain:", r.arms.scriptgrain.voice_match_top_deltas.join(" | "));
  console.log("  vm deltas prompt:", r.arms.prompt.voice_match_top_deltas.join(" | "));
}
