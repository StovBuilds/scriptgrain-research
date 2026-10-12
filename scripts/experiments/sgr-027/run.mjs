#!/usr/bin/env bun
// SGR-027 step 2: humanise each passage and measure both texts
// (docs/research/sgr-027-preregistration.md §3-4). Run on D-1 of publication.
//   bun scripts/experiments/sgr-027/run.mjs            # the 20 corpus passages
//   bun scripts/experiments/sgr-027/run.mjs --pilot    # one passage outside the corpus (pipeline check only)
// Calls api-v1 with SCRIPTGRAIN_API_KEY (humanize bills ScriptGrain's model key; Jack's go
// 2026-10-12). Resumable: passages already in the output file are skipped.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";
import { inventedFirstPerson, contentWords } from "../../../supabase/functions/_shared/polish-integrity.ts";
import { numberTokens } from "./numbers.mjs";

const DIR = "scripts/experiments/sgr-027";
const PILOT = process.argv.includes("--pilot");
const PROFILE = "853dd07f-8657-4bf8-a2b0-3f84e147d6f4"; // ScriptGrain Brand, fixed in §4
function env(name) {
  const line = readFileSync(`${homedir()}/.bot-infra.env`, "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing`);
  return line.slice(name.length + 1).replace(/^['"]|['"]$/g, "");
}
const API = `${env("SCRIPTGRAIN_SUPABASE_NEW_URL").replace(/\/$/, "")}/functions/v1/api-v1`;
const KEY = env("SCRIPTGRAIN_API_KEY");
async function api(path, body) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j.data ?? j;
    if (attempt >= 3 || r.status < 500) throw new Error(`${path} ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    await new Promise((res) => setTimeout(res, 5000 * attempt));
  }
}
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const emDashes = (t) => (t.match(new RegExp(String.fromCharCode(0x2014), "g")) ?? []).length;

async function measure(text) {
  const f = measureTextFeatures(text);
  const c = scanCliches(text);
  const det = await api("/v1/ai-detect", { text });
  const vm = await api("/v1/voice-match", { profile_id: PROFILE, text });
  const w = words(text);
  return {
    words: w,
    human_score: r3(det.human_score),
    tells_per1000: r3(c.per1000),
    contractions_per1000: r3(f.contraction_frequency),
    avg_sentence_length: r3(f.avg_sentence_length),
    sentence_length_variance: r3(f.sentence_length_variance),
    comma_density: r3(f.comma_density),
    em_dashes_per1000: r3((emDashes(text) / w) * 1000),
    voice_match: r3(vm.voice_match_score),
  };
}

function contentKept(src, out) {
  const a = numberTokens(src), b = numberTokens(out);
  const vocab = new Set(contentWords(out));
  const sw = [...new Set(contentWords(src))];
  return {
    numbers_lost: [...a].filter((n) => !b.has(n)),
    numbers_added: [...b].filter((n) => !a.has(n)),
    invented_first_person: inventedFirstPerson(src, out),
    content_words_kept: r3(sw.length ? sw.filter((w) => vocab.has(w)).length / sw.length : 1),
  };
}

const passages = PILOT
  ? [JSON.parse(readFileSync(`${DIR}/pilot-passage.json`, "utf8"))]
  : JSON.parse(readFileSync(`${DIR}/out/passages.json`, "utf8"));
const OUT = PILOT ? `${DIR}/out/pilot.json` : `${DIR}/out/results.json`;
const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
for (const p of passages) {
  if (results.some((r) => r.id === p.id)) continue;
  const before = await measure(p.text);
  const h = await api("/v1/humanize", { text: p.text, force: true });
  const after_text = (h.final_text ?? h.text ?? "").trim();
  if (!after_text) throw new Error(`${p.id}: humanize returned no text ${JSON.stringify(h).slice(0, 300)}`);
  const after = await measure(after_text);
  const rec = {
    id: p.id, format: p.format, topic: p.topic, generator: p.generator, model: p.model,
    original: p.text, humanised: after_text,
    humanizer: {
      initial_score: h.initial_score ?? null, final_score: h.final_score ?? null,
      reached_target: h.reached_target ?? null, iterations_run: h.iterations_run ?? null,
      discarded_passes: (h.iterations ?? []).filter((it) => it.score == null).length,
      would_skip_by_default: typeof h.initial_score === "number" ? h.initial_score >= 0.85 : null,
    },
    before, after, content: contentKept(p.text, after_text),
    measuredAt: new Date().toISOString(),
  };
  results.push(rec);
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(`${p.id} human ${before.human_score}->${after.human_score} tells ${before.tells_per1000}->${after.tells_per1000} vm ${before.voice_match}->${after.voice_match}`);
}
