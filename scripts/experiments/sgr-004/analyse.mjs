#!/usr/bin/env bun
// SGR-004 step 3: turn the per-site-year rows into the published dataset,
// the per-year summary, the before/after-ChatGPT comparison and the charts.
//
//   bun scripts/experiments/sgr-004/analyse.mjs [--rows public/research/sgr-004-web-copy-rows.json] [--outdir public/research]
//
// Per year: median and interquartile range over every measured homepage that
// year. Before/after: each site's mean over its 2019-2022 captures against its
// mean over 2023-2026 (ChatGPT launched 30 November 2022; every capture is
// taken nearest 1 July, so 2022 is before and 2023 after), paired by site, so
// a site that joined or left the panel cannot move the result.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const ROWS = opt("--rows", "public/research/sgr-004-web-copy-rows.json");
const OUTDIR = opt("--outdir", "public/research");
// --check: the raw-HTML robustness pass; writes only sgr-004-web-copy-summary-raw.json.
const CHECK = args.includes("--check");
const rows = JSON.parse(readFileSync(ROWS, "utf8"));
const measured = rows.filter((r) => r.status === "measured");
// Post-hoc, disclosed: "ai-powered" and "powered by ai" describe a company's
// PRODUCT (it sells AI features), not the style of its copy. The style-only
// figure drops those two phrases from the fixed AI-era list; both are published.
const TOPIC = ["ai-powered", "powered by ai"];
for (const r of measured) {
  const topic = TOPIC.reduce((a, w) => a + ((r.ai_era_vocab_hits || {})[w] || 0), 0);
  r.ai_era_style_per1000 = Math.round(Math.max(0, r.ai_era_vocab_per1000 - (topic / r.words) * 1000) * 100) / 100;
}

export const METRICS = [
  ["words", "Words of prose on the homepage"],
  ["avg_sentence_length", "Average sentence length (words)"],
  ["sentence_length_variance", "Sentence length variance"],
  ["comma_density", "Commas per sentence"],
  ["exclamation_rate", "Exclamation marks per 1,000 words"],
  ["contraction_frequency", "Contractions per 1,000 words"],
  ["pronoun_you", "Share of I/we/you pronouns that are 'you'"],
  ["pronoun_we", "Share of I/we/you pronouns that are 'we'"],
  ["word_long", "Share of long words"],
  ["em_dash_per1000", "Em and en dashes per 1,000 words"],
  ["em_only_per1000", "Em dashes per 1,000 words"],
  ["ai_tell_per1000", "ScriptGrain AI-tell density per 1,000 words"],
  ["ai_era_vocab_per1000", "AI-era marketing vocabulary per 1,000 words"],
  ["ai_era_style_per1000", "AI-era vocabulary, style words only (AI-topic phrases removed), per 1,000 words"],
  ["dotcom_vocab_per1000", "Dotcom corporate vocabulary per 1,000 words"],
  ["short_sentence_share", "Share of sentences under eight words"],
];

const q = (arr, p) => {
  const a = arr.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};
