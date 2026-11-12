#!/usr/bin/env bun
// Brand deep corpus (2026-10-04, Jack: 25,000 Firecrawl credits). For every brand in
// brands.json: discover its own long-form writing (blog posts, press releases and news,
// product announcements, information packs such as annual and impact reports), sample it
// with a fixed seed, fetch it with Firecrawl v2 and store it.
//
//   bun fetch.mjs [--only a.com,b.com] [--budget 25000] [--per-brand 210]
//   bun fetch.mjs --dir ../brand-corpus-us --remote storagebox:research/scriptgrain-brand-corpus-us/v1/pages \
//     --skip-locale '^/(en[-_]?(gb|uk|ca|au|ie|nz|in)|uk|gb|ca|au|ie)(/|$)'
//   (--dir: another corpus's brands.json, ledger, discovery and manifest; --skip-locale: extra
//   path prefixes to drop, e.g. a US corpus dropping the UK/Canadian copies of a site.)
//
// Text goes to the Storage Box (third-party text, too big for git):
//   storagebox:research/scriptgrain-brand-corpus/v1/pages/<domain>.jsonl.gz
// The repo keeps what is needed to find, audit and re-fetch it (no text):
//   manifest.csv (one row per stored page), discovery.json (per brand: hosts, candidate
//   counts, credits), ledger.json (credits spent). See README.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
import { jsonLdDate, urlYear } from "./dates.mjs";
import { GROUP_HOSTS } from "./host-rules.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const here = new URL(".", import.meta.url).pathname;
const dir = opt("--dir") ? new URL(opt("--dir").replace(/\/?$/, "/"), "file://" + here).pathname : here;
const EXTRA_LOCALE = opt("--skip-locale") ? new RegExp(opt("--skip-locale"), "i") : null;
const ONLY = opt("--only", "") ? new Set(opt("--only").split(",")) : null;
const BUDGET = Number(opt("--budget", 25000)) - 400; // headroom for in-flight calls
const PER_BRAND = Number(opt("--per-brand", 210));
const KEY = readFileSync("~/.bot-infra.env", "utf8").match(/^FIRECRAWL_API_KEY=(.+)$/m)[1].trim();
const RCLONE = "rclone";
const REMOTE = opt("--remote", "storagebox:research/scriptgrain-brand-corpus/v1/pages");
const STAGE = dir + ".stage/";
mkdirSync(STAGE, { recursive: true });

export const QUOTA = { announcement: 25, press: 60, blog: 70, info_pack: 4 };
const PDF_MAX_PAGES = 25, MIN_WORDS = 150, SEED = 20261004;

const { brands } = JSON.parse(readFileSync(dir + "brands.json", "utf8"));
const ledgerPath = dir + "ledger.json", discPath = dir + "discovery.json", manPath = dir + "manifest.csv";
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : { budget: BUDGET + 400, spent: 0, byKind: { map: 0, search: 0, scrape: 0, pdf_pages: 0 }, brandsDone: [] };
const discovery = existsSync(discPath) ? JSON.parse(readFileSync(discPath, "utf8")) : {};
const MAN_COLS = ["domain", "sector", "category", "url", "host", "title", "published", "language", "words", "pdf_pages", "pdf_total_pages", "fetched_at", "sha256", "storage"];
if (!existsSync(manPath)) writeFileSync(manPath, MAN_COLS.join(",") + "\n");
const csv = (v) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const save = () => { writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1)); writeFileSync(discPath, JSON.stringify(discovery, null, 1)); };
const spend = (kind, n) => { ledger.spent += n; ledger.byKind[kind] = (ledger.byKind[kind] ?? 0) + n; return n; };

async function fc(path, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`https://api.firecrawl.dev/v2/${path}`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success !== false) return j;
      if (r.status === 402) throw new Error("FIRECRAWL_OUT_OF_CREDITS");
      if (r.status < 500 && r.status !== 429 && r.status !== 408) return null;
    } catch (e) { if (String(e).includes("OUT_OF_CREDITS")) throw e; }
    await new Promise((s) => setTimeout(s, 5000 * (i + 1)));
  }
  return null;
}

