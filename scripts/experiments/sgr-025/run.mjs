#!/usr/bin/env bun
// SGR-025: the whole measurement and analysis of the 2026-Q4 point of The ScriptGrain Writing Index.
// Deterministic given the files on disk and the seed; makes no network request and no model call.
//   bun scripts/experiments/sgr-025/run.mjs [--pilot]
// Full run: reads ~/research/sgr-025/live (+ live-repeat, verify.json, credits.jsonl) and SGR-004's published rows,
// writes public/research/{scriptgrain-writing-index.csv,scriptgrain-writing-index.json,sgr-025-summary.json,sgr-025-*.svg}.
// --pilot: only the 8 pilot sites' live files, 200 resamples, writes to ~/research/sgr-025/pilot-out, never the repo.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { DEF, PANEL, SECTOR, readPage, hasFail, measureHtml, pilotDomains, repeatDomains, level, change, bootCI, pairUp, mean, median, r2 } from "./lib.mjs";
import { lineChart } from "./charts.mjs";

const t0 = Date.now();
const PILOT = process.argv.includes("--pilot");
const ROOT = `${homedir()}/research/sgr-025`;
const OUTDIR = PILOT ? `${ROOT}/pilot-out` : "public/research";
mkdirSync(OUTDIR, { recursive: true });
const B = PILOT ? 200 : DEF.bootstrap.resamples;
const QUARTER = DEF.current_period, BASE = DEF.baseline_period;

// ---------- history: SGR-004's published rows, unchanged ----------
const hist = JSON.parse(readFileSync("public/research/sgr-004-web-copy-rows.json", "utf8"));
const TOPIC = ["ai-powered", "powered by ai"];
const isoDate = (ts) => (ts ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : "");
for (const r of hist) {
  r.period = String(r.year); r.collected = isoDate(r.capture); r.source = r.source === "rendered" ? "wayback_rendered" : "wayback_raw";
  if (r.status === "measured") { const t = TOPIC.reduce((a, w) => a + ((r.ai_era_vocab_hits || {})[w] || 0), 0); r.ai_era_style_per1000 = r2(Math.max(0, r.ai_era_vocab_per1000 - (t / r.words) * 1000)); }
}

// ---------- the new point: one live homepage per site ----------
const live = [];
const exclusions = { not_fetched: 0, fetch_failed: 0, http_error: 0, redirected_off_domain: 0 };
const domains = PILOT ? pilotDomains(hist.filter((r) => r.year === 2026)) : PANEL.map((s) => s.domain);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const measureLive = (dir, d, period, count = false) => {
  const ex = (k) => { if (count) exclusions[k]++; };
  const base = { domain: d, sector: SECTOR[d], period, collected: "", source: "live" };
  const html = readPage(`${ROOT}/${dir}`, d);
  if (html == null) { const k = hasFail(`${ROOT}/${dir}`, d) ? "fetch_failed" : "not_fetched"; ex(k); return { ...base, status: k }; }
  const h = html.match(/^<!-- sgr025 fetched=(\S+) final=(\S+) status=(\S+) -->/) || [];
  const row = { ...base, collected: (h[1] || "").slice(0, 10) };
  if (+h[3] >= 400) { ex("http_error"); return { ...row, status: "http_error" }; }
  if (h[2] && hostOf(h[2]) !== d) { ex("redirected_off_domain"); row.final_host = hostOf(h[2]); }
  return { ...measureHtml(html, row), final_host: row.final_host };
};
for (const d of domains) live.push(measureLive("live", d, QUARTER, true));
// SGR-004 stored a redirected homepage under the panel domain (comcast.com -> xfinity.com); so does this run.
const measuredLive = live.filter((r) => r.status === "measured");

