# SGR-026: Are new Wikipedia articles written differently since ChatGPT?

Pre-registration: `docs/research/sgr-026-preregistration.md` (frozen before the full run).
Release: Thursday 6 November 2026. Conducted: Wednesday 5 November 2026 (the day before, run once).

| File | What it does |
|---|---|
| `collect.mjs` | Phase `bounds`: the first page ID of each month (binary search on first-revision times). `index`: seeded random IDs per month, kept if the page is an article today. `fetch`: first revision (wikitext) + first 50 revisions' edit summaries. `users`: bot-account lookup. `deletions`: share of mainspace creation-log entries since deleted. Polite (identified user agent, serial, maxlag=5, 429 back-off), resumable, logged. Text goes to `~/research/sgr-026/` and is never committed (it is CC BY-SA). |
| `lib.mjs` | Frozen rules: eras, wikitext to plain prose (the cleaner), exclusion thresholds, the measures (same code as `brand-series/measure.mjs` and SGR-020), moved-in detection. |
| `selftest.mjs` | Fixed-fixture tests of the cleaner and rules. `bun scripts/experiments/sgr-026/selftest.mjs` must exit 0. |
| `validate-cleaner.mjs` | Compares our cleaner with Wikipedia's own plain-text rendering on 100 current articles. Pass criteria in the pre-registration. Already run; do not repeat on D-1. |
| `run.mjs` | The full measurement and analysis. Deterministic. Writes `public/research/sgr-026-*` (summary JSON, CSVs, three SVG charts). |
| `charts.mjs` | The three static charts (called by `run.mjs`). |
| `write-entry.mjs` | Builds the SGR-026 entry in `src/data/research-pages.json` (and the `public/` copy) from the summary. No number is typed by hand. |

## Corpus (already collected, do not repeat on D-1)
```
bun scripts/experiments/sgr-026/collect.mjs status
# expect: months_expected 141, bounds 142, months_indexed 141, articles_sampled == first_revisions_fetched, users true, deletions true
```
Corpus lives in `~/research/sgr-026/` (`bounds.json`, `index/YYYY-MM.json`, `bodies/YYYY-MM.jsonl.gz`,
`users.json`, `deletions.json`, `cleaner-validation.json`, `collect.log`). If a re-collection is ever
wanted: `collect.mjs all` (resumes where it stopped; ABOUT_COLLECT_TIME). Do NOT re-collect on D-1: the
pre-registration describes this corpus (the sample is seeded, but Wikipedia changes: pages get
deleted or turned into redirects, which would change what is "an article today").

## D-1 commands (Wednesday 5 November 2026)
Run from the worktree/checkout of the PR branch, after merging `main` into it if needed.
```
cd ~/repos/scriptgrain-sgr-026   # or any checkout of research/sgr-026-prep
ln -s ~/repos/scriptgrain/node_modules node_modules   # if not installed; remove before committing
bun scripts/experiments/sgr-026/selftest.mjs                         # must exit 0
bun scripts/experiments/sgr-026/run.mjs                              # RUN_TIME_PLACEHOLDER
bun scripts/experiments/sgr-026/write-entry.mjs --conducted-on 2026-11-05 --publish-on 2026-11-06
npx vitest run src/test/research.test.ts src/test/pages/Research.test.tsx src/test/worker/research-worker.test.ts
```
Then, in the PR: `rm node_modules`, commit by path (`public/research/sgr-026-*`,
`src/data/research-pages.json`, `public/research-pages.json`), update `public/llms.txt` and run
`node scripts/generate-llms-artifacts.mjs` if the repo's rules for a new public study require it
(CLAUDE.md: llms.txt is part of every page), push, check CI is green, ask Jack for the go (his standing go
covers this study on this date only), merge on the evening of 5 November. The page shows itself at 00:00 UTC
on 6 November.

Guards: `write-entry.mjs` refuses a pilot summary, refuses if the summary's `ranOn` is not
`--conducted-on`, and refuses a `--publish-on` that is not the next day. If the run slips a day,
run `run.mjs` again on the new day; never edit a date.

What to check after `run.mjs` (read the stderr tail and the summary):
- `corpus.kept` is in the thousands (the pilot-sized expectation is roughly half the sampled articles; if it is far lower, look at `corpus.excluded`).
- `H1.months_from` is about 47 and `H1.months_to` about 33 (months with at least 15 measured articles); a much smaller count means a month-size problem, not a result.
- Every hypothesis has a `result`; none has `lo: null` (that means fewer than 3 months in a period).
- `corpus.excluded.month_differs_from_id_interval` is small (under 2% of fetched); `bot_created_set_aside` is reported.
- `S.sgr020` is non-null if SGR-020 is published by then (`public/research/sgr-020-summary.json` on main); null just drops the sentence.
- Do not change any threshold, list, era or test to make a result look different; failures are reported.

## Pilot (tests the code, never published)
```
bun scripts/experiments/sgr-026/run.mjs --pilot      # 4% hash sample, min month 1, writes ~/research/sgr-026/pilot-out/
```
Pilot output stays under `~/research/sgr-026/pilot-out/`. To test `write-entry.mjs` against it
use `--summary ~/research/sgr-026/pilot-out/sgr-026-summary.json --figures ~/research/sgr-026/pilot-out --allow-pilot`,
run the research tests, then `git checkout src/data/research-pages.json public/research-pages.json`.

## Notes
- Measurement uses product code only (`sgr-007/instruments.mjs`, `scanCliches`, `measureTextFeatures`, `measureBurstiness`). No language-model call, API key or Firecrawl.
- Needs `bun` and `node_modules` (the supabase `_shared` TypeScript modules are imported directly).
- Source: English Wikipedia (MediaWiki Action API). Text is CC BY-SA 4.0: we publish numbers and page IDs, never text, titles or user names.
- Page IDs reach `en.wikipedia.org/?curid=<id>`.
