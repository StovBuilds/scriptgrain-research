#!/usr/bin/env node
// SGR-028 PILOT. ~10 UK brands with 30+ dated pages each side of ChatGPT's launch. Streams each brand's
// file from the Storage Box (never staged locally), prints numbers only. Optional US instrument check.
//   node scripts/experiments/sgr-028/pilot.mjs [--brands a.com,b.com] [--out file.json]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { measurePage } from "./measure.mjs";
import { SPELLING_PAIRS, PHRASES, buildLookup } from "./terms.mjs";
const LOOK = buildLookup();

const here = new URL(".", import.meta.url).pathname;
const RCLONE = process.env.RCLONE ?? `${process.env.HOME}/bin/rclone`;
const args = process.argv.slice(2);
const argv = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

function parseCsv(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
  const [h, ...rest] = out; return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// Pre-registration section 2: the period of a page.
export const DATED = new Set(["meta", "jsonld", "url", "text"]);
export function period(row) {
  const d = row.date_best, s = row.date_source;
  if (!d) return null;
  const year = d.length === 4;
  if (s === "captured") return d <= "2022-11" ? "before" : null;   // Wayback capture month is an upper bound on publication
  if (!DATED.has(s)) return null;                                   // 'modified' and undated never count
  if (year) return +d <= 2021 ? "before" : +d >= 2023 ? "after" : null; // year-only 2022 could be December: excluded
  if (d <= "2022-11") return "before";
  if (d >= "2023-01") return row.source === "wayback" ? null : "after";  // 'after' = live pages only; December 2022 is a buffer
  return null;
}

const manifest = parseCsv(readFileSync(here + "../brand-corpus/manifest.csv", "utf8"));
const byBrand = new Map();
for (const r of manifest) { if (!byBrand.has(r.domain)) byBrand.set(r.domain, { sector: r.sector, rows: [] }); byBrand.get(r.domain).rows.push(r); }
const eligible = [];
for (const [domain, b] of byBrand) {
  const n = { before: 0, after: 0 };
  for (const r of b.rows) { const p = period(r); if (p) n[p]++; }
  if (n.before >= 30 && n.after >= 30) eligible.push({ domain, sector: b.sector, ...n });
}
let chosen;
if (argv("--brands")) chosen = argv("--brands").split(",");
else {
  const per = {}; chosen = [];
  for (const e of [...eligible].sort((a, b) => hash01("sgr028" + a.domain) - hash01("sgr028" + b.domain))) {
    if ((per[e.sector] ?? 0) >= 2 || chosen.length >= 10) continue; per[e.sector] = (per[e.sector] ?? 0) + 1; chosen.push(e.domain);
  }
}
process.stderr.write(`eligible UK brands (30+ dated pages each side): ${eligible.length} of ${byBrand.size}; pilot brands: ${chosen.join(", ")}\n`);

const blank = () => ({ pages: 0, words: 0, us: 0, uk: 0, usOther: 0, ukOther: 0, usIze: 0, ukIze: 0, phr: 0, terms: {}, phrases: {}, markers: {} });
const add = (a, m) => { a.pages++; a.words += m.words; for (const k of ["us", "uk", "usOther", "ukOther", "usIze", "ukIze"]) a[k] += m[k];
  for (const [k, v] of Object.entries(m.phrases)) { a.phrases[k] = (a.phrases[k] ?? 0) + v; a.phr += v; }
  for (const [k, v] of Object.entries(m.terms)) a.terms[k] = (a.terms[k] ?? 0) + v;
  for (const [k, v] of Object.entries(m.markers)) a.markers[k] = (a.markers[k] ?? 0) + v; };
const share = (u, k) => (u + k > 0 ? u / (u + k) : null);
const stats = (a) => ({ pages: a.pages, words: a.words, variant_tokens: a.us + a.uk, us_share: share(a.us, a.uk), us_share_nonize: share(a.usOther, a.ukOther), us_share_ize: share(a.usIze, a.ukIze), phrases_per_1000: a.words ? (1000 * a.phr) / a.words : null });
const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

function readBrand(remotePrefix, domain) {
  const buf = execFileSync(RCLONE, ["cat", `${remotePrefix}/${domain}.jsonl.gz`], { maxBuffer: 1 << 30 });
  return gunzipSync(buf).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const REMOTE = "storagebox:research/scriptgrain-brand-corpus/v1/pages";
const result = { brands: {}, pooled: { before: blank(), after: blank() }, notes: {} };
const termSides = { before: {}, after: {} }; const accs = {};
for (const domain of chosen) {
  const label = domain.split(".")[0];
  const meta = new Map(byBrand.get(domain).rows.map((r) => [r.sha256, r]));
  const acc = { before: blank(), after: blank() };
  const seen = new Set();
  let rows; try { rows = readBrand(REMOTE, domain); } catch (e) { process.stderr.write(`no file ${domain}\n`); continue; }
  for (const r of rows) {
    const mr = meta.get(r.sha256); if (!mr || seen.has(r.sha256)) continue; seen.add(r.sha256);
    const p = period(mr); if (!p) continue;
    const m = measurePage(r.markdown ?? "", label);
    add(acc[p], m);
  }
  accs[domain] = acc;
  result.brands[domain] = { sector: byBrand.get(domain).sector, before: stats(acc.before), after: stats(acc.after) };
}
const ALL = Object.entries(result.brands);
// House-style guard (pre-registration section 4): a brand whose BEFORE-period American share is above 0.5 writes American, not British.
result.flagged_american_house = ALL.filter(([, b]) => (b.before.us_share ?? 0) > 0.5).map(([k]) => k);
for (const [k, acc] of Object.entries(accs)) { if (result.flagged_american_house.includes(k)) continue;
  for (const p of ["before", "after"]) { add(result.pooled[p], { ...acc[p], words: 0, phrases: {}, terms: {}, markers: {} }); } }
// (re-pool with full fields)
result.pooled = { before: blank(), after: blank() };
for (const [k, acc] of Object.entries(accs)) { if (result.flagged_american_house.includes(k)) continue;
  for (const p of ["before", "after"]) { const a = acc[p], P = result.pooled[p];
    P.pages += a.pages; P.words += a.words; for (const f of ["us", "uk", "usOther", "ukOther", "usIze", "ukIze", "phr"]) P[f] += a[f];
    for (const f of ["terms", "phrases", "markers"]) for (const [t, v] of Object.entries(a[f])) P[f][t] = (P[f][t] ?? 0) + v; } }
for (const p of ["before", "after"]) termSides[p] = result.pooled[p].terms;
const B = ALL.filter(([k]) => !result.flagged_american_house.includes(k)).map(([, b]) => b);
const d = (k) => B.map((b) => (b.after[k] != null && b.before[k] != null ? b.after[k] - b.before[k] : null));
result.summary = {
  brands_used: B.length, flagged_american_house: result.flagged_american_house,
  pooled_before: stats(result.pooled.before), pooled_after: stats(result.pooled.after),
  mean_brand_before: Object.fromEntries(["us_share", "us_share_nonize", "us_share_ize", "phrases_per_1000"].map((k) => [k, mean(B.map((b) => b.before[k]))])),
  mean_brand_after: Object.fromEntries(["us_share", "us_share_nonize", "us_share_ize", "phrases_per_1000"].map((k) => [k, mean(B.map((b) => b.after[k]))])),
  mean_within_brand_change: Object.fromEntries(["us_share", "us_share_nonize", "us_share_ize", "phrases_per_1000"].map((k) => [k, mean(d(k))])),
  brands_up: Object.fromEntries(["us_share", "us_share_nonize", "phrases_per_1000"].map((k) => [k, d(k).filter((x) => x != null && x > 0).length])),
  phrases_before: result.pooled.before.phrases, phrases_after: result.pooled.after.phrases,
  uk_markers_before: result.pooled.before.markers, uk_markers_after: result.pooled.after.markers,
};
// misfire watch: top terms by count on each side (counts only)
const top = (o, n = 25) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
result.summary.top_terms_before = top(termSides.before); result.summary.top_terms_after = top(termSides.after);
const usOnly = (o) => Object.fromEntries(Object.entries(o).filter(([w]) => LOOK.get(w)?.side === "us"));
result.summary.us_side_terms_before = top(usOnly(termSides.before), 20); result.summary.us_side_terms_after = top(usOnly(termSides.after), 20);

// US instrument check: live US pages should be ~all American spelling. Reads up to 5 US brands that already have a file.
try {
  const US = "storagebox:research/scriptgrain-brand-corpus-us/v1/pages";
  const usRows = parseCsv(readFileSync(here + "../brand-corpus-us/manifest.csv", "utf8"));
  const doms = [...new Set(usRows.map((r) => r.domain))].slice(0, 5);
  const a = blank(); const per = {};
  for (const dom of doms) { try { const acc = blank(); for (const r of readBrand(US, dom).slice(0, 80)) { const m = measurePage(r.markdown ?? "", dom.split(".")[0]); add(acc, m); add(a, m); } per[dom] = stats(acc); } catch {} }
  result.us_check = { brands: Object.keys(per).length, pooled: stats(a), per_brand: per, top_terms: top(a.terms, 15), note: "no dates in the US manifest yet; instrument sanity check only" };
} catch (e) { result.us_check = { error: String(e).slice(0, 100) }; }

const f = argv("--out"); if (f) writeFileSync(f, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result.summary, null, 1)); console.log(JSON.stringify(result.us_check, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.brands).map(([k, v]) => [k, [v.sector, v.before.pages, v.after.pages, v.before.us_share, v.after.us_share, v.before.phrases_per_1000, v.after.phrases_per_1000]]))));
