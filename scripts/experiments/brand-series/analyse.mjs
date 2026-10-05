#!/usr/bin/env bun
// Brand writing series: analyses for SGR-010 (overview) and SGR-011 (before/after ChatGPT),
// exactly as docs/research/brand-series-preregistration.md sections 3-4 say. Reads
// measures.jsonl, writes summary-010.json and summary-011.json.
//   bun scripts/experiments/brand-series/analyse.mjs [--boot 2000]
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const B = Number(args.includes("--boot") ? args[args.indexOf("--boot") + 1] : 2000);
const P = readFileSync(dir + "measures.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));

const MEASURES = ["ai_ism_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "quiet_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "sentence_variation", "short_sentence_share", "contractions_per1000", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "you_share", "we_share", "i_share", "long_word_share", "words"];
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const r = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
let seed = 0x5010;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sectorOf = Object.fromEntries(P.map((p) => [p.brand, p.sector]));
const sectors = [...new Set(P.map((p) => p.sector))];

/** Cluster bootstrap over brands (resampled within sectors) of stat(brandList) -> number. */
function bootstrap(brands, stat) {
  const point = stat(brands);
  const bySector = sectors.map((s) => brands.filter((b) => sectorOf[b] === s)).filter((x) => x.length);
  const draws = [];
  for (let i = 0; i < B; i++) { const pick = []; for (const g of bySector) for (let k = 0; k < g.length; k++) pick.push(g[Math.floor(rnd() * g.length)]); draws.push(stat(pick)); }
  return { point: r(point), lo: r(q(draws, 0.025)), hi: r(q(draws, 0.975)), lo90: r(q(draws, 0.05)), hi90: r(q(draws, 0.95)), n: brands.length };
}
const byBrand = (rows) => { const m = new Map(); for (const x of rows) { if (!m.has(x.brand)) m.set(x.brand, []); m.get(x.brand).push(x); } return m; };

// ── SGR-010 ─────────────────────────────────────────────────────────────────
function pctTable(rows, key) {
  // brand-weighted: each brand's mean, then percentiles over brands; plus page-level percentiles
  const bm = [...byBrand(rows).values()].map((xs) => mean(xs.map((x) => x[key]).filter(Number.isFinite)));
  const pages = rows.map((x) => x[key]).filter(Number.isFinite);
  return { pages: pages.length, brands: bm.length, page_p: [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => r(q(pages, p))), brand_mean_p: [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => r(q(bm.filter(Number.isFinite), p))), brand_weighted_mean: r(mean(bm.filter(Number.isFinite))) };
}
const s010 = { pages: P.length, brands: new Set(P.map((p) => p.brand)).size, byCategory: {}, bySector: {}, counts: {} };
for (const c of ["blog", "press", "announcement", "info_pack"]) s010.byCategory[c] = Object.fromEntries(MEASURES.map((m) => [m, pctTable(P.filter((p) => p.category === c), m)]));
for (const s of sectors) s010.bySector[s] = Object.fromEntries(MEASURES.map((m) => [m, pctTable(P.filter((p) => p.sector === s && p.category !== "info_pack"), m)]));
s010.counts = { byCategory: Object.fromEntries(["blog", "press", "announcement", "info_pack"].map((c) => [c, P.filter((p) => p.category === c).length])), bySource: { live: P.filter((p) => p.source === "live").length, wayback: P.filter((p) => p.source === "wayback").length }, byEra: Object.fromEntries(["PRE2015", "EARLY", "LATE", "TRANSITION", "AFTER", null].map((e) => [e ?? "undated", P.filter((p) => p.era === e).length])) };
// O1 / O2: within brand, brands with >=10 press and >=10 blog pages
{
  const eligible = [...byBrand(P).entries()].filter(([, xs]) => xs.filter((x) => x.category === "press").length >= 10 && xs.filter((x) => x.category === "blog").length >= 10).map(([b]) => b);
  const BB = byBrand(P);
  const diff = (key, a, b) => (brands) => mean(brands.map((br) => mean(BB.get(br).filter((x) => x.category === a).map((x) => x[key]).filter(Number.isFinite)) - mean(BB.get(br).filter((x) => x.category === b).map((x) => x[key]).filter(Number.isFinite))));
  const o1 = bootstrap(eligible, diff("avg_sentence_length", "press", "blog"));
  const o2 = bootstrap(eligible, diff("you_share", "blog", "press"));
  s010.O1 = { ...o1, result: o1.lo > 0 ? "supported" : o1.hi < 0 ? "reversed" : "not supported", test: "press minus blog, average sentence length (words)" };
  s010.O2 = { ...o2, result: o2.lo > 0 ? "supported" : o2.hi < 0 ? "reversed" : "not supported", test: "blog minus press, share of 'you'" };
  // exploratory: every measure, press vs blog within brand
  s010.pressVsBlog = Object.fromEntries(MEASURES.map((m) => [m, bootstrap(eligible, diff(m, "press", "blog"))]));
}
writeFileSync(dir + "summary-010.json", JSON.stringify(s010, null, 1));

// ── SGR-011 ─────────────────────────────────────────────────────────────────
const STRICT = new Set(["meta", "jsonld", "url", "captured"]);
const catOf = (c) => (c === "announcement" ? "press" : c);
function cells(rows, { strict = true, transitionAsAfter = false } = {}) {
  const ok = rows.filter((x) => x.category !== "info_pack" && x.era && (!strict || STRICT.has(x.date_source) || x.source === "wayback"));
  const m = new Map();
  for (const x of ok) {
    const k = `${x.brand}|${catOf(x.category)}`;
    if (!m.has(k)) m.set(k, { brand: x.brand, sector: x.sector, cat: catOf(x.category), EARLY: [], LATE: [], AFTER: [], TRANSITION: [] });
    const era = transitionAsAfter && x.era === "TRANSITION" ? "AFTER" : x.era;
    if (m.get(k)[era]) m.get(k)[era].push(x);
  }
  return [...m.values()];
}
const yr = (d) => (d ? +d.slice(0, 4) + (+(d.slice(5, 7) || 6) - 0.5) / 12 : NaN);
function changeStat(eligibleCells, key, from, to, perYear = false) {
  // brand-weighted mean of cell changes
  const byB = new Map();
  for (const c of eligibleCells) { if (!byB.has(c.brand)) byB.set(c.brand, []); byB.get(c.brand).push(c); }
  return (brands) => mean(brands.map((b) => mean(byB.get(b).map((c) => {
    const d = mean(c[to].map((x) => x[key]).filter(Number.isFinite)) - mean(c[from].map((x) => x[key]).filter(Number.isFinite));
    if (!perYear) return d;
    const span = q(c[to].map((x) => yr(x.date)), 0.5) - q(c[from].map((x) => yr(x.date)), 0.5);
    return span > 0 ? d / span : NaN;
  }).filter(Number.isFinite))));
}
function within(rows, key, opts = {}) {
  const cs = cells(rows, opts).filter((c) => c.LATE.length >= 10 && c.AFTER.length >= 10);
  const brands = [...new Set(cs.map((c) => c.brand))];
  // Levels are brand-weighted like the change: each brand's cell means, averaged within brand, then over brands.
  const level = (era) => { const byB = new Map(); for (const c of cs) { if (!byB.has(c.brand)) byB.set(c.brand, []); byB.get(c.brand).push(mean(c[era].map((x) => x[key]).filter(Number.isFinite))); } return mean([...byB.values()].map(mean)); };
  return { cells: cs.length, ...bootstrap(brands, changeStat(cs, key, "LATE", "AFTER")), late_mean: r(level("LATE")), after_mean: r(level("AFTER")) };
}
const s011 = {};
s011.H1 = within(P, "ai_ism_per1000"); s011.H1.result = s011.H1.lo > 0 ? "supported" : "not supported";
{
  const cs = cells(P).filter((c) => c.EARLY.length >= 10 && c.LATE.length >= 10 && c.AFTER.length >= 10);
  const brands = [...new Set(cs.map((c) => c.brand))];
  const a = changeStat(cs, "ai_ism_per1000", "LATE", "AFTER", true), e = changeStat(cs, "ai_ism_per1000", "EARLY", "LATE", true);
  const h2 = bootstrap(brands, (bs) => a(bs) - e(bs));
  s011.H2 = { cells: cs.length, ...h2, late_to_after_per_year: r(a(brands)), early_to_late_per_year: r(e(brands)), result: h2.lo > 0 ? "supported" : "not supported" };
}
s011.H3 = within(P, "em_dash_per1000"); s011.H3.result = s011.H3.lo > 0 ? "supported" : "not supported";
s011.H4 = within(P, "ai_shape_per1000"); s011.H4.result = s011.H4.lo > 0 ? "supported" : "not supported";
s011.H5 = within(P, "avg_sentence_length"); s011.H5.result = s011.H5.lo90 > -1.5 && s011.H5.hi90 < 1.5 ? "supported" : "not supported";
// robustness
const ROB = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length", "quiet_per1000", "contractions_per1000", "you_share", "sentence_variation", "marketing_per1000", "old_per1000", "called_out_per1000"];
s011.allMeasures = Object.fromEntries(ROB.map((m) => [m, within(P, m)]));
s011.byCategory = Object.fromEntries(["blog", "press"].map((c) => [c, Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((m) => [m, within(P.filter((x) => catOf(x.category) === c), m)]))]));
s011.bySector = Object.fromEntries(sectors.map((s) => [s, Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((m) => [m, within(P.filter((x) => x.sector === s), m)]))]));
s011.withGuessedDates = Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((m) => [m, within(P, m, { strict: false })]));
s011.transitionAsAfter = Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000"].map((m) => [m, within(P, m, { transitionAsAfter: true })]));
// (a) source check: live vs archived pages from 2019-22, same brand
{
  const late = P.filter((x) => x.era === "LATE" && x.category !== "info_pack");
  const BB = byBrand(late);
  const brands = [...BB.entries()].filter(([, xs]) => xs.filter((x) => x.source === "live").length >= 10 && xs.filter((x) => x.source === "wayback").length >= 10).map(([b]) => b);
  s011.sourceCheck = Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((m) => [m, bootstrap(brands, (bs) => mean(bs.map((b) => mean(BB.get(b).filter((x) => x.source === "live").map((x) => x[m]).filter(Number.isFinite)) - mean(BB.get(b).filter((x) => x.source === "wayback").map((x) => x[m]).filter(Number.isFinite)))))]));
}
// year series (descriptive): brand-weighted mean per calendar year, dated pages, strict dates
{
  const ok = P.filter((x) => x.category !== "info_pack" && x.date && (STRICT.has(x.date_source) || x.source === "wayback"));
  s011.byYear = {};
  for (let y = 2015; y <= 2026; y++) {
    const ys = ok.filter((x) => +x.date.slice(0, 4) === y);
    const BB = byBrand(ys);
    s011.byYear[y] = { pages: ys.length, brands: BB.size, ...Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length", "contractions_per1000", "you_share"].map((m) => [m, r(mean([...BB.values()].map((xs) => mean(xs.map((x) => x[m]).filter(Number.isFinite))).filter(Number.isFinite)))])) };
  }
}
writeFileSync(dir + "summary-011.json", JSON.stringify(s011, null, 1));
console.log("SGR-010 O1", JSON.stringify(s010.O1), "\nSGR-010 O2", JSON.stringify(s010.O2));
for (const h of ["H1", "H2", "H3", "H4", "H5"]) console.log("SGR-011", h, JSON.stringify(s011[h]));
console.log("source check", JSON.stringify(s011.sourceCheck));
