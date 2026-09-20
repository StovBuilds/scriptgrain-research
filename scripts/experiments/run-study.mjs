#!/usr/bin/env bun
// "AI changed my voice" study runner (docs/plans/voice-brain-and-content-plan.md C3).
//
//   bun scripts/experiments/run-study.mjs --profile <id> --model gpt-5 --held-out 2 --slug chatgpt-vs-a-measured-voice
//
// Protocol: take an author's samples from an existing ScriptGrain profile,
// hold N pieces out, build a fresh study profile from the rest (api-v1, one
// extraction slot), derive one brief per held-out piece, then run each brief
// through the arms and measure every draft with the product's instruments:
//   bare      the model with the brief only
//   prompt    the model with the prompt builder's system prompt (measured from the training samples)
//   scriptgrain  api-v1 generation against the study profile
// Measures: voice match vs the study profile, pairwise match vs the held-out
// piece (compare-voice), AI-tell density (the cliché scanner), AI-detect.
// Writes public/research/<slug>.json (all drafts + numbers) and prints a
// summary. The research page entry is written separately from that file.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { scanCliches } from "../../supabase/functions/_shared/ai-cliches.ts";
import { buildVoicePrompt } from "../../src/lib/prompt-builder.ts";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PROFILE = opt("--profile"); const MODEL = opt("--model", "gpt-5"); const HELD = Number(opt("--held-out", 2)); const SLUG = opt("--slug", "study");
const REUSE = opt("--study-profile"); // reuse an already-built study profile (saves an extraction slot on re-runs)
if (!PROFILE) { console.error("--profile required"); process.exit(1); }

function env(name) {
  const line = readFileSync(`${homedir()}/.bot-infra.env`, "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing`);
  return line.slice(name.length + 1).replace(/^['"]|['"]$/g, "");
}
const SB = env("SCRIPTGRAIN_SUPABASE_NEW_URL").replace(/\/$/, "");
const SECRET = env("SCRIPTGRAIN_SUPABASE_NEW_SECRET_KEY");
const API_KEY = env("SCRIPTGRAIN_API_KEY");
const OPENAI = env("OPENAI_API_KEY");
const API = `${SB}/functions/v1/api-v1`;
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } });
  if (!r.ok) throw new Error(`rest ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`api ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data ?? j;
}
async function openai(system, user, maxTokens = 8000) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
    // gpt-5 spends completion tokens on reasoning first; keep that minimal
    // so the budget goes on the article, and fail loudly on an empty draft.
    body: JSON.stringify({ model: MODEL, messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }], max_completion_tokens: maxTokens, ...(MODEL.startsWith("gpt-5") ? { reasoning_effort: "minimal" } : {}) }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`openai: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  const text = (j.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error(`openai returned an empty draft (finish_reason ${j.choices?.[0]?.finish_reason})`);
  return text;
}
// Strip scraped chrome (nav links, "Back to blog", markdown link lines) so the
// held-out piece is the prose, not the page furniture.
function cleanSample(t) {
  return t.split("\n").filter((l) => !/^\s*\[.*\]\(.*\)\s*$/.test(l) && !/^\s*#\s*$/.test(l) && !/^(Growth|Product|Opinion) · \d/.test(l.trim())).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const profile = (await rest(`profiles?id=eq.${PROFILE}&select=id,name,user_id`))[0];
const samples = (await rest(`samples?profile_id=eq.${PROFILE}&select=id,raw_text,word_count&order=word_count.desc`)).map((s) => ({ ...s, text: cleanSample(s.raw_text) }));
console.error(`profile ${profile.name}: ${samples.length} samples, ${samples.reduce((a, s) => a + words(s.text), 0)} words`);
const heldOut = samples.slice(0, HELD);
const training = samples.slice(HELD);
if (training.length < 1) throw new Error("not enough training samples");
console.error(`held out ${heldOut.length} (${heldOut.map((s) => words(s.text)).join(", ")} words); training ${training.length} (${training.map((s) => words(s.text)).join(", ")})`);

// 1. Study profile from the training samples.
let studyProfileId = REUSE;
if (!studyProfileId) {
  const created = await api("POST", "/v1/profiles", { name: `Study ${SLUG} (${new Date().toISOString().slice(0, 10)})`, samples: training.map((s) => s.text) });
  studyProfileId = created.profile_id ?? created.id ?? created.profile?.id;
}
console.error(`study profile ${studyProfileId}: waiting for extraction`);
for (let i = 0; i < 90; i++) {
  await sleep(10000);
  const p = await api("GET", `/v1/profiles/${studyProfileId}`);
  const status = p.status ?? p.profile?.status;
  process.stderr.write(`  ${status} ${p.extractionProgressPercent ?? ""}\n`);
  if (status === "complete") break;
  if (status === "failed") throw new Error("extraction failed");
}

// 2. Prompt-builder arm: measure the training corpus once (public fingerprint action).
const trainingText = training.map((s) => s.text).join("\n\n").split(/\s+/).slice(0, 3400).join(" ");
const fpRes = await fetch(`${SB}/functions/v1/public-voice-check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fingerprint", text: trainingText, source: "prompt-builder", label: "study" }) });
const fp = await fpRes.json();
if (!fp.measured) throw new Error(`fingerprint failed: ${JSON.stringify(fp).slice(0, 200)}`);
const systemPrompt = buildVoicePrompt({ measured: fp.measured, judged: fp.judged, burstiness: fp.burstiness, cliches: fp.cliches }, MODEL.startsWith("gpt") ? "chatgpt" : "generic");

