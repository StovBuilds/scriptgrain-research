#!/usr/bin/env bun
// SGR-023: write the study entry in src/data/research-pages.json from public/research/sgr-023-summary.json.
// Every number in the copy comes from the summary; none is typed here.
//   bun scripts/experiments/sgr-023/write-entry.mjs --conducted-on 2026-10-27 --publish-on 2026-10-28
// Refuses a pilot summary unless --allow-pilot (used only to test the entry against the CI guards), a summary
// generated on another UTC date, a conducted/publish pair not one day apart, and a failed syllable validation
// unless --accept-validation-failure (that is a decision for Jack).
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const CONDUCTED = opt("--conducted-on"), PUBLISH_ON = opt("--publish-on");
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const dayBefore = (iso) => new Date(Date.parse(iso + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
if (dayBefore(PUBLISH_ON) !== CONDUCTED) throw new Error(`conductedOn must be the day before publishOn (${dayBefore(PUBLISH_ON)})`);
const here = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync("public/research/sgr-023-summary.json", "utf8"));
if (S.pilot && !args.includes("--allow-pilot")) throw new Error("summary is from a pilot run; refusing");
if (!S.pilot && S.generated.slice(0, 10) !== CONDUCTED) throw new Error(`summary was generated ${S.generated.slice(0, 10)}, not on ${CONDUCTED}: re-run run.mjs`);
if (!S.syllable_validation.pass && !args.includes("--accept-validation-failure")) throw new Error("the syllable counter failed its pre-registered validation criteria: this comes back to Jack (see summary.syllable_validation)");
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));

