#!/usr/bin/env bun
// SGR-024: write the study entry in src/data/research-pages.json from public/research/sgr-024-summary.json.
// Every number in the copy comes from the summary; none is typed here.
//   bun scripts/experiments/sgr-024/write-entry.mjs --conducted-on 2026-10-29 --publish-on 2026-10-30
// Refuses a pilot summary unless --allow-pilot (used only to test the entry against the CI guards), a summary
// generated on another UTC date than --conducted-on, and a publish date that is not the day after.
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const CONDUCTED = opt("--conducted-on"), PUBLISH_ON = opt("--publish-on");
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const dayBefore = (iso) => new Date(Date.parse(iso + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
if (dayBefore(PUBLISH_ON) !== CONDUCTED) throw new Error(`conductedOn must be the day before publishOn (${dayBefore(PUBLISH_ON)})`);
const here = new URL(".", import.meta.url).pathname;
const SUMMARY = args.includes("--allow-pilot") && opt("--summary") ? opt("--summary") : "public/research/sgr-024-summary.json";
const S = JSON.parse(readFileSync(SUMMARY, "utf8"));
if (S.pilot && !args.includes("--allow-pilot")) throw new Error("summary is from a pilot run; refusing");
if (!S.pilot && S.generated.slice(0, 10) !== CONDUCTED) throw new Error(`summary was generated ${S.generated.slice(0, 10)}, not on ${CONDUCTED}: re-run run.mjs`);
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));

const n = (x, d = 0) => (x == null || !Number.isFinite(x) ? "n/a" : Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }));
const f1 = (x) => n(x, 1), f2 = (x) => n(x, 2), f3 = (x) => n(x, 3);
const signed = (x, d = 2) => (x == null ? "n/a" : `${x < 0 ? "−" : "+"}${n(Math.abs(x), d)}`);
const rng = (lo, hi, d = 2) => (lo == null || hi == null ? "interval n/a" : `${n(lo, d)} to ${n(hi, d)}`);
const pp = (c, d = 2) => (c == null ? "n/a" : `${n(c.point, d)}% (${rng(c.lo, c.hi, d)})`);
const long = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const verdict = (h) => (h.supported ? "Supported" : "Not supported");
const lc = (s) => s.toLowerCase();
const noDash = (s) => String(s).replace(/[–—]/g, "-");

const H = S.hypotheses, M = S.main_shares, R8 = S.sgr008_reference, SMP = S.sample, NP = S.n_by_period, BD = S.bounds, PB = S.placebo, C1 = S.checks.C1, C2 = S.checks.C2;
const N = SMP.included, MILLION = `${(N / 1e6).toFixed(1)} million`;
const SLUG = "did-the-ai-tells-reach-medicine";
const TITLE = `Did the AI tells reach medicine? ${MILLION} PubMed abstracts, 2015 to 2026`;
const VERDICT_TEXT = { replicates: "replicates", "partly replicates": "partly replicates", "does not replicate": "does not replicate" }[S.replication_verdict];
const U24 = BD.union[2024], U26 = BD.union[2026], A24 = BD.set2024[2024], B26 = BD.set2026[2026];
const GR = S.by_group.slice(0, S.hypotheses.H2.groups_counted);
const byName = Object.fromEntries(S.by_group.map((g) => [g.group, g]));
const SENS = S.sensitivity, INS = S.instruments, LABSRC = S.excess.label_sources;
const exclusionLine = (k, text) => (S.exclusions[k] ? `${n(S.exclusions[k])} ${text}` : null);