// 3. Briefs from the held-out pieces (a neutral, cheap model; never quotes the piece).
const briefs = [];
for (const s of heldOut) {
  const brief = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
    body: JSON.stringify({ model: "gpt-5-mini", messages: [{ role: "user", content: `Read this article and write the BRIEF a writer would have been given to produce it: topic, angle, audience, three key points, and a target length of about ${words(s.text)} words. Do not quote the article. Plain text, under 120 words.\n\n<article>\n${s.text}\n</article>` }], max_completion_tokens: 600 }),
  }).then((r) => r.json()).then((j) => j.choices[0].message.content.trim());
  briefs.push({ sampleId: s.id, target: words(s.text), heldOut: s.text, brief });
  process.stderr.write(`brief: ${brief.slice(0, 80)}...\n`);
}

// 4. Arms + measures.
async function measure(draft, heldOutText) {
  const vm = await api("POST", "/v1/voice-match", { profile_id: studyProfileId, text: draft });
  const cv = await api("POST", "/v1/compare-voice", { main: { text: heldOutText, label: "held-out" }, others: [{ text: draft, label: "draft" }] });
  const det = await api("POST", "/v1/ai-detect", { text: draft });
  const scan = scanCliches(draft);
  return {
    words: words(draft),
    voice_match: vm.voice_match_score,
    voice_match_top_deltas: (vm.deltas ?? []).filter((d) => d.similarity <= 0.5).sort((a, b) => b.weight * (1 - b.similarity) - a.weight * (1 - a.similarity)).slice(0, 3).map((d) => d.detail),
    pairwise: cv.results?.[0]?.score ?? null,
    pairwise_band: cv.results?.[0]?.band ?? null,
    cliches_per_1000: scan.per1000,
    cliche_band: scan.band,
    em_dashes: scan.patterns.find((p) => p.id === "em_dash")?.count ?? 0,
    short_sentence_share: scan.burstiness.shortShare,
    sentence_variation: scan.burstiness.variation,
    human_score: det.human_score ?? det.humanScore ?? null,
  };
}
const runs = [];
for (const b of briefs) {
  const bareDraft = await openai(null, `Write an article of about ${b.target} words from this brief. Return only the article.\n\n${b.brief}`);
  const promptDraft = await openai(systemPrompt, `Write an article of about ${b.target} words from this brief. Return only the article.\n\n${b.brief}`);
  const sg = await api("POST", "/v1/generations", { profile_id: studyProfileId, brief: b.brief, content_type: "article", word_count_target: b.target });
  const sgDraft = sg.variants?.[0]?.content ?? sg.content ?? sg.output ?? "";
  if (!sgDraft) throw new Error(`scriptgrain draft missing: ${JSON.stringify(sg).slice(0, 300)}`);
  const arms = {};
  for (const [name, draft] of [["bare", bareDraft], ["prompt", promptDraft], ["scriptgrain", sgDraft]]) {
    arms[name] = { draft, ...(await measure(draft, b.heldOut)) };
    process.stderr.write(`  ${name}: vm ${arms[name].voice_match} pair ${arms[name].pairwise} cliche ${arms[name].cliches_per_1000} human ${arms[name].human_score}\n`);
  }
  const heldOutMeasures = { cliches_per_1000: scanCliches(b.heldOut).per1000, short_sentence_share: scanCliches(b.heldOut).burstiness.shortShare, sentence_variation: scanCliches(b.heldOut).burstiness.variation, words: words(b.heldOut) };
  runs.push({ brief: b.brief, target: b.target, held_out: heldOutMeasures, arms });
}

const mean = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000 : null);
const summary = {};
for (const arm of ["bare", "prompt", "scriptgrain"]) {
  const get = (k) => runs.map((r) => r.arms[arm][k]).filter((v) => typeof v === "number");
  summary[arm] = { voice_match: mean(get("voice_match")), pairwise: mean(get("pairwise")), cliches_per_1000: mean(get("cliches_per_1000")), em_dashes: mean(get("em_dashes")), short_sentence_share: mean(get("short_sentence_share")), sentence_variation: mean(get("sentence_variation")), human_score: mean(get("human_score")), words: mean(get("words")) };
}
const out = {
  slug: SLUG, model: MODEL, conducted_on: new Date().toISOString().slice(0, 10),
  source_profile: { id: PROFILE, name: profile.name, samples: samples.length, words: samples.reduce((a, s) => a + words(s.text), 0) },
  study_profile_id: studyProfileId,
  held_out: heldOut.map((s) => ({ id: s.id, words: words(s.text) })),
  training: training.map((s) => ({ id: s.id, words: words(s.text) })),
  system_prompt: systemPrompt,
  runs, summary,
};
writeFileSync(new URL(`../../public/research/${SLUG}.json`, import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
