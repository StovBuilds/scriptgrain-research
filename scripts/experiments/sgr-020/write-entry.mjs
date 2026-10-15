#!/usr/bin/env bun
// SGR-020: write the study entry in src/data/research-pages.json from the run's summary, so every
// number on the page is the run's number and nothing is typed by hand.
//
//   bun scripts/experiments/sgr-020/write-entry.mjs --conducted-on 2026-10-15 --publish-on 2026-10-16
//
// Guards: conductedOn must equal the day run.mjs ran (summary.ranOn) and publishOn must be the next
// day, and a pilot summary is refused. (--allow-pilot exists only for testing the builder; never commit its output.)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CONDUCTED = opt("--conducted-on", null), PUBLISH_ON = opt("--publish-on", null);
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const SUMMARY = opt("--summary", "public/research/sgr-020-summary.json");
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
const num = (x, d) => `${x < 0 && n(Math.abs(x), d) !== n(0, d) ? "−" : ""}${n(Math.abs(x), d)}`;
const ci = (h, d = 2) => h.lo == null ? "not enough data" : `${sg(h.point)}${n(Math.abs(h.point), d)} (95% interval ${num(h.lo, d)} to ${num(h.hi, d)})`;
const ciIn = (h, d = 2) => h.lo == null ? "not enough data" : `${sg(h.point)}${n(Math.abs(h.point), d)}, 95% interval ${num(h.lo, d)} to ${num(h.hi, d)}`;
const rel = (h) => (h.from_mean ? Math.round((100 * h.point) / h.from_mean) : 0);
const relS = (h) => `${sg(rel(h))}${Math.abs(rel(h))}%`;
const clears = (h) => h.lo != null && (h.lo > 0 || h.hi < 0);
const verdict = (v) => (v === "supported" ? "Supported" : "Not supported");
const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const WHOLE = new Set(["seamless", "elevate", "unlock", "empower", "streamline", "supercharge", "unleash", "effortless", "comprehensive", "significant", "harness", "embark", "delve", "intricate", "meticulous"]);
const listWords = (k) => LEX[k].map((w) => (w.endsWith("*") ? (WHOLE.has(w.slice(0, -1)) ? w.slice(0, -1) : null) : w)).filter(Boolean).slice(0, 8).map((w) => `"${w}"`).join(", ");
const figDims = (file) => { const m = readFileSync(`${FIG}/${file}`, "utf8").match(/viewBox="0 0 (\d+) (\d+)"/); return { width: +m[1], height: +m[2] }; };

const { H1, H2, H3, H4, H5, H6, allMeasures: AM, byYear: Y, corpus: C } = S;
const SLUG = "did-government-writing-change-after-chatgpt";
const NDEPT = C.departments;
const TITLE = `Did government writing change after ChatGPT? ${n(C.kept)} GOV.UK press releases and news stories, 2015 to 2026`;
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const yrs = Object.entries(Y).filter(([, v]) => v.ai_ism_per1000 != null);
const peak = yrs.filter(([y]) => +y >= 2023).reduce((a, b) => (b[1].ai_ism_per1000 > a[1].ai_ism_per1000 ? b : a));
const lastYear = yrs.at(-1);
const pre = ["2019", "2020", "2021", "2022"].map((y) => Y[y].ai_ism_per1000);
const preMean = pre.reduce((a, b) => a + b, 0) / pre.length;
const first = yrs[0];
const rose = H1.result === "supported";
const SG11 = S.sgr011;
// a hypothesis measure shows its confirmatory statistic wherever it appears, never a second bootstrap of the same change
const CONF = { ai_ism_per1000: H1, em_dash_per1000: H3, ai_shape_per1000: H4, avg_sentence_length: H5 };
const EXCL = { under_150_words: "under 150 words", outside_2015_to_sep_2026: "first published outside January 2015 to September 2026", list_like: "list-like pages (more than 40% of the words in lines of six words or fewer)", no_body: "with no body text", withdrawn: "withdrawn", not_found: "not found on GOV.UK", duplicate_text: "exact duplicates within a department", not_english: "not in English" };

