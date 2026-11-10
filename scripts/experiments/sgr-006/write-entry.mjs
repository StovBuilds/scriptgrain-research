#!/usr/bin/env bun
// SGR-006: write the study entry in src/data/research-pages.json from the
// published summaries, so every number on the page is the run's number.
//
//   bun scripts/experiments/sgr-006/write-entry.mjs --publish-on YYYY-MM-DD [--summary ...] [--check ...]
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PUBLISH_ON = opt("--publish-on");
if (!PUBLISH_ON) throw new Error("--publish-on required");
const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-006-summary.json"), "utf8"));
const C = JSON.parse(readFileSync(opt("--check", "public/research/sgr-006-prose-check.json"), "utf8"));
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const { _readme: _a, ...ANALYSTS } = JSON.parse(readFileSync(new URL("../shared/analysts.json", import.meta.url), "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f1 = (x) => n(x, 1), f2 = (x) => n(x, 2);
const sgn = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${f1(Math.abs(x))}`;
const SLUG = "what-does-normal-writing-look-like";
const books = S.cells.filter((c) => /^\d{4}s$|early/.test(c.era)), web = S.cells.filter((c) => c.era === "2021 web"), ax = S.cells.find((c) => c.group === "arxiv");
const nBooks = books.reduce((s, c) => s + c.texts, 0) / 3;
const nNF = books.filter((c) => CFG.books.nonfiction_for_H2_H3.includes(c.group)).reduce((s, c) => s + c.texts, 0) / 3;
const TITLE = `What does normal writing look like? Three centuries of human prose, measured`;
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const T = S.trend, H1 = S.H1, H2 = S.H2, H3 = S.H3;
const cell = (g, e) => S.cells.find((c) => c.group === g && c.era === e);
const meanOf = (groups, era, k) => { const c = S.cells.filter((x) => groups.includes(x.group) && x.era === era); const t = c.reduce((s, x) => s + x.texts, 0); return c.reduce((s, x) => s + x[k].mean * x.texts, 0) / t; };
const fic = ["1700s", "1800s", "early 1900s"].map((e) => meanOf(["fiction"], e, "sentence_length"));
const h1fail = H1.tests.filter((t) => !(t.hi < 0)).map((t) => t.vs.replace("_religion", " and religion"));
const NAME = { sentence_length: "Words per sentence", contractions_per1000: "Contractions per 1,000", semicolons_per1000: "Semicolons per 1,000", em_dash_per1000: "Dashes per 1,000", long_word_share: "Long-word share", pronoun_you: "'You' share of pronouns" };

const study = {
  id: "SGR-006",
  slug: SLUG,
  title: TITLE,
  seoTitle: `What does normal writing look like? ${n(S.texts)} texts, 1700s to 2021, measured · ScriptGrain Research`,
  question: "For each habit of prose that can be counted, what is the normal range in human writing, by genre, and how has it moved from the 1700s to the web of 2021, before ChatGPT?",
  conductedOn: "2026-10-04",
  publishOn: PUBLISH_ON,
  description: `A baseline for human writing: ${n(S.texts)} texts and ${n(S.words / 1e6, 1)} million words, from ${n(nBooks)} public-domain books in ten genres across three centuries to ${n(web.reduce((s, c) => s + c.texts, 0))} pages of the 2021 web and ${n(ax.texts)} scientific abstracts, measured with the product's own instruments. Percentile tables for sixteen habits, three pre-registered hypotheses, and a free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: "Claims about writing (sentences are getting shorter, nobody uses semicolons any more, informal writing is new) are common and rarely measured across genres and centuries with one instrument. And any measure of a single piece of writing needs a reference point: long sentences compared with what?" },
    { label: "What we did", text: `We fixed three hypotheses, the genres and the sampling before measuring anything. We drew 30 public-domain books for each genre and era from Project Gutenberg (ten genres; the 1700s, the 1800s and the early 1900s, dated by when the author turned 40), three passages from each, and added ${n(web.reduce((s, c) => s + c.texts, 0))} pages from Common Crawl's 2021 web and ${n(ax.texts)} arXiv abstracts from before ChatGPT. Every text was measured with the same deterministic code ScriptGrain uses, for sixteen habits.` },
    { label: "What we found", text: `Non-fiction sentences shortened steadily: ${f1(T.sentence_length["1700s"])} words on average in the 1700s, ${f1(T.sentence_length["1800s"])} in the 1800s, ${f1(T.sentence_length["early 1900s"])} in the early 1900s and ${f1(T.sentence_length["2021 web"])} on the 2021 web. Semicolons fell from ${f1(T.semicolons_per1000["1700s"])} to ${f1(T.semicolons_per1000["2021 web"])} per 1,000 words. Contractions, though, did not drift up in books at all (${f1(T.contractions_per1000["1700s"])} to ${f1(T.contractions_per1000["early 1900s"])} per 1,000 words); they more than tripled only on the web. And fiction was not always the short-sentence genre: in the 1700s, novels ran longer than history.` },
    { label: "What it means", text: "Some of the best-known changes in English prose are real and old (shorter sentences, fewer semicolons); others arrived suddenly with the web (contractions, 'you'). The percentile tables give every measure a reference range by genre and era, so a figure from any text can be read against what was normal for its kind." },
  ],
  keyNumbers: [
    `Average sentence length in English non-fiction fell from ${f1(T.sentence_length["1700s"])} words in the 1700s to ${f1(T.sentence_length["1800s"])} in the 1800s and ${f1(T.sentence_length["early 1900s"])} in the early 1900s (ScriptGrain, 2026; ${n(nNF)} non-fiction books).`,
    `On the web in 2021, news, Wikipedia and how-to pages averaged ${f1(T.sentence_length["2021 web"])} words per sentence; counting only full prose lines, news and how-to pages averaged ${f1(C.web.pooled.prose_only)}, still well below the ${f1(C.books["early 1900s"].prose_only)} of early-1900s non-fiction books.`,
    `Semicolons in English non-fiction fell from ${f1(T.semicolons_per1000["1700s"])} per 1,000 words in the 1700s to ${f1(T.semicolons_per1000["early 1900s"])} in the early 1900s and ${f1(T.semicolons_per1000["2021 web"])} on the 2021 web.`,
    `Contractions such as "don't" barely changed in English non-fiction books over two centuries (${f1(T.contractions_per1000["1700s"])} per 1,000 words in the 1700s, ${f1(T.contractions_per1000["early 1900s"])} in the early 1900s), then more than tripled on the 2021 web (${f1(T.contractions_per1000["2021 web"])}).`,
    `In the 1700s, novels had longer sentences than history books (${f1(fic[0])} words against ${f1(meanOf(["history"], "1700s", "sentence_length"))}); by the early 1900s fiction was the shorter by ${f1(meanOf(["history"], "early 1900s", "sentence_length") - fic[2])} words.`,
    `Dashes in English non-fiction peaked in the early 1900s at ${f1(T.em_dash_per1000["early 1900s"])} per 1,000 words, against ${f1(T.em_dash_per1000["2021 web"])} on the 2021 web.`,
    `The share of 'you' among I, we and you rose from ${n(T.pronoun_you["1700s"] * 100)}% in 1700s non-fiction to ${n(T.pronoun_you["2021 web"] * 100)}% on the 2021 web.`,
  ],
  measures: [
    { term: "Era of a book", definition: "The catalogue gives authors' birth years, not books' dates, so a book is placed in the century in which its author turned 40. 'Early 1900s' ends around 1930, where public-domain texts stop." },
    { term: "Non-fiction (for the hypotheses)", definition: "Books: history, science, philosophy and religion, travel and biography, pooled. 2021 web: news (UK and US), Wikipedia and how-to pages, pooled." },
    { term: "Words per sentence", definition: "The product's sentence measure on all of a text. On web pages it also counts headings, captions, list items and reference entries as short sentences, which books do not have; see Checks." },
    { term: "Dashes", definition: "Em dashes, and the double hyphens plain-text editions use for them, per 1,000 words. En dashes are not counted, and British news often uses spaced en dashes, so web figures for dashes run low." },
    { term: "Percentiles", definition: "For each genre and era, the 10th, 25th, 50th (median), 75th and 90th percentile of each habit across its texts. The median is the typical text; the middle half lies between the 25th and 75th." },
    { term: "95% interval", definition: "From 10,000 bootstrap resamples of texts. A hypothesis holds only if every one of its comparisons excludes zero in the predicted direction." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, genres and sampling were fixed and published before anything was measured, nothing was re-run or selected (except one disclosed re-run after a file fault, below), and the scripts are public, so the numbers can be checked without taking our word for them.",
  notShown: [
    "What any individual writer of an era wrote like. The baseline describes genres and eras; single books vary widely, as the percentile ranges show.",
    "Why prose changed. Printing, schooling, readership and the web all plausibly played a part; the study measures the change, not its causes.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Anything after 2022. The modern samples stop before ChatGPT on purpose, so the baseline is human writing.",
  ],
  productNote: "ScriptGrain's free tools place a piece of writing against reference ranges for habits like these. This study's tables are a published baseline anyone can use; they are not built into the product by this study.",
  sample: {
    description: `Books: Project Gutenberg English texts in ten genres (fiction, essays, history, science, philosophy and religion, travel, biography, letters, children's books, drama; poetry excluded), 30 per genre and era where at least 30 exist, in a seeded random order, with three passages of about 1,000 words at 20%, 50% and 80% of each book. Three cells (1700s essays, children's books and drama) had too few books and were dropped, not filled. Web: 100 pages from each of 22 sources in nine kinds of writing, from Common Crawl's October 2021 crawl, in SGR-007's frozen order. Abstracts: ${n(ax.texts)} arXiv abstracts from 2015 to November 2022 with no later revision, from SGR-008's census.`,
    size: S.texts,
    inclusionCriteria: ["English; poetry excluded", "Books of at least 5,000 words; web pages of at least 200 words of article text", "Written or crawled before ChatGPT's launch (30 November 2022)"],
    exclusions: ["Cells with fewer than 30 books (1700s essays, children's books and drama)"],
  },
  method: [
    "Pre-registration: hypotheses, genres, eras and sampling were committed to [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research) before any text was measured (docs/research/sgr-006-preregistration.md).",
    "Measurement: every text scored with the same deterministic code ScriptGrain uses, for sixteen habits, on all text. No language model reads or scores any text.",
    "Re-run: the first books harvest was found to contain rows written by two runs at once, with some books mislabelled. It was discarded before analysis and the books were harvested again by a single run; the harvester now refuses to write into an existing file.",
    "Check added after the main run (not pre-registered): web pages and the non-fiction book passages re-measured on full prose lines only (8 words or more, ending in sentence punctuation), to see whether the web's shorter sentences come from headings and lists.",
  ],
  variablesMeasured: ["Words per sentence, sentence length variation, share of short sentences", "Commas per sentence; semicolons, exclamation marks, question marks and dashes per 1,000 words", "Contractions per 1,000 words; parentheticals", "Short-word and long-word shares", "I, we and you shares of pronouns", "AI-tell density"],
  findings: [
    {
      label: "H2 (supported): non-fiction sentences got shorter, century after century",
      value: `${f1(T.sentence_length["1700s"])} → ${f1(T.sentence_length["1800s"])} → ${f1(T.sentence_length["early 1900s"])} → ${f1(T.sentence_length["2021 web"])} words per sentence`,
      explanation: `Early-1900s non-fiction books averaged ${f1(Math.abs(H2.tests[0].diff))} fewer words per sentence than 1700s books (95% interval ${f1(Math.abs(H2.tests[0].hi))} to ${f1(Math.abs(H2.tests[0].lo))} fewer), and 2021 web non-fiction ${f1(Math.abs(H2.tests[1].diff))} fewer again. Part of the web figure comes from headings and lists counted as sentences; on full prose lines only, news and how-to pages averaged ${f1(C.web.pooled.prose_only)} words against ${f1(C.books["early 1900s"].prose_only)} for early-1900s books, a smaller gap in the same direction.`,
    },
    {
      label: "H3 (not supported): contractions did not creep up in books; they jumped on the web",
      value: `${f1(T.contractions_per1000["1700s"])} → ${f1(T.contractions_per1000["early 1900s"])} in books, ${f1(T.contractions_per1000["2021 web"])} on the 2021 web, per 1,000 words`,
      explanation: `We predicted a rise from the 1700s to the early 1900s. Non-fiction books were flat (difference ${sgn(H3.tests[0].diff)}, interval ${sgn(H3.tests[0].lo)} to ${sgn(H3.tests[0].hi)}). The jump came after: 2021 web non-fiction used ${f1(H3.tests[1].diff)} more per 1,000 words than early-1900s books, and still ${f1(C.web.pooled.contractions_prose_only)} per 1,000 on full prose lines only.`,
    },
    {
      label: "H1 (not supported): fiction was not always the short-sentence genre",
      value: `1700s fiction ${f1(fic[0])} words per sentence; 1800s ${f1(fic[1])}; early 1900s ${f1(fic[2])}`,
      explanation: `In the 1800s and early 1900s, fiction's sentences were shorter than history, science and philosophy, as predicted. In the 1700s they were not: novels ran ${f1(H1.tests.find((t) => t.era === "1700s" && t.vs === "history").diff)} words longer than history, and the comparisons with ${h1fail.filter((x) => x !== "history").join(" and ")} were inconclusive. Fiction's sentences shortened faster than any non-fiction genre's, by about ${n(fic[0] - fic[2])} words between the 1700s and the early 1900s.`,
    },
    {
      label: "Exploratory: semicolons faded and dashes rose, then fell",
      value: `semicolons ${f1(T.semicolons_per1000["1700s"])} → ${f1(T.semicolons_per1000["2021 web"])}; dashes peaked at ${f1(T.em_dash_per1000["early 1900s"])} in the early 1900s`,
      explanation: `In non-fiction, semicolons fell in every era, from ${f1(T.semicolons_per1000["1700s"])} per 1,000 words in the 1700s to ${f1(T.semicolons_per1000["early 1900s"])} in the early 1900s and ${f1(T.semicolons_per1000["2021 web"])} on the 2021 web. Dashes rose from ${f1(T.em_dash_per1000["1700s"])} to ${f1(T.em_dash_per1000["early 1900s"])} and were rare on the 2021 web (${f1(T.em_dash_per1000["2021 web"])}): books of a century ago used them about five times as often as web pages did just before ChatGPT. Not pre-registered; read as description.`,
    },
  ],
  sections: [
    { heading: "Sentences through three centuries", figure: { src: "/research/sgr-006-sentences.svg", alt: `Line chart: non-fiction sentence length falls from ${f1(T.sentence_length["1700s"])} words in the 1700s to ${f1(T.sentence_length["2021 web"])} on the 2021 web; fiction falls faster, from ${f1(fic[0])} to ${f1(fic[2])}.`, caption: "Source: ScriptGrain SGR-006, CC BY 4.0. The 2021 web figure includes headings and lists counted as sentences; see Checks.", width: 760, height: 380 } },
    { heading: "Punctuation through three centuries", figure: { src: "/research/sgr-006-punctuation.svg", alt: "Three small line charts: semicolons fall steadily, dashes rise to the early 1900s then fall on the web, contractions stay flat in books then rise sharply on the web.", caption: "Source: ScriptGrain SGR-006, CC BY 4.0.", width: 760, height: 300 } },
    { heading: "The baseline: normal sentence length by genre and era", figure: { src: "/research/sgr-006-baseline.svg", alt: "Range chart of sentence length for every genre and era: 1700s books highest, drama and children's books lowest among books, 2021 web pages lower still, arXiv abstracts near early-1900s books.", caption: "Source: ScriptGrain SGR-006, CC BY 4.0. Full percentiles for all sixteen habits are in the data.", width: 760, height: 66 + S.cells.length * 18 + 30 } },
    {
      heading: "Pre-registered hypotheses and results",
      table: { columns: ["Hypothesis", "Result", "Test"], rows: [
        ["H1: in every era, fiction's sentences are shorter than history, science and philosophy and religion", H1.holds ? "Supported" : "Not supported", H1.tests.map((t) => `${t.era} vs ${t.vs.replace("_religion", " and religion")}: ${sgn(t.diff)} (${sgn(t.lo)} to ${sgn(t.hi)})`).join("; ")],
        ["H2: non-fiction sentences shorter in the early 1900s than the 1700s, and shorter again on the 2021 web", H2.holds ? "Supported" : "Not supported", H2.tests.map((t) => `${t.step}: ${sgn(t.diff)} (${sgn(t.lo)} to ${sgn(t.hi)})`).join("; ")],
        ["H3: contractions higher in the early 1900s than the 1700s, and higher again on the 2021 web", H3.holds ? "Supported" : "Not supported", H3.tests.map((t) => `${t.step}: ${sgn(t.diff)} (${sgn(t.lo)} to ${sgn(t.hi)})`).join("; ")],
      ] },
    },
    {
      heading: "The baseline: typical values by genre and era",
      paragraphs: ["Medians (the typical text) for six habits. The 10th, 25th, 75th and 90th percentiles for all sixteen habits are in the summary file."],
      table: { columns: ["Genre", "Era", "Texts", ...Object.values(NAME)], rows: S.cells.map((c) => [c.label, c.era, n(c.texts), f1(c.sentence_length.p50), f1(c.contractions_per1000.p50), f1(c.semicolons_per1000.p50), f1(c.em_dash_per1000.p50), f2(c.long_word_share.p50), f2(c.pronoun_you.p50)]) },
    },
    {
      heading: "Checks",
      paragraphs: [
        `Full prose lines only (added after the main run): web pages and book passages re-measured on lines of eight or more words ending in sentence punctuation. News: ${f1(C.web.news.all_text)} words per sentence on all text, ${f1(C.web.news.prose_only)} on prose lines (${n(C.web.news.pages)} pages). How-to pages: ${f1(C.web.how_to_content.all_text)} and ${f1(C.web.how_to_content.prose_only)} (${n(C.web.how_to_content.pages)}). Early-1900s non-fiction books: ${f1(C.books["early 1900s"].all_text)} and ${f1(C.books["early 1900s"].prose_only)}. Wikipedia pages could not be matched back to the crawl index for this check, so its web figures should be read as including headings and lists.`,
        "The first books harvest was discarded after two runs were found to have written into the same file, mislabelling some books' genre and era. The re-run is the data published here; the harvester now refuses to append to an existing file.",
      ],
    },
  ],
  limitations: [
    "Books are dated by when their author turned 40, not by publication; a book written young or old can sit in a neighbouring era.",
    "Project Gutenberg texts come from particular editions, and punctuation can be an editor's or printer's; semicolons and dashes are the most exposed.",
    "The web's sentence measure counts headings, captions, list items and references as short sentences, which pulls its figures down, most for Wikipedia (see Checks).",
    "Genres are assigned from catalogue subjects, so a book can sit in more than one (travel letters, for example) and some labels are broad.",
    "English only, and mostly British and American writing.",
  ],
  reproducibility: [
    "Pre-registration, sources, harvester, analysis and checks: docs/research/sgr-006-preregistration.md and scripts/experiments/sgr-006/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research).",
    "Every text is identified in the data (Project Gutenberg number and passage, web page URL and capture time, arXiv id), so any can be re-read and measured.",
  ],
  dataDownloads: [
    { label: "Every text measured, sixteen habits (CSV)", path: "/research/sgr-006-texts.csv", format: "csv" },
    { label: "Baseline: percentiles by genre and era, hypotheses, trends (JSON)", path: "/research/sgr-006-summary.json", format: "json" },
    { label: "Prose-line check (JSON)", path: "/research/sgr-006-prose-check.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-006, conducted 4 October 2026). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "Project Gutenberg", url: "https://www.gutenberg.org/" },
    { name: "Common Crawl, CC-MAIN-2021-43", url: "https://commoncrawl.org/" },
    { name: "arXiv", url: "https://arxiv.org/" },
  ],
};

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.splice(data.studies.findIndex((s) => s.id > "SGR-006"), 0, study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-006 ${i === -1 ? "added" : "updated"}; publishOn ${PUBLISH_ON}`);
