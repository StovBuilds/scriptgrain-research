#!/usr/bin/env bun
// SGR-007: sample and measure the web sources in sources.json from Common Crawl.
//
//   bun scripts/experiments/sgr-007/harvest-web.mjs --cluster <cluster.idx> --out <rows.jsonl> [--only group]
//
// Per source: captures under the prefix (status 200, HTML, English, one per URL,
// excluded URL patterns removed), shuffled with the frozen seed, read in order
// until pages_per_source pass the article extractor at min_words. Each page is
// measured at once (instruments.mjs) and only numbers are appended. Resumable:
// sources already complete in the output are skipped.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { loadCluster, capturesFor, fetchRecord } from "./cc-index.mjs";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
import { measure } from "./instruments.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const OUT = opt("--out", null), ONLY = opt("--only", null);
const cluster = loadCluster(opt("--cluster", null));
const EXCL = new RegExp(CFG.exclude_url_patterns.join("|"), "i");
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);

// Seeded shuffle (mulberry32), so the page order is fixed by the frozen seed.
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, seed) => { const r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const done = new Map();
if (existsSync(OUT)) for (const l of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); done.set(r.source, (done.get(r.source) || 0) + (r.status === "measured" ? 1 : 0)); }

const jobs = [];
for (const [group, prefixes] of Object.entries(CFG.web_groups)) if (!ONLY || ONLY === group) for (const p of prefixes) jobs.push({ group, prefix: p });

async function runSource({ group, prefix }) {
  const want = CFG.pages_per_source;
  if ((done.get(prefix) || 0) >= want) { log(`${prefix} already complete`); return; }
  const caps = await capturesFor(CFG.collection, cluster, prefix, { maxBlocks: 80 });
  const seen = new Set();
  const pool = caps.filter((r) => r.status === "200" && (r.mime === "text/html" || r["mime-detected"] === "text/html") && (!r.languages || r.languages.startsWith("eng")) && !EXCL.test(r.url) && !seen.has(r.url) && seen.add(r.url));
  shuffle(pool, CFG.seed);
  let got = done.get(prefix) || 0, tried = 0;
  for (const r of pool) {
    if (got >= want) break;
    tried++;
    const html = await fetchRecord(r);
    const page = htmlToText(html || "");
    const base = { group, source: prefix, url: r.url, captured: r.timestamp };
    if (page.words < CFG.min_words) { appendFileSync(OUT, JSON.stringify({ ...base, status: "too_short", words: page.words }) + "\n"); continue; }
    appendFileSync(OUT, JSON.stringify({ ...base, status: "measured", ...measure(page.text, page.words) }) + "\n");
    got++;
  }
  log(`${prefix}: ${got} measured of ${tried} tried (pool ${pool.length})`);
}

const queue = [...jobs];
await Promise.all(Array.from({ length: +opt("--workers", "6") }, async () => { while (queue.length) await runSource(queue.shift()); }));
log("done");
