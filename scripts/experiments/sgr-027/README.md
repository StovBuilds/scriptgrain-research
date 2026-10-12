# SGR-027: what does a humaniser actually change?

Pre-registration: `docs/research/sgr-027-preregistration.md` (frozen before generation).
Release: Wednesday 11 November 2026. Conducted: Tuesday 10 November 2026 (the day before, run once).

| File | What it does |
|---|---|
| `prompts.json` | The 20 frozen prompts (5 formats x 4 topics) and which model writes each. |
| `generate.mjs` | Wrote the 20 passages (Claude via the `claude` CLI, GPT via the `codex` CLI). **Already run. Do NOT run it again.** |
| `out/passages.json` | The frozen corpus: the 20 generated passages. Committed. Do not edit or regenerate. |
| `run.mjs` | Humanises each passage (`/v1/humanize`, `force: true`) and measures both texts. Calls ScriptGrain's API, so it costs money. Writes `out/results.json` (each record carries `measuredAt`). |
| `analyse.mjs` | Tests H1 to H4 (paired bootstrap, 10,000 resamples, seed 20261012) and the exploratory measures. Writes `out/analysis.json` (with `ranOn`). |
| `write-entry.mjs` | Builds the SGR-027 entry in `src/data/research-pages.json` (and the `public/` copy) and the three data files in `public/research/` from `out/`. No number is typed by hand. |
| `numbers.mjs`, `pilot-passage.json` | Number-token helper shared with the product's integrity guard; the one passage (outside the corpus) used to check the pipeline. |

## State on the branch (already done, do not repeat on D-1)
- Generation is DONE. `out/passages.json` is the corpus the pre-registration describes. Never re-run `generate.mjs`: a re-run would produce different passages and invalidate the study.
- The pipeline pilot (`run.mjs --pilot`, one passage outside the corpus) is DONE; its output is `out/pilot.json`, not part of the study.
- `out/results.json` and `out/analysis.json` do not exist yet. They are produced on D-1 and committed with the page.

## D-1 commands (Tuesday 10 November 2026)
Run from the worktree/checkout of the release branch (the prep branch merged into a branch off `main`).
```
cd ~/repos/scriptgrain-sgr-027-release   # or any checkout containing this folder
ls scripts/experiments/sgr-027/out   # expect passages.json (and pilot.json); NO results.json / analysis.json
ln -s ~/repos/scriptgrain/node_modules node_modules   # if not installed; remove before committing
nohup bun scripts/experiments/sgr-027/run.mjs > /tmp/sgr027-run.log 2>&1 &   # 20 passages, a few minutes; wait for it (it is resumable)
bun scripts/experiments/sgr-027/analyse.mjs
bun scripts/experiments/sgr-027/write-entry.mjs --conducted-on 2026-11-10 --publish-on 2026-11-11
npx vitest run src/test/research.test.ts src/test/pages/Research.test.tsx src/test/worker/research-worker.test.ts
npx vitest run src/test/no-em-dashes.test.ts src/test/marketing-prices.test.ts src/test/llms-coverage.test.ts
```
Never pipe `run.mjs` (an exit code you cannot see is a silent failure); watch the log with `tail`. Run the three steps the same UTC day: the guards below refuse a run measured on any other day.

Then, in the PR: `rm node_modules`, commit by path (`scripts/experiments/sgr-027/out/results.json`, `scripts/experiments/sgr-027/out/analysis.json`, `public/research/sgr-027-*`, `src/data/research-pages.json`, `public/research-pages.json`), update `public/llms.txt` (a line for the study under the research pages, and the "Last updated" date) and run `node scripts/generate-llms-artifacts.mjs` so `llms-full.txt` and the `.md` mirrors follow (CLAUDE.md: llms.txt is part of every page; `llms-coverage.test.ts` checks it; revert the generated `public/sitemap.xml` and `llms-full.txt` churn per the scriptgrain-publishing skill, keeping the `public/<thing>.json` copies), push, check CI is green (`gh pr view --json statusCheckRollup`; `gh pr checks` has no `--json`), merge once CI is green. Jack gave a standing go (2026-10-11): the automated D-1 lane merges once CI is green, and comes back to Jack only if a result can't be reported as pre-registered, the run fails, or the date or topic would change (docs/plans/research-next-8.md). The page shows itself at 00:00 UTC on 11 November.

Guards: `write-entry.mjs` refuses output whose `analysis.json` `ranOn` is not `--conducted-on`, results whose `measuredAt` days are not `--conducted-on`, a `--publish-on` that is not the next day, any pilot output (`PILOT` id), and any run that is not 20 complete pairs. If the run slips a day, delete `out/results.json` and `out/analysis.json`, re-run `run.mjs` and `analyse.mjs` on the new day, and use the new dates; never edit a date.

## What to check after the run
- `out/results.json` has 20 records, every one with `before` and `after` measured (`human_score`, `tells_per1000`, `voice_match` non-null) and a non-empty `humanised` text. `run.mjs` throws if the humaniser returns no text; just re-run it (it skips finished passages) unless the day has changed.
- `analysis.json`: `n` is 20, and every hypothesis H1 to H4 has a result (`holds` true or false; `H4.of` is 20). `showcase` lists 3 to 5 distinct ids.
- A `holds: false` is a result, not a failure: the page reports every hypothesis as it came out. Do not change a measure, threshold, margin, seed or hypothesis to make a result look different. The pre-registration §9 lists the only change after freezing.
- `exploratory.would_skip_by_default`, `reached_target` and `passes_discarded` are plausible (0 to 20, 0 to 20, at most `passes_run`).
- Read the page text `write-entry.mjs` produced in `src/data/research-pages.json` against `analysis.json`: numbers match, every hypothesis is stated with its interval, §7 limits and §8 competing interests are on the page, exploratory sections are labelled exploratory, and no sentence claims measurement can tell whether a text was written by AI.
- The five before/after pairs on the page are the largest, median and smallest detector gain and the largest voice-match rise and fall (pre-registration §6); em and en dashes inside the texts are shown as `[em dash]` and `[en dash]` because the site prints none.

## Billing and credentials
`run.mjs` calls api-v1 (`/v1/humanize`, `/v1/ai-detect`, `/v1/voice-match`) with `SCRIPTGRAIN_API_KEY` and `SCRIPTGRAIN_SUPABASE_NEW_URL`, read by parsing `~/.bot-infra.env` (never `source` that file: values contain `$` and quotes). Humanise bills ScriptGrain's own model key (Jack's go, 2026-10-12); it is one humanise call per passage, 20 in all. The measurement itself makes no model call of its own beyond those. Do not run `generate.mjs`, and do not run `run.mjs` more than needed: it skips passages already in `out/results.json`, so a resume costs only what is left.

## Notes
- Model outputs are not deterministic, so a re-run reproduces the method, not the exact texts; the texts measured are published in `public/research/sgr-027-pairs.json`.
- Measurement uses product code (`measureTextFeatures`, `scanCliches`, `polish-integrity`, `humanize-integrity`) imported from `supabase/functions/_shared/`; needs `bun` and `node_modules`.
- Testing the builder without spending: build a clearly-fake `results.json`/`analysis.json` in a scratch folder (analysis with `"fixture": true` and a matching `ranOn`), run `write-entry.mjs --in <dir> --allow-fixture`, run the research tests, then `git checkout -- src/data public && git clean -fd public/research`. Never commit that output.
