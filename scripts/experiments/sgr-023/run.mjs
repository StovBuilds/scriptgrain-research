#!/usr/bin/env bun
// SGR-023: What reading age do UK brands write for? Full measurement and analysis, exactly as
// docs/research/sgr-023-preregistration.md says. Reads the brand deep corpus v1.4 from disk,
// writes numbers only (no page text) to public/research/sgr-023-*.
//   bun scripts/experiments/sgr-023/run.mjs [--pilot] [--boot 2000] [--brands dir] [--out dir]
// --pilot: 5 of 122 brands (fixed by hash), 200 resamples, writes to ~/research/sgr-023/pilot-out and never touches the repo.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mdToPlain, era } from "../brand-series/measure.mjs";
import { bestDate } from "../brand-corpus/dates.mjs";
import { scorePage, proseLines, splitProse, tokens, tokenSyllables } from "./readability.mjs";
import { syllables, hash01 as hashSyl } from "./syllables.mjs";
import { loadCmu, CMU_SHA256 } from "./cmu.mjs";
import { mean, median, quantile, round, bootstrap, verdict, pearson, hash01, rng } from "./stats.mjs";
import { charts } from "./charts.mjs";

const t0 = Date.now();
const args = process.argv.slice(2), opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const SYNTH = args.includes("--synthetic"); // code test on invented data with known effects; never reported
const PILOT = args.includes("--pilot") || SYNTH;
const B = PILOT ? 200 : Number(opt("--boot", 2000));
const HOME = process.env.HOME;
const BRAND_DIR = opt("--brands", `${HOME}/research/sgr-023/brand`);
const OUT = opt("--out", PILOT ? `${HOME}/research/sgr-023/pilot-out` : "public/research");
mkdirSync(OUT, { recursive: true });
const here = new URL(".", import.meta.url).pathname;
const { brands: ALL_BRANDS } = JSON.parse(readFileSync(here + "../brand-corpus/brands.json", "utf8"));
const SEED = 20261027;
const sectorOf = Object.fromEntries(ALL_BRANDS.map((b) => [b.domain, b.sector]));
const FCA = new Set(["bank", "insurance"]); // sectors whose firms are FCA-regulated retail firms (Consumer Duty)
const STRICT = new Set(["meta", "jsonld", "url", "captured"]);
const words = (t) => (t.match(/\S+/g) ?? []).length;

