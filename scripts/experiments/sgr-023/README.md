# SGR-023: What reading age do UK brands write for?

Pre-registration: `docs/research/sgr-023-preregistration.md` (frozen 2026-10-12). Release Tuesday 28 October 2026;
the full run is on D-1, Monday 27 October 2026, so the page's "conducted" date is true.

| File | What it does |
|---|---|
| `syllables.mjs` | The rule-based syllable counter (frozen) |
| `validate-syllables.mjs` | Checks the counter against the CMU Pronouncing Dictionary (dev and test halves). Not part of the D-1 run, which repeats the check on corpus words |
| `cmu.mjs` | Loads `cmudict.dict` and refuses a file whose SHA-256 differs from the frozen one |
| `readability.mjs` | Running-prose extraction, sentence and word rules, FRE, Flesch-Kincaid grade, reading age and supporting measures |
| `stats.mjs` | Brand-weighted summaries and the cluster bootstrap (brands resampled within sectors) |
| `run.mjs` | The whole measurement and analysis. Writes `public/research/sgr-023-*` |
| `charts.mjs` | The two SVG figures (called by `run.mjs`) |
| `write-entry.mjs` | Builds the `SGR-023` entry in `src/data/research-pages.json` (and the `public/research-pages.json` mirror) from the summary |

## Data on disk (nothing to download on D-1)

- `~/research/sgr-023/brand/*.jsonl.gz`: 122 brand files, a copy of Storage Box `research/scriptgrain-brand-corpus/v1/pages` (v1.4, 4 Oct 2026)
- `~/research/sgr-023/cmudict.dict`: CMU Pronouncing Dictionary, SHA-256 `81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22`
- `~/research/sgr-023/pilot-out/`: pilot output (not committed, numbers not reported)

## D-1 commands (Monday 27 October 2026)

Run after 00:00 UTC on 27 October (the entry builder refuses a summary generated on another UTC date).
Needs the repo's `node_modules` for the tests (`ln -s ~/repos/scriptgrain/node_modules node_modules`, and remove the symlink before committing).

```bash
cd ~/repos/scriptgrain-sgr-023 && git fetch -q && git merge origin/main        # worktree on research/sgr-023-prep
ls ~/research/sgr-023/brand | wc -l                                            # expect 122
sha256sum ~/research/sgr-023/cmudict.dict                                      # expect 81917843...3d22
bun scripts/experiments/sgr-023/run.mjs 2> ~/research/sgr-023/run.log          # full run, about 15 minutes
bun scripts/experiments/sgr-023/write-entry.mjs --conducted-on 2026-10-27 --publish-on 2026-10-28
npx vitest run src/test/research.test.ts src/test/worker/research-worker.test.ts src/test/pages/Research.test.tsx   # then the full suite and typecheck, as CI does
git add public/research/sgr-023-* public/research-pages.json src/data/research-pages.json
```

Then commit by path, push, wait for CI green, update the PR body with the results, merge on the evening of D-1 under Jack's standing go.
`run.mjs --pilot` writes to `~/research/sgr-023/pilot-out` and never touches the repo. `run.mjs --synthetic` tests the analysis code on invented data.
Never run a pilot or synthetic output through `write-entry.mjs` for the real page.

## Runtime (estimated from the pilot, which took 6 s for 259 pages)

| Step | Full |
|---|---|
| Read and score about 16,000 pages (3 scorings each) | about 5 to 7 minutes |
| Hypotheses, sensitivities, by-year series (2,000 resamples each) | about 4 to 8 minutes |
| Figures and files | seconds |

Expect 10 to 20 minutes; allow 40. Memory under 2 GB. Output is deterministic: re-running gives identical files except `generated` and `runtime_seconds`.

## What to check on D-1 (before running write-entry)

- `summary.corpus`: about 15,900 scored pages from about 117 brands. `exclusions.no_file` must be 0.
- `summary.syllable_validation.pass` must be `true`. If false, write-entry refuses. Do not publish; report to Jack (standing go does not cover a result that cannot be reported honestly under the registered rules).
- `hypotheses.H1`, `H2`, `H3`: each has `result` of supported, not supported, reversed or not testable. All four outcomes are reported as they come. H3 needs 8 eligible brands in each group (about 8 and 19 expected); "not testable" is a legitimate, publishable outcome.
- The entry's wording is generated from the summary; read the abstract's "What we found" once for sense.
- The CI guards: no em or en dashes in `src/data/research-pages.json`; `public/research/sgr-023-*.svg`, `.csv` and `.json` all present (the entry links them).

## What could break on D-1

- A brand file missing (count above) or `cmudict.dict` changed (the loader throws).
- Running it twice at once (not harmful, just slow).
- The summary must be generated on the same UTC date as `--conducted-on`.