// ---------- the Index dataset (stable columns) ----------
const COLUMNS = [
  ["index_version", "Version of the Index definition the row was made under"],
  ["period", "Calendar year (SGR-004 captures nearest 1 July) or a quarter such as 2026-Q4 (live fetch)"],
  ["collected", "Date the page was captured (Wayback capture date) or fetched (live), YYYY-MM-DD"],
  ["domain", "Company homepage measured"], ["sector", "One of the 11 panel sectors"],
  ["source", "wayback_rendered, wayback_raw or live"],
  ["status", "measured, too_little_prose, bot_wall, archive_redirect, no_capture, render_failed, fetch_failed, http_error or not_fetched"],
  ["words", "Words of prose on the homepage"], ["words_article", "Word count by the product's article extractor, for comparison"],
  ["avg_sentence_length", "Average sentence length (words)"], ["sentence_length_variance", "Variance of sentence length"],
  ["comma_density", "Commas per sentence"], ["exclamation_rate", "Exclamation marks per 1,000 words"], ["semicolon_frequency", "Semicolons per 1,000 words"],
  ["contraction_frequency", "Contractions per 1,000 words"], ["question_mark_in_body", "Whether the prose contains a question mark"],
  ["pronoun_i", "Share of I/we/you pronouns that are I"], ["pronoun_we", "Share that are we"], ["pronoun_you", "Share that are you"],
  ["word_short", "Share of short words"], ["word_medium", "Share of medium words"], ["word_long", "Share of long words"],
  ["ai_tell_per1000", "ScriptGrain AI-tell density per 1,000 words"], ["not_x_but_y", "Count of 'not X but Y' shapes"], ["triadic_list", "Count of reflexive lists of three"],
  ["em_dash_per1000", "Em and en dashes per 1,000 words"], ["em_only_per1000", "Em dashes (U+2014) per 1,000 words"],
  ["burstiness_variation", "Variation in sentence length"], ["short_sentence_share", "Share of sentences under eight words"],
  ["ai_era_vocab_per1000", "AI-era vocabulary per 1,000 words, all 29 entries"], ["ai_era_style_per1000", "AI-era vocabulary without ai-powered and powered by ai"],
  ["dotcom_vocab_per1000", "Dotcom corporate vocabulary per 1,000 words"],
];
const all = [...hist.map((r) => ({ ...r, index_version: DEF.version })), ...live.map((r) => ({ ...r, index_version: DEF.version }))];
const cell = (v) => (v == null ? "" : typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
const csv = [COLUMNS.map((c) => c[0]).join(","), ...all.map((r) => COLUMNS.map((c) => cell(r[c[0]])).join(","))].join("\n") + "\n";

// ---------- series: every headline measure, every period ----------
const periods = [...new Set(all.map((r) => r.period))].sort();
const series = periods.map((period) => {
  const rows = all.filter((r) => r.period === period), m = rows.filter((r) => r.status === "measured");
  const o = { period, sites: rows.length, measured: m.length };
  for (const st of ["too_little_prose", "bot_wall", "archive_redirect", "no_capture", "render_failed", "fetch_failed", "http_error", "not_fetched"]) { const c = rows.filter((r) => r.status === st).length; if (c) o[st] = c; }
  for (const hm of DEF.headline_measures) o[hm.id] = m.length ? r2(level(hm, m)) : null;
  return o;
});

// ---------- the pre-registered comparison: matched sites, 2026-Q4 against 2026 ----------
const base = hist.filter((r) => r.period === BASE && r.status === "measured");
const pairs = pairUp(base, measuredLive);
const enough = pairs.length >= DEF.min_matched_sites;
const comparison = DEF.headline_measures.map((hm, i) => {
  const o = { id: hm.id, label: hm.label, threshold: hm.threshold, matched_sites: pairs.length };
  o.baseline = r2(level(hm, pairs.map((p) => p.a))); o.current = r2(level(hm, pairs.map((p) => p.b)));
  o.change = r2(change(hm, pairs));
  const [lo, hi] = enough ? bootCI(hm, pairs, B, DEF.bootstrap.seed + i) : [null, null];
  o.lo = r2(lo); o.hi = r2(hi);
  const excludesZero = enough && (lo > 0 || hi < 0);
  o.label_result = !enough ? "not assessed" : !excludesZero ? "no detectable change" : Math.abs(change(hm, pairs)) >= hm.threshold ? "changed" : "moved, below the threshold";
  o.direction = o.change > 0 ? "up" : o.change < 0 ? "down" : "none";
  return o;
});

// ---------- checks: repeat fetch, instrument reproduction, credits ----------
const rep = repeatDomains().map((d) => ({ d, a: measuredLive.find((r) => r.domain === d) ?? (PILOT ? null : live.find((r) => r.domain === d)), b: measureLive("live-repeat", d, QUARTER) }));
const repBoth = rep.filter((x) => x.a?.status === "measured" && x.b.status === "measured");
const repeatCheck = {
  sites_fetched_twice: rep.filter((x) => x.b.status !== "not_fetched" && x.b.status !== "fetch_failed").length,
  measured_both_times: repBoth.length,
  status_differs: rep.filter((x) => x.a && x.b.status !== "not_fetched" && x.a.status !== x.b.status).length,
  median_absolute_difference: Object.fromEntries(DEF.headline_measures.map((hm) => [hm.id, repBoth.length ? r2(median(repBoth.map((x) => Math.abs(x.b[hm.column] - x.a[hm.column])))) : null])),
  em_dash_presence_differs: repBoth.filter((x) => (x.a.em_only_per1000 > 0) !== (x.b.em_only_per1000 > 0)).length,
};
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const verify = readJson(`${ROOT}/verify.json`, []);
const credits = (existsSync(`${ROOT}/credits.jsonl`) ? readFileSync(`${ROOT}/credits.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []);
const starts = credits.filter((c) => c.tag === "start"), ends = credits.filter((c) => c.tag === "end");
const creditCheck = credits.length ? { balance_before_first_call: starts[0]?.remaining ?? null, balance_after_last_call: ends[ends.length - 1]?.remaining ?? null, spent: (starts[0]?.remaining ?? 0) - (ends[ends.length - 1]?.remaining ?? 0), budget: 500, floor: 10000, calls_logged: credits.length } : null;

// ---------- Q4 by sector (descriptive) ----------
const bySector = [...new Set(PANEL.map((s) => s.sector))].sort().map((sector) => {
  const m = measuredLive.filter((r) => r.sector === sector);
  return { sector, measured: m.length, words_median: m.length ? r2(median(m.map((r) => r.words))) : null, ai_era_vocab_mean: m.length ? r2(mean(m.map((r) => r.ai_era_style_per1000))) : null, em_dash_share: m.length ? r2(level(DEF.headline_measures[4], m)) : null };
});

const summary = {
  study: "SGR-025", index: DEF.name, index_version: DEF.version, period: QUARTER, baseline_period: BASE, pilot: PILOT,
  generated: new Date().toISOString(), runtime_seconds: Math.round((Date.now() - t0) / 1000), bootstrap_resamples: B,
  collection: { first: live.map((r) => r.collected).filter(Boolean).sort()[0] ?? null, last: live.map((r) => r.collected).filter(Boolean).sort().pop() ?? null, sites_requested: domains.length, fetched: live.filter((r) => !["not_fetched", "fetch_failed"].includes(r.status)).length },
  coverage: { sites: live.length, measured: measuredLive.length, status: Object.fromEntries([...new Set(live.map((r) => r.status))].map((s) => [s, live.filter((r) => r.status === s).length])), exclusions, baseline_measured: base.length, matched_sites: pairs.length, comparison_assessed: enough, baseline_captured_first: pairs.map((p) => p.a.collected).filter(Boolean).sort()[0] ?? null, baseline_captured_last: pairs.map((p) => p.a.collected).filter(Boolean).sort().pop() ?? null },
  headline_measures: DEF.headline_measures.map(({ id, label, level: lv, change_statistic, threshold }) => ({ id, label, level: lv, change_statistic, threshold })),
  comparison, series, by_sector_q4: bySector, checks: { repeat_fetch: repeatCheck, instrument_reproduction: { sites: verify.length, identical: verify.filter((v) => v.result === "identical").length, results: verify.map((v) => ({ domain: v.domain, result: v.result, attempts: v.attempts?.length ?? 0 })) }, credits: creditCheck },
};
writeFileSync(`${OUTDIR}/sgr-025-summary.json`, JSON.stringify(summary, null, 1));
writeFileSync(`${OUTDIR}/scriptgrain-writing-index.csv`, csv);
writeFileSync(`${OUTDIR}/scriptgrain-writing-index.json`, JSON.stringify({
  name: DEF.name, version: DEF.version, current_period: QUARTER, license: "CC BY 4.0", doi_note: "No DOI. Cite the version and the URL.",
  how_to_read: "One row per company homepage per period in scriptgrain-writing-index.csv. Headline measures are a fixed set of six; there is no composite score.",
  headline_measures: DEF.headline_measures, columns: COLUMNS.map(([name, description]) => ({ name, description })), columns_note: DEF.columns_note,
  periods: series, latest_comparison: { period: QUARTER, against: BASE, matched_sites: pairs.length, measures: comparison }, changelog: DEF.changelog,
}, null, 1));
const ps = series.filter((s) => +s.period.slice(0, 4) >= 2012);
const labels = ps.map((s) => (s.period === QUARTER ? "Q4 2026" : s.period));
writeFileSync(`${OUTDIR}/sgr-025-vocab.svg`, lineChart({ title: "Two vocabularies on company homepages, with the 2026 Q4 point", sub: "uses per 1,000 words, mean across measured sites; last point is a live fetch", periods: labels, series: [{ label: "AI-era", values: ps.map((s) => s.ai_era_vocab) }, { label: "Dotcom", values: ps.map((s) => s.dotcom_vocab) }] }));
writeFileSync(`${OUTDIR}/sgr-025-em-dash.svg`, lineChart({ title: "Homepages using an em dash, with the 2026 Q4 point", sub: "% of measured homepages with at least one; last point is a live fetch", periods: labels, fmt: (v) => `${v}%`, max: 100, series: [{ label: "Em dash", values: ps.map((s) => (s.em_dash_share == null ? null : s.em_dash_share * 100)) }] }));
console.error(`${PILOT ? "pilot written to " + OUTDIR + "; " : ""}done in ${summary.runtime_seconds}s: ${measuredLive.length} of ${live.length} measured, ${pairs.length} matched`);