// ── 1. Read, filter (SGR-010/011 rules), measure ──────────────────────────────
const { dict: CMU, sha: cmuSha } = loadCmu();
const cmuSyl = (w) => { const v = CMU.get(w.toLowerCase().replace(/[^a-z]/g, "")); return v ? v[0] : null; };
let brandList = ALL_BRANDS;
if (PILOT) brandList = [...ALL_BRANDS].sort((a, b) => hash01(a.domain) - hash01(b.domain)).slice(0, 5);
let rows = []; const excl = {}, exclTotal = {};
const bump = (b, k) => { (excl[b] ??= {})[k] = (excl[b][k] ?? 0) + 1; exclTotal[k] = (exclTotal[k] ?? 0) + 1; };
const tokCount = new Map(); // lowercase word -> count, for the corpus-token syllable validation
let pagesRead = 0;
for (const b of SYNTH ? [] : brandList) {
  const file = `${BRAND_DIR}/${b.domain}.jsonl.gz`;
  if (!existsSync(file)) { bump(b.domain, "no_file"); continue; }
  const raw = gunzipSync(readFileSync(file)).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  pagesRead += raw.length;
  raw.sort((x, y) => (bestDate(x).date ?? "9999").localeCompare(bestDate(y).date ?? "9999"));
  const seen = new Set();
  for (const r of raw) {
    const text = mdToPlain(r.markdown ?? "");
    const w = words(text);
    if (w < 150) { bump(b.domain, "under_150_words"); continue; }
    const h = createHash("sha256").update(text).digest("hex");
    if (seen.has(h)) { bump(b.domain, "duplicate_text"); continue; }
    seen.add(h);
    const shortWords = text.split("\n").filter((l) => l.trim() && words(l) <= 6).reduce((a, l) => a + words(l), 0);
    if (shortWords / w > 0.4) { bump(b.domain, "list_like"); continue; }
    if (r.category === "info_pack") { bump(b.domain, "info_pack_not_measured"); continue; }
    const { date, source: dsrc } = bestDate(r);
    const s = scorePage(text, cmuSyl);
    if (!s.scorable) { bump(b.domain, "unscorable_under_100_prose_words_or_5_sentences"); continue; }
    for (const line of proseLines(text)) for (const sent of splitProse(line)) for (const t of tokens(sent)) { if (/^[A-Z]{2,5}$/.test(t)) continue; const k = t.toLowerCase().replace(/[^a-z]/g, ""); if (k) tokCount.set(k, (tokCount.get(k) ?? 0) + 1); }
    rows.push({
      brand: b.domain, sector: b.sector, category: r.category, cat2: r.category === "announcement" ? "press" : r.category, source: r.source ?? "live",
      url: r.url, date, date_source: dsrc, era: era(date), words: w, prose_words: s.words, prose_sentences: s.sentences,
      fk: s.fk, fre: s.fre, reading_age: s.reading_age, asl: s.asl, asw: s.asw, long_word_share: s.long_word_share, poly3_share: s.poly3_share, sent_gt25_share: s.sent_gt25_share,
      fk_ps: s.v_product_split.fk, fre_ps: s.v_product_split.fre, asl_ps: s.v_product_split.asl,
      fk_cmu: s.v_cmu.fk, fre_cmu: s.v_cmu.fre,
    });
  }
}
if (SYNTH) { // known effects: press +1.0 grade over blog; -0.5 per year-block after 2018; FCA sectors -1.0 after July 2023
  const r = rng(7); const g = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 0.7; };
  let k = 0;
  for (const b of ALL_BRANDS) { const base = 9 + 2 * g() / 3; for (const cat of ["blog", "press", "announcement"]) for (let i = 0; i < 60; i++) {
    const yr = 2015 + Math.floor(r() * 12), mo = 1 + Math.floor(r() * 12); const date = `${yr}-${String(mo).padStart(2, "0")}-15`;
    let fk = base + (cat === "press" ? 1 : 0) - (yr >= 2024 ? 0.5 : 0) - (FCA.has(b.sector) && date >= "2023-08" ? 1 : 0) + g() * 0.8;
    const asl = 12 + g(), asw = 1.4 + g() / 50;
    rows.push({ brand: b.domain, sector: b.sector, category: cat, cat2: cat === "announcement" ? "press" : cat, source: yr < 2023 && r() < 0.5 ? "wayback" : "live", url: `https://${b.domain}/${k++}`, date, date_source: "meta", era: era(date), words: 400, prose_words: 300, prose_sentences: 20, fk, fre: 100 - fk * 4, reading_age: fk + 5, asl, asw, long_word_share: 0.15, poly3_share: 0.1, sent_gt25_share: 0.05, fk_ps: fk + 0.1, fre_ps: 0, asl_ps: asl, fk_cmu: fk - 0.1, fre_cmu: 0 }); } }
}
 console.error(`measured ${rows.length} pages from ${new Set(rows.map((r) => r.brand)).size} brands (${Math.round((Date.now() - t0) / 1000)}s)`);
const brandsWithPages = [...new Set(rows.map((r) => r.brand))];
const byBrand = (rs) => { const m = new Map(); for (const x of rs) { if (!m.has(x.brand)) m.set(x.brand, []); m.get(x.brand).push(x); } return m; };
const BB = byBrand(rows);
const bseed = (() => { let i = 0; return () => SEED + 1000 * ++i; })();
const boot = (brands, stat) => bootstrap(brands, stat, { sectorOf, B, seed: bseed() });

