#!/usr/bin/env bun
// Build the SGR-003 research entry (src/data/research-pages.json) from the
// study data file written by run-stability-study.mjs. Tables and headline
// numbers are computed here so the page can never disagree with the data;
// the interpretive paragraphs live in this file and are edited by hand once
// the numbers are in.
//
//   bun scripts/experiments/write-sgr-003.mjs [--data public/research/sgr-003-profile-stability.json] [--publish 2026-09-21]
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DATA = opt("--data", "public/research/sgr-003-profile-stability.json");
const PUBLISH = opt("--publish", "2026-09-21");
const d = JSON.parse(readFileSync(DATA, "utf8"));
const KS = [1, 2, 3, 5, 8, 15];
const AUTHORS = ["dickens", "austen", "emerson"];
const NAMES = { dickens: "Dickens", austen: "Austen", emerson: "Emerson" };
const f2 = (x) => (x == null || Number.isNaN(x) ? "n/a" : x.toFixed(2));
const pct = (x) => (x == null || Number.isNaN(x) ? "n/a" : `${Math.round(x * 100)}%`);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const by = (a, k) => d.profiles.find((p) => p.author === a && p.k === k);
const complete = KS.every((k) => AUTHORS.every((a) => by(a, k)));
if (!complete) console.error("WARNING: study incomplete; tables carry n/a where a profile is missing");

// Per-k rows: mean same-author score, mean other-author score, gap, confidence, enum agreement with the 15-piece profile.
const rows = KS.map((k) => {
  const ps = AUTHORS.map((a) => by(a, k)).filter(Boolean);
  const words = Math.round(mean(ps.map((p) => p.words)));
  const same = mean(ps.map((p) => p.same_author.mean));
  const other = mean(ps.map((p) => p.other_authors.mean));
  const conf = mean(ps.map((p) => p.confidence_score).filter((x) => x != null));
  const agree = mean(ps.map((p) => p.vs_reference?.enum_agree_share).filter((x) => x != null));
  return { k, words, same, other, gap: same - other, conf, agree, n: ps.length };
});
const perAuthor = AUTHORS.flatMap((a) => KS.map((k) => { const p = by(a, k); return p ? [NAMES[a], String(k), String(p.words), f2(p.same_author.mean), f2(p.other_authors.mean), f2(p.gap), f2(p.confidence_score), p.vs_reference ? pct(p.vs_reference.enum_agree_share) : "reference"] : [NAMES[a], String(k), "n/a", "n/a", "n/a", "n/a", "n/a", "n/a"]; }));

// Numeric attribute drift vs the 15-piece profile, averaged over authors, for the headline attributes.
const NUMERIC = ["avg_sentence_length", "contraction_frequency", "formality_score", "comma_density"];
const LABEL = { avg_sentence_length: "Average sentence length (words)", contraction_frequency: "Contractions per 1,000", formality_score: "Formality (0 to 10)", comma_density: "Commas per sentence" };
const driftRows = NUMERIC.map((key) => [LABEL[key], ...KS.filter((k) => k !== 15).map((k) => { const ds = AUTHORS.map((a) => by(a, k)?.vs_reference?.numeric_delta?.[key]).filter((x) => typeof x === "number"); return ds.length ? f2(mean(ds.map(Math.abs))) : "n/a"; })]);

const r1 = rows.find((r) => r.k === 1), r3 = rows.find((r) => r.k === 3), r5 = rows.find((r) => r.k === 5), r8 = rows.find((r) => r.k === 8), r15 = rows.find((r) => r.k === 15);