const mean = (a) => { a = a.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
const byYear = years.map((year) => {
  const all = rows.filter((r) => r.year === year);
  const m = measured.filter((r) => r.year === year);
  const out = { year, captured: all.filter((r) => r.status !== "no_capture").length, measured: m.length };
  for (const [k] of METRICS) out[k] = { median: r2(q(m.map((r) => r[k]), 0.5)), p25: r2(q(m.map((r) => r[k]), 0.25)), p75: r2(q(m.map((r) => r[k]), 0.75)), mean: r2(mean(m.map((r) => r[k]))) };
  out.share_with_ai_era_vocab = m.length ? r2(m.filter((r) => r.ai_era_vocab_per1000 > 0).length / m.length) : null;
  out.share_with_em_dash = m.length ? r2(m.filter((r) => r.em_dash_per1000 > 0).length / m.length) : null;
  out.share_with_em_only = m.length ? r2(m.filter((r) => r.em_only_per1000 > 0).length / m.length) : null;
  out.share_with_exclamation = m.length ? r2(m.filter((r) => r.exclamation_rate > 0).length / m.length) : null;
  return out;
});

// Fixed-panel check on the per-year trend: only sites measured in at least 9 of
// the 12 years 2015 to 2026, so a change cannot come from sites joining or leaving.
const stable = [...new Set(measured.map((r) => r.domain))].filter((d) => measured.filter((r) => r.domain === d && r.year >= 2015).length >= 9);
const byYearStable = years.filter((y) => y >= 2015).map((year) => {
  const m = measured.filter((r) => r.year === year && stable.includes(r.domain));
  const out = { year, measured: m.length };
  for (const k of ["words", "avg_sentence_length", "ai_era_vocab_per1000", "ai_era_style_per1000", "dotcom_vocab_per1000", "contraction_frequency"]) out[k] = { median: r2(q(m.map((r) => r[k]), 0.5)), mean: r2(mean(m.map((r) => r[k]))) };
  out.share_with_em_dash = m.length ? r2(m.filter((r) => r.em_dash_per1000 > 0).length / m.length) : null;
  out.share_with_em_only = m.length ? r2(m.filter((r) => r.em_only_per1000 > 0).length / m.length) : null;
  return out;
});

// Paired before/after.
const PRE = [2019, 2020, 2021, 2022], POST = [2023, 2024, 2025, 2026];
const sites = [...new Set(measured.map((r) => r.domain))];
const prePost = {};
for (const [k, label] of METRICS) {
  const diffs = [];
  let pre = [], post = [];
  for (const d of sites) {
    const a = mean(measured.filter((r) => r.domain === d && PRE.includes(r.year)).map((r) => r[k]));
    const b = mean(measured.filter((r) => r.domain === d && POST.includes(r.year)).map((r) => r[k]));
    if (a == null || b == null) continue;
    diffs.push(b - a); pre.push(a); post.push(b);
  }
  prePost[k] = {
    label, sites: diffs.length,
    before_mean: r2(mean(pre)), after_mean: r2(mean(post)),
    before_median: r2(q(pre, 0.5)), after_median: r2(q(post, 0.5)),
    median_site_change: r2(q(diffs, 0.5)),
    sites_up: diffs.filter((x) => x > 0).length, sites_down: diffs.filter((x) => x < 0).length, sites_same: diffs.filter((x) => x === 0).length,
  };
}

// By sector: the same paired before/after, within each sector of the panel.
const sectorList = [...new Set(rows.map((r) => r.sector))].sort();
const pairedFor = (doms, k) => {
  let pre = [], post = [], up = 0, down = 0;
  for (const d of doms) {
    const a = mean(measured.filter((r) => r.domain === d && PRE.includes(r.year)).map((r) => r[k]));
    const b = mean(measured.filter((r) => r.domain === d && POST.includes(r.year)).map((r) => r[k]));
    if (a == null || b == null) continue;
    pre.push(a); post.push(b); if (b > a) up++; else if (b < a) down++;
  }
  return { sites: pre.length, before_mean: r2(mean(pre)), after_mean: r2(mean(post)), sites_up: up, sites_down: down };
};
const bySector = sectorList.map((sector) => {
  const doms = [...new Set(measured.filter((r) => r.sector === sector).map((r) => r.domain))];
  const recent = measured.filter((r) => r.sector === sector && POST.includes(r.year));
  return {
    sector, sites: doms.length,
    ai_era_style: pairedFor(doms, "ai_era_style_per1000"),
    words: pairedFor(doms, "words"),
    recent_ai_era_style_mean: r2(mean(recent.map((r) => r.ai_era_style_per1000))),
    recent_words_median: r2(q(recent.map((r) => r.words), 0.5)),
    recent_em_share: recent.length ? r2(recent.filter((r) => r.em_only_per1000 > 0).length / recent.length) : null,
  };
});

// Coverage: what happened to every site-year, by year.
const coverage = years.map((year) => {
  const y = rows.filter((r) => r.year === year);
  const c = { year };
  for (const st of ["measured", "too_little_prose", "bot_wall", "archive_redirect", "no_capture", "render_failed"]) c[st] = y.filter((r) => r.status === st).length;
  return c;
});

// Which AI-era words did the work: total hits per word, before and after.
const wordTally = (yrs, key) => {
  const t = {};
  for (const r of measured.filter((r) => yrs.includes(r.year))) for (const [w, c] of Object.entries(r[key] || {})) t[w] = (t[w] || 0) + c;
  return t;
};
const wordsIn = (yrs) => measured.filter((r) => yrs.includes(r.year)).reduce((s, r) => s + r.words, 0);
const vocab = { pre_words: wordsIn(PRE), post_words: wordsIn(POST), ai_era: { pre: wordTally(PRE, "ai_era_vocab_hits"), post: wordTally(POST, "ai_era_vocab_hits") }, dotcom: { pre: wordTally(PRE, "dotcom_vocab_hits"), post: wordTally(POST, "dotcom_vocab_hits") } };

const status = Object.fromEntries(["measured", "too_little_prose", "bot_wall", "archive_redirect", "no_capture", "render_failed"].map((s) => [s, rows.filter((r) => r.status === s).length]));
const summary = { study: "SGR-004", generated: new Date().toISOString().slice(0, 10), site_years: rows.length, sites: new Set(rows.map((r) => r.domain)).size, sites_measured: new Set(measured.map((r) => r.domain)).size, status, metrics: Object.fromEntries(METRICS), byYear, stablePanel: { sites: stable.length, byYear: byYearStable }, prePost, bySector, coverage, vocab };
if (CHECK) {
  writeFileSync(`${OUTDIR}/sgr-004-web-copy-summary-raw.json`, JSON.stringify(summary, null, 1));
  console.error("check pass written", JSON.stringify(status));
  process.exit(0);
}
writeFileSync(`${OUTDIR}/sgr-004-web-copy-summary.json`, JSON.stringify(summary, null, 1));

// Flat CSV, one row per site-year, numbers only.
const cols = ["domain", "sector", "year", "capture", "source", "status", "words", "words_article", "avg_sentence_length", "sentence_length_variance", "comma_density", "exclamation_rate", "semicolon_frequency", "contraction_frequency", "question_mark_in_body", "pronoun_i", "pronoun_we", "pronoun_you", "word_short", "word_medium", "word_long", "ai_tell_per1000", "not_x_but_y", "triadic_list", "em_dash_per1000", "em_only_per1000", "burstiness_variation", "short_sentence_share", "ai_era_vocab_per1000", "ai_era_style_per1000", "dotcom_vocab_per1000"];
const cell = (v) => (v == null ? "" : typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
writeFileSync(`${OUTDIR}/sgr-004-web-copy.csv`, [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n");

// Charts: static SVG line charts (median by year, IQR band), light and dark via prefers-color-scheme.
function chart(file, title, series, { yLabel, from = 2000, band = true, fmt = (v) => String(v), max = null } = {}) {
  const W = 760, H = 380, L = 56, R = 120, T = 48, B = 44;
  const pts = series.flatMap((s) => s.points.flatMap((p) => [p.y, band ? p.lo : null, band ? p.hi : null])).filter((v) => v != null);
  const raw = Math.max(...pts) * 1.05 || 1, yMin = 0;
  const mag = 10 ** Math.floor(Math.log10(raw / 4));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st * 4 >= raw);
  let ticks = Math.ceil(raw / step), yMax = step * ticks;
  if (max != null) { yMax = max; ticks = 4; }
  const x = (yr) => L + ((yr - from) / (2026 - from)) * (W - L - R);
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  let g = "";
  for (let i = 0; i <= ticks; i++) { const v = (yMax / ticks) * i; g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(Math.round(v * 100) / 100)}</text>`; }
  for (let yr = from; yr <= 2026; yr += from === 2000 ? 5 : 1) g += `<text class="ax" x="${x(yr)}" y="${H - B + 20}" text-anchor="middle">${yr}</text>`;
  const gpt = x(2022 + 11 / 12);
  g += `<line class="mark" x1="${gpt}" x2="${gpt}" y1="${T}" y2="${H - B}"/><text class="ax" x="${gpt - 6}" y="${H - B - 8}" text-anchor="end">ChatGPT, Nov 2022</text>`;
  let s = "";
  series.forEach((sr, i) => {
    const P = sr.points.filter((p) => p.y != null);
    if (band && P.length) s += `<path class="band s${i}" d="M${P.map((p) => `${x(p.x)},${y(p.hi)}`).join("L")}L${[...P].reverse().map((p) => `${x(p.x)},${y(p.lo)}`).join("L")}Z"/>`;
    s += `<path class="line s${i}" d="M${P.map((p) => `${x(p.x)},${y(p.y)}`).join("L")}"/>`;
    for (const p of P) s += `<circle class="dot s${i}" cx="${x(p.x)}" cy="${y(p.y)}" r="3"/>`;
    const last = P[P.length - 1];
    if (last) s += `<text class="lbl" x="${x(last.x) + 8}" y="${y(last.y) + 4}">${sr.label ?? fmt(Math.round(last.y * 100) / 100)}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}">
<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.ax{fill:#6b6862}.lbl{fill:#11100E;font-weight:600}
.grid{stroke:#11100E;stroke-opacity:.1}.mark{stroke:#9D8420;stroke-dasharray:3 3}
.line{fill:none;stroke-width:2}.s0.line{stroke:#674BFF}.s1.line{stroke:#9D8420}
.s0.dot{fill:#674BFF;stroke:#F6F5F0;stroke-width:2}.s1.dot{fill:#9D8420;stroke:#F6F5F0;stroke-width:2}
.band{stroke:none}.s0.band{fill:#674BFF;fill-opacity:.12}.s1.band{fill:#9D8420;fill-opacity:.12}
@media (prefers-color-scheme:dark){.t,.lbl{fill:#F6F5F0}.ax{fill:#a8a49b}.grid{stroke:#F6F5F0}
.mark{stroke:#C9A72C}.s0.line{stroke:#7A61FF}.s1.line{stroke:#C9A72C}.s0.dot{fill:#7A61FF;stroke:#141310}.s1.dot{fill:#C9A72C;stroke:#141310}
.s0.band{fill:#7A61FF}.s1.band{fill:#C9A72C}}
</style>
<text class="t" x="${L}" y="22">${title}</text>${yLabel ? `<text class="ax" x="${L}" y="38">${yLabel}</text>` : ""}
${g}${s}</svg>\n`;
  writeFileSync(`${OUTDIR}/${file}`, svg);
}
const ser = (k, label, scale = 1) => ({ label, points: byYear.map((b) => ({ x: b.year, y: b[k].median == null ? null : b[k].median * scale, lo: b[k].p25 * scale, hi: b[k].p75 * scale })) });
chart("sgr-004-sentence-length.svg", "Average sentence length on company homepages", [ser("avg_sentence_length")], { yLabel: "words per sentence, median and middle half of sites" });
chart("sgr-004-words.svg", "Words of prose on company homepages", [ser("words")], { yLabel: "words, median and middle half of sites" });
chart("sgr-004-you-share.svg", "How often homepages say 'you'", [ser("pronoun_you", null, 100)], { yLabel: "'you' as a share of I/we/you pronouns, %, median and middle half", fmt: (v) => `${v}%`, max: 100 });
chart("sgr-004-vocab.svg", "Two vocabularies on company homepages", [
  { label: "AI-era words", points: byYear.map((b) => ({ x: b.year, y: b.ai_era_style_per1000.mean })) },
  { label: "Dotcom words", points: byYear.map((b) => ({ x: b.year, y: b.dotcom_vocab_per1000.mean })) },
], { yLabel: "uses per 1,000 words, mean across sites", band: false });
chart("sgr-004-em-dash.svg", "Homepages using an em dash", [{ points: byYear.map((b) => ({ x: b.year, y: b.share_with_em_only == null ? null : b.share_with_em_only * 100 })) }], { yLabel: "% of measured homepages with at least one", band: false, fmt: (v) => `${v}%`, max: 100 });
chart("sgr-004-exclamation.svg", "Homepages using an exclamation mark", [{ points: byYear.map((b) => ({ x: b.year, y: b.share_with_exclamation == null ? null : b.share_with_exclamation * 100 })) }], { yLabel: "% of measured homepages with at least one", band: false, fmt: (v) => `${v}%`, max: 100 });

console.error(JSON.stringify(status), `sites=${summary.sites}`);
