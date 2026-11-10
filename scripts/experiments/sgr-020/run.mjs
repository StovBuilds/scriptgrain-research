#!/usr/bin/env bun
// SGR-020 full measurement and analysis: did government writing change after ChatGPT?
// Exactly as docs/research/sgr-020-preregistration.md says. Deterministic: same corpus in,
// same files out (the summary's ranAt/ranOn are the only clock values).
//
//   bun scripts/experiments/sgr-020/run.mjs                    # the full run (day before release)
//   bun scripts/experiments/sgr-020/run.mjs --pilot            # <=5% hash sample, relaxed cell sizes, written under <data>/pilot-out, NEVER published
//   options: --data ~/research/sgr-020  --out public/research  --boot 2000
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { UNITS, SLUG_TO_UNIT, WINDOW, MIN_WORDS, MEASURES, era, isAfterConservative, htmlToPlain, countWords, shortLineWordShare, measurePage } from "./lib.mjs";
import { writeCharts } from "./charts.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PILOT = args.includes("--pilot");
const DATA = opt("--data", `${homedir()}/research/sgr-020`).replace(/^~/, homedir());
const OUT = PILOT ? `${DATA}/pilot-out` : opt("--out", "public/research");
const B = Number(opt("--boot", 2000));
const MIN_CELL = PILOT ? 2 : 10;   // pre-registration section 4: at least 10 pages per era in a cell (relaxed in the pilot only, so the code path is exercised on 4% of the data)
const MIN_UNIT_YEAR = PILOT ? 1 : 5; // section 5: a department-year needs 5 pages to enter the year series
const TYPES = new Set(["press_release", "news_story"]);
const SAMPLE_OF = Number(opt("--pilot-pct", 4)); // pilot: 4% of items by default, chosen by a hash of the page path (the real pilot never goes above 5)
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const say = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ── Load: index, then bodies ─────────────────────────────────────────────────────────────
const index = new Map();
const indexFiles = readdirSync(`${DATA}/index`).filter((f) => f.endsWith(".json")).sort();
let indexedAtMin = "9", indexedAtMax = "";
for (const f of indexFiles) {
  const j = JSON.parse(readFileSync(`${DATA}/index/${f}`, "utf8"));
  if (j.indexedAt < indexedAtMin) indexedAtMin = j.indexedAt;
  if (j.indexedAt > indexedAtMax) indexedAtMax = j.indexedAt;
  for (const x of j.items) index.set(x.path, x);
}
say("indexed items", index.size);
const inPilot = (p) => parseInt(createHash("sha1").update(p).digest("hex").slice(0, 8), 16) % 100 < SAMPLE_OF;

const excl = {}; const exclByYear = {};
const drop = (reason, y) => { const k = y ?? "undated"; excl[reason] = (excl[reason] ?? 0) + 1; exclByYear[k] ??= {}; exclByYear[k][reason] = (exclByYear[k][reason] ?? 0) + 1; };
let fetched = 0, considered = 0;
const cand = [];
const shards = readdirSync(`${DATA}/bodies`).filter((f) => f.endsWith(".jsonl.gz")).sort();
for (const f of shards) {
  for (const line of gunzipSync(readFileSync(`${DATA}/bodies/${f}`)).toString().split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (PILOT && !inPilot(r.path)) continue;
    fetched++; considered++;
    const ix = index.get(r.path) ?? {};
    const y = (r.first ?? "").slice(0, 4) || null;
    if (r.missing) { drop("not_found", y); continue; }
    if (r.schema === "redirect" || !r.body) { drop("no_body", y); continue; }
    if (r.locale && r.locale !== "en") { drop("not_english", y); continue; }
    if (r.withdrawn || ix.withdrawn) { drop("withdrawn", y); continue; }
    if (!TYPES.has(r.type)) { drop("other_type", y); continue; }
    const date = r.first ? r.first.slice(0, 10) : null; // the date as published (London local time as the API gives it)
    if (!date) { drop("no_first_published_date", y); continue; }
    if (date < WINDOW.from || date > WINDOW.to) { drop("outside_2015_to_sep_2026", y); continue; }
    const text = htmlToPlain(r.body);
    const w = countWords(text);
    if (w < MIN_WORDS) { drop("under_150_words", y); continue; }
    if (shortLineWordShare(text, w) > 0.4) { drop("list_like", y); continue; }
    const slug = r.org ?? ix.org ?? "unknown";
    const unit = SLUG_TO_UNIT[slug] ?? null;
    cand.push({
      path: r.path, unit: unit ?? slug, tier: unit ? 1 : 2, org: slug, type: r.type, date, updated: (ix.ts ?? r.updated ?? "").slice(0, 10),
      era: era(date), words: w, hash: createHash("sha256").update(text).digest("hex"), ...measurePage(text, w),
    });
  }
  say("shard", f, "candidates", cand.length);
}
// exact duplicates inside the same unit: the later copy goes
cand.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.path < b.path ? -1 : 1));
const seen = new Set(); const P = [];
for (const p of cand) { const k = `${p.unit}|${p.hash}`; if (seen.has(k)) { drop("duplicate_text", p.date.slice(0, 4)); continue; } seen.add(k); P.push(p); }
P.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
for (const p of P) delete p.hash;
say("pages kept", P.length, JSON.stringify(excl));

