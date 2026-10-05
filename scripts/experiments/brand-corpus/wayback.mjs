#!/usr/bin/env bun
// v1.3 (2026-10-05, Jack: +credits for writing from BEFORE ChatGPT). For brands with at
// least 40 stored pages: find their blog and newsroom pages as the Wayback Machine held them
// between 2015 and 30 November 2022, and fetch those archived originals through Firecrawl,
// so the text is what the brand published then, not a later edit.
//
//   bun wayback.mjs [--cap 7000] [--only a.com,b.com] [--parallel 6]
//
// Phase 1 (free): the Wayback CDX index, one query per blog/newsroom path prefix, slowly
//   (one request at a time, 3 s apart: archive.org blocks faster callers; skill wayback-bulk-fetch).
//   If CDX answers 429, the remaining queries go through Firecrawl instead (1 credit each).
// Phase 2 (credits): Firecrawl scrape of https://web.archive.org/web/<ts>id_/<url> (the
//   archived original bytes, no toolbar), year-spread like v1.2. The credit cap is checked
//   against Firecrawl's own counter, not a script ledger.
// Rows are appended to the brand's file on the Storage Box with source "wayback".
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
import { classify, keepRow, isEnglish } from "./fetch.mjs";
import { jsonLdDate, urlYear } from "./dates.mjs";

const dir = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CAP = Number(opt("--cap", 12000)) - 150;
// Jack 2026-10-05: keep at least 10,000 credits on the account whatever this run does.
const FLOOR = Number(opt("--floor", 10500));
const ONLY = opt("--only", "") ? new Set(opt("--only").split(",")) : null;
const KEY = readFileSync("~/.bot-infra.env", "utf8").match(/^FIRECRAWL_API_KEY=(.+)$/m)[1].trim();
const RCLONE = "rclone", REMOTE = "storagebox:research/scriptgrain-brand-corpus/v1/pages";
const STAGE = dir + ".stage/", CDX_CACHE = dir + ".stage/cdx/";
mkdirSync(CDX_CACHE, { recursive: true });
const UA = "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research)";
const CUTOFF = "20221130235959", FROM = "2015";
// ~90 pages a brand: enough to split "before" into 2015-18 and 2019-22 (Jack 2026-10-05).
const QUOTA = { blog: 55, press: 28, announcement: 7 };
const MIN_STORED = 40, MIN_WORDS = 150, SEED = 20261005;
const BOT_WALL = /(request has been blocked|access denied|just a moment|enable javascript|are you a robot|got an http \d{3} response at crawl time|wayback machine has not archived)/i;

const { brands } = JSON.parse(readFileSync(dir + "brands.json", "utf8"));
const discPath = dir + "discovery.json", ledgerPath = dir + "ledger.json";
const discovery = JSON.parse(readFileSync(discPath, "utf8"));
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const save = () => { writeFileSync(discPath, JSON.stringify(discovery, null, 1)); writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const words = (t) => (t.match(/\S+/g) ?? []).length;

async function remainingCredits() {
  const r = await fetch("https://api.firecrawl.dev/v2/team/credit-usage", { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json())?.data?.remainingCredits;
}
async function fc(path, body, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`https://api.firecrawl.dev/v2/${path}`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(150000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success !== false) return j;
      if (r.status === 402) throw new Error("FIRECRAWL_OUT_OF_CREDITS");
      if (r.status < 500 && r.status !== 429) return null;
    } catch (e) { if (String(e).includes("OUT_OF_CREDITS")) throw e; }
    await sleep(6000 * (i + 1));
  }
  return null;
}

// ── storage ──
const readStored = (domain) => gunzipSync(execFileSync(RCLONE, ["cat", `${REMOTE}/${domain}.jsonl.gz`], { maxBuffer: 1 << 30 })).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const writeStored = (domain, rows) => {
  const file = `${domain}.jsonl.gz`;
  writeFileSync(STAGE + file, gzipSync(rows.map((r) => JSON.stringify(r)).join("\n") + "\n"));
  execFileSync(RCLONE, ["copyto", STAGE + file, `${REMOTE}/${file}`], { stdio: "ignore" });
  const remoteSize = JSON.parse(execFileSync(RCLONE, ["lsjson", `${REMOTE}/${file}`]).toString())[0]?.Size;
  if (remoteSize !== readFileSync(STAGE + file).length) throw new Error(`upload size mismatch ${file}`);
  unlinkSync(STAGE + file);
};

