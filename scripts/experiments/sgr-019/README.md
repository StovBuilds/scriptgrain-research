# SGR-019: Has the em dash really taken over?

Pre-registration: `docs/research/sgr-019-preregistration.md` (frozen 2026-10-11). Release
Tuesday 14 October 2026; the full run is on D-1, Monday 13 October 2026, so the page's
"conducted" date is true.

| File | What it does |
|---|---|
| `dash.mjs` | The dash rule and word count (section 3 of the pre-registration), one function per text family |
| `lib.mjs` | CSV parsing, seeded random numbers, the cluster bootstrap `Panel`, the trend projection |
| `collect-gutenberg.mjs` | Data assembly, already done: downloads the 1,276 books to `~/research/sgr-019/gutenberg` and writes `books.json` (the frozen book list). Not part of the D-1 run |
| `run.mjs` | The whole measurement and analysis. Writes `public/research/sgr-019-*` |
| `charts.mjs` | The two SVG figures (called by `run.mjs`) |
| `write-entry.mjs` | Builds the `SGR-019` entry in `src/data/research-pages.json` (and the `public/research-pages.json` mirror) from the summary |

## Data on disk (nothing to download on D-1)

- `~/research/sgr-008/census-papers.jsonl.gz` and `census/part-*.jsonl.gz`: arXiv (read only)
- `~/research/sgr-019/brand/*.jsonl.gz`: 122 brand files, a copy of Storage Box `research/scriptgrain-brand-corpus/v1/pages` (v1.4, 4 Oct 2026)
- `~/research/sgr-019/gutenberg/<id>.txt.gz`: 1,276 books (needs 1,276 files)
- `~/research/sgr-019/pg_catalog.csv`: Project Gutenberg catalogue snapshot (used only by `collect-gutenberg.mjs`)
- `public/research/sgr-004-web-copy-rows.json` and `sgr-007-pages.csv`: in the repo

## D-1 commands (Monday 13 October 2026)

Run after 00:00 UTC on 13 October (the entry builder refuses a summary generated on another UTC date).
Needs the repo's `node_modules` for the tests (`ln -s ~/repos/scriptgrain/node_modules node_modules`, and remove the symlink before committing).

```bash
cd ~/repos/scriptgrain-sgr019 && git fetch -q && git merge origin/main          # worktree on research/sgr-019-prep
ls ~/research/sgr-019/gutenberg | wc -l                                          # expect 1276
ls ~/research/sgr-019/brand | wc -l                                              # expect 122
bun scripts/experiments/sgr-019/run.mjs 2> ~/research/sgr-019/run.log            # full run, about 25 minutes
bun scripts/experiments/sgr-019/write-entry.mjs --conducted-on 2026-10-13 --publish-on 2026-10-14
npx vitest run src/test/research.test.ts                                         # then the full suite and typecheck, as CI does
git add public/research/sgr-019-* public/research-pages.json src/data/research-pages.json
```

Then commit by path, push, wait for CI green, update the PR body with the results, ask for
Jack's go (his standing go covers these dates), merge on the evening of D-1.
`run.mjs --pilot` writes to `~/research/sgr-019/pilot-out` and never touches the repo.

## Runtime (estimated from the pilot, which took 1 min 30 s)

| Step | Pilot | Full |
|---|---|---|
| Read the arXiv inclusion table (streamed) | about 85 s | about 85 s |
| arXiv abstracts (1 in 40 census files in the pilot) | about 22 s | about 15 min |
| Brand pages (5 of 122 brands) | about 4 s | about 2 min |
| Books (36 of 1,276) | about 4 s | about 2.5 min |
| Bootstrap and charts (200 resamples, pilot) | under 2 s | 1 to 3 min (1,000 resamples) |

Expect 20 to 30 minutes; allow 45. Peak memory about 2 GB (the inclusion table). Output is
deterministic: re-running gives identical files except the `generated` and `runtime_seconds` fields.

## What could break on D-1

- Brand files or books missing from `~/research/sgr-019` (counts above); the script counts
  missing files in `exclusions` rather than failing, so check `exclusions` in the summary.
- `census-papers.jsonl.gz` must be streamed; a `gunzipSync` of it needs about 8 GB. `run.mjs` streams it.
- Do not run it twice at once: both would read 2 GB of table into memory.
- The summary must be generated on the same UTC date as `--conducted-on`.
