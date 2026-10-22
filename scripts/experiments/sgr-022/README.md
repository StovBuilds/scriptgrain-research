# SGR-022: Do ministers' written answers sound different since ChatGPT?

Pre-registration: `docs/research/sgr-022-preregistration.md` (frozen before the full run).
Release: Thursday 23 October 2026. Conducted: Wednesday 22 October 2026 (the day before, run once).

| File | What it does |
|---|---|
| `collect.mjs` | `index` lists answered written questions (by tabled week) and written statements (by month) from the UK Parliament Questions and Statements API; `sample` draws the fixed-seed stratified sample; `fetch` gets the full text of every sampled answer and every statement; `status`. Polite (identified user agent, 3 requests a second, back-off, resumable, logged). Data goes to `~/research/sgr-022-hansard/` and is never committed. |
| `lib.mjs` | Frozen rules: frame, sampling constants, department lineages, eras, HTML to plain text, exclusion rules, the measures (same code as `brand-series/measure.mjs` and SGR-020). |
| `run.mjs` | The full measurement and analysis. Deterministic. Writes `public/research/sgr-022-*` (summary JSON, three CSVs, three SVG charts). |
| `charts.mjs` | The three static charts (called by `run.mjs`); `bun scripts/experiments/sgr-022/charts.mjs` rebuilds them from the summary without re-measuring (added at D-1, 2026-10-22: the year chart's small figures are answers, not pages; presentation only). |
| `write-entry.mjs` | Builds the SGR-022 entry in `src/data/research-pages.json` (and the `public/` copy) from the summary. No number is typed by hand. |

## Corpus (already collected, do not repeat on D-1)
```
node scripts/experiments/sgr-022/collect.mjs status
#  expect: weeksDone 628, monthsDone 142, sampled ~60000, qBodies == sampled, sBodies == statements frame
```
Corpus lives in `~/research/sgr-022-hansard/` (`index/`, `sample.json`, `sample-report.json`,
`bodies/questions.jsonl.gz`, `bodies/statements.jsonl.gz`, `collect.log`). To collect from scratch:
`collect.mjs index` (about 5 hours, the API answers a list call in 5 to 30 seconds), `collect.mjs sample`
(seconds), `collect.mjs fetch` (about 6 hours at under 3 requests a second); each resumes where it
stopped. Do NOT re-collect on D-1: the pre-registration describes this corpus, and a re-index would
change the frame.

## D-1 commands (Wednesday 22 October 2026)
Run from the worktree/checkout of the PR branch, after merging `main` into it if needed.
```
cd ~/repos/scriptgrain-sgr022   # or any checkout of research/sgr-022-hansard-prep
ln -s ~/repos/scriptgrain/node_modules node_modules   # if not installed; remove before committing
bun scripts/experiments/sgr-022/run.mjs                              # about 5 minutes (296 s on 2026-10-22)
bun scripts/experiments/sgr-022/write-entry.mjs --conducted-on 2026-10-22 --publish-on 2026-10-23
npx vitest run src/test/research.test.ts src/test/pages/Research.test.tsx src/test/worker/research-worker.test.ts
```
Then, in the PR: `rm node_modules`, commit by path (`public/research/sgr-022-*`,
`src/data/research-pages.json`, `public/research-pages.json`), update `public/llms.txt` and run
`node scripts/generate-llms-artifacts.mjs` if the repo's rules for a new public study require it, push,
check CI is green, ask Jack for the go, merge on the evening of 22 October. The page shows itself at
00:00 UTC on 23 October.

Guards: `write-entry.mjs` refuses a pilot summary, refuses if the summary's `ranOn` is not
`--conducted-on`, and refuses a `--publish-on` that is not the next day. If the run slips a day, run
`run.mjs` again on the new day; never edit a date. `run.mjs` reads `public/research/sgr-020-summary.json`
for the comparison with SGR-020 if it is present on the branch (merge `main` first once SGR-020 has
merged), and skips the comparison if not.

## Pilot (tests the code, never published)
```
bun scripts/experiments/sgr-022/run.mjs --pilot      # 4% hash sample, min cell 2, writes <data>/pilot-out/, prints no results
```
Pilot output stays under `~/research/sgr-022-hansard/pilot-out/`. To test `write-entry.mjs` against it use
`--summary ~/research/sgr-022-hansard/pilot-out/sgr-022-summary.json --figures ~/research/sgr-022-hansard/pilot-out --allow-pilot`,
run the research tests, then `git checkout src/data/research-pages.json public/research-pages.json`.

## Notes
- Measurement uses product code only (`sgr-007/instruments.mjs`, `scanCliches`, `measureTextFeatures`, `measureBurstiness`). No language-model call, API key or Firecrawl.
- Needs `bun` and `node_modules` (the supabase `_shared` TypeScript modules are imported directly). `collect.mjs` runs on plain node 22.
- Source: UK Parliament, Open Parliament Licence v3.0. We publish numbers and question/statement IDs, never text.
