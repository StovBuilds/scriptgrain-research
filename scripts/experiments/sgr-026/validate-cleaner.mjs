#!/usr/bin/env bun
// SGR-026 cleaner validation: how close is our wikitext -> plain prose cleaner to Wikipedia's own plain-text
// rendering (the TextExtracts extension, action=query&prop=extracts&explaintext)? Run on the CURRENT revision of
// articles already sampled by collect.mjs (a hash picks N of them), never on the corpus text. Pre-registration section 3.
//
//   bun scripts/experiments/sgr-026/validate-cleaner.mjs [--n 100] [--dir ~/research/sgr-026]
//
// Writes <dir>/cleaner-validation.json and prints it. Pass criteria (fixed in the pre-registration):
//   median ratio of our word count to the rendered word count between 0.90 and 1.10, and
//   at least 80% of articles with a ratio between 0.75 and 1.25.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { wikitextToPlain, countWords, DROP_SECTIONS, measurePage } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = opt("--dir", `${homedir()}/research/sgr-026`).replace(/^~/, homedir());
const N = Number(opt("--n", 100));
const UA = "ScriptGrain research (support@scriptgrain.com) - cleaner validation";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const items = [];
for (const f of readdirSync(`${DIR}/index`).filter((x) => x.endsWith(".json")).sort()) for (const it of JSON.parse(readFileSync(`${DIR}/index/${f}`, "utf8")).items) items.push(it.pageid);
const h = (id) => createHash("sha1").update(`cleaner|${id}`).digest("hex");
const pick = items.sort((a, b) => (h(a) < h(b) ? -1 : 1)).slice(0, N);

/** The rendered extract, with headings dropped and non-prose sections removed the same way as our cleaner. */
function extractProse(ex) {
  const out = []; let skip = 0;
  for (const raw of ex.split("\n")) {
    const hm = /^\s*(={2,6})\s*(.*?)\s*\1\s*$/.exec(raw);
    if (hm) { const lvl = hm[1].length; if (skip && lvl <= skip) skip = 0; if (!skip && DROP_SECTIONS.test(hm[2].trim())) skip = lvl; continue; }
    if (!skip && raw.trim()) out.push(raw.trim());
  }
  return out.join("\n");
}
let last = 0;
async function api(params) {
  for (let t = 0; t < 6; t++) {
    const gap = Date.now() - last; if (gap < 400) await sleep(400 - gap);
    last = Date.now();
    const u = new URL("https://en.wikipedia.org/w/api.php");
    for (const [k, v] of Object.entries({ format: "json", formatversion: 2, maxlag: 5, ...params })) u.searchParams.set(k, v);
    const res = await fetch(u, { headers: { "user-agent": UA } });
    if (res.status === 200) { const j = await res.json(); if (j.error?.code === "maxlag") { await sleep(5000); continue; } if (j.error) throw new Error(j.error.info); return j; }
    await sleep(3000 * (t + 1));
  }
  throw new Error("api gave up");
}
const rows = [];
for (let i = 0; i < pick.length; i += 1) { // full-text extracts come one page per request (exlimit above 1 needs exintro)
  const j = await api({ action: "query", pageids: pick[i], prop: "extracts|revisions", explaintext: 1, exlimit: 1, rvprop: "content", rvslots: "main" });
  for (const p of j.query.pages) {
    const src = p.revisions?.[0]?.slots?.main?.content, ex = p.extract;
    if (!src || !ex) continue;
    const ours = wikitextToPlain(src), theirs = extractProse(ex);
    const a = countWords(ours), b = countWords(theirs);
    if (b < 100) continue; // too short to compare
    rows.push({ pageid: p.pageid, ours: a, rendered: b, ratio: a / b, ai_ours: a >= 20 ? measurePage(ours, a).ai_ism_per1000 : null, ai_rendered: measurePage(theirs, b).ai_ism_per1000 });
  }
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const ratios = rows.map((r) => r.ratio);
const med = q(ratios, 0.5), within = ratios.filter((r) => r >= 0.75 && r <= 1.25).length / ratios.length;
const both = rows.filter((r) => r.ai_ours != null);
const meanAbsDiffAI = both.reduce((s, r) => s + Math.abs(r.ai_ours - r.ai_rendered), 0) / (both.length || 1);
const out = { n: rows.length, median_ratio: +med.toFixed(3), p10_ratio: +q(ratios, 0.1).toFixed(3), p90_ratio: +q(ratios, 0.9).toFixed(3), share_within_25pct: +within.toFixed(3), mean_abs_diff_ai_ism_per1000: +meanAbsDiffAI.toFixed(3),
  pass: med >= 0.9 && med <= 1.1 && within >= 0.8, criteria: "median ratio 0.90-1.10 and at least 80% of articles within 0.75-1.25", ranAt: new Date().toISOString() };
writeFileSync(`${DIR}/cleaner-validation.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
process.exit(out.pass ? 0 : 1);