const n = (x, d = 0) => (x == null || !Number.isFinite(x) ? "n/a" : Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
const f1 = (x) => n(x, 1), f2 = (x) => n(x, 2);
const signed = (x, d = 2) => (x == null ? "n/a" : `${x < 0 ? "−" : "+"}${n(Math.abs(x), d)}`);
const sn = (x, d) => (x < 0 ? `−${n(Math.abs(x), d)}` : n(x, d));
const rng = (lo, hi, d = 2) => (lo == null ? "interval n/a" : `${sn(lo, d)} to ${sn(hi, d)}`);
const pct = (x, d = 0) => (x == null ? "n/a" : `${n(x * 100, d)}%`);
const long = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const V = (v) => ({ supported: "Supported", "not supported": "Not supported", reversed: "Reversed", "not testable": "Not testable" })[v] ?? "Not testable";
const SECTOR = { bank: "Banks", energy: "Energy", telecom: "Telecoms", software: "Software", grocery: "Supermarkets", travel: "Travel", insurance: "Insurance", fashion: "Fashion", charity: "Charities", food: "Food and drink" };

const H = S.hypotheses, LV = S.levels, CO = S.corpus, SV = S.syllable_validation, RF = S.reference, SE = S.sensitivity;
const OV = LV.overall;
const secRows = Object.entries(LV.by_sector).map(([k, v]) => ({ k, name: SECTOR[k] ?? k, v })).sort((a, b) => b.v.reading_age.brand_median - a.v.reading_age.brand_median);
const hardest = secRows[0], easiest = secRows.at(-1);
const SLUG = "what-reading-age-do-uk-brands-write-for";
const TITLE = `What reading age do UK brands write for? Readability of ${n(CO.brands_with_scored_pages)} brands' blogs and press releases, 2015 to 2026`;
const yr = (c, y) => S.by_year.find((r) => r.category === c && r.year === y);
const first = S.by_year.find((r) => r.category === "all"), last = S.by_year.filter((r) => r.category === "all").at(-1);

const h1Line = H.H1.result === "not testable" ? "The press-against-blog comparison could not be run." : `Within the same brand, press releases scored ${signed(H.H1.point)} grades (95% interval ${rng(H.H1.lo, H.H1.hi)}) against its blog posts, across ${n(H.H1.eligible_brands)} brands: ${V(H.H1.result).toLowerCase()}.`;
const h2Dir = H.H2.result === "supported" ? "harder" : H.H2.result === "reversed" ? "easier" : "not clearly different";
const h2Line = H.H2.result === "not testable" ? "The 2015 to 2018 against 2024 onward comparison could not be run." : `Within brand and channel, the Flesch-Kincaid grade moved ${signed(H.H2.point)} from 2015 to 2018 to 2024 onward (95% interval ${rng(H.H2.lo, H.H2.hi)}, ${n(H.H2.cells)} brand-channel pairs): ${V(H.H2.result).toLowerCase()}, writing ${h2Dir === "not clearly different" ? "not clearly different in difficulty" : `${h2Dir} to read`}.`;
const h3Dir = H.H3.result === "supported" ? "fell more" : H.H3.result === "reversed" ? "rose more" : "did not clearly differ";
const h3Line = H.H3.result === "not testable" ? "The Consumer Duty comparison could not be run: too few brands in one of the groups had enough dated pages." : `Banks and insurers changed ${signed(H.H3.fca_change)} grades between before the Duty's final rules and after it came into force, other sectors ${signed(H.H3.other_change)}; the difference was ${signed(H.H3.point)} (95% interval ${rng(H.H3.lo, H.H3.hi)}, ${n(H.H3.fca_brands)} regulated and ${n(H.H3.other_brands)} other brands): ${V(H.H3.result).toLowerCase()}.`;

// Two context lines the numbers need (added on D-1, 2026-10-27; descriptive, from the summary, no analysis changed).
const SC = SE.source_check?.fk;
const srcLine = SC ? `A pre-registered check on how the pages were collected matters here: for ${n(SE.source_check.brands)} brands with both live and archived pages from 2019 to November 2022, the live pages scored ${signed(SC.point)} grades against the archived ones from the same years (95% interval ${rng(SC.lo, SC.hi)}). Every page from 2024 on is a live page and most dated pages from 2015 to 2018 are archived copies, so part of the change over time may come from how the pages were collected rather than from the writing.` : "";
const SCC = LV.by_sector_category;
const pressShare = (k) => { const c = SCC[k] ?? {}; const t = Object.values(c).reduce((a, v) => a + v.pages, 0); return t ? (c.press?.pages ?? 0) / t : null; };
const allPress = (CO.by_category.press + CO.by_category.announcement) / CO.pages_scored;
const pressRank = Object.entries(SCC).filter(([, c]) => c.press).sort((a, b) => b[1].press.reading_age.brand_median - a[1].press.reading_age.brand_median);
const blogHarder = Object.values(SCC).every((c) => c.press && c.blog && c.press.reading_age.brand_median > c.blog.reading_age.brand_median);
const mixLine = `Sector medians mix channels, and ${blogHarder ? "in every sector press releases and announcements scored harder than blog posts at the median" : "press releases and blog posts differ"}. ${pct(pressShare(hardest.k))} of the scored pages from ${hardest.name.toLowerCase()} were press releases or announcements, against ${pct(allPress)} of all pages, which pushes that sector up the table; within press releases and announcements alone, ${pressRank[0][0] === hardest.k ? `${hardest.name.toLowerCase()} still had the highest median (reading age ${f1(SCC[hardest.k].press.reading_age.brand_median)})` : `${(SECTOR[pressRank[0][0]] ?? pressRank[0][0]).toLowerCase()} had the highest median (reading age ${f1(pressRank[0][1].press.reading_age.brand_median)})`}${SCC[hardest.k].blog ? `, and within blog posts their median was ${f1(SCC[hardest.k].blog.reading_age.brand_median)}` : ""}. Figures for each sector and channel are in the summary file (JSON).`;

const sensRow = (label, o, d = 2) => (o ? [label, o.result ? V(o.result) : "n/a", signed(o.point, d), rng(o.lo, o.hi, d), n(o.n ?? o.eligible_brands ?? o.fca_brands + o.other_brands)] : null);
const sensRows = [];
for (const [h, items] of [["H1", { product_sentence_splitter: "the product's sentence splitter, all lines", cmu_syllables: "CMU dictionary syllables", flesch_reading_ease: "Flesch Reading Ease (a rise means easier)", live_pages_only: "live pages only", pages_of_300_words_or_more: "pages of 300 words or more", min_5_pages_each: "brands with at least 5 pages in each channel", announcements_with_press: "announcements pooled with press"}], ["H2", { product_sentence_splitter: "the product's sentence splitter, all lines", cmu_syllables: "CMU dictionary syllables", flesch_reading_ease: "Flesch Reading Ease (a rise means easier)", guessed_dates_included: "dates guessed from page text included", pages_of_300_words_or_more: "pages of 300 words or more", min_5_pages_each: "at least 5 pages per period", avg_sentence_length: "average sentence length (words)", syllables_per_word: "syllables per word", blog_only: "blog posts only", press_only: "press releases and announcements only", early_to_late: "2015 to 2018 against 2019 to November 2022", late_to_after: "2019 to November 2022 against 2024 onward"}], ["H3", { product_sentence_splitter: "the product's sentence splitter, all lines", cmu_syllables: "CMU dictionary syllables", flesch_reading_ease: "Flesch Reading Ease (a rise means easier)", pre_window_from_2019: "before-period from January 2019", guessed_dates_included: "dates guessed from page text included", without_grocery: "supermarkets removed (some run FCA-regulated arms)", min_5_pages_each: "at least 5 pages per period", avg_sentence_length: "average sentence length (words)", syllables_per_word: "syllables per word", banks_only_vs_others: "banks only against other sectors", insurance_only_vs_others: "insurers only against other sectors"}]]) {
  for (const [k, label] of Object.entries(items)) { const o = SE[h][k]; const flip = k === "flesch_reading_ease" && o?.result ? { ...o, result: { supported: "reversed", reversed: "supported" }[o.result] ?? o.result } : o; const r = sensRow(`${h}: ${label}`, flip); if (r) sensRows.push(r); }
}

const study = {
  id: "SGR-023", slug: SLUG, title: TITLE,
  seoTitle: "What reading age do UK brands write for? 2015 to 2026, measured · ScriptGrain Research",
  question: "What Flesch-Kincaid grade and UK reading age do UK brands' blog posts and press releases demand, how do sectors differ, are press releases harder to read than the same brand's blog posts, and did readability change between 2015 and 2026, including after the FCA's Consumer Duty came into force?",
  conductedOn: CONDUCTED, publishOn: PUBLISH_ON,
  description: `A pre-registered readability measurement of ${n(CO.pages_scored)} blog posts, press releases and announcements from ${n(CO.brands_with_scored_pages)} UK brands in ${n(CO.sectors)} sectors. The median brand's writing scores Flesch-Kincaid grade ${f1(OV.fk.brand_median)}, a reading age of ${f1(OV.reading_age.brand_median)}; ${hardest.name.toLowerCase()} are hardest (${f1(hardest.v.reading_age.brand_median)}) and ${easiest.name.toLowerCase()} easiest (${f1(easiest.v.reading_age.brand_median)}).`,
  abstract: [
    { label: "Background", text: "Plain English is a stated aim for many organisations, and in financial services the FCA's Consumer Duty, in force from 31 July 2023, requires communications that retail customers are likely to understand. Readability formulas cannot say whether a reader understood a text, but they measure two things that make reading harder, long sentences and long words, and they can be applied to thousands of pages identically. We used them on the UK brand deep corpus our earlier studies built." },
    { label: "What we did", text: `We fixed the formulas, the syllable counter, three hypotheses and the pass or fail rule for each in public before the full measurement. We then scored ${n(CO.pages_scored)} pages (${n(CO.prose_words)} words of running prose) from ${n(CO.brands_with_scored_pages)} brands with Flesch Reading Ease, the Flesch-Kincaid grade and a UK reading age (grade plus five), alongside sentence length, syllables per word and the share of long words. The three hypotheses were that press releases are harder than the same brand's blog posts, that writing became harder to read between 2015 to 2018 and 2024 onward, and that banks and insurers became easier to read relative to other sectors once the Consumer Duty applied.` },
    { label: "What we found", text: `The median brand wrote at Flesch-Kincaid grade ${f1(OV.fk.brand_median)} (reading age ${f1(OV.reading_age.brand_median)}, Flesch Reading Ease ${f1(OV.fre.brand_median)}). By sector, ${hardest.name.toLowerCase()} were hardest (reading age ${f1(hardest.v.reading_age.brand_median)}) and ${easiest.name.toLowerCase()} easiest (${f1(easiest.v.reading_age.brand_median)}). ${h1Line} ${h2Line} ${srcLine} ${h3Line}` },
    { label: "What it means", text: "These are measures of sentence and word length. A page scored as hard may still be clear to its readers, and an easy score does not make a page well written. How a brand's score compares with the others is the finding, not whether a particular number is good." },
  ],
  keyNumbers: [
    `The median UK brand's blog and press writing scored Flesch-Kincaid grade ${f1(OV.fk.brand_median)}, a reading age of ${f1(OV.reading_age.brand_median)} (ScriptGrain, 2026; ${n(CO.brands_with_scored_pages)} brands, ${n(CO.pages_scored)} pages, pre-registered).`,
    `Sector medians ran from a reading age of ${f1(easiest.v.reading_age.brand_median)} (${easiest.name.toLowerCase()}) to ${f1(hardest.v.reading_age.brand_median)} (${hardest.name.toLowerCase()}).`,
    `${pct(RF.share_of_sentences_over_25_words_brand_mean)} of sentences were longer than 25 words, the length at which GOV.UK's guidance says to split a sentence; ${pct(RF.share_of_pages_with_average_sentence_over_25)} of pages averaged more than 25 words a sentence.`,
    H.H1.result === "not testable" ? `Press releases and blog posts could not be compared within brand.` : `Within the same brand, press releases scored ${signed(H.H1.point)} Flesch-Kincaid grades against blog posts (${rng(H.H1.lo, H.H1.hi)}).`,
  ],
  measures: [
    { term: "Flesch Reading Ease", definition: "206.835 minus 1.015 times the average sentence length in words, minus 84.6 times the average syllables per word (Flesch, 1948). Higher is easier." },
    { term: "Flesch-Kincaid grade", definition: "0.39 times the average sentence length in words, plus 11.8 times the average syllables per word, minus 15.59 (Kincaid et al., 1975). It estimates the US school grade needed to read the text." },
    { term: "Reading age", definition: "The Flesch-Kincaid grade plus five: US grade 1 is the school year for six-year-olds. It is a convention for translating the grade into a UK-style reading age, not a measured age, and we know no standards body that defines it." },
    { term: "Running prose", definition: "Only lines that end in a full stop, question mark or exclamation mark are scored. Headings, bylines, captions, buttons and unpunctuated list items are left out, so that page furniture does not count as very short sentences." },
    { term: "Syllables", definition: `Counted by a fixed set of spelling rules, with no dictionary at run time. Checked against the CMU Pronouncing Dictionary: ${pct(SV.corpus_tokens.exact_first, 1)} of the corpus's word occurrences matched the dictionary's count exactly and ${pct(SV.corpus_tokens.within_one, 2)} were within one syllable.` },
    { term: "Brand-weighted", definition: "Each brand's pages are averaged first, then brands are summarised, so a brand with many pages does not dominate. Medians and percentiles are across brands." },
    { term: "95% interval", definition: `From ${n(S.bootstrap_resamples)} bootstrap resamples that draw whole brands with replacement within each sector.` },
  ],
  analyst: ANALYSTS["jack-stovell"],
  competingInterests: "ScriptGrain sells writing-voice measurement and the analyst builds it; a finding that brands write at a high reading age could be used to sell a writing product. The hypotheses, the formulas and the pass and fail rules were committed to the public repository before the full measurement, every hypothesis is reported whichever way it came out, and the data and scripts are public.",
  notShown: [
    "That readers understood or failed to understand any page. Readability formulas measure sentence length and word length, not comprehension, and some of these pages are written for specialist readers.",
    "That any text was written by AI. A readability score describes sentence and word length, not authorship.",
    "That a change over time was caused by AI tools or by the FCA's Consumer Duty. The study is observational, and the Duty comparison asks only whether regulated sectors moved differently from the rest.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
  ],
  productNote: "ScriptGrain's free [writing style analysis](/tools/writing-style-analysis) reports average sentence length and the share of words of seven or more letters for any text you paste, measured in your browser. This study's readability formulas are published in the repository and are not part of the product.",
  sample: {
    description: `${n(CO.pages_scored)} blog posts, press releases and product announcements from ${n(CO.brands_with_scored_pages)} UK brands in ${n(CO.sectors)} sectors, taken from the brand deep corpus v1.4: ${n(CO.by_category.blog)} blog, ${n(CO.by_category.press)} press, ${n(CO.by_category.announcement)} announcement pages. ${n(CO.by_source.wayback)} are archived originals captured between 2015 and November 2022 and ${n(CO.by_source.live)} are live pages fetched on 4 and 5 October 2026.`,
    size: CO.pages_scored,
    inclusionCriteria: ["Blog posts, press releases and product announcements on the brand's own sites", "At least 150 words of main text, not link lists or menus, not duplicates of another page of the same brand", "At least 100 words and 5 sentences of running prose, so a formula has enough to measure"],
    exclusions: [`Information packs (PDFs): ${n(S.exclusions.info_pack_not_measured)} pages`, `Pages under 150 words: ${n(S.exclusions.under_150_words)}; duplicates: ${n(S.exclusions.duplicate_text)}; link and menu pages: ${n(S.exclusions.list_like)}`, `Pages with under 100 words or 5 sentences of running prose: ${n(S.exclusions.unscorable)}`, "Pages with no date, or dated before 2015, are kept in the level comparisons and left out of every comparison over time"],
  },
  method: [
    "Pre-registration: the formulas, the syllable counter, the text rules, three hypotheses and the analysis were committed to the public repository before the full measurement (docs/research/sgr-023-preregistration.md). The script was tested on under 5% of the data; the test results are not reported.",
    "Text: each page's main text turned into plain text as in SGR-010 to SGR-018; only lines ending in a full stop, question mark or exclamation mark are scored. Numbers and web addresses are not words; hyphenated words count as separate words.",
    "Syllables: fixed spelling rules, validated against the CMU Pronouncing Dictionary before the run, with the dictionary count used as a labelled sensitivity.",
    "Press against blog: for each brand with at least 10 press releases and 10 blog posts, the average grade of its press releases minus that of its blog posts; supported if the lower end of the 95% interval of the mean over brands is above zero.",
    "Change over time: for each brand and channel with at least 10 pages in 2015 to 2018 and 10 in 2024 onward, the change in average grade; supported (harder) if the lower end of the interval of the mean over brands is above zero, reversed (easier) if the upper end is below zero.",
    "Consumer Duty: the change in average grade for banks and insurers from before July 2022 (the month the FCA published the final rules) to after July 2023 (the Duty in force), minus the same change in all other sectors; supported if the upper end of the interval is below zero.",
  ],
  variablesMeasured: ["Flesch-Kincaid grade, UK reading age and Flesch Reading Ease", "Average sentence length and syllables per word", "Share of words of seven or more letters and of three or more syllables", "Share of sentences longer than 25 words", "Sector, channel, source, year"],
  findings: [
    { label: `H1 (${V(H.H1.result).toLowerCase()}): press releases are harder to read than the same brand's blog posts`, value: H.H1.result === "not testable" ? "Not testable" : `${signed(H.H1.point)} grades (95% interval ${rng(H.H1.lo, H.H1.hi)}), ${n(H.H1.brands_press_harder)} of ${n(H.H1.eligible_brands)} brands harder in press`, explanation: `Press release average minus blog average, Flesch-Kincaid grade, brands with at least 10 pages in each. Of the difference, ${signed(H.H1.from_sentence_length_grades)} grades came from longer sentences and ${signed(H.H1.from_syllables_grades)} from longer words. Supported if the lower end of the interval is above zero.` },
    { label: `H2 (${V(H.H2.result).toLowerCase()}): writing became harder to read between 2015 to 2018 and 2024 onward`, value: H.H2.result === "not testable" ? "Not testable" : `${signed(H.H2.point)} grades (95% interval ${rng(H.H2.lo, H.H2.hi)}), from ${f2(H.H2.from_mean)} to ${f2(H.H2.to_mean)}`, explanation: `Within brand and channel, ${n(H.H2.cells)} pairs with at least 10 pages in each period. The prediction was that writing became harder, so the rule was that the lower end of the interval must be above zero; a fall whose interval is below zero is reported as reversed. ${srcLine}` },
    { label: `H3 (${V(H.H3.result).toLowerCase()}): banks and insurers became easier to read relative to other sectors after the Consumer Duty`, value: H.H3.result === "not testable" ? "Not testable" : `Difference in change ${signed(H.H3.point)} grades (95% interval ${rng(H.H3.lo, H.H3.hi)})`, explanation: H.H3.result === "not testable" ? "Too few brands in one group had at least 10 dated pages both before July 2022 and from August 2023." : `${n(H.H3.fca_brands)} regulated brands changed ${signed(H.H3.fca_change)} grades and ${n(H.H3.other_brands)} other brands ${signed(H.H3.other_change)}. The regulated group ${h3Dir === "did not clearly differ" ? "did not clearly differ from" : `${h3Dir} than`} the rest. Supported if the upper end of the interval is below zero.` },
  ],
  sections: [
    { heading: "Reading age by sector", figure: { src: "/research/sgr-023-sectors.svg", alt: `Chart of reading age by sector: dot at the median brand, bar from the 25th to 75th percentile, line from the 10th to 90th. ${hardest.name} median ${f1(hardest.v.reading_age.brand_median)}, ${easiest.name} median ${f1(easiest.v.reading_age.brand_median)}.`, caption: "Source: ScriptGrain SGR-023, CC BY 4.0.", width: 760, height: 450 } },
    { heading: "Reading age by year", figure: { src: "/research/sgr-023-by-year.svg", alt: `Line chart of reading age for blog posts and press releases by year from 2015 to 2026, with ChatGPT's launch and the Consumer Duty coming into force marked. All writing ${first ? f1(first.reading_age) : "n/a"} in ${first?.year} and ${last ? f1(last.reading_age) : "n/a"} in ${last?.year}.`, caption: "Source: ScriptGrain SGR-023, CC BY 4.0.", width: 760, height: 380 } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Estimate (grades)", "95% interval", "Brands or pairs"], rows: [
      ["H1 press releases harder than blog posts", V(H.H1.result), signed(H.H1.point), rng(H.H1.lo, H.H1.hi), n(H.H1.eligible_brands)],
      ["H2 harder in 2024 onward than 2015 to 2018", V(H.H2.result), signed(H.H2.point), rng(H.H2.lo, H.H2.hi), n(H.H2.cells)],
      ["H3 banks and insurers easier relative to other sectors after the Consumer Duty", V(H.H3.result), signed(H.H3.point), rng(H.H3.lo, H.H3.hi), H.H3.fca_brands == null ? "n/a" : `${n(H.H3.fca_brands)} and ${n(H.H3.other_brands)}`],
    ] } },
    { heading: "Sectors", paragraphs: ["Brand-weighted medians and the spread between brands. Reading age is the Flesch-Kincaid grade plus five; Flesch Reading Ease is higher for easier text.", mixLine], table: { columns: ["Sector", "Brands", "Pages", "Reading age (median)", "10th to 90th percentile", "Flesch Reading Ease", "Words per sentence", "Syllables per word", "Sentences over 25 words"], rows: [...secRows.map(({ name, v }) => [name, n(v.brands), n(v.pages), f1(v.reading_age.brand_median), rng(v.reading_age.brand_p[0], v.reading_age.brand_p[4], 1), f1(v.fre.brand_median), f1(v.asl.brand_median), f2(v.asw.brand_median), pct(v.sent_gt25_share.brand_mean)]), ["All brands", n(OV.brands), n(OV.pages), f1(OV.reading_age.brand_median), rng(OV.reading_age.brand_p[0], OV.reading_age.brand_p[4], 1), f1(OV.fre.brand_median), f1(OV.asl.brand_median), f2(OV.asw.brand_median), pct(OV.sent_gt25_share.brand_mean)]] } },
    { heading: "Blog posts, press releases and announcements", table: { columns: ["Channel", "Brands", "Pages", "Reading age (median)", "10th to 90th percentile", "Flesch Reading Ease", "Words per sentence", "Syllables per word"], rows: Object.entries(LV.by_category).map(([c, v]) => [({ blog: "Blog posts", press: "Press releases", announcement: "Product announcements" })[c], n(v.brands), n(v.pages), f1(v.reading_age.brand_median), rng(v.reading_age.brand_p[0], v.reading_age.brand_p[4], 1), f1(v.fre.brand_median), f1(v.asl.brand_median), f2(v.asw.brand_median)]) } },
    { heading: "Sentences or words: what makes a sector harder", paragraphs: ["The Flesch-Kincaid grade is the sum of a sentence-length term (0.39 times words per sentence) and a word-length term (11.8 times syllables per word). This table splits each sector's grade difference from the all-brand mean into the two."], table: { columns: ["Sector", "Grade minus all-brand mean", "From sentence length", "From syllables per word"], rows: Object.entries(S.decomposition).map(([k, d]) => [SECTOR[k] ?? k, signed(d.fk_minus_overall), signed(d.from_sentence_length), signed(d.from_syllables_per_word)]) } },
    { heading: "Against GOV.UK's sentence-length guidance", paragraphs: [`GOV.UK's writing guidance says: "Try to split up sentences that are over 25 words long." Across brands, ${pct(RF.share_of_sentences_over_25_words_brand_mean, 1)} of sentences were over 25 words. ${pct(RF.share_of_brands_with_average_sentence_over_25, 1)} of brands averaged more than 25 words a sentence, and ${pct(RF.share_of_pages_with_over_a_quarter_of_sentences_over_25, 1)} of pages had more than a quarter of their sentences above that length. We did not find the current GOV.UK guidance stating a reading age, so we do not compare reading ages with a government target.`] },
    { heading: "Each year", paragraphs: ["Brand-weighted mean over brands with dated pages that year (dates from page metadata, structured data, the URL or the archive capture)."], table: { columns: ["Channel", "Year", "Pages", "Brands", "Reading age", "Flesch Reading Ease", "Words per sentence", "Syllables per word"], rows: S.by_year.map((r) => [({ all: "All", blog: "Blog", press: "Press and announcements" })[r.category], String(r.year), n(r.pages), n(r.brands), f1(r.reading_age), f1(r.fre), f1(r.asl), f2(r.asw)]) } },
    { heading: "Checks on the three hypotheses", paragraphs: ["Each row repeats one hypothesis with one choice changed. Flesch Reading Ease rows have the opposite sign (a negative estimate means harder to read), and their result is stated in the direction of the hypothesis."], table: { columns: ["Check", "Result", "Estimate", "95% interval", "Brands or pairs"], rows: sensRows } },
    { heading: "Checking the syllable counter", paragraphs: [`The counter was written from spelling rules and tuned on one half of the CMU Pronouncing Dictionary, then scored on the other half: ${pct(SV.test.exact_first, 1)} of words matched the dictionary's primary count exactly on the held-out half (${pct(SV.test.within_one, 1)} within one syllable). On the words the brands actually used, ${pct(SV.corpus_tokens.exact_first, 1)} of occurrences matched and the average error was ${Math.abs(SV.corpus_tokens.mean_bias_per_word) < 0.0005 ? "under 0.001" : signed(SV.corpus_tokens.mean_bias_per_word, 3)} syllables a word. Page scores computed with the dictionary's counts where available correlated ${n(SV.corpus_tokens.fk_rule_vs_cmu_pearson, 3)} with the main scores and differed by ${signed(SV.corpus_tokens.fk_mean_difference_rule_minus_cmu, 2)} grades on average. The dictionary is American-English pronunciation and covers ${pct(SV.corpus_tokens.covered_share, 1)} of the corpus's word occurrences.`] },
  ],
  limitations: [
    "Readability formulas measure sentence length and word length. They do not measure comprehension, layout, vocabulary a reader already knows, or whether the content suits its audience. A technical page for specialists can score as hard and still serve its readers.",
    "Reading age is the Flesch-Kincaid grade plus five, a convention for translating a US school grade, not a measured age of any reader.",
    "Syllables are counted by rules and are about nine in ten right per dictionary word, higher on common words. Names, acronyms and brand terms are approximate; the dictionary sensitivity shows how much that moves the results.",
    "Only running prose is scored. Pages whose content is mostly headings, lists and short labels are scored on what is left, and their scores describe that remainder.",
    "Pages were sampled by fixed rules from each brand's own sites, not at random from everything a brand published, and many pages carry no recoverable date. Archived pages (to November 2022) and live pages (after) came by different routes; the source check in the repository compares them.",
    "The Consumer Duty comparison cannot separate the Duty from anything else that affected banks and insurers differently over the same years. Some brands in other sectors, such as supermarkets, run FCA-regulated arms; one check removes them. The Duty's own wording concerns communications to retail customers, which may not be the blog and press pages measured here.",
    "UK consumer brands only, in the 10 sectors the earlier studies chose.",
  ],
  reproducibility: ["Pre-registration, run script and entry builder: docs/research/sgr-023-preregistration.md and scripts/experiments/sgr-023/ in the ScriptGrain repository.", "Every page's URL, date and readability measures are in the data files, so any figure can be recomputed from the public pages."],
  dataDownloads: [
    { label: "Summary: hypotheses, intervals, levels, checks (JSON)", path: "/research/sgr-023-summary.json", format: "json" },
    { label: "Every page: URL, date, words, sentences and readability measures (CSV)", path: "/research/sgr-023-pages.csv", format: "csv" },
    { label: "Every brand: averages overall and by channel (CSV)", path: "/research/sgr-023-brands.csv", format: "csv" },
    { label: "Sector and channel summary (CSV)", path: "/research/sgr-023-sectors.csv", format: "csv" },
    { label: "Readability by year (CSV)", path: "/research/sgr-023-by-year.csv", format: "csv" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-023, conducted ${long(CONDUCTED)}). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${SLUG}`,
  citations: [
    { name: "ScriptGrain (2026). How do UK brands write? 16,070 blog posts and press releases, measured (SGR-010)", url: "https://scriptgrain.com/research/how-uk-brands-write" },
    { name: "Flesch, R. (1948). A new readability yardstick. Journal of Applied Psychology 32(3), 221 to 233", url: "https://doi.org/10.1037/h0057532" },
    { name: "Kincaid, J. P., et al. (1975). Derivation of New Readability Formulas (Automated Readability Index, Fog Count and Flesch Reading Ease Formula) for Navy Enlisted Personnel. Naval Technical Training Command Research Branch, February 1975 (DTIC ADA006655)", url: "https://doi.org/10.21236/ada006655" },
    { name: "GOV.UK (n.d.). Use clear language, in Writing to GOV.UK standards", url: "https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/" },
    { name: "Financial Conduct Authority (2022). PS22/9: A new Consumer Duty", url: "https://www.fca.org.uk/publications/policy-statements/ps22-9-new-consumer-duty" },
    { name: "Carnegie Mellon University. The CMU Pronouncing Dictionary", url: "https://github.com/cmusphinx/cmudict" },
  ],
};

const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
const i = data.studies.findIndex((x) => x.id === study.id); if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-023 written; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
