# SGR-020: Did government writing change after ChatGPT?

Pre-registration: `docs/research/sgr-020-preregistration.md` (frozen before the full run).
Release: Thursday 16 October 2026. Conducted: Wednesday 15 October 2026 (the day before, run once).

| File | What it does |
|---|---|
| `collect.mjs` | Phase 1 `index`: lists every GOV.UK `press_release` and `news_story` (Search API, by month). Phase 2 `fetch`: the body of each (Content API). Polite (identified user agent, 4 requests a second), resumable, logged. Text goes to `~/research/sgr-020/` and is never committed. |
| `lib.mjs` | Frozen rules: department lineages, eras, HTML to plain text, exclusion thresholds, the measures (same code as `brand-series/measure.mjs`). |
| `run.mjs` | The full measurement and analysis. Deterministic. Writes `public/research/sgr-020-*` (summary JSON, three CSVs, three SVG charts). |
| `charts.mjs` | The three static charts (called by `run.mjs`). |
| `write-entry.mjs` | Builds the SGR-020 entry in `src/data/research-pages.json` (and the `public/` copy) from the summary. No number is typed by hand. |

## Corpus (already collected, do not repeat on D-1)
```
bun scripts/experiments/sgr-020/collect.mjs status      # items_indexed == bodies_fetched
```
Corpus lives in `~/research/sgr-020/` (`index/YYYY-MM.json`, `bodies/YYYY-MM.jsonl.gz`,
`collect.log`). If a re-collection is ever wanted, run `collect.mjs index` then
`collect.mjs fetch` (resumes where it stopped; about 4.3 hours for 62,000 items at 4 a second).
Do NOT re-collect on D-1: the pre-registration describes this corpus.

## D-1 commands (Wednesday 15 October 2026)
Run from the worktree/checkout of the PR branch, after merging `main` into it if needed.
```
cd ~/repos/scriptgrain-sgr020   # or any checkout of research/sgr-020-prep
ln -s ~/repos/scriptgrain/node_modules node_modules   # if not installed; remove before committing
bun scripts/experiments/sgr-020/run.mjs                              # RUN_TIME_PLACEHOLDER
bun scripts/experiments/sgr-020/write-entry.mjs --conducted-on 2026-10-15 --publish-on 2026-10-16
npx vitest run src/test/research.test.ts src/test/pages/Research.test.tsx src/test/worker/research-worker.test.ts
```
Then, in the PR: `rm node_modules`, commit by path (`public/research/sgr-020-*`,
`src/data/research-pages.json`, `public/research-pages.json`), update `public/llms.txt` and run
`node scripts/generate-llms-artifacts.mjs` if the repo's rules for a new public study require it,
push, check CI is green, ask Jack for the go, merge on the evening of 15 October. The page shows
itself at 00:00 UTC on 16 October.

Guards: `write-entry.mjs` refuses a pilot summary, refuses if the summary's `ranOn` is not
`--conducted-on`, and refuses a `--publish-on` that is not the next day. If the run slips a day,
run `run.mjs` again on the new day; never edit a date.

## Pilot (tests the code, never published)
```
bun scripts/experiments/sgr-020/run.mjs --pilot      # 4% hash sample, min cell 2, writes ~/research/sgr-020/pilot-out/
```
Pilot output stays under `~/research/sgr-020/pilot-out/`. To test `write-entry.mjs` against it
use `--summary ~/research/sgr-020/pilot-out/sgr-020-summary.json --figures ~/research/sgr-020/pilot-out --allow-pilot`,
run the research tests, then `git checkout src/data/research-pages.json public/research-pages.json`.

## Notes
- Measurement uses product code only (`sgr-007/instruments.mjs`, `scanCliches`, `measureTextFeatures`, `measureBurstiness`). No language-model call, API key or Firecrawl.
- Needs `bun` and `node_modules` (the supabase `_shared` TypeScript modules are imported directly).
- Source: GOV.UK, Open Government Licence v3.0. We publish numbers and page paths, never text.
