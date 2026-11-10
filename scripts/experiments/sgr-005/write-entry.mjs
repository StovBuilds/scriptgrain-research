#!/usr/bin/env bun
// SGR-005: write the study entry in src/data/research-pages.json from the
// published summary, so every number on the page is the run's number.
//
//   bun scripts/experiments/sgr-005/write-entry.mjs --publish-on YYYY-MM-DD [--summary public/research/sgr-005-summary.json]
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PUBLISH_ON = opt("--publish-on", null);
if (!PUBLISH_ON) throw new Error("--publish-on required");
const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-005-summary.json"), "utf8"));
const { _readme: _a, ...ANALYSTS } = JSON.parse(readFileSync(new URL("../shared/analysts.json", import.meta.url), "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];
const panel = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f1 = (x) => n(x, 1), f2 = (x) => n(x, 2);
const sgn = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${f1(Math.abs(x))}`;
const SLUG = "does-a-writers-voice-change-with-age";
const TITLE = `Does a writer's voice change with age? ${S.authors} authors, ${n(S.works)} books, measured`;
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const NAMES = { sentence_length: "Sentence length", sentence_cv: "Sentence length variation", commas_per_sentence: "Commas per sentence", semicolons_per1000: "Semicolons", contractions_per1000: "Contractions", long_word_share: "Long words", exclamations_per1000: "Exclamation marks", em_dash_per1000: "Dashes", pronoun_i: "'I' share of pronouns", pronoun_you: "'You' share of pronouns", ai_tell_per1000: "AI-tell shapes" };
const H1 = S.H1, H2 = S.H2, D = Object.fromEntries(S.drift.map((d) => [d.feature, d]));
const sl = S.slopes, top = sl[0], bottom = sl[sl.length - 1];
const by = (name) => sl.find((s) => s.name === name);
const icc = Object.entries(H2.features).sort((a, b) => b[1].icc - a[1].icc);
const T = Object.fromEntries(S.thirds.map((t) => [t.name, t]));
const yr = (r) => r.replace("-", " to ");
for (const t of S.thirds) { t.early_years = yr(t.early_years); t.late_years = yr(t.late_years); }
const james = T["Henry James"], troll = T["Anthony Trollope"];
// Trollope's trend with and without his first two novels (1847, 1848), from the book data.
const trollWithout = (() => {
  const W = readFileSync(opt("--works", "public/research/sgr-005-books.csv"), "utf8").trim().split("\n");
  const cols = W[0].split(",");
  const pts = W.slice(1).map((l) => l.split(",")).filter((c) => c[cols.indexOf("name")] === "Anthony Trollope" && +c[cols.indexOf("year")] > 1848).map((c) => [+c[cols.indexOf("age")], +c[cols.indexOf("n_sentence_length")]]);
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return (pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0)) * 10;
})();
const years = [Math.min(...panel.authors.map((a) => a.works[0].year)), Math.max(...panel.authors.map((a) => a.works.at(-1).year))];
const iccRange = [Math.min(...icc.map(([, v]) => v.icc)), Math.max(...icc.map(([, v]) => v.icc))];

const study = {
  id: "SGR-005",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Does a writer's voice change with age? ${S.authors} authors, ${n(S.works)} books measured · ScriptGrain Research`,
  question: "As writers age, which habits of their prose change and which stay fixed? Is there a general direction of change, such as longer sentences later in a career?",
  conductedOn: "2026-10-04",
  publishOn: PUBLISH_ON,
  description: `${n(S.works)} books by ${S.authors} English-language authors, from ${years[0]} to ${years[1]}, dated by first publication and measured passage by passage with the product's own instruments. Pre-registered. Two hypotheses tested, neither supported; published as a free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: `Critics often describe writers' styles changing with age; Henry James's long late sentences are the classic example. Whether that is a general rule, and which habits stay fixed across a career, has rarely been measured across many writers at once.` },
    { label: "What we did", text: `We fixed two hypotheses and the rules for choosing authors before measuring anything. Wikidata gave every English-language prose work on Project Gutenberg with a first-publication date; ${S.authors} authors had at least six such books spanning at least fifteen years. From each of their ${n(S.works)} books we measured five passages of about 1,000 words, with dialogue removed so a change in how much dialogue a book has could not pass for a change in style.` },
    { label: "What we found", text: `There was no general direction. ${H1.rising} writers' sentences lengthened with age and ${H1.falling} shortened, averaging ${sgn(H1.mean_slope_per_decade)} words per sentence per decade (95% interval ${sgn(H1.lo)} to ${sgn(H1.hi)}). Henry James changed most, by ${sgn(top.slope)} words per decade. Habits were only partly fixed: who wrote a book explained ${f2(iccRange[0])} to ${f2(iccRange[1])} of the variation in the six core habits, below the bar we had set for a stable fingerprint.` },
    { label: "What it means", text: `A writer's voice drifts, but in their own direction, not along a common path, and roughly half of what varies between their books is the book rather than the writer. Punctuation and word choice (commas, semicolons, long words) were the most stable parts of a voice; sentence length and contractions moved most from book to book.` },
  ],
  keyNumbers: [
    `Across ${S.authors} English-language authors writing between ${years[0]} and ${years[1]}, sentences did not get longer with age: ${H1.rising} authors' narration sentences lengthened and ${H1.falling} shortened, averaging ${sgn(H1.mean_slope_per_decade)} words per sentence per decade (ScriptGrain, 2026).`,
    `Henry James's narration sentences lengthened by ${sgn(top.slope)} words per decade of his age, the largest change among ${S.authors} authors; his books from ${james.late_years} averaged ${f1(james.sentence_length_late)} words per sentence against ${f1(james.sentence_length_early)} in ${james.early_years}.`,
    `Anthony Trollope moved the other way, by ${sgn(by("Anthony Trollope").slope)} words per sentence per decade, but that decline comes from his first two novels: without them his trend is ${sgn(trollWithout)}.`,
    `Who wrote a book explained only ${f2(iccRange[0])} to ${f2(iccRange[1])} of the variation in six core prose habits across ${n(S.works)} books by ${S.authors} authors; the rest varied from book to book.`,
    `Long words (${f2(H2.features.long_word_share.icc)}), semicolons (${f2(H2.features.semicolons_per1000.icc)}) and commas (${f2(H2.features.commas_per_sentence.icc)}) were the most author-stable habits; sentence length (${f2(H2.features.sentence_length.icc)}) and contractions (${f2(H2.features.contractions_per1000.icc)}) varied more between an author's own books.`,
    `Writers mixed long and short sentences slightly more as they aged: sentence length variation rose across the careers of ${D.sentence_cv.rising} of ${S.authors} authors and fell for ${D.sentence_cv.falling}.`,
  ],
  measures: [
    { term: "Narration", definition: "A passage with every run of text inside paired double quotation marks removed, so dialogue does not count. The primary measure; all-text figures are in the data." },
    { term: "Change per decade", definition: "For each author, the slope of a straight line through their books, from the measure against the author's age at first publication, scaled to ten years." },
    { term: "Share explained by the author (ICC)", definition: "The intraclass correlation of book-level values within authors: 1 would mean every book by a writer is identical on that habit, 0 that knowing the writer tells you nothing. The pre-registered bar for a fingerprint was 0.5." },
    { term: "Sentence length variation", definition: "The coefficient of variation of sentence lengths within a passage: how much long and short sentences are mixed." },
    { term: "Long words", definition: "The share of words of seven letters or more." },
    { term: "95% interval", definition: "From 10,000 bootstrap resamples of authors (2,000 for the ICC). A hypothesis counts as supported only if the interval clears its pre-registered bar." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses and the rules for choosing authors were fixed and published before anything was measured, nothing was re-run or selected, and the scripts are public, so the numbers can be checked without taking our word for them.",
  notShown: [
    "Whether the changes come from age or from the times. Within one writer, age and calendar year move together, so the two cannot be separated.",
    "Anything about living or modern writers. Every author here was published between the early nineteenth and mid twentieth centuries.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Whether a book is better or worse for its style. The study measures habits, not quality.",
  ],
  productNote: "ScriptGrain measures writing voice from the samples a writer provides, using deterministic measures like those in this study. This study measured published books by dead authors; it did not test voice profiles.",
  sample: {
    description: `Wikidata records (query and saved result in the repository) for English-language works with a Project Gutenberg ID, an author with birth and death dates, and a first-publication date. A date counts only if it falls between the author's 15th birthday and two years after their death; later dates are editions. Drama and poetry are excluded by Project Gutenberg subject, and every book has at least 15,000 words. ${S.authors} authors met the bar of at least six books spanning fifteen years or more: ${n(S.works)} books from ${years[0]} to ${years[1]}, five passages each (${n(S.passages)} passages, ${n(S.words / 1e6, 1)} million words).`,
    size: S.works,
    inclusionCriteria: [
      "English-language prose with a first-publication date inside the author's working life",
      "At least six such books per author, spanning at least fifteen years",
      "Books of at least 15,000 words; passages of about 1,000 words at 10%, 30%, 50%, 70% and 90% of the text",
    ],
    exclusions: [
      "Drama and poetry (by Project Gutenberg subject)",
      "Dates outside the author's life, which are edition dates rather than first publication",
      `${S.works_with_little_double_quoted_dialogue} books had almost no double-quoted dialogue (non-fiction, or editions that use single quotation marks); their narration measure includes any single-quoted dialogue`,
    ],
  },
  method: [
    "Pre-registration: the hypotheses, panel rules and measures were committed to [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research) before any book was measured (docs/research/sgr-005-preregistration.md). The panel is whatever those rules produce, with no hand edits.",
    "Measurement: each passage scored with the same deterministic code ScriptGrain uses, once as narration (dialogue removed) and once as all text; a book's value is the mean of its five passages. No language model reads or scores any text.",
    "H1: for each author, a straight-line slope of narration sentence length against age; the mean of the slopes, with a 95% bootstrap interval over authors.",
    "H2: for six core habits, the intraclass correlation of book values within authors, with a 95% bootstrap interval over authors; supported if at least four of the six intervals sit above 0.5.",
  ],
  variablesMeasured: ["Average sentence length", "Sentence length variation", "Commas per sentence", "Semicolons per 1,000 words", "Contractions per 1,000 words", "Share of long words", "Exclamation marks and dashes per 1,000 words", "Pronoun shares", "Share of words in dialogue"],
  findings: [
    {
      label: "H1 (not supported): sentences did not get longer with age in general",
      value: `${sgn(H1.mean_slope_per_decade)} words per sentence per decade; 95% interval ${sgn(H1.lo)} to ${sgn(H1.hi)}`,
      explanation: `${H1.rising} of ${H1.authors} authors' narration sentences lengthened as they aged and ${H1.falling} shortened. Counting dialogue too gave the same answer (${sgn(H1.all_text.mean_slope_per_decade)} per decade, interval ${sgn(H1.all_text.ci[0])} to ${sgn(H1.all_text.ci[1])}).`,
    },
    {
      label: "Writers drifted in their own directions",
      value: `${top.name} ${sgn(top.slope)}, ${bottom.name} ${sgn(bottom.slope)} words per decade`,
      explanation: `Henry James's late style is real: his narration sentences averaged ${f1(james.sentence_length_early)} words in ${james.early_years} and ${f1(james.sentence_length_late)} in ${james.late_years}. George Gissing (${sgn(by("George Gissing").slope)}) and E. M. Forster (${sgn(by("E. M. Forster").slope)}) also lengthened. Others went the other way: ${bottom.name} (${sgn(bottom.slope)}), Anthony Trollope (${sgn(by("Anthony Trollope").slope)}; without his first two novels, of 1847 and 1848, his trend is ${sgn(trollWithout)}, a reminder that one writer's line can rest on a few books) and Charles Dickens (${sgn(by("Charles Dickens").slope)}).`,
    },
    {
      label: "H2 (not supported): habits were only partly fixed",
      value: `${f2(iccRange[0])} to ${f2(iccRange[1])} of the variation explained by the author`,
      explanation: `For a stable fingerprint we required the author to explain more than half of the variation, with confidence, in at least four of six core habits. None cleared that bar. ${icc.slice(0, 3).map(([k, v], i) => `${i ? NAMES[k].toLowerCase() : NAMES[k]} (${f2(v.icc)})`).join(", ")} came closest, with estimates above 0.5 but intervals reaching below it; ${icc.slice(-3).map(([k, v]) => `${NAMES[k].toLowerCase()} (${f2(v.icc)})`).join(", ")} varied more between an author's own books.`,
    },
    {
      label: "Exploratory: late books mixed long and short sentences more",
      value: `${D.sentence_cv.rising} of ${S.authors} authors; ${sgn(D.sentence_cv.mean_slope_per_decade * 100)} points of variation per decade`,
      explanation: `Sentence length variation rose with age for ${D.sentence_cv.rising} authors and fell for ${D.sentence_cv.falling}, a small change whose interval sits just above zero. Semicolons tended to fall (${D.semicolons_per1000.falling} of ${S.authors} authors), though that interval includes zero. These were not pre-registered and should be read as leads.`,
    },
  ],
  sections: [
    { heading: "Each writer's change", figure: { src: "/research/sgr-005-authors.svg", alt: `Bar chart of change in narration sentence length per decade of age for ${S.authors} authors, from ${top.name} at ${sgn(top.slope)} to ${bottom.name} at ${sgn(bottom.slope)}.`, caption: "Source: ScriptGrain SGR-005, CC BY 4.0.", width: 760, height: 66 + S.slopes.length * 20 + 30 } },
    { heading: "Two careers, opposite directions", figure: { src: "/research/sgr-005-two-careers.svg", alt: "Scatter chart: Henry James's sentences lengthen across his career while Anthony Trollope's shorten.", caption: "Source: ScriptGrain SGR-005, CC BY 4.0.", width: 760, height: 400 } },
    { heading: "How much of a habit is the writer", figure: { src: "/research/sgr-005-fingerprint.svg", alt: `Bar chart of the share of variation explained by the author for six habits, from ${f2(iccRange[1])} for ${NAMES[icc[0][0]].toLowerCase()} to ${f2(iccRange[0])} for ${NAMES[icc.at(-1)[0]].toLowerCase()}; none clears the pre-registered 0.5 bar with confidence.`, caption: "Source: ScriptGrain SGR-005, CC BY 4.0.", width: 760, height: 84 + 6 * 30 + 34 } },
    {
      heading: "Pre-registered hypotheses and results",
      table: { columns: ["Hypothesis", "Result", "Test"], rows: [
        ["H1: narration sentence length rises with the author's age", H1.holds ? "Supported" : "Not supported", `mean ${sgn(H1.mean_slope_per_decade)} per decade (${sgn(H1.lo)} to ${sgn(H1.hi)}); ${H1.rising} rising, ${H1.falling} falling`],
        ["H2: for at least four of six core habits, the author explains more than half the variation", H2.holds ? "Supported" : "Not supported", `${H2.above_half} of 6 cleared the bar`],
      ] },
    },
    {
      heading: "Every author",
      table: { columns: ["Author", "Books", "Years", "Change per decade", "Early books", "Late books", "Words per sentence, early", "Late"], rows: S.slopes.map((s) => { const t = S.thirds.find((x) => x.author === s.author); return [s.name.replace(", 18th Baron of Dunsany", " (Lord Dunsany)"), String(s.works), `${s.first} to ${s.last}`, sgn(s.slope), t.early_years, t.late_years, f1(t.sentence_length_early), f1(t.sentence_length_late)]; }) },
    },
    {
      heading: "Every habit",
      table: { columns: ["Habit", "Average", "Change per decade", "Authors rising", "Authors falling", "Share explained by author"], rows: S.drift.map((d) => [NAMES[d.feature], f2(d.overall_mean), sgn(d.mean_slope_per_decade), String(d.rising), String(d.falling), f2(d.icc)]) },
    },
  ],
  limitations: [
    "Project Gutenberg texts come from particular editions, and punctuation can be an editor's or printer's rather than the author's; semicolons and dashes are the most exposed.",
    "Wikidata's first-publication dates are mostly right but not checked book by book; a wrong date moves one point on one author's line.",
    `${S.works_with_little_double_quoted_dialogue} books use single quotation marks for dialogue, or have none; for those, the narration measure still contains dialogue.`,
    "Authors write different kinds of books at different times (novels, stories, travel, essays), so some change across a career is a change of form, not of voice.",
    "Thirty-five authors, nearly all British or American and writing between 1810 and 1962; the findings describe them, not writers in general.",
  ],
  reproducibility: [
    "Pre-registration, Wikidata query and saved result, panel and every script: docs/research/sgr-005-preregistration.md and scripts/experiments/sgr-005/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research).",
    "Every book is named by its Wikidata item and Project Gutenberg number in the data, so any passage can be re-read and measured.",
  ],
  dataDownloads: [
    { label: "Every book: narration and all-text measures (CSV)", path: "/research/sgr-005-books.csv", format: "csv" },
    { label: "Summary: hypotheses, authors, habits (JSON)", path: "/research/sgr-005-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-005, conducted 4 October 2026). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "Wikidata (CC0)", url: "https://www.wikidata.org/" },
    { name: "Project Gutenberg", url: "https://www.gutenberg.org/" },
  ],
};

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-005 ${i === -1 ? "added" : "updated"}; publishOn ${PUBLISH_ON}`);