// which AI-word lists moved, by their own intervals
const LISTS = [["marketing_per1000", "AI-era marketing words"], ["quiet_per1000", "the quieter LLM-favoured words"], ["old_per1000", "the 2024 tells such as \"delve\""], ["called_out_per1000", "the publicly mocked ChatGPT words"]];
const movedUp = LISTS.filter(([k]) => AM[k].lo > 0), movedFlat = LISTS.filter(([k]) => !(AM[k].lo > 0));
const listNames = (xs) => xs.map(([, l]) => l).join(", ").replace(/, ([^,]*)$/, " and $1");
const byListText = LISTS.map(([k, l]) => `${l} ${relS(AM[k])}${clears(AM[k]) ? " (interval clears zero)" : " (within chance)"}`).join("; ");

const statements = {
  h1: rose
    ? `AI-associated words rose ${rel(H1)}% within the same departments (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words).`
    : `AI-associated words did not rise beyond chance within the same departments (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words, ${relS(H1)}).`,
  dash: H3.result === "supported" ? `Em dashes rose (${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words).` : `Em dashes did not rise beyond chance (${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words).`,
  shape: H4.result === "supported" ? `AI-style sentence shapes rose (${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words).` : `AI-style sentence shapes did not rise beyond chance (${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words).`,
  len: H5.result === "supported" ? `Average sentence length stayed within 1.5 words (${f1(H5.from_mean)} to ${f1(H5.to_mean)}).` : `Average sentence length moved by more than the 1.5 words we allowed for (${f1(H5.from_mean)} to ${f1(H5.to_mean)}).`,
};
const vsBrands = SG11
  ? `For comparison, the same measure rose ${SG11.H1.relative_pct}% within ${SG11.H1.brands} UK brands' blogs and press releases (SGR-011); in departments the change was ${relS(H1)}.`
  : "";

