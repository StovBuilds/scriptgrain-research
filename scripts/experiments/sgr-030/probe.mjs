// SGR-030 candidate probe. Plain curl only (no Firecrawl, no APIs). Polite: per-host serial, 600 ms gap,
// robots.txt cached per host, at most 2 child sitemaps per side. Writes candidates.json.
// usage: node probe.mjs [--out candidates.json] [--cache probe-cache.json] [--only substring]
import { execFile } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { SEED } from "./candidate-seed.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DEEP = process.argv.includes("--deep"), KIDS = DEEP ? 5 : 2;
const OUT = arg("--out", "candidates.json"), CACHE = arg("--cache", "~/research/sgr-030/probe-cache.json"), ONLY = arg("--only");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
for (const k of Object.keys(cache)) { const v = cache[k]; if ((k.startsWith("home:") && !(v.code >= 200 && v.code < 300)) || (k.startsWith("sm:") && !v.urls?.length) || (k.startsWith("robots:") && v.code !== 200)) delete cache[k]; }
const save = () => writeFileSync(CACHE, JSON.stringify(cache));

const hostGate = new Map();
const gate = async (host) => { const prev = hostGate.get(host) ?? Promise.resolve(); let rel; const mine = new Promise((r) => (rel = r)); hostGate.set(host, prev.then(() => mine)); await prev; return () => setTimeout(rel, 600); };

function curl(url, maxBytes = 25e6, extra = []) {
  return new Promise((res) => execFile("curl", ["-4", "-sL", "--max-time", "20", "--max-filesize", String(maxBytes), "--max-redirs", "10", "--compressed", ...extra, "-A", UA, "-H", "Accept-Language: en-GB,en;q=0.9", "-D", "-", "-w", "\n@@@%{http_code} %{url_effective}", url],
    { encoding: "buffer", maxBuffer: 60e6 }, (err, out) => {
      if (!out || !out.length) return res({ code: 0, final: url, body: Buffer.alloc(0), err: err?.message?.slice(0, 80) });
      const s = out.toString("latin1"); const k = s.lastIndexOf("\n@@@"); const meta = s.slice(k + 4).trim();
      const code = Number(meta.split(" ")[0]), final = meta.slice(meta.indexOf(" ") + 1);
      let raw = out.subarray(0, k);
      // strip header blocks (one per redirect hop)
      let off = 0; const headers = [];
      while (raw.subarray(off, off + 5).toString() === "HTTP/") { const e = raw.indexOf("\r\n\r\n", off); if (e < 0) break; headers.push(raw.subarray(off, e).toString("latin1")); off = e + 4; }
      res({ code, final, body: raw.subarray(off), hops: headers.length, linkHdr: headers.map((h) => (h.match(/^link:.*$/gim) ?? []).join(" ")).join(" ") });
    }));
}
const BROWSER = ["-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "-H", "Upgrade-Insecure-Requests: 1", "-H", "Sec-Fetch-Dest: document", "-H", "Sec-Fetch-Mode: navigate", "-H", "Sec-Fetch-Site: none"];
const polite = async (u) => { const host = new URL(u).hostname; const done = await gate(host); try {
  let r = await curl(u);
  if (r.code === 429 || r.code === 0) { await new Promise((z) => setTimeout(z, 8000)); r = await curl(u); }
  else if ([403, 401, 406, 418, 500].includes(r.code)) { r = await curl(u, 25e6, BROWSER); }
  return r; } finally { done(); } };
const text = (b) => { if (b[0] === 0x1f && b[1] === 0x8b) { try { b = gunzipSync(b); } catch {} } return b.toString("utf8"); };
const splitBase = (b) => { const i = b.indexOf("/"); return i < 0 ? { host: b, prefix: "" } : { host: b.slice(0, i), prefix: b.slice(i) }; };

async function robots(host) {
  const key = "robots:" + host; if (cache[key]) return cache[key];
  const r = await polite(`https://${host}/robots.txt`);
  const t = r.code === 200 ? text(r.body) : "";
  const sm = [...t.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 8);
  return (cache[key] = { code: r.code, sitemaps: sm });
}
const locs = (x) => [...x.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)/g)].map((m) => m[1].replace(/&amp;/g, "&"));

