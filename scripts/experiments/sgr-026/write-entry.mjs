#!/usr/bin/env bun
// SGR-026: write the study entry in src/data/research-pages.json from the run's summary, so every
// number on the page is the run's number and nothing is typed by hand.
//
//   bun scripts/experiments/sgr-026/write-entry.mjs --conducted-on 2026-11-05 --publish-on 2026-11-06
//
// Guards: conductedOn must equal the day run.mjs ran (summary.ranOn) and publishOn must be the next
// day, and a pilot summary is refused. (--allow-pilot exists only for testing the builder; never commit its output.)
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CONDUCTED = opt("--conducted-on", null), PUBLISH_ON = opt("--publish-on", null);
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const SUMMARY = opt("--summary", "public/research/sgr-026-summary.json");
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
const ci = (h, d = 2) => h.lo == null ? "not enough data" : `${sg(h.point)}${n(Math.abs(h.point), d)} (95% interval ${num(h.lo, d)} to ${num(h.hi, d)})`;
const ciIn = (h, d = 2) => h.lo == null ? "not enough data" : `${sg(h.point)}${n(Math.abs(h.point), d)}, 95% interval ${num(h.lo, d)} to ${num(h.hi, d)}`;
const rel = (h) => (h.from_mean ? Math.round((100 * h.point) / h.from_mean) : 0);
const relS = (h) => `${sg(rel(h))}${Math.abs(rel(h))}%`;
const clears = (h) => h.lo != null && (h.lo > 0 || h.hi < 0);
const verdict = (v) => (v === "supported" ? "Supported" : "Not supported");
const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pct = (x, d = 1) => `${n(100 * x, d)}%`;
const WHOLE = new Set(["seamless", "elevate", "unlock", "empower", "streamline", "supercharge", "unleash", "effortless", "comprehensive", "significant", "harness", "embark", "delve", "intricate", "meticulous"]);
const listWords = (k) => LEX[k].map((w) => (w.endsWith("*") ? (WHOLE.has(w.slice(0, -1)) ? w.slice(0, -1) : null) : w)).filter(Boolean).slice(0, 8).map((w) => `"${w}"`).join(", ");
const figDims = (file) => { const m = readFileSync(`${FIG}/${file}`, "utf8").match(/viewBox="0 0 (\d+) (\d+)"/); return { width: +m[1], height: +m[2] }; };
const hasFig = (file) => { try { figDims(file); return true; } catch { return false; } };

const { H1, H2, H3, H4, H5, H6, allMeasures: AM, byYear: Y, corpus: C, trendControl: TC } = S;
const SLUG = "are-new-wikipedia-articles-written-differently-since-chatgpt";
const TITLE = `Are new Wikipedia articles written differently since ChatGPT? ${n(C.kept)} first revisions of new English Wikipedia articles, 2015 to 2026`;
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const yrs = Object.entries(Y).filter(([, v]) => v.ai_ism_per1000 != null);
const peak = yrs.filter(([y]) => +y >= 2023).reduce((a, b) => (b[1].ai_ism_per1000 > a[1].ai_ism_per1000 ? b : a), yrs.at(-1));
const lastYear = yrs.at(-1), first = yrs[0];
const pre = ["2019", "2020", "2021", "2022"].map((y) => Y[y]?.ai_ism_per1000).filter((x) => x != null);
const preMean = pre.reduce((a, b) => a + b, 0) / pre.length;
const rose = H1.result === "supported";
const SG11 = S.sgr011, SG20 = S.sgr020;
const monthsTotal = C.months_sampled;
const delY = S.deletions.by_year;
const delYears = Object.entries(delY).filter(([, v]) => v.share != null && v.entries >= 100);
const delFirst = delYears.find(([y]) => y === "2019") ?? delYears[0], delLast = delYears.at(-1);
const lenYear = (y) => Y[y]?.median_words;

// which AI-word lists moved, by their own intervals
const LISTS = [["marketing_per1000", "AI-era marketing words"], ["quiet_per1000", "the quieter LLM-favoured words"], ["old_per1000", "the 2024 tells such as \"delve\""], ["called_out_per1000", "the publicly mocked ChatGPT words"]];
const movedUp = LISTS.filter(([k]) => AM[k].lo > 0), movedFlat = LISTS.filter(([k]) => !(AM[k].lo > 0));
const listNames = (xs) => xs.map(([, l]) => l).join(", ").replace(/, ([^,]*)$/, " and $1");
const byListText = LISTS.map(([k, l]) => `${l} ${relS(AM[k])}${clears(AM[k]) ? " (interval clears zero)" : " (within chance)"}`).join("; ");

