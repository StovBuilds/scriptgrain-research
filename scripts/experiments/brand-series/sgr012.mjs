#!/usr/bin/env bun
// SGR-012: does a brand keep one voice across its press releases and blog? Pre-registration
// section 5 + clarification 2. Reads page text from the Storage Box for eligible brands,
// scores ordered pairs with the counted-features voice score (production computeVoiceMatch,
// pseudoProfileFromText, no judge, no phrases) and writes summary-012.json (numbers only).
//   bun scripts/experiments/brand-series/sgr012.mjs [--boot 2000]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { measureTextFeatures, pseudoProfileFromText, computeVoiceMatch } from "../../../supabase/functions/_shared/voice-match.ts";
import { mdToPlain } from "./measure.mjs";

const dir = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const B = Number(args.includes("--boot") ? args[args.indexOf("--boot") + 1] : 2000);
const STRICT = new Set(["meta", "jsonld", "url", "captured"]);
const M = readFileSync(dir + "measures.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const cat = (c) => (c === "blog" ? "blog" : c === "press" || c === "announcement" ? "press" : null);
const pick = M.filter((x) => x.era === "AFTER" && STRICT.has(x.date_source) && cat(x.category) && x.words >= 300);
const byBrand = new Map(); for (const x of pick) { if (!byBrand.has(x.brand)) byBrand.set(x.brand, []); byBrand.get(x.brand).push(x); }
const eligible = [...byBrand].filter(([, xs]) => xs.filter((x) => cat(x.category) === "blog").length >= 8 && xs.filter((x) => cat(x.category) === "press").length >= 8).map(([b]) => b);
console.log("eligible brands", eligible.length);

// measure each eligible page from its stored text (the same plain text measure.mjs measured)
const pages = [];
for (const b of eligible) {
  const want = new Map(byBrand.get(b).map((x) => [x.url, x]));
  const rows = gunzipSync(execFileSync("rclone", ["cat", `storagebox:research/scriptgrain-brand-corpus/v1/pages/${b}.jsonl.gz`], { maxBuffer: 1 << 30 })).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const seen = new Set();
  for (const r of rows) {
    const m = want.get(r.url); if (!m || seen.has(r.url)) continue; seen.add(r.url);
    const f = measureTextFeatures(mdToPlain(r.markdown ?? ""));
    pages.push({ brand: b, sector: m.sector, cat: cat(m.category), f, prof: pseudoProfileFromText(f, null) });
  }
}
console.log("pages", pages.length);

// score ordered pairs of the three kinds; keep per-baseline-brand lists of raw scores
const NO = { pool: 0, hits: 0, found: [] };
const per = new Map(); // brand -> {sbsc:[], sboc:[], obsc:[]}
for (const b of eligible) per.set(b, { sbsc: [], sboc: [], obsc: [] });
let n = 0;
for (const a of pages) for (const o of pages) {
  if (a === o || a.sector !== o.sector) continue;
  const kind = a.brand === o.brand ? (a.cat === o.cat ? "sbsc" : "sboc") : a.cat === o.cat ? "obsc" : null;
  if (!kind) continue;
  per.get(a.brand)[kind].push(computeVoiceMatch(a.prof, o.f, null, NO).raw); n++;
}
console.log("pairs", n);

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const r = (x) => Math.round(x * 1000) / 1000;
const brandStat = Object.fromEntries(eligible.map((b) => { const p = per.get(b); return [b, { sbsc: med(p.sbsc), sboc: med(p.sboc), obsc: med(p.obsc), n: { sbsc: p.sbsc.length, sboc: p.sboc.length, obsc: p.obsc.length } }]; }));
const sectorOf = Object.fromEntries(pages.map((p) => [p.brand, p.sector]));
const sectors = [...new Set(eligible.map((b) => sectorOf[b]))];
let seed = 0x5012;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function boot(stat) {
  const point = stat(eligible), groups = sectors.map((s) => eligible.filter((b) => sectorOf[b] === s)), d = [];
  for (let i = 0; i < B; i++) { const pk = []; for (const g of groups) for (let k = 0; k < g.length; k++) pk.push(g[Math.floor(rnd() * g.length)]); d.push(stat(pk)); }
  return { point: r(point), lo: r(q(d, 0.025)), hi: r(q(d, 0.975)), n: eligible.length };
}
const c1 = boot((bs) => mean(bs.map((b) => brandStat[b].sbsc - brandStat[b].sboc)));
// C2 needs another eligible brand in the same sector; a brand alone in its sector has no OB-SC pairs.
const fin = (xs) => xs.filter(Number.isFinite);
const c2 = boot((bs) => mean(fin(bs.map((b) => brandStat[b].obsc - brandStat[b].sboc))));
const c2Brands = eligible.filter((b) => Number.isFinite(brandStat[b].obsc)).length;
const levels = { sbsc: r(mean(eligible.map((b) => brandStat[b].sbsc))), sboc: r(mean(eligible.map((b) => brandStat[b].sboc))), obsc: r(mean(fin(eligible.map((b) => brandStat[b].obsc)))), obsc_brands: c2Brands };
// exploratory: by channel of the baseline page; share of brands where each holds
const brandsC1 = eligible.filter((b) => brandStat[b].sbsc > brandStat[b].sboc).length, brandsC2 = eligible.filter((b) => brandStat[b].obsc > brandStat[b].sboc).length;
// exploratory: blog-vs-blog of other brands vs own blog-vs-press, per channel of baseline
const out = {
  study: "SGR-012", pages: pages.length, pairs: n, brands: eligible.length,
  bySector: Object.fromEntries(sectors.map((s) => [s, { brands: eligible.filter((b) => sectorOf[b] === s).length, sbsc: r(mean(eligible.filter((b) => sectorOf[b] === s).map((b) => brandStat[b].sbsc))), sboc: r(mean(eligible.filter((b) => sectorOf[b] === s).map((b) => brandStat[b].sboc))), obsc: r(mean(fin(eligible.filter((b) => sectorOf[b] === s).map((b) => brandStat[b].obsc)))) || null }])),
  levels, C1: { ...c1, result: c1.lo > 0 ? "supported" : c1.hi < 0 ? "reversed" : "not supported", brandsWhereHolds: brandsC1 },
  C2: { ...c2, n: c2Brands, result: c2.lo > 0 ? "supported" : c2.hi < 0 ? "reversed" : "not supported", brandsWhereHolds: brandsC2 },
  brandStat,
};
writeFileSync(dir + "summary-012.json", JSON.stringify(out, null, 1));
console.log("levels", JSON.stringify(levels)); console.log("C1", JSON.stringify(out.C1)); console.log("C2", JSON.stringify(out.C2));
