#!/usr/bin/env bun
// SGR-004 step 1b: render each capture crawl.mjs found, with JavaScript, through
// Firecrawl, so homepages built client-side are measured on what a visitor saw
// rather than on an empty shell.
//
//   bun scripts/experiments/sgr-004/render.mjs --raw <crawl cache> --cache <render cache> [--concurrency 8]
//
// Renders exactly the capture (timestamp + final URL) the raw pass stored, so
// the two passes are paired page for page. ~1 Firecrawl credit per page. The
// Wayback toolbar is excluded at render time. Like crawl.mjs, the HTML cache is
// temporary and never committed. Resumable; re-run after crawl.mjs finishes to
// pick up captures it fetched since.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const RAW = opt("--raw", null), CACHE = opt("--cache", null);
const CONC = +opt("--concurrency", "8");
if (!RAW || !CACHE) throw new Error("--raw and --cache required");
mkdirSync(CACHE, { recursive: true });
const line = readFileSync(`${homedir()}/.bot-infra.env`, "utf8").split("\n").find((l) => l.startsWith("FIRECRAWL_API_KEY="));
const KEY = line.slice("FIRECRAWL_API_KEY=".length).replace(/^['"]|['"]$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);

const jobs = [];
for (const f of readdirSync(RAW)) {
  const m = f.match(/^(.+)\.(\d{4})\.html$/);
  if (!m) continue;
  const out = `${CACHE}/${f}`;
  if (existsSync(out) || existsSync(out + ".fail")) continue;
  const head = readFileSync(`${RAW}/${f}`, "utf8").slice(0, 400);
  const h = head.match(/^<!-- sgr004 ts=(\d{14}) final=(\S+) -->/);
  if (!h) continue;
  // Replay form (no id_), so the archived scripts run.
  jobs.push({ f, out, ts: h[1], url: h[2].replace(/\/web\/(\d{14})id_\//, "/web/$1/") });
}
// --dated: site-years the raw crawl never reached (archive.org rate-limited this
// server's address two-thirds of the way through, 2026-10-04). These are
// requested by date through Firecrawl, like crawl.mjs does directly, and kept
// only if the capture Wayback picks falls in the target year. They have no raw
// HTML twin, so the raw-HTML check covers only the site-years crawl.mjs fetched.
if (args.includes("--dated")) {
  const { sites } = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));
  for (const s of sites) for (let year = 2000; year <= 2026; year++) {
    const f = `${s.domain}.${year}.html`;
    if (existsSync(`${RAW}/${f}`) || existsSync(`${RAW}/${f}.fail`)) continue;
    const out = `${CACHE}/${f}`;
    if (existsSync(out) || existsSync(out + ".fail")) continue;
    jobs.push({ f, out, year, url: `https://web.archive.org/web/${year}0701000000/http://${s.domain}/` });
  }
}
// A capture that was itself a redirect replays as Wayback's "Got an HTTP 302
// response at crawl time / Redirecting to..." holding page, which Firecrawl does
// not click through (crawl.mjs's raw fetch follows these on its own). Follow its
// "Impatient?" link, up to three hops. --fix-redirects re-renders every cached
// holding page this way; new renders do it inline.
const HOLD = /Got an HTTP 30\d response at crawl time/;
const impatient = (html) => {
  const m = html.match(/<p class="impatient"><a href="([^"]+)"/);
  return m ? m[1].replace(/&amp;/g, "&") : null;
};
if (args.includes("--fix-redirects")) {
  for (const f of readdirSync(CACHE)) {
    if (!f.endsWith(".html")) continue;
    const html = readFileSync(`${CACHE}/${f}`, "utf8");
    if (!HOLD.test(html)) continue;
    const head = html.match(/^<!-- sgr004 ts=(\d*) final=(\S+) rendered=firecrawl( dated)? -->/);
    const next = impatient(html);
    if (!head || !next) continue;
    // The redirect target is the same moment in the archive, so no year check.
    jobs.push({ f, out: `${CACHE}/${f}`, ts: head[1], url: next, dated: !!head[3], hops: 1 });
  }
}
log(`${jobs.length} captures to render`);

let done = 0, credits = 0;
async function worker() {
  while (jobs.length) {
    const j = jobs.shift();
    let ok = false;
    for (let i = 0; i < 4 && !ok; i++) {
      try {
        const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: j.url, formats: ["rawHtml"], onlyMainContent: false, waitFor: 2000, timeout: 60000, excludeTags: ["#wm-ipp-base", "#wm-ipp", "#donato", "#wm-ipp-print"] }),
          signal: AbortSignal.timeout(90000),
        });
        if (r.status === 429) { await sleep(20000); continue; }
        const d = await r.json().catch(() => ({}));
        credits += d?.data?.metadata?.creditsUsed ?? 0;
        if (d.success && d.data?.rawHtml && HOLD.test(d.data.rawHtml) && impatient(d.data.rawHtml) && (j.hops ?? 0) < 3) {
          j.hops = (j.hops ?? 0) + 1;
          j.url = impatient(d.data.rawHtml);
          i--;
          continue;
        }
        if (d.success && d.data?.rawHtml) {
          let ts = j.ts, final = j.url;
          if (j.year || j.hops) {
            final = d.data.metadata?.url || j.url;
            ts = (final.match(/\/web\/(\d{14})/) || [])[1] || "";
            if (j.year && !ts.startsWith(String(j.year))) { writeFileSync(j.out + ".fail", `no capture in ${j.year} (nearest ${ts})`); ok = true; continue; }
          }
          writeFileSync(j.out, `<!-- sgr004 ts=${ts} final=${final} rendered=firecrawl${j.year || j.dated ? " dated" : ""} -->\n` + d.data.rawHtml);
          ok = true;
        } else if (r.status < 500) { writeFileSync(j.out + ".fail", `${r.status} ${d.error ?? ""}`.slice(0, 300)); ok = true; }
        else await sleep(5000 * (i + 1));
      } catch { await sleep(5000 * (i + 1)); }
    }
    if (!ok) writeFileSync(j.out + ".fail", "gave up");
    if (++done % 100 === 0) log(`${done} rendered, ${credits} credits`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
log(`done: ${done} rendered, ${credits} credits`);