// ── phase 1: prefixes and CDX ──
const norm = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/$/, "")).toLowerCase(); } catch { return u; } };
const LOCALE_SEG = /^(en|en-gb|en_gb|uk|gb|en-uk|intl)$/i;
function prefixesFor(rows) {
  const count = new Map();
  for (const r of rows) {
    if (r.category === "info_pack" || r.source === "wayback") continue;
    let u; try { u = new URL(r.url); } catch { continue; }
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length < 2) continue;
    let take = 1; if (LOCALE_SEG.test(segs[0]) || /^(about|about-us|corporate|company|media|en-gb)$/i.test(segs[0])) take = 2;
    const p = `${u.hostname.replace(/^www\./, "")}/${segs.slice(0, Math.min(take, segs.length - 1)).join("/")}/`;
    count.set(p, (count.get(p) ?? 0) + 1);
  }
  return [...count.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
}
let cdxBlocked = false;
async function cdx(prefix) {
  const cache = CDX_CACHE + createHash("sha256").update(prefix).digest("hex").slice(0, 16) + ".json";
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const q = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(prefix)}&matchType=prefix&from=${FROM}&to=${CUTOFF}&output=json&fl=original,timestamp&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&limit=4000`;
  let rows = null;
  if (!cdxBlocked) {
    try {
      const r = await fetch(q, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120000) });
      if (r.status === 429) { cdxBlocked = true; console.log("CDX 429: switching to Firecrawl for the index"); }
      else if (r.ok) rows = await r.json().catch(() => []);
    } catch (e) { console.log("cdx error", prefix, String(e).slice(0, 80)); }
    await sleep(3000);
  }
  if (cdxBlocked) {
    const j = await fc("scrape", { url: q, formats: ["rawHtml"] });
    try { rows = JSON.parse(j?.data?.rawHtml?.replace(/^[\s\S]*?(\[\[)/, "$1").replace(/\]\][\s\S]*$/, "]]") ?? "[]"); } catch { rows = []; }
  }
  const out = (rows ?? []).slice(1).map(([original, timestamp]) => ({ original, timestamp }));
  writeFileSync(cache, JSON.stringify(out));
  return out;
}

// ── sampling ──
const seeded = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (xs, key) => { const r = seeded(SEED ^ parseInt(createHash("sha256").update(key).digest("hex").slice(0, 8), 16)); const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const yearOf = (c) => urlYear(c.original) ?? c.timestamp.slice(0, 4);
function spread(cands, key) {
  const by = new Map();
  for (const c of cands) { const y = yearOf(c); if (!by.has(y)) by.set(y, []); by.get(y).push(c); }
  const lists = [...by.keys()].sort().map((y) => shuffle(by.get(y), key + y));
  const out = [];
  for (let i = 0; out.length < cands.length; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

// ── phase 2: fetch one archived page ──
async function fetchArchived(c, category) {
  const wurl = `https://web.archive.org/web/${c.timestamp}id_/${c.original}`;
  const j = await fc("scrape", { url: wurl, formats: ["markdown", "rawHtml"], onlyMainContent: true, waitFor: 500 });
  const d = j?.data; if (!d?.markdown) return null;
  const resolved = d.metadata?.url ?? d.metadata?.sourceURL ?? wurl;
  const ts = resolved.match(/\/web\/(\d{14})/)?.[1] ?? c.timestamp;
  if (ts > CUTOFF) return null; // redirected to a capture after ChatGPT's launch
  const w = words(d.markdown);
  if (w < MIN_WORDS || BOT_WALL.test(d.markdown.slice(0, 800)) || BOT_WALL.test(d.metadata?.title ?? "") || !isEnglish(d.metadata?.language)) return null;
  const html = d.rawHtml ?? "";
  return {
    url: c.original.replace(/:80(?=\/)/, ""), category, source: "wayback", pre_chatgpt: true, wayback_ts: ts, wayback_url: `https://web.archive.org/web/${ts}/${c.original}`,
    date_jsonld: jsonLdDate(html), finalUrl: resolved, title: d.metadata?.title ?? null,
    published: d.metadata?.["article:published_time"] ?? d.metadata?.publishedTime ?? null, language: d.metadata?.language ?? null,
    words: w, pdf_pages: null, pdf_total_pages: null, fetched_at: new Date().toISOString(),
    markdown: d.markdown, text_product: htmlToText(html).text, metadata: d.metadata,
    sha256: createHash("sha256").update(d.markdown).digest("hex"),
  };
}

