#!/usr/bin/env bun
// SGR-006 analysis, as pre-registered (docs/research/sgr-006-preregistration.md).
//
//   bun scripts/experiments/sgr-006/analyse.mjs --in <dir with books/web/arxiv .jsonl> --out <summary.json> [--csv <texts.csv>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const IN = opt("--in");
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const rows = ["books", "web", "arxiv"].flatMap((p) => (existsSync(`${IN}/${p}.jsonl`) ? readFileSync(`${IN}/${p}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []));
export const MEASURES = ["sentence_length", "sentence_cv", "short_sentence_share", "commas_per_sentence", "semicolons_per1000", "exclamations_per1000", "questions_per1000", "contractions_per1000", "parentheticals_per300", "short_word_share", "long_word_share", "pronoun_i", "pronoun_we", "pronoun_you", "em_dash_per1000", "ai_tell_per1000"];
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const mean = (a) => { a = a.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
const pct = (a, p) => { a = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function diff(a, b) {
  a = a.filter((x) => x != null); b = b.filter((x) => x != null);
  const r = rng(CFG.seed), d = [];
  for (let i = 0; i < 10000; i++) { let sa = 0, sb = 0; for (let k = 0; k < a.length; k++) sa += a[Math.floor(r() * a.length)]; for (let k = 0; k < b.length; k++) sb += b[Math.floor(r() * b.length)]; d.push(sa / a.length - sb / b.length); }
  d.sort((x, y) => x - y);
  return { diff: r3(mean(a) - mean(b)), lo: r3(d[250]), hi: r3(d[9749]), n_a: a.length, n_b: b.length };
}
const sel = (groups, era, k) => rows.filter((r) => groups.includes(r.group) && (!era || r.era === era)).map((r) => r[k]);

// The baseline: percentiles per group and era.
const cells = [...new Set(rows.map((r) => `${r.group}|${r.era}`))].map((c) => {
  const [group, era] = c.split("|"), m = rows.filter((r) => r.group === group && r.era === era);
  const out = { group, label: CFG.labels[group] ?? group, era, texts: m.length, words: m.reduce((s, r) => s + r.words, 0) };
  for (const k of MEASURES) out[k] = { p10: r3(pct(m.map((r) => r[k]), 0.1)), p25: r3(pct(m.map((r) => r[k]), 0.25)), p50: r3(pct(m.map((r) => r[k]), 0.5)), p75: r3(pct(m.map((r) => r[k]), 0.75)), p90: r3(pct(m.map((r) => r[k]), 0.9)), mean: r3(mean(m.map((r) => r[k]))) };
  return out;
});
const ERA_ORDER = ["1700s", "1800s", "early 1900s", "2021 web", "2015-2022"];
cells.sort((a, b) => ERA_ORDER.indexOf(a.era) - ERA_ORDER.indexOf(b.era) || a.label.localeCompare(b.label));

// H1: fiction below history, science, philosophy and religion, in every era with the cells.
const booksEras = Object.keys(CFG.books.eras);
const H1 = booksEras.flatMap((e) => ["history", "science", "philosophy_religion"].filter((g) => cells.some((c) => c.group === g && c.era === e) && cells.some((c) => c.group === "fiction" && c.era === e)).map((g) => ({ era: e, vs: g, ...diff(sel(["fiction"], e, "sentence_length"), sel([g], e, "sentence_length")) })));
const H1holds = H1.every((t) => t.hi < 0);
// H2 and H3: non-fiction books by era, then 2021 web non-fiction.
const NF = CFG.books.nonfiction_for_H2_H3, WNF = CFG.web.nonfiction_for_H2_H3;
const H2 = [{ step: "1700s to early 1900s", ...diff(sel(NF, "early 1900s", "sentence_length"), sel(NF, "1700s", "sentence_length")) }, { step: "early 1900s to 2021 web", ...diff(sel(WNF, "2021 web", "sentence_length"), sel(NF, "early 1900s", "sentence_length")) }];
const H3 = [{ step: "1700s to early 1900s", ...diff(sel(NF, "early 1900s", "contractions_per1000"), sel(NF, "1700s", "contractions_per1000")) }, { step: "early 1900s to 2021 web", ...diff(sel(WNF, "2021 web", "contractions_per1000"), sel(NF, "early 1900s", "contractions_per1000")) }];
const eraMeans = (groups, k) => Object.fromEntries(["1700s", "1800s", "early 1900s"].map((e) => [e, r3(mean(sel(groups, e, k)))]).concat([["2021 web", r3(mean(sel(WNF, "2021 web", k)))]]));
const summary = {
  study: "SGR-006", generated: new Date().toISOString().slice(0, 10), texts: rows.length, words: rows.reduce((s, r) => s + r.words, 0), cells,
  H1: { tests: H1, holds: H1holds }, H2: { tests: H2, holds: H2.every((t) => t.hi < 0) }, H3: { tests: H3, holds: H3.every((t) => t.lo > 0) },
  trend: { sentence_length: eraMeans(NF, "sentence_length"), contractions_per1000: eraMeans(NF, "contractions_per1000"), semicolons_per1000: eraMeans(NF, "semicolons_per1000"), long_word_share: eraMeans(NF, "long_word_share"), em_dash_per1000: eraMeans(NF, "em_dash_per1000"), pronoun_you: eraMeans(NF, "pronoun_you") },
};
writeFileSync(opt("--out"), JSON.stringify(summary, null, 1));
if (opt("--csv")) {
  const cols = ["group", "era", "source", "id", "piece", "captured", "words", ...MEASURES];
  writeFileSync(opt("--csv"), [cols.join(","), ...rows.map((r) => cols.map((c) => { const v = r[c]; return v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v); }).join(","))].join("\n") + "\n");
}
console.error(`${rows.length} texts in ${cells.length} cells; H1 ${summary.H1.holds}, H2 ${summary.H2.holds}, H3 ${summary.H3.holds}`);