const study = {
  id: "SGR-020",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Did government writing change after ChatGPT? ${n(C.kept)} GOV.UK press releases measured · ScriptGrain Research`,
  question: "Within the same UK government departments, did press releases and news stories published after ChatGPT use more of the words and habits associated with AI writing than those published before it?",
  conductedOn: CONDUCTED,
  publishOn: PUBLISH_ON,
  description: `A pre-registered before-and-after study of ${n(C.kept)} GOV.UK press releases and news stories from 2015 to September 2026. Each of ${NDEPT} departments is compared with itself: 2019 to November 2022 against 2024 onwards. ${rose ? `AI-associated words rose ${rel(H1)}%` : "AI-associated words did not clearly rise"}; ${H3.result === "supported" ? "em dashes rose" : "em dashes did not"}. Free dataset under CC BY 4.0, source credited under the Open Government Licence.`,
  abstract: [
    { label: "Background", text: "Public bodies write at enormous volume and under pressure to sound clear and consistent, which is exactly where people suspect AI tools have crept in. Whether government writing changed after ChatGPT can be measured, because every GOV.UK press release and news story since 2015 is public, dated and attributed to a department." },
    { label: "What we did", text: `We fixed six hypotheses before the full measurement, copying the design of our study of UK brands (SGR-011). We listed every GOV.UK press release and news story and fetched ${C.bodies_fetched === C.indexed ? "all " : ""}${n(C.bodies_fetched)} of them through the public Search and Content APIs; ${n(C.kept)} pages of 150 words or more, first published between January 2015 and September 2026, were measured in code. Each of ${NDEPT} departments (renamed and merged departments joined into their lineage) was compared only with itself: ${H1.cells} department-and-type pairs with at least 10 pages in both 2019 to November 2022 and 2024 onwards.` },
    { label: "What we found", text: `${statements.h1} ${movedUp.length ? `The words that moved were ${listNames(movedUp)}${movedFlat.length ? `; ${listNames(movedFlat)} did not move beyond chance` : ""}.` : "None of the four word lists moved beyond chance on its own."} ${statements.dash} ${statements.shape} ${statements.len} By calendar year the words peaked in ${peak[0]} at ${f2(peak[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022, and stood at ${f2(lastYear[1].ai_ism_per1000)} in ${lastYear[0]}. ${H6.result === "supported" ? "The rise was already visible in the Conservative months of 2024, before the July election." : "In the Conservative months of 2024 alone the change was within chance, so this study cannot separate the rise from the change of government."} ${vsBrands}` },
    { label: "What it means", text: `${rose ? "Government press writing shifted in vocabulary after ChatGPT" : "Government press writing did not clearly shift in the words people associate with AI"}, ${H2.result === "supported" ? "faster than the trend that was already under way" : "and nothing here shows a break from the trend before 2022"}. The habits people point to most, such as the em dash, ${H3.result === "supported" ? "did increase" : "did not increase"} in these departments' writing. A change in a word list describes style; it does not show who, or what, wrote any release.` },
  ],
  keyNumbers: [
    `${rose ? `UK government departments' press releases and news stories used ${rel(H1)}% more AI-associated words` : `UK government departments' press releases and news stories showed no clear rise in AI-associated words`} in 2024 to 2026 than the same departments' writing from 2019 to November 2022 (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words; ScriptGrain, 2026; ${H1.n} departments, pre-registered).`,
    `Em dashes in GOV.UK press releases and news stories went from ${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words between 2019 to 2022 and 2024 to 2026 within the same ${H3.n} departments (change ${ciIn(H3)}).`,
    `AI-associated words in GOV.UK press writing peaked in ${peak[0]} at ${f2(peak[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022 and ${f2(first[1].ai_ism_per1000)} in ${first[0]}.`,
    `The study measured ${n(C.kept)} GOV.UK press releases and news stories (${n(C.words_total)} words) from ${NDEPT} departments and ${n(C.other_bodies)} other bodies, first published between January 2015 and September 2026.`,
    `Average sentence length in GOV.UK press writing went from ${f1(H5.from_mean)} to ${f1(H5.to_mean)} words within the same departments after ChatGPT.`,
    ...(SG11 ? [`Within-organisation change in AI-associated words after ChatGPT: ${relS(H1)} in UK government departments (${H1.n}), ${SG11.H1.relative_pct > 0 ? "+" : ""}${SG11.H1.relative_pct}% in UK brands (${SG11.H1.brands}).`] : []),
  ],
  measures: [
    { term: "Before and after", definition: "Before: items first published from January 2019 to November 2022 (ChatGPT launched on 30 November 2022). After: January 2024 to September 2026. December 2022 to December 2023 is left out of the main test as a transition year and reported separately. The 2015 to 2018 items are used only to test whether the change is a continuing trend." },
    { term: "Within-department change", definition: "For each department and type of item (press release, or news story), the average after an item minus the average before; then averaged over departments, each counting once. A department is compared only with itself, so a shift in which departments publish cannot create a trend. Renamed and merged departments are joined into one lineage." },
    { term: "AI-associated words", definition: `Uses per 1,000 words of three published word lists, each occurrence counted once: the 2024 words studies of scientific writing found language models over-use (${listWords("OLD")}…), words publicly mocked as ChatGPT tells, and AI-era marketing words (${listWords("MARKETING")}…). The same measure as [SGR-007](/research/where-did-ai-isms-come-from) and [SGR-011](/research/did-brand-writing-change-after-chatgpt). A separate list of quieter words (${listWords("QUIET")}…) is reported on its own.` },
    { term: "AI sentence shapes", definition: "A fixed scan in code for 'not X but Y' balancing, reflexive lists of three, chains of semicolons and stock phrases, per 1,000 words." },
    { term: "Dates", definition: "The date GOV.UK shows as first published, in London time. The date of the last update is not used in the main test, because updating an old release would move it; a check using it is reported." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of departments. A hypothesis counts as supported only if the interval excludes zero in the predicted direction (for H5, if the 90% interval sits inside ±1.5 words)." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, eras, measures and tests were committed to the public repository before the full measurement, every result is reported whether it passed or failed, and the data and scripts are public.",
  notShown: [
    "That any release, or any department, used AI to write. Word counts show style; people used these words before ChatGPT and keep using them.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Why the writing changed. A new government and new ministers (July 2024), new staff and agencies, new GOV.UK guidance, the end of pandemic communications and more writing about AI itself could each move these numbers; this study measures the change, not its cause.",
    "Anything about speeches, written answers, local government or the output of agencies and regulators beyond the exploratory table.",
  ],
  productNote: "ScriptGrain measures writing voice, the habits that make a writer recognisable, and its free [AI cliché checker](/tools/ai-cliche-checker) runs the sentence-shape scan used here. This study is about how government press writing changed; it is not a test of who, or what, wrote any release.",
  sample: {
    description: `Every GOV.UK press release and news story first published from January 2015 to September 2026 that GOV.UK's Search API listed on ${date(C.index_taken_between[0].slice(0, 10))}${C.index_taken_between[1].slice(0, 10) !== C.index_taken_between[0].slice(0, 10) ? ` to ${date(C.index_taken_between[1].slice(0, 10))}` : ""}: ${n(C.indexed)} items listed, ${n(C.kept)} measured after exclusions, from ${NDEPT} departments and ${n(C.other_bodies)} other bodies. The confirmatory tests use the departments only; ${H1.cells} department-and-type pairs qualified. A census, not a sample.`,
    size: C.kept,
    inclusionCriteria: ["Document type press release or news story on GOV.UK", "First published between 1 January 2015 and 30 September 2026", "At least 150 words of text after contact details and notes to editors were removed", "At least 10 items before and 10 after in the same department and type, for the confirmatory tests"],
    exclusions: Object.entries(C.excluded).map(([k, v]) => `${n(v)} ${EXCL[k] ?? k.replace(/_/g, " ")}`),
  },
  method: [
    `Corpus: every item of document type press_release or news_story on GOV.UK, listed through the Search API by month and fetched through the Content API, at no more than four requests a second with an identified user agent. ${n(C.indexed)} items were listed; embassy stories (world_news_story) and every other document type are not included. Source: GOV.UK, Open Government Licence v3.0.`,
    "Departments: each item's primary publishing organisation. Twenty departments are analysed, with renamed, merged and split departments joined into one lineage (for example the Foreign and Commonwealth Office and the Department for International Development with the FCDO). Agencies, regulators and other bodies are analysed separately as exploratory.",
    "Text measured: the body of each item reduced to plain text, with tables, contact details and notes to editors removed; the title is not measured. Items under 150 words, exact duplicates within a department, withdrawn items, translations and items where more than 40% of the words sit in lines of six words or fewer were excluded.",
    "Measures: computed in code by ScriptGrain's own published instruments, the same as in the brand series. No language model read or scored any item.",
    "Pre-registration: the hypotheses, eras, exclusions and tests were committed to the public repository before the full measurement (docs/research/sgr-020-preregistration.md). The run was done once, on the day before publication.",
    "Tests: within-department change in department-weighted means, with 95% intervals from 2,000 bootstrap resamples of departments (fixed seed). H2 compares the per-year rate of change from 2015-18 to 2019-22 with that from 2019-22 to 2024-26, for cells with all three eras. H6 repeats H1 using only 1 January to 4 July 2024. Analyses beyond H1 to H6 are labelled exploratory.",
  ],
  variablesMeasured: ["AI-associated words per 1,000 words (and each word list)", "AI sentence shapes per 1,000 words", "Em dashes per 1,000 words", "Average sentence length", "Contractions per 1,000 words", '"You" share'],
  findings: [
    { label: `H1 (${verdict(H1.result).toLowerCase()}): AI-associated words ${rose ? "rose" : "did not rise beyond chance"} within the same departments`, value: `${ci(H1)} per 1,000 words, ${relS(H1)}`, explanation: `From ${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words across ${H1.n} departments. By word list: ${byListText}. Leaving out any one department, the change stays between ${sg(S.H1_leave_one_out.min)}${f2(Math.abs(S.H1_leave_one_out.min))} and ${sg(S.H1_leave_one_out.max)}${f2(Math.abs(S.H1_leave_one_out.max))}.` },
    { label: `H2 (${verdict(H2.result).toLowerCase()}): the change after ChatGPT ${H2.result === "supported" ? "was faster than" : "was not clearly different from"} the trend before`, value: `${f3(H2.late_to_after_per_year)} per 1,000 words a year after, against ${f3(H2.early_to_late_per_year)} a year from 2015-18 to 2019-22`, explanation: `For the ${H2.n} departments with pages in all three eras, the difference in yearly change (${ciIn(H2, 3)}) ${H2.result === "supported" ? "excludes zero" : "includes zero"}. These words were already moving in books and the web before ChatGPT, as [SGR-007](/research/where-did-ai-isms-come-from) found.` },
    { label: `H3 (${verdict(H3.result).toLowerCase()}): em dashes ${H3.result === "supported" ? "rose" : "did not rise"}`, value: `${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words; change ${ci(H3)}`, explanation: `Em dashes and spaced en dashes are counted together. ${H3.result === "supported" ? "Government writing used more dashes after ChatGPT." : "Despite the 'ChatGPT dash' reputation, these departments used dashes at a rate within chance of the earlier one."}` },
    { label: `H4 (${verdict(H4.result).toLowerCase()}): AI sentence shapes ${H4.result === "supported" ? "rose" : "did not rise"}`, value: `${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words; change ${ci(H4)}`, explanation: "'Not X but Y' constructions, reflexive lists of three, chains of semicolons and stock phrases, per 1,000 words." },
    { label: `H5 (${verdict(H5.result).toLowerCase()}): sentence length ${H5.result === "supported" ? "stayed within 1.5 words" : "moved by more than 1.5 words"}`, value: `${f1(H5.from_mean)} to ${f1(H5.to_mean)} words; change ${ci(H5, 2)}`, explanation: `The 90% interval (${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}) ${H5.result === "supported" ? "sits inside" : "does not sit inside"} ±1.5 words.` },
    { label: `H6 (${verdict(H6.result).toLowerCase()}): ${H6.result === "supported" ? "the rise was already there in the Conservative months of 2024" : "the Conservative months of 2024 alone do not show a clear rise"}`, value: `${ci(H6)} per 1,000 words (1 January to 4 July 2024 against 2019 to 2022)`, explanation: `${H6.n} departments qualified. 1 January to 4 July 2024 is six months and includes the election campaign, so ${H6.result === "supported" ? "the rise cannot be put down to the July 2024 change of government alone" : "this study cannot say whether the change of government or the time since ChatGPT explains the shift"}.` },
    { label: "Robustness and where the change sits", value: `H1 with TRANSITION counted as after ${ci(S.transitionAsAfter.ai_ism_per1000)}; items of 300+ words ${ci(S.longPages.ai_ism_per1000)}`, explanation: `Using the date of last update instead of first publication: ${ciIn(S.updatedDates.ai_ism_per1000)}. Press releases ${ciIn(S.byType.press_release.ai_ism_per1000)}; news stories ${ciIn(S.byType.news_story.ai_ism_per1000)}. Labour months (from 5 July 2024) against 2019 to 2022: ${ciIn(S.afterSplit.labour.ai_ism_per1000)}.` },
  ],
  sections: [
    { heading: "AI-associated words, year by year", paragraphs: ["Exploratory. Each year is the mean over departments with at least 5 pages that year; the pre-registered tests compare each department only with itself."], figure: { src: "/research/sgr-020-by-year.svg", alt: `Line chart of AI-associated words per 1,000 words in GOV.UK press releases and news stories by year, from ${f2(first[1].ai_ism_per1000)} in ${first[0]} to a peak of ${f2(peak[1].ai_ism_per1000)} in ${peak[0]} and ${f2(lastYear[1].ai_ism_per1000)} in ${lastYear[0]}.`, caption: "Source: ScriptGrain SGR-020, CC BY 4.0. Contains public sector information licensed under the Open Government Licence v3.0.", ...figDims("sgr-020-by-year.svg") } },
    { heading: "What changed, within the same departments", figure: { src: "/research/sgr-020-change.svg", alt: `Dot chart of within-department change from 2019-22 to 2024-26: AI-associated words ${relS(H1)}, em dashes ${relS(H3)}, AI sentence shapes ${relS(H4)}, average sentence length ${relS(H5)}, each with a 95% interval.`, caption: "Source: ScriptGrain SGR-020, CC BY 4.0.", ...figDims("sgr-020-change.svg") } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Change (95% interval)"], rows: [
      ["H1: AI-associated words rose", verdict(H1.result), `${ci(H1)} per 1,000 words`],
      ["H2: the change after ChatGPT was faster than the trend before it", verdict(H2.result), `${ci(H2, 3)} per 1,000 words a year`],
      ["H3: em dashes rose", verdict(H3.result), `${ci(H3)} per 1,000 words`],
      ["H4: AI sentence shapes rose", verdict(H4.result), `${ci(H4)} per 1,000 words`],
      ["H5: average sentence length changed by less than 1.5 words", verdict(H5.result), `${ci(H5)} words; 90% interval ${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}`],
      ["H6: AI-associated words were already higher in January to July 2024", verdict(H6.result), `${ci(H6)} per 1,000 words`],
    ] } },
    { heading: "Department by department", paragraphs: ["Exploratory. Mean AI-associated words per 1,000 words in each period, all item types pooled; a figure appears only where the department has at least 10 items in the period.", ], figure: (() => { try { return { src: "/research/sgr-020-departments.svg", alt: "Dot plot of AI-associated words per 1,000 words in each department, 2019 to November 2022 against 2024 to September 2026, sorted by change.", caption: "Source: ScriptGrain SGR-020, CC BY 4.0.", ...figDims("sgr-020-departments.svg") }; } catch { return undefined; } })(),
      table: { columns: ["Department", "Items 2015-18", "2019-22", "2024-26", "AI-associated words 2019-22", "2024-26"], rows: S.units.map((u) => [u.name, n(u.EARLY), n(u.LATE), n(u.AFTER), u.LATE >= 10 ? f2(u.ai_ism_per1000_late) : "n/a", u.AFTER >= 10 ? f2(u.ai_ism_per1000_after) : "n/a"]) } },
    { heading: "By word list and habit", paragraphs: ["Within-department change from 2019-22 to 2024-26, same departments as H1."], table: { columns: ["Measure", "Before", "After", "Change (95% interval)"], rows: [["AI-associated words (H1)", "ai_ism_per1000", 2], ["AI-era marketing words", "marketing_per1000", 2], ["Quieter LLM-favoured words", "quiet_per1000", 2], ["2024 tells (delve and others)", "old_per1000", 2], ["Publicly mocked ChatGPT words", "called_out_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 1], ["Contractions", "contractions_per1000", 1], ['"You" share', "you_share", 2], ['"We" share', "we_share", 2], ["Sentence-length variation", "sentence_variation", 2]].map(([l, k, d]) => { const h = CONF[k] ?? AM[k]; return [l, f2(h.from_mean), f2(h.to_mean), ci(h, d)]; }) } },
    { heading: "Press releases and news stories separately", table: { columns: ["Measure", "Press releases (95% interval)", "News stories (95% interval)"], rows: [["AI-associated words", "ai_ism_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 2]].map(([l, k, d]) => [l, `${ci(S.byType.press_release[k], d)} (${S.byType.press_release[k].n} departments)`, `${ci(S.byType.news_story[k], d)} (${S.byType.news_story[k].n} departments)`]) } },
    { heading: "Checks on the dating and the government", paragraphs: ["Exploratory robustness checks, each repeating the main comparison with one change. Conservative months: 1 January to 4 July 2024. Labour months: from 5 July 2024."], table: { columns: ["Check", "AI-associated words (95% interval)", "Em dashes (95% interval)", "Departments"], rows: [
      ["Main test (H1, H3)", ci(H1), ci(H3), String(H1.n)],
      ["Items of 300 words or more", ci(S.longPages.ai_ism_per1000), ci(S.longPages.em_dash_per1000), String(S.longPages.ai_ism_per1000.n)],
      ["Transition year counted as after", ci(S.transitionAsAfter.ai_ism_per1000), ci(S.transitionAsAfter.em_dash_per1000), String(S.transitionAsAfter.ai_ism_per1000.n)],
      ["Date of last update instead of first publication", ci(S.updatedDates.ai_ism_per1000), ci(S.updatedDates.em_dash_per1000), String(S.updatedDates.ai_ism_per1000.n)],
      ["Without DSIT (created 2023 from parts of BEIS and DCMS)", ci(S.withoutDsit.ai_ism_per1000), ci(S.withoutDsit.em_dash_per1000), String(S.withoutDsit.ai_ism_per1000.n)],
      ["Conservative months of 2024 only (H6)", ci(H6), ci(S.afterSplit.conservative.em_dash_per1000), String(S.afterSplit.conservative.ai_ism_per1000.n)],
      ["Labour months only", ci(S.afterSplit.labour.ai_ism_per1000), ci(S.afterSplit.labour.em_dash_per1000), String(S.afterSplit.labour.ai_ism_per1000.n)],
    ] } },
    { heading: "Agencies, regulators and other bodies", paragraphs: [`Exploratory. The same comparison for the ${n(C.other_bodies)} organisations outside the twenty departments (${n(S.otherBodies_pages)} items), each organisation counting once.`], table: { columns: ["Measure", "Before", "After", "Change (95% interval)", "Organisations"], rows: [["AI-associated words", "ai_ism_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 2]].map(([l, k, d]) => [l, f2(S.otherBodies[k].from_mean), f2(S.otherBodies[k].to_mean), S.otherBodies[k].lo == null ? "not enough organisations" : ci(S.otherBodies[k], d), String(S.otherBodies[k].n)]) } },
    { heading: "Year by year", paragraphs: ["Exploratory; department-weighted means over the departments with at least 5 items each year."], table: { columns: ["Year", "Items", "Departments", "AI-associated words", "Em dashes", "AI sentence shapes", "Words per sentence"], rows: Object.entries(Y).map(([y, v]) => [y, n(v.pages), String(v.departments), v.ai_ism_per1000 == null ? "n/a" : f2(v.ai_ism_per1000), v.em_dash_per1000 == null ? "n/a" : f2(v.em_dash_per1000), v.ai_shape_per1000 == null ? "n/a" : f2(v.ai_shape_per1000), v.avg_sentence_length == null ? "n/a" : f1(v.avg_sentence_length)]) } },
  ].map((s) => (s.figure === undefined ? (({ figure, ...rest }) => rest)(s) : s)),
  limitations: [
    "The Content API serves each item as it reads now. Corrected or edited old releases are measured as edited; the dating check using the last-update date shows how much that matters.",
    "Ministers' quotations, shared boilerplate and lists of facts sit inside many releases and are measured with the rest; the press office's own prose cannot be separated from them.",
    "Word lists count spellings. These words rose in human writing for decades before ChatGPT, and topics shifted too: government now writes more about AI itself.",
    "Renamed and merged departments are joined into lineages by judgement. The business, energy, trade and science lineage mixes departments that did different work, and some work moved between departments in 2023.",
    "The 2020 and 2021 pandemic communications are inside the before period and changed what departments wrote; departments, not items, are weighted equally so the volume does not dominate.",
    "The Conservative-months check covers six months including an election campaign, so it is a weak test of whether the change of government explains the shift.",
    "UK central government only, in English, and only press releases and news stories.",
  ],
  reproducibility: [
    "Pre-registration and scripts: docs/research/sgr-020-preregistration.md and scripts/experiments/sgr-020/ in the ScriptGrain repository (collect.mjs fetches the corpus, run.mjs measures and analyses it, write-entry.mjs builds this page from the summary).",
    "Every item is named by its GOV.UK path in the data, so any release can be re-read on GOV.UK and measured again.",
  ],
  dataDownloads: [
    { label: "Every item measured: path, department, type, date, era and every measure (CSV)", path: "/research/sgr-020-pages.csv", format: "csv" },
    { label: "Department by period: item counts and mean of every measure (CSV)", path: "/research/sgr-020-departments.csv", format: "csv" },
    { label: "Year by year: department-weighted means (CSV)", path: "/research/sgr-020-by-year.csv", format: "csv" },
    { label: "Summary: hypotheses, intervals, robustness checks, exclusions (JSON)", path: "/research/sgr-020-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-020, conducted ${date(CONDUCTED)}). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "GOV.UK Search API and Content API. Contains public sector information licensed under the Open Government Licence v3.0", url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" },
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
console.error(`SGR-020 ${i === -1 ? "added" : "updated"}; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