// ── classification ───────────────────────────────────────────────────────────
const SKIP_HOST = /^(community|forum|forums|meetings|calendar|help|support|docs|developer|developers|dev|status|careers|jobs|shop|store|app|apps|login|my|account|accounts|secure|online|signin|auth|api|cdn|static|assets|images|img|m)\./i;
const SKIP_PATH = /(login|log-in|sign-?in|sign-?up|register|terms|privacy|cookie|accessib|sitemap|\/tag\/|\/tags\/|\/category\/|\/categories\/|\/author\/|\/page\/\d+|\/search|\/feed|\.xml$|\.json$|\.(jpe?g|png|gif|svg|webp|mp4|zip|docx?|xlsx?|pptx?)$|modern-slavery|gender-pay|pay-gap|tax-strategy|cookie-policy|\/amp\/?$|\/help(\/|$)|\/support(\/|$)|\/gol-ui|\/shop\/|\/browse\/|\/basket|\/checkout)/i;
// v1.1 (2026-10-04): non-English locale paths are out (primark.com/de-at, clickup.com/pt-BR, slack.com/intl).
const LANG = "de|fr|es|it|pt|nl|da|sv|no|nb|fi|pl|ru|ja|zh|ko|ar|tr|cs|hu|el|he|th|id|vi|ro|uk-ua|bg|hr|sk|sl|lt|lv|et|ms|hi";
export const FOREIGN_LOCALE = new RegExp(`^/(?:(?:intl/)?(?:${LANG})(?:[-_][a-z]{2,4})?|intl(?!/en))(?:/|$)`, "i");
export const isEnglish = (lang) => !lang || /^en\b/i.test(lang);
const INFO_PDF = /(annual|report|impact|sustainab|esg|responsib|brand|guideline|press-?(pack|kit)|media-?(pack|kit)|fact-?sheet|information|info-?pack|overview|review|strateg|prospectus|our-story|year-in)/i;
const ANNOUNCE = /(announc|launch|introduc|whats-?new|what-s-new|product-?updates?|release-?notes|changelog|new-features?|unveil)/i;
const PRESS = /(\/press|\/newsroom|\/news|media-cent|media-releases|\/media\/|press-releases|\/pressreleases)/i;
const PRESS_HOST = /^(newsroom|media|press|news|corporate|about|www\.about|plc)\./i;
const BLOG = /(\/blog|\/insights?|\/articles?|\/magazine|\/inspiration|\/journal|\/stories|\/editorial|\/guides?|\/learn|\/resources|\/ideas|\/hub\/|\/the-[a-z-]+-blog|\/life|\/features|\/discover|\/advice|\/explore)/i;

export function classify(u, title = "", corporate = false) {
  let url; try { url = new URL(u); } catch { return null; }
  if (url.search && !/^\?(p|id)=/.test(url.search)) return null;
  const host = url.hostname.toLowerCase(), path = url.pathname.replace(/\/$/, "");
  if (SKIP_HOST.test(host) || SKIP_PATH.test(path) || FOREIGN_LOCALE.test(path) || EXTRA_LOCALE?.test(path)) return null;
  const segs = path.split("/").filter(Boolean);
  if (/\.pdf$/i.test(path)) return INFO_PDF.test(path + " " + title) ? "info_pack" : null;
  const last = segs.at(-1) ?? "";
  // Corporate newsrooms (tescoplc.com) often put releases at the root: /tesco-unwraps-...
  if (corporate && segs.length === 1 && last.length >= 25 && (last.match(/-/g) ?? []).length >= 4) return "press";
  const articleish = segs.length >= 2 && last.length >= 12 && /-/.test(last) && !/^(index|all|latest|archive)/.test(last);
  if (!articleish) return null;
  // Press first: a release reacting to an announcement is press, not a product announcement.
  if (PRESS.test(path) || PRESS_HOST.test(host)) return "press";
  if (ANNOUNCE.test(path)) return "announcement";
  if (BLOG.test(path)) return "blog";
  return null;
}