// ── main ──
const R0 = await remainingCredits();
ledger.v13 ??= { startRemaining: R0, cap: CAP + 150, brandsDone: [] };
const startR = ledger.v13.startRemaining;
const spentByCounter = async () => startR - (await remainingCredits());
console.log("v1.3 start: account remaining", R0, "start ref", startR, "cap", CAP + 150);

const work = brands.filter((b) => (!ONLY || ONLY.has(b.domain)) && !ledger.v13.brandsDone.includes(b.domain));
const plans = [];
for (const b of work) {
  const rows = readStored(b.domain).filter(keepRow);
  // Thin brands (under 40 pages now) get the usual archive paths, since their live site
  // gave us too little to learn its paths from; their old writing may still be archived.
  const prefixes = rows.length >= MIN_STORED ? prefixesFor(rows) : ["blog", "news", "press", "media"].map((x) => `${b.domain}/${x}/`);
  const seen = new Set(rows.map((r) => norm(r.url)));
  const cands = { blog: [], press: [], announcement: [] };
  let cdxRows = 0;
  for (const p of prefixes) {
    const list = await cdx(p); cdxRows += list.length;
    for (const c of list) {
      if (/[?#]/.test(c.original) || seen.has(norm(c.original))) continue;
      const host = (() => { try { return new URL(c.original).hostname.replace(/^www\./, ""); } catch { return ""; } })();
      const cat = classify(c.original.replace(/:80(?=\/)/, ""), "", host !== b.domain && !host.endsWith("." + b.domain));
      if (cat && cands[cat] && +yearOf(c) >= 2015 && +yearOf(c) <= 2022) { cands[cat].push(c); seen.add(norm(c.original)); }
    }
  }
  plans.push({ b, rows, prefixes, cdxRows, cands });
  console.log("cdx", b.domain, prefixes.join(" "), "rows", cdxRows, "cands", JSON.stringify(Object.fromEntries(Object.entries(cands).map(([k, v]) => [k, v.length]))));
}
const live = plans.filter((p) => Object.values(p.cands).some((v) => v.length));
const perBrand = Math.max(40, Math.floor(CAP / Math.max(1, live.length)));
console.log("phase 2: brands", live.length, "per-brand credit cap", perBrand);

let k = 0, stop = false;
await Promise.all(Array.from({ length: Number(opt("--parallel", 6)) }, async () => {
  while (k < live.length && !stop) {
    const p = live[k++];
    if ((await spentByCounter()) >= CAP || (await remainingCredits()) <= FLOOR) { stop = true; break; }
    let credits = 0;
    const got = { blog: 0, press: 0, announcement: 0 };
    const add = [];
    const pools = Object.fromEntries(Object.entries(p.cands).map(([c, v]) => [c, spread(v, p.b.domain + c)]));
    const seenHash = new Set(p.rows.map((r) => r.sha256));
    let progress = true;
    while (progress && credits < perBrand) {
      progress = false;
      for (const c of ["announcement", "press", "blog"]) {
        if (got[c] >= QUOTA[c] || !pools[c].length) continue;
        const batch = pools[c].splice(0, 4);
        const res = await Promise.all(batch.map((x) => fetchArchived(x, c).catch(() => null)));
        credits += batch.length;
        for (const r of res) if (r && !seenHash.has(r.sha256)) { seenHash.add(r.sha256); add.push(r); got[c]++; }
        progress = true;
        if (credits >= perBrand) break;
      }
    }
    const meta = { domain: p.b.domain, sector: p.b.sector, study: p.b.study };
    if (add.length) writeStored(p.b.domain, [...p.rows, ...add.map((r) => ({ ...r, ...meta }))]);
    discovery[p.b.domain].v13 = { prefixes: p.prefixes, cdxRows: p.cdxRows, candidates: Object.fromEntries(Object.entries(p.cands).map(([c, v]) => [c, v.length])), stored: got, credits };
    for (const [c, n] of Object.entries(got)) discovery[p.b.domain].stored[c] = (discovery[p.b.domain].stored[c] ?? 0) + n;
    ledger.v13.brandsDone.push(p.b.domain);
    ledger.spent += credits; ledger.byKind.wayback_scrape = (ledger.byKind.wayback_scrape ?? 0) + credits;
    save();
    console.log("stored", p.b.sector.padEnd(9), p.b.domain.padEnd(30), JSON.stringify(got), "credits", credits);
  }
}));
ledger.v13.spentByCounter = await spentByCounter();
save();
console.log("v1.3 done. credits by account counter", ledger.v13.spentByCounter);
