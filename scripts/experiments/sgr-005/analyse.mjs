#!/usr/bin/env bun
// SGR-005 analysis, as pre-registered (docs/research/sgr-005-preregistration.md).
//
//   bun scripts/experiments/sgr-005/analyse.mjs --rows <rows.jsonl> --out <summary.json> [--csv <works.csv>]
//
// Unit: one work (the mean of its five passages). Primary: narration.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const rows = readFileSync(opt("--rows", null), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const SEED = 20261004, B = 10000;
const CORE = ["sentence_length", "sentence_cv", "commas_per_sentence", "semicolons_per1000", "contractions_per1000", "long_word_share"];
const ALL = [...CORE, "exclamations_per1000", "em_dash_per1000", "pronoun_i", "pronoun_you", "ai_tell_per1000"];
const mean = (a) => { a = a.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Work-level means, for narration and for all text.
const works = new Map();
for (const r of rows) {
  const w = works.get(r.work) ?? { author: r.author, name: r.name, work: r.work, title: r.title, year: r.year, age: r.age, n: [], a: [], d: [] };
  if (r.narration) w.n.push(r.narration);
  if (r.all) w.a.push(r.all);
  w.d.push(r.dialogue_share);
  works.set(r.work, w);
}
const W = [...works.values()].filter((w) => w.n.length >= 3).map((w) => {
  const o = { author: w.author, name: w.name, work: w.work, title: w.title, year: w.year, age: w.age, passages: w.n.length, dialogue_share: r3(mean(w.d)) };
  for (const k of ALL) { o[`n_${k}`] = r3(mean(w.n.map((x) => x[k]))); o[`a_${k}`] = r3(mean(w.a.map((x) => x[k]))); }
  return o;
});
const authors = [...new Set(W.map((w) => w.author))];
const byA = (a) => W.filter((w) => w.author === a).sort((x, y) => x.year - y.year);

// Per-author OLS slope of y on age, per decade.
function slope(ws, k) {
  const p = ws.filter((w) => w[k] != null);
  if (p.length < 3) return null;
  const mx = mean(p.map((w) => w.age)), my = mean(p.map((w) => w[k]));
  const sxx = p.reduce((s, w) => s + (w.age - mx) ** 2, 0);
  return sxx ? (p.reduce((s, w) => s + (w.age - mx) * (w[k] - my), 0) / sxx) * 10 : null;
}
function bootMean(vals) {
  const r = rng(SEED), m = [];
  for (let i = 0; i < B; i++) { let s = 0; for (let k = 0; k < vals.length; k++) s += vals[Math.floor(r() * vals.length)]; m.push(s / vals.length); }
  m.sort((a, b) => a - b);
  return [r3(m[Math.floor(B * 0.025)]), r3(m[Math.floor(B * 0.975)])];
}
// ICC(1) on work means grouped by author (unequal group sizes).
function icc(groups) {
  const all = groups.flat(), N = all.length, k = groups.length, gm = mean(all);
  const msb = groups.reduce((s, g) => s + g.length * (mean(g) - gm) ** 2, 0) / (k - 1);
  const msw = groups.reduce((s, g) => s + g.reduce((t, x) => t + (x - mean(g)) ** 2, 0), 0) / (N - k);
  const k0 = (N - groups.reduce((s, g) => s + g.length ** 2, 0) / N) / (k - 1);
  return (msb - msw) / (msb + (k0 - 1) * msw);
}
function iccBoot(k) {
  const groups = authors.map((a) => byA(a).map((w) => w[k]).filter((x) => x != null)).filter((g) => g.length >= 2);
  const est = icc(groups), r = rng(SEED), s = [];
  for (let i = 0; i < 2000; i++) { const g = groups.map(() => groups[Math.floor(r() * groups.length)]); s.push(icc(g)); }
  s.sort((a, b) => a - b);
  return { icc: r3(est), lo: r3(s[Math.floor(2000 * 0.025)]), hi: r3(s[Math.floor(2000 * 0.975)]), authors: groups.length };
}

// H1.
const slopes = authors.map((a) => ({ author: a, name: byA(a)[0].name, works: byA(a).length, first: byA(a)[0].year, last: byA(a).at(-1).year, slope: slope(byA(a), "n_sentence_length"), slope_all: slope(byA(a), "a_sentence_length") })).filter((s) => s.slope != null);
const h1v = slopes.map((s) => s.slope), [lo1, hi1] = bootMean(h1v);
const H1 = { mean_slope_per_decade: r3(mean(h1v)), lo: lo1, hi: hi1, authors: h1v.length, rising: h1v.filter((x) => x > 0).length, falling: h1v.filter((x) => x < 0).length, holds: lo1 > 0, all_text: { mean_slope_per_decade: r3(mean(slopes.map((s) => s.slope_all))), ci: bootMean(slopes.map((s) => s.slope_all)) } };

// H2.
const H2feat = Object.fromEntries(CORE.map((k) => [k, iccBoot(`n_${k}`)]));
const H2 = { features: H2feat, above_half: Object.values(H2feat).filter((v) => v.lo > 0.5).length, holds: Object.values(H2feat).filter((v) => v.lo > 0.5).length >= 4 };

// Exploratory: every feature's slope and ICC, early vs late thirds per author.
const drift = ALL.map((k) => {
  const sl = authors.map((a) => slope(byA(a), `n_${k}`)).filter((x) => x != null);
  const sdAll = (() => { const v = W.map((w) => w[`n_${k}`]).filter((x) => x != null); const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); })();
  return { feature: k, mean_slope_per_decade: r3(mean(sl)), ci: bootMean(sl), rising: sl.filter((x) => x > 0).length, falling: sl.filter((x) => x < 0).length, slope_in_sd: r3(mean(sl) / sdAll), icc: iccBoot(`n_${k}`).icc, overall_mean: r3(mean(W.map((w) => w[`n_${k}`]))) };
});
const thirds = authors.map((a) => {
  const ws = byA(a), n = ws.length, t = Math.max(1, Math.floor(n / 3));
  const early = ws.slice(0, t), late = ws.slice(n - t);
  const o = { author: a, name: ws[0].name, early_years: `${early[0].year}-${early.at(-1).year}`, late_years: `${late[0].year}-${late.at(-1).year}` };
  for (const k of CORE) { o[`${k}_early`] = r3(mean(early.map((w) => w[`n_${k}`]))); o[`${k}_late`] = r3(mean(late.map((w) => w[`n_${k}`]))); }
  o.sentence_change_pct = o.sentence_length_early ? r3((o.sentence_length_late / o.sentence_length_early - 1) * 100) : null;
  o.dialogue_early = r3(mean(early.map((w) => w.dialogue_share))); o.dialogue_late = r3(mean(late.map((w) => w.dialogue_share)));
  return o;
}).sort((x, y) => y.sentence_change_pct - x.sentence_change_pct);
const singleQuote = W.filter((w) => w.dialogue_share != null && w.dialogue_share < 0.02).map((w) => w.work);

const summary = { study: "SGR-005", generated: new Date().toISOString().slice(0, 10), authors: authors.length, works: W.length, passages: rows.length, words: rows.reduce((s, r) => s + (r.all?.words ?? 0), 0), H1, H2, slopes: slopes.sort((a, b) => b.slope - a.slope), drift, thirds, works_with_little_double_quoted_dialogue: singleQuote.length };
writeFileSync(opt("--out", null), JSON.stringify(summary, null, 1));
if (opt("--csv", null)) {
  const cols = Object.keys(W[0]);
  writeFileSync(opt("--csv", null), [cols.join(","), ...W.map((w) => cols.map((c) => { const v = w[c]; return v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v); }).join(","))].join("\n") + "\n");
}
console.error(`${authors.length} authors, ${W.length} works; H1 ${H1.holds} (${H1.mean_slope_per_decade} [${lo1}, ${hi1}]); H2 ${H2.holds} (${H2.above_half}/6)`);
