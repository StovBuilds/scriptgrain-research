#!/usr/bin/env bun
// SGR-019: write the study entry in src/data/research-pages.json from public/research/sgr-019-summary.json.
// Every number in the copy comes from the summary; none is typed here.
//   bun scripts/experiments/sgr-019/write-entry.mjs --conducted-on 2026-10-13 --publish-on 2026-10-14
// Refuses a pilot summary unless --allow-pilot (used only to test the entry against the CI guards).
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const CONDUCTED = opt("--conducted-on"), PUBLISH_ON = opt("--publish-on");
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const dayBefore = (iso) => new Date(Date.parse(iso + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
if (dayBefore(PUBLISH_ON) !== CONDUCTED) throw new Error(`conductedOn must be the day before publishOn (${dayBefore(PUBLISH_ON)})`);
const here = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync("public/research/sgr-019-summary.json", "utf8"));
if (S.pilot && !args.includes("--allow-pilot")) throw new Error("summary is from a pilot run; refusing");
if (!S.pilot && S.generated.slice(0, 10) !== CONDUCTED) throw new Error(`summary was generated ${S.generated.slice(0, 10)}, not on ${CONDUCTED}: re-run run.mjs`);
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));

const n = (x, d = 0) => (x == null || !Number.isFinite(x) ? "n/a" : Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
const f2 = (x) => n(x, 2), f1 = (x) => n(x, 1);
const signed = (x, d = 2) => (x == null ? "n/a" : `${x < 0 ? "−" : "+"}${n(Math.abs(x), d)}`);
const rng = (lo, hi, d = 2) => (lo == null ? "interval n/a" : `${n(lo, d)} to ${n(hi, d)}`);
const long = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const verdict = (v) => ({ supported: "Supported", "not supported": "Not supported", reversed: "Reversed" })[v] ?? "Not testable";

const H = S.hypotheses, L = S.exploratory.levels, C = S.exploratory.change, CO = S.corpora, SER = S.series_by_year;
const yr = (corpus, y) => SER.find((r) => r.corpus === corpus && r.year === y);
const band = (b) => S.gutenberg_bands.find((x) => x.band === b);
const SLUG = "has-the-em-dash-taken-over";
const TITLE = "Has the em dash really taken over? Em dashes per 1,000 words in books, research papers and brand writing, 1800 to 2026";

const dir = (h) => (h.result === "supported" ? "above" : h.result === "reversed" ? "below" : "not clearly different from");
const fiction = L.gutenberg_1800s_fiction_literary, nonfic = L.gutenberg_1800s_nonfiction, sci = L.gutenberg_1800s_science;
const todayVsBooks = H.H4a.result === "supported" ? "lower than" : H.H4a.result === "reversed" ? "higher than" : "not clearly different from";
const sentence = {
  brand: `UK brands' blogs and press releases: ${f2(L.brand_late.per1000)} em dashes per 1,000 words in 2019 to November 2022 and ${f2(L.brand_after.per1000)} from 2024 on (${f2(C.brand_after_vs_late.ratio)} times, 95% interval ${rng(C.brand_after_vs_late.lo, C.brand_after_vs_late.hi)}).`,
  arxiv: `arXiv abstracts: ${f2(L.arxiv_late.per1000)} in 2019 to November 2022 and ${f2(L.arxiv_after.per1000)} from 2024 on (${f2(C.arxiv_after_vs_late.ratio)} times, 95% interval ${rng(C.arxiv_after_vs_late.lo, C.arxiv_after_vs_late.hi)}).`,
};

const study = {
  id: "SGR-019", slug: SLUG, title: TITLE,
  seoTitle: "Has the em dash really taken over? 1800 to 2026, measured · ScriptGrain Research",
  question: "How often did published writing use the em dash from 1800 to 2026, did its use in brand writing, research abstracts and company homepages rise after ChatGPT beyond its earlier trend, and is today's rate high or low against 19th-century books?",
  conductedOn: CONDUCTED, publishOn: PUBLISH_ON,
  description: `A pre-registered count of em dashes per 1,000 words across ${n(CO.arxiv.docs)} arXiv abstracts, ${n(CO.brand.docs)} brand pages, ${n(CO.homepages.docs)} company homepages and ${n(CO.gutenberg.books)} Project Gutenberg books. Brand writing: ${f2(L.brand_late.per1000)} before ChatGPT, ${f2(L.brand_after.per1000)} since 2024. Nineteenth-century non-fiction books: ${f2(nonfic.per1000)}.`,
  abstract: [
    { label: "Background", text: "Since ChatGPT launched in November 2022, the em dash has been called the sign of a machine-written text. Our earlier studies measured it in pieces: SGR-004 on company homepages and SGR-011 on UK brands' blogs and press releases. This study puts every body of writing ScriptGrain holds on one axis, from 19th-century books to the 2026 web, and asks two plain questions: has the em dash risen beyond where its own trend was heading, and is it high or low against the books of the 1800s?" },
    { label: "What we did", text: `We fixed six hypotheses, the dash definition for each kind of text and the pass or fail rule for each in public before the full count. Then we counted em dashes per 1,000 words (U+2014, spaced en dashes, and the plain-text conventions "--" in books and "---" in arXiv abstracts) in ${n(CO.arxiv.docs)} arXiv abstracts from 2015 to 2026, ${n(CO.brand.docs)} dated blog posts and press releases from ${n(CO.brand.brands)} UK brands, ${n(CO.homepages.docs)} company homepages from 2000 to 2026 (SGR-004's published counts), and ${n(CO.gutenberg.books)} whole books from Project Gutenberg. For each of the three modern bodies of writing we fitted the 2015 to November 2022 trend, carried it forward, and tested whether 2024 onward sits above it.` },
    { label: "What we found", text: `${sentence.brand} ${sentence.arxiv} Against the trend projected from before ChatGPT, brand writing sat ${dir(H.H1)} it, arXiv abstracts ${dir(H.H2)} it and homepages ${dir(H.H3)} it. Nineteenth-century non-fiction books used ${f2(nonfic.per1000)} per 1,000 words and fiction ${f2(fiction.per1000)}, so brand writing today is ${todayVsBooks} the non-fiction books of the 1800s.` },
    { label: "What it means", text: "The em dash is a long-standing feature of English prose, and what has changed since 2022 is a matter of degree, different in each kind of writing. A count of dashes shows how writing looks; it does not show who or what wrote it." },
  ],
  keyNumbers: [
    `UK brands' blog posts and press releases used ${f2(L.brand_late.per1000)} em dashes per 1,000 words in 2019 to November 2022 and ${f2(L.brand_after.per1000)} from 2024 on (ScriptGrain, 2026; ${n(CO.brand.brands)} brands, pre-registered).`,
    `arXiv abstracts went from ${f2(L.arxiv_late.per1000)} per 1,000 words in 2019 to November 2022 to ${f2(L.arxiv_after.per1000)} from 2024 on (${n(CO.arxiv.docs)} abstracts).`,
    `Nineteenth-century non-fiction books used ${f2(nonfic.per1000)} dash marks per 1,000 words and fiction and literary works ${f2(fiction.per1000)}; today's brand writing used ${f2(L.brand_after.per1000)}.`,
    `${n(H.H6.higher)} of ${n(H.H6.brands)} brands with enough pages wrote more em dashes per 1,000 words from 2024 on than in 2019 to November 2022.`,
  ],
  measures: [
    { term: "Em dash mark", definition: "SGR-010's definition: the em dash character (U+2014) or an en dash with a space either side. For books, a run of exactly two or three hyphens also counts, because plain-text Project Gutenberg files spell the em dash that way. For arXiv abstracts, three hyphens or a spaced pair of hyphens counts, because arXiv stores abstracts as ASCII; an unspaced pair is LaTeX's en dash for ranges and does not." },
    { term: "Strict rate", definition: "The same count with only U+2014 and spaced en dashes, as SGR-010 counted. Reported beside the main figure so the effect of the plain-text conventions is visible." },
    { term: "Per 1,000 words", definition: "Dash marks divided by words, times 1,000, pooled over all texts in the group (long texts weigh more). A word is a run of characters containing a letter or digit; dash marks are not words." },
    { term: "Pre-ChatGPT trend", definition: "A line fitted to the pooled rate by quarter from January 2015 to November 2022 (by year, 2015 to 2022, for homepages), carried forward and averaged over 2024 onward, weighted by the words written in each period." },
    { term: "95% interval", definition: `From ${n(S.bootstrap_resamples)} bootstrap resamples that draw whole groups with replacement: brands for brand writing, arXiv subject categories for abstracts, sites for homepages, authors for books.` },
  ],
  analyst: ANALYSTS["jack-stovell"],
  competingInterests: "ScriptGrain sells writing-voice measurement and the analyst builds it; a story about a punctuation mark said to give away machine writing is also one the product could use. The hypotheses, the dash definition and the pass and fail rules were committed to the public repository before the full count, every hypothesis is reported whichever way it came out, and the data and scripts are public.",
  notShown: [
    "That any text was written by AI. A dash count describes punctuation, not authorship.",
    "That the rise (or lack of one) since 2022 was caused by AI tools. The studies are observational and the periods differ in many other ways.",
    "Anything about spoken language, social media, or writing outside these collections.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
  ],
  productNote: "ScriptGrain's free [AI cliche checker](/tools/ai-cliche-checker) counts em dashes alongside other habits in any text you paste, using the same code as this study.",
  sample: {
    description: `Five collections held by ScriptGrain: ${n(CO.arxiv.docs)} arXiv abstracts (2015 to 2026, ${n(CO.arxiv.words)} words), ${n(CO.brand.docs)} dated blog posts and press releases from ${n(CO.brand.brands)} UK brands, ${n(CO.homepages.docs)} company homepages (2000 to 2026, SGR-004), ${n(CO.gutenberg.books)} Project Gutenberg books (${n(CO.gutenberg.words)} words) and ${n(CO.web2021.pages)} web pages from 2021 (SGR-007).`,
    size: CO.arxiv.docs + CO.brand.docs + CO.homepages.docs + CO.gutenberg.books + CO.web2021.pages,
    inclusionCriteria: ["arXiv: the SGR-008 census, abstracts of at least 30 words, and for papers up to November 2022 only those with no later revision", "Brand writing: blog posts, press releases and announcements of at least 150 words from the brand deep corpus, dated by metadata, structured data, URL or archive capture", "Books: the SGR-005 author panel and the SGR-006 book sample, whole text between the Project Gutenberg markers, at least 5,000 words", "Homepages and 2021 web pages: the measured rows SGR-004 and SGR-007 published"],
    exclusions: ["Brand information packs and annual reports (tables use dashes as empty cells)", "Brand pages with no usable date, or dated before 2015, are left out of every time comparison", "Page text is not published; counts and rates only"],
  },
  method: [
    "Pre-registration: the six hypotheses, the dash rules and the analysis were committed to the public repository before the full measurement (docs/research/sgr-019-preregistration.md). The script was tested on under 5% of the data; the test results are not reported.",
    "Counting: one regular-expression count per text, no language model. Words are counted after dash marks are replaced by spaces, so \"word--word\" is two words.",
    "Trend test: for each modern body of writing, the 2015 to November 2022 pooled rate by quarter is fitted with a weighted line and projected over 2024 onward; the hypothesis is supported if the lower end of the 95% interval of observed minus projected is above zero. December 2022 to December 2023 is left out of both sides.",
    "Comparison with books: the ratio of today's rate to the rate in 1800s non-fiction books (and science books for arXiv), with independent bootstrap intervals; supported if the upper end is below 1.",
    "Breadth: the share of brands (with at least five pages in each period) whose rate was higher from 2024 on than in 2019 to November 2022, with a Wilson interval.",
  ],
  variablesMeasured: ["Em dash marks per 1,000 words (primary and strict)", "Share of texts with at least one dash (arXiv, brand writing, homepages)", "Source, year or era, genre, sector"],
  findings: [
    { label: `H1 (${verdict(H.H1.result).toLowerCase()}): brand writing since 2024 sits above its 2015 to 2022 trend`, value: `Observed ${f2(H.H1.obs)}, trend ${f2(H.H1.proj)}, difference ${signed(H.H1.diff)} (95% interval ${rng(H.H1.diff_lo, H.H1.diff_hi)})`, explanation: `Per 1,000 words, ${n(H.H1.clusters)} brands. The rule was that the lower end of the interval must be above zero.` },
    { label: `H2 (${verdict(H.H2.result).toLowerCase()}): arXiv abstracts since 2024 sit above their 2015 to 2022 trend`, value: `Observed ${f2(H.H2.obs)}, trend ${f2(H.H2.proj)}, difference ${signed(H.H2.diff)} (95% interval ${rng(H.H2.diff_lo, H.H2.diff_hi)})`, explanation: `Per 1,000 words, ${n(H.H2.clusters)} subject categories. arXiv stores abstracts as ASCII, so only authors who type three hyphens or a spaced pair register here.` },
    { label: `H3 (${verdict(H.H3.result).toLowerCase()}): company homepages since 2024 sit above their 2015 to 2022 trend`, value: `Observed ${f2(H.H3.obs)}, trend ${f2(H.H3.proj)}, difference ${signed(H.H3.diff)} (95% interval ${rng(H.H3.diff_lo, H.H3.diff_hi)})`, explanation: `Per 1,000 words, ${n(H.H3.clusters)} sites. SGR-004's counts, which include U+2014 only and are therefore a lower bound.` },
    { label: `H4 (${verdict(H.H4a.result).toLowerCase()}, ${verdict(H.H4b.result).toLowerCase()}): today's rate is below the 19th century's`, value: `Brand writing ${f2(H.H4a.a)} against ${f2(H.H4a.b)} in 1800s non-fiction (ratio ${f2(H.H4a.ratio)}, interval ${rng(H.H4a.lo, H.H4a.hi)}); arXiv ${f2(H.H4b.a)} against ${f2(H.H4b.b)} in 1800s science (ratio ${f2(H.H4b.ratio)}, interval ${rng(H.H4b.lo, H.H4b.hi)})`, explanation: "The rule was that the upper end of each ratio's interval must be below 1. Book rates include editors' and typesetters' dashes as well as the authors'." },
    { label: `H5 (${verdict(H.H5.result).toLowerCase()}): brand writing was already rising before ChatGPT`, value: `${f2(H.H5.early)} in 2015 to 2018, ${f2(H.H5.late)} in 2019 to November 2022 (ratio ${f2(H.H5.ratio)}, interval ${rng(H.H5.lo, H.H5.hi)})`, explanation: "Supported if the lower end of the ratio's interval is above 1." },
    { label: `H6 (${verdict(H.H6.result).toLowerCase()}): the rise is spread across brands`, value: `${n(H.H6.higher)} of ${n(H.H6.brands)} brands higher (${n(H.H6.share == null ? null : H.H6.share * 100)}%, interval ${H.H6.lo == null ? "n/a" : `${n(H.H6.lo * 100)}% to ${n(H.H6.hi * 100)}%`})`, explanation: "Supported if at least 60% of eligible brands rose and the lower end of the Wilson interval is above 50%." },
  ],
  sections: [
    { heading: "Em dashes per 1,000 words, 1800 to 2026", figure: { src: "/research/sgr-019-long-run.svg", alt: `Line chart of em dashes per 1,000 words: books by decade from 1800, company homepages by year from 2000, UK brand writing and arXiv abstracts by year from 2015. Brand writing ${f2(L.brand_late.per1000)} in 2019 to 2022 and ${f2(L.brand_after.per1000)} since 2024; 1800s non-fiction books ${f2(nonfic.per1000)}.`, caption: "Source: ScriptGrain SGR-019, CC BY 4.0.", width: 760, height: 400 } },
    { heading: "Above or below the pre-ChatGPT trend", figure: { src: "/research/sgr-019-after-chatgpt.svg", alt: `Three panels, brand writing, arXiv abstracts and homepages, each showing the rate over time with the 2015 to 2022 trend carried forward. Brand writing observed ${f2(H.H1.obs)} against a trend of ${f2(H.H1.proj)}; arXiv ${f2(H.H2.obs)} against ${f2(H.H2.proj)}; homepages ${f2(H.H3.obs)} against ${f2(H.H3.proj)}.`, caption: "Source: ScriptGrain SGR-019, CC BY 4.0.", width: 760, height: 654 } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Observed", "Comparison", "Difference or ratio (95% interval)"], rows: [
      ["H1 brand writing above its trend", verdict(H.H1.result), f2(H.H1.obs), `trend ${f2(H.H1.proj)}`, `${signed(H.H1.diff)} (${rng(H.H1.diff_lo, H.H1.diff_hi)})`],
      ["H2 arXiv above its trend", verdict(H.H2.result), f2(H.H2.obs), `trend ${f2(H.H2.proj)}`, `${signed(H.H2.diff)} (${rng(H.H2.diff_lo, H.H2.diff_hi)})`],
      ["H3 homepages above their trend", verdict(H.H3.result), f2(H.H3.obs), `trend ${f2(H.H3.proj)}`, `${signed(H.H3.diff)} (${rng(H.H3.diff_lo, H.H3.diff_hi)})`],
      ["H4a brand writing below 1800s non-fiction", verdict(H.H4a.result), f2(H.H4a.a), `books ${f2(H.H4a.b)}`, `${f2(H.H4a.ratio)} (${rng(H.H4a.lo, H.H4a.hi)})`],
      ["H4b arXiv below 1800s science books", verdict(H.H4b.result), f2(H.H4b.a), `books ${f2(H.H4b.b)}`, `${f2(H.H4b.ratio)} (${rng(H.H4b.lo, H.H4b.hi)})`],
      ["H5 brand writing already rising, 2019 to 2022 against 2015 to 2018", verdict(H.H5.result), f2(H.H5.late), `earlier ${f2(H.H5.early)}`, `${f2(H.H5.ratio)} (${rng(H.H5.lo, H.H5.hi)})`],
      ["H6 rise spread across brands", verdict(H.H6.result), `${n(H.H6.higher)} of ${n(H.H6.brands)}`, "share higher", `${n(H.H6.share == null ? null : H.H6.share * 100)}%`],
    ] } },
    { heading: "Books by era", paragraphs: ["Whole books from the SGR-005 and SGR-006 collections, grouped by the century in which the author turned 40 (or the work's publication year where known). The strict rate counts only the em dash character and spaced en dashes; most plain-text Project Gutenberg files spell the em dash as two hyphens, so the main rate is the fair one."], table: { columns: ["Era", "Books", "Dash marks per 1,000 words", "95% interval", "Strict rate"], rows: S.gutenberg_bands.map((b) => [b.band, n(b.books), f2(b.per1000), rng(b.lo, b.hi), f2(b.strict_per1000)]) } },
    { heading: "Each collection by year", paragraphs: ["Pooled rate per 1,000 words with a 95% interval, and the share of texts with at least one dash where texts are counted one by one."], table: { columns: ["Collection", "Year", "Texts", "Words", "Per 1,000 words", "95% interval", "Texts with a dash"], rows: SER.filter((r) => r.corpus !== "gutenberg_decades" && r.year >= 2015).map((r) => [({ arxiv: "arXiv abstracts", brand: "UK brand writing", homepages: "Company homepages" })[r.corpus], String(r.year), n(r.docs), n(r.words), f2(r.per1000), rng(r.lo, r.hi), r.share_docs_with_dash == null ? "n/a" : `${n(r.share_docs_with_dash * 100)}%`]) } },
    { heading: "Web pages in 2021", paragraphs: [`Published SGR-007 counts (U+2014 only), the year before ChatGPT. All 2021 pages together: ${f2(S.exploratory.web2021.all.per1000)} per 1,000 words (${rng(S.exploratory.web2021.all.lo, S.exploratory.web2021.all.hi)}).`], table: { columns: ["Kind of page", "Pages", "Per 1,000 words", "95% interval"], rows: S.exploratory.web2021.groups.map((g) => [g.group.replace(/_/g, " "), n(g.pages), f2(g.per1000), rng(g.lo, g.hi)]) } },
  ],
  limitations: [
    "Dashes in books may be the editor's or the typesetter's, not the author's, and the Project Gutenberg plain-text versions show the dash as two hyphens whichever mark the print edition used. The book rates measure the printed or transcribed text, not an author's habit.",
    "arXiv stores abstracts as ASCII, so an author's typed em dash survives only as three hyphens or a spaced pair of hyphens. Dashes written without spaces are missed, and the arXiv rate is a lower bound that depends on how authors type.",
    "The homepage counts are SGR-004's published rows: U+2014 only, with no spaced en dash, and the page text no longer exists to recount. They are a lower bound and are not pooled with the other collections.",
    "The collections differ in kind, so the lines in the long-run chart are not one sample of English over time. Books are literary and non-fiction works of different eras; the modern collections are marketing copy, scientific abstracts and company homepages.",
    "Brand pages come from fixed collection rules, not a random draw from everything a brand published, and many have no recoverable date. Archived pages (before November 2022) and live pages (after) came by different routes.",
    "A rise after 2022 shows a change in how text looks in the ChatGPT era. It is not evidence that any text was written by AI, and a fall would not be evidence of the reverse.",
    "Word counts here ignore dashes; SGR-010 counted every run of non-space characters, so rates can differ in the second decimal place.",
  ],
  reproducibility: ["Pre-registration, run script and entry builder: docs/research/sgr-019-preregistration.md and scripts/experiments/sgr-019/ in the ScriptGrain repository.", "Every brand page's URL, date and counts, and every book's identifier and counts, are in the data files, so any figure can be recounted from the public sources."],
  dataDownloads: [
    { label: "Summary: hypotheses, intervals, levels, exploratory cuts (JSON)", path: "/research/sgr-019-summary.json", format: "json" },
    { label: "Rate by collection and year, with intervals (CSV)", path: "/research/sgr-019-by-year.csv", format: "csv" },
    { label: "Every book: identifier, era, genre, words and dash counts (CSV)", path: "/research/sgr-019-books.csv", format: "csv" },
    { label: "Every brand page: URL, date, words and dash counts (CSV)", path: "/research/sgr-019-brand-pages.csv", format: "csv" },
    { label: "arXiv abstracts by month and subject group: documents, words, dash counts (CSV)", path: "/research/sgr-019-arxiv-monthly.csv", format: "csv" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-019, conducted ${long(CONDUCTED)}). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${SLUG}`,
  citations: [
    { name: "ScriptGrain (2026). Did ChatGPT change how companies write? 27 years of homepages, measured (SGR-004)", url: "https://scriptgrain.com/research/did-chatgpt-change-how-companies-write" },
    { name: "ScriptGrain (2026). Did brand writing change after ChatGPT? 37 UK brands, before and after (SGR-011)", url: "https://scriptgrain.com/research/did-brand-writing-change-after-chatgpt" },
  ],
};

const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
const i = data.studies.findIndex((x) => x.id === study.id); if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-019 written; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