const statements = {
  h1: rose
    ? `AI-associated words rose ${rel(H1)}% between the first revisions of articles created in 2019 to November 2022 and in 2024 to September 2026 (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words).`
    : `AI-associated words did not rise beyond chance (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words, ${relS(H1)}).`,
  dash: H3.result === "supported" ? `Em dashes rose (${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words).` : `Em dashes did not rise beyond chance (${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words).`,
  shape: H4.result === "supported" ? `AI-style sentence shapes rose (${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words).` : `AI-style sentence shapes did not rise beyond chance (${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words).`,
  len: H5.result === "supported" ? `Average sentence length stayed within 1.5 words (${f1(H5.from_mean)} to ${f1(H5.to_mean)}).` : `Average sentence length moved by more than the 1.5 words we allowed for (${f1(H5.from_mean)} to ${f1(H5.to_mean)}).`,
};
const vsOthers = [
  SG11 ? `the same measure rose ${SG11.H1.relative_pct}% within ${SG11.H1.brands} UK brands' blogs and press releases (SGR-011)` : null,
  SG20 ? `${SG20.H1.relative_pct > 0 ? "rose" : "changed by"} ${SG20.H1.relative_pct}% within ${SG20.H1.departments} UK government departments (SGR-020)` : null,
].filter(Boolean);
const vsText = vsOthers.length ? `For comparison, ${vsOthers.join(", and ")}; in new Wikipedia articles the change was ${relS(H1)}.` : "";
const timeText = (h) => (h.lo == null ? "not enough data" : `${f2(h.from_mean)} to ${f2(h.to_mean)}`);

