#!/usr/bin/env bun
// SGR-026 full measurement and analysis: are new Wikipedia articles written differently since ChatGPT?
// Exactly as docs/research/sgr-026-preregistration.md says. Deterministic: same corpus in,
// same files out (the summary's ranAt/ranOn are the only clock values).
//
//   bun scripts/experiments/sgr-026/run.mjs                    # the full run (day before release)
//   bun scripts/experiments/sgr-026/run.mjs --pilot            # <=5% hash sample, relaxed cell sizes, written under <data>/pilot-out, NEVER published
//   options: --data ~/research/sgr-026  --out public/research  --boot 2000
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { WINDOW, MIN_WORDS, MEASURES, era, wikitextToPlain, countWords, shortLineWordShare, measurePage, movedIn } from "./lib.mjs";
import { writeCharts } from "./charts.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PILOT = args.includes("--pilot");
const DATA = opt("--data", `${homedir()}/research/sgr-026`).replace(/^~/, homedir());
const OUT = PILOT ? `${DATA}/pilot-out` : opt("--out", "public/research");
const B = Number(opt("--boot", 2000));
const MIN_MONTH = PILOT ? 1 : 15;      // pre-registration section 4: a month needs 15 measured articles to enter a test
const MIN_MONTH_SUB = PILOT ? 1 : 8;  // ... and 8 within a sub-group (direct creations, 300+ words, ...)
const SAMPLE_OF = Number(opt("--pilot-pct", 4)); // pilot: 4% of articles by a hash of the page id (the real pilot never goes above 5)
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const say = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ── Load: index, bodies, users, deletions ──────────────────────────────────────────────────
const indexFiles = readdirSync(`${DATA}/index`).filter((f) => f.endsWith(".json")).sort();
const IX = new Map(); let indexedAtMin = "9", indexedAtMax = "";
for (const f of indexFiles) {
  const j = JSON.parse(readFileSync(`${DATA}/index/${f}`, "utf8"));
  IX.set(j.month, j);
  if (j.indexedAt < indexedAtMin) indexedAtMin = j.indexedAt;
  if (j.indexedAt > indexedAtMax) indexedAtMax = j.indexedAt;
}
const USERS = existsSync(`${DATA}/users.json`) ? JSON.parse(readFileSync(`${DATA}/users.json`, "utf8")) : {};
const DEL = existsSync(`${DATA}/deletions.json`) ? JSON.parse(readFileSync(`${DATA}/deletions.json`, "utf8")) : {};
const inPilot = (id) => parseInt(createHash("sha1").update(String(id)).digest("hex").slice(0, 8), 16) % 100 < SAMPLE_OF;

const excl = {}; const exclByYear = {};
const drop = (reason, ym) => { const y = (ym ?? "undated").slice(0, 4); excl[reason] = (excl[reason] ?? 0) + 1; exclByYear[y] ??= {}; exclByYear[y][reason] = (exclByYear[y][reason] ?? 0) + 1; };
let fetched = 0;
const cand = [];
const shards = readdirSync(`${DATA}/bodies`).filter((f) => f.endsWith(".jsonl.gz")).sort();
for (const f of shards) {
  const target = f.slice(0, 7);
  for (const line of gunzipSync(readFileSync(`${DATA}/bodies/${f}`)).toString().split("\n")) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (PILOT && !inPilot(r.pageid)) continue;
    fetched++;
    if (r.missing || r.text == null) { drop("deleted_before_fetch", target); continue; }
    if (r.model && r.model !== "wikitext") { drop("not_wikitext", target); continue; }
    const month = r.ts.slice(0, 7);
    if (month < WINDOW.from || month > WINDOW.to) { drop("first_revision_outside_window", target); continue; }
    if (month !== target) { drop("month_differs_from_id_interval", target); continue; }
    if (/^\s*#\s*redirect/i.test(r.text)) { drop("first_revision_is_redirect", month); continue; }
    const groups = r.user && !r.anon ? USERS[r.user]?.groups ?? [] : [];
    const bot = groups.includes("bot");
    const text = wikitextToPlain(r.text);
    const w = countWords(text);
    if (w < MIN_WORDS) { drop("under_150_words", month); continue; }
    if (shortLineWordShare(text, w) > 0.4) { drop("list_like", month); continue; }
    cand.push({
      pageid: r.pageid, month, era: era(month), words: w, direct: !movedIn(r), anon: !!r.anon, bot,
      translation: (r.tags ?? []).some((t) => /contenttranslation/i.test(t)),
      hash: createHash("sha256").update(text).digest("hex"), ...measurePage(text, w),
    });
  }
  say("shard", f, "candidates", cand.length);
}
// exact duplicate text inside the same month: the later page id goes
cand.sort((a, b) => a.pageid - b.pageid);
const seen = new Set(); const P = [];
for (const p of cand) { const k = `${p.month}|${p.hash}`; if (seen.has(k)) { drop("duplicate_text", p.month); continue; } seen.add(k); P.push(p); }
for (const p of P) delete p.hash;
const botKept = P.filter((x) => x.bot).length;
const P0 = P.filter((x) => !x.bot); // bot-created pages are excluded from the main tests (section 1); counted and reported
say("pages kept", P0.length, "bot pages set aside", botKept, JSON.stringify(excl));

