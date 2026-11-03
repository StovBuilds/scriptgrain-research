#!/usr/bin/env bun
// SGR-025 collection: fetch each panel site's CURRENT homepage once through Firecrawl
// (same call as SGR-004's render.mjs: rawHtml, JavaScript run, waitFor 2000, nothing excluded because
// there is no archive toolbar), plus two checks.
//
//   bun scripts/experiments/sgr-025/collect.mjs [--pilot] [--only a.com,b.com] [--retry-failed]   live fetch  -> ~/research/sgr-025/live
//   bun scripts/experiments/sgr-025/collect.mjs --repeat                                         second fetch of the 16 repeat sites -> live-repeat
//   bun scripts/experiments/sgr-025/collect.mjs --wayback-verify                                 SGR-004's 2026 capture of the 8 pilot sites -> wayback
//
// Resumable (a file that exists is skipped). Every call logs the team's credit balance before and after
// to ~/research/sgr-025/credits.jsonl, and stops if the balance would fall below FLOOR (10,000) or this
// study's spend passes BUDGET (500). Text is stored only under ~/research and never committed.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { gzipSync } from "node:zlib";
import { DEF, PANEL, hasPage, hasFail, pilotDomains, repeatDomains } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const ROOT = `${homedir()}/research/sgr-025`;
const MODE = args.includes("--wayback-verify") ? "wayback" : args.includes("--repeat") ? "live-repeat" : "live";
const OUT = `${ROOT}/${MODE}${opt("--suffix", "")}`;
mkdirSync(OUT, { recursive: true });
const FLOOR = 10000, BUDGET = 500;
const line = readFileSync(`${homedir()}/.bot-infra.env`, "utf8").split("\n").find((l) => l.startsWith("FIRECRAWL_API_KEY="));
const KEY = line.slice("FIRECRAWL_API_KEY=".length).replace(/^['"]|['"]$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);

async function balance(tag) {
  const r = await fetch("https://api.firecrawl.dev/v2/team/credit-usage", { headers: { Authorization: `Bearer ${KEY}` } });
  const d = (await r.json()).data;
  appendFileSync(`${ROOT}/credits.jsonl`, JSON.stringify({ at: new Date().toISOString(), mode: MODE, tag, remaining: d.remainingCredits }) + "\n");
  return d.remainingCredits;
}

const rows2026 = JSON.parse(readFileSync("public/research/sgr-004-web-copy-rows.json", "utf8")).filter((r) => r.year === 2026);
let domains = PANEL.map((s) => s.domain);
if (MODE === "live-repeat") domains = repeatDomains();
if (MODE === "wayback" || args.includes("--pilot")) domains = pilotDomains(rows2026);
if (opt("--only")) domains = opt("--only").split(",");

const HOLD = /Got an HTTP 30\d response at crawl time/;
const impatient = (h) => { const m = h.match(/<p class="impatient"><a href="([^"]+)"/); return m ? m[1].replace(/&amp;/g, "&") : null; };

async function scrape(url, wayback) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, waitFor: 2000, timeout: 60000, maxAge: 0, ...(wayback ? { excludeTags: ["#wm-ipp-base", "#wm-ipp", "#donato", "#wm-ipp-print"] } : {}) }),
        signal: AbortSignal.timeout(90000),
      });
      if (r.status === 429) { await sleep(20000); continue; }
      const d = await r.json().catch(() => ({}));
      if (d.success && d.data?.rawHtml) return { ok: true, html: d.data.rawHtml, final: d.data.metadata?.url || url, status: d.data.metadata?.statusCode ?? null };
      if (r.status < 500) return { ok: false, why: `${r.status} ${d.error ?? ""}`.slice(0, 200) };
      await sleep(5000 * (i + 1));
    } catch (e) { await sleep(5000 * (i + 1)); }
  }
  return { ok: false, why: "gave up" };
}

const start = await balance("start");
const jobs = domains.filter((d) => {
  if (hasPage(OUT, d)) return false;
  if (hasFail(OUT, d) && !args.includes("--retry-failed")) return false;
  return true;
});
if (start - jobs.length * 2 < FLOOR) throw new Error(`balance ${start} too close to the ${FLOOR} floor for ${jobs.length} fetches`);
log(`${MODE}: ${jobs.length} to fetch, balance ${start}`);
let done = 0;
async function worker() {
  while (jobs.length) {
    const d = jobs.shift();
    const f = `${OUT}/${d}.html`;
    let r;
    if (MODE === "wayback") {
      const row = rows2026.find((x) => x.domain === d);
      let url = `https://web.archive.org/web/${row.capture}/http://${d}/`;
      for (let hop = 0; hop < 4; hop++) {
        r = await scrape(url, true);
        if (r.ok && HOLD.test(r.html) && impatient(r.html)) { url = impatient(r.html); continue; }
        break;
      }
    } else {
      r = await scrape(`https://${d}/`, false);
      if (!r.ok || r.status >= 400) { const r2 = await scrape(`https://www.${d}/`, false); if (r2.ok && !(r2.status >= 400)) r = r2; }
    }
    if (r.ok) writeFileSync(f + ".gz", gzipSync(`<!-- sgr025 fetched=${new Date().toISOString()} final=${r.final} status=${r.status} -->\n` + r.html));
    else writeFileSync(f + ".fail", `${new Date().toISOString()} ${r.why}`);
    if (++done % 20 === 0) log(`${done} fetched`);
    await sleep(300);
  }
}
await Promise.all(Array.from({ length: +opt("--concurrency", "4") }, worker));
const end = await balance("end");
log(`done: ${done} fetched, balance ${start} -> ${end} (${start - end} credits)`);
if (end < FLOOR) throw new Error("balance below floor");
