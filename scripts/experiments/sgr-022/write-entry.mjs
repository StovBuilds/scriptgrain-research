#!/usr/bin/env bun
// SGR-022: write the study entry in src/data/research-pages.json from the run's summary, so every
// number on the page is the run's number and nothing is typed by hand.
//
//   bun scripts/experiments/sgr-022/write-entry.mjs --conducted-on 2026-10-22 --publish-on 2026-10-23
//
// Guards: conductedOn must equal the day run.mjs ran (summary.ranOn) and publishOn must be the next
// day, and a pilot summary is refused. (--allow-pilot exists only for testing the builder; never commit its output.)
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CONDUCTED = opt("--conducted-on", null), PUBLISH_ON = opt("--publish-on", null);
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const SUMMARY = opt("--summary", "public/research/sgr-022-summary.json");
const S = JSON.parse(readFileSync(SUMMARY, "utf8"));
if (S.pilot && !args.includes("--allow-pilot")) throw new Error("refusing a pilot summary");
if (!S.pilot && S.ranOn !== CONDUCTED) throw new Error(`summary ran on ${S.ranOn}, not ${CONDUCTED}: re-run run.mjs on the conducted date; never edit the date`);
const nextDay = new Date(Date.parse(`${CONDUCTED}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
if (!S.pilot && PUBLISH_ON !== nextDay) throw new Error(`publishOn must be the day after conductedOn (${nextDay})`);

const here = new URL(".", import.meta.url).pathname;
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];
const LEX = JSON.parse(readFileSync(here + "../sgr-007/lexicons.json", "utf8"));
const FIG = opt("--figures", "public/research");

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f1 = (x) => n(x, 1), f2 = (x) => n(x, 2), f3 = (x) => n(x, 3);
const sg = (x) => (x > 0 ? "+" : x < 0 ? "−" : "");
const num = (x, d) => `${x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const ci = (h, d = 2) => (h.lo == null ? "not enough data" : `${sg(h.point)}${n(Math.abs(h.point), d)} (95% interval ${num(h.lo, d)} to ${num(h.hi, d)})`);
const ciIn = (h, d = 2) => (h.lo == null ? "not enough data" : `${sg(h.point)}${n(Math.abs(h.point), d)}, 95% interval ${num(h.lo, d)} to ${num(h.hi, d)}`);
const rel = (h) => (h.from_mean ? Math.round((100 * h.point) / h.from_mean) : 0);
const relS = (h) => `${sg(rel(h))}${Math.abs(rel(h))}%`;
const clears = (h) => h.lo != null && (h.lo > 0 || h.hi < 0);
const verdict = (v) => (v === "supported" ? "Supported" : "Not supported");
const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const WHOLE = new Set(["seamless", "elevate", "unlock", "empower", "streamline", "supercharge", "unleash", "effortless", "comprehensive", "significant", "harness", "embark", "delve", "intricate", "meticulous"]);
const listWords = (k) => LEX[k].map((w) => (w.endsWith("*") ? (WHOLE.has(w.slice(0, -1)) ? w.slice(0, -1) : null) : w)).filter(Boolean).slice(0, 8).map((w) => `"${w}"`).join(", ");
const figDims = (file) => { const m = readFileSync(`${FIG}/${file}`, "utf8").match(/viewBox="0 0 (\d+) (\d+)"/); return { width: +m[1], height: +m[2] }; };
const NA = "n/a";

const { H1, H2, H3, H4, H5, H6 } = S.answers;
const ST = S.statements, QS = S.questions, D = S.answersMinusQuestions, AM = S.allMeasures, Y = S.byYear, C = S.corpus;
const SLUG = "do-ministers-written-answers-sound-different-since-chatgpt";
const NDEPT = S.units.length;
const KEPT_A = C.kept.answer, KEPT_S = C.kept.statement;
const TITLE = `Do ministers' written answers sound different since ChatGPT? ${n(KEPT_A)} parliamentary answers and ${n(KEPT_S)} written statements, 2015 to 2026`;
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const yrs = Object.entries(Y).filter(([, v]) => v.ai_ism_per1000 != null);
const peak = yrs.filter(([y]) => +y >= 2023).reduce((a, b) => (b[1].ai_ism_per1000 > a[1].ai_ism_per1000 ? b : a));
const lastYear = yrs.at(-1), first = yrs[0];
const pre = ["2019", "2020", "2021", "2022"].map((y) => Y[y].ai_ism_per1000).filter((x) => x != null);
const preMean = pre.reduce((a, b) => a + b, 0) / pre.length;
const rose = H1.result === "supported";
const SG11 = S.sgr011, SG20 = S.sgr020;

const LISTS = [["marketing_per1000", "AI-era marketing words"], ["quiet_per1000", "the quieter LLM-favoured words"], ["old_per1000", "the 2024 tells such as \"delve\""], ["called_out_per1000", "the publicly mocked ChatGPT words"]];
const movedUp = LISTS.filter(([k]) => AM[k].lo > 0), movedFlat = LISTS.filter(([k]) => !(AM[k].lo > 0));
const listNames = (xs) => xs.map(([, l]) => l).join(", ").replace(/, ([^,]*)$/, " and $1");
const byListText = LISTS.map(([k, l]) => `${l} ${relS(AM[k])}${clears(AM[k]) ? " (interval clears zero)" : " (within chance)"}`).join("; ");

const statements = {
  h1: rose ? `AI-associated words rose ${rel(H1)}% within the same departments' answers (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words).` : `AI-associated words did not rise beyond chance within the same departments' answers (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words, ${relS(H1)}).`,
  dash: H3.result === "supported" ? `Em dashes rose (${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words).` : `Em dashes did not rise beyond chance (${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words).`,
  shape: H4.result === "supported" ? `AI-style sentence shapes rose (${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words).` : `AI-style sentence shapes did not rise beyond chance (${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words).`,
  len: H5.result === "supported" ? `Average sentence length stayed within 1.5 words (${f1(H5.from_mean)} to ${f1(H5.to_mean)}).` : `Average sentence length moved by more than the 1.5 words we allowed for (${f1(H5.from_mean)} to ${f1(H5.to_mean)}).`,
};
const compare = [
  SG11 ? `brand blogs and press releases ${SG11.H1.relative_pct > 0 ? "+" : ""}${SG11.H1.relative_pct}% (SGR-011, ${SG11.H1.brands} brands)` : null,
  SG20 ? `GOV.UK press releases and news stories ${SG20.H1.relative_pct > 0 ? "+" : ""}${SG20.H1.relative_pct}% (SGR-020, ${SG20.H1.units} departments)` : null,
].filter(Boolean);
const vsOthers = compare.length ? `The same measure moved ${compare.join("; ")}; in these answers the change was ${relS(H1)}.` : "";
const stRose = ST.H1.result === "supported";
const qChange = QS.ai_ism_per1000;

const study = {
  id: "SGR-022",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Do ministers' written answers sound different since ChatGPT? ${n(KEPT_A)} answers measured · ScriptGrain Research`,
  question: "Within the same UK government departments, do written parliamentary answers and written ministerial statements given after ChatGPT use more of the words and habits associated with AI writing than those given before it?",
  conductedOn: CONDUCTED,
  publishOn: PUBLISH_ON,
  description: `A pre-registered before-and-after study of ${n(KEPT_A)} written answers to parliamentary questions and ${n(KEPT_S)} written ministerial statements from 2015 to September 2026, drafted largely by civil servants. Each of ${NDEPT} departments is compared with itself: 2019 to November 2022 against 2024 onwards. ${rose ? `AI-associated words rose ${rel(H1)}% in answers` : "AI-associated words did not clearly rise in answers"}; ${H3.result === "supported" ? "em dashes rose" : "em dashes did not"}. Free dataset under CC BY 4.0; source credited under the Open Parliament Licence.`,
  abstract: [
    { label: "Background", text: "Ministers answer thousands of written parliamentary questions a year, and the answers are drafted by civil servants under pressure to be clear, accurate and quick. That is where people suspect AI tools may have crept in. Whether the writing changed after ChatGPT can be measured, because every answer and every written statement is public, dated and attributed to a department." },
    { label: "What we did", text: `We fixed six hypotheses before the full measurement, copying the design of our studies of UK brands (SGR-011) and GOV.UK press releases (SGR-020). We listed every answered written question tabled from October 2014 and drew a fixed-seed sample of ${n(S.sample.drawn)} from ${n(S.sample.frame_answered_non_holding)}, stratified by year and department, then fetched every sampled answer and every written statement through Parliament's public API. ${n(KEPT_A)} answers and ${n(KEPT_S)} statements of 50 words or more, given between January 2015 and September 2026, were measured in code. Each of ${NDEPT} departments (renamed and merged departments joined into their lineage) was compared only with itself: ${H1.cells} department-and-house pairs with at least 10 answers in both 2019 to November 2022 and 2024 onwards.` },
    { label: "What we found", text: `${statements.h1} ${movedUp.length ? `The words that moved were ${listNames(movedUp)}${movedFlat.length ? `; ${listNames(movedFlat)} did not move beyond chance` : ""}.` : "None of the four word lists moved beyond chance on its own."} ${statements.dash} ${statements.shape} ${statements.len} By calendar year the words peaked in ${peak[0]} at ${f2(peak[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022, and stood at ${f2(lastYear[1].ai_ism_per1000)} in ${lastYear[0]}. In written ministerial statements the same words ${stRose ? "rose" : "did not rise beyond chance"} (${relS(ST.H1)}). ${H6.result === "supported" ? "The rise was already visible in the Conservative months of 2024, before the July election." : "In the Conservative months of 2024 alone the change was within chance, so this study cannot separate the rise from the change of government."} ${vsOthers}` },
    { label: "What it means", text: `${rose ? "Parliamentary answers shifted in vocabulary after ChatGPT" : "Parliamentary answers did not clearly shift in the words people associate with AI"}, ${H2.result === "supported" ? "faster than the trend that was already under way" : "and nothing here shows a break from the trend before 2022"}. The questions MPs and peers write themselves are a comparison: their AI-associated words changed by ${relS(qChange)}. A change in a word list describes style; it does not show who, or what, wrote any answer.` },
  ],
  keyNumbers: [
    `${rose ? `UK government departments' written parliamentary answers used ${rel(H1)}% more AI-associated words` : "UK government departments' written parliamentary answers showed no clear rise in AI-associated words"} in 2024 to 2026 than the same departments' answers from 2019 to November 2022 (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words; ScriptGrain, 2026; ${H1.n} departments, pre-registered).`,
    `Em dashes in written parliamentary answers went from ${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words between 2019 to 2022 and 2024 to 2026 within the same ${H3.n} departments (change ${ciIn(H3)}).`,
    `AI-associated words in written parliamentary answers peaked in ${peak[0]} at ${f2(peak[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022 and ${f2(first[1].ai_ism_per1000)} in ${first[0]}.`,
    `The study measured ${n(KEPT_A)} written answers and ${n(KEPT_S)} written ministerial statements (${n(C.words_total)} words in all) from ${NDEPT} departments, given between January 2015 and September 2026.`,
    `In written ministerial statements, AI-associated words went from ${f2(ST.H1.from_mean)} to ${f2(ST.H1.to_mean)} per 1,000 words within the same ${ST.H1.n} departments (${relS(ST.H1)}).`,
    ...(compare.length ? [`Within-organisation change in AI-associated words after ChatGPT: ${relS(H1)} in parliamentary answers (${H1.n} departments)${SG20 ? `, ${SG20.H1.relative_pct > 0 ? "+" : ""}${SG20.H1.relative_pct}% in GOV.UK press writing (${SG20.H1.units})` : ""}${SG11 ? `, ${SG11.H1.relative_pct > 0 ? "+" : ""}${SG11.H1.relative_pct}% in UK brands (${SG11.H1.brands})` : ""}.`] : []),
  ],
  measures: [
    { term: "Before and after", definition: "Before: answers given from January 2019 to November 2022 (ChatGPT launched on 30 November 2022). After: January 2024 to September 2026. December 2022 to December 2023 is left out of the main test as a transition year and reported separately. The 2015 to 2018 answers are used only to test whether the change is a continuing trend." },
    { term: "Within-department change", definition: "For each department and house (Commons or Lords), the average after an answer minus the average before; then averaged over departments, each counting once. A department is compared only with itself, so a shift in which departments answer more cannot create a trend. Averages are weighted by the inverse of each answer's chance of being sampled, so they estimate the department's whole output. Renamed and merged departments are joined into one lineage." },
    { term: "AI-associated words", definition: `Uses per 1,000 words of three published word lists, each occurrence counted once: the 2024 words studies of scientific writing found language models over-use (${listWords("OLD")}…), words publicly mocked as ChatGPT tells, and AI-era marketing words (${listWords("MARKETING")}…). The same measure as [SGR-007](/research/where-did-ai-isms-come-from) and [SGR-011](/research/did-brand-writing-change-after-chatgpt). A separate list of quieter words (${listWords("QUIET")}…) is reported on its own.` },
    { term: "AI sentence shapes", definition: "The free [AI cliché checker](/tools/ai-cliche-checker)'s scan for 'not X but Y' balancing, reflexive lists of three, chains of semicolons and stock phrases, per 1,000 words." },
    { term: "Dates", definition: "The date Parliament records as the day the question was answered. Corrected answers keep their original date and are marked; a check without them is reported." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of departments. A hypothesis counts as supported only if the interval excludes zero in the predicted direction (for H5, if the 90% interval sits inside ±1.5 words)." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, eras, measures, sampling design and tests were committed to the public repository before the full measurement, every result is reported whether it passed or failed, and the data and scripts are public.",
  notShown: [
    "That any answer, or any department, used AI to write. Word counts show style; people used these words before ChatGPT and keep using them.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Why the writing changed. A new government and new ministers (July 2024), new staff, new drafting guidance, a changing mix of subjects (more questions about AI itself) and templates reused across answers could each move these numbers; this study measures the change, not its cause.",
    "Anything about oral questions, Hansard debates, committee evidence or the questions' content; or anything about who, a minister or an official, wrote a given word.",
  ],
  productNote: "ScriptGrain measures writing voice, the habits that make a writer recognisable, and its free [AI cliché checker](/tools/ai-cliche-checker) runs the sentence-shape scan used here. This study is about how parliamentary answers changed; it is not a test of who, or what, wrote any answer.",
  sample: {
    description: `Every written question answered between January 2015 and September 2026 that Parliament's Questions and Statements API listed (${n(S.sample.frame_answered_non_holding)} answered, non-withdrawn, non-holding answers), sampled with a fixed seed to ${n(S.sample.drawn)} (up to ${n(S.sample.perYear)} a year, at least ${n(S.sample.floorPerUnitYear)} per department a year where the department has that many), plus every written ministerial statement. ${n(KEPT_A)} answers and ${n(KEPT_S)} statements were measured after exclusions, from ${NDEPT} departments and other bodies. The confirmatory tests use the departments only; ${H1.cells} department-and-house pairs qualified.`,
    size: KEPT_A + KEPT_S,
    inclusionCriteria: ["Written parliamentary question answered between 1 January 2015 and 30 September 2026, or written ministerial statement made in that window", "Not withdrawn and not a holding answer", "At least 50 words of text after tables were removed", "At least 10 answers before and 10 after in the same department and house, for the confirmatory tests"],
    exclusions: Object.entries(C.excluded.answer).map(([k, v]) => `${n(v)} answers: ${k.replace(/_/g, " ")}`),
  },
  method: [
    "Corpus: written questions were listed through the UK Parliament Written Questions and Statements API by week of tabling, at no more than three requests a second with an identified user agent; a fixed-seed sample was drawn by year and department and its full answer text fetched; every written statement was listed by month and fetched. Source: UK Parliament, Open Parliament Licence.",
    "Sampling: for each year, up to 5,000 answers, with at least 200 per department where available and the rest shared in proportion to size; within each year and department, answers ranked by a hash of the question ID and the seed, first ones taken. Departments' means are weighted by the inverse of the chance of selection.",
    "Departments: each answer's answering body. Nineteen departments are analysed, with renamed, merged and split departments joined into one lineage (for example the Department of Health with the Department of Health and Social Care). Other bodies are analysed separately as exploratory.",
    "Text measured: the answer (or statement) reduced to plain text, with tables removed; the question and title are not part of the answer's text. Texts under 50 words, holding answers, exact duplicates within a department and texts where more than 40% of the words sit in short lines or more than half are numerals were excluded.",
    "Measures: computed in code by ScriptGrain's own instruments, the same counts the free tools run, and the same as in the brand series and SGR-020. No language model read or scored any text.",
    "Pre-registration: the hypotheses, eras, sampling design, exclusions and tests were committed to the public repository before the full measurement (docs/research/sgr-022-preregistration.md). The run was done once, on the day before publication.",
    "Tests: within-department change in department-weighted means, with 95% intervals from 2,000 bootstrap resamples of departments (fixed seed). H2 compares the per-year rate of change from 2015-18 to 2019-22 with that from 2019-22 to 2024-26, for cells with all three eras. H6 repeats H1 using only 1 January to 4 July 2024. Analyses beyond H1 to H6 are labelled exploratory.",
  ],
  variablesMeasured: ["AI-associated words per 1,000 words (and each word list)", "AI sentence shapes per 1,000 words", "Em dashes per 1,000 words", "Average sentence length", "Contractions per 1,000 words", '"You" share'],
  findings: [
    { label: `H1 (${verdict(H1.result).toLowerCase()}): AI-associated words ${rose ? "rose" : "did not rise beyond chance"} within the same departments' answers`, value: `${ci(H1)} per 1,000 words, ${relS(H1)}`, explanation: `From ${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words across ${H1.n} departments. By word list: ${byListText}. Leaving out any one department, the change stays between ${sg(S.answers.H1_leave_one_out.min)}${f2(Math.abs(S.answers.H1_leave_one_out.min))} and ${sg(S.answers.H1_leave_one_out.max)}${f2(Math.abs(S.answers.H1_leave_one_out.max))}.` },
    { label: `H2 (${verdict(H2.result).toLowerCase()}): the change after ChatGPT ${H2.result === "supported" ? "was faster than" : "was not clearly different from"} the trend before`, value: `${f3(H2.late_to_after_per_year)} per 1,000 words a year after, against ${f3(H2.early_to_late_per_year)} a year from 2015-18 to 2019-22`, explanation: `For the ${H2.n} departments with answers in all three eras, the difference in yearly change (${ciIn(H2, 3)}) ${H2.result === "supported" ? "excludes zero" : "includes zero"}. These words were already moving in books and the web before ChatGPT, as [SGR-007](/research/where-did-ai-isms-come-from) found.` },
    { label: `H3 (${verdict(H3.result).toLowerCase()}): em dashes ${H3.result === "supported" ? "rose" : "did not rise"}`, value: `${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words; change ${ci(H3)}`, explanation: `Em dashes and spaced en dashes are counted together. ${H3.result === "supported" ? "Answers used more dashes after ChatGPT." : "Despite the 'ChatGPT dash' reputation, these departments used dashes at a rate within chance of the earlier one."}` },
    { label: `H4 (${verdict(H4.result).toLowerCase()}): AI sentence shapes ${H4.result === "supported" ? "rose" : "did not rise"}`, value: `${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words; change ${ci(H4)}`, explanation: "'Not X but Y' constructions, reflexive lists of three and the cliché checker's stock phrases, per 1,000 words." },
    { label: `H5 (${verdict(H5.result).toLowerCase()}): sentence length ${H5.result === "supported" ? "stayed within 1.5 words" : "moved by more than 1.5 words"}`, value: `${f1(H5.from_mean)} to ${f1(H5.to_mean)} words; change ${ci(H5, 2)}`, explanation: `The 90% interval (${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}) ${H5.result === "supported" ? "sits inside" : "does not sit inside"} ±1.5 words.` },
    { label: `H6 (${verdict(H6.result).toLowerCase()}): ${H6.result === "supported" ? "the rise was already there in the Conservative months of 2024" : "the Conservative months of 2024 alone do not show a clear rise"}`, value: `${ci(H6)} per 1,000 words (1 January to 4 July 2024 against 2019 to 2022)`, explanation: `${H6.n} departments qualified. Parliament was dissolved from 30 May to 4 July 2024, so this window holds only about five months of answers, so ${H6.result === "supported" ? "the rise cannot be put down to the July 2024 change of government alone" : "this study cannot say whether the change of government or the time since ChatGPT explains the shift"}.` },
    { label: "Written ministerial statements (same six tests, secondary)", value: `AI-associated words ${ci(ST.H1)} per 1,000 words (${ST.H1.n} departments)`, explanation: `Em dashes ${ci(ST.H3)}; AI sentence shapes ${ci(ST.H4)}; average sentence length ${ci(ST.H5)}. Statements are a census, fewer in number than answers, so intervals are wider.` },
    { label: "The questions MPs and peers write (comparison series)", value: `AI-associated words ${ci(qChange)} per 1,000 words`, explanation: `Answers' change minus questions' change in the same departments: ${ciIn(D.ai_ism_per1000)} (exploratory). Questions are written by MPs, peers and their staff, not by civil servants, so they show what a change in the language of Parliament itself would look like.` },
    { label: "Robustness", value: `H1 with TRANSITION counted as after ${ci(S.transitionAsAfter.ai_ism_per1000)}; answers of 150+ words ${ci(S.longAnswers.ai_ism_per1000)}`, explanation: `Unweighted means ${ciIn(S.unweighted.ai_ism_per1000)}; pooled counts over words ${ciIn(S.pooled.ai_ism_per1000)}; without corrected answers ${ciIn(S.noCorrections.ai_ism_per1000)}; Commons ${ciIn(S.byHouse.Commons.ai_ism_per1000)}; Lords ${ciIn(S.byHouse.Lords.ai_ism_per1000)}. Labour months (from 5 July 2024) against 2019 to 2022: ${ciIn(S.afterSplit.labour.ai_ism_per1000)}.` },
  ],
  sections: [
    { heading: "AI-associated words, year by year", paragraphs: ["Exploratory. Each year is the mean over departments with at least 5 answers that year; the pre-registered tests compare each department only with itself."], figure: { src: "/research/sgr-022-by-year.svg", alt: `Line chart of AI-associated words per 1,000 words in ministers' written answers by year, from ${f2(first[1].ai_ism_per1000)} in ${first[0]} to a peak of ${f2(peak[1].ai_ism_per1000)} in ${peak[0]} and ${f2(lastYear[1].ai_ism_per1000)} in ${lastYear[0]}.`, caption: "Source: ScriptGrain SGR-022, CC BY 4.0. Contains Parliamentary information licensed under the Open Parliament Licence v3.0.", ...figDims("sgr-022-by-year.svg") } },
    { heading: "What changed, within the same departments", figure: { src: "/research/sgr-022-change.svg", alt: `Dot chart of within-department change from 2019-22 to 2024-26: AI-associated words ${relS(H1)}, em dashes ${relS(H3)}, AI sentence shapes ${relS(H4)}, average sentence length ${relS(H5)}, each with a 95% interval.`, caption: "Source: ScriptGrain SGR-022, CC BY 4.0.", ...figDims("sgr-022-change.svg") } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Change (95% interval)"], rows: [
      ["H1: AI-associated words rose", verdict(H1.result), `${ci(H1)} per 1,000 words`],
      ["H2: the change after ChatGPT was faster than the trend before it", verdict(H2.result), `${ci(H2, 3)} per 1,000 words a year`],
      ["H3: em dashes rose", verdict(H3.result), `${ci(H3)} per 1,000 words`],
      ["H4: AI sentence shapes rose", verdict(H4.result), `${ci(H4)} per 1,000 words`],
      ["H5: average sentence length changed by less than 1.5 words", verdict(H5.result), `${ci(H5)} words; 90% interval ${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}`],
      ["H6: AI-associated words were already higher in January to July 2024", verdict(H6.result), `${ci(H6)} per 1,000 words`],
    ] } },
    { heading: "Department by department", paragraphs: ["Exploratory. Mean AI-associated words per 1,000 words in each period; a figure appears only where the department has at least 10 answers in the period."], figure: { src: "/research/sgr-022-departments.svg", alt: "Dot plot of AI-associated words per 1,000 words in each department's answers, 2019 to November 2022 against 2024 to September 2026, sorted by change.", caption: "Source: ScriptGrain SGR-022, CC BY 4.0.", ...figDims("sgr-022-departments.svg") },
      table: { columns: ["Department", "Answers 2015-18", "2019-22", "2024-26", "AI-associated words 2019-22", "2024-26"], rows: S.units.map((u) => [u.name, n(u.EARLY), n(u.LATE), n(u.AFTER), u.LATE >= 10 ? f2(u.ai_ism_per1000_late) : NA, u.AFTER >= 10 ? f2(u.ai_ism_per1000_after) : NA]) } },
    { heading: "By word list and habit", paragraphs: ["Within-department change in answers from 2019-22 to 2024-26, same departments as H1."], table: { columns: ["Measure", "Before", "After", "Change (95% interval)"], rows: [["AI-associated words (H1)", "ai_ism_per1000", 2], ["AI-era marketing words", "marketing_per1000", 2], ["Quieter LLM-favoured words", "quiet_per1000", 2], ["2024 tells (delve and others)", "old_per1000", 2], ["Publicly mocked ChatGPT words", "called_out_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 1], ["Contractions", "contractions_per1000", 1], ['"You" share', "you_share", 2], ['"We" share', "we_share", 2], ['"I" share', "i_share", 2], ["Sentence-length variation", "sentence_variation", 2]].map(([l, k, d]) => [l, f2(AM[k].from_mean), f2(AM[k].to_mean), ci(AM[k], d)]) } },
    { heading: "Commons and Lords separately", table: { columns: ["Measure", "Commons (95% interval)", "Lords (95% interval)"], rows: [["AI-associated words", "ai_ism_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 2]].map(([l, k, d]) => [l, `${ci(S.byHouse.Commons[k], d)} (${S.byHouse.Commons[k].n} departments)`, `${ci(S.byHouse.Lords[k], d)} (${S.byHouse.Lords[k].n} departments)`]) } },
    { heading: "Checks on the weighting, the answers and the government", paragraphs: ["Exploratory robustness checks, each repeating the main comparison with one change. Conservative months: 1 January to 4 July 2024. Labour months: from 5 July 2024."], table: { columns: ["Check", "AI-associated words (95% interval)", "Em dashes (95% interval)", "Departments"], rows: [
      ["Main test (H1, H3)", ci(H1), ci(H3), String(H1.n)],
      ["Unweighted means", ci(S.unweighted.ai_ism_per1000), ci(S.unweighted.em_dash_per1000), String(S.unweighted.ai_ism_per1000.n)],
      ["Pooled counts over words", ci(S.pooled.ai_ism_per1000), ci(S.pooled.em_dash_per1000), String(S.pooled.ai_ism_per1000.n)],
      ["Answers of 150 words or more", ci(S.longAnswers.ai_ism_per1000), ci(S.longAnswers.em_dash_per1000), String(S.longAnswers.ai_ism_per1000.n)],
      ["Without corrected answers", ci(S.noCorrections.ai_ism_per1000), ci(S.noCorrections.em_dash_per1000), String(S.noCorrections.ai_ism_per1000.n)],
      ["Without answers that contained a table", ci(S.noTables.ai_ism_per1000), ci(S.noTables.em_dash_per1000), String(S.noTables.ai_ism_per1000.n)],
      ["Transition year counted as after", ci(S.transitionAsAfter.ai_ism_per1000), ci(S.transitionAsAfter.em_dash_per1000), String(S.transitionAsAfter.ai_ism_per1000.n)],
      ["Conservative months of 2024 only (H6)", ci(S.afterSplit.conservative.ai_ism_per1000), ci(S.afterSplit.conservative.em_dash_per1000), String(S.afterSplit.conservative.ai_ism_per1000.n)],
      ["Labour months only", ci(S.afterSplit.labour.ai_ism_per1000), ci(S.afterSplit.labour.em_dash_per1000), String(S.afterSplit.labour.ai_ism_per1000.n)],
    ] } },
    { heading: "Written statements, and the questions themselves", paragraphs: ["Statements: the same six tests as for answers, secondary and pre-registered. Questions: the text MPs and peers wrote for the sampled answers, a comparison with no hypothesis attached."], table: { columns: ["Series and measure", "Before", "After", "Change (95% interval)", "Departments"], rows: [
      ...[["AI-associated words", "ai_ism_per1000"], ["Em dashes", "em_dash_per1000"], ["AI sentence shapes", "ai_shape_per1000"]].map(([l, k]) => [`Statements: ${l}`, f2(ST[{ ai_ism_per1000: "H1", em_dash_per1000: "H3", ai_shape_per1000: "H4" }[k]].from_mean), f2(ST[{ ai_ism_per1000: "H1", em_dash_per1000: "H3", ai_shape_per1000: "H4" }[k]].to_mean), ci(ST[{ ai_ism_per1000: "H1", em_dash_per1000: "H3", ai_shape_per1000: "H4" }[k]]), String(ST[{ ai_ism_per1000: "H1", em_dash_per1000: "H3", ai_shape_per1000: "H4" }[k]].n)]),
      ...[["AI-associated words", "ai_ism_per1000"], ["Em dashes", "em_dash_per1000"], ["AI sentence shapes", "ai_shape_per1000"], ["Average sentence length", "avg_sentence_length"]].map(([l, k]) => [`Questions: ${l}`, f2(QS[k].from_mean), f2(QS[k].to_mean), ci(QS[k]), String(QS[k].n)]),
    ] } },
    { heading: "Other bodies", paragraphs: [`Exploratory. The same comparison for answers from bodies outside the nineteen departments (${n(S.otherBodies.answers_texts)} answers), each body counting once.`], table: { columns: ["Measure", "Before", "After", "Change (95% interval)", "Bodies"], rows: [["AI-associated words", "ai_ism_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 2]].map(([l, k, d]) => [l, f2(S.otherBodies.answers[k].from_mean), f2(S.otherBodies.answers[k].to_mean), S.otherBodies.answers[k].lo == null ? "not enough bodies" : ci(S.otherBodies.answers[k], d), String(S.otherBodies.answers[k].n)]) } },
    { heading: "Year by year", paragraphs: ["Exploratory; department-weighted means over the departments with at least 5 answers each year."], table: { columns: ["Year", "Answers", "Departments", "AI-associated words", "Em dashes", "AI sentence shapes", "Words per sentence"], rows: Object.entries(Y).map(([y, v]) => [y, n(v.texts), String(v.departments), v.ai_ism_per1000 == null ? NA : f2(v.ai_ism_per1000), v.em_dash_per1000 == null ? NA : f2(v.em_dash_per1000), v.ai_shape_per1000 == null ? NA : f2(v.ai_shape_per1000), v.avg_sentence_length == null ? NA : f1(v.avg_sentence_length)]) } },
  ],
  limitations: [
    "Written answers are drafted by civil servants, approved and given by a minister, and often reuse earlier answers, templates and shared lines; a numbers-only measure cannot separate the official's drafting from the minister's edit.",
    "Answers are a sample, not a census: a fixed-seed draw of up to 5,000 a year, weighted back to each department's output. Weighting corrects the design but not the exclusions that follow (short answers, duplicates), which fall unevenly across years.",
    "Many answers are very short, point to an earlier reply, or are mostly a list of figures. Texts under 50 words and mostly-numeric texts are left out, so the study describes substantive prose answers, not every answer.",
    "Word lists count spellings. These words rose in human writing for decades before ChatGPT, and topics shifted too: Parliament now asks about AI itself.",
    "Departments are joined into lineages by judgement. The business, energy, trade and science lineage mixes departments that did different work, and some work moved between departments in 2023. HMRC questions are answered through the Treasury and are counted there.",
    "Parliament was dissolved before the 2019 and 2024 general elections and prorogued in 2019 and 2022; no answers are given in those gaps, so months are not equally represented.",
    "The Conservative-months check covers about five months of answers (dissolution from 30 May 2024), so it is a weak test of whether the change of government explains the shift.",
    "Written questions and statements of the UK Parliament only, in English; oral questions and debates are not covered.",
  ],
  reproducibility: [
    "Pre-registration and scripts: docs/research/sgr-022-preregistration.md and scripts/experiments/sgr-022/ in the ScriptGrain repository (collect.mjs lists, samples and fetches the corpus, run.mjs measures and analyses it, write-entry.mjs builds this page from the summary).",
    "Every text is named by its Parliament question or statement ID in the data, so any answer can be re-read on questions-statements.parliament.uk and measured again.",
  ],
  dataDownloads: [
    { label: "Every text measured: kind, ID, house, department, date, era, sampling weight and every measure (CSV)", path: "/research/sgr-022-texts.csv", format: "csv" },
    { label: "Department by period: counts and mean of every measure, answers and statements (CSV)", path: "/research/sgr-022-departments.csv", format: "csv" },
    { label: "Year by year: department-weighted means for answers, statements and questions (CSV)", path: "/research/sgr-022-by-year.csv", format: "csv" },
    { label: "Summary: sampling design, hypotheses, intervals, robustness checks, exclusions (JSON)", path: "/research/sgr-022-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-022, conducted ${date(CONDUCTED)}). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "UK Parliament Written Questions and Statements API. Contains Parliamentary information licensed under the Open Parliament Licence v3.0", url: "https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/" },
    { name: "ScriptGrain (2026). Did brand writing change after ChatGPT? (SGR-011)", url: "https://scriptgrain.com/research/did-brand-writing-change-after-chatgpt" },
    { name: "ScriptGrain (2026). Where did AI-isms come from? (SGR-007)", url: "https://scriptgrain.com/research/where-did-ai-isms-come-from" },
    { name: "Kobak, D. et al. (2025). Delving into LLM-assisted writing in biomedical publications through excess vocabulary. Science Advances", url: "https://doi.org/10.1126/sciadv.adt3813" },
  ],
};

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-022 ${i === -1 ? "added" : "updated"}; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