const study = {
  id: "SGR-024", slug: SLUG, title: TITLE,
  seoTitle: "AI words in medical abstracts, 2015 to 2026: do they replicate? · ScriptGrain Research",
  question: "Did the words that moved in arXiv abstracts after ChatGPT (old tells such as \"delve\" and \"pivotal\", then a different set from 2025) also move in PubMed abstracts, and how does that compare with what Kobak and colleagues found for 2024?",
  conductedOn: CONDUCTED, publishOn: PUBLISH_ON,
  description: `A pre-registered replication of SGR-008 on ${n(N)} PubMed abstracts (a fixed 10% sample, entered 2015 to September 2026). The old tells were in ${f2(M.old.base.point)}% of abstracts before ChatGPT, ${f2(M.old.y24.point)}% in 2024 and ${f2(M.old.y26.point)}% in 2026; the new words ${f2(M.new.base.point)}%, ${f2(M.new.y24.point)}% and ${f2(M.new.y26.point)}%. Verdict: SGR-008 ${VERDICT_TEXT} in medicine.`,
  abstract: [
    { label: "Background", text: "SGR-008 found that in arXiv abstracts the words once called signs of ChatGPT, such as \"delve\" and \"pivotal\", rose in 2024 and then fell, while a different set of words rose in 2025 and 2026. Kobak and colleagues had already shown excess vocabulary in 2024 PubMed abstracts, and later work estimates that a large majority of recent biomedical papers carry language-model traces. This study asks whether the arXiv pattern also holds in medicine and biology, and checks our method against theirs." },
    { label: "What we did", text: `We fixed six hypotheses and two checks against Kobak et al. in public before the full measurement. We took a fixed 10% sample of PubMed records by a hash of the PubMed identifier, kept ${n(N)} English journal-article abstracts of at least 50 words entered from January 2015 to September 2026, and measured the same three word sets as SGR-008 (twelve old tells, twelve new words, five control words), the share of abstracts containing any word of each set. We then selected excess words in each year on odd months, scored them on even months, labelled each as style or content by fixed rules, and computed a lower bound on the share of abstracts affected. Confidence intervals come from resampling ${n(SMP.journals)} journals.` },
    { label: "What we found", text: `Old tells: ${f2(M.old.base.point)}% of abstracts in 2020 to November 2022, ${f2(M.old.y24.point)}% in 2024 and ${f2(M.old.y26.point)}% in 2026. New words: ${f2(M.new.base.point)}%, ${f2(M.new.y24.point)}% and ${f2(M.new.y26.point)}%. The hypothesis that the old tells rose and then fell (H1) was ${lc(verdict(H.H1))}; that the new words rose, doubling in at least six of eight subject groups (H2), ${lc(verdict(H.H2))}; and that the new words overtook the old in 2025 or 2026 (H3), ${lc(verdict(H.H3))}${H.H3.crossover_half ? ` (from ${H.H3.crossover_half})` : ""}. So SGR-008 ${VERDICT_TEXT} in medicine. The lower bound for 2024 was ${pp(A24)} against Kobak et al.'s 13.5% estimate (our check C1 was ${lc(verdict(C1))}).` },
    { label: "What it means", text: "A shift in the words used in abstracts is a shift in how abstracts read. It does not show who or what wrote them, and the lower bounds count only abstracts using the specific words we selected." },
  ],
  keyNumbers: [
    `Old-tell words (such as "delve" and "pivotal") were in ${f2(M.old.base.point)}% of PubMed abstracts entered in 2020 to November 2022, ${f2(M.old.y24.point)}% in 2024 and ${f2(M.old.y26.point)}% in 2026 (ScriptGrain, 2026; ${n(N)} abstracts).`,
    `The twelve new words were in ${f2(M.new.base.point)}% of abstracts before ChatGPT, ${f2(M.new.y24.point)}% in 2024 and ${f2(M.new.y26.point)}% in 2026 (${f2(M.new.r26b.point)} times the baseline; in arXiv the same ratio was ${f2(R8.new_ratio_2026_over_base)}).`,
    `At least ${f1(U24.pct)}% of 2024 abstracts and ${f1(U26.pct)}% of 2026 abstracts contain a selected style word beyond the share the 2021 and 2022 trend projects (lower bounds; 95% intervals ${rng(U24.lo, U24.hi, 1)} and ${rng(U26.lo, U26.hi, 1)}).`,
    `${n(H.H2.groups_with_ratio_at_least_2)} of ${n(H.H2.groups_counted)} subject groups had at least twice as many abstracts with a new word in 2026 as in 2020 to 2022.`,
  ],
  measures: [
    { term: "Old tells", definition: "Twelve words fixed in SGR-008 before any data: innovative, utilized, advancements, pivotal, facilitates, firstly, tackle, showcasing, underscores, delve, delves, intricate. The share is the percentage of abstracts containing at least one of them." },
    { term: "New words", definition: "Twelve words fixed in SGR-008 from a separate sample: underexplored, grounded, aligns, synthesizes, replaces, leaving, recovers, expose, structurally, reproducible, treats, vanishes. Same measure." },
    { term: "Control words", definition: "Five common words, however, results, using, show and method, to check that the sample did not drift." },
    { term: "Entry date", definition: "The date PubMed first received the record (the entrez date). Months are counted from it; publication date is a sensitivity analysis." },
    { term: "Excess words and the lower bound", definition: "As in Kobak et al. and SGR-008: a word is excess in a year if its share exceeds the share projected from 2021 and 2022. Words are selected on odd months and scored on even months. The lower bound is the share of abstracts containing at least one selected style word, beyond the share expected without a rise." },
    { term: "95% interval", definition: `From ${n(S.bootstrap_resamples)} resamples that draw whole journals with replacement (seed ${S.seed}).` },
  ],
  analyst: ANALYSTS["jack-stovell"],
  competingInterests: "ScriptGrain sells writing-voice measurement and the analyst builds it; a story that medicine is full of machine-written text could suit the product. The hypotheses, word sets, thresholds and pass and fail rules were committed to the public repository before the full measurement, every hypothesis is reported whichever way it came out, and the data and scripts are public.",
  notShown: [
    "That any abstract was written by AI. A word count describes vocabulary, not authorship.",
    "That the words moved because of AI tools. The data are observational and many other things changed after 2022.",
    "That the share of abstracts using a word set is the share of abstracts written with AI: the lower bound counts abstracts with specific words and misses AI-assisted text that avoids them.",
    "Anything about full text, non-English abstracts or journals outside PubMed.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
  ],
  productNote: "ScriptGrain's free [AI cliche checker](/tools/ai-cliche-checker) flags many of the same words in any text you paste, using the same code as this study.",
  sample: {
    description: `A fixed 10% sample of PubMed records (those whose SHA-1 of "sgr-024:" plus the PubMed identifier falls in the lowest tenth), read from the NCBI annual baseline and daily update files, latest version of each record, with ${n(N)} abstracts from ${n(SMP.journals)} journals meeting the rules below. Entry dates run from January 2015 to September 2026.`,
    size: N,
    inclusionCriteria: [
      "Entered PubMed from 1 January 2015 to 30 September 2026",
      "Has an abstract of at least 50 words, with section labels such as BACKGROUND removed",
      "Language includes English, publication type Journal Article, and the text looks English (at least 5% common English words)",
      "Retracted papers are kept in the main analysis and dropped in a sensitivity analysis",
    ],
    exclusions: [
      exclusionLine("no_abstract", "records with no abstract"),
      exclusionLine("not_english_language_field", "records not tagged as English"),
      exclusionLine("not_journal_article", "records that are not journal articles"),
      exclusionLine("excluded_publication_type", "editorials, letters, comments, errata, retraction notices and similar types"),
      exclusionLine("under_50_words", "abstracts under 50 words"),
      exclusionLine("non_english_text", "abstracts that do not look English"),
      exclusionLine("duplicate_text", "exact duplicate abstracts"),
      exclusionLine("outside_window", "records entered outside the window"),
      "Text is not published; counts and rates only",
    ].filter(Boolean),
  },
  method: [
    "Pre-registration: the six hypotheses, two checks against Kobak et al., word sets, thresholds and analysis were committed to the public repository before the full measurement (docs/research/sgr-024-preregistration.md). The script was tested on a 4% pilot; the pilot results are not reported.",
    "Sampling: a fixed hash of the PubMed identifier picks 10% of records, so the sample is the same whenever it is drawn. Records come from NCBI's annual baseline and daily update files; the latest version of each record is used and deleted records are dropped.",
    "Measures: tokens are lowercase runs of letters and hyphens of three or more characters. A set's share is the percentage of abstracts with at least one of its words. No language model is used.",
    "Hypotheses: H1 old tells rise from 2020 to 2022 to 2024 then fall by 2026; H2 new words rise, at least doubling in six of eight subject groups; H3 the new words overtake the old in a half-year from 2025H1 to 2026H2. All are judged on 95% cluster-bootstrap intervals over journals.",
    "Excess words: for each year, a word's expected share is its 2022 share plus the 2021 to 2022 change carried forward. Words are selected on odd entry months and scored on even months. Selected words are labelled style or content by fixed rules (Kobak et al.'s published labels first, then SGR-008's, then an AI-topic rule, then breadth across subject groups); no language model labels anything.",
    "Subject groups: each journal is assigned a group from MeSH major topics of its records entered before December 2022.",
  ],
  variablesMeasured: ["Share of abstracts containing a word of each set, by month, half-year and year", "Excess-word statistics and style or content label by word and year", "Sentence length and other measured text features", "Journal subject group"],
  findings: [
    { label: `H1 (${lc(verdict(H.H1))}): the old tells rose, then fell`, value: `2024 minus 2020 to 2022: ${signed(H.H1.rose_vs_base.point)} points (95% interval ${rng(H.H1.rose_vs_base.lo, H.H1.rose_vs_base.hi)}); 2026 minus 2024: ${signed(H.H1.fell_vs_2024.point)} points (${rng(H.H1.fell_vs_2024.lo, H.H1.fell_vs_2024.hi)})`, explanation: `Both parts must hold: the lower end of the first interval above zero and the upper end of the second below zero. In arXiv (SGR-008) the share went from ${f2(R8.share_pct.old.BASE)}% to ${f2(R8.share_pct.old.Y2024)}% to ${f2(R8.share_pct.old.Y2026)}%.` },
    { label: `H2 (${lc(verdict(H.H2))}): the new words rose in most subject groups`, value: `2026 minus 2024: ${signed(H.H2.new_vs_2024.point)} points (${rng(H.H2.new_vs_2024.lo, H.H2.new_vs_2024.hi)}); 2026 minus baseline: ${signed(H.H2.new_vs_base.point)} points (${rng(H.H2.new_vs_base.lo, H.H2.new_vs_base.hi)}); ${n(H.H2.groups_with_ratio_at_least_2)} of ${n(H.H2.groups_counted)} groups at least doubled`, explanation: "Supported if both pooled intervals are above zero and at least six of eight subject groups have a 2026 to baseline ratio of at least 2." },
    { label: `H3 (${lc(verdict(H.H3))}): the new words overtook the old`, value: H.H3.crossover_half ? `From ${H.H3.crossover_half}, the new-word share exceeded the old-tell share in every later half-year` : "No half-year from 2025H1 to 2026H2 from which the new words stay above the old", explanation: `In arXiv the crossover was ${R8.crossover_half}.` },
    { label: `H4 (${lc(verdict(H.H4))}): sentence length did not change`, value: `Mean sentence length ${f2(H.H4.base_mean)} words before ChatGPT, ${f2(H.H4.y26_mean)} in 2026; difference ${signed(H.H4.diff, 2)} (90% interval ${rng(H.H4.ci90[0], H.H4.ci90[1])})`, explanation: "Supported if the 90% interval lies within one word either side of zero. A change in words without a change in sentence shape was the SGR-008 pattern." },
    { label: `H5 (${lc(verdict(H.H5))}): the style words changed between 2024 and 2026`, value: `Jaccard overlap of the two top-50 style lists: ${f3(H.H5.jaccard)} (${n(H.H5.n2024)} and ${n(H.H5.n2026)} words)${H.H5.overlap.length ? `; shared: ${H.H5.overlap.join(", ")}` : ""}`, explanation: `Supported if the overlap is below 0.5. In arXiv it was ${f3(R8.h5_jaccard)}.` },
    { label: `H6 (${lc(verdict(H.H6))}): our excess words match Kobak et al.'s`, value: `${n(H.H6.in_kobak_list)} of our top ${n(H.H6.of)} raw 2024 excess words are in their published list of 900`, explanation: "Supported if at least 30 of 50 are. This tests whether our selection finds the same signal in a different sample." },
    { label: `C1 (${lc(verdict(C1))}): our 2024 lower bound sits near Kobak et al.'s`, value: `${pp({ point: C1.bound_pct, lo: C1.lo, hi: C1.hi })} against their estimate of ${n(C1.kobak_pct, 1)}%`, explanation: `Supported if the interval's lower end is above zero and the point estimate is between ${n(C1.window[0], 2)}% and ${n(C1.window[1])}%.` },
    { label: `C2 (${lc(verdict(C2))}): our sample matches their counts`, value: `${n(C2.within_window)} of ${n(C2.word_years)} word-years within 0.8 to 1.4 times their share (${n(C2.share_within * 100)}%); median ratio ${f2(C2.median_ratio)}`, explanation: "Compares the share of abstracts containing each of the 29 fixed words with Kobak et al.'s full-corpus counts, 2015 to 2024. Supported if at least 80% fall in the window." },
  ],
  sections: [
    { heading: "Two word sets by half-year", figure: { src: "/research/sgr-024-two-word-sets.svg", alt: `Line chart of the share of PubMed abstracts containing an old tell or a new word, by half-year of entry from 2015 to 2026. Old tells ${f2(M.old.base.point)}% in 2020 to 2022, ${f2(M.old.y24.point)}% in 2024, ${f2(M.old.y26.point)}% in 2026; new words ${f2(M.new.base.point)}%, ${f2(M.new.y24.point)}%, ${f2(M.new.y26.point)}%.`, caption: "Source: ScriptGrain SGR-024, CC BY 4.0.", width: 760, height: 380 } },
    { heading: "Lower bound on abstracts touched by style words", figure: { src: "/research/sgr-024-lower-bounds.svg", alt: `Chart of the lower bound on the share of abstracts using selected style words, 2023 to 2026. Union of the 2024 and 2026 lists: ${f1(U24.pct)}% in 2024 and ${f1(U26.pct)}% in 2026.`, caption: "Source: ScriptGrain SGR-024, CC BY 4.0.", width: 760, height: 330 } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Measured", "Pass rule"], rows: [
      ["H1 old tells rose then fell", verdict(H.H1), `${signed(H.H1.rose_vs_base.point)} then ${signed(H.H1.fell_vs_2024.point)} points`, "Rise lower end above 0, fall upper end below 0"],
      ["H2 new words rose in most groups", verdict(H.H2), `${n(H.H2.groups_with_ratio_at_least_2)} of ${n(H.H2.groups_counted)} groups doubled`, "Both pooled intervals above 0, at least 6 of 8 groups at least 2 times"],
      ["H3 new words overtook old", verdict(H.H3), H.H3.crossover_half ?? "no crossover", "Crossover in 2025H1 to 2026H2"],
      ["H4 sentence length unchanged", verdict(H.H4), `${signed(H.H4.diff)} words`, "90% interval within plus or minus 1 word"],
      ["H5 style words changed", verdict(H.H5), `Jaccard ${f3(H.H5.jaccard)}`, "Below 0.5"],
      ["H6 matches Kobak et al.'s list", verdict(H.H6), `${n(H.H6.in_kobak_list)} of ${n(H.H6.of)}`, "At least 30 of 50"],
      ["C1 bound near their 13.5%", verdict(C1), `${f2(C1.bound_pct)}%`, "Lower end above 0 and point between 6.75% and 27%"],
      ["C2 counts match theirs", verdict(C2), `${n(C2.share_within * 100)}% in window`, "At least 80% of word-years in 0.8 to 1.4"],
    ] } },
    { heading: "PubMed and arXiv side by side", paragraphs: ["Percentage of abstracts containing at least one word of each set. The arXiv column is SGR-008's published result; the two corpora differ in field, length and who writes in them, so the comparison is of pattern, not of level."], table: { columns: ["Set and period", "PubMed (this study)", "95% interval", "arXiv (SGR-008)"], rows: [
      ["Old tells, 2020 to Nov 2022", f2(M.old.base.point), rng(M.old.base.lo, M.old.base.hi), f2(R8.share_pct.old.BASE)],
      ["Old tells, 2024", f2(M.old.y24.point), rng(M.old.y24.lo, M.old.y24.hi), f2(R8.share_pct.old.Y2024)],
      ["Old tells, Jan to Sep 2026", f2(M.old.y26.point), rng(M.old.y26.lo, M.old.y26.hi), f2(R8.share_pct.old.Y2026)],
      ["New words, 2020 to Nov 2022", f2(M.new.base.point), rng(M.new.base.lo, M.new.base.hi), f2(R8.share_pct.new.BASE)],
      ["New words, 2024", f2(M.new.y24.point), rng(M.new.y24.lo, M.new.y24.hi), f2(R8.share_pct.new.Y2024)],
      ["New words, Jan to Sep 2026", f2(M.new.y26.point), rng(M.new.y26.lo, M.new.y26.hi), f2(R8.share_pct.new.Y2026)],
      ["Control words, 2020 to Nov 2022", f2(M.ctl.base.point), rng(M.ctl.base.lo, M.ctl.base.hi), f2(R8.share_pct.control.BASE)],
      ["Control words, Jan to Sep 2026", f2(M.ctl.y26.point), rng(M.ctl.y26.lo, M.ctl.y26.hi), f2(R8.share_pct.control.Y2026)],
    ] } },
    { heading: "By subject group", paragraphs: ["Journals are grouped by the MeSH major topics of their records entered before December 2022; journals without a clear majority are in General and those with too few records are Unclassified. Ratio is the new-word share in 2026 over the share in 2020 to November 2022."], table: { columns: ["Group", "Journals", "New words, baseline %", "New words, 2026 %", "Ratio (95% interval)", "Old tells 2024 %"], rows: S.by_group.map((g) => [g.label ?? g.group, n(g.journals), f2(g.new_base), f2(g.new_y26), g.ratio == null ? "n/a" : `${f2(g.ratio)} (${rng(g.ratio_lo, g.ratio_hi)})`, f2(g.old_y24)]) } },
    { heading: "Lower bounds and the placebo", paragraphs: ["Lower bound on the percentage of abstracts using at least one selected style word, beyond what the 2021 and 2022 trend projects, with 95% intervals over journals. The placebo rows apply the same method to years before ChatGPT, using a 2016 to 2017 trend; a bound near zero there is the method behaving."], table: { columns: ["Word list", "Year", "Lower bound %", "95% interval"], rows: [
      ...["set2024", "set2026", "union"].flatMap((k) => [2023, 2024, 2025, 2026].map((y) => [({ set2024: "2024 style words", set2026: "2026 style words", union: "Union of both lists" })[k], String(y), f2(BD[k][y].pct), rng(BD[k][y].lo, BD[k][y].hi)])),
      ...["set2024", "set2026"].flatMap((k) => [2018, 2019, 2020, 2021].map((y) => [`Placebo A: ${({ set2024: "2024", set2026: "2026" })[k]} list`, String(y), f2(PB.A_actual_sets[k][y].pct), rng(PB.A_actual_sets[k][y].lo, PB.A_actual_sets[k][y].hi)])),
      ...[2019, 2021].map((y) => [`Placebo B: words reselected in ${y}`, String(y), f2(PB.B_reselected[y].pct), rng(PB.B_reselected[y].lo, PB.B_reselected[y].hi)]),
    ] } },
    { heading: "Sensitivity analyses", paragraphs: ["The same set shares under different choices. Each row repeats the main analysis with one change; intervals are from 1,000 or fewer journal resamples."], table: { columns: ["Choice", "Abstracts (baseline, 2024, 2026)", "Old tells: 2024 minus baseline (points)", "New words: 2026 minus baseline (points)"], rows: [
      ["Main analysis", `${n(S.n_by_period.BASE)}, ${n(S.n_by_period.Y2024)}, ${n(S.n_by_period.Y2026)}`, `${signed(M.old.d24b.point)} (${rng(M.old.d24b.lo, M.old.d24b.hi)})`, `${signed(M.new.d26b.point)} (${rng(M.new.d26b.lo, M.new.d26b.hi)})`],
      ...[["publication_date", "Months by publication date"], ["retracted_dropped", "Retracted papers dropped"], ["structured_only", "Structured abstracts only"], ["unstructured_only", "Unstructured abstracts only"], ["same_journals_30_each", "Journals with 30+ records in baseline and 2026"], ["journals_weighted_equally", "Each journal weighted equally"]].map(([k, label]) => [label, `${n(SENS[k].n.BASE)}, ${n(SENS[k].n.Y2024)}, ${n(SENS[k].n.Y2026)}`, `${signed(SENS[k].old.d24b.point)} (${rng(SENS[k].old.d24b.lo, SENS[k].old.d24b.hi)})`, `${signed(SENS[k].new.d26b.point)} (${rng(SENS[k].new.d26b.lo, SENS[k].new.d26b.hi)})`]),
    ] } },
    { heading: "Sentence shape and other text features", paragraphs: ["Means over abstracts for the measured features, with the 2026 minus baseline difference and its 95% interval."], table: { columns: ["Feature", "2020 to Nov 2022", "2024", "2026", "2026 minus baseline (95% interval)"], rows: Object.keys(INS.periods.BASE).map((k) => [k.replace(/_/g, " "), f2(INS.periods.BASE[k]), f2(INS.periods.Y2024[k]), f2(INS.periods.Y2026[k]), `${signed(INS.diffs_2026_minus_base[k].diff)} (${rng(INS.diffs_2026_minus_base[k].lo, INS.diffs_2026_minus_base[k].hi)})`]) } },
    { heading: "How abstracts and journals changed", table: { columns: ["Year", "Abstracts", "Structured %", "Retracted %", "20 largest journals %"], rows: Object.entries(S.composition_by_year).map(([y, c]) => [y, n(c.docs), f2(c.structured_pct), f2(c.retracted_pct), f2(c.largest_20_journals_pct)]) } },
  ],
  limitations: [
    "This is a 10% hash sample of PubMed, not every record. It reproduces Kobak et al.'s published word frequencies only as closely as check C2 reports, and rare words are noisy.",
    "PubMed abstracts are the latest version NCBI holds on the day of collection. A record revised after it was first published can show later wording in an earlier month. We report how many baseline records were revised after November 2022 in the summary.",
    "Entry date is when PubMed received the record, not when the paper was written; the main analysis uses it, and publication date is a sensitivity analysis.",
    "The lower bound counts only abstracts that contain a selected style word. AI-assisted text without them is missed, and human text with them is counted. The bound is a floor on a quantity we cannot observe, not an estimate of AI use.",
    "Style or content labels come from fixed rules, not a person or a model reading each word. Words that rose because a topic rose can be labelled style, and the reverse. The label source is published for every word.",
    "Subject groups come from the MeSH topics of each journal's earlier records and are coarse. General and Unclassified journals are outside the eight-group test.",
    "The old and new word sets were fixed from arXiv. They may not be the words most affected in medicine, which is what the excess-word analysis looks at.",
    "A change in vocabulary after 2022 is not evidence that any abstract was written by AI, and its absence would not be evidence of the reverse.",
  ],
  reproducibility: ["Pre-registration, collection script, run script and entry builder: docs/research/sgr-024-preregistration.md and scripts/experiments/sgr-024/ in the ScriptGrain repository.", "The sample is defined by a fixed hash rule on the PubMed identifier, so anyone can redraw it from NCBI's baseline and update files."],
  dataDownloads: [
    { label: "Word set shares by half-year and subject group (CSV)", path: "/research/sgr-024-half-year.csv", format: "csv" },
    { label: "Word set counts by month and subject group (CSV)", path: "/research/sgr-024-monthly.csv", format: "csv" },
    { label: "Word set shares by year and subject group (CSV)", path: "/research/sgr-024-year-by-group.csv", format: "csv" },
    { label: "Every candidate and frozen word, share of abstracts by year, with labels (CSV)", path: "/research/sgr-024-words-by-year.csv", format: "csv" },
    { label: "Excess-word statistics, selection and scoring halves (CSV)", path: "/research/sgr-024-excess-words.csv", format: "csv" },
    { label: "Journal subject groups (CSV)", path: "/research/sgr-024-journal-groups.csv", format: "csv" },
    { label: "Sampling check against Kobak et al.'s counts (CSV)", path: "/research/sgr-024-sampling-check.csv", format: "csv" },
    { label: "Every result, including intervals, bounds and placebo (JSON)", path: "/research/sgr-024-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-024, conducted ${long(CONDUCTED)}). Dataset licensed CC BY 4.0. Derived from PubMed records (U.S. National Library of Medicine, public domain; individual abstracts remain the property of their publishers). https://scriptgrain.com/research/${SLUG}`,
  citations: [
    { name: "Kobak, Gonzalez-Marquez, Horvat and Lause. Delving into LLM-assisted writing in biomedical publications through excess vocabulary (Science Advances 11(27), eadt3813, 2025; arXiv 2406.07016)", url: "https://doi.org/10.1126/sciadv.adt3813" },
    { name: "Kobak et al. llm-excess-vocab: excess word lists and yearly counts (MIT licence)", url: "https://github.com/berenslab/llm-excess-vocab" },
    { name: "Kousha and Thelwall. How much are LLMs changing the language of academic papers after ChatGPT? A multi-database and full text analysis (arXiv 2509.09596)", url: "https://arxiv.org/abs/2509.09596" },
    { name: "Siler. The diffusion of large language models in published academic articles (PNAS, 2026; doi 10.1073/pnas.2605754123)", url: "https://doi.org/10.1073/pnas.2605754123" },
    { name: "Holzwarth, Gonzalez-Marquez and Kobak. Most biomedical publications show signs of LLM-assisted writing (arXiv 2608.10715)", url: "https://arxiv.org/abs/2608.10715" },
    { name: "Saner et al. The evolution of ChatGPT-generated text in scientific medical publications (Saudi Journal of Anaesthesia 20, 2026; doi 10.4103/sja.sja_526_25)", url: "https://doi.org/10.4103/sja.sja_526_25" },
    { name: "Liang et al. Quantifying large language model usage in scientific papers (Nature Human Behaviour, 2025; doi 10.1038/s41562-025-02273-8)", url: "https://doi.org/10.1038/s41562-025-02273-8" },
    { name: "NCBI. PubMed baseline and update files", url: "https://pubmed.ncbi.nlm.nih.gov/download/" },
    { name: "ScriptGrain SGR-008, The AI tells moved: 2.1 million arXiv abstracts, 2015 to 2026", url: "https://scriptgrain.com/research/the-ai-tells-moved" },
  ],
};

// no em or en dashes anywhere in the copy (src/test/research.test.ts enforces it)
const clean = JSON.parse(noDash(JSON.stringify(study)));
const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
const i = data.studies.findIndex((x) => x.id === clean.id); if (i === -1) data.studies.push(clean); else data.studies[i] = clean;
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
// llms.txt: one line for the new page (idempotent: replaces an earlier SGR-024 line). The first research
// line marks the top of the research block, newest first.
{
  const LP = "public/llms.txt", lines = readFileSync(LP, "utf8").split("\n");
  const line = `- "Did the AI words reach medical research / do PubMed abstracts use delve and the other ChatGPT words" -> https://scriptgrain.com/research/${SLUG} (from ${long(PUBLISH_ON)}: Study SGR-024, ${n(N)} PubMed abstracts 2015 to 2026, a pre-registered replication of SGR-008; its arXiv pattern ${VERDICT_TEXT} in PubMed; data CC BY)`;
  const keep = lines.filter((l) => !l.includes(`/research/${SLUG}`));
  const at = keep.findIndex((l) => /^- ".*https:\/\/scriptgrain\.com\/research\//.test(l));
  if (at === -1) throw new Error("no research block found in public/llms.txt");
  keep.splice(at, 0, line);
  writeFileSync(LP, keep.join("\n"));
}
console.error(`SGR-024 written; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}${S.pilot ? " (PILOT: do not commit)" : ""}`);