// ── 2. Syllable counter validation (method check, pre-registration section 3) ───
function syllableValidation() {
  const evalSet = (pick) => { let n = 0, ex = 0, any = 0, w1 = 0, bias = 0; for (const [w, v] of CMU) { if (!pick(w)) continue; const c = syllables(w); n++; if (c === v[0]) ex++; if (v.includes(c)) any++; if (Math.abs(c - v[0]) <= 1) w1++; bias += c - v[0]; } return { words: n, exact_first: round(ex / n, 4), exact_any: round(any / n, 4), within_one: round(w1 / n, 4), mean_bias: round(bias / n, 4) }; };
  let n = 0, ex = 0, w1 = 0, bias = 0, types = 0, typesCovered = 0;
  for (const [w, c] of tokCount) { types++; const v = CMU.get(w); if (!v) continue; typesCovered++; const s = syllables(w); n += c; if (s === v[0]) ex += c; if (Math.abs(s - v[0]) <= 1) w1 += c; bias += (s - v[0]) * c; }
  const total = [...tokCount.values()].reduce((a, c) => a + c, 0);
  const ys = rows.map((r) => r.fk), yc = rows.map((r) => r.fk_cmu);
  const dev = evalSet((w) => hashSyl(w) < 0.5), test = evalSet((w) => hashSyl(w) >= 0.5);
  const corpus = { tokens: total, covered_tokens: n, covered_share: round(n / total, 4), types, covered_types: typesCovered, exact_first: round(ex / n, 4), within_one: round(w1 / n, 4), mean_bias_per_word: round(bias / n, 4), fk_rule_vs_cmu_pearson: round(pearson(ys, yc), 4), fk_mean_difference_rule_minus_cmu: round(mean(rows.map((r) => r.fk - r.fk_cmu)), 4), fre_mean_difference_rule_minus_cmu: round(mean(rows.map((r) => r.fre - r.fre_cmu)), 4) };
  const pass = corpus.exact_first >= 0.92 && Math.abs(corpus.mean_bias_per_word) <= 0.05 && corpus.fk_rule_vs_cmu_pearson >= 0.98 && Math.abs(corpus.fk_mean_difference_rule_minus_cmu) <= 0.3;
  return { cmu_sha256: cmuSha, frozen_sha256: CMU_SHA256, dev, test, corpus_tokens: corpus, criteria: "corpus-token exact agreement >= 0.92, |mean bias per word| <= 0.05, page FK correlation with the CMU-based FK >= 0.98, |mean FK difference| <= 0.3 grade", pass };
}

// ── 3. Levels: brand-weighted, by sector, category, era ───────────────────────
const MEASURES = ["fk", "reading_age", "fre", "asl", "asw", "long_word_share", "poly3_share", "sent_gt25_share"];
const P5 = [0.1, 0.25, 0.5, 0.75, 0.9];
function level(rs, { ci = true } = {}) {
  const bm = byBrand(rs);
  const out = { pages: rs.length, brands: bm.size, prose_words: rs.reduce((a, x) => a + x.prose_words, 0) };
  for (const m of MEASURES) {
    const per = [...bm.entries()].map(([b, xs]) => [b, mean(xs.map((x) => x[m]))]).filter(([, v]) => Number.isFinite(v));
    const vals = per.map(([, v]) => v);
    out[m] = { brand_mean: round(mean(vals)), brand_median: round(median(vals)), brand_p: P5.map((p) => round(quantile(vals, p))), page_median: round(median(rs.map((x) => x[m]))) };
    if (ci && (m === "fk" || m === "reading_age" || m === "fre") && per.length >= 3) {
      const mp = new Map(per);
      const r = boot(per.map(([b]) => b), (bs) => mean(bs.map((b) => mp.get(b))));
      out[m].brand_mean_ci = [r.lo, r.hi];
      const r2 = boot(per.map(([b]) => b), (bs) => median(bs.map((b) => mp.get(b))));
      out[m].brand_median_ci = [r2.lo, r2.hi];
    }
  }
  return out;
}
const sectors = [...new Set(rows.map((r) => r.sector))].sort();
const levels = { overall: level(rows), by_sector: {}, by_category: {}, by_sector_category: {}, by_era: {}, by_source: {} };
for (const s of sectors) levels.by_sector[s] = level(rows.filter((r) => r.sector === s));
for (const c of ["blog", "press", "announcement"]) levels.by_category[c] = level(rows.filter((r) => r.category === c));
for (const s of sectors) for (const c of ["blog", "press"]) { const rs = rows.filter((r) => r.sector === s && r.cat2 === c); if (rs.length) (levels.by_sector_category[s] ??= {})[c] = level(rs, { ci: false }); }
for (const e of ["PRE2015", "EARLY", "LATE", "TRANSITION", "AFTER"]) levels.by_era[e] = level(rows.filter((r) => r.era === e), { ci: false });
levels.by_era.undated = level(rows.filter((r) => !r.era), { ci: false });
for (const s of ["live", "wayback"]) levels.by_source[s] = level(rows.filter((r) => r.source === s), { ci: false });