// mulberry32 shuffle with a fixed seed per brand
const seeded = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// v1.2: spread a pool across years. Candidates are bucketed by the year in their URL
// ("none" when there is none), each bucket shuffled with the brand's seed, then taken in
// turn oldest year first, so a sample is not just the latest posts.
const stratify = (xs, key) => {
  const buckets = new Map();
  for (const u of xs) { const y = urlYear(u) ?? "none"; if (!buckets.has(y)) buckets.set(y, []); buckets.get(y).push(u); }
  const order = [...buckets.keys()].sort();
  const lists = order.map((y) => shuffle(buckets.get(y), key + y));
  const out = [];
  for (let i = 0; out.length < xs.length; i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
};
const shuffle = (xs, key) => { const r = seeded(SEED ^ parseInt(createHash("sha256").update(key).digest("hex").slice(0, 8), 16)); const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const token = (d) => d.split(".")[0].replace(/-/g, "");
const words = (t) => (t.match(/\S+/g) ?? []).length;

async function discover(b, deep = false) {
  const d = b.domain, tk = token(d);
  let credits = 0;
  const links = new Map();
  const addMap = async (root) => {
    const m = await fc("map", { url: root, limit: 5000, includeSubdomains: true, location: { country: "GB" } }); credits += spend("map", 1);
    for (const l of m?.links ?? []) if (!links.has(l.url)) links.set(l.url, l.title ?? "");
    return (m?.links ?? []).length;
  };
  const hosts = { [`www.${d}`]: await addMap(`https://www.${d}`) };
  // Newsrooms and corporate sites often live on another domain (tescoplc.com, aboutus.*).
  const extra = new Set();
  for (const q of [`${tk} press releases newsroom`, `${tk} annual report pdf`]) {
    const s = await fc("search", { query: q, limit: 6, location: "United Kingdom" }); credits += spend("search", 2);
    for (const r of s?.data?.web ?? s?.data ?? []) {
      const url = r.url; if (!url) continue;
      let h; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { continue; }
      const own = h === d || h.endsWith("." + d);
      // v1.4: only the brand's own domain or a hand-checked group site (host-rules.mjs). The
      // old "host contains the brand's name" rule let in miroforestry.com, nivabupa.com and lvmh.
      const group = (GROUP_HOSTS[d] ?? []).some((g) => h === g || h.endsWith("." + g));
      if (/\.pdf$/i.test(url) && (own || group)) { if (!links.has(url)) links.set(url, r.title ?? ""); continue; }
      // Another domain counts only if it is plainly this brand's corporate or news site
      // (tescoplc.com, ee-newsroom.co.uk), not a sister organisation (oxfamamerica.org).
      // v1.4: a corporate or news site on another domain counts only if it is listed in
      // host-rules.mjs. The v1-v1.3 name-pattern rule (brand + news/group/plc) took eenews.net
      // for EE and notionpress.com for Notion.
      if (!own && group) extra.add(h);
    }
  }
  // v1.1 deep pass for thin brands: their writing is often on a subdomain the www map
  // misses (corporate.ryanair.com) or reachable only from search.
  const sub = new Set();
  if (deep) {
    for (const q of [`${tk} blog`, `${tk} news stories`, `${tk} press release ${new Date().getFullYear()}`]) {
      const s = await fc("search", { query: q, limit: 8, location: "United Kingdom" }); credits += spend("search", 2);
      for (const r of s?.data?.web ?? s?.data ?? []) {
        const url = r.url; if (!url) continue;
        let h; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { continue; }
        const own = h === d || h.endsWith("." + d);
        const corp = !own && (GROUP_HOSTS[d] ?? []).some((g) => h === g || h.endsWith("." + g));
        if (corp) extra.add(h);
        if (own && h !== d && !SKIP_HOST.test(h + ".")) sub.add(h);
        if ((own || corp) && !links.has(url)) links.set(url, r.title ?? "");
      }
    }
  }
  for (const h of [...extra].slice(0, deep ? 3 : 2)) hosts[h] = await addMap(`https://${h}`);
  for (const h of [...sub].slice(0, 2)) if (!hosts[h]) hosts[h] = await addMap(`https://${h}`);
  const cands = { announcement: [], press: [], blog: [], info_pack: [] };
  for (const [u, t] of links) {
    let h; try { h = new URL(u).hostname.replace(/^www\./, ""); } catch { continue; }
    const ok = h === d || h.endsWith("." + d) || extra.has(h) || [...extra].some((x) => h.endsWith("." + x));
    if (!ok && !/\.pdf$/i.test(u)) continue;
    const c = classify(u, t, extra.has(h) || [...extra].some((x) => h.endsWith("." + x))); if (c) cands[c].push(u.split("#")[0]);
  }
  for (const k of Object.keys(cands)) cands[k] = [...new Set(cands[k])];
  return { hosts, extraHosts: [...extra], mapLinks: links.size, candidates: Object.fromEntries(Object.entries(cands).map(([k, v]) => [k, v.length])), cands, credits };
}

function meta(md) {
  const m = md ?? {};
  const published = m["article:published_time"] ?? m.publishedTime ?? m["og:article:published_time"] ?? m.datePublished ?? m["date"] ?? m["dc.date"] ?? null;
  return { title: m.title ?? m.ogTitle ?? null, published: Array.isArray(published) ? published[0] : published, language: m.language ?? null, statusCode: m.statusCode ?? null, numPages: m.numPages ?? null, totalPages: m.totalPages ?? null, contentType: m.contentType ?? null, creditsUsed: m.creditsUsed ?? null };
}

async function scrapeOne(url, category) {
  const pdf = category === "info_pack";
  const body = pdf
    ? { url, formats: ["markdown"], parsers: [{ type: "pdf", maxPages: PDF_MAX_PAGES, mode: "fast" }], location: { country: "GB" } }
    : { url, formats: ["markdown", "rawHtml"], onlyMainContent: true, waitFor: 1000, location: { country: "GB" } };
  const j = await fc("scrape", body, 2);
  const d = j?.data; const M = meta(d?.metadata);
  let cost = 1; spend("scrape", 1);
  if (pdf && M.numPages) cost += spend("pdf_pages", M.numPages);
  if (!d?.markdown) return { cost, row: null };
  const text = pdf ? null : htmlToText(d.rawHtml ?? "").text;
  const w = words(d.markdown);
  if (w < MIN_WORDS || (M.statusCode && M.statusCode >= 400) || !isEnglish(M.language)) return { cost, row: null };
  return { cost, row: { url, category, date_jsonld: pdf ? null : jsonLdDate(d.rawHtml), finalUrl: d.metadata?.url ?? d.metadata?.sourceURL ?? url, title: M.title, published: M.published, language: M.language, words: w, pdf_pages: M.numPages, pdf_total_pages: M.totalPages, fetched_at: new Date().toISOString(), markdown: d.markdown, text_product: text, metadata: d.metadata } };
}

async function doBrand(b, existing = null, cap = PER_BRAND, opts = {}) {
  const quota = opts.quota ?? QUOTA;
  if (!existing && ledger.brandsDone.includes(b.domain)) return;
  if (ledger.spent >= BUDGET) return;
  const disc = await discover(b, !!existing && !opts.stratified);
  let brandCredits = disc.credits;
  const rows = [...(existing ?? [])], seenHash = new Set(rows.map((r) => r.sha256));
  const seenUrl = new Set(rows.map((r) => r.url));
  for (const c of Object.keys(disc.cands)) disc.cands[c] = disc.cands[c].filter((u) => !seenUrl.has(u));
  const order = ["info_pack", "announcement", "press", "blog"];
  const pool = Object.fromEntries(order.map((c) => [c, (opts.stratified ? stratify : shuffle)(disc.cands[c], b.domain + c)]));
  const got = Object.fromEntries(order.map((c) => [c, rows.filter((r) => r.category === c).length]));
  // Round-robin by category so a brand that runs out of budget still has every kind.
  let progress = true;
  while (progress && brandCredits < cap && ledger.spent < BUDGET) {
    progress = false;
    for (const c of order) {
      if (got[c] >= quota[c] || !pool[c].length) continue;
      if (c === "info_pack" && brandCredits + PDF_MAX_PAGES + 1 > cap) { pool[c] = []; continue; }
      const batch = pool[c].splice(0, c === "info_pack" ? 1 : 4);
      const res = await Promise.all(batch.map((u) => scrapeOne(u, c)));
      for (const r of res) {
        brandCredits += r.cost;
        if (!r.row) continue;
        const h = createHash("sha256").update(r.row.markdown).digest("hex");
        if (seenHash.has(h)) continue; seenHash.add(h);
        r.row.sha256 = h; rows.push(r.row); got[c]++;
      }
      progress = true;
      if (brandCredits >= cap || ledger.spent >= BUDGET) break;
    }
  }
  // stage, upload, verify, then record
  const file = `${b.domain}.jsonl.gz`;
  const recs = rows.map((r) => JSON.stringify({ ...r, domain: b.domain, sector: b.sector, study: b.study }));
  writeFileSync(STAGE + file, gzipSync(recs.join("\n") + "\n"));
  execFileSync(RCLONE, ["copyto", STAGE + file, `${REMOTE}/${file}`], { stdio: "ignore" });
  const remoteSize = JSON.parse(execFileSync(RCLONE, ["lsjson", `${REMOTE}/${file}`]).toString())[0]?.Size;
  const localSize = readFileSync(STAGE + file).length;
  if (remoteSize !== localSize) throw new Error(`upload size mismatch ${file} ${remoteSize} vs ${localSize}`);
  unlinkSync(STAGE + file);
  if (!existing) for (const r of rows) appendFileSync(manPath, [b.domain, b.sector, r.category, r.url, new URL(r.url).hostname, (r.title ?? "").replace(/\s+/g, " ").trim(), r.published, r.language, r.words, r.pdf_pages, r.pdf_total_pages, r.fetched_at, r.sha256, `${REMOTE}/${file}`].map(csv).join(",") + "\n");
  const { cands, ...dsum } = disc;
  if (opts.stratified) {
    discovery[b.domain].v12 = { ...dsum, storedAfter: { ...got }, credits: brandCredits };
    discovery[b.domain].stored = got;
    (ledger.v12Done ??= []).push(b.domain);
  } else if (existing) {
    discovery[b.domain].pass2 = { ...dsum, storedAfter: got, credits: brandCredits };
    discovery[b.domain].stored = got;
    (ledger.pass2Done ??= []).push(b.domain);
  } else {
    discovery[b.domain] = { sector: b.sector, study: b.study, ...dsum, stored: got, credits: brandCredits, storage: `${REMOTE}/${file}` };
    ledger.brandsDone.push(b.domain);
  }
  save();
  console.log(`${b.sector.padEnd(9)} ${b.domain.padEnd(30)} cands ${JSON.stringify(disc.candidates)} stored ${JSON.stringify(got)} credits ${brandCredits} | total ${ledger.spent}`);
}

// ── v1.1: clean stored pages with the tightened rules, then top up thin brands ──
export function keepRow(r) {
  let u; try { u = new URL(r.url); } catch { return false; }
  const path = u.pathname.replace(/\/$/, "");
  return !SKIP_HOST.test(u.hostname) && !SKIP_PATH.test(path) && !FOREIGN_LOCALE.test(path) && isEnglish(r.language);
}
const readStored = (domain) => {
  const buf = execFileSync(RCLONE, ["cat", `${REMOTE}/${domain}.jsonl.gz`], { maxBuffer: 1 << 30 });
  return gunzipSync(buf).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
};
const writeStored = (domain, rows) => {
  const file = `${domain}.jsonl.gz`;
  writeFileSync(STAGE + file, gzipSync(rows.map((r) => JSON.stringify(r)).join("\n") + "\n"));
  execFileSync(RCLONE, ["copyto", STAGE + file, `${REMOTE}/${file}`], { stdio: "ignore" });
  const remoteSize = JSON.parse(execFileSync(RCLONE, ["lsjson", `${REMOTE}/${file}`]).toString())[0]?.Size;
  if (remoteSize !== readFileSync(STAGE + file).length) throw new Error(`upload size mismatch ${file}`);
  unlinkSync(STAGE + file);
};

if (import.meta.main && args.includes("--v1.2")) {
  // Jack 2026-10-05, option (a): go deeper on brands with plenty of writing, spread across years.
  const EXTRA = { announcement: 20, press: 40, blog: 60, info_pack: 2 };
  const MIN_STORED = 40;
  const work = [];
  for (const b of brands.filter((x) => !ONLY || ONLY.has(x.domain))) {
    const d = discovery[b.domain]; if (!d) continue;
    const rows = readStored(b.domain);
    const kept = rows.filter(keepRow);
    if (kept.length !== rows.length) { writeStored(b.domain, kept); console.log("cleaned", b.domain, rows.length, "->", kept.length); }
    d.v12clean = { before: rows.length, droppedByRules: rows.length - kept.length };
    d.stored = Object.fromEntries(["info_pack", "announcement", "press", "blog"].map((c) => [c, kept.filter((r) => r.category === c).length]));
    if (kept.length >= MIN_STORED && !(ledger.v12Done ?? []).includes(b.domain)) work.push([b, kept]);
  }
  save();
  const room = BUDGET - ledger.spent;
  const cap = Math.max(60, Math.min(180, Math.floor(room / Math.max(1, work.length))));
  console.log("v1.2 brands", work.length, "credits left", room, "per-brand cap", cap);
  let j = 0;
  await Promise.all(Array.from({ length: Number(opt("--parallel", 6)) }, async () => {
    while (j < work.length) {
      const [b, kept] = work[j++];
      const quota = Object.fromEntries(Object.entries(EXTRA).map(([c, n]) => [c, kept.filter((r) => r.category === c).length + n]));
      try { await doBrand(b, kept, cap, { stratified: true, quota }); } catch (e) { console.log("ERR", b.domain, String(e).slice(0, 300)); if (String(e).includes("OUT_OF_CREDITS")) process.exit(3); }
    }
  }));
  save();
  console.log("v1.2 done. credits spent (ledger)", ledger.spent, JSON.stringify(ledger.byKind));
} else if (import.meta.main && args.includes("--v1.1")) {
  const PASS2_CAP = Number(opt("--pass2-cap", 150));
  const plan = [];
  for (const b of brands.filter((x) => !ONLY || ONLY.has(x.domain))) {
    const d = discovery[b.domain]; if (!d || d.v11) continue;
    const rows = readStored(b.domain);
    const kept = rows.filter(keepRow);
    const dropped = rows.length - kept.length;
    d.v11 = { before: rows.length, droppedByRules: dropped };
    if (dropped) writeStored(b.domain, kept);
    d.stored = Object.fromEntries(["info_pack", "announcement", "press", "blog"].map((c) => [c, kept.filter((r) => r.category === c).length]));
    if (kept.length < 15 || dropped >= 10) plan.push([b, kept]);
    save();
    if (dropped) console.log("cleaned", b.domain, rows.length, "->", kept.length);
  }
  console.log("top-up brands", plan.length, plan.map(([b]) => b.domain).join(" "));
  let j = 0;
  await Promise.all(Array.from({ length: Number(opt("--parallel", 6)) }, async () => {
    while (j < plan.length) {
      const [b, kept] = plan[j++];
      if ((ledger.pass2Done ?? []).includes(b.domain)) continue;
      try { await doBrand(b, kept, PASS2_CAP); } catch (e) { console.log("ERR", b.domain, String(e).slice(0, 300)); if (String(e).includes("OUT_OF_CREDITS")) process.exit(3); }
    }
  }));
  save();
  console.log("v1.1 done. credits spent (ledger)", ledger.spent, JSON.stringify(ledger.byKind));
} else if (import.meta.main) {
  const todo = brands.filter((b) => !ONLY || ONLY.has(b.domain));
  let i = 0;
  await Promise.all(Array.from({ length: Number(opt("--parallel", 6)) }, async () => {
    while (i < todo.length) {
      const b = todo[i++];
      try { await doBrand(b); } catch (e) { console.log("ERR", b.domain, String(e).slice(0, 300)); if (String(e).includes("OUT_OF_CREDITS")) process.exit(3); }
    }
  }));
  save();
  console.log("done. credits spent (ledger)", ledger.spent, JSON.stringify(ledger.byKind));
}
