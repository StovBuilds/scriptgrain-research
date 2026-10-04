#!/usr/bin/env bun
// SGR-004 step 1: fetch one Wayback Machine snapshot per site per year.
//
//   bun scripts/experiments/sgr-004/crawl.mjs --cache <dir>
//
// For each site in panel.json and each year 2000 to 2026, the homepage is
// requested at 1 July of that year in raw form (the id_ form, no Wayback
// toolbar). Wayback redirects to the nearest capture; it counts only if that
// capture falls in the same calendar year. Raw HTML
// goes to a TEMPORARY cache so measure.mjs can be re-run without re-crawling;
// the cache is deleted once the study is published and is never committed.
// Resumable: anything already cached is skipped. Polite: 2 requests in flight with a
// 2.5 s pause each (1 s drew 429s two-thirds of the way through), 90 s pause on 429, backoff on 5xx.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CACHE = opt("--cache", null);
if (!CACHE) throw new Error("--cache <dir> required");
mkdirSync(CACHE, { recursive: true });
const { sites } = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));
const UA = "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research; SGR-004, measured not stored)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);

// Redirects are followed by hand: Bun's fetch rejects some of Wayback's
// Location headers (UnsupportedRedirectProtocol), and a 429 means slow down
// for a full minute, not retry at once.
async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      let cur = url;
      for (let hop = 0; hop < 10; hop++) {
        const r = await fetch(cur, { headers: { "User-Agent": UA }, redirect: "manual", signal: AbortSignal.timeout(45000) });
        if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
          await r.arrayBuffer().catch(() => {});
          cur = new URL(r.headers.get("location"), cur).href.replace(/^http:\/\/web\.archive\.org/, "https://web.archive.org");
          continue;
        }
        if (r.status === 429) { log(`429, waiting 90s`); await sleep(90000); break; }
        if (r.status >= 500) { await sleep(2 ** i * 4000); break; }
        return { status: r.status, url: cur, body: r.ok ? await r.text() : "" };
      }
    } catch (e) {
      // A capture stored with broken compression fails the same way every
      // time; record it rather than spend a minute and a half retrying.
      if (/zlib|decompress/i.test(String(e?.message ?? e))) return { status: -1, url, body: "" };
      await sleep(2 ** i * 3000);
    }
  }
  return { status: 0, url, body: "" };
}

const jobs = [];
for (const s of sites) for (let year = 2000; year <= 2026; year++) jobs.push({ ...s, year });
log(`${jobs.length} site-years to fetch`);

let done = 0;
async function worker() {
  while (jobs.length) {
    const j = jobs.shift();
    const f = `${CACHE}/${j.domain}.${j.year}.html`;
    if (existsSync(f) || existsSync(f + ".fail")) { done++; continue; }
    // Wayback redirects a dated request to the nearest capture; keep it only if
    // that capture falls in the target year, and record its real timestamp.
    const r = await get(`https://web.archive.org/web/${j.year}0701000000id_/http://${j.domain}/`);
    const ts = (r.url.match(/\/web\/(\d{14})/) || [])[1] || "";
    if (r.body && ts.startsWith(String(j.year))) writeFileSync(f, `<!-- sgr004 ts=${ts} final=${r.url} -->\n` + r.body);
    else writeFileSync(f + ".fail", `${r.status} ${ts}`);
    if (++done % 50 === 0) log(`${done} fetched`);
    await sleep(2500);
  }
}
await Promise.all(Array.from({ length: +opt("--workers", "2") }, worker));
log("done");