// ── Statistics helpers ─────────────────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const fin = (a) => a.filter(Number.isFinite);
const r = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const q = (a, p) => { const s = fin(a).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const seedOf = (label) => parseInt(createHash("sha1").update(label).digest("hex").slice(0, 8), 16) ^ 0x5026;
function rngFor(label) { let s = seedOf(label); return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const monthYear = (ym) => +ym.slice(0, 4) + (+ym.slice(5, 7) - 0.5) / 12;

/** Month means for the rows of an era: [{month, n, v}] for months with at least `minN` rows. */
function monthMeans(rows, key, minN) {
  const m = new Map();
  for (const x of rows) { if (!Number.isFinite(x[key])) continue; if (!m.has(x.month)) m.set(x.month, []); m.get(x.month).push(x[key]); }
  return [...m.entries()].filter(([, v]) => v.length >= minN).sort().map(([month, v]) => ({ month, n: v.length, v: mean(v) }));
}
/** Resample months with replacement and return the mean of the resample. */
const resampleMean = (ms, rnd) => { let s = 0; for (let k = 0; k < ms.length; k++) s += ms[Math.floor(rnd() * ms.length)].v; return s / ms.length; };
function ci(d) { return { lo: r(q(d, 0.025)), hi: r(q(d, 0.975)), lo90: r(q(d, 0.05)), hi90: r(q(d, 0.95)) }; }
/**
 * The change statistic. For a measure, from-era -> to-era: each era's value is the mean of its months' means
 * (every month weighs the same), the change is to minus from, and the interval is a 95% bootstrap over months
 * (months resampled with replacement within each era, `B` times, fixed seed per statistic).
 */
function change(rows, key, from, to, { eraOf = (x) => x.era, minN = MIN_MONTH, label = key } = {}) {
  const er = (name) => rows.filter((x) => eraOf(x) === name);
  const a = monthMeans(er(from), key, minN), b = monthMeans(er(to), key, minN);
  const fm = mean(a.map((x) => x.v)), tm = mean(b.map((x) => x.v));
  const out = { months_from: a.length, months_to: b.length, articles_from: a.reduce((s, x) => s + x.n, 0), articles_to: b.reduce((s, x) => s + x.n, 0), from_mean: r(fm), to_mean: r(tm), point: r(tm - fm) };
  if (a.length < 3 || b.length < 3) return { ...out, lo: null, hi: null, lo90: null, hi90: null, _a: a, _b: b };
  const rnd = rngFor(`${label}|${from}|${to}`); const d = [];
  for (let i = 0; i < B; i++) d.push(resampleMean(b, rnd) - resampleMean(a, rnd));
  return { ...out, ...ci(d), _a: a, _b: b };
}
const strip = ({ _a, _b, ...rest }) => rest;
const sign = (h) => (h.lo != null && h.lo > 0 ? "supported" : "not supported"); // every directional hypothesis here predicts a rise
const rel = (h) => (h.from_mean ? r((100 * h.point) / h.from_mean, 1) : null);

const S = { study: "SGR-026", pilot: PILOT, minMonth: MIN_MONTH, minMonthSub: MIN_MONTH_SUB, bootstrap: B };

// ── Corpus overview ───────────────────────────────────────────────────────────────────────
const years = Array.from({ length: 12 }, (_, i) => 2015 + i);
const pagesBy = (rows, f) => { const o = {}; for (const x of rows) { const k = f(x); o[k] = (o[k] ?? 0) + 1; } return o; };
const sumIdx = (f) => [...IX.values()].reduce((a, j) => a + f(j), 0);
const frame = {}; // sampling-frame composition by year, from the id draws
for (const y of years) {
  const js = [...IX.values()].filter((j) => j.month.startsWith(String(y)));
  const c = (k) => js.reduce((a, j) => a + (j.counts?.[k] ?? 0), 0);
  const ids = js.reduce((a, j) => a + j.ids_in_interval, 0);
  const drawn = c("drawn");
  frame[y] = { ids_in_interval: ids, drawn, article_share_of_ids: drawn ? r(c("article") / drawn, 4) : null, redirect_share: drawn ? r(c("redirect") / drawn, 4) : null, missing_share: drawn ? r(c("missing") / drawn, 4) : null,
    est_surviving_articles: drawn ? Math.round(ids * c("article") / drawn) : null };
}
S.corpus = {
  months_sampled: IX.size, ids_drawn: sumIdx((j) => j.counts?.drawn ?? 0), articles_sampled: sumIdx((j) => j.items.length), first_revisions_fetched: fetched,
  kept: P0.length, bot_created_set_aside: botKept, excluded: excl, excluded_by_year: exclByYear, frame,
  by_year: Object.fromEntries(years.map((y) => [y, P0.filter((x) => +x.month.slice(0, 4) === y).length])),
  by_era: pagesBy(P0, (x) => x.era), words_total: P0.reduce((a, x) => a + x.words, 0), median_words: q(P0.map((x) => x.words), 0.5),
  index_taken_between: [indexedAtMin, indexedAtMax], window: WINDOW,
  users_looked_up: Object.keys(USERS).length,
};

// ── Confirmatory hypotheses ───────────────────────────────────────────────────────────────
const H = {};
H.H1 = change(P0, "ai_ism_per1000", "LATE", "AFTER"); S.H1 = { ...strip(H.H1), result: sign(H.H1) };
{
  // H2: yearly rate of change after ChatGPT against the yearly rate before it, each between era means at the era's mean date
  const a = monthMeans(P0.filter((x) => x.era === "EARLY"), "ai_ism_per1000", MIN_MONTH), l = monthMeans(P0.filter((x) => x.era === "LATE"), "ai_ism_per1000", MIN_MONTH), z = monthMeans(P0.filter((x) => x.era === "AFTER"), "ai_ism_per1000", MIN_MONTH);
  const tm = (ms) => mean(ms.map((x) => monthYear(x.month)));
  const gapEL = tm(l) - tm(a), gapLA = tm(z) - tm(l);
  const slopes = (A, L, Z) => ({ el: (mean(L.map((x) => x.v)) - mean(A.map((x) => x.v))) / gapEL, la: (mean(Z.map((x) => x.v)) - mean(L.map((x) => x.v))) / gapLA });
  const s0 = slopes(a, l, z);
  let h2 = { lo: null, hi: null, lo90: null, hi90: null };
  if (a.length >= 3 && l.length >= 3 && z.length >= 3) {
    const rnd = rngFor("H2"); const d = [];
    const rs = (ms) => Array.from({ length: ms.length }, () => ms[Math.floor(rnd() * ms.length)]);
    for (let i = 0; i < B; i++) { const s = slopes(rs(a), rs(l), rs(z)); d.push(s.la - s.el); }
    h2 = ci(d);
  }
  S.H2 = { months: [a.length, l.length, z.length], point: r(s0.la - s0.el, 4), ...Object.fromEntries(Object.entries(h2).map(([k, v]) => [k, v == null ? null : r(v, 4)])), late_to_after_per_year: r(s0.la, 4), early_to_late_per_year: r(s0.el, 4), gap_years: [r(gapEL, 2), r(gapLA, 2)] };
  S.H2.result = sign(S.H2);
}
H.H3 = change(P0, "em_dash_per1000", "LATE", "AFTER"); S.H3 = { ...strip(H.H3), result: sign(H.H3) };
H.H4 = change(P0, "ai_shape_per1000", "LATE", "AFTER"); S.H4 = { ...strip(H.H4), result: sign(H.H4) };
H.H5 = change(P0, "avg_sentence_length", "LATE", "AFTER"); S.H5 = { ...strip(H.H5), result: H.H5.lo90 != null && H.H5.lo90 > -1.5 && H.H5.hi90 < 1.5 ? "supported" : "not supported" };
// H6: the rise is also there among articles created straight into the article namespace (no draft or user-space history)
H.H6 = change(P0.filter((x) => x.direct), "ai_ism_per1000", "LATE", "AFTER", { minN: MIN_MONTH_SUB, label: "H6" }); S.H6 = { ...strip(H.H6), result: sign(H.H6) };
// leave-one-month-out range for H1
{
  const a = H.H1._a, b = H.H1._b;
  const all = [...a.map((x) => ["a", x.month]), ...b.map((x) => ["b", x.month])];
  const pts = all.map(([side, m]) => { const A = side === "a" ? a.filter((x) => x.month !== m) : a, Bb = side === "b" ? b.filter((x) => x.month !== m) : b; return mean(Bb.map((x) => x.v)) - mean(A.map((x) => x.v)); });
  S.H1_leave_one_month_out = pts.length ? { min: r(Math.min(...pts)), max: r(Math.max(...pts)) } : null;
}
// the earlier change, as the trend control: EARLY -> LATE
S.trendControl = Object.fromEntries(["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((m) => [m, strip(change(P0, m, "EARLY", "LATE", { label: `trend|${m}` }))]));
// comparison with the brand series (SGR-011) and government (SGR-020, if its summary is on disk), as published: descriptive only
try {
  const s11 = JSON.parse(readFileSync(new URL("../brand-series/summary-011.json", import.meta.url), "utf8"));
  S.sgr011 = Object.fromEntries(["H1", "H3", "H4", "H5"].map((h) => [h, { from_mean: s11[h].late_mean, to_mean: s11[h].after_mean, point: s11[h].point, lo: s11[h].lo, hi: s11[h].hi, relative_pct: r((100 * s11[h].point) / s11[h].late_mean, 1), brands: s11[h].n }]));
} catch { S.sgr011 = null; }
try {
  const s20 = JSON.parse(readFileSync(new URL("../../../public/research/sgr-020-summary.json", import.meta.url), "utf8"));
  S.sgr020 = s20.pilot ? null : Object.fromEntries(["H1", "H3", "H4", "H5"].map((h) => [h, { from_mean: s20[h].from_mean, to_mean: s20[h].to_mean, point: s20[h].point, lo: s20[h].lo, hi: s20[h].hi, relative_pct: s20[h].from_mean ? r((100 * s20[h].point) / s20[h].from_mean, 1) : null, departments: s20[h].n }]));
} catch { S.sgr020 = null; }

// ── Robustness and exploratory ─────────────────────────────────────────────────────────────
const ROB = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"];
const ALL = ["ai_ism_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length", "quiet_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "contractions_per1000", "you_share", "we_share", "sentence_variation", "short_sentence_share", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "long_word_share"];
const light = (rows, k, o) => strip(change(rows, k, o?.from ?? "LATE", o?.to ?? "AFTER", { eraOf: o?.eraOf, minN: o?.minN ?? MIN_MONTH, label: `${k}|${o?.tag ?? ""}` }));
const sub = (name, rows, o) => Object.fromEntries(ROB.map((m) => [m, light(rows, m, { ...o, tag: name })]));
S.allMeasures = Object.fromEntries(ALL.map((m) => [m, light(P0, m)]));
S.longArticles = sub("300", P0.filter((x) => x.words >= 300), { minN: MIN_MONTH_SUB });
S.midLength = sub("150-600", P0.filter((x) => x.words <= 600), { minN: MIN_MONTH_SUB });
S.transitionAsAfter = sub("tr", P0, { eraOf: (x) => (x.era === "TRANSITION" ? "AFTER" : x.era) });
S.noTranslations = sub("notr", P0.filter((x) => !x.translation), { minN: MIN_MONTH_SUB });
S.withBots = sub("bots", P, {});
S.movedIn = sub("moved", P0.filter((x) => !x.direct), { minN: Math.min(MIN_MONTH_SUB, 5) });
S.directOnly = sub("direct", P0.filter((x) => x.direct), { minN: MIN_MONTH_SUB });
S.registeredOnly = sub("reg", P0.filter((x) => !x.anon), { minN: MIN_MONTH_SUB });

// ── Series, composition and deletions ──────────────────────────────────────────────────
const SER = ["ai_ism_per1000", "marketing_per1000", "quiet_per1000", "old_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "contractions_per1000", "you_share", "we_share"];
const monthKeys = [...new Set(P0.map((x) => x.month))].sort();
S.byMonth = {};
for (const ym of monthKeys) {
  const rows = P0.filter((x) => x.month === ym);
  S.byMonth[ym] = { articles: rows.length, median_words: q(rows.map((x) => x.words), 0.5), direct_share: r(rows.filter((x) => x.direct).length / rows.length, 3), anon_share: r(rows.filter((x) => x.anon).length / rows.length, 3), ...Object.fromEntries(SER.map((m) => [m, r(mean(fin(rows.map((x) => x[m]))))])) };
}
const byPeriod = (keyOf, list) => {
  const o = {};
  for (const k of list) {
    const ms = monthKeys.filter((m) => keyOf(m) === k); if (!ms.length) continue;
    const rows = P0.filter((x) => keyOf(x.month) === k);
    // a period's value is the mean of its months' means, months with at least MIN_MONTH articles
    const ok = ms.filter((m) => S.byMonth[m].articles >= MIN_MONTH);
    o[k] = { articles: rows.length, months: ok.length, median_words: q(rows.map((x) => x.words), 0.5), direct_share: r(rows.filter((x) => x.direct).length / rows.length, 3), ...Object.fromEntries(SER.map((m) => [m, ok.length ? r(mean(ok.map((mm) => S.byMonth[mm][m]))) : null])) };
  }
  return o;
};
const quarterOf = (ym) => `${ym.slice(0, 4)}-Q${Math.ceil(+ym.slice(5, 7) / 3)}`;
const quarters = []; for (const y of years) for (let k = 1; k <= 4; k++) quarters.push(`${y}-Q${k}`);
S.byYear = byPeriod((m) => m.slice(0, 4), years.map(String));
S.byQuarter = byPeriod(quarterOf, quarters);
// deletions: mainspace creation-log entries (from July 2018) whose page no longer exists
S.deletions = { by_year: {}, by_quarter: {}, note: "Entries in the page-creation log in the article namespace, sampled in eight windows a month; pageid 0 = the page has been deleted. Redirects and pages that were later moved are included in the denominator." };
for (const [ym, v] of Object.entries(DEL)) {
  for (const [bucket, k] of [["by_year", ym.slice(0, 4)], ["by_quarter", quarterOf(ym)]]) { const o = (S.deletions[bucket][k] ??= { entries: 0, deleted: 0, months: 0 }); o.entries += v.entries; o.deleted += v.deleted; o.months++; }
}
for (const bucket of ["by_year", "by_quarter"]) for (const o of Object.values(S.deletions[bucket])) o.share = o.entries ? r(o.deleted / o.entries, 4) : null;

// ── Written datasets ────────────────────────────────────────────────────────────────────
const csv = (cols, rows) => [cols.join(","), ...rows.map((row) => cols.map((c) => { const v = row[c]; return v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(","))].join("\n") + "\n";
const PAGE_COLS = ["pageid", "month", "era", "words", "direct", "anon", "bot", "translation", ...MEASURES, "sentences"];
writeFileSync(`${OUT}/sgr-026-articles.csv`, csv(PAGE_COLS, P.map((x) => ({ ...x, era: x.era ?? "" }))));
writeFileSync(`${OUT}/sgr-026-by-month.csv`, csv(["month", "articles", "median_words", "direct_share", "anon_share", ...SER], monthKeys.map((m) => ({ month: m, ...S.byMonth[m] }))));
writeFileSync(`${OUT}/sgr-026-by-year.csv`, csv(["year", "articles", "months", "median_words", "direct_share", ...SER], Object.entries(S.byYear).map(([y, v]) => ({ year: y, ...v }))));
writeFileSync(`${OUT}/sgr-026-frame.csv`, csv(["month", "ids_in_interval", "ids_drawn", "articles_found", "redirects", "disambiguation", "other_namespace", "missing", "est_surviving_articles"],
  [...IX.values()].map((j) => ({ month: j.month, ids_in_interval: j.ids_in_interval, ids_drawn: j.counts.drawn, articles_found: j.counts.article, redirects: j.counts.redirect, disambiguation: j.counts.disambiguation, other_namespace: j.counts.other_namespace, missing: j.counts.missing, est_surviving_articles: j.counts.drawn ? Math.round(j.ids_in_interval * j.counts.article / j.counts.drawn) : null }))));

let commit = null; try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
S.ranAt = new Date().toISOString(); S.ranOn = S.ranAt.slice(0, 10); S.commit = commit; S.seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${OUT}/sgr-026-summary.json`, JSON.stringify(S, null, 1));
writeCharts(S, OUT);
console.error(`done in ${S.seconds}s -> ${OUT}`);
for (const h of ["H1", "H2", "H3", "H4", "H5", "H6"]) console.error(h, JSON.stringify(S[h]));
