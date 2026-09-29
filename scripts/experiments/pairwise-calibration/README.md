# Pairwise voice-check calibration (2026-09-29)

Sets `PAIRWISE_ANCHORS` in `supabase/functions/_shared/voice-check.ts`, the scale behind the free off-voice check, `/v1/compare-voice`, MCP `compare_voice` and reviewnudge.app's reply-writer check.

**Why:** a gushing stock reply scored 0.85 "on voice" against a plain one. The old anchors came from one example.

**Method:** 12 single-author blogs from the reference-corpus feeds, 3 to 4 posts each, cut to 300- and 700-word excerpts (`fetch.mjs`). Each excerpt was scored as `main` through the live `/v1/compare-voice` against the other pieces by the same writer and against 3 random pieces by other writers (`score.mjs`). That gives 558 pairs; `results.jsonl` keeps `raw`, `score` and `band` per pair, with no text. The excerpts (`corpus.json`) and the temporary API key (`key.json`) are not committed.

**Result (`analyse.mjs`, `fit.mjs`):**

| | same writer | different writers |
|---|---|---|
| raw median | 0.667 | 0.620 |
| raw p10 / p90 | 0.56 / 0.78 | 0.50 / 0.72 |

AUC 0.67 overall (0.63 at 300 words, 0.70 at 700).

Old anchors: 40% of different-writer pairs read "on voice". New anchors put "on voice" at raw 0.72 (about p90 of different writers) and "off voice" under raw 0.56 (about p10 of the same writer). The result:

| band | same writer | different writers |
|---|---|---|
| on voice | 30% | 10% |
| drifting | 60% | 65% |
| off voice | 10% | 26% |

`delta.ts`: offline, on code-measured features only, Burrows-Delta and function-word variants reach AUC 0.58 to 0.66, no better than the engine. The limit is sample length and writers of one register, not the comparator.

**Re-run:** `node fetch.mjs`, put `{"secret":"sg_live_…"}` in `key.json` (a throwaway key; delete it after), then `node score.mjs` (about 20 minutes, rate-paced) and `node analyse.mjs` / `node fit.mjs`.