async function sitemapUrls(host, prefix, tag) {
  const key = `sm:${host}:${prefix}${DEEP ? ":deep" : ""}`; if (cache[key]) return cache[key];
  const rb = await robots(host);
  let starts = rb.sitemaps.length ? rb.sitemaps : [`https://${host}/sitemap.xml`];
  const pick = starts.filter((s) => /sitemap/i.test(s));
  const first = (pick.length ? pick : starts)[0];
  let urls = [], note = "", fetched = 1;
  const r = await polite(first);
  if (r.code !== 200) return (cache[key] = { urls: [], note: `sitemap ${r.code}`, first });
  let x = text(r.body), l = locs(x);
  if (/<sitemapindex/i.test(x)) {
    const tok = prefix.replace(/\//g, "").toLowerCase();
    const score = (u) => (tok && u.toLowerCase().includes(tok) ? 3 : 0) + (/blog|news|article|stor|insight|page|content|product|about/i.test(u) ? 1 : 0) - (/image|video|img|\.jpg/i.test(u) ? 2 : 0);
    const kids = l.map((u) => [u, score(u)]).sort((a, b) => b[1] - a[1]).slice(0, KIDS).map((k) => k[0]);
    note = `index(${l.length}) read ${kids.length}`;
    for (const k of kids) { const rr = await polite(k); fetched++; if (rr.code === 200) urls.push(...locs(text(rr.body))); }
  } else urls = l;
  return (cache[key] = { urls: urls.slice(0, 200000), note: note || "urlset", first, fetched });
}

const LOC = /^\/(?:intl\/)?[a-z]{2}(?:[-_][a-z]{2,4})?(?=\/|$)/i;
function scoped(urls, host, prefix) {
  const out = new Set();
  for (const u of urls) { let p; try { const o = new URL(u); if (o.hostname.replace(/^www\./, "") !== host.replace(/^www\./, "")) continue; p = o.pathname; } catch { continue; }
    if (prefix) { if (p.toLowerCase().startsWith(prefix.toLowerCase() + "/")) out.add(p.slice(prefix.length)); else if (p.toLowerCase() === prefix.toLowerCase()) out.add("/"); }
    else if (!LOC.test(p) || p === "/") out.add(p); }
  return out;
}
const norm = (p) => p.replace(/\/+$/, "").replace(/\.(html?|php)$/, "").toLowerCase() || "/";
const CATS = { blog: /\/(blog|news|stories|story|insights?|articles?|resources?|press|magazine|journal|guides?|learn|advice|help-centre|inspiration)(\/|$)/, about: /\/(about|company|our-story|who-we-are|sustainab|mission|values|our-|why-)/, product: /\/(products?|features?|pricing|solutions?|services?|plans?|offers?|cars|models|range)(\/|$)/ };

function inspect(r) {
  const html = r.body.length ? r.body.subarray(0, 600000).toString("utf8") : "";
  const tags = [...html.matchAll(/<link[^>]+hreflang=["']([^"']+)["'][^>]*>/gi)].map((m) => ({ l: m[1].toLowerCase(), h: (m[0].match(/href=["']([^"']+)/i) ?? [])[1] }));
  const hdr = [...(r.linkHdr ?? "").matchAll(/<([^>]+)>;\s*rel="alternate";\s*hreflang="([^"]+)"/gi)].map((m) => ({ l: m[2].toLowerCase(), h: m[1] }));
  const alts = [...tags, ...hdr];
  const lang = (html.match(/<html[^>]*\slang=["']([^"']+)/i) ?? [])[1] ?? null;
  const title = (html.match(/<title[^>]*>([^<]{0,120})/i) ?? [])[1]?.trim() ?? null;
  const blocked = /captcha|access denied|just a moment|attention required|are you a robot|akamai|px-captcha/i.test(html.slice(0, 4000)) && html.length < 20000;
  return { alts, lang, title, blocked, bytes: r.body.length };
}

async function probeSide(base) {
  const { host, prefix } = splitBase(base);
  const url = `https://${host}${prefix || "/"}`;
  const key = "home:" + url; if (!cache[key]) { const r = await polite(url); cache[key] = { code: r.code, final: r.final, hops: r.hops, ...inspect(r) }; }
  return { host, prefix, url, ...cache[key] };
}

const hasLoc = (alts, re) => alts.filter((a) => re.test(a.l));
async function probeBrand(row) {
  const [brand, home, ukBase, usBase, source, note] = row;
  if (ukBase === usBase) return { brand, home_country: home, uk_base: ukBase, us_base: usBase, source, status: "excluded", verification: "same base on both sides; not a pair", note };
  const uk = await probeSide(ukBase), us = await probeSide(usBase);
  const ok = (s) => s.code >= 200 && s.code < 300;
  const geo = (s) => { try { const f = new URL(s.final); const want = new URL(s.url); const fp = f.pathname.toLowerCase(), wp = want.pathname.toLowerCase();
    const foreign = /^\/(?:[a-z]{2}[-_])?(de|fr|es|it|nl|pt|pl|sv|da|nb|fi|ja|jp|ko|zh|ru|tr|ar|at|ch|be|ie|ca|au|nz|in|eu|row|intl|global|en[-_]?(ie|ca|au|eu|de|row|ae|in|nz|sg))(?=[\/_-]|$)/i.test(fp) || /^(de|fr|es|it|nl|ca|au|ie|eu|row)\./i.test(f.hostname);
    return { redirected: f.hostname !== want.hostname || fp.replace(/\/$/, "") !== wp.replace(/\/$/, ""), final: s.final, foreign }; } catch { return { redirected: null, final: s.final, foreign: false }; } };
  const ugeo = geo(uk), sgeo = geo(us);
  // hreflang cross-reference
  const ukSelf = hasLoc(uk.alts, /^en-gb$/), usSelf = hasLoc(us.alts, /^en-us$/);
  const ukSeesUs = hasLoc(uk.alts, /^en-us$/).length > 0 || hasLoc(uk.alts, /^x-default$/).length > 0 && hasLoc(uk.alts, /^en-us$/).length > 0;
  const usSeesUk = hasLoc(us.alts, /^en-gb$/).length > 0;
  const hreflang = ukSeesUs && usSeesUk ? "mutual" : (usSeesUk || ukSeesUs || ukSelf.length || usSelf.length) ? "partial" : (uk.alts.length + us.alts.length ? "other-locales-only" : "none");
  const langOk = (l, re) => !l || re.test(l);
  const distinct = uk.final.replace(/\/$/, "") !== us.final.replace(/\/$/, "");
  const reasons = [];
  if (!ok(uk)) reasons.push(`uk ${uk.code}${uk.blocked ? " blocked" : ""}`); if (!ok(us)) reasons.push(`us ${us.code}${us.blocked ? " blocked" : ""}`);
  if (ok(uk) && ok(us) && !distinct) reasons.push("both bases land on the same URL");
  if (ugeo.foreign) reasons.push("uk base geo-redirected to a non-UK locale"); if (sgeo.foreign) reasons.push("us base geo-redirected to a non-US locale");
  if (ok(uk) && !langOk(uk.lang, /^en/i)) reasons.push(`uk lang=${uk.lang}`); if (ok(us) && !langOk(us.lang, /^en/i)) reasons.push(`us lang=${us.lang}`);
  const botCodes = [401, 403, 406, 418, 429, 500]; const bot = (x) => botCodes.includes(x.code) || x.blocked;
  let status = reasons.some((r) => /geo-redirected|same URL/.test(r)) ? "geo-trapped" : (bot(uk) || bot(us)) ? "bot-blocked" : [uk, us].some((x) => !ok(x)) ? "not-found" : reasons.length ? "unverified" : hreflang === "mutual" ? "verified-hreflang" : "verified-200";
  // sitemaps
  let pairs = null;
  if (status.startsWith("verified") || status === "geo-trapped") {
    try {
      let a = await sitemapUrls(uk.host, uk.prefix), b = await sitemapUrls(us.host, us.prefix);
      let A = scoped(a.urls, uk.host, uk.prefix), B = scoped(b.urls, us.host, us.prefix);
      for (const [side, h, p] of [["a", uk.host, uk.prefix], ["b", us.host, us.prefix]]) {
        const cur = side === "a" ? A : B; if (cur.size) continue;
        for (const alt of [`https://${h}${p}/sitemap.xml`, `https://${h}/sitemap_index.xml`, `https://${h}/sitemap-index.xml`]) {
          const k = "smalt:" + alt; if (!(k in cache)) { const r = await polite(alt); let urls = []; if (r.code === 200) { const x = text(r.body); urls = locs(x); if (/<sitemapindex/i.test(x)) { const kid = urls.find((u) => !p || u.toLowerCase().includes(p.replace(/\//g, "").toLowerCase())) ?? urls[0]; urls = []; if (kid) { const rr = await polite(kid); if (rr.code === 200) urls = locs(text(rr.body)); } } } cache[k] = { urls: urls.slice(0, 200000) }; }
          const got = scoped(cache[k].urls, h, p); if (got.size) { if (side === "a") A = got; else B = got; break; }
        }
      }
      const nA = new Map([...A].map((p) => [norm(p), p])), inter = [...B].map(norm).filter((p) => nA.has(p) && p !== "/");
      const cat = Object.fromEntries(Object.entries(CATS).map(([k, re]) => [k, inter.filter((p) => re.test(p + "/")).length]));
      pairs = { uk_urls: A.size, us_urls: B.size, matching_paths: inter.length, ...cat, longform_guess: cat.blog + cat.about + cat.product, uk_sitemap: a.note || a.first, us_sitemap: b.note || b.first };
      if (!A.size || !B.size) pairs.note = "a sitemap gave no URLs in scope";
    } catch (e) { pairs = { error: String(e).slice(0, 80) }; }
  }
  return { brand, home_country: home, uk_base: ukBase, us_base: usBase, source, status, verification: { uk: { code: uk.code, final: uk.final, lang: uk.lang, hreflang_gb: ukSelf.length > 0, geo: ugeo.redirected }, us: { code: us.code, final: us.final, lang: us.lang, hreflang_us: usSelf.length > 0, geo: sgeo.redirected }, hreflang, reasons }, pair_potential: pairs, note: note ?? null };
}

const prev = DEEP && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const deepSet = prev ? new Set(prev.candidates.filter((r) => r.status.startsWith("verified") && !(r.pair_potential?.matching_paths > 0)).map((r) => r.brand)) : null;
const rows = SEED.filter((r) => (!ONLY || r[0].toLowerCase().includes(ONLY.toLowerCase())) && (!deepSet || deepSet.has(r[0])));
const results = []; let i = 0;
async function worker() { while (i < rows.length) { const row = rows[i++]; try { const r = await probeBrand(row); results.push(r); console.error(`${results.length}/${rows.length} ${r.brand}: ${r.status} ${r.pair_potential?.matching_paths ?? "-"}`); } catch (e) { results.push({ brand: row[0], uk_base: row[2], us_base: row[3], status: "error", verification: String(e).slice(0, 100) }); } if (results.length % 10 === 0) save(); } }
await Promise.all(Array.from({ length: 6 }, worker)); save();
if (prev) { const m = new Map(prev.candidates.map((r) => [r.brand, r])); for (const r of results) m.set(r.brand, r); results.length = 0; results.push(...m.values()); }
results.sort((a, b) => (b.pair_potential?.longform_guess ?? -1) - (a.pair_potential?.longform_guess ?? -1));
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), probe_host: "VPS Germany (Hetzner), IPv4 curl, Accept-Language en-GB", summary: Object.fromEntries([...new Set(results.map((r) => r.status))].map((s) => [s, results.filter((r) => r.status === s).length])), candidates: results }, null, 1));
