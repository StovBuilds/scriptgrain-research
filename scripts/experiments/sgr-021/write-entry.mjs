#!/usr/bin/env bun
// SGR-021: write the study entry in src/data/research-pages.json from the run's summary, so every
// number on the page is the run's number.
//
//   bun scripts/experiments/sgr-021/write-entry.mjs --conducted-on YYYY-MM-DD --publish-on YYYY-MM-DD [--summary public/research/sgr-021-summary.json]
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CONDUCTED_ON = opt("--conducted-on", null), PUBLISH_ON = opt("--publish-on", null);
if (!CONDUCTED_ON || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-021-summary.json"), "utf8"));
if (S.pilot && !args.includes("--allow-pilot")) throw new Error("this summary is from a --pilot run; pilot numbers are never published (--allow-pilot is for the end-to-end test only; revert the files afterwards)");
const { _readme: _a, ...ANALYSTS } = JSON.parse(readFileSync(new URL("../shared/analysts.json", import.meta.url), "utf8"));

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f2 = (x) => n(x, 2), f3 = (x) => n(x, 3);
const sgn = (x, d = 3) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const when = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SLUG = "which-classic-authors-write-most-like-an-ai";
const TITLE = `Which classic authors write most like an AI? ${n(S.counts.authors)} authors, ${n(S.counts.books)} books, measured`;
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const { H1, H2, H3, H4 } = S, top = S.top, t1 = top[0];
const C = S.counts.by_century, G = S.counts.by_genre;
const cent = (c) => C[c] ?? { books: 0, words: 0, authors: 0 };
const verdict = (h) => (h ? "Supported" : "Not supported");
const ciText = (c, d = 3) => `${sgn(c[0], d)} to ${sgn(c[1], d)}`;
const T = Object.fromEntries(S.tells.map((t) => [t.tell, t]));
const decade = (d) => (d ? `${d}s` : "none");
const tellLine = (name) => {
  const t = T[name]; if (!t) return null;
  const home = t.earliest_strong_decade ? `earliest strong home: authors who turned 40 in the ${decade(t.earliest_strong_decade)} (${f2(t.earliest_strong_ratio)} times the corpus rate)` : `no decade at twice the corpus rate with enough uses (peak: ${t.peak_decade ? `${decade(t.peak_decade)}, ${f2(t.peak_ratio)} times` : "none"})`;
  return `"${name.replace("*", "")}": ${n(t.hits)} uses, ${f3(t.per1000)} per 1,000 words, used most by ${t.top_author ?? "no author with enough uses"}${t.top_author ? ` (${f3(t.top_author_per1000)})` : ""}; ${home}.`;
};
const featured = ["delve*", "tapestry", "realm", "embark*", "journey", "landscape"].map(tellLine).filter(Boolean);
const names = (xs, k = "name") => xs.map((x) => x[k]);
const joinList = (xs) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const stableNames = new Set(S.top_stable.map((x) => x.name)), robustInTop10 = top.slice(0, 10).filter((r) => stableNames.has(r.name)).length;
const wide = S.counts.authors;

const study = {
  id: "SGR-021",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Which classic authors write most like an AI? ${n(S.counts.authors)} authors measured · ScriptGrain Research`,
  question: "Which human writers, long before any language model, already used the words and habits now called AI-isms, and how much? Which of those words lived in which authors and eras?",
  conductedOn: CONDUCTED_ON,
  publishOn: PUBLISH_ON,
  description: `${n(S.counts.books)} books by ${n(S.counts.authors)} English-language authors from Project Gutenberg, ranked by how often they use the word lists now called AI-isms, with intervals over their books and a check on era, genre and dialogue. Pre-registered; published as a free dataset under CC BY 4.0. It ranks human habits; it does not detect AI.`,
  abstract: [
    { label: "Background", text: "Word lists of ChatGPT's supposed tells, such as delve, tapestry and realm, are mocked as machine habits. Those words come from somewhere. This study asks which human writers, in public-domain books written long before 2022, already used them, and how much." },
    { label: "What we did", text: `Before measuring anything we fixed an inclusion rule, four hypotheses and the outputs. The set is every author in Project Gutenberg's public-domain English catalogue who meets the inclusion rule, not a curated canon: every English-language author whom Wikidata confirms and who has at least three books of 15,000 words or more: ${n(S.counts.authors)} authors, ${n(S.counts.books)} books, ${n(S.counts.words / 1e6, 1)} million words, up to eight books each. For every book we counted uses of the frozen AI-ism lists per 1,000 words and ranked authors with 95% intervals over their own books.` },
    { label: "What we found", text: `${t1.name} (${t1.born} to ${t1.died}) ranked first at ${f3(t1.rate)} uses per 1,000 words (interval ${f3(t1.lo)} to ${f3(t1.hi)}), against ${f3(S.corpus.ai_isms_per1000)} for the whole corpus. ${robustInTop10} of the top 10 stay in the top 10 when each author's single highest book is removed. Non-fiction ${H1.holds ? "used" : "did not use"} the lists more than fiction (${f3(H1.nonfiction_rate)} against ${f3(H1.fiction_rate)} per 1,000 words), and the ranking ${H3.holds ? "held" : "did not hold"} when dialogue was taken out (Spearman ${f2(H3.rho)}).` },
    { label: "What it means", text: "These are the habits of human writers, measured as word counts. They show that the words on the lists were ordinary, often older, English long before language models; they do not show that any author influenced a model, and they cannot tell whether any text was written by AI." },
  ],
  keyNumbers: [
    `Across ${n(S.counts.authors)} English-language authors and ${n(S.counts.books)} public-domain books, the AI-ism lists appear ${f3(S.corpus.ai_isms_per1000)} times per 1,000 words (ScriptGrain, 2026).`,
    `${t1.name} ranks first at ${f3(t1.rate)} uses per 1,000 words (95% interval ${f3(t1.lo)} to ${f3(t1.hi)}) across ${t1.books} books; ${top[1].name} is second at ${f3(top[1].rate)} and ${top[2].name} third at ${f3(top[2].rate)}.`,
    `${S.corpus.authors_above_corpus_ci} of ${n(wide)} authors have an interval entirely above the corpus rate.`,
    `Non-fiction books use the lists ${f3(H1.nonfiction_rate)} times per 1,000 words against ${f3(H1.fiction_rate)} for fiction (difference ${sgn(H1.est)}, 95% interval ${ciText(H1.ci)}).`,
    `Authors who turned 40 in the 1900s average ${f3(H2.mean1900)} against ${f3(H2.mean1800)} for the 1800s (difference ${sgn(H2.est)}, 95% interval ${ciText(H2.ci)}).`,
  ],
  measures: [
    { term: "AI-ism rate", definition: "Uses per 1,000 words of the frozen word lists (OLD, CALLED_OUT and MARKETING from SGR-007), each occurrence counted once. Lists include delve, tapestry, realm, embark, journey and landscape. No list says a text was written by AI." },
    { term: "95% interval", definition: "From 10,000 resamples of an author's books with replacement. A wide interval means the author's books disagree." },
    { term: "Without the top book", definition: "An author's lowest rate after leaving out any one of their books: a guard against a single odd book." },
    { term: "Versus peers", definition: "An author's uses divided by the uses expected from other authors' books of the same genre in the same era. 1.0 is average for that era and genre." },
    { term: "Era", definition: "The century in which the author turned 40. Gutenberg dates e-texts, not first editions, so books cannot be dated more precisely." },
    { term: "Earliest strong home", definition: "The earliest decade (by the year authors turned 40) in which a word's rate is at least twice its corpus rate, with at least 10 uses by at least 2 authors." },
    { term: "Narration", definition: "A book's text with everything inside paired double quotation marks removed, so dialogue does not count." },
  ],
  analyst: ANALYSTS["jack-stovell"],
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The inclusion rule, word lists, hypotheses and outputs were fixed and published before any book was measured, nothing was re-run or selected, and the scripts are public, so the numbers can be checked without taking our word for them.",
  notShown: [
    "That any author sounds like an AI, or that any model learned from any author. The study counts words in human books; it shows no causal link.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that. It does not establish that voice measurement can tell whether a text was written by AI.",
    "When a book was first published. Gutenberg dates e-texts, so eras are by the year the author turned 40.",
    "Which authors are best or worst. The word lists include ordinary English words with older senses (realm, journey, landscape); a high rate says the author used them, not how well.",
    "A canon. Only authors that Wikidata and the Gutenberg catalogue let us match are included, and the public-domain record under-represents women and writers outside Britain and America.",
  ],
  productNote: "ScriptGrain measures writing voice from the samples a writer provides, using deterministic measures like those in this study. This study counted word lists in published books by dead authors; it did not test voice profiles or detection.",
  sample: {
    description: `The set is plainly "authors in Project Gutenberg's public-domain English catalogue who meet the inclusion rule", not a curated canon. It is made of English-language books (catalogue snapshot of 4 October 2026) by authors that Wikidata records as English-language writers with Gutenberg IDs and known birth and death years. An author is in if their midlife year (birth plus 40) is between 1650 and 1949 and they have at least three eligible books of 15,000 words or more; up to eight books each, chosen in a seeded random order. ${n(S.counts.authors)} authors, ${n(S.counts.books)} books and ${n(S.counts.words / 1e6, 1)} million words: ${n(cent(1700).authors)} authors from the 1700s, ${n(cent(1800).authors)} from the 1800s and ${n(cent(1900).authors)} from the 1900s by midlife year, ${n(G.fiction?.books ?? 0)} fiction books and ${n(G.nonfiction?.books ?? 0)} non-fiction.`,
    size: S.counts.books,
    inclusionCriteria: [
      "English-language author per Wikidata, with a Project Gutenberg author ID and birth and death years, turning 40 between 1650 and 1949",
      "At least three eligible books of 15,000 words or more, and at least 100,000 words in all",
      "Up to eight books per author, drawn in a seeded random order",
    ],
    exclusions: [
      "Translations, drama, poetry, dictionaries, encyclopedias, bibliographies, periodicals and collected-works volumes (by catalogue subject or title)",
      "Duplicate editions of the same title",
      "Front and back matter: the first and last 5% of each book, and paragraphs that mention a transcriber, Project Gutenberg, an illustration, a footnote or a note",
      "Authors the catalogue name could not be matched to exactly one Wikidata person",
    ],
  },
  method: [
    "Pre-registration: the inclusion rule, word lists, hypotheses and outputs were committed to the public repository before any book was measured (docs/research/sgr-021-preregistration.md). The panel is whatever the rules produce, with no hand edits.",
    "Measurement: each whole book is scanned with the frozen word lists from SGR-007 by deterministic code; a book's value is its uses divided by its words. No language model reads or scores any text.",
    "Ranking: authors ordered by total uses over total words, with a 95% interval from 10,000 resamples of their books, and re-ranked without their top book, against peers of the same era and genre, and on narration only.",
    "H1 to H4: pre-registered tests with 95% bootstrap intervals over authors (10,000 resamples).",
  ],
  variablesMeasured: ["AI-ism uses per 1,000 words", "AI-ism uses per 1,000 words of narration", "Uses of each listed word", "Share of words in dialogue", "AI-tell pattern density per 1,000 words (secondary)"],
  findings: [
    {
      label: "The ranking: who used the lists most",
      value: `${t1.name} ${f3(t1.rate)}, ${top[1].name} ${f3(top[1].rate)}, ${top[2].name} ${f3(top[2].rate)} uses per 1,000 words`,
      explanation: `The corpus rate is ${f3(S.corpus.ai_isms_per1000)} and the middle author's is ${f3(S.corpus.median_author_rate)}. The next in the top 10 are ${joinList(names(top.slice(3, 10)))}. The chart shows intervals over each author's books; ${S.one_book_authors_in_top20} of the top 20 get more than half their uses from a single book.`,
    },
    {
      label: "Robust to one odd book",
      value: `${robustInTop10} of the top 10 stay in the top 10 without their top book`,
      explanation: `${S.top20_overlap.stable_in_raw_top20} of the top 20 by rate are also in the top 20 once each author's highest book is removed. The robust top 10 is ${joinList(names(S.top_stable))}.`,
    },
    {
      label: `H1 (${verdict(H1.holds).toLowerCase()}): non-fiction against fiction`,
      value: `${sgn(H1.est)} uses per 1,000 words; 95% interval ${ciText(H1.ci)}`,
      explanation: `Non-fiction ${f3(H1.nonfiction_rate)}, fiction ${f3(H1.fiction_rate)}. Genre is the catalogue's label, and many authors wrote both.`,
    },
    {
      label: `H2 (${H2.holds ? "a difference" : "no clear difference"}): 1800s against 1900s authors`,
      value: `${sgn(H2.est)} per 1,000 words; 95% interval ${ciText(H2.ci)}`,
      explanation: `Mean author rate ${f3(H2.mean1900)} for ${H2.n1900} authors whose midlife year was in the 1900s and ${f3(H2.mean1800)} for ${H2.n1800} in the 1800s. We predicted no direction. Era and genre are both in the peers ranking, whose top 10 is ${joinList(names(S.top_adjusted))}.`,
    },
    {
      label: `H3 (${verdict(H3.holds).toLowerCase()}): not a dialogue artefact`,
      value: `Spearman ${f2(H3.rho)}; 95% interval ${f2(H3.ci[0])} to ${f2(H3.ci[1])}`,
      explanation: `The bar was 0.9. ${S.top20_overlap.narration_in_raw_top20} of the top 20 are also in the narration-only top 20. Exploratory: the author rate correlates with dialogue share at Spearman ${f2(S.dialogue.rho_rate_vs_dialogue_share)}.`,
    },
    {
      label: `H4 (${verdict(H4.holds).toLowerCase()}): a stable habit of the author`,
      value: `ICC ${f2(H4.icc)}; 95% interval ${f2(H4.ci[0])} to ${f2(H4.ci[1])}`,
      explanation: "The share of the variation in book-level rates that is between authors rather than between an author's own books. The bar was a lower bound above 0.25.",
    },
    {
      label: "Where the listed words lived",
      value: `${n(S.tells.length)} listed words, each with a top author and an earliest strong home`,
      explanation: featured.join(" "),
    },
  ],
  sections: [
    { heading: "The top 20", figure: { src: "/research/sgr-021-top20.svg", alt: `Bar chart of AI-ism uses per 1,000 words for the 20 highest-ranked authors, from ${t1.name} at ${f3(t1.rate)} down to ${top[19].name} at ${f3(top[19].rate)}, with 95% intervals and the corpus rate marked.`, caption: "Source: ScriptGrain SGR-021, CC BY 4.0.", width: 760, height: 70 + 20 * 22 + 40 } },
    { heading: "The baseline moves with era and genre", figure: { src: "/research/sgr-021-baselines.svg", alt: "Bar chart of the AI-ism rate by era (century in which the author turned 40) and genre.", caption: "Source: ScriptGrain SGR-021, CC BY 4.0.", width: 760, height: 70 + S.baselines.length * 26 + 40 } },
    {
      heading: "Pre-registered hypotheses and results",
      table: { columns: ["Hypothesis", "Result", "Test"], rows: [
        ["H1: non-fiction books use the lists more than fiction", verdict(H1.holds), `${sgn(H1.est)} (${ciText(H1.ci)})`],
        ["H2: authors from the 1900s differ from authors from the 1800s", H2.holds ? "Supported" : "Not supported", `${sgn(H2.est)} (${ciText(H2.ci)})`],
        ["H3: the ranking holds with dialogue removed (Spearman at least 0.9)", verdict(H3.holds), `${f2(H3.rho)} (${f2(H3.ci[0])} to ${f2(H3.ci[1])})`],
        ["H4: book rates cluster within authors (ICC lower bound above 0.25)", verdict(H4.holds), `${f2(H4.icc)} (${f2(H4.ci[0])} to ${f2(H4.ci[1])})`],
      ] },
    },
    {
      heading: "The top 20 authors",
      table: { columns: ["Rank", "Author", "Books", "Per 1,000 words", "95% interval", "Without top book", "Versus peers"], rows: top.map((r) => [String(r.rank), `${r.name} (${r.born} to ${r.died})`, String(r.books), f3(r.rate), `${f3(r.lo)} to ${f3(r.hi)}`, `${f3(r.stable_rate)} (rank ${r.rank_stable})`, `${f2(r.vs_peers)} (rank ${r.rank_adjusted})`]) },
    },
    {
      heading: "Every listed word",
      table: { columns: ["Word", "Uses", "Per 1,000 words", "Used most by", "Earliest strong home"], rows: S.tells.map((t) => [t.tell, n(t.hits), f3(t.per1000), t.top_author ?? "n/a", t.earliest_strong_decade ? decade(t.earliest_strong_decade) : "none"]) },
    },
  ],
  limitations: [
    "Project Gutenberg texts come from particular editions; spelling and wording can be modernised or edited. Only words are counted, not punctuation.",
    "Eras are by the year the author turned 40, not the book's first publication, because the catalogue gives e-text dates.",
    "Genre is the catalogue's subject label, and the corpus mixes novels, essays, histories, science and sermons; the peers ranking corrects for the label, not for subject matter.",
    "The word lists contain ordinary English words with older senses (realm, journey, landscape, harness); a count is a count of words, never evidence that a passage is machine-like.",
    "Up to eight books per author, chosen at random; an author's rate rests on those books, and the interval shows how far they disagree.",
    "Only authors that Wikidata and the catalogue let us match; the public-domain record under-represents women and writers outside Britain and America, so the ranking describes this corpus, not writers in general.",
    "Correlation only: the study cannot show that any author influenced any model, or that measurement can identify AI writing.",
  ],
  reproducibility: [
    "Pre-registration, Wikidata query and saved result, panel and every script: docs/research/sgr-021-preregistration.md and scripts/experiments/sgr-021/ in the ScriptGrain repository.",
    "Every book is named by its Project Gutenberg number in the data, so any text can be re-read and measured with the published word lists.",
  ],
  dataDownloads: [
    { label: "Every book: uses, words and rates (CSV)", path: "/research/sgr-021-books.csv", format: "csv" },
    { label: "Every author: rank, interval, rank without top book, versus peers (CSV)", path: "/research/sgr-021-authors.csv", format: "csv" },
    { label: "Every listed word: top author and earliest strong home (CSV)", path: "/research/sgr-021-tells.csv", format: "csv" },
    { label: "Summary: hypotheses, baselines, rankings (JSON)", path: "/research/sgr-021-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-021, conducted ${when(CONDUCTED_ON)}). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
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
console.error(`SGR-021 ${i === -1 ? "added" : "updated"}; conductedOn ${CONDUCTED_ON}, publishOn ${PUBLISH_ON}`);
