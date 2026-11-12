#!/usr/bin/env node
// SGR-028: write the study entry in src/data/research-pages.json from the run's summary, so every
// number on the page is the run's number and nothing is typed by hand.
//
//   node scripts/experiments/sgr-028/write-entry.mjs --conducted-on 2026-11-12 --publish-on 2026-11-13
//
// Guards: conductedOn must equal the day run.mjs ran (summary.ranOn), publishOn must be the next day,
// a pilot summary is refused, and a failed instrument check is refused (pre-registration section 4).
// (--allow-pilot exists only for testing the builder; never commit its output.)
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CONDUCTED = opt("--conducted-on", null), PUBLISH_ON = opt("--publish-on", null);
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const SUMMARY = opt("--summary", "public/research/sgr-028-summary.json");
const FIG = opt("--figures", "public/research");
const OUTFILE = opt("--data", "src/data/research-pages.json");
const S = JSON.parse(readFileSync(SUMMARY, "utf8"));
const testing = args.includes("--allow-pilot");
if (S.pilot && !testing) throw new Error("refusing a pilot summary");
if (!S.instrument.ok && !testing) throw new Error("the US instrument check failed: the pre-registration says no result is reported. Stop and tell Jack.");
if (!S.pilot && S.ranOn !== CONDUCTED) throw new Error(`summary ran on ${S.ranOn}, not ${CONDUCTED}: re-run run.mjs on the conducted date; never edit the date`);
const nextDay = new Date(Date.parse(`${CONDUCTED}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
if (!S.pilot && PUBLISH_ON !== nextDay) throw new Error(`publishOn must be the day after conductedOn (${nextDay})`);

const here = new URL(".", import.meta.url).pathname;
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const MINUS = "−";
const sgn = (x, d) => (x > 0 && n(x, d) !== n(0, d) ? "+" : x < 0 && n(Math.abs(x), d) !== n(0, d) ? MINUS : "");
const num = (x, d) => `${sgn(x, d) === MINUS ? MINUS : ""}${n(Math.abs(x), d)}`;
const pct = (x, d = 2) => `${n(100 * x, d)}%`;
const pp = (x, d = 2) => `${sgn(x, d)}${n(Math.abs(100 * x), d)} percentage points`;
const ppShort = (x, d = 2) => `${sgn(x, d)}${n(Math.abs(100 * x), d)} pp`;
const ciPP = (h) => (h.lo == null ? "not enough data" : `${ppShort(h.point)} (95% interval ${num(100 * h.lo, 2)} to ${num(100 * h.hi, 2)})`);
const ciR = (h, d = 3) => (h.lo == null ? "not enough data" : `${sgn(h.point, d)}${n(Math.abs(h.point), d)} (95% interval ${num(h.lo, d)} to ${num(h.hi, d)})`);
const verdict = (r) => (r === "supported" ? "Supported" : r === "not testable" ? "Not testable" : "Not supported");
const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const figDims = (file) => { const m = readFileSync(`${FIG}/${file}`, "utf8").match(/viewBox="0 0 (\d+) (\d+)"/); return { width: +m[1], height: +m[2] }; };

const { H1, H1b, H2, H3, corpus: C, us_control: USC, sensitivities: SN } = S;
const SLUG = "is-chatgpt-americanising-british-writing";
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const ukN = H2.n, usN = USC.phrases_per_1000.n;
const TITLE = "Is ChatGPT Americanising British writing? American spelling and phrasing in UK brand writing before and after November 2022";
const outcome = {
  "British brand writing moved towards American spelling and phrasing after November 2022, beyond US drift": "UK brands moved towards American spelling and phrasing after ChatGPT, by more than American brands' own drift.",
  "both countries drifted together; not Americanisation": "UK brands' spelling and phrasing moved, but American brands moved the same way, so this is shared drift, not Americanisation.",
  "a phrasing, not a spelling, finding": "UK brands picked up more American business phrasing after ChatGPT, but their spelling did not move towards American forms.",
  "no detected shift": "We found no clear shift towards American spelling or American business phrasing in UK brand writing after ChatGPT.",
}[S.wording] ?? S.wording;
const spellLine = `American spellings were ${pct(H1.from_mean)} of the words that have a British and an American form before and ${pct(H1.to_mean)} after, counting only words where Oxford spelling cannot blur the line (change ${ciPP(H1)}, ${H1.up} of ${H1.n} brands up).`;
const phraseLine = `American business phrases such as "reach out" and "going forward" went from ${n(H2.from_mean, 3)} to ${n(H2.to_mean, 3)} per 1,000 words (change ${ciR(H2)}, ${H2.up} of ${H2.n} brands up).`;
const usLine = `American brands' own phrase rate changed by ${ciR(USC.phrases_per_1000)} per 1,000 words over the same periods (${usN} brands).`;
const topAfter = Object.entries(S.phrases.uk_after).slice(0, 5).map(([k, v]) => `${k} (${n(v.per_1000, 3)})`).join(", ");

const study = {
  id: "SGR-028",
  slug: SLUG,
  title: TITLE,
  seoTitle: "Is ChatGPT Americanising British writing? UK brands measured before and after · ScriptGrain Research",
  question: "Since ChatGPT launched on 30 November 2022, has British brand writing moved towards American spelling and American business phrasing, and by more than American brand writing's own drift?",
  conductedOn: CONDUCTED,
  publishOn: PUBLISH_ON,
  description: `A pre-registered before-and-after study of ${n(C.uk.before.pages + C.uk.after.pages)} dated pages from ${ukN} UK brands, each brand compared with itself, with ${usN} American brands as the control. ${outcome}`,
  abstract: [
    { label: "Background", text: "People say AI tools are pushing British writing towards American English: \"organize\" for \"organise\", \"reach out\" for \"get in touch\". Spelling is the easy part to measure and the easy part to get wrong, because Oxford spelling (\"organize\" with \"colour\") is legitimate British usage. So we measured spelling and phrasing separately, and spelling twice." },
    { label: "What we did", text: `We fixed four hypotheses before the full measurement. From our corpus of UK brands' blogs, press releases and announcements, we took every brand with at least 30 dated pages before December 2022 and 30 from 2023 on, and compared each brand only with itself. Brands that wrote American before ChatGPT were set aside (${C.uk_guarded.length}). We counted a closed list of 168 spelling pairs and 30 American business phrases in code, and ran the same measurement on ${usN} American brands as a control.` },
    { label: "What we found", text: `${spellLine} ${phraseLine} ${usLine}` },
    { label: "What it means", text: `${outcome} A change in the ChatGPT era is a correlation with that era, not evidence that any page was written by AI: American phrasing also spreads through global templates, US parent companies, agencies and hiring.` },
  ],
  keyNumbers: [
    `American spelling in UK brand writing went from ${pct(H1.from_mean)} to ${pct(H1.to_mean)} of words with a British and an American form, before and after November 2022, within the same ${H1.n} brands (Oxford-proof words; change ${ciPP(H1)}; ScriptGrain, 2026).`,
    `American business phrases in UK brand writing went from ${n(H2.from_mean, 3)} to ${n(H2.to_mean, 3)} per 1,000 words within the same ${H2.n} brands (change ${ciR(H2)}).`,
    `In the same periods American brands' phrase rate changed by ${ciR(USC.phrases_per_1000)} per 1,000 words (${usN} brands); the UK change minus the US change was ${ciR(H3.phrases)}.`,
    `The study measured ${n(C.uk.before.pages + C.uk.after.pages)} dated pages (${n(C.uk.before.words + C.uk.after.words)} words) from ${ukN} UK brands and ${n(C.us.before.pages + C.us.after.pages)} pages from ${usN} US brands.`,
  ],
  measures: [
    { term: "Before and after", definition: "Before: pages dated up to November 2022 (ChatGPT launched on 30 November 2022), including archived copies from the Wayback Machine. After: live pages dated January 2023 onwards. December 2022 is a buffer and left out, as are undated pages and pages dated only by a last-modified stamp." },
    { term: "American spelling share", definition: "American forms divided by American plus British forms, over a closed, pre-registered list of 168 word pairs (2,979 word forms), such as colour and color or organise and organize. Pairs with a second meaning are excluded (licence and license, practise and practice, programme and program, meter and metre, among others). Brand names, capitalised mid-sentence words, quotations and links are skipped." },
    { term: "Oxford-proof words", definition: "The 70 pairs where Oxford spelling and American spelling differ, such as colour and color or centre and center. Oxford spelling writes -ize but keeps -our and -re, so it is legitimate British usage; the -ize pairs are reported separately and are not in the headline test." },
    { term: "American business phrases", definition: "Uses per 1,000 words of 30 pre-registered phrases and words: reach out, going forward, touch base, circle back, deep dive, low-hanging fruit, game changer, move the needle, pain point, best in class, learnings, gotten, awesome, vacation, cell phone, zip code and others, plus \"leverage\" used as a verb." },
    { term: "Within-brand change", definition: "For each brand, the value after minus the value before; then the mean of those changes, each brand counting once, so a brand that published more after cannot dominate." },
    { term: "95% interval", definition: "From 10,000 bootstrap resamples of brands (fixed seed). A hypothesis passes only if the mean change reaches its pre-registered size, the interval's lower bound is above zero and at least 60% of brands moved up." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, word lists, periods and tests were committed to ScriptGrain's research repository (https://github.com/StovBuilds/scriptgrain-research) before the full measurement, every result is reported whether it passed or failed, and the data and scripts are public.",
  notShown: [
    "That any page, or any brand, used AI to write. The counts show style in the ChatGPT era, not who or what wrote a page.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Why any change happened. US parent companies, global templates, agencies, new staff and style guides can each move these numbers.",
    "Anything about British writing outside brand blogs, press releases and announcements.",
  ],
  productNote: "ScriptGrain measures writing voice, and lets you set British or American English for every draft. This study is about how UK brand writing changed; it does not test who, or what, wrote any page.",
  sample: {
    description: `UK brands from ScriptGrain's brand corpus (blogs, press releases and announcements; live pages fetched in October 2026 and archived pages from the Wayback Machine) with at least 30 dated pages before December 2022 and 30 from 2023 on: ${C.uk_brands_eligible_pages} brands, of which ${C.uk_guarded.length} wrote American before ChatGPT and were set aside. Control: ${C.us_brands_eligible_pages} American brands from ScriptGrain's US brand corpus with at least 10 dated pages on each side.`,
    size: C.uk.before.pages + C.uk.after.pages,
    inclusionCriteria: ["A UK brand in ScriptGrain's brand corpus", "At least 30 dated pages before December 2022 and 30 from January 2023", "At least 30 spelling-pair words in each period, for the spelling measures", "An American spelling share of 50% or less before ChatGPT (the house-style guard)"],
    exclusions: [`${C.uk_guarded.length} brands that wrote American before ChatGPT`, "Pages dated December 2022, undated pages and pages dated only by a last-modified stamp", "Archived (Wayback) pages dated after November 2022"],
  },
  method: [
    "Corpus: ScriptGrain's UK brand corpus (blogs, press releases and announcements from UK brands in ten sectors) and US brand corpus (the American counterpart, matched by sector). Every page was measured in code; no language model read or scored any page.",
    "Dating: the page's own published date (meta tags, structured data, the URL or a date in the text); for archived pages, the month of the capture, which is an upper bound on publication.",
    "Cleaning: markdown reduced to plain text; tables, code, block quotes, links, email addresses and quoted speech removed; the brand's own name and any capitalised word that does not start a sentence skipped (proper names, product names, Title Case headings).",
    "Pre-registration: the hypotheses, word lists, periods, eligibility rules and tests were committed to [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research) before the full measurement (docs/research/sgr-028-preregistration.md). The run was done once, on the day before publication.",
    "Tests: mean within-brand change with a 95% interval from 10,000 bootstrap resamples of brands; Wilcoxon signed-rank test and the share of brands that moved up as secondary checks. H3 compares the UK change with the US change, the two countries resampled separately.",
  ],
  variablesMeasured: ["American spelling share (all pairs, Oxford-proof pairs, -ize pairs)", "American business phrases per 1,000 words", "British markers per 1,000 words (whilst, amongst, learnt, towards; descriptive only)"],
  findings: [
    { label: `H1 (${verdict(H1.result).toLowerCase()}): American spelling, Oxford-proof words`, value: `${pct(H1.from_mean)} to ${pct(H1.to_mean)}; change ${ciPP(H1)}`, explanation: `${H1.up} of ${H1.n} brands moved up. The pre-registered bar was +0.25 percentage points with an interval above zero and at least 60% of brands up. Wilcoxon p ${H1.wilcoxon.p == null ? "not computed" : n(H1.wilcoxon.p, 3)}.` },
    { label: `H1b (${verdict(H1b.result).toLowerCase()}): American spelling, all pairs`, value: `${pct(H1b.from_mean)} to ${pct(H1b.to_mean)}; change ${ciPP(H1b)}`, explanation: `Includes the -ize pairs, which Oxford spelling also uses. The -ize pairs alone: ${ciPP(S.ize_alone)} (${S.ize_alone.n} brands).` },
    { label: `H2 (${verdict(H2.result).toLowerCase()}): American business phrases`, value: `${n(H2.from_mean, 3)} to ${n(H2.to_mean, 3)} per 1,000 words; change ${ciR(H2)}`, explanation: `${H2.up} of ${H2.n} brands moved up. The pre-registered bar was +0.10 per 1,000 words with an interval above zero and at least 60% of brands up. The most frequent phrases after November 2022: ${topAfter}.` },
    { label: `H3 (${verdict(H3.result).toLowerCase()}): UK moved more than the US`, value: `UK minus US phrase change ${ciR(H3.phrases)}`, explanation: `UK ${num(H3.phrases.uk, 3)} against US ${num(H3.phrases.us, 3)} per 1,000 words. The same comparison on Oxford-proof spelling: ${H3.spelling_oxford.lo == null ? "not enough data" : `${ppShort(H3.spelling_oxford.point)} (95% interval ${num(100 * H3.spelling_oxford.lo, 2)} to ${num(100 * H3.spelling_oxford.hi, 2)})`}.` },
  ],
  sections: [
    { heading: "What changed, within the same brands", figure: { src: "/research/sgr-028-change.svg", alt: `Dot chart of mean within-brand change after November 2022: American business phrases ${num(H2.point, 3)} per 1,000 words in UK brands and ${num(USC.phrases_per_1000.point ?? 0, 3)} in US brands; American spelling share on Oxford-proof words ${ppShort(H1.point)} in UK brands and ${ppShort(USC.us_share_oxford.point ?? 0)} in US brands; each with a 95% interval.`, caption: "Source: ScriptGrain SGR-028, CC BY 4.0.", ...figDims("sgr-028-change.svg") } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Change (95% interval)"], rows: [
      ["H1: American spelling rose (Oxford-proof words)", verdict(H1.result), ciPP(H1)],
      ["H1b: American spelling rose (all pairs)", verdict(H1b.result), ciPP(H1b)],
      ["H2: American business phrases rose", verdict(H2.result), `${ciR(H2)} per 1,000 words`],
      ["H3: UK moved towards the US more than the US moved", verdict(H3.result), `${ciR(H3.phrases)} per 1,000 words`],
    ] } },
    { heading: "Checks", paragraphs: ["Reported, not tested. Each repeats the main comparison with one change."], table: { columns: ["Check", "Spelling, Oxford-proof (95% interval)", "Phrases per 1,000 words (95% interval)", "Brands"], rows: [
      ["Main test", ciPP(H1), ciR(H2), String(H2.n)],
      ["Before = live pages only (no archived copies)", ciPP(SN.before_live_only.us_share_oxford), ciR(SN.before_live_only.phrases_per_1000), String(SN.before_live_only.phrases_per_1000.n)],
      ["After = 2024 onwards only", ciPP(SN.after_2024_on.us_share_oxford), ciR(SN.after_2024_on.phrases_per_1000), String(SN.after_2024_on.phrases_per_1000.n)],
      ["Software brands left out", ciPP(SN.software_excluded.us_share_oxford), ciR(SN.software_excluded.phrases_per_1000), String(SN.software_excluded.phrases_per_1000.n)],
      ["US control, brands with 30+ pages each side", ciPP(SN.us_brands_30plus.us_share_oxford), ciR(SN.us_brands_30plus.phrases_per_1000), String(SN.us_brands_30plus.phrases_per_1000.n)],
    ] } },
    { heading: "By sector", paragraphs: ["Exploratory. Few brands per sector, so the intervals are wide."], table: { columns: ["Sector", "Brands", "Spelling, Oxford-proof", "Phrases per 1,000 words"], rows: Object.entries(SN.by_sector).map(([k, v]) => [k, String(v.phrases_per_1000.n), v.us_share_oxford.n ? ciPP(v.us_share_oxford) : "n/a", ciR(v.phrases_per_1000)]) } },
    { heading: "Brands that wrote American before ChatGPT", paragraphs: [C.uk_guarded.length ? `${C.uk_guarded.length} brands in the UK corpus already used American spelling for more than half of the paired words before December 2022 (mostly US-headquartered software companies with UK sites). They are left out of every UK test: ${C.uk_guarded.join(", ")}.` : "No brand in the UK corpus used American spelling for more than half of the paired words before December 2022."] },
    { heading: "The measuring instrument", paragraphs: [`As a check on the word list, American brands should read as American. Across the ${S.instrument.us_brands} US control brands, ${pct(S.instrument.pooled_us_share, 1)} of paired words used the American form (pre-registered floor 98%). The rest are genuine British spellings by American brands' writers, not misread words.`] },
  ],
  limitations: [
    "A change in the ChatGPT era is a correlation with that era. It is not evidence that any text was written by AI.",
    "Oxford spelling is legitimate British usage. The -ize spellings are not errors and are not in the headline test.",
    "Before-period text is mostly archived Wayback copies and after-period text mostly live pages, so the extraction differs; the live-only check and the US control address this.",
    "Dates come from page metadata, the URL and dates in the text; a date in the text is a best guess.",
    "Brand blogs and press pages are written by many people, sometimes by agencies.",
    "Skipping capitalised words loses some real words in Title Case headings, equally in both periods.",
    "Phrase counts are low, about one per 10,000 words, so a few brands can move the totals; this is why the test is per brand and needs most brands to move.",
    `The US control has fewer brands (${usN}) than the UK panel and needed only 10 dated pages each side to be included.`,
  ],
  reproducibility: [
    "Pre-registration and scripts: docs/research/sgr-028-preregistration.md and scripts/experiments/sgr-028/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research) (terms.mjs holds the word lists, measure.mjs the counting, run.mjs the analysis, write-entry.mjs builds this page from the summary).",
    "Only counts are published; no brand's text is reproduced.",
  ],
  dataDownloads: [
    { label: "Brand by period: pages, words, spelling shares and phrase rates (CSV)", path: "/research/sgr-028-brands.csv", format: "csv" },
    { label: "Summary: hypotheses, intervals, checks, phrase and marker counts (JSON)", path: "/research/sgr-028-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-028, conducted ${date(CONDUCTED)}). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "ScriptGrain (2026). Did brand writing change after ChatGPT? (SGR-011)", url: "https://scriptgrain.com/research/did-brand-writing-change-after-chatgpt" },
    { name: "Oxford spelling, Oxford English Dictionary", url: "https://www.oed.com/" },
  ],
};

const data = JSON.parse(readFileSync(OUTFILE, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(OUTFILE, JSON.stringify(data, null, 2) + "\n");
if (OUTFILE === "src/data/research-pages.json") writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-028 ${i === -1 ? "added" : "updated"}; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
