// SGR-030 Firecrawl access probe (Jack, 14 Oct 2026: "try one page on the sites that blocked us").
// One scrape per side of each bot-blocked, geo-trapped or unverified candidate: the base URL, fetched
// with Firecrawl's location set to that side's country (GB or US). Records whether Firecrawl got
// through, where it landed and whether the landing page is still on the intended side.
// No page text is kept, only counts. usage: node fc-probe.mjs [--out ~/research/sgr-030/fc-probe.json]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", "~/research/sgr-030/fc-probe.json");
const KEY = readFileSync("~/.bot-infra.env", "utf8").match(/^FIRECRAWL_API_KEY=(.+)$/m)[1].trim();
const { candidates } = JSON.parse(readFileSync(new URL("./candidates.json", import.meta.url), "utf8"));
const rows = candidates.filter((c) => ["bot-blocked", "geo-trapped", "unverified"].includes(c.status));
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const credits = async () => (await (await fetch("https://api.firecrawl.dev/v2/team/credit-usage", { headers: { Authorization: `Bearer ${KEY}` } })).json()).data?.remainingCredits;
const before = await credits();
console.log(`${rows.length} brands, ${before} credits before`);

// The side is still "right" if the landing URL keeps the side's host and, for a path base, its locale prefix.
function onSide(base, finalUrl) {
  try {
    const u = new URL(finalUrl), i = base.indexOf("/");
    const host = (i < 0 ? base : base.slice(0, i)).replace(/^www\./, ""), prefix = i < 0 ? "" : base.slice(i).toLowerCase();
    if (u.hostname.replace(/^www\./, "") !== host) return false;
    return !prefix || u.pathname.toLowerCase().startsWith(prefix);
  } catch { return false; }
}

async function scrape(base, country) {
  const url = "https://" + base;
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 1000, location: { country, languages: [country === "GB" ? "en-GB" : "en-US"] }, timeout: 60000 }),
      signal: AbortSignal.timeout(120000) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) throw new Error("FIRECRAWL_OUT_OF_CREDITS");
    if (!j.success) return { ok: false, http: r.status, error: String(j.error ?? "").slice(0, 160) };
    const m = j.data?.metadata ?? {}, md = j.data?.markdown ?? "";
    const final = m.url ?? m.sourceURL ?? url;
    const blocked = /access denied|are you a robot|verify you are human|captcha|request blocked|pardon our interruption|unusual traffic/i.test(md.slice(0, 3000));
    return { ok: (m.statusCode ?? 200) < 400 && !blocked, status: m.statusCode, final, onSide: onSide(base, final), lang: m.language ?? null, words: md.split(/\s+/).filter(Boolean).length, blockPage: blocked, proxy: m.proxyUsed ?? null, cost: m.creditsUsed ?? null };
  } catch (e) { if (e.message === "FIRECRAWL_OUT_OF_CREDITS") throw e; return { ok: false, error: e.message.slice(0, 160) }; }
}

let i = 0;
async function worker() {
  while (i < rows.length) {
    const c = rows[i++];
    if (done[c.brand]?.uk && done[c.brand]?.us) continue;
    const [uk, us] = await Promise.all([scrape(c.uk_base, "GB"), scrape(c.us_base, "US")]);
    done[c.brand] = { status: c.status, uk_base: c.uk_base, us_base: c.us_base, uk, us, at: new Date().toISOString() };
    writeFileSync(OUT, JSON.stringify(done, null, 1));
    const s = (x) => (x.ok ? (x.onSide ? "OK" : "OFF-SIDE") : "FAIL") + (x.status ? `(${x.status})` : "");
    console.log(`${c.brand.padEnd(22)} uk ${s(uk).padEnd(14)} us ${s(us)}`);
  }
}
await Promise.all([worker(), worker(), worker()]);
const after = await credits();
console.log(`credits: ${before} -> ${after} (used ${before - after})`);