// reference: GOV.UK asks writers to split sentences over 25 words
const brandMeanASL = [...BB.entries()].map(([, xs]) => mean(xs.map((x) => x.asl)));
const reference = {
  govuk_25_word_guideline: "GOV.UK: 'Try to split up sentences that are over 25 words long.' (guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)",
  share_of_sentences_over_25_words_brand_mean: levels.overall.sent_gt25_share.brand_mean,
  share_of_brands_with_average_sentence_over_25: round(brandMeanASL.filter((v) => v > 25).length / brandMeanASL.length),
  share_of_pages_with_average_sentence_over_25: round(rows.filter((r) => r.asl > 25).length / rows.length),
  share_of_pages_with_over_a_quarter_of_sentences_over_25: round(rows.filter((r) => r.sent_gt25_share > 0.25).length / rows.length),
};

// decomposition of each sector's FK difference from the all-brand mean into sentence-length and word-length terms
const decomposition = Object.fromEntries(sectors.map((s) => {
  const L = levels.by_sector[s], O = levels.overall;
  const sent = 0.39 * (L.asl.brand_mean - O.asl.brand_mean), word = 11.8 * (L.asw.brand_mean - O.asw.brand_mean);
  return [s, { fk_minus_overall: round(L.fk.brand_mean - O.fk.brand_mean), from_sentence_length: round(sent), from_syllables_per_word: round(word) }];
}));
const brandTable = [...BB.entries()].map(([b, xs]) => {
  const cat = (c) => xs.filter((x) => x.cat2 === c);
  const o = { brand: b, sector: sectorOf[b], pages: xs.length, blog_pages: cat("blog").length, press_pages: cat("press").length };
  for (const m of ["fk", "reading_age", "fre", "asl", "asw", "long_word_share", "sent_gt25_share"]) { o[m] = round(mean(xs.map((x) => x[m]))); o[`${m}_blog`] = cat("blog").length ? round(mean(cat("blog").map((x) => x[m]))) : null; o[`${m}_press`] = cat("press").length ? round(mean(cat("press").map((x) => x[m]))) : null; }
  return o;
}).sort((a, b) => a.brand.localeCompare(b.brand));
const correlations = Object.fromEntries(["asl", "asw", "long_word_share", "poly3_share"].map((m) => [m, round(pearson(brandTable.map((b) => b.fk), brandTable.map((b) => b[m])))]));

// ── 4. Hypotheses ─────────────────────────────────────────────────────────────
const dir = "positive";
const mk = (r, d) => ({ ...r, result: verdict(r, d) });
const KEYS = { main: "fk", product_split: "fk_ps", cmu: "fk_cmu" };

