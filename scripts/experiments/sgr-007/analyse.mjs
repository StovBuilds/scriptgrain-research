#!/usr/bin/env bun
// SGR-007 analysis, as pre-registered (docs/research/sgr-007-preregistration.md).
//
//   bun scripts/experiments/sgr-007/analyse.mjs --in <dir with web/gutenberg/homepages jsonl, ngram.json> --out <summary.json>
//
// Unit = one measured page (web, homepage) or piece (Gutenberg). Intervals are
// 95% bootstrap intervals over pages, 10,000 resamples, seed 20261004.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const IN = opt("--in", null), OUT = opt("--out", null);
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const LEX = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));
const read = (f) => (existsSync(`${IN}/${f}`) ? readFileSync(`${IN}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const rows = [...read("web.jsonl"), ...read("gutenberg.jsonl"), ...read("homepages.jsonl"), ...read("arxiv.jsonl")];
const measured = rows.filter((r) => r.status === "measured");
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function bootDiff(a, b, B = 10000, seed = CFG.seed) {
  const r = rng(seed), d = [];
  for (let i = 0; i < B; i++) {
    let sa = 0, sb = 0;
    for (let k = 0; k < a.length; k++) sa += a[Math.floor(r() * a.length)];
    for (let k = 0; k < b.length; k++) sb += b[Math.floor(r() * b.length)];
    d.push(sa / a.length - sb / b.length);
  }
  d.sort((x, y) => x - y);
  return { diff: r3(mean(a) - mean(b)), lo: r3(d[Math.floor(B * 0.025)]), hi: r3(d[Math.floor(B * 0.975)]), n_a: a.length, n_b: b.length };
}
function bootMean(a, B = 2000, seed = CFG.seed) {
  const r = rng(seed), m = [];
  for (let i = 0; i < B; i++) { let s = 0; for (let k = 0; k < a.length; k++) s += a[Math.floor(r() * a.length)]; m.push(s / a.length); }
  m.sort((x, y) => x - y);
  return [r3(m[Math.floor(B * 0.025)]), r3(m[Math.floor(B * 0.975)])];
}

const METRICS = ["ai_ism_per1000", "old_per1000", "called_out_per1000", "quiet_per1000", "marketing_per1000", "delve_per1000", "control_per1000", "ai_tell_per1000", "em_dash_per1000", "avg_sentence_length", "contraction_frequency"];
const groups = [...new Set(measured.map((r) => r.group))];
const of = (gs, k) => measured.filter((r) => gs.includes(r.group)).map((r) => r[k]).filter((x) => x != null);

const byGroup = groups.map((g) => {
  const m = measured.filter((r) => r.group === g);
  const out = { group: g, label: CFG.labels[g] ?? g, pages: m.length, words: m.reduce((s, r) => s + r.words, 0), sources: [...new Set(m.map((r) => r.source))].length };
  for (const k of METRICS) out[k] = r3(mean(m.map((r) => r[k]).filter((x) => x != null)));
  out.ai_ism_ci = bootMean(m.map((r) => r.ai_ism_per1000));
  out.share_with_old = r3(m.filter((r) => r.old_per1000 > 0).length / m.length);
  out.share_with_delve = r3(m.filter((r) => r.delve_per1000 > 0).length / m.length);
  out.share_with_em_dash = r3(m.filter((r) => r.em_dash_per1000 > 0).length / m.length);
  return out;
}).sort((a, b) => b.ai_ism_per1000 - a.ai_ism_per1000);

// Confirmatory tests.
const NEWS = ["news_uk", "news_us", "news_nigeria", "news_kenya", "news_india", "news_philippines"];
const holds = (t, dir) => (dir > 0 ? t.lo > 0 : t.hi < 0);
const H1 = ["press_releases", "marketing_seo_blogs", "essay_mills"].map((g) => {
  const vsNews = bootDiff(of([g], "ai_ism_per1000"), of(NEWS, "ai_ism_per1000"));
  const vsWiki = bootDiff(of([g], "ai_ism_per1000"), of(["wikipedia"], "ai_ism_per1000"));
  return { group: g, vs_news: vsNews, vs_wikipedia: vsWiki, holds: holds(vsNews, 1) && holds(vsWiki, 1) };
});
const H2 = ["delve_per1000", "old_per1000"].map((k) => {
  const t = bootDiff(of(["news_nigeria", "news_kenya"], k), of(["news_uk", "news_us"], k));
  return { metric: k, ...t, holds: holds(t, 1) };
});
const H2_exploratory = ["news_india", "news_philippines", "news_nigeria", "news_kenya", "news_uk", "news_us"].map((g) => ({ group: g, delve_per1000: r3(mean(of([g], "delve_per1000"))), old_per1000: r3(mean(of([g], "old_per1000"))), share_with_delve: byGroup.find((b) => b.group === g)?.share_with_delve }));
const fic = of(["gutenberg_fiction"], "ai_ism_per1000");
const H3cmp = groups.filter((g) => g !== "gutenberg_fiction").map((g) => ({ group: g, ...bootDiff(of([g], "ai_ism_per1000"), fic) }));
const H3 = { lowest_by_mean: byGroup[byGroup.length - 1].group, comparisons: H3cmp, holds: H3cmp.every((t) => t.lo > 0) };

// H4 and the exploratory Ngram measures.
let H4 = null, ngramWords = null, ngramSeries = null;
if (existsSync(`${IN}/ngram.json`)) {
  const ng = JSON.parse(readFileSync(`${IN}/ngram.json`, "utf8"));
  ngramSeries = Object.fromEntries(Object.entries(ng).filter(([, v]) => v.per_million).map(([w, v]) => [w, v.per_million]));
  const tested = [...new Set(["OLD", "CALLED_OUT", "MARKETING"].flatMap((k) => LEX[k]))].filter((w) => ng[w]?.per_million);
  ngramWords = tested.map((w) => {
    const s = ng[w].per_million, y = (n) => s[n];
    const base = mean(Array.from({ length: 31 }, (_, i) => y(1950 + i)));
    const five = (n) => mean([0, 1, 2, 3, 4].map((k) => y(n - k)));
    let takeoff = null;
    for (let n = 1955; n <= 2019; n++) { let ok = true; for (let m = n; m <= 2019; m++) if (!(five(m) > 2 * base)) { ok = false; break; } if (ok) { takeoff = n; break; } }
    return { word: w, per_million_1900: r3(y(1900)), per_million_1950: r3(y(1950)), per_million_1980: r3(y(1980)), per_million_2000: r3(y(2000)), per_million_2019: r3(y(2019)), ratio_2019_1980: r3(y(1980) > 0 ? y(2019) / y(1980) : null), takeoff_year: takeoff };
  });
  const up = ngramWords.filter((w) => w.per_million_2019 > w.per_million_1980).length;
  H4 = { words: ngramWords.length, more_frequent_2019_than_1980: up, holds: up > ngramWords.length / 2 };
}

// Exploratory: each word's "home" group (rate in the group / pooled rate), web + books + homepages.
const totalWords = Object.fromEntries(groups.map((g) => [g, measured.filter((r) => r.group === g).reduce((s, r) => s + r.words, 0)]));
const allWords = Object.values(totalWords).reduce((a, b) => a + b, 0);
const entries = [...new Set(["OLD", "CALLED_OUT", "QUIET", "MARKETING"].flatMap((k) => LEX[k]))];
const homes = entries.map((w) => {
  const list = ["OLD", "CALLED_OUT", "QUIET", "MARKETING"].find((k) => LEX[k].includes(w));
  const per = Object.fromEntries(groups.map((g) => [g, measured.filter((r) => r.group === g).reduce((s, r) => s + ((r.hits?.[list] ?? {})[w] ?? 0), 0)]));
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  if (total < 20) return { word: w, uses: total, home: null };
  const pooled = total / allWords;
  const rel = groups.map((g) => ({ g, rel: totalWords[g] ? per[g] / totalWords[g] / pooled : 0, per1000: (per[g] / totalWords[g]) * 1000 })).sort((a, b) => b.rel - a.rel);
  return { word: w, uses: total, home: rel[0].g, home_ratio: r3(rel[0].rel), home_per1000: r3(rel[0].per1000), runner_up: rel[1].g, runner_up_ratio: r3(rel[1].rel) };
});

const status = {};
for (const r of rows) { status[r.group] ??= {}; status[r.group][r.status] = (status[r.group][r.status] || 0) + 1; }
const summary = { study: "SGR-007", generated: new Date().toISOString().slice(0, 10), pages_measured: measured.length, words_measured: measured.reduce((s, r) => s + r.words, 0), status, byGroup, H1, H2, H2_exploratory, H3, H4, ngram: ngramWords, ngramSeries, homes };
writeFileSync(OUT, JSON.stringify(summary, null, 1));

// One CSV row per page or passage read: identifiers and numbers, never text.
const CSV = opt("--csv", null);
if (CSV) {
  const cols = ["group", "source", "url", "book", "piece", "captured", "status", "words", "ai_ism_per1000", "old_per1000", "called_out_per1000", "quiet_per1000", "marketing_per1000", "delve_per1000", "control_per1000", "ai_tell_per1000", "em_dash_per1000", "avg_sentence_length", "contraction_frequency"];
  const cell = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  writeFileSync(CSV, [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n");
}
console.error(`measured ${measured.length} pages in ${groups.length} groups`);
