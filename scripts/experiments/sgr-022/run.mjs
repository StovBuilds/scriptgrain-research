#!/usr/bin/env bun
// SGR-022 full measurement and analysis: do ministers' written answers sound different since ChatGPT?
// Exactly as docs/research/sgr-022-preregistration.md says. Deterministic: same corpus in, same files out
// (the summary's ranAt/ranOn/seconds are the only clock values).
//
//   bun scripts/experiments/sgr-022/run.mjs                    # the full run (day before release)
//   bun scripts/experiments/sgr-022/run.mjs --pilot            # <=5% hash sample, relaxed cell sizes, written under <data>/pilot-out, NEVER published
//   options: --data ~/research/sgr-022-hansard  --out public/research  --boot 2000
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { UNITS, WINDOW, SAMPLE, MIN_WORDS, MEASURES, era, isAfterConservative, unitOf, htmlToPlain, hasTable, countWords, shortLineWordShare, figureShare, HOLDING_TEXT, measurePage } from "./lib.mjs";
import { writeCharts } from "./charts.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PILOT = args.includes("--pilot");
const DATA = opt("--data", `${homedir()}/research/sgr-022-hansard`).replace(/^~/, homedir());
const OUT = PILOT ? `${DATA}/pilot-out` : opt("--out", "public/research");
const B = Number(opt("--boot", 2000));
const MIN_CELL = PILOT ? 2 : 10;     // section 4: at least 10 texts per era in a cell (relaxed in the pilot only)
const MIN_UNIT_YEAR = PILOT ? 1 : 5; // section 6: a department-year needs 5 texts to enter the year series
const MIN_Q_WORDS = 20;              // question text (section 3): shorter than answers by nature
const PILOT_PCT = Number(opt("--pilot-pct", 4)); // pilot: 4% of items by a hash of the item id (never above 5)
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const say = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const inPilot = (kind, id) => parseInt(createHash("sha1").update(`${kind}|${id}`).digest("hex").slice(0, 8), 16) % 100 < PILOT_PCT;