// H1: press releases harder than the same brand's blog posts (press category only; announcements excluded)
function h1(rs, key = "fk", minPages = 10) {
  const bm = byBrand(rs);
  const elig = [...bm.entries()].filter(([, xs]) => xs.filter((x) => x.category === "press").length >= minPages && xs.filter((x) => x.category === "blog").length >= minPages).map(([b]) => b);
  const d = (k) => (bs) => mean(bs.map((b) => mean(bm.get(b).filter((x) => x.category === "press").map((x) => x[k])) - mean(bm.get(b).filter((x) => x.category === "blog").map((x) => x[k]))));
  const r = mk(boot(elig, d(key)), dir);
  const parts = { asl: round(d("asl")(elig)), asw: round(d("asw")(elig)) };
  return { ...r, eligible_brands: elig.length, sector_counts: Object.fromEntries(sectors.map((s) => [s, elig.filter((b) => sectorOf[b] === s).length])), press_minus_blog_asl_words: parts.asl, press_minus_blog_asw_syllables: parts.asw, from_sentence_length_grades: round(0.39 * parts.asl), from_syllables_grades: round(11.8 * parts.asw), brands_press_harder: elig.filter((b) => d(key)([b]) > 0).length };
}
// cells for the time and Duty tests
function cellsBy(rs, windowOf) {
  const m = new Map();
  for (const x of rs) { const w = windowOf(x); if (!w) continue; const k = `${x.brand}|${x.cat2}`; if (!m.has(k)) m.set(k, { brand: x.brand, cat: x.cat2, w: {} }); (m.get(k).w[w] ??= []).push(x); }
  return [...m.values()];
}
const strictOK = (x, strict) => x.date && (!strict || STRICT.has(x.date_source) || x.source === "wayback");
function brandChange(cells, key, from, to, minPages) {
  const el = cells.filter((c) => (c.w[from]?.length ?? 0) >= minPages && (c.w[to]?.length ?? 0) >= minPages);
  const byB = new Map(); for (const c of el) { if (!byB.has(c.brand)) byB.set(c.brand, []); byB.get(c.brand).push(mean(c.w[to].map((x) => x[key])) - mean(c.w[from].map((x) => x[key]))); }
  return { cells: el.length, brands: [...byB.keys()], change: new Map([...byB].map(([b, v]) => [b, mean(v)])) };
}
function changeTest(rs, key, from, to, { strict = true, minPages = 10, pool = (x) => x.era } = {}) {
  const cells = cellsBy(rs.filter((x) => strictOK(x, strict) && x.era), pool);
  const { cells: nc, brands, change } = brandChange(cells, key, from, to, minPages);
  const r = boot(brands, (bs) => mean(bs.map((b) => change.get(b))));
  const lv = (e) => mean(brands.map((b) => mean(cells.filter((c) => c.brand === b && (c.w[e]?.length ?? 0) >= minPages).map((c) => mean(c.w[e].map((x) => x[key]))))));
  return { ...r, cells: nc, from_mean: round(lv(from)), to_mean: round(lv(to)) };
}
const h2 = (rs, key = "fk", opts = {}) => { const r = changeTest(rs, key, "EARLY", "AFTER", opts); return { ...r, result: verdict(r, "positive") }; };

// H2 predicts HARDER (positive change); H3 predicts a relative fall (negative).
// H3: Consumer Duty difference-in-differences. PRE = 2015-01 to 2022-06, POST = 2023-08 onward (month precision required).
const dutyWindow = (lo) => (x) => { const ym = x.date && x.date.length >= 7 ? x.date.slice(0, 7) : null; if (!ym) return null; return ym >= lo && ym < "2022-07" ? "PRE" : ym >= "2023-08" ? "POST" : null; };
function h3(rs, key = "fk", { lo = "2015-01", strict = true, minPages = 10, drop = [], minBrands = 8 } = {}) {
  const cells = cellsBy(rs.filter((x) => strictOK(x, strict) && !drop.includes(x.sector)), dutyWindow(lo));
  const { cells: nc, brands, change } = brandChange(cells, key, "PRE", "POST", minPages);
  const fcaB = brands.filter((b) => FCA.has(sectorOf[b])), othB = brands.filter((b) => !FCA.has(sectorOf[b]));
  if (fcaB.length < minBrands || othB.length < minBrands) return { result: "not testable", fca_brands: fcaB.length, other_brands: othB.length, cells: nc };
  const stat = (bs) => mean(bs.filter((b) => FCA.has(sectorOf[b])).map((b) => change.get(b))) - mean(bs.filter((b) => !FCA.has(sectorOf[b])).map((b) => change.get(b)));
  const r = boot(brands, stat);
  return { ...r, result: verdict(r, "negative"), cells: nc, fca_brands: fcaB.length, other_brands: othB.length, fca_change: round(mean(fcaB.map((b) => change.get(b)))), other_change: round(mean(othB.map((b) => change.get(b)))) };
}

const H = { H1: h1(rows), H2: h2(rows), H3: h3(rows) };
console.error("H1", JSON.stringify({ ...H.H1, sector_counts: undefined }), "\nH2", JSON.stringify(H.H2), "\nH3", JSON.stringify(H.H3));