const entry = {
  id: "SGR-003",
  slug: "how-many-samples-does-a-voice-profile-need",
  title: "How many samples does a voice profile need before it stabilises?",
  seoTitle: "How many writing samples does a voice profile need? SGR-003 · ScriptGrain",
  question: "As pieces are added to a voice profile, when do its attributes stop moving, and when does it start telling its author from a stranger?",
  conductedOn: d.started_at.slice(0, 10),
  publishOn: PUBLISH,
  description: `Three public-domain authors (Dickens, Austen, Emerson), each cut into ${d.piece_target_words}-word pieces. For each author, nested profiles were extracted from 1, 2, 3, 5, 8 and 15 pieces through the public API, then scored with the product's own voice-match instrument against four held-out pieces by the same author and eight by the other two. ${d.profiles.length} profiles, ${d.profiles.length * 12} scores.`,
  sample: {
    description: `Great Expectations (Gutenberg #1400), Pride and Prejudice (#1342) and Emerson's Essays (#16643), body text only, cut at paragraph boundaries into pieces of about ${d.piece_target_words} words (600 to 1,400 accepted). With a fixed seed (${d.seed}), 15 training pieces and 4 held-out pieces were drawn per author; the training sets are nested, so the 1-piece profile's sample is inside the 2-piece profile's, and so on. Public-domain prose was used so the study is reproducible from the source text and needs nobody's consent.`,
    size: d.profiles.length,
    inclusionCriteria: [
      "Body text between the Gutenberg start and end markers; chapter headings, illustrations and paragraphs under 12 words dropped",
      "Held-out pieces never appear in any training set, for any author",
      "One extraction per profile, one score per held-out piece; nothing re-run or chosen",
    ],
    exclusions: ["No living author and no ScriptGrain user's writing", "No editing of the pieces beyond whitespace normalisation"],
  },
  method: [
    "Profiles: POST /v1/profiles with the first k training pieces (k = 1, 2, 3, 5, 8, 15), status polled to complete. Extraction is the same two-pass pipeline every user gets; extractions are rate-limited to five an hour, so the run spans several hours.",
    "Same-author score: POST /v1/voice-match for each of the author's four held-out pieces against the k-piece profile; the mean is reported.",
    "Other-author score: the same call for the other two authors' eight held-out pieces; the mean is reported. The gap (same minus other) is how well the profile tells its author from a stranger.",
    "Attribute agreement: each k-piece profile's enumerated attributes (complexity, clause ordering, humour, expressiveness, opening style, argument structure, ellipsis habit, list preference, connective preference, specificity, rhythm, paragraph length, power-sentence position) compared with the author's 15-piece profile; the share that agree is reported. Numeric attributes are reported as the absolute difference from the 15-piece value.",
    "Confidence: the confidence_score the extraction itself returns with each profile.",
    "Runner: scripts/experiments/run-stability-study.mjs in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research); data file linked below.",
  ],
  variablesMeasured: [
    "Voice match of held-out pieces by the same author (0 to 1, profile-calibrated)",
    "Voice match of held-out pieces by the other two authors (0 to 1)",
    "Discrimination gap (same minus other)",
    "Share of enumerated attributes agreeing with the 15-piece profile",
    "Absolute drift of numeric attributes from the 15-piece profile",
    "Extraction confidence score (0 to 1)",
    "Words in the training set",
  ],
  findings: [
    { label: "Same-author match by pieces in the profile", value: `${f2(r1.same)} at 1 piece, ${f2(r3.same)} at 3, ${f2(r15.same)} at 15`, explanation: `Mean voice match of the author's own held-out pieces, averaged over three authors. INTERPRET.` },
    { label: "Telling the author from a stranger", value: `gap ${f2(r1.gap)} at 1 piece, ${f2(r3.gap)} at 3, ${f2(r15.gap)} at 15`, explanation: `Same-author mean minus other-author mean. INTERPRET.` },
    { label: "Attribute agreement with the 15-piece profile", value: `${pct(r1.agree)} at 1 piece, ${pct(r3.agree)} at 3, ${pct(r8.agree)} at 8`, explanation: `Share of thirteen enumerated attributes that already match the 15-piece profile's labels. INTERPRET.` },
    { label: "The extraction's own confidence tracks sample size", value: `${f2(r1.conf)} at 1 piece, ${f2(r5.conf)} at 5, ${f2(r15.conf)} at 15`, explanation: `confidence_score as returned with each profile. INTERPRET.` },
  ],
  sections: [
    { heading: "Results by pieces in the profile (means over three authors)", table: { columns: ["Pieces", "Words (mean)", "Same-author match", "Other-author match", "Gap", "Confidence", "Attributes agreeing with 15-piece profile"], rows: rows.map((r) => [String(r.k), String(r.words), f2(r.same), f2(r.other), f2(r.gap), f2(r.conf), r.k === 15 ? "reference" : pct(r.agree)]) } },
    { heading: "Results by author", table: { columns: ["Author", "Pieces", "Words", "Same-author match", "Other-author match", "Gap", "Confidence", "Attributes agreeing"], rows: perAuthor } },
    { heading: "How far the numeric attributes sit from the 15-piece profile (mean absolute difference)", table: { columns: ["Attribute", "1 piece", "2", "3", "5", "8"], rows: driftRows } },
    { heading: "What the numbers say", paragraphs: ["INTERPRET."] },
  ],
  limitations: [
    "Three authors, one draw of pieces each, one extraction per profile: the direction of the curves is the finding, not the decimals. A second draw would move individual cells.",
    "All three authors are nineteenth-century literary prose, which the scorer separates less sharply than it separates a newsletter from a legal notice; the other-author baseline is therefore a hard test, and a modern business writer's profile would likely show a larger gap.",
    "The judged attributes come from a model reading the samples, so some run-to-run variation in labels is inherent and is part of what this study measures.",
    "Pieces of about 800 words are longer than a typical LinkedIn post and shorter than a typical blog post; the piece count is the variable studied, and the word count scales with it.",
    "The author of this study builds the product. Nothing was blind; nothing was re-run or selected.",
  ],
  reproducibility: [
    `Data file: /research/sgr-003-profile-stability.json (every profile's attributes, every score, the piece hashes and word counts, the seed).`,
    "Runner: scripts/experiments/run-stability-study.mjs (in [ScriptGrain's public research repository](https://github.com/StovBuilds/scriptgrain-research)); the texts are Project Gutenberg #1400, #1342 and #16643.",
    "Free instruments: the off-voice check on this site scores any two pieces the same way.",
  ],
  dataDownloads: [{ label: "All profiles and scores (JSON)", path: "/research/sgr-003-profile-stability.json", format: "json" }],
};

const file = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(file, "utf8"));
const i = data.studies.findIndex((s) => s.id === "SGR-003");
if (i === -1) data.studies.push(entry); else data.studies[i] = { ...entry, findings: data.studies[i].findings?.some((f) => !f.explanation.includes("INTERPRET")) ? data.studies[i].findings : entry.findings, sections: entry.sections.map((s, j) => (s.paragraphs && data.studies[i].sections?.[j]?.paragraphs && !data.studies[i].sections[j].paragraphs.join(" ").includes("INTERPRET") ? data.studies[i].sections[j] : s)) };
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(JSON.stringify(rows, null, 1));
console.log(complete ? "entry written (complete)" : "entry written (INCOMPLETE data)");
