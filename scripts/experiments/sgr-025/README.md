# SGR-025: The ScriptGrain Writing Index, Q4 2026

Pre-registration: `docs/research/sgr-025-preregistration.md` (frozen 2026-10-11). Release Tuesday
4 November 2026; the full run is on D-1, Monday 3 November 2026, so the page's "conducted" date is
true. **The fetching is already done (11 October 2026). Do NOT run `collect.mjs` on D-1**: it would
spend shared Firecrawl credits and the page says "collected 11 October 2026".

| File | What it does |
|---|---|
| `index-definition.json` | The frozen Index definition: six measures, statistics, thresholds, version, changelog, seeds |
| `lib.mjs` | `measureHtml` (SGR-004's row-building, proven by `verify.mjs`), statistics, seeded bootstrap, page reader |
| `collect.mjs` | Fetch step, already done: live homepages, the repeat fetch and the Wayback re-renders. Resumable; logs the Firecrawl balance before and after |
| `verify.mjs` | Instrument check: this code against SGR-004's published 2026 rows for the 8 pilot sites. Already run; writes `~/research/sgr-025/verify.json` |
| `thresholds.mjs` | Derives the thresholds from SGR-004's published rows (already in `index-definition.json`) |
| `run.mjs` | The whole measurement and analysis. Writes `public/research/scriptgrain-writing-index.{csv,json}`, `sgr-025-summary.json`, `sgr-025-vocab.svg`, `sgr-025-em-dash.svg` |
| `charts.mjs` | The two SVG figures (called by `run.mjs`) |
| `write-entry.mjs` | Builds the `SGR-025` entry in `src/data/research-pages.json` (and the `public/research-pages.json` mirror) from the summary |

## Data on disk (nothing to download on D-1)

`~/research/sgr-025/` (about 26 MB, gzipped pages):
- `live/<domain>.html.gz` or `.html.fail`: 161 files in all. Expect **155 pages and 6 `.fail`** (aa.com, ebay.com, linkedin.com, ryanair.com, southwest.com, yelp.com: Firecrawl refuses these sites). Do not retry them.
- `live-repeat/`: the 16 repeat-fetch sites (`ls live-repeat | wc -l` = 16). `wayback/`, `wayback2/`, `wayback3/`: the instrument check.
- `verify.json` (4 of 8 identical) and `credits.jsonl` (balance 49,513 before, 49,315 after; 198 spent).
- In the repo: `public/research/sgr-004-web-copy-rows.json` (SGR-004's published rows).

## D-1 commands (Monday 3 November 2026)

Run after 00:00 UTC on 3 November (the entry builder refuses a summary generated on another UTC date).

```bash
cd ~/repos/scriptgrain-sgr-025 && git fetch -q && git merge origin/main               # worktree on research/sgr-025-prep
ln -s ~/repos/scriptgrain/node_modules node_modules                                    # remove before committing
ls ~/research/sgr-025/live | wc -l                                                     # expect 161
ls ~/research/sgr-025/live-repeat | wc -l                                              # expect 16
bun scripts/experiments/sgr-025/run.mjs 2> ~/research/sgr-025/run.log                  # full run, about 1 to 2 minutes
bun scripts/experiments/sgr-025/write-entry.mjs --conducted-on 2026-11-03 --publish-on 2026-11-04
npx vitest run src/test/research.test.ts src/test/worker                               # then the full suite and `npm run typecheck`, as CI does
rm node_modules
git add public/research/scriptgrain-writing-index.csv public/research/scriptgrain-writing-index.json public/research/sgr-025-* public/research-pages.json src/data/research-pages.json
```

Then commit by path, push, wait for CI green, update the PR body with the results, ask for Jack's go
(his standing go of 2026-10-11 covers this date) and merge on the evening of D-1. Never run the command
with `| tail`: the exit code matters.
`run.mjs --pilot` writes to `~/research/sgr-025/pilot-out` and never touches the repo.

## What to check after the run

- `sgr-025-summary.json`: `coverage.measured` (expect roughly 100 to 120 of 161), `coverage.matched_sites`
  (must be at least 80, else `write-entry.mjs` refuses: then stop and ask Jack), `coverage.comparison_assessed` true.
- `checks.instrument_reproduction.identical` = 4 (a lower number means files changed on disk), and
  `checks.credits.spent` 198 (budget 500) with `balance_after_last_call` 49,315 (floor 10,000).
- `checks.repeat_fetch.measured_both_times` is the number of the 16 sites measured on both fetches.
- Every comparison `label_result` is one of the three pre-registered results; whatever they are, report them as they come
  (the entry text is generated from the summary). Do not edit thresholds or the definition; a change goes in the
  pre-registration's "Deviations" with the date and reason.
- Open the three CSV/JSON downloads: the CSV should have 4,347 + 161 = 4,508 data rows and the column order in `scriptgrain-writing-index.json`.

## Runtime (estimated from the pilot, which took 3 seconds)

| Step | Time |
|---|---|
| Measure 155 stored pages (the biggest, hubspot.com, is 16 MB and takes about 2 seconds) | 20 to 40 seconds |
| Join, 2,000 bootstrap resamples x 6 measures, charts, files | under 30 seconds |

Output is deterministic: re-running gives identical files except `generated` and `runtime_seconds`.

## What could break on D-1

- A missing `~/research/sgr-025/live` (the script counts missing pages under `exclusions.not_fetched` rather than failing; any non-zero value means files are gone: stop and ask Jack, do not re-fetch).
- The summary must be generated on the same UTC date as `--conducted-on`.
- `bun` must be used (the instruments are TypeScript files imported by `.mjs`).
