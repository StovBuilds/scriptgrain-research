#!/usr/bin/env bun
// SGR-025: write the study entry in src/data/research-pages.json from public/research/sgr-025-summary.json.
// Every number in the copy comes from the summary; none is typed here.
//   bun scripts/experiments/sgr-025/write-entry.mjs --conducted-on 2026-11-03 --publish-on 2026-11-04
// Refuses: a pilot summary (unless --allow-pilot, used only to test the entry against the CI guards), a summary generated
// on another UTC date than --conducted-on, a conducted/publish pair that is not one day apart, an Index run whose
// pre-registered checks failed (comparison not assessed, instrument reproduction under 4 of 8, credit rules broken).
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const CONDUCTED = opt("--conducted-on"), PUBLISH_ON = opt("--publish-on");
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const dayBefore = (iso) => new Date(Date.parse(iso + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
if (dayBefore(PUBLISH_ON) !== CONDUCTED) throw new Error(`conductedOn must be the day before publishOn (${dayBefore(PUBLISH_ON)})`);
const here = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(opt("--summary") ?? "public/research/sgr-025-summary.json", "utf8"));
const DEF = JSON.parse(readFileSync(here + "index-definition.json", "utf8"));
if (S.pilot && !args.includes("--allow-pilot")) throw new Error("summary is from a pilot run; refusing");
if (!S.pilot && S.generated.slice(0, 10) !== CONDUCTED) throw new Error(`summary was generated ${S.generated.slice(0, 10)}, not on ${CONDUCTED}: re-run run.mjs`);
if (!S.pilot) {
  if (!S.coverage.comparison_assessed) throw new Error(`only ${S.coverage.matched_sites} matched sites (need ${DEF.min_matched_sites}): the comparison cannot be reported; ask Jack`);
  const v = S.checks.instrument_reproduction;
  if (v.identical < 4) throw new Error(`instrument reproduction ${v.identical} of ${v.sites} identical (need 4): do not publish; ask Jack`);
  const c = S.checks.credits;
  if (!c || c.spent > c.budget || c.balance_after_last_call < c.floor) throw new Error("Firecrawl credit rules broken (budget 500, floor 10,000): do not publish; ask Jack");
}
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));