// ── Statistics helpers ───────────────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const fin = (a) => a.filter(Number.isFinite);
const r = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const q = (a, p) => { const s = fin(a).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const seedOf = (label) => parseInt(createHash("sha1").update(label).digest("hex").slice(0, 8), 16) ^ 0x5020;
function rngFor(label) { let s = seedOf(label); return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Cluster bootstrap over units: values is one number per unit (each unit weighted equally). */
function boot(values, label) {
  const v = fin(values);
  const point = mean(v);
  if (v.length < 2) return { point: r(point), lo: null, hi: null, lo90: null, hi90: null, n: v.length };
  const rnd = rngFor(label); const d = [];
  for (let i = 0; i < B; i++) { let s = 0; for (let k = 0; k < v.length; k++) s += v[Math.floor(rnd() * v.length)]; d.push(s / v.length); }
  return { point: r(point), lo: r(q(d, 0.025)), hi: r(q(d, 0.975)), lo90: r(q(d, 0.05)), hi90: r(q(d, 0.95)), n: v.length };
}
const yr = (d) => +d.slice(0, 4) + (+(d.slice(5, 7) || 6) - 0.5) / 12;
const medYear = (rows) => q(rows.map((x) => yr(x.date)), 0.5);

/** Cells = unit x document type. eraOf maps a page to an era label or null. */
function cellsOf(rows, eraOf) {
  const m = new Map();
  for (const x of rows) {
    const e = eraOf(x); if (!e) continue;
    const k = `${x.unit}|${x.type}`;
    if (!m.has(k)) m.set(k, { unit: x.unit, type: x.type, e: {} });
    (m.get(k).e[e] ??= []).push(x);
  }
  return [...m.values()];
}
const cmean = (rows, key) => mean(fin(rows.map((x) => x[key])));
/**
 * The change statistic. For a measure, from-era -> to-era: every eligible cell (>= MIN_CELL pages in both
 * eras) gives to-mean minus from-mean; a unit's value is the mean over its cells; units count equally.
 */
function change(rows, key, from, to, { eraOf = (x) => x.era, minCell = MIN_CELL, label = key } = {}) {
  const cs = cellsOf(rows, eraOf).filter((c) => (c.e[from]?.length ?? 0) >= minCell && (c.e[to]?.length ?? 0) >= minCell);
  const byU = new Map();
  for (const c of cs) { if (!byU.has(c.unit)) byU.set(c.unit, []); byU.get(c.unit).push(c); }
  const units = [...byU.keys()].sort();
  const dv = units.map((u) => mean(byU.get(u).map((c) => cmean(c.e[to], key) - cmean(c.e[from], key))));
  const lvl = (e) => mean(units.map((u) => mean(byU.get(u).map((c) => cmean(c.e[e], key)))));
  return { cells: cs.length, ...boot(dv, `${label}|${from}|${to}`), from_mean: r(lvl(from)), to_mean: r(lvl(to)), _units: units, _values: dv };
}
const strip = ({ _units, _values, ...rest }) => rest;
const sign = (h) => (h.lo != null && h.lo > 0 ? "supported" : "not supported"); // every directional hypothesis here predicts a rise

const T1 = P.filter((x) => x.tier === 1), T2 = P.filter((x) => x.tier === 2);
const S = { study: "SGR-020", pilot: PILOT, minCell: MIN_CELL, bootstrap: B };

// ── Corpus overview ─────────────────────────────────────────────────────────────────────
const pagesBy = (rows, f) => { const o = {}; for (const x of rows) { const k = f(x); o[k] = (o[k] ?? 0) + 1; } return o; };
const years = Array.from({ length: 12 }, (_, i) => 2015 + i);
S.corpus = {
  indexed: index.size, bodies_fetched: fetched, kept: P.length, kept_departments: T1.length, kept_other_bodies: T2.length,
  departments: new Set(T1.map((x) => x.unit)).size, other_bodies: new Set(T2.map((x) => x.unit)).size,
  excluded: excl, excluded_by_year: exclByYear,
  by_year: Object.fromEntries(years.map((y) => [y, { departments: T1.filter((x) => +x.date.slice(0, 4) === y).length, other_bodies: T2.filter((x) => +x.date.slice(0, 4) === y).length }])),
  by_type: pagesBy(P, (x) => x.type), by_era: pagesBy(P, (x) => x.era),
  by_unit_year: Object.fromEntries(Object.keys(UNITS).map((u) => [u, Object.fromEntries(years.map((y) => [y, T1.filter((x) => x.unit === u && +x.date.slice(0, 4) === y).length]))])),
  index_taken_between: [indexedAtMin, indexedAtMax], window: WINDOW,
  median_words: q(P.map((x) => x.words), 0.5), words_total: P.reduce((a, x) => a + x.words, 0),
};

// ── Confirmatory hypotheses (departments, tier 1) ────────────────────────────────────────
const H = {};
H.H1 = change(T1, "ai_ism_per1000", "LATE", "AFTER"); S.H1 = { ...strip(H.H1), result: sign(H.H1) };
{
  const cs = cellsOf(T1, (x) => x.era).filter((c) => ["EARLY", "LATE", "AFTER"].every((e) => (c.e[e]?.length ?? 0) >= MIN_CELL));
  const byU = new Map(); for (const c of cs) { if (!byU.has(c.unit)) byU.set(c.unit, []); byU.get(c.unit).push(c); }
  const units = [...byU.keys()].sort();
  const per = (c, a, b) => { const span = medYear(c.e[b]) - medYear(c.e[a]); return span > 0 ? (cmean(c.e[b], "ai_ism_per1000") - cmean(c.e[a], "ai_ism_per1000")) / span : NaN; };
  const la = units.map((u) => mean(fin(byU.get(u).map((c) => per(c, "LATE", "AFTER")))));
  const el = units.map((u) => mean(fin(byU.get(u).map((c) => per(c, "EARLY", "LATE")))));
  const diff = units.map((_, i) => la[i] - el[i]);
  const h2 = boot(diff, "H2");
  S.H2 = { cells: cs.length, ...h2, late_to_after_per_year: r(mean(fin(la))), early_to_late_per_year: r(mean(fin(el))), result: sign(h2) };
}
H.H3 = change(T1, "em_dash_per1000", "LATE", "AFTER"); S.H3 = { ...strip(H.H3), result: sign(H.H3) };
H.H4 = change(T1, "ai_shape_per1000", "LATE", "AFTER"); S.H4 = { ...strip(H.H4), result: sign(H.H4) };
H.H5 = change(T1, "avg_sentence_length", "LATE", "AFTER"); S.H5 = { ...strip(H.H5), result: H.H5.lo90 != null && H.H5.lo90 > -1.5 && H.H5.hi90 < 1.5 ? "supported" : "not supported" };
{
  const eraOf = (x) => (x.era === "LATE" ? "LATE" : x.era === "AFTER" && isAfterConservative(x.date) ? "AFTER_C" : null);
  H.H6 = change(T1, "ai_ism_per1000", "LATE", "AFTER_C", { eraOf, label: "H6" });
  S.H6 = { ...strip(H.H6), result: sign(H.H6) };
}
// the same units' H1 with each department left out in turn
{
  const u = H.H1._units, v = H.H1._values;
  const loo = u.map((name, i) => ({ left_out: name, point: r(mean(v.filter((_, j) => j !== i))) }));
  S.H1_leave_one_out = { min: Math.min(...loo.map((x) => x.point)), max: Math.max(...loo.map((x) => x.point)), lowest_without: loo.length ? loo.reduce((a, x) => (x.point < a.point ? x : a)).left_out : null, highest_without: loo.length ? loo.reduce((a, x) => (x.point > a.point ? x : a)).left_out : null };
}
// comparison with the brand series (SGR-011), as published: descriptive only
try {
  const s11 = JSON.parse(readFileSync(new URL("../brand-series/summary-011.json", import.meta.url), "utf8"));
  S.sgr011 = Object.fromEntries(["H1", "H3", "H4", "H5"].map((h) => [h, { from_mean: s11[h].late_mean, to_mean: s11[h].after_mean, point: s11[h].point, lo: s11[h].lo, hi: s11[h].hi, relative_pct: r((100 * s11[h].point) / s11[h].late_mean, 1), brands: s11[h].n }]));
} catch { S.sgr011 = null; }

// ── Robustness and exploratory ───────────────────────────────────────────────────────────
const ROB = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"];
const ALL = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length", "quiet_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "contractions_per1000", "you_share", "we_share", "sentence_variation", "short_sentence_share", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "long_word_share"];
const light = (rows, k, o) => strip(change(rows, k, o?.from ?? "LATE", o?.to ?? "AFTER", { eraOf: o?.eraOf, label: `${k}|${o?.tag ?? ""}` }));
S.allMeasures = Object.fromEntries(ALL.map((m) => [m, light(T1, m)]));
S.byType = Object.fromEntries(["press_release", "news_story"].map((t) => [t, Object.fromEntries(ROB.map((m) => [m, light(T1.filter((x) => x.type === t), m, { tag: t })]))]));
S.longPages = Object.fromEntries(ROB.map((m) => [m, light(T1.filter((x) => x.words >= 300), m, { tag: "300" })]));
S.transitionAsAfter = Object.fromEntries(ROB.map((m) => [m, light(T1, m, { eraOf: (x) => (x.era === "TRANSITION" ? "AFTER" : x.era), tag: "tr" })]));
S.updatedDates = Object.fromEntries(ROB.map((m) => [m, light(T1, m, { eraOf: (x) => era(x.updated || x.date), tag: "upd" })]));
S.afterSplit = {
  conservative: Object.fromEntries(ROB.map((m) => [m, light(T1, m, { eraOf: (x) => (x.era === "LATE" ? "LATE" : x.era === "AFTER" && isAfterConservative(x.date) ? "AFTER_C" : null), to: "AFTER_C", tag: "c" })])),
  labour: Object.fromEntries(ROB.map((m) => [m, light(T1, m, { eraOf: (x) => (x.era === "LATE" ? "LATE" : x.era === "AFTER" && !isAfterConservative(x.date) ? "AFTER_L" : null), to: "AFTER_L", tag: "l" })])),
};
S.withoutDsit = Object.fromEntries(ROB.map((m) => [m, light(T1.filter((x) => x.org !== "department-for-science-innovation-and-technology"), m, { tag: "nodsit" })]));
S.otherBodies = Object.fromEntries(ROB.map((m) => [m, light(T2, m, { tag: "t2" })]));
S.otherBodies_pages = T2.length;

// ── Year series and the unit table ───────────────────────────────────────────────────────
const SER = ["ai_ism_per1000", "marketing_per1000", "quiet_per1000", "old_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "contractions_per1000", "you_share", "we_share"];
S.byYear = {};
for (const y of years) {
  const ys = T1.filter((x) => +x.date.slice(0, 4) === y);
  const byU = new Map(); for (const x of ys) { if (!byU.has(x.unit)) byU.set(x.unit, []); byU.get(x.unit).push(x); }
  const us = [...byU.entries()].filter(([, xs]) => xs.length >= MIN_UNIT_YEAR);
  S.byYear[y] = { pages: ys.length, departments: us.length, ...Object.fromEntries(SER.map((m) => [m, r(mean(fin(us.map(([, xs]) => cmean(xs, m)))))])) };
}
const KEY = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"];
S.units = Object.entries(UNITS).map(([id, u]) => {
  const rows = T1.filter((x) => x.unit === id);
  const e = (name) => rows.filter((x) => x.era === name);
  return { id, name: u.name, pages: rows.length, EARLY: e("EARLY").length, LATE: e("LATE").length, TRANSITION: e("TRANSITION").length, AFTER: e("AFTER").length,
    ...Object.fromEntries(KEY.flatMap((m) => [[`${m}_late`, r(cmean(e("LATE"), m))], [`${m}_after`, r(cmean(e("AFTER"), m))]])) };
}).filter((u) => u.pages > 0);

// ── Written datasets ────────────────────────────────────────────────────────────────────
const csv = (cols, rows) => [cols.join(","), ...rows.map((row) => cols.map((c) => { const v = row[c]; return v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(","))].join("\n") + "\n";
const PAGE_COLS = ["path", "unit", "org", "type", "date", "era", "words", ...MEASURES, "sentences"];
writeFileSync(`${OUT}/sgr-020-pages.csv`, csv(PAGE_COLS, P.map((x) => ({ ...x, unit: x.tier === 1 ? x.unit : "other", era: x.era ?? "" }))));
{
  const rows = [];
  for (const [id, u] of Object.entries(UNITS)) for (const e of ["EARLY", "LATE", "TRANSITION", "AFTER"]) {
    const xs = T1.filter((x) => x.unit === id && x.era === e); if (!xs.length) continue;
    rows.push({ unit: id, name: u.name, era: e, pages: xs.length, ...Object.fromEntries(MEASURES.map((m) => [m, r(cmean(xs, m))])) });
  }
  writeFileSync(`${OUT}/sgr-020-departments.csv`, csv(["unit", "name", "era", "pages", ...MEASURES], rows));
}
writeFileSync(`${OUT}/sgr-020-by-year.csv`, csv(["year", "pages", "departments", ...SER], years.map((y) => ({ year: y, ...S.byYear[y] }))));

let commit = null; try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
S.ranAt = new Date().toISOString(); S.ranOn = S.ranAt.slice(0, 10); S.commit = commit; S.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${OUT}/sgr-020-summary.json`, JSON.stringify(S, null, 1));
writeCharts(S, OUT);
console.error(`done in ${S.seconds}s -> ${OUT}`);
for (const h of ["H1", "H2", "H3", "H4", "H5", "H6"]) console.error(h, JSON.stringify(S[h]));