// ── 5. Exploratory and sensitivity (labelled in the pre-registration, section 6) ──
const sens = { H1: {}, H2: {}, H3: {} };
sens.H1.product_sentence_splitter = h1(rows, "fk_ps"); sens.H1.cmu_syllables = h1(rows, "fk_cmu"); sens.H1.flesch_reading_ease = h1(rows, "fre");
sens.H1.live_pages_only = h1(rows.filter((r) => r.source === "live")); sens.H1.pages_of_300_words_or_more = h1(rows.filter((r) => r.words >= 300)); sens.H1.min_5_pages_each = h1(rows, "fk", 5);
sens.H1.announcements_with_press = (() => { const rs = rows.map((r) => (r.category === "announcement" ? { ...r, category: "press" } : r)); return h1(rs); })();
sens.H2.product_sentence_splitter = h2(rows, "fk_ps"); sens.H2.cmu_syllables = h2(rows, "fk_cmu"); sens.H2.flesch_reading_ease = h2(rows, "fre");
sens.H2.guessed_dates_included = h2(rows, "fk", { strict: false }); sens.H2.pages_of_300_words_or_more = h2(rows.filter((r) => r.words >= 300));
sens.H2.min_5_pages_each = h2(rows, "fk", { minPages: 5 }); sens.H2.avg_sentence_length = h2(rows, "asl"); sens.H2.syllables_per_word = h2(rows, "asw");
sens.H2.blog_only = h2(rows.filter((r) => r.cat2 === "blog")); sens.H2.press_only = h2(rows.filter((r) => r.cat2 === "press"));
sens.H2.early_to_late = (() => { const r = changeTest(rows, "fk", "EARLY", "LATE"); return { ...r, result: verdict(r, "positive") }; })();
sens.H2.late_to_after = (() => { const r = changeTest(rows, "fk", "LATE", "AFTER"); return { ...r, result: verdict(r, "positive") }; })();
sens.H2.by_sector = Object.fromEntries(sectors.map((s) => { const r = changeTest(rows.filter((x) => x.sector === s), "fk", "EARLY", "AFTER", { minPages: 8 }); return [s, r]; }));
sens.H3.product_sentence_splitter = h3(rows, "fk_ps"); sens.H3.cmu_syllables = h3(rows, "fk_cmu"); sens.H3.flesch_reading_ease = h3(rows, "fre");
sens.H3.pre_window_from_2019 = h3(rows, "fk", { lo: "2019-01" }); sens.H3.guessed_dates_included = h3(rows, "fk", { strict: false });
sens.H3.without_grocery = h3(rows, "fk", { drop: ["grocery"] }); sens.H3.min_5_pages_each = h3(rows, "fk", { minPages: 5 });
sens.H3.avg_sentence_length = h3(rows, "asl"); sens.H3.syllables_per_word = h3(rows, "asw");
sens.H3.banks_only_vs_others = h3(rows.filter((r) => r.sector !== "insurance"), "fk");
sens.H3.insurance_only_vs_others = h3(rows.filter((r) => r.sector !== "bank"), "fk");
// source check: live against archived pages from 2019 to November 2022, same brand
{
  const late = rows.filter((x) => x.era === "LATE"); const bm = byBrand(late);
  const el = [...bm.entries()].filter(([, xs]) => xs.filter((x) => x.source === "live").length >= 10 && xs.filter((x) => x.source === "wayback").length >= 10).map(([b]) => b);
  sens.source_check = Object.fromEntries(["fk", "asl", "asw"].map((m) => [m, boot(el, (bs) => mean(bs.map((b) => mean(bm.get(b).filter((x) => x.source === "live").map((x) => x[m])) - mean(bm.get(b).filter((x) => x.source === "wayback").map((x) => x[m])))))]));
  sens.source_check.brands = el.length;
}

// ── 6. Series by year (descriptive) ───────────────────────────────────────────
const byYear = [];
for (const catName of ["all", "blog", "press"]) for (let y = 2015; y <= 2026; y++) {
  const ys = rows.filter((x) => x.date && strictOK(x, true) && +x.date.slice(0, 4) === y && (catName === "all" || x.cat2 === catName));
  if (!ys.length) continue;
  const bm = byBrand(ys);
  const e = { category: catName, year: y, pages: ys.length, brands: bm.size };
  for (const m of ["fk", "reading_age", "fre", "asl", "asw", "long_word_share"]) e[m] = round(mean([...bm.values()].map((xs) => mean(xs.map((x) => x[m])))));
  const mp = new Map([...bm].map(([b, xs]) => [b, mean(xs.map((x) => x.fk))]));
  const r = boot([...bm.keys()], (bs) => mean(bs.map((b) => mp.get(b))));
  e.fk_ci = [r.lo, r.hi];
  byYear.push(e);
}