const n = (x, d = 0) => (x == null || !Number.isFinite(x) ? "n/a" : Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
const f2 = (x) => n(x, 2);
const signed = (x, d = 2) => (x == null ? "n/a" : `${x < 0 ? "−" : x > 0 ? "+" : ""}${n(Math.abs(x), d)}`);
const long = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SLUG = "scriptgrain-writing-index";
const Q = S.period, QL = "2026 Q4";
const CMP = Object.fromEntries(S.comparison.map((c) => [c.id, c]));
const MEAS = Object.fromEntries(S.headline_measures.map((m) => [m.id, m]));
const ser = (p) => S.series.find((s) => s.period === p);
const q4 = ser(Q), mid = ser(S.baseline_period);
const IS_SHARE = (id) => id === "em_dash_share";
const lvl = (id, v) => (v == null ? "n/a" : id === "words" ? n(v) : IS_SHARE(id) ? `${n(v * 100)}%` : f2(v));
const chg = (c) => (IS_SHARE(c.id) ? `${signed(c.change * 100, 0)} percentage points` : c.id === "words" ? `${signed(c.change, 0)} words` : signed(c.change, 2));
const sn = (x, d) => (x != null && x < 0 ? `−${n(-x, d)}` : n(x, d));
const ivl = (c) => (c.lo == null ? "interval n/a" : IS_SHARE(c.id) ? `${sn(c.lo * 100, 0)} to ${sn(c.hi * 100, 0)}` : c.id === "words" ? `${sn(c.lo, 0)} to ${sn(c.hi, 0)}` : `${sn(c.lo, 2)} to ${sn(c.hi, 2)}`);
const thr = (c) => (IS_SHARE(c.id) ? `${n(c.threshold * 100, 0)} percentage points` : c.id === "words" ? `${n(c.threshold)} words` : f2(c.threshold));
const RES = { "no detectable change": "No detectable change", "moved, below the threshold": "Moved, below the threshold", changed: "Changed", "not assessed": "Not assessed" };
const counts = Object.fromEntries(Object.keys(RES).map((k) => [k, S.comparison.filter((c) => c.label_result === k).length]));
const changedIds = S.comparison.filter((c) => c.label_result === "changed").map((c) => `${c.label.toLowerCase()}, ${c.direction}`);
const movedIds = S.comparison.filter((c) => c.label_result === "moved, below the threshold").map((c) => c.label.toLowerCase());
const COV = S.coverage, V = S.checks.instrument_reproduction, R = S.checks.repeat_fetch;
const TITLE = `The ScriptGrain Writing Index, Q4 2026: ${n(COV.sites)} company homepages, measured every quarter`;
const collected = S.collection.first === S.collection.last ? long(S.collection.first) : `${long(S.collection.first)} to ${long(S.collection.last)}`;
const outcome = `${n(counts["no detectable change"])} of 6 measures showed no detectable change, ${n(counts["moved, below the threshold"])} moved by less than the pre-registered threshold and ${n(counts.changed)} changed${counts.changed ? ` (${changedIds.join("; ")})` : ""}.`;

const study = {
  id: "SGR-025", slug: SLUG, title: TITLE,
  seoTitle: "The ScriptGrain Writing Index, Q4 2026: company homepages, measured · ScriptGrain Research",
  question: "What does the first quarterly reading of The ScriptGrain Writing Index, a fixed panel of 161 company homepages measured since 2000, show for the fourth quarter of 2026, and did the writing on those homepages change since mid-2026?",
  conductedOn: CONDUCTED, publishOn: PUBLISH_ON,
  description: `The first quarterly refresh of SGR-004's company homepages, published as a versioned dataset with stable column names and a changelog. ${n(COV.measured)} of ${n(COV.sites)} homepages measured in ${QL}; AI-era vocabulary ${f2(q4.ai_era_vocab)} uses per 1,000 words, em dash on ${lvl("em_dash_share", q4.em_dash_share)} of homepages.`,
  abstract: [
    { label: "Background", text: "SGR-004 measured 161 long-lived company homepages once a year from 2000 to 2026. A single study ages; a panel that is measured again on a fixed schedule with fixed definitions does not. This is the first refresh, and the first release of the dataset under the name The ScriptGrain Writing Index, with a version number, stable column names and a changelog." },
    { label: "What we did", text: `We fixed the Index definition in public before the new measurement: six headline measures (no composite score), the statistic for each, and a threshold for calling a quarter-on-quarter move a change, taken from the largest whole-year move in SGR-004's own published data. Then we fetched each company's current homepage once on ${collected} and measured it exactly as SGR-004 measured its pages (same extractor, same product instruments, same word lists). The ${QL} reading is compared with each company's own mid-2026 reading (a Wayback Machine capture from ${long(COV.baseline_captured_first)} to ${long(COV.baseline_captured_last)}), using only the ${n(COV.matched_sites)} companies measured both times.` },
    { label: "What we found", text: `${n(COV.measured)} of ${n(COV.sites)} homepages had enough prose to measure in ${QL}. Across the ${n(COV.matched_sites)} matched companies, ${outcome} We expected little change over about four months, and the pre-registration said so; what the table shows is how far the two readings differ, not proof that any company rewrote its page.` },
    { label: "What it means", text: "This is the Index's baseline reading, not a trend. One quarter cannot show direction, and the first comparison also changes the way pages are obtained (an archive replay in mid-2026, a live fetch now), so even a measure marked as changed should be read as 'the two readings differ'. The value of the Index builds with each quarterly refresh." },
  ],
  keyNumbers: [
    `${n(COV.measured)} of ${n(COV.sites)} company homepages had enough prose to measure in the fourth quarter of 2026 (ScriptGrain Writing Index v${S.index_version}; ${n(mid.measured)} in mid-2026).`,
    `AI-era marketing vocabulary averaged ${f2(q4.ai_era_vocab)} uses per 1,000 words on company homepages in ${QL}, against ${f2(mid.ai_era_vocab)} in mid-2026 (all measured sites in each period; comparing the ${n(COV.matched_sites)} companies measured both times, the result was: ${RES[CMP.ai_era_vocab.label_result].toLowerCase()}).`,
    `${lvl("em_dash_share", q4.em_dash_share)} of measured company homepages used an em dash in ${QL}, against ${lvl("em_dash_share", mid.em_dash_share)} in mid-2026.`,
    `The median company homepage carried ${n(q4.words)} words of prose in ${QL} and ${n(mid.words)} in mid-2026.`,
    `Comparing each of ${n(COV.matched_sites)} companies with itself, ${n(counts["no detectable change"])} of 6 headline measures showed no detectable change between mid-2026 and ${QL}.`,
  ],
  measures: [
    { term: "The Index", definition: `A fixed panel of ${n(COV.sites)} UK and US company homepages in 11 sectors, measured on six headline measures every period with fixed definitions. Version ${S.index_version}. Each refresh adds a period; a changed definition is a new major version with a changelog entry. There is no composite score, because the measures move in different directions and any weighting would be a choice that could be tuned.` },
    ...DEF.headline_measures.map((m) => ({ term: m.label, definition: `Column ${m.column}. Level: ${m.level === "median" ? "median across measured sites" : m.level === "mean" ? "mean across measured sites" : "share of measured sites with at least one"}. Change between periods: ${m.change_statistic}.` })),
    { term: "Matched sites", definition: "Companies measured in both periods being compared. Only they enter a comparison, so a site joining or leaving the measured set cannot move it." },
    { term: "Threshold", definition: "The smallest move called a change. For each measure it is the largest whole-year move among matched sites between 2022 and 2026 in SGR-004's published data, fixed before the new pages were measured. A quarter-on-quarter move must be as big as that to be called a change." },
    { term: "Three results", definition: "No detectable change: the 95% interval for the move includes zero. Moved, below the threshold: the interval excludes zero but the move is smaller than the threshold. Changed: the interval excludes zero and the move is at least the threshold." },
  ],
  analyst: ANALYSTS["jack-stovell"],
  competingInterests: "ScriptGrain sells writing-voice measurement and the analyst builds it. The Index definition, the thresholds and the rule for calling a change were committed to ScriptGrain's research repository (public on GitHub) before the new pages were measured, every measure is reported whichever way it came out, and the data and scripts are public.",
  notShown: [
    "That any homepage was written or changed with AI. The Index measures vocabulary and punctuation on public pages, not who or what wrote them.",
    "That a difference between mid-2026 and the fourth quarter is a change in the writing. The two readings are obtained differently (an archive replay and a live fetch), at different dates.",
    "A trend. One quarterly reading cannot show direction.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Anything about pages other than homepages, or about companies outside the panel.",
  ],
  productNote: "ScriptGrain measures writing voice: the habits that make a writer recognisable, such as sentence rhythm, punctuation and vocabulary. The AI-tell scan in this Index is the one behind the free [AI cliche checker](/tools/ai-cliche-checker). Neither is a test of who, or what, wrote a text.",
  sample: {
    description: `The SGR-004 panel: ${n(COV.sites)} company homepages (UK and US, 11 sectors), fixed in October 2026. Period ${QL}: each homepage fetched once, live, on ${collected}, rendered with JavaScript. Baseline: the same companies' mid-2026 readings from SGR-004 (Wayback Machine captures, ${long(COV.baseline_captured_first)} to ${long(COV.baseline_captured_last)}). ${n(COV.matched_sites)} companies were measured in both.`,
    size: COV.measured,
    inclusionCriteria: ["The homepage (the domain's root URL) only, never a deeper page", "At least 100 words of prose after menus, footers and scripts were removed, as in SGR-004", "Only companies measured in both periods enter the comparison"],
    exclusions: [
      `${n(COV.sites - COV.measured)} of ${n(COV.sites)} homepages not measured in ${QL}: ${Object.entries(COV.status).filter(([k]) => k !== "measured").map(([k, v]) => `${n(v)} ${k.replace(/_/g, " ")}`).join(", ") || "none"}`,
      `${n(COV.exclusions.redirected_off_domain)} homepages redirected to another domain (for example a brand's consumer site); they were measured as served, as in SGR-004`,
      "Page text is not published; counts and rates only",
    ],
  },
  method: [
    `Pre-registration: the Index definition, the six measures, the thresholds and the analysis were committed to [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research) before the new pages were measured (docs/research/sgr-025-preregistration.md). The script was tested on 8 sites (5%); the test results are not reported.`,
    `Fetch: each homepage was requested once at https://domain/ through a page-rendering service with JavaScript run and caching off, on ${collected}. Sites the service refuses are recorded as fetch failed, not retried by other means.`,
    "Extraction and measurement: identical to SGR-004. Visible prose lines with scripts, navigation and footers removed (page headers, forms and asides kept; repeated lines counted once), measured with the product's own deterministic instruments, measureTextFeatures and scanCliches, and the two fixed word lists. No language model was used to read or score any page.",
    `Comparison: for the ${n(COV.matched_sites)} matched companies, the change in each headline measure from mid-2026 to ${QL} with a 95% bootstrap interval (${n(S.bootstrap_resamples)} resamples of companies, fixed seed). A move is called a change only if the interval excludes zero and the move reaches the pre-registered threshold.`,
    `Checks: SGR-004's own 2026 captures of 8 sites were re-rendered and measured with this code to show it reproduces SGR-004's rows; 16 sites were requested a second time (${n(R.sites_fetched_twice)} returned a page) to show how much a repeat fetch of the same live page differs.`,
  ],
  variablesMeasured: DEF.headline_measures.map((m) => m.label).concat(["Words, sentence shape, pronouns, contractions and punctuation (all columns in the dataset)"]),
  findings: [
    ...S.comparison.map((c) => ({
      label: `${c.label}: ${RES[c.label_result].toLowerCase()}`,
      value: `${lvl(c.id, c.baseline)} in mid-2026, ${lvl(c.id, c.current)} in ${QL} (${chg(c)}, 95% interval ${ivl(c)})`,
      explanation: `Matched sites: ${n(c.matched_sites)}. Threshold for a change: ${thr(c)}. Rule: the interval must exclude zero and the move must reach the threshold.`,
    })),
    { label: "Coverage", value: `${n(COV.measured)} of ${n(COV.sites)} homepages measured in ${QL}, ${n(COV.matched_sites)} matched with mid-2026`, explanation: "A homepage with under 100 words of prose, a bot check page or a refused fetch is recorded, not measured." },
    { label: "Instrument check", value: `${n(V.identical)} of ${n(V.sites)} sites reproduced SGR-004's published row exactly`, explanation: "The others came back from the archive as a different page on re-rendering (an empty script shell, or content that loads differently), not as a different measurement of the same page." },
  ],
  sections: [
    { heading: "Two vocabularies, with the 2026 Q4 point", figure: { src: "/research/sgr-025-vocab.svg", alt: `Line chart of AI-era and dotcom vocabulary per 1,000 words on company homepages from 2012 to 2026, with a final live point for ${QL}: AI-era ${f2(q4.ai_era_vocab)}, dotcom ${f2(q4.dotcom_vocab)}.`, caption: "Source: ScriptGrain SGR-004 and SGR-025, CC BY 4.0.", width: 760, height: 380 } },
    { heading: "Homepages using an em dash, with the 2026 Q4 point", figure: { src: "/research/sgr-025-em-dash.svg", alt: `Line chart of the share of company homepages using an em dash from 2012 to 2026, with a final live point for ${QL} at ${lvl("em_dash_share", q4.em_dash_share)}.`, caption: "Source: ScriptGrain SGR-004 and SGR-025, CC BY 4.0.", width: 760, height: 380 } },
    { heading: `Mid-2026 against ${QL}, matched companies`, paragraphs: [`Each company is compared with itself. The threshold is the smallest move called a change; it was fixed before the new pages were measured. ${outcome}`], table: { columns: ["Measure", "Mid-2026", QL, "Move (95% interval)", "Threshold", "Result"], rows: S.comparison.map((c) => [c.label, lvl(c.id, c.baseline), lvl(c.id, c.current), `${chg(c)} (${ivl(c)})`, thr(c), RES[c.label_result]]) } },
    { heading: "The Index by period", paragraphs: ["All measured homepages in each period: median words and sentence length, mean vocabulary and AI-tell density, share with an em dash. The last row is a live fetch; the others are Wayback captures nearest 1 July."], table: { columns: ["Period", "Measured", "Median words", "Median sentence length", "AI-era per 1,000", "Dotcom per 1,000", "With an em dash", "AI-tell per 1,000"], rows: S.series.map((s) => [s.period === Q ? QL : s.period, n(s.measured), s.words == null ? "n/a" : n(s.words), s.sentence_length == null ? "n/a" : f2(s.sentence_length), s.ai_era_vocab == null ? "n/a" : f2(s.ai_era_vocab), s.dotcom_vocab == null ? "n/a" : f2(s.dotcom_vocab), lvl("em_dash_share", s.em_dash_share), s.ai_tell == null ? "n/a" : f2(s.ai_tell)]) } },
    { heading: `By sector, ${QL}`, table: { columns: ["Sector", "Homepages measured", "Median words", "AI-era per 1,000", "With an em dash"], rows: S.by_sector_q4.map((r) => [r.sector.replace(/_/g, " "), n(r.measured), r.words_median == null ? "n/a" : n(r.words_median), r.ai_era_vocab_mean == null ? "n/a" : f2(r.ai_era_vocab_mean), lvl("em_dash_share", r.em_dash_share)]) } },
    { heading: "Checks", paragraphs: [
      `Instrument: SGR-004's own 2026 captures of 8 sites were re-rendered and measured with this study's code. ${n(V.identical)} of ${n(V.sites)} matched the published row on every column. The rest came back from the archive as a different page when re-rendered (some as an empty script shell on the first try), so they test the archive's stability, not the measurement.`,
      `Repeat fetch: ${n(R.sites_fetched_twice)} sites were fetched a second time shortly after the first. ${n(R.measured_both_times)} were measured both times; the median absolute difference between the two fetches was ${R.median_absolute_difference.words == null ? "n/a" : n(R.median_absolute_difference.words)} words, ${R.median_absolute_difference.sentence_length == null ? "n/a" : f2(R.median_absolute_difference.sentence_length)} words of sentence length, ${R.median_absolute_difference.ai_era_vocab == null ? "n/a" : f2(R.median_absolute_difference.ai_era_vocab)} AI-era uses per 1,000 words and ${R.median_absolute_difference.ai_tell == null ? "n/a" : f2(R.median_absolute_difference.ai_tell)} AI-tell density; ${n(R.em_dash_presence_differs)} changed between having and not having an em dash. That is the size of difference a live page shows against itself, before any real change.`,
    ] },
    { heading: "The Index: version and changelog", paragraphs: [`Version ${S.index_version}. The dataset keeps its column names across refreshes: a column is never renamed or repurposed, and a new one is added at the end and noted below. A changed measure, statistic or threshold is a new major version. The files at /research/scriptgrain-writing-index.csv and .json are replaced with each refresh and always carry every period.`], table: { columns: ["Version", "Released", "Period added", "What changed"], rows: DEF.changelog.map((c) => [c.version, long(c.released), c.period_added === Q ? QL : c.period_added, c.summary.join(" ")]) } },
  ],
  limitations: [
    "The two readings are obtained differently: mid-2026 is a rendered Wayback Machine replay of a capture, the fourth quarter is a live fetch. A page can differ between an archive replay and the live site for reasons that have nothing to do with its copy (cookie banners, personalisation, scripts that no longer load, content that loads later). Any difference between the periods includes that.",
    "The two readings are about four months apart, so a small change is expected. The Index is built to be read over several quarters, not one.",
    "Homepages only, and a homepage is the most edited, most headline-shaped page a company has. The panel is 161 large, long-lived companies, mostly UK and US; small businesses and companies founded after 2010 are not represented.",
    "Vocabulary is not authorship. More 'unlock' and 'seamless' on a page is consistent with AI-assisted writing and with copywriters adopting words that AI made familiar. The Index cannot tell those apart and does not say which homepage was written by a model.",
    "Some companies could not be fetched live (the page-rendering service refuses certain sites), some serve a bot check, and some redirect to another domain; the measured set differs between periods, which is why comparisons use matched companies only.",
    "The thresholds come from SGR-004's own year-on-year moves among matched sites; they are a judgement about how large is large, fixed in advance, not a statistical property.",
  ],
  reproducibility: [
    "Pre-registration, Index definition, run script and entry builder: docs/research/sgr-025-preregistration.md and scripts/experiments/sgr-025/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research).",
    "Instruments: supabase/functions/_shared/voice-match.ts (measureTextFeatures) and ai-cliches.ts (scanCliches), the code the product runs. The fetched pages are not republished; every row carries its fetch date, so any page can be fetched and measured again.",
  ],
  dataDownloads: [
    { label: "The Index: every homepage, every period, stable columns (CSV)", path: "/research/scriptgrain-writing-index.csv", format: "csv" },
    { label: "The Index: definition, columns, series by period, latest comparison and changelog (JSON)", path: "/research/scriptgrain-writing-index.json", format: "json" },
    { label: "This refresh: coverage, comparison and checks (JSON)", path: "/research/sgr-025-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Index version ${S.index_version}; Study SGR-025, conducted ${long(CONDUCTED)}). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${SLUG}`,
  citations: [
    { name: "ScriptGrain (2026). Did ChatGPT change how companies write? 27 years of homepages, measured (SGR-004)", url: "https://scriptgrain.com/research/did-chatgpt-change-how-companies-write" },
    { name: "Wayback Machine, Internet Archive", url: "https://web.archive.org/" },
  ],
};

const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
const i = data.studies.findIndex((x) => x.id === study.id); if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-025 written; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
