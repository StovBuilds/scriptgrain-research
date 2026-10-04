#!/usr/bin/env bun
// SGR-009 fetch: pre-registration section 3. For each frozen brand, Firecrawl map ->
// pick home / about / product / pricing / careers by the frozen URL rules -> Firecrawl
// rawHtml -> the product's htmlToText -> first 700 words. Writes corpus.json (third-party
// text: NOT committed) and pages.json (urls, types, words, fetch dates: committed).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";

const dir = new URL(".", import.meta.url).pathname;
const panel = JSON.parse(readFileSync(dir + "panel.json", "utf8"));
const KEY = readFileSync("~/.bot-infra.env", "utf8").match(/^FIRECRAWL_API_KEY=(.+)$/m)[1].trim();
const TYPES = ["home", "about", "product", "pricing", "careers"];
const EXCLUDE = /(login|log-in|signin|sign-in|logon|legal|privacy|cookie|terms|press|news|blog\/|investor|sitemap|\.pdf|\?|status|accessib|complain|search)/i;
const MIN_WORDS = 150, CAP = 700, TRIES = 3;

const fc = async (path, body) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.firecrawl.dev/v1/${path}`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success !== false) return j;
    } catch { /* retry */ }
    await new Promise((s) => setTimeout(s, 4000 * (i + 1)));
  }
  return null;
};
const words = (t) => t.split(/\s+/).filter(Boolean);
const corpusPath = dir + "corpus.json";
const corpus = existsSync(corpusPath) ? JSON.parse(readFileSync(corpusPath, "utf8")) : {};
let credits = 0;

function candidates(links, domain, sector) {
  const rx = {
    about: new RegExp(panel.pageTypes.about, "i"),
    product: new RegExp(panel.pageTypes.product[sector], "i"),
    pricing: new RegExp(panel.pageTypes.pricing, "i"),
    careers: new RegExp(panel.pageTypes.careers, "i"),
  };
  const ok = [];
  for (const raw of links) {
    let u; try { u = new URL(raw); } catch { continue; }
    const h = u.hostname.replace(/^www\./, "");
    if (h !== domain && !h.endsWith("." + domain)) continue;
    const s = u.href.split("#")[0].replace(/\/$/, "");
    if (EXCLUDE.test(s) || u.search) continue;
    ok.push({ s, path: u.pathname.replace(/\/$/, "") || "/" , host: h });
  }
  const out = {};
  for (const t of ["about", "product", "pricing", "careers"]) {
    let c = ok.filter((x) => x.path !== "/" && rx[t].test(x.path));
    if (t === "product" || t === "pricing") c = c.filter((x) => !rx.careers.test(x.path) && !rx.about.test(x.path));
    out[t] = [...new Set(c.map((x) => x.s))].sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  }
  return out;
}

async function scrape(u) {
  const j = await fc("scrape", { url: u, formats: ["rawHtml"], onlyMainContent: false, waitFor: 1500, location: { country: "GB" } }); credits++;
  const html = j?.data?.rawHtml; if (!html) return null;
  const w = words(htmlToText(html).text);
  return { finalUrl: j?.data?.metadata?.url || u, words: w.length, text: w.slice(0, CAP).join(" ") };
}

async function doBrand(sector, domain) {
  if (corpus[domain]?.done) return;
  const root = `https://www.${domain}`;
  const m = await fc("map", { url: root, limit: 400, location: { country: "GB" } }); credits++;
  const cands = candidates(m?.links || [], domain, sector);
  const pages = [];
  const seenUrl = new Set(), seenHead = new Set();
  const accept = (type, url, r) => {
    const head = words(r.text).slice(0, 200).join(" ");
    if (seenUrl.has(r.finalUrl) || seenUrl.has(url) || seenHead.has(head)) return "duplicate";
    seenUrl.add(url); seenUrl.add(r.finalUrl); seenHead.add(head);
    pages.push({ type, url, finalUrl: r.finalUrl, words: Math.min(r.words, CAP), wordsFull: r.words, fetchedAt: new Date().toISOString(), text: r.text });
    return "ok";
  };
  const log = [];
  for (const type of TYPES) {
    const list = type === "home" ? [root] : cands[type].slice(0, TRIES);
    let got = false;
    for (const u of list) {
      const r = await scrape(u);
      if (!r) { log.push(`${type} fail ${u}`); continue; }
      if (r.words < MIN_WORDS) { log.push(`${type} short(${r.words}) ${u}`); continue; }
      const a = accept(type, u, r);
      if (a === "ok") { got = true; break; }
      log.push(`${type} ${a} ${u}`);
    }
    if (!got) log.push(`${type} MISSING (${list.length} tried)`);
  }
  corpus[domain] = { sector, done: true, mapLinks: (m?.links || []).length, pages, log };
  writeFileSync(corpusPath, JSON.stringify(corpus));
  console.log(sector.padEnd(9), domain.padEnd(30), pages.map((p) => p.type[0] + p.words).join(" "), "| credits", credits);
}

const jobs = Object.entries(panel.sectors).flatMap(([s, ds]) => ds.map((d) => [s, d]));
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (i < jobs.length) { const [s, d] = jobs[i++]; await doBrand(s, d); } }));

const meta = {};
for (const [d, b] of Object.entries(corpus)) meta[d] = { sector: b.sector, mapLinks: b.mapLinks, log: b.log, pages: b.pages.map(({ text, ...rest }) => rest) };
writeFileSync(dir + "pages.json", JSON.stringify(meta, null, 1));
console.log("done. firecrawl credits this run", credits);
