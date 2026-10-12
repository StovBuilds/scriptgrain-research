# SGR-027 pre-registration: what does a humaniser actually change?

Frozen 2026-10-12, before any SGR-027 passage was generated or measured. Changes after
this point are listed at the end with the date and the reason; nothing above that list
is edited.

## 1. Question
"Humanisers" rewrite AI text so detectors score it as human. What does that rewrite change
in the writing itself: the detector score, the AI tells, the measurable habits, the
content, and whether the text sounds like any particular writer?
The humaniser tested is ScriptGrain's own (api-v1 `POST /v1/humanize`), because it is the
one we can run with every intermediate number recorded. We sell it; see §8.

## 2. Corpus
20 passages, 150 to 200 words, written by two general-purpose models from bare prompts
(no style, voice or tone instruction). Prompts are frozen in
`scripts/experiments/sgr-027/prompts.json`: 5 everyday formats (blog opening, LinkedIn post,
marketing email, explainer, About page) x 4 topics (loft insulation, a weekly budgeting app,
running after forty, a bakery). The generator for each prompt is fixed by parity: 10
Claude (Sonnet, through the `claude` CLI), 10 GPT (OpenAI's default model, through the
`codex` CLI). One generation per prompt, no retries, no editing. A passage under 50 words
(the humaniser's minimum) is replaced by a second generation and the replacement is noted.

## 3. Treatment
Each passage is sent once to `POST /v1/humanize` with `force: true` and the default target
(0.85), so every passage is rewritten even if it already passes. The baseline score the
humaniser reports is recorded, so the share of passages a default run would have skipped
is reported. The humaniser's own integrity guard is part of the product and stays on.

## 4. Measures (each on the original and on the humanised text)
- **Detector human score:** `POST /v1/ai-detect`, 0 to 1 (1 = reads as human).
- **AI-tell density:** `scanCliches` (published at /tools/ai-cliche-checker) per 1,000 words.
- **Stylometric habits**, counted by code with `measureTextFeatures` (the voice-match
  counter): contractions per 1,000 words, average sentence length, sentence-length
  variance, comma density, em dashes per 1,000 words.
- **Voice match** against one fixed profile, "ScriptGrain Brand" (853dd07f-8657-4bf8-a2b0-3f84e147d6f4),
  via `POST /v1/voice-match`. The profile is chosen because it is fixed and unrelated to
  every topic in the corpus.
- **Content kept:** for each pair, numbers in the original missing from the rewrite, numbers
  in the rewrite absent from the original, first-person sentences with no first-person
  source (`inventedFirstPerson`), and the share of the original's content words still present.
- Word count.

## 5. Confirmatory hypotheses (paired, rewrite minus original)
- **H1:** the mean detector human score rises.
- **H2:** the mean AI-tell density falls.
- **H3:** voice match against the fixed profile does not move: the 95% interval of the mean
  change lies inside -0.05 to +0.05 (an equivalence test). Reading: humanising is aimed at
  "sounds human", not "sounds like you".
- **H4:** content survives: in at least 18 of 20 pairs no number is lost or added and no
  first-person sentence is invented.

**Test:** H1 to H3 use the paired mean difference with a 95% bootstrap interval (10,000
resamples of passages, seed 20261012). H1 and H2 hold if the interval excludes zero in the
stated direction. H4 is a count.

## 6. Exploratory (labelled as such on the page)
- Each stylometric habit, before and after. Claude against GPT passages. Format by format.
- Passes used and passes discarded by the integrity guard (from the humaniser's response).
- Word count change. Share of passages a default run (no `force`) would have skipped.
- Five before/after pairs are shown in full on the page, chosen as the largest, median and
  smallest detector gain plus the largest voice-match change in each direction; all 20 pairs
  are published in the data file.

## 7. What this cannot show
One humaniser, ours. No rival humanisers (that needs paid accounts; DESK-301). One run per
passage. Short passages only. The detector is ScriptGrain's own; other detectors may
disagree. Generated passages are not human writing, and nothing here says anything about
human text.

## 8. Competing interests
ScriptGrain sells this humaniser and sells voice matching. H3 is a hypothesis the product's
positioning would like to be true; it is tested with an equivalence margin fixed here, and
it is reported whichever way it falls.

## 9. Changes after freezing
- 2026-10-12, before any passage was generated: both generators receive every prompt with
  the same suffix, "Output only the text.", because a smoke test (on a prompt outside the
  corpus) showed the codex CLI wrapping its answer in commentary. It is a formatting
  instruction, not a style one, and applies to both arms alike. The codex CLI's model is
  whatever its account default is on the day; the generation log records it.
