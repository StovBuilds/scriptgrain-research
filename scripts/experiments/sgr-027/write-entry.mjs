#!/usr/bin/env bun
// SGR-027: write the study entry in src/data/research-pages.json from the run's output, so every
// number on the page is the run's number and nothing is typed by hand.
//
//   bun scripts/experiments/sgr-027/write-entry.mjs --conducted-on 2026-11-10 --publish-on 2026-11-11
//
// Reads out/analysis.json (analyse.mjs) and out/results.json (run.mjs). Also publishes the data:
// public/research/sgr-027-pairs.json (all 20 pairs with both texts), sgr-027-pairs.csv (measures,
// no text) and sgr-027-summary.json (the analysis).
//
// Guards: conductedOn must equal the day run.mjs measured (every record's measuredAt, UTC) and the
// day analyse.mjs ran (analysis.ranOn); publishOn must be the next day; a pilot (id PILOT) is refused;
// n must be 20 with every pair measured. --allow-fixture (with --in <dir>) exists only to test this
// builder against a fake fixture (it lets a fixture's PILOT-style output through; the date guards still run); never commit its output.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CONDUCTED = opt("--conducted-on", null), PUBLISH_ON = opt("--publish-on", null);
if (!CONDUCTED || !PUBLISH_ON) throw new Error("--conducted-on and --publish-on required");
const IN = opt("--in", "scripts/experiments/sgr-027/out");
const FIXTURE = args.includes("--allow-fixture");
const A = JSON.parse(readFileSync(`${IN}/analysis.json`, "utf8"));
const R = JSON.parse(readFileSync(`${IN}/results.json`, "utf8"));
if (A.fixture && !FIXTURE) throw new Error("refusing a fixture analysis");
if (!FIXTURE && (A.pilot || R.some((r) => r.id === "PILOT"))) throw new Error("refusing pilot output");
if (A.ranOn !== CONDUCTED) throw new Error(`analysis ran on ${A.ranOn}, not ${CONDUCTED}: re-run run.mjs and analyse.mjs on the conducted date; never edit the date`);
const days = [...new Set(R.map((r) => String(r.measuredAt ?? "").slice(0, 10)))];
if (days.length !== 1 || days[0] !== CONDUCTED) throw new Error(`results measured on ${days.join(", ")}, not ${CONDUCTED}: delete out/results.json and re-run run.mjs on the conducted date; never edit the date`);
const nextDay = new Date(Date.parse(`${CONDUCTED}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
if (PUBLISH_ON !== nextDay) throw new Error(`publishOn must be the day after conductedOn (${nextDay})`);
if (R.length !== 20 || A.n !== 20) throw new Error(`expected 20 measured pairs, got results ${R.length}, analysis ${A.n}`);
for (const r of R) for (const side of ["before", "after"]) for (const k of ["human_score", "tells_per1000", "voice_match", "words"]) {
  if (r[side]?.[k] == null) throw new Error(`${r.id} ${side}.${k} is missing: the run is incomplete`);
}
if (A.hypotheses?.H1 == null || A.hypotheses?.H2 == null || A.hypotheses?.H3 == null || A.hypotheses?.H4 == null) throw new Error("analysis is missing a hypothesis");

const here = new URL(".", import.meta.url).pathname;
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(here + "../shared/analysts.json", "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const sg = (x) => (x > 0 ? "+" : x < 0 ? "−" : "");
const num = (x, d) => `${x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const sn = (x, d) => `${sg(x)}${n(Math.abs(x), d)}`;
const ch = (c, d = 2) => `${sn(c.mean, d)} (95% interval ${num(c.lo, d)} to ${num(c.hi, d)})`;
const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pct = (x, d = 0) => `${n(100 * x, d)}%`;
const verdict = (h) => (h ? "Supported" : "Not supported");
const EM = String.fromCharCode(0x2014), EN = String.fromCharCode(0x2013);
// The site prints no em or en dashes; the texts are shown with the dashes written out, so the reader sees where they were.
const showText = (t) => t.split(EM).join(" [em dash] ").split(EN).join(" [en dash] ").replace(/ {2,}/g, " ");
const paras = (t) => showText(t).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const count = (name) => R.filter((r) => name(r)).length;

const { H1, H2, H3, H4 } = A.hypotheses;
const X = A.exploratory;
const SLUG = "what-does-a-humaniser-actually-change";
const TITLE = "What does a humaniser actually change? 20 AI-written passages, before and after";
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;

// Facts taken from the data
const lostN = count((r) => r.content.numbers_lost.length), addedN = count((r) => r.content.numbers_added.length), inventedN = count((r) => r.content.invented_first_person.length);
const models = [...new Set(R.map((r) => `${r.generator === "claude" ? "Claude" : "GPT"} (${r.model})`))].sort();
const wordsMin = Math.min(...R.map((r) => r.before.words)), wordsMax = Math.max(...R.map((r) => r.before.words));
const gen = (g) => R.filter((r) => r.generator === g).length;
const formats = [...new Set(R.map((r) => r.format))];
const topics = [...new Set(R.map((r) => r.topic))].length;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const hLab = {
  h1: H1.holds ? `the detector's human score rose, ${H1.before.toFixed(2)} to ${H1.after.toFixed(2)} on a 0 to 1 scale` : `the detector's human score did not clearly rise (${H1.before.toFixed(2)} to ${H1.after.toFixed(2)})`,
  h2: H2.holds ? `AI-tell density fell, ${n(H2.before, 1)} to ${n(H2.after, 1)} per 1,000 words` : `AI-tell density did not clearly fall (${n(H2.before, 1)} to ${n(H2.after, 1)} per 1,000 words)`,
};
const vmMoved = H3.change.lo > 0 || H3.change.hi < 0;
const vmText = H3.holds
  ? `voice match against the fixed profile did not move beyond ±0.05 (${H3.before.toFixed(2)} to ${H3.after.toFixed(2)})`
  : vmMoved
    ? `voice match against the fixed profile moved by more than chance (${H3.before.toFixed(2)} to ${H3.after.toFixed(2)})`
    : `voice match against the fixed profile did not show a clear move, but the interval was too wide to rule out one of 0.05 (${H3.before.toFixed(2)} to ${H3.after.toFixed(2)})`;
const contentText = H4.holds
  ? `content survived in ${H4.clean_pairs} of ${H4.of} pairs (no number lost or added, no first-person sentence invented)`
  : `content survived in only ${H4.clean_pairs} of ${H4.of} pairs, below the 18 we required`;

// §6 showcase, with roles recomputed the way analyse.mjs chose them
const gainOf = (r) => r.after.human_score - r.before.human_score, vmOf = (r) => r.after.voice_match - r.before.voice_match;
const byGain = [...R].sort((a, b) => gainOf(b) - gainOf(a)), byVm = [...R].sort((a, b) => vmOf(b) - vmOf(a));
const roles = [
  [byGain[0], "Largest detector gain"], [byGain[Math.floor(byGain.length / 2)], "Median detector gain"], [byGain.at(-1), "Smallest detector gain"],
  [byVm[0], "Largest voice-match rise"], [byVm.at(-1), "Largest voice-match fall"],
];
if ([...new Set(roles.map(([r]) => r.id))].sort().join() !== [...A.showcase].sort().join()) throw new Error("showcase in analysis.json does not match the §6 selection recomputed from results.json");
const shown = new Map();
for (const [r, label] of roles) shown.set(r.id, [...(shown.get(r.id) ?? []), label]);
const pairSections = [...shown].map(([id, labels]) => {
  const r = R.find((x) => x.id === id);
  const b = r.before, a = r.after;
  return {
    heading: `Pair ${id}: ${labels.join("; ").toLowerCase()}`,
    paragraphs: [
      `${r.generator === "claude" ? "Claude" : "GPT"} passage, ${r.format.replace(/-/g, " ")}, topic ${r.topic + 1} of ${topics}. Detector human score ${b.human_score.toFixed(2)} to ${a.human_score.toFixed(2)}; AI tells per 1,000 words ${n(b.tells_per1000, 1)} to ${n(a.tells_per1000, 1)}; voice match ${b.voice_match.toFixed(2)} to ${a.voice_match.toFixed(2)}; words ${b.words} to ${a.words}; contractions per 1,000 words ${n(b.contractions_per1000, 1)} to ${n(a.contractions_per1000, 1)}. Numbers lost: ${r.content.numbers_lost.length}; numbers added: ${r.content.numbers_added.length}; first-person sentences invented: ${r.content.invented_first_person.length}.`,
      "Original:", ...paras(r.original), "After the humaniser:", ...paras(r.humanised),
    ],
  };
});

const feat = X.features;
const featRows = [["Words", "words", 1], ["Contractions per 1,000 words", "contractions_per1000", 1], ["Average sentence length (words)", "avg_sentence_length", 1], ["Sentence-length variance", "sentence_length_variance", 1], ["Commas per word", "comma_density", 3], ["Em dashes per 1,000 words", "em_dashes_per1000", 1]]
  .map(([label, k, d]) => [label, n(feat[k].before, d), n(feat[k].after, d), ch(feat[k].change, d)]);
const genRows = ["claude", "gpt"].flatMap((g) => [["human_score", "Detector human score", 2], ["tells_per1000", "AI tells per 1,000 words", 1], ["voice_match", "Voice match", 2]]
  .map(([k, label, d]) => [g === "claude" ? "Claude" : "GPT", label, `${n(X.by_generator[g][k].before, d)} to ${n(X.by_generator[g][k].after, d)}`, ch(X.by_generator[g][k].change, d)]));
const fmtRows = Object.entries(X.by_format).flatMap(([f, o]) => [["human_score", "Detector human score"], ["voice_match", "Voice match"]]
  .map(([k, label]) => [f.replace(/-/g, " "), label, `${n(o[k].before, 2)} to ${n(o[k].after, 2)}`, ch(o[k].change, 2)]));

const study = {
  id: "SGR-027",
  slug: SLUG,
  title: TITLE,
  seoTitle: "What does an AI humaniser actually change? 20 passages, before and after · ScriptGrain Research",
  question: "When a humaniser rewrites AI-written text so that a detector scores it as human, what changes in the writing: the detector score, the AI tells, the measurable habits, the content, and whether the text sounds like any particular writer?",
  conductedOn: CONDUCTED,
  publishOn: PUBLISH_ON,
  description: `A pre-registered before-and-after study of 20 passages written by AI from bare prompts and rewritten by ScriptGrain's own humaniser. ${cap(hLab.h1)}; ${hLab.h2}. ${cap(contentText)}.`,
  abstract: [
    { label: "Background", text: "AI humanisers rewrite machine-written text so that detectors score it as human. What they change in the writing is rarely published with the numbers in view. We tested ScriptGrain's own humaniser because it is the one we can run with every intermediate number recorded; we sell it, which is a competing interest stated below." },
    { label: "What we did", text: `We fixed four hypotheses before any passage was generated. Twenty passages of ${wordsMin} to ${wordsMax} words were written from bare prompts with no style, voice or tone instruction: ${formats.length} everyday formats by 4 topics, ${gen("claude")} by ${models.filter((m) => m.startsWith("Claude")).join("")} and ${gen("gpt")} by ${models.filter((m) => m.startsWith("GPT")).join("")}. Each was sent once to the humaniser, forced to rewrite even if it already passed, and both versions were measured: the detector's human score, AI tells per 1,000 words, five stylometric habits, voice match against one fixed profile, and what happened to numbers and first-person statements.` },
    { label: "What we found", text: `H1 (${verdict(H1.holds).toLowerCase()}): ${hLab.h1}, a change of ${ch(H1.change)}. H2 (${verdict(H2.holds).toLowerCase()}): ${hLab.h2}, a change of ${ch(H2.change, 1)}. H3 (${verdict(H3.holds).toLowerCase()}): ${vmText}; the change was ${ch(H3.change, 3)}. H4 (${verdict(H4.holds).toLowerCase()}): ${contentText}; ${plural(lostN, "pair", "pairs")} lost a number, ${addedN} gained one and ${inventedN} gained a first-person sentence the original did not have.` },
    { label: "What it means", text: "This describes what one humaniser did to 20 short passages, scored by one detector. It does not show that the rewrite would pass any other detector, that it works on human writing, or that detector scores measure authorship. Five of the pairs are shown in full on this page and all twenty are in the data file, so a reader can judge the rewrites themselves." },
  ],
  keyNumbers: [
    `ScriptGrain's humaniser changed the mean detector human score of 20 AI-written passages from ${H1.before.toFixed(2)} to ${H1.after.toFixed(2)} (change ${ch(H1.change)}; ScriptGrain, 2026; pre-registered, run once on ${date(CONDUCTED)}).`,
    `AI tells per 1,000 words went from ${n(H2.before, 1)} to ${n(H2.after, 1)} after humanising (change ${ch(H2.change, 1)}).`,
    `Voice match against a fixed profile went from ${H3.before.toFixed(2)} to ${H3.after.toFixed(2)} (change ${ch(H3.change, 3)}; the pre-registered equivalence margin was ±0.05).`,
    `${H4.clean_pairs} of ${H4.of} humanised passages lost no number, added no number and invented no first-person sentence.`,
    `A default run, without the forced rewrite, would have skipped ${X.would_skip_by_default} of the 20 passages because the detector already scored them at or above the 0.85 target.`,
  ],
  measures: [
    { term: "Detector human score", definition: "The score from ScriptGrain's own AI detector, 0 to 1, where 1 reads as human. It is a model's judgement of how the text reads, not a test of who wrote it." },
    { term: "AI tells per 1,000 words", definition: "Uses per 1,000 words of the stock phrases, balanced 'not X but Y' sentences and other patterns found by the free [AI cliché checker](/tools/ai-cliche-checker)." },
    { term: "Stylometric habits", definition: "Counted by code, not scored by a model: contractions per 1,000 words, average sentence length, sentence-length variance, commas per word and em dashes per 1,000 words." },
    { term: "Voice match", definition: "How closely a text matches one fixed writing profile, 0 to 1, from ScriptGrain's voice-match engine. The profile used is the ScriptGrain brand profile, fixed in advance because it is unrelated to every topic in the corpus. It asks whether the text sounds like that writer, not whether it sounds human." },
    { term: "Content kept", definition: "For each pair: numbers in the original missing from the rewrite, numbers in the rewrite absent from the original, first-person sentences in the rewrite with no first-person source in the original, and the share of the original's content words still present." },
    { term: "Paired change and 95% interval", definition: "Each passage is compared with its own rewrite; the change is the mean of the 20 differences (rewrite minus original). The 95% interval resamples the 20 passages with replacement 10,000 times (fixed seed 20261012)." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells this humaniser and sells voice matching, and the analyst builds both. H3 is a hypothesis that the product's positioning would like to be true: it was tested with an equivalence margin fixed in the pre-registration and is reported whichever way it fell. The hypotheses, measures and tests were committed to the public repository before any passage was generated, and every result is reported whether it passed or failed.",
  notShown: [
    "That the humaniser beats, or loses to, any other humaniser. Only ScriptGrain's was tested; a comparison needs paid accounts with rivals.",
    "That the rewrite passes any detector other than ScriptGrain's own. Other detectors may disagree.",
    "That voice measurement, ScriptGrain's or anyone's, or a detector score, can tell whether a text was written by AI. This study scores generated passages and their rewrites; it says nothing about human writing.",
    "That the same passages would give the same numbers on another run. Model outputs are not deterministic; this is one run per passage.",
    "Anything about long documents. The passages were asked for at 150 to 200 words; the range actually generated is given under the method.",
  ],
  productNote: "ScriptGrain's humaniser rewrites text toward a target detector score and keeps an integrity guard on numbers and first-person claims; its voice match scores text against a writer's measured profile. This study tests what the humaniser did, not whether you should use it.",
  sample: {
    description: `20 passages written on ${date(A.measuredOn?.[0] ?? CONDUCTED)} or earlier from bare prompts with no style, voice or tone instruction: ${formats.length} formats (${formats.map((f) => f.replace(/-/g, " ")).join(", ")}) by 4 topics (loft insulation, a weekly budgeting app, running after forty, a bakery), ${gen("claude")} by Claude and ${gen("gpt")} by GPT, one generation per prompt, no retries and no editing. Original lengths ran from ${wordsMin} to ${wordsMax} words.`,
    size: 20,
    inclusionCriteria: ["One passage per frozen prompt (5 formats by 4 topics)", "Generator fixed by the prompt's position: 10 Claude, 10 GPT", "At least 50 words (the humaniser's minimum)"],
    exclusions: ["None: every generated passage was measured, none was edited or regenerated after seeing a result"],
  },
  method: [
    `Corpus: the prompts and the generator of each were frozen in the pre-registration before any generation. Every prompt had the same suffix, "Output only the text.", on both generators. Claude passages came from ${models.filter((m) => m.startsWith("Claude")).join("")} through the claude command-line tool and GPT passages from ${models.filter((m) => m.startsWith("GPT")).join("")} through the codex command-line tool. The passages were generated once, before the measurement day, and were not touched afterwards.`,
    "Treatment: each passage was sent once to ScriptGrain's humaniser (api-v1 POST /v1/humanize) with force set, so every passage was rewritten even if it already passed, and with the default target of 0.85. The humaniser's own integrity guard stayed on.",
    "Measures: on the original and on the rewrite, the detector's human score (POST /v1/ai-detect), AI tells per 1,000 words (the AI cliché checker's scan), five habits counted by ScriptGrain's voice-match counter, voice match against the fixed ScriptGrain brand profile (POST /v1/voice-match), and the content checks. Word count was recorded for both.",
    "Tests: H1 to H3 use the paired mean difference with a 95% bootstrap interval (10,000 resamples of passages, seed 20261012). H1 and H2 hold if the interval excludes zero in the stated direction; H3 holds if the interval lies inside -0.05 to +0.05; H4 holds if at least 18 of 20 pairs lose or add no number and gain no invented first-person sentence.",
    `Run: once, on ${date(CONDUCTED)}, the day before this page went live. No result changed any measure, threshold, seed or hypothesis. Analyses beyond H1 to H4 are labelled exploratory.`,
  ],
  variablesMeasured: ["Detector human score (0 to 1)", "AI tells per 1,000 words", "Contractions per 1,000 words", "Average sentence length", "Sentence-length variance", "Commas per word", "Em dashes per 1,000 words", "Voice match against a fixed profile (0 to 1)", "Numbers lost or added, invented first-person sentences, content words kept", "Word count"],
  findings: [
    { label: `H1 (${verdict(H1.holds).toLowerCase()}): the detector's human score ${H1.holds ? "rose" : "did not clearly rise"}`, value: `${ch(H1.change)}; ${H1.before.toFixed(2)} to ${H1.after.toFixed(2)}`, explanation: `Mean of 20 paired differences on a 0 to 1 scale where 1 reads as human. The default target is 0.85; ${X.reached_target} of 20 rewrites reached it.` },
    { label: `H2 (${verdict(H2.holds).toLowerCase()}): AI-tell density ${H2.holds ? "fell" : "did not clearly fall"}`, value: `${ch(H2.change, 1)} per 1,000 words; ${n(H2.before, 1)} to ${n(H2.after, 1)}`, explanation: "Stock phrases, 'not X but Y' balancing and the other patterns the free AI cliché checker looks for." },
    { label: `H3 (${verdict(H3.holds).toLowerCase()}): voice match ${H3.holds ? "stayed inside ±0.05" : vmMoved ? "moved by more than chance" : "was not shown to stay inside ±0.05"}`, value: `${ch(H3.change, 3)}; ${H3.before.toFixed(2)} to ${H3.after.toFixed(2)}`, explanation: H3.holds ? "The whole interval sits inside the pre-registered margin, so the rewrite did not measurably move the text toward or away from the fixed profile." : "The interval is not inside the pre-registered margin of -0.05 to +0.05, so the equivalence claim is not supported." },
    { label: `H4 (${verdict(H4.holds).toLowerCase()}): content ${H4.holds ? "survived" : "did not survive often enough"}`, value: `${H4.clean_pairs} of ${H4.of} pairs clean (at least 18 needed)`, explanation: `${plural(lostN, "pair", "pairs")} lost a number, ${addedN} added a number and ${inventedN} gained an invented first-person sentence. On average ${pct(X.content_words_kept)} of the original's content words were still present after the rewrite.` },
    { label: "Exploratory: how often the humaniser's own passes were thrown away", value: `${X.passes_discarded} of ${X.passes_run} passes discarded by its integrity guard`, explanation: `The humaniser reports each pass and discards a pass that fails its own checks. ${X.would_skip_by_default} of 20 passages would have been skipped by a default run because they already scored at or above the 0.85 target.` },
  ],
  sections: [
    {
      heading: "Pre-registered hypotheses and results",
      table: { columns: ["Hypothesis", "Result", "Change, rewrite minus original (95% interval)"], rows: [
        ["H1: the mean detector human score rises", verdict(H1.holds), `${ch(H1.change)}`],
        ["H2: the mean AI-tell density falls", verdict(H2.holds), `${ch(H2.change, 1)} per 1,000 words`],
        ["H3: voice match against the fixed profile does not move (interval inside ±0.05)", verdict(H3.holds), `${ch(H3.change, 3)}`],
        ["H4: in at least 18 of 20 pairs no number is lost or added and no first-person sentence is invented", verdict(H4.holds), `${H4.clean_pairs} of ${H4.of} pairs`],
      ] },
    },
    {
      heading: "Habits, before and after",
      paragraphs: ["Exploratory. Mean across the 20 passages, rewrite minus original, with a 95% interval from the same bootstrap."],
      table: { columns: ["Habit", "Before", "After", "Change (95% interval)"], rows: featRows },
    },
    {
      heading: "Claude passages against GPT passages",
      paragraphs: ["Exploratory. Ten passages each; the intervals are wide and are shown for completeness, not as separate tests."],
      table: { columns: ["Written by", "Measure", "Before to after", "Change (95% interval)"], rows: genRows },
    },
    {
      heading: "Format by format",
      paragraphs: ["Exploratory. Four passages in each format (two Claude, two GPT), so these are descriptions of four pairs, not estimates."],
      table: { columns: ["Format", "Measure", "Before to after", "Change (95% interval)"], rows: fmtRows },
    },
    {
      heading: "Five pairs in full",
      paragraphs: [`Chosen by rule before the run: the largest, median and smallest detector gain, and the largest voice-match change in each direction (a pair can fill more than one role). The texts are shown with em and en dashes written out as [em dash] and [en dash], because this site does not print them. All 20 pairs are in the data file, in full.`],
    },
    ...pairSections,
  ],
  limitations: [
    "One humaniser, ours. We sell it, and no rival humanisers were tested (that needs paid accounts).",
    "One run per passage. Model outputs are not deterministic, so a re-run reproduces the method, not the exact texts.",
    "20 short passages, 150 to 200 words by design (some of the generated originals ran a little over). Results on long documents may differ, and with 20 pairs the intervals are wide.",
    "The detector is ScriptGrain's own. Other detectors may agree or disagree, and a detector score is a model's judgement of how text reads, not a measurement of authorship.",
    "The passages were generated from bare prompts by two general-purpose models. They are not human writing, and nothing here says anything about human text.",
    "Voice match was measured against one profile, chosen because it is fixed and unrelated to every topic. A different profile could give a different result.",
    "The forced rewrite is not how the humaniser is used by default: a default run would have skipped some of these passages.",
  ],
  reproducibility: [
    "Pre-registration and scripts: docs/research/sgr-027-preregistration.md and scripts/experiments/sgr-027/ in the ScriptGrain repository (prompts.json holds the frozen prompts, generate.mjs wrote the passages, run.mjs humanises and measures, analyse.mjs tests the hypotheses, write-entry.mjs builds this page from the output).",
    "The data file holds every passage and its rewrite in full, with every measure for both, so any number on this page can be recomputed.",
  ],
  dataDownloads: [
    { label: "All 20 pairs: original and humanised text, every measure for both, humaniser details (JSON)", path: "/research/sgr-027-pairs.json", format: "json" },
    { label: "All 20 pairs: every measure, no text (CSV)", path: "/research/sgr-027-pairs.csv", format: "csv" },
    { label: "Summary: hypotheses, intervals, exploratory results (JSON)", path: "/research/sgr-027-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-027, conducted ${date(CONDUCTED)}). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "ScriptGrain (2026). Where did AI-isms come from? (SGR-007)", url: "https://scriptgrain.com/research/where-did-ai-isms-come-from" },
    { name: "ScriptGrain: free AI cliché checker, the scan behind AI tells per 1,000 words", url: "https://scriptgrain.com/tools/ai-cliche-checker" },
  ],
};

// Data files
const COLS = [["words", "words"], ["human_score", "human_score"], ["tells_per1000", "tells_per1000"], ["contractions_per1000", "contractions_per1000"], ["avg_sentence_length", "avg_sentence_length"], ["sentence_length_variance", "sentence_length_variance"], ["comma_density", "comma_density"], ["em_dashes_per1000", "em_dashes_per1000"], ["voice_match", "voice_match"]];
const head = ["id", "generator", "format", "topic", ...COLS.flatMap(([c]) => [`${c}_before`, `${c}_after`]), "numbers_lost", "numbers_added", "invented_first_person", "content_words_kept", "humaniser_initial_score", "humaniser_final_score", "reached_target", "iterations_run", "discarded_passes", "would_skip_by_default"];
const csv = [head.join(","), ...R.map((r) => [r.id, r.generator, r.format, r.topic, ...COLS.flatMap(([c]) => [r.before[c], r.after[c]]), r.content.numbers_lost.length, r.content.numbers_added.length, r.content.invented_first_person.length, r.content.content_words_kept, r.humanizer.initial_score, r.humanizer.final_score, r.humanizer.reached_target, r.humanizer.iterations_run, r.humanizer.discarded_passes, r.humanizer.would_skip_by_default].map((v) => (v == null ? "" : v)).join(","))].join("\n") + "\n";
writeFileSync("public/research/sgr-027-pairs.json", JSON.stringify(R, null, 2) + "\n");
writeFileSync("public/research/sgr-027-pairs.csv", csv);
writeFileSync("public/research/sgr-027-summary.json", JSON.stringify(A, null, 2) + "\n");

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-027 ${i === -1 ? "added" : "updated"}; conductedOn ${CONDUCTED}, publishOn ${PUBLISH_ON}`);
