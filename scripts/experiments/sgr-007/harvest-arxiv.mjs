#!/usr/bin/env bun
// SGR-007: the scientific-abstracts group, from SGR-008's arXiv census (read-only,
// by agreement with that lane, 2026-10-04).
//
//   bun scripts/experiments/sgr-007/harvest-arxiv.mjs --census ~/research/sgr-008 --out <arxiv.jsonl> [--n 10000]
//
// Eligible: census-papers.jsonl.gz rows with base_ok (no version after
// 2022-11-30) and ym from 2015-01 to 2022-11. A seeded random sample is drawn
// and each abstract's text, taken from the FIRST record for its id in
// census/part-*.jsonl.gz, is cleaned of LaTeX with SGR-008's clean() and
// measured with instruments.mjs like every other group. Numbers only.
// Also writes the full-census share of papers containing each OLD word, from
// the census `toks` (presence, not counts), for the page's second view.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gunzipSync, createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { measure } from "./instruments.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = opt("--census", null), OUT = opt("--out", null), N = +opt("--n", "10000");
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const LEX = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));
const jsonl = (f) => gunzipSync(readFileSync(f)).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

// SGR-008's clean() (scripts/experiments/sgr-008/measure.mjs), unchanged.
const clean = (s) => s
  .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " X ")
  .replace(/\\(?:cite|ref|label)\{[^}]*\}/g, " ")
  .replace(/\\[a-zA-Z]+\*?(\{[^}]*\})?/g, (m, g) => (g ? g.slice(1, -1) : " "))
  .replace(/---/g, "—").replace(/--/g, "–")
  .replace(/[{}~]/g, " ").replace(/\s+/g, " ").trim();

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Streamed: the census is ~2 million rows. `toks` is a space-separated string of
// unique lowercase tokens, so presence is a whole-token test, never a substring.
const eligible = [];
const hasWord = Object.fromEntries(LEX.OLD.map((w) => [w, 0]));
let anyOldN = 0;
const rl = createInterface({ input: createReadStream(`${DIR}/census-papers.jsonl.gz`).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  const p = JSON.parse(line);
  if (!p.base_ok || p.ym < "2015-01" || p.ym > "2022-11") continue;
  eligible.push({ id: p.id, ym: p.ym, pilot: !!p.pilot });
  const toks = new Set((p.toks || "").split(" "));
  let any = false;
  for (const w of LEX.OLD) if (toks.has(w)) { hasWord[w]++; any = true; }
  if (any) anyOldN++;
}
const presence = Object.fromEntries(Object.entries(hasWord).map(([w, c]) => [w, c / eligible.length]));
const anyOld = anyOldN / eligible.length;
writeFileSync(OUT.replace(/\.jsonl$/, "-presence.json"), JSON.stringify({ eligible: eligible.length, share_with_any_old: anyOld, share_by_word: presence }, null, 1));

const r = rng(CFG.seed);
const pool = [...eligible];
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
const want = new Map(pool.slice(0, N).map((p) => [p.id, p]));
const text = new Map();
for (const f of readdirSync(`${DIR}/census`).filter((f) => /^part-.*\.jsonl\.gz$/.test(f)).sort()) {
  for (const rec of jsonl(`${DIR}/census/${f}`)) if (want.has(rec.id) && !text.has(rec.id)) text.set(rec.id, rec.abstract);
  if (text.size === want.size) break;
}
const out = [];
for (const [id, p] of want) {
  const raw = text.get(id);
  const base = { group: "arxiv", source: "arxiv.org", book: id, captured: p.ym, pilot: !!p.pilot };
  if (!raw) { out.push({ ...base, status: "no_text" }); continue; }
  const t = clean(raw);
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < 50) { out.push({ ...base, status: "too_short", words }); continue; }
  out.push({ ...base, status: "measured", ...measure(t, words) });
}
writeFileSync(OUT, out.map((x) => JSON.stringify(x)).join("\n") + "\n");
console.error(`eligible ${eligible.length}; sampled ${want.size}; measured ${out.filter((x) => x.status === "measured").length}; any-OLD share (full census) ${(anyOld * 100).toFixed(2)}%`);