// ── Load ─────────────────────────────────────────────────────────────────────────────────
const readGz = (f) => (existsSync(f) ? gunzipSync(readFileSync(f)).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const sampleReport = JSON.parse(readFileSync(`${DATA}/sample-report.json`, "utf8"));
// design weight of a question's stratum (answer year x unit): frame size / sampled (section 2). Statements are a census: weight 1.
const dw = (year, unit) => { const u = sampleReport.report?.[year]?.units?.[unit]; return u && u.sampled ? u.frame / u.sampled : 1; };
const excl = { answer: {}, statement: {}, question: {} }; const exclByYear = { answer: {}, statement: {}, question: {} };
const drop = (kind, reason, y) => { const k = y ?? "undated"; excl[kind][reason] = (excl[kind][reason] ?? 0) + 1; (exclByYear[kind][k] ??= {})[reason] = (exclByYear[kind][k][reason] ?? 0) + 1; };
const cand = []; const fetched = { answer: 0, statement: 0 };

function consider(kind, id, house, bodyName, date, html, extra) {
  const y = date ? date.slice(0, 4) : null;
  if (html == null || html === "") { drop(kind, "no_text", y); return; }
  if (!date || date < WINDOW.from || date > WINDOW.to) { drop(kind, "outside_window", y); return; }
  const text = htmlToPlain(html);
  const w = countWords(text);
  const min = kind === "question" ? MIN_Q_WORDS : MIN_WORDS;
  if (w < min) { drop(kind, kind !== "question" && hasTable(html) && w < min ? "table_only" : "under_min_words", y); return; }
  if (kind !== "question" && w < 100 && HOLDING_TEXT.test(text)) { drop(kind, "holding_text", y); return; }
  if (shortLineWordShare(text, w) > 0.4) { drop(kind, "list_like", y); return; }
  if (figureShare(text, w) > 0.5) { drop(kind, "figure_list", y); return; }
  const unit = unitOf(bodyName);
  cand.push({ kind, id, house, unit, tier: unit === "other" ? 2 : 1, body: bodyName, date, era: era(date), words: w, hash: createHash("sha256").update(text).digest("hex"), design: kind === "statement" ? 1 : dw(+date.slice(0, 4), unit), table: hasTable(html), ...extra, ...measurePage(text, w) });
}
{
  const wanted = new Map(); // sampled question ids (sample.json is the frame's draw, fixed before any measurement)
  for (const s of JSON.parse(readFileSync(`${DATA}/sample.json`, "utf8"))) wanted.set(s.id, s);
  for (const r of readGz(`${DATA}/bodies/questions.jsonl.gz`)) {
    if (!wanted.has(r.id)) continue;
    if (PILOT && !inPilot("q", r.id)) continue;
    fetched.answer++;
    if (r.missing) { drop("answer", "not_found", null); continue; }
    if (r.holding) { drop("answer", "holding_flag", r.answered?.slice(0, 4)); continue; }
    consider("answer", r.id, r.house, r.bodyName, r.answered, r.answer, { correction: !!r.correction });
    consider("question", r.id, r.house, r.bodyName, r.answered, r.question, { correction: false });
  }
  say("answers + questions read", fetched.answer, "candidates", cand.length);
  for (const r of readGz(`${DATA}/bodies/statements.jsonl.gz`)) {
    if (PILOT && !inPilot("s", r.id)) continue;
    fetched.statement++;
    if (r.missing) { drop("statement", "not_found", null); continue; }
    consider("statement", r.id, r.house, r.bodyName, r.made, r.text, { correction: false });
  }
  say("statements read", fetched.statement, "candidates", cand.length);
}
// exact duplicates inside the same series and unit: the later copy goes (grouped questions share an answer)
cand.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
const seen = new Set(); const P = [];
for (const p of cand) { const k = `${p.kind}|${p.unit}|${p.hash}`; if (seen.has(k)) { drop(p.kind, "duplicate_text", p.date.slice(0, 4)); continue; } seen.add(k); P.push(p); }
P.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id - b.id));
for (const p of P) delete p.hash;
say("texts kept", P.length, JSON.stringify(excl));

