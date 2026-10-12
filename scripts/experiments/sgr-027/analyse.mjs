#!/usr/bin/env bun
// SGR-027 step 3: test H1-H4 and the exploratory measures (preregistration §5-6).
//   bun scripts/experiments/sgr-027/analyse.mjs   -> out/analysis.json + summary on stdout
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "scripts/experiments/sgr-027";
const R = JSON.parse(readFileSync(`${DIR}/out/results.json`, "utf8"));
const SEED = 20261012, B = 10_000;
// mulberry32: small, seeded, reproducible
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const r3 = (x) => Math.round(x * 1000) / 1000;
function boot(diffs) {
  const rand = rng(SEED), n = diffs.length, ms = new Array(B);
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += diffs[Math.floor(rand() * n)]; ms[b] = s / n; }
  ms.sort((x, y) => x - y);
  return { mean: r3(mean(diffs)), lo: r3(ms[Math.floor(0.025 * B)]), hi: r3(ms[Math.ceil(0.975 * B) - 1]), n };
}
const paired = (key, rows = R) => {
  const ok = rows.filter((r) => r.before[key] != null && r.after[key] != null);
  return { before: r3(mean(ok.map((r) => r.before[key]))), after: r3(mean(ok.map((r) => r.after[key]))), change: boot(ok.map((r) => r.after[key] - r.before[key])) };
};

const H1 = paired("human_score"), H2 = paired("tells_per1000"), H3 = paired("voice_match");
const clean = R.filter((r) => !r.content.numbers_lost.length && !r.content.numbers_added.length && !r.content.invented_first_person.length).length;
const hyp = {
  H1: { ...H1, holds: H1.change.lo > 0 },
  H2: { ...H2, holds: H2.change.hi < 0 },
  H3: { ...H3, holds: H3.change.lo >= -0.05 && H3.change.hi <= 0.05 },
  H4: { clean_pairs: clean, of: R.length, holds: clean >= 18 },
};
const FEAT = ["words", "contractions_per1000", "avg_sentence_length", "sentence_length_variance", "comma_density", "em_dashes_per1000"];
const explore = {
  features: Object.fromEntries(FEAT.map((k) => [k, paired(k)])),
  by_generator: Object.fromEntries(["claude", "gpt"].map((g) => [g, Object.fromEntries(["human_score", "tells_per1000", "voice_match"].map((k) => [k, paired(k, R.filter((r) => r.generator === g))]))])),
  by_format: Object.fromEntries([...new Set(R.map((r) => r.format))].map((f) => [f, Object.fromEntries(["human_score", "voice_match"].map((k) => [k, paired(k, R.filter((r) => r.format === f))]))])),
  would_skip_by_default: R.filter((r) => r.humanizer.would_skip_by_default).length,
  reached_target: R.filter((r) => r.humanizer.reached_target).length,
  passes_run: R.reduce((s, r) => s + (r.humanizer.iterations_run ?? 0), 0),
  passes_discarded: R.reduce((s, r) => s + (r.humanizer.discarded_passes ?? 0), 0),
  content_words_kept: r3(mean(R.map((r) => r.content.content_words_kept))),
};
// §6 showcase: largest, median, smallest detector gain; largest voice-match rise and fall
const byGain = [...R].sort((a, b) => (b.after.human_score - b.before.human_score) - (a.after.human_score - a.before.human_score));
const byVm = [...R].sort((a, b) => (b.after.voice_match - b.before.voice_match) - (a.after.voice_match - a.before.voice_match));
const showcase = [...new Set([byGain[0].id, byGain[Math.floor(byGain.length / 2)].id, byGain.at(-1).id, byVm[0].id, byVm.at(-1).id])];
const out = { n: R.length, seed: SEED, resamples: B, hypotheses: hyp, exploratory: explore, showcase };
writeFileSync(`${DIR}/out/analysis.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.hypotheses, null, 1));
console.log("skip-by-default", explore.would_skip_by_default, "reached target", explore.reached_target, "discarded", explore.passes_discarded, "/", explore.passes_run, "showcase", showcase.join(","));