const study = {
  id: "SGR-026",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Are new Wikipedia articles written differently since ChatGPT? ${n(C.kept)} first revisions measured · ScriptGrain Research`,
  question: "Do the first revisions of English Wikipedia articles created after ChatGPT use more of the words and habits associated with AI writing than those created before it?",
  conductedOn: CONDUCTED,
  publishOn: PUBLISH_ON,
  description: `A pre-registered before-and-after study of ${n(C.kept)} first revisions of new English Wikipedia articles, sampled by month from 2015 to September 2026. Articles created in 2019 to November 2022 are compared with those created from 2024. ${rose ? `AI-associated words rose ${rel(H1)}%` : "AI-associated words did not clearly rise"}; ${H3.result === "supported" ? "em dashes rose" : "em dashes did not"}. Only articles that survive today are visible. Numbers only, CC BY 4.0; Wikipedia credited.`,
  abstract: [
    { label: "Background", text: "Wikipedia has its own list of the signs of AI writing and a volunteer project, WikiProject AI Cleanup, that finds and removes AI-generated text; it also lets administrators delete pages that are unambiguously machine-generated. Whether new articles read differently since ChatGPT can be measured, because every revision of every article is public, dated and attributed. What that measurement cannot see is the part of the story the project exists to remove: pages that were deleted." },
    { label: "What we did", text: `We fixed six hypotheses before the full measurement, copying the design of our studies of UK brands (SGR-011) and UK government (SGR-020). We drew random page IDs for each of ${monthsTotal} months from January 2015 to September 2026 (Wikipedia hands page IDs out in creation order), kept those that are articles today (not redirects, not disambiguation pages), read each one's first revision through the MediaWiki API and reduced its wikitext to plain prose. ${n(C.articles_sampled)} articles were sampled and ${n(C.kept)} first revisions of 150 words or more were measured in code. Each month counts once: ${H1.months_from} months in 2019 to November 2022 against ${H1.months_to} months from 2024.` },
    { label: "What we found", text: `${statements.h1} ${movedUp.length ? `The words that moved were ${listNames(movedUp)}${movedFlat.length ? `; ${listNames(movedFlat)} did not move beyond chance` : ""}.` : "None of the four word lists moved beyond chance on its own."} ${statements.dash} ${statements.shape} ${statements.len} By calendar year the words peaked in ${peak[0]} at ${f2(peak[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022, and stood at ${f2(lastYear[1].ai_ism_per1000)} in ${lastYear[0]}. ${H6.result === "supported" ? "The rise is also there among articles created directly in the article namespace, not only among drafts moved in after review." : "Among articles created directly in the article namespace, the change was within chance, so the rise cannot be put down to those pages alone."} ${vsText}` },
    { label: "What it means", text: `${rose ? "New Wikipedia articles' first revisions shifted in vocabulary after ChatGPT" : "New Wikipedia articles' first revisions did not clearly shift in the words people associate with AI"}, ${H2.result === "supported" ? "faster than the trend that was already under way" : "and nothing here shows a break from the trend before 2022"}. This is a measurement of articles that survive: pages Wikipedia's editors deleted are not in the data, and ${delLast ? `the share of new article-namespace pages deleted was ${pct(delLast[1].share)} in ${delLast[0]}` : "the deletion share could not be measured"}. A change in a word list describes style; it does not show who, or what, wrote any article.` },
  ],
  keyNumbers: [
    `${rose ? `First revisions of new English Wikipedia articles used ${rel(H1)}% more AI-associated words` : `First revisions of new English Wikipedia articles showed no clear rise in AI-associated words`} in 2024 to September 2026 than in 2019 to November 2022 (${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words; ScriptGrain, 2026; ${H1.months_from} and ${H1.months_to} monthly samples, pre-registered).`,
    `Em dashes in new English Wikipedia articles' first revisions went from ${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words between 2019 to 2022 and 2024 to 2026 (change ${ciIn(H3)}).`,
    `AI-associated words in new Wikipedia articles peaked in ${peak[0]} at ${f2(peak[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022 and ${f2(first[1].ai_ism_per1000)} in ${first[0]}.`,
    `The study measured ${n(C.kept)} first revisions (${n(C.words_total)} words) of English Wikipedia articles created between January 2015 and September 2026, ${n(C.articles_sampled)} sampled across ${monthsTotal} months.`,
    ...(delLast && delFirst ? [`Of new article-namespace pages in Wikipedia's creation log, ${pct(delFirst[1].share)} created in ${delFirst[0]} and ${pct(delLast[1].share)} created in ${delLast[0]} had been deleted by October 2026 (ScriptGrain, 2026; sampled).`] : []),
    ...(vsOthers.length ? [`Change in AI-associated words after ChatGPT: ${relS(H1)} in new Wikipedia articles${SG20 ? `, ${SG20.H1.relative_pct > 0 ? "+" : ""}${SG20.H1.relative_pct}% in UK government departments` : ""}${SG11 ? `, ${SG11.H1.relative_pct > 0 ? "+" : ""}${SG11.H1.relative_pct}% in UK brands` : ""}.`] : []),
  ],
  measures: [
    { term: "Before and after", definition: "Before: articles whose first revision was made from January 2019 to November 2022 (ChatGPT launched on 30 November 2022). After: January 2024 to September 2026. December 2022 to December 2023 is left out of the main test as a transition year and reported separately. The 2015 to 2018 articles are used only to test whether the change is a continuing trend." },
    { term: "First revision", definition: "The first edit ever saved to the page, as it stood at that moment. It is not the article as it reads today. For a draft that was written elsewhere and moved into the article namespace, the first revision is the first draft, and the date is the date of that first edit; the study reports those pages separately." },
    { term: "Month as the unit", definition: "Each month's value is the mean over its measured articles, and each month counts once. The change is the mean of the later period's months minus the mean of the earlier period's months. The 95% interval resamples months with replacement, 2,000 times, so it reflects how much months differ from each other, including trends inside a period." },
    { term: "AI-associated words", definition: `Uses per 1,000 words of three published word lists, each occurrence counted once: the 2024 words studies of scientific writing found language models over-use (${listWords("OLD")}…), words publicly mocked as ChatGPT tells, and AI-era marketing words (${listWords("MARKETING")}…). The same measure as [SGR-007](/research/where-did-ai-isms-come-from) and [SGR-011](/research/did-brand-writing-change-after-chatgpt). A separate list of quieter words (${listWords("QUIET")}…) is reported on its own. These lists are ScriptGrain's, frozen before this study; they are not Wikipedia's.` },
    { term: "AI sentence shapes", definition: "The free [AI cliché checker](/tools/ai-cliche-checker)'s scan for 'not X but Y' balancing, reflexive lists of three, chains of semicolons and stock phrases, per 1,000 words." },
    { term: "Plain prose from wikitext", definition: "Templates (including infoboxes and citation templates), references, tables, files, categories, interlanguage links, headings and the non-prose sections (see also, references, external links, further reading, notes, sources and similar) are removed. Links keep their visible label; bold, italics and external-link markup go; what is left is the running text." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of months. A hypothesis counts as supported only if the interval excludes zero in the predicted direction (for H5, if the 90% interval sits inside ±1.5 words)." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, eras, measures and tests were committed to the public repository before the full measurement, every result is reported whether it passed or failed, and the data and scripts are public.",
  notShown: [
    "That any article used AI to write. Word counts show style; people used these words before ChatGPT and keep using them, and Wikipedia's own list of signs of AI writing says that not all text showing its signs is AI-generated.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "What Wikipedia's editors removed. Articles deleted before today, including machine-generated pages removed under the speedy-deletion rules, are not in the data, so the later period is the survivors of Wikipedia's cleanup, not everything that was submitted.",
    "Why the writing changed. Different editors, the draft-review process, new notability and sourcing rules, a change of subject mix and more writing about AI itself could each move these numbers; this study measures the change, not its cause.",
    "Anything about how articles read after later edits, other language editions, or articles in the draft and user namespaces.",
  ],
  productNote: "ScriptGrain measures writing voice, the habits that make a writer recognisable, and its free [AI cliché checker](/tools/ai-cliche-checker) runs the sentence-shape scan used here. This study is about how new Wikipedia articles changed; it is not a test of who, or what, wrote any article.",
  sample: {
    description: `${n(C.articles_sampled)} English Wikipedia articles sampled from the page-ID intervals of ${monthsTotal} months (January 2015 to September 2026), read on ${date(C.index_taken_between[0].slice(0, 10))}${C.index_taken_between[1].slice(0, 10) !== C.index_taken_between[0].slice(0, 10) ? ` to ${date(C.index_taken_between[1].slice(0, 10))}` : ""}. Up to 120 articles a month were drawn at random from the pages that exist today as articles; ${n(C.kept)} first revisions had 150 words or more and passed the other exclusions. The population is articles that survive, not everything created.`,
    size: C.kept,
    inclusionCriteria: ["A page that is an article today (article namespace, not a redirect, not a disambiguation page)", "First revision made between 1 January 2015 and 30 September 2026", "At least 150 words of running text after markup, references and non-prose sections were removed", "Not created by an account that is a registered bot today", "At least 15 measured articles in a month for the month to enter a test"],
    exclusions: Object.entries(C.excluded).map(([k, v]) => `${n(v)} ${k.replace(/_/g, " ")}`).concat([`${n(C.bot_created_set_aside)} created by bot accounts (set aside, reported separately)`]),
  },
  method: [
    `Frame: Wikipedia assigns each page an ID in the order it is created, so the pages created in a month are an interval of IDs. We located each month's interval by binary search on the creation time of the first revision. For each month, random IDs from its interval were drawn with a fixed seed, 50 at a time, and kept if the page is an article in the article namespace today, is not a redirect and is not a disambiguation page, until 120 had been found (or a ceiling of draws was reached). The MediaWiki Action API (en.wikipedia.org/w/api.php) was queried one request at a time with maxlag=5 and an identified user agent.`,
    "Text: for each sampled page the first revision's wikitext was fetched and the page's first 50 revisions' edit summaries were read to see whether it was moved into the article namespace from a draft or user page. The wikitext was reduced to plain prose by a documented cleaner that was tested before the full run. Articles under 150 words, exact duplicates within a month, pages whose first revision was a redirect, pages created by bot accounts, and pages where more than 40% of the words sit in lines of six words or fewer were excluded.",
    "Measures: computed in code by ScriptGrain's own instruments, the same counts the free tools run, and the same as in the brand and government series. No language model read or scored any article.",
    "Pre-registration: the hypotheses, eras, exclusions and tests were committed to the public repository before the full measurement (docs/research/sgr-026-preregistration.md). The run was done once, on the day before publication.",
    "Tests: change in month-weighted means, with 95% intervals from 2,000 bootstrap resamples of months (fixed seed). H2 compares the per-year rate of change from 2015-18 to 2019-22 with that from 2019-22 to 2024-26. H6 repeats H1 using only articles created directly in the article namespace. Analyses beyond H1 to H6 are labelled exploratory.",
    "Deletions: the page-creation log in the article namespace starts in mid-2018. In eight random windows a month, each with up to 250 entries, we counted the entries whose page has since been deleted. This is exploratory and describes pages, not their text.",
  ],
  variablesMeasured: ["AI-associated words per 1,000 words (and each word list)", "AI sentence shapes per 1,000 words", "Em dashes per 1,000 words", "Average sentence length", "Contractions per 1,000 words", '"You" share'],
  findings: [
    { label: `H1 (${verdict(H1.result).toLowerCase()}): AI-associated words ${rose ? "rose" : "did not rise beyond chance"} in new articles' first revisions`, value: `${ci(H1)} per 1,000 words, ${relS(H1)}`, explanation: `From ${f2(H1.from_mean)} to ${f2(H1.to_mean)} per 1,000 words (${n(H1.articles_from)} articles in ${H1.months_from} months, then ${n(H1.articles_to)} in ${H1.months_to} months). By word list: ${byListText}. Leaving out any one month, the change stays between ${sg(S.H1_leave_one_month_out?.min)}${f2(Math.abs(S.H1_leave_one_month_out?.min ?? 0))} and ${sg(S.H1_leave_one_month_out?.max)}${f2(Math.abs(S.H1_leave_one_month_out?.max ?? 0))}.` },
    { label: `H2 (${verdict(H2.result).toLowerCase()}): the change after ChatGPT ${H2.result === "supported" ? "was faster than" : "was not clearly different from"} the trend before`, value: `${f3(H2.late_to_after_per_year)} per 1,000 words a year after, against ${f3(H2.early_to_late_per_year)} a year from 2015-18 to 2019-22`, explanation: `The difference in yearly change (${ciIn(H2, 3)}) ${H2.result === "supported" ? "excludes zero" : "includes zero"}. These words were already moving in books and the web before ChatGPT, as [SGR-007](/research/where-did-ai-isms-come-from) found. From 2015-18 to 2019-22 the change was ${ci(TC.ai_ism_per1000)}.` },
    { label: `H3 (${verdict(H3.result).toLowerCase()}): em dashes ${H3.result === "supported" ? "rose" : "did not rise"}`, value: `${f2(H3.from_mean)} to ${f2(H3.to_mean)} per 1,000 words; change ${ci(H3)}`, explanation: `Em dashes and spaced en dashes are counted together. ${H3.result === "supported" ? "New articles used more dashes after ChatGPT." : "Despite the 'ChatGPT dash' reputation, new articles' first revisions used dashes at a rate within chance of the earlier one."}` },
    { label: `H4 (${verdict(H4.result).toLowerCase()}): AI sentence shapes ${H4.result === "supported" ? "rose" : "did not rise"}`, value: `${f2(H4.from_mean)} to ${f2(H4.to_mean)} per 1,000 words; change ${ci(H4)}`, explanation: "'Not X but Y' constructions, reflexive lists of three and the cliché checker's stock phrases, per 1,000 words." },
    { label: `H5 (${verdict(H5.result).toLowerCase()}): sentence length ${H5.result === "supported" ? "stayed within 1.5 words" : "moved by more than 1.5 words"}`, value: `${f1(H5.from_mean)} to ${f1(H5.to_mean)} words; change ${ci(H5, 2)}`, explanation: `The 90% interval (${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}) ${H5.result === "supported" ? "sits inside" : "does not sit inside"} ±1.5 words.` },
    { label: `H6 (${verdict(H6.result).toLowerCase()}): ${H6.result === "supported" ? "the rise is also there in articles created directly in the article namespace" : "articles created directly in the article namespace alone do not show a clear rise"}`, value: `${ci(H6)} per 1,000 words (${H6.months_from} and ${H6.months_to} months)`, explanation: `Articles with no sign of having been moved in from a draft or user page. Moved-in pages (${S.movedIn.ai_ism_per1000.lo == null ? "too few months to test" : ciIn(S.movedIn.ai_ism_per1000)}) are reported separately.` },
    { label: "Robustness", value: `H1 with the transition year counted as after ${ci(S.transitionAsAfter.ai_ism_per1000)}; articles of 300+ words ${ci(S.longArticles.ai_ism_per1000)}`, explanation: `Articles of 150 to 600 words ${ciIn(S.midLength.ai_ism_per1000)}. Without content-translation articles ${ciIn(S.noTranslations.ai_ism_per1000)}. Including bot-created pages ${ciIn(S.withBots.ai_ism_per1000)}. Registered accounts only ${ciIn(S.registeredOnly.ai_ism_per1000)}.` },
    ...(delFirst && delLast ? [{ label: "Deletions: what the surviving articles leave out", value: `${pct(delFirst[1].share)} of new article-namespace pages from ${delFirst[0]} and ${pct(delLast[1].share)} from ${delLast[0]} have since been deleted`, explanation: "From the page-creation log, sampled in eight windows a month. The denominator includes redirects and pages created and then moved. A deleted page is gone from the data whether it was spam, a copyright problem, a test or machine-generated, and the log does not say which." }] : []),
  ],
  sections: [
    ...(hasFig("sgr-026-by-quarter.svg") ? [{ heading: "AI-associated words, quarter by quarter", paragraphs: ["Exploratory. Each point is the mean of the monthly means in a quarter (months with at least 15 measured articles); the pre-registered tests compare periods of months."], figure: { src: "/research/sgr-026-by-quarter.svg", alt: `Line chart of AI-associated words per 1,000 words in first revisions of new English Wikipedia articles by quarter, from ${f2(first[1].ai_ism_per1000)} in ${first[0]} to a peak of ${f2(peak[1].ai_ism_per1000)} in ${peak[0]} and ${f2(lastYear[1].ai_ism_per1000)} in ${lastYear[0]}.`, caption: "Source: ScriptGrain SGR-026, CC BY 4.0. Article text from Wikipedia is licensed CC BY-SA 4.0 and is not reproduced here; only counts are.", ...figDims("sgr-026-by-quarter.svg") } }] : []),
    ...(hasFig("sgr-026-change.svg") ? [{ heading: "What changed after ChatGPT", figure: { src: "/research/sgr-026-change.svg", alt: `Dot chart of change from 2019-22 to 2024-26 in first revisions of new Wikipedia articles: AI-associated words ${relS(H1)}, em dashes ${relS(H3)}, AI sentence shapes ${relS(H4)}, average sentence length ${relS(H5)}, each with a 95% interval.`, caption: "Source: ScriptGrain SGR-026, CC BY 4.0.", ...figDims("sgr-026-change.svg") } }] : []),
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Change (95% interval)"], rows: [
      ["H1: AI-associated words rose", verdict(H1.result), `${ci(H1)} per 1,000 words`],
      ["H2: the change after ChatGPT was faster than the trend before it", verdict(H2.result), `${ci(H2, 3)} per 1,000 words a year`],
      ["H3: em dashes rose", verdict(H3.result), `${ci(H3)} per 1,000 words`],
      ["H4: AI sentence shapes rose", verdict(H4.result), `${ci(H4)} per 1,000 words`],
      ["H5: average sentence length changed by less than 1.5 words", verdict(H5.result), `${ci(H5)} words; 90% interval ${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}`],
      ["H6: the rise is also there in articles created directly in the article namespace", verdict(H6.result), `${ci(H6)} per 1,000 words`],
    ] } },
    { heading: "By word list and habit", paragraphs: ["Change from 2019-22 to 2024-26, month-weighted, same articles as H1."], table: { columns: ["Measure", "Before", "After", "Change (95% interval)"], rows: [["AI-associated words (H1)", "ai_ism_per1000", 2], ["AI-era marketing words", "marketing_per1000", 2], ["Quieter LLM-favoured words", "quiet_per1000", 2], ["2024 tells (delve and others)", "old_per1000", 2], ["Publicly mocked ChatGPT words", "called_out_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 1], ["Contractions", "contractions_per1000", 1], ['"You" share', "you_share", 2], ['"We" share', "we_share", 2], ["Sentence-length variation", "sentence_variation", 2]].map(([l, k, d]) => [l, f2(AM[k].from_mean), f2(AM[k].to_mean), ci(AM[k], d)]) } },
    { heading: "Who made the page, and how long it was", paragraphs: ["Exploratory. The same comparison for subsets of articles, one change at a time; the composition of new articles changed between the periods, so these checks matter."], table: { columns: ["Subset", "AI-associated words (95% interval)", "Em dashes (95% interval)", "Months before / after"], rows: [
      ["All measured articles (H1, H3)", ci(H1), ci(H3), `${H1.months_from} / ${H1.months_to}`],
      ["Created directly in the article namespace (H6)", ci(H6), ci(S.directOnly.em_dash_per1000), `${H6.months_from} / ${H6.months_to}`],
      ["Moved in from a draft or user page", ci(S.movedIn.ai_ism_per1000), ci(S.movedIn.em_dash_per1000), `${S.movedIn.ai_ism_per1000.months_from} / ${S.movedIn.ai_ism_per1000.months_to}`],
      ["Registered accounts only", ci(S.registeredOnly.ai_ism_per1000), ci(S.registeredOnly.em_dash_per1000), `${S.registeredOnly.ai_ism_per1000.months_from} / ${S.registeredOnly.ai_ism_per1000.months_to}`],
      ["Articles of 300 words or more", ci(S.longArticles.ai_ism_per1000), ci(S.longArticles.em_dash_per1000), `${S.longArticles.ai_ism_per1000.months_from} / ${S.longArticles.ai_ism_per1000.months_to}`],
      ["Articles of 150 to 600 words", ci(S.midLength.ai_ism_per1000), ci(S.midLength.em_dash_per1000), `${S.midLength.ai_ism_per1000.months_from} / ${S.midLength.ai_ism_per1000.months_to}`],
      ["Without content-translation articles", ci(S.noTranslations.ai_ism_per1000), ci(S.noTranslations.em_dash_per1000), `${S.noTranslations.ai_ism_per1000.months_from} / ${S.noTranslations.ai_ism_per1000.months_to}`],
      ["Transition year counted as after", ci(S.transitionAsAfter.ai_ism_per1000), ci(S.transitionAsAfter.em_dash_per1000), `${S.transitionAsAfter.ai_ism_per1000.months_from} / ${S.transitionAsAfter.ai_ism_per1000.months_to}`],
      ["Including bot-created pages", ci(S.withBots.ai_ism_per1000), ci(S.withBots.em_dash_per1000), `${S.withBots.ai_ism_per1000.months_from} / ${S.withBots.ai_ism_per1000.months_to}`],
    ] } },
    ...(hasFig("sgr-026-deleted.svg") ? [{ heading: "What the survivors leave out: deleted pages", paragraphs: ["Exploratory. Share of new article-namespace pages in Wikipedia's page-creation log, from mid-2018, whose page has since been deleted. Pages that were deleted and recreated count as present. The denominator is every page created in the article namespace, including redirects, which is why it is much larger than the articles this study measures."], figure: { src: "/research/sgr-026-deleted.svg", alt: "Line chart of the share of new article-namespace pages that have since been deleted, by quarter of creation, from 2018 to 2026.", caption: "Source: ScriptGrain SGR-026 from the Wikipedia page-creation log, CC BY 4.0.", ...figDims("sgr-026-deleted.svg") } }] : []),
    { heading: "Year by year", paragraphs: ["Exploratory; the mean of monthly means, months with at least 15 measured articles. Median words is the median length of the plain-prose first revision."], table: { columns: ["Year", "Articles", "Months", "Median words", "Created directly", "AI-associated words", "Em dashes", "AI sentence shapes", "Words per sentence", "New pages since deleted"], rows: Object.entries(Y).map(([y, v]) => [y, n(v.articles), String(v.months), v.median_words == null ? "n/a" : n(v.median_words), v.direct_share == null ? "n/a" : pct(v.direct_share, 0), v.ai_ism_per1000 == null ? "n/a" : f2(v.ai_ism_per1000), v.em_dash_per1000 == null ? "n/a" : f2(v.em_dash_per1000), v.ai_shape_per1000 == null ? "n/a" : f2(v.ai_shape_per1000), v.avg_sentence_length == null ? "n/a" : f1(v.avg_sentence_length), delY[y]?.share == null || delY[y].entries < 100 ? "n/a" : pct(delY[y].share)]) } },
    { heading: "The sampling frame", paragraphs: ["Of the random page IDs drawn in each year, the share that turned out to be an article today. The last column estimates how many articles created that year still exist as articles (not redirects), as the share of IDs found times the number of IDs in the year's intervals. It is an estimate from a sample."], table: { columns: ["Year", "IDs drawn", "Article today", "Redirect", "Not found or other", "Estimated surviving new articles"], rows: Object.entries(C.frame).filter(([, v]) => v.drawn).map(([y, v]) => [y, n(v.drawn), pct(v.article_share_of_ids), pct(v.redirect_share), pct(1 - v.article_share_of_ids - v.redirect_share), n(v.est_surviving_articles)]) } },
  ],
  limitations: [
    "Survivorship. Only pages that exist as articles in October 2026 can be sampled. Deleted new pages, including ones removed because they were machine-generated, are invisible, so later years may look less AI-like than what was submitted. The deletion shares above describe how much is missing, not what it said.",
    "First revisions are not articles. Many new pages are rewritten within hours, so a first revision can differ a great deal from what readers see. Drafts that were written elsewhere and moved in carry the date of the draft's first edit; they are reported separately, and the move is detected from edit summaries in the first 50 revisions only.",
    "Wikipedia's own guidance changed behaviour. Wikipedia's list of the signs of AI writing and its cleanup project are public (both pages were created in December 2023), and editors can learn from them; a drop or a rise in a listed word could follow the guidance as much as the tools.",
    "Word lists count spellings. These words rose in human writing for decades before ChatGPT, and topics shifted too: Wikipedia now has many articles about AI itself.",
    "The wikitext cleaner is a simplification. Text inside templates (quotations in quotation templates, for example) is dropped, and some markup survives in unusual pages. The cleaner was tested against Wikipedia's own plain-text rendering on a separate sample before the study ran (see the pre-registration).",
    "Page IDs follow creation order closely but not exactly: imported pages and a few rare cases keep an old date. Articles whose first revision falls outside the month their ID suggests are dropped and counted.",
    "English Wikipedia only, and a ceiling of 120 sampled articles a month; months in the early years with fewer measured articles after the 150-word rule are weighted the same as the rest.",
  ],
  reproducibility: [
    "Pre-registration and scripts: docs/research/sgr-026-preregistration.md and scripts/experiments/sgr-026/ in the ScriptGrain repository (collect.mjs draws the sample and fetches first revisions, lib.mjs holds the cleaner, run.mjs measures and analyses, write-entry.mjs builds this page from the summary).",
    "Every article is named by its Wikipedia page ID in the data, so any article can be looked up (en.wikipedia.org/?curid=<id>), its history read and its first revision measured again.",
  ],
  dataDownloads: [
    { label: "Every article measured: page ID, month, era, words and every measure (CSV; no text)", path: "/research/sgr-026-articles.csv", format: "csv" },
    { label: "Month by month: article counts and mean of every headline measure (CSV)", path: "/research/sgr-026-by-month.csv", format: "csv" },
    { label: "Year by year: means and composition (CSV)", path: "/research/sgr-026-by-year.csv", format: "csv" },
    { label: "Sampling frame by month: IDs drawn and what they were (CSV)", path: "/research/sgr-026-frame.csv", format: "csv" },
    { label: "Summary: hypotheses, intervals, robustness checks, exclusions, deletions (JSON)", path: "/research/sgr-026-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-026, conducted ${date(CONDUCTED)}). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "Wikipedia: Signs of AI writing (page created 4 December 2023). Wikipedia's editors' field guide to AI-generated text; it says it is descriptive, not prescriptive, and that not all text showing the signs is AI-generated", url: "https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing" },
    { name: "Wikipedia: WikiProject AI Cleanup, a collaboration to combat AI-generated content on Wikipedia", url: "https://en.wikipedia.org/wiki/Wikipedia:WikiProject_AI_Cleanup" },
    { name: "Wikipedia: Speedy deletion, criterion G15 (unambiguously LLM-generated pages)", url: "https://en.wikipedia.org/wiki/Wikipedia:Speedy_deletion" },
    { name: "Wikipedia content and the MediaWiki Action API. Article text is available under CC BY-SA 4.0; this study publishes counts only", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
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
console.error(`SGR-026 ${i === -1 ? "added" : "updated"}; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