// ── Statistics helpers ───────────────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const fin = (a) => a.filter(Number.isFinite);
const r = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const q = (a, p) => { const s = fin(a).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const seedOf = (label) => parseInt(createHash("sha1").update(label).digest("hex").slice(0, 8), 16) ^ 0x5022;
function rngFor(label) { let s = seedOf(label); return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Cluster bootstrap over units (each unit weighted equally). */
function boot(values, label) {
  const v = fin(values); const point = mean(v);
  if (v.length < 2) return { point: r(point), lo: null, hi: null, lo90: null, hi90: null, n: v.length };
  const rnd = rngFor(label); const d = [];
  for (let i = 0; i < B; i++) { let s = 0; for (let k = 0; k < v.length; k++) s += v[Math.floor(rnd() * v.length)]; d.push(s / v.length); }
  return { point: r(point), lo: r(q(d, 0.025)), hi: r(q(d, 0.975)), lo90: r(q(d, 0.05)), hi90: r(q(d, 0.95)), n: v.length };
}
const yr = (d) => +d.slice(0, 4) + (+(d.slice(5, 7) || 6) - 0.5) / 12;
const medYear = (rows) => q(rows.map((x) => yr(x.date)), 0.5);
/** Mean of a measure over texts. Default: design-weighted (inverse sampling probability, section 2). opts.plain: unweighted; opts.pooled: also word-weighted (sum of counts over sum of words). */
function cmean(rows, key, o = {}) {
  let sw = 0, sx = 0;
  for (const x of rows) { const v = x[key]; if (!Number.isFinite(v)) continue; const wt = (o.plain ? 1 : x.design) * (o.pooled ? x.words : 1); sw += wt; sx += wt * v; }
  return sw ? sx / sw : NaN;
}
/** Cells = unit x house. eraOf maps a text to an era label or null. */
function cellsOf(rows, eraOf) {
  const m = new Map();
  for (const x of rows) { const e = eraOf(x); if (!e) continue; const k = `${x.unit}|${x.house}`; if (!m.has(k)) m.set(k, { unit: x.unit, house: x.house, e: {} }); (m.get(k).e[e] ??= []).push(x); }
  return [...m.values()];
}
/** from-era -> to-era change: eligible cells (>= MIN_CELL texts in both eras) give to-mean minus from-mean; a unit's value is the mean over its cells; units count equally. */
function change(rows, key, from, to, { eraOf = (x) => x.era, minCell = MIN_CELL, label = key, o = {} } = {}) {
  const cs = cellsOf(rows, eraOf).filter((c) => (c.e[from]?.length ?? 0) >= minCell && (c.e[to]?.length ?? 0) >= minCell);
  const byU = new Map(); for (const c of cs) { if (!byU.has(c.unit)) byU.set(c.unit, []); byU.get(c.unit).push(c); }
  const units = [...byU.keys()].sort();
  const dv = units.map((u) => mean(byU.get(u).map((c) => cmean(c.e[to], key, o) - cmean(c.e[from], key, o))));
  const lvl = (e) => mean(units.map((u) => mean(byU.get(u).map((c) => cmean(c.e[e], key, o)))));
  return { cells: cs.length, ...boot(dv, `${label}|${from}|${to}|${o.plain ? "p" : ""}${o.pooled ? "w" : ""}`), from_mean: r(lvl(from)), to_mean: r(lvl(to)), _units: units, _values: dv };
}
const strip = ({ _units, _values, ...rest }) => rest;
const sign = (h) => (h.lo != null && h.lo > 0 ? "supported" : "not supported");

const SERIES = { answers: P.filter((x) => x.kind === "answer" && x.tier === 1), statements: P.filter((x) => x.kind === "statement" && x.tier === 1), questions: P.filter((x) => x.kind === "question" && x.tier === 1) };
const OTHER = { answers: P.filter((x) => x.kind === "answer" && x.tier === 2), statements: P.filter((x) => x.kind === "statement" && x.tier === 2) };
const S = { study: "SGR-022", pilot: PILOT, minCell: MIN_CELL, bootstrap: B, sample: { seed: SAMPLE.seed, perYear: SAMPLE.perYear, floorPerUnitYear: SAMPLE.floorPerUnitYear, frame_answered_non_holding: sampleReport.frameSize, drawn: Object.values(sampleReport.report).reduce((a, y) => a + y.sampled, 0) } };

// ── Corpus overview ──────────────────────────────────────────────────────────────────────
const years = Array.from({ length: 12 }, (_, i) => 2015 + i);
const count = (rows, f) => { const o = {}; for (const x of rows) { const k = f(x); o[k] = (o[k] ?? 0) + 1; } return o; };
const kinds = ["answer", "statement", "question"];
S.corpus = {
  bodies_fetched: fetched, kept: Object.fromEntries(kinds.map((k) => [k, P.filter((x) => x.kind === k).length])),
  kept_departments: Object.fromEntries(Object.entries(SERIES).map(([k, v]) => [k, v.length])),
  kept_other_bodies: Object.fromEntries(Object.entries(OTHER).map(([k, v]) => [k, v.length])),
  excluded: excl, excluded_by_year: exclByYear,
  by_year: Object.fromEntries(years.map((y) => [y, Object.fromEntries(kinds.map((k) => [k, P.filter((x) => x.kind === k && +x.date.slice(0, 4) === y).length]))])),
  by_house: Object.fromEntries(kinds.map((k) => [k, count(P.filter((x) => x.kind === k), (x) => x.house)])),
  by_era: Object.fromEntries(kinds.map((k) => [k, count(P.filter((x) => x.kind === k), (x) => x.era)])),
  by_unit_year_answers: Object.fromEntries(Object.keys(UNITS).map((u) => [u, Object.fromEntries(years.map((y) => [y, SERIES.answers.filter((x) => x.unit === u && +x.date.slice(0, 4) === y).length]))])),
  with_table_answers: P.filter((x) => x.kind === "answer" && x.table).length, corrected_answers: P.filter((x) => x.kind === "answer" && x.correction).length,
  median_words: Object.fromEntries(kinds.map((k) => [k, q(P.filter((x) => x.kind === k).map((x) => x.words), 0.5)])),
  words_total: P.reduce((a, x) => a + x.words, 0), window: WINDOW,
};

// ── Confirmatory hypotheses ──────────────────────────────────────────────────────────────
function hypotheses(rows, tag) {
  const H = {}, out = {};
  H.H1 = change(rows, "ai_ism_per1000", "LATE", "AFTER", { label: `${tag}H1` }); out.H1 = { ...strip(H.H1), result: sign(H.H1) };
  {
    const cs = cellsOf(rows, (x) => x.era).filter((c) => ["EARLY", "LATE", "AFTER"].every((e) => (c.e[e]?.length ?? 0) >= MIN_CELL));
    const byU = new Map(); for (const c of cs) { if (!byU.has(c.unit)) byU.set(c.unit, []); byU.get(c.unit).push(c); }
    const units = [...byU.keys()].sort();
    const per = (c, a, b) => { const span = medYear(c.e[b]) - medYear(c.e[a]); return span > 0 ? (cmean(c.e[b], "ai_ism_per1000") - cmean(c.e[a], "ai_ism_per1000")) / span : NaN; };
    const la = units.map((u) => mean(fin(byU.get(u).map((c) => per(c, "LATE", "AFTER"))))), el = units.map((u) => mean(fin(byU.get(u).map((c) => per(c, "EARLY", "LATE")))));
    const h2 = boot(units.map((_, i) => la[i] - el[i]), `${tag}H2`);
    out.H2 = { cells: cs.length, ...h2, late_to_after_per_year: r(mean(fin(la))), early_to_late_per_year: r(mean(fin(el))), result: sign(h2) };
  }
  H.H3 = change(rows, "em_dash_per1000", "LATE", "AFTER", { label: `${tag}H3` }); out.H3 = { ...strip(H.H3), result: sign(H.H3) };
  H.H4 = change(rows, "ai_shape_per1000", "LATE", "AFTER", { label: `${tag}H4` }); out.H4 = { ...strip(H.H4), result: sign(H.H4) };
  H.H5 = change(rows, "avg_sentence_length", "LATE", "AFTER", { label: `${tag}H5` }); out.H5 = { ...strip(H.H5), result: H.H5.lo90 != null && H.H5.lo90 > -1.5 && H.H5.hi90 < 1.5 ? "supported" : "not supported" };
  const eraC = (x) => (x.era === "LATE" ? "LATE" : x.era === "AFTER" && isAfterConservative(x.date) ? "AFTER_C" : null);
  H.H6 = change(rows, "ai_ism_per1000", "LATE", "AFTER_C", { eraOf: eraC, label: `${tag}H6` }); out.H6 = { ...strip(H.H6), result: sign(H.H6) };
  const u = H.H1._units, v = H.H1._values;
  const loo = u.map((name, i) => ({ left_out: name, point: r(mean(v.filter((_, j) => j !== i))) }));
  out.H1_leave_one_out = loo.length ? { min: Math.min(...loo.map((x) => x.point)), max: Math.max(...loo.map((x) => x.point)), lowest_without: loo.reduce((a, x) => (x.point < a.point ? x : a)).left_out, highest_without: loo.reduce((a, x) => (x.point > a.point ? x : a)).left_out } : null;
  return out;
}
S.answers = hypotheses(SERIES.answers, "A");
S.statements = hypotheses(SERIES.statements, "S");
// the written questions (the MPs' and peers' own words) are the comparison series: estimates only, no verdict
S.questions = Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((m) => [m, strip(change(SERIES.questions, m, "LATE", "AFTER", { label: `Q|${m}` }))]));
// answers' change minus questions' change, same departments (exploratory; section 6)
{
  const out = {};
  for (const m of ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"]) {
    const a = change(SERIES.answers, m, "LATE", "AFTER", { label: `D|a|${m}` }), qq = change(SERIES.questions, m, "LATE", "AFTER", { label: `D|q|${m}` });
    const qi = new Map(qq._units.map((u, i) => [u, qq._values[i]])); const us = a._units.filter((u) => qi.has(u)); const d = us.map((u) => a._values[a._units.indexOf(u)] - qi.get(u));
    out[m] = boot(d, `D|${m}`);
  }
  S.answersMinusQuestions = out;
}
try {
  const s11 = JSON.parse(readFileSync(new URL("../brand-series/summary-011.json", import.meta.url), "utf8"));
  S.sgr011 = Object.fromEntries(["H1", "H3", "H4", "H5"].map((h) => [h, { from_mean: s11[h].late_mean, to_mean: s11[h].after_mean, point: s11[h].point, lo: s11[h].lo, hi: s11[h].hi, relative_pct: r((100 * s11[h].point) / s11[h].late_mean, 1), brands: s11[h].n }]));
} catch { S.sgr011 = null; }
for (const f of ["../../../public/research/sgr-020-summary.json"]) {
  try { const s20 = JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8")); S.sgr020 = Object.fromEntries(["H1", "H3", "H4", "H5"].map((h) => [h, { from_mean: s20[h].from_mean, to_mean: s20[h].to_mean, point: s20[h].point, lo: s20[h].lo, hi: s20[h].hi, relative_pct: r((100 * s20[h].point) / s20[h].from_mean, 1), units: s20[h].n }])); } catch { S.sgr020 = null; }
}

// ── Robustness and exploratory (answers) ─────────────────────────────────────────────────
const ROB = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"];
const ALL = [...ROB, "quiet_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "contractions_per1000", "you_share", "we_share", "i_share", "sentence_variation", "short_sentence_share", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "long_word_share"];
const A = SERIES.answers;
const light = (rows, m, o = {}) => strip(change(rows, m, o.from ?? "LATE", o.to ?? "AFTER", { eraOf: o.eraOf, label: `${m}|${o.tag ?? ""}`, o: o.o }));
const eachRob = (rows, o) => Object.fromEntries(ROB.map((m) => [m, light(rows, m, o)]));
S.allMeasures = Object.fromEntries(ALL.map((m) => [m, light(A, m)]));
S.unweighted = eachRob(A, { tag: "plain", o: { plain: true } });
S.pooled = eachRob(A, { tag: "pooled", o: { pooled: true } });
S.longAnswers = eachRob(A.filter((x) => x.words >= 150), { tag: "150" });
S.noCorrections = eachRob(A.filter((x) => !x.correction), { tag: "nocorr" });
S.noTables = eachRob(A.filter((x) => !x.table), { tag: "notab" });
S.byHouse = Object.fromEntries(["Commons", "Lords"].map((h) => [h, eachRob(A.filter((x) => x.house === h), { tag: h })]));
S.transitionAsAfter = eachRob(A, { tag: "tr", eraOf: (x) => (x.era === "TRANSITION" ? "AFTER" : x.era) });
S.afterSplit = {
  conservative: eachRob(A, { tag: "c", to: "AFTER_C", eraOf: (x) => (x.era === "LATE" ? "LATE" : x.era === "AFTER" && isAfterConservative(x.date) ? "AFTER_C" : null) }),
  labour: eachRob(A, { tag: "l", to: "AFTER_L", eraOf: (x) => (x.era === "LATE" ? "LATE" : x.era === "AFTER" && !isAfterConservative(x.date) ? "AFTER_L" : null) }),
};
S.otherBodies = { answers: eachRob(OTHER.answers.map((x) => ({ ...x, unit: x.body })), { tag: "t2" }), answers_texts: OTHER.answers.length, statements_texts: OTHER.statements.length };
// answer length and share of short answers by era: context for every comparison
S.answerShape = Object.fromEntries(["EARLY", "LATE", "TRANSITION", "AFTER"].map((e) => { const xs = A.filter((x) => x.era === e); return [e, { texts: xs.length, mean_words: r(cmean(xs, "words"), 1), median_words: r(q(xs.map((x) => x.words), 0.5), 1) }]; }));

// ── Year series and the department table ─────────────────────────────────────────────────
const SER = ["ai_ism_per1000", "marketing_per1000", "quiet_per1000", "old_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "contractions_per1000", "you_share", "we_share", "words"];
const yearSeries = (rows) => {
  const o = {};
  for (const y of years) {
    const ys = rows.filter((x) => +x.date.slice(0, 4) === y);
    const byU = new Map(); for (const x of ys) { if (!byU.has(x.unit)) byU.set(x.unit, []); byU.get(x.unit).push(x); }
    const us = [...byU.entries()].filter(([, xs]) => xs.length >= MIN_UNIT_YEAR);
    o[y] = { texts: ys.length, departments: us.length, ...Object.fromEntries(SER.map((m) => [m, r(mean(fin(us.map(([, xs]) => cmean(xs, m)))))])) };
  }
  return o;
};
S.byYear = yearSeries(A); S.byYearStatements = yearSeries(SERIES.statements); S.byYearQuestions = yearSeries(SERIES.questions);
const KEY = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"];
S.units = Object.entries(UNITS).map(([id, name]) => {
  const rows = A.filter((x) => x.unit === id); const e = (n) => rows.filter((x) => x.era === n);
  return { id, name, texts: rows.length, EARLY: e("EARLY").length, LATE: e("LATE").length, TRANSITION: e("TRANSITION").length, AFTER: e("AFTER").length, statements: SERIES.statements.filter((x) => x.unit === id).length,
    ...Object.fromEntries(KEY.flatMap((m) => [[`${m}_late`, r(cmean(e("LATE"), m))], [`${m}_after`, r(cmean(e("AFTER"), m))]])) };
}).filter((u) => u.texts > 0);

// ── Written datasets (numbers only, no text) ─────────────────────────────────────────────
const toCsv = (cols, rows) => cols.join(",") + "\n" + rows.map((row) => cols.map((c) => { const v = row[c]; return v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(",")).join("\n") + "\n";
writeFileSync(`${OUT}/sgr-022-texts.csv`, toCsv(["kind", "id", "house", "unit", "body", "date", "era", "words", "design_weight", "correction", "has_table", ...MEASURES, "sentences"], P.map((x) => ({ ...x, unit: x.tier === 1 ? x.unit : "other", era: x.era ?? "", design_weight: r(x.design, 3), has_table: x.table ? 1 : 0, correction: x.correction ? 1 : 0 }))));
{
  const rows = [];
  for (const kind of ["answers", "statements"]) for (const [id, name] of Object.entries(UNITS)) for (const e of ["EARLY", "LATE", "TRANSITION", "AFTER"]) {
    const xs = SERIES[kind].filter((x) => x.unit === id && x.era === e); if (!xs.length) continue;
    rows.push({ series: kind, unit: id, name, era: e, texts: xs.length, ...Object.fromEntries(MEASURES.map((m) => [m, r(cmean(xs, m))])) });
  }
  writeFileSync(`${OUT}/sgr-022-departments.csv`, toCsv(["series", "unit", "name", "era", "texts", ...MEASURES], rows));
}
writeFileSync(`${OUT}/sgr-022-by-year.csv`, toCsv(["series", "year", "texts", "departments", ...SER], [["answers", S.byYear], ["statements", S.byYearStatements], ["questions", S.byYearQuestions]].flatMap(([s, by]) => years.map((y) => ({ series: s, year: y, ...by[y] })))));

let commit = null; try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
S.ranAt = new Date().toISOString(); S.ranOn = S.ranAt.slice(0, 10); S.commit = commit; S.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${OUT}/sgr-022-summary.json`, JSON.stringify(S, null, 1));
writeCharts(S, OUT);
console.error(`done in ${S.seconds}s -> ${OUT}`);
// A pilot never prints a result: it only proves the code path (pre-registration section 10).
if (PILOT) console.error("pilot: texts kept", JSON.stringify(S.corpus.kept), "(no results printed)");
else for (const h of ["H1", "H2", "H3", "H4", "H5", "H6"]) console.error("answers", h, JSON.stringify(S.answers[h]));