// ── 7. Write ──────────────────────────────────────────────────────────────────
const exclSum = (k) => exclTotal[k] ?? 0;
const summary = {
  study: "SGR-023", generated: new Date().toISOString(), pilot: PILOT, runtime_seconds: Math.round((Date.now() - t0) / 1000), bootstrap_resamples: B, seed: SEED,
  corpus: { brand_files_read: brandList.length, pages_read: pagesRead, pages_scored: rows.length, brands_with_scored_pages: brandsWithPages.length, sectors: sectors.length, prose_words: rows.reduce((a, x) => a + x.prose_words, 0), dated_pages: rows.filter((r) => r.era).length, undated_pages: rows.filter((r) => !r.era).length, by_category: Object.fromEntries(["blog", "press", "announcement"].map((c) => [c, rows.filter((r) => r.category === c).length])), by_source: { live: rows.filter((r) => r.source === "live").length, wayback: rows.filter((r) => r.source === "wayback").length }, by_sector: Object.fromEntries(sectors.map((s) => [s, { brands: new Set(rows.filter((r) => r.sector === s).map((r) => r.brand)).size, pages: rows.filter((r) => r.sector === s).length }])) },
  exclusions: { total: exclTotal, under_150_words: exclSum("under_150_words"), duplicate_text: exclSum("duplicate_text"), list_like: exclSum("list_like"), info_pack_not_measured: exclSum("info_pack_not_measured"), unscorable: exclSum("unscorable_under_100_prose_words_or_5_sentences"), no_file: exclSum("no_file"), by_brand: excl },
  syllable_validation: syllableValidation(),
  hypotheses: H, levels, reference, decomposition, correlations_across_brands_with_fk: correlations, sensitivity: sens, by_year: byYear, brands: brandTable,
};
writeFileSync(`${OUT}/sgr-023-summary.json`, JSON.stringify(summary, null, 1));
const cell = (v) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (file, cols, rs) => writeFileSync(`${OUT}/${file}`, [cols.join(","), ...rs.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n");
csv("sgr-023-pages.csv", ["brand", "sector", "category", "source", "url", "date", "date_source", "era", "words", "prose_words", "prose_sentences", "fk", "reading_age", "fre", "asl", "asw", "long_word_share", "poly3_share", "sent_gt25_share", "fk_ps", "fk_cmu"], rows);
csv("sgr-023-brands.csv", Object.keys(brandTable[0] ?? { brand: 0 }), brandTable);
csv("sgr-023-by-year.csv", ["category", "year", "pages", "brands", "fk", "reading_age", "fre", "asl", "asw", "long_word_share"], byYear);
csv("sgr-023-sectors.csv", ["group", "name", "pages", "brands", "fk_mean", "fk_p10", "fk_p25", "fk_median", "fk_p75", "fk_p90", "reading_age_median", "fre_median", "asl_median", "asw_median", "long_word_share_median", "sent_gt25_share_mean"],
  [...Object.entries(levels.by_sector).map(([k, v]) => ["sector", k, v]), ...Object.entries(levels.by_category).map(([k, v]) => ["category", k, v]), ["all", "all brands", levels.overall]].map(([g, n, v]) => ({ group: g, name: n, pages: v.pages, brands: v.brands, fk_mean: v.fk.brand_mean, fk_p10: v.fk.brand_p[0], fk_p25: v.fk.brand_p[1], fk_median: v.fk.brand_median, fk_p75: v.fk.brand_p[3], fk_p90: v.fk.brand_p[4], reading_age_median: v.reading_age.brand_median, fre_median: v.fre.brand_median, asl_median: v.asl.brand_median, asw_median: v.asw.brand_median, long_word_share_median: v.long_word_share.brand_median, sent_gt25_share_mean: v.sent_gt25_share.brand_mean })));
charts(summary, OUT);
console.error(`done in ${summary.runtime_seconds}s; validation pass=${summary.syllable_validation.pass}`);
