# SGR-021: which classic authors write most like an AI?

Pre-registration: `docs/research/sgr-021-preregistration.md` (frozen 2026-10-11). Release Tue 21 Oct 2026;
full run (D-1) Mon 20 Oct. Numbers only are published; Gutenberg text stays in
`~/research/sgr-021-classic/` (gzipped, never committed).

## Files
- `sources.json`: every frozen setting (seed, thresholds, catalogue sha256).
- `wd-authors.rq` and `wd-authors.json`: the Wikidata query and its saved result. `pg_catalog.csv` lives in the data dir.
- `lib.mjs`: shared cleaning (so the word count in the panel equals the one measured).
- `build-corpus.mjs`: builds `panel.json` from the rules and downloads the texts. Already run (prep).
- `panel.json`: the panel (author and book ids and word counts, no text). Committed with the pre-registration.
- `run.mjs`: the full measurement and analysis. Uses SGR-007's `lexicons.json` and checks its counts
  against SGR-007's `instruments.mjs` before writing.
- `charts.mjs`: the two SVG charts, called by `run.mjs`; `bun scripts/experiments/sgr-021/charts.mjs` rebuilds them from the summary
  without re-measuring (added at D-1, 2026-10-20: labels to 3 decimals; presentation only).
- `write-entry.mjs`: builds the `SGR-021` entry in `src/data/research-pages.json` (and the mirror
  `public/research-pages.json`) from the summary only.

## D-1 (Mon 20 Oct 2026): exact commands
Take a lease first (`node ~/repos/claude-foreman/src/cli.mjs lease scriptgrain --what "SGR-021 full run"`)
or work in the SGR-021 worktree, on the `research/sgr-021-classic-prep` branch (rebased on main).
The run's date is the study's "conducted" date, so do it on the day before release and not earlier.

```bash
cd ~/repos/scriptgrain-sgr021-classic            # or any checkout of the branch
ln -s ~/repos/scriptgrain/node_modules node_modules   # do not commit it
# 1. Full measurement and analysis (about 1 to 1.5 hours; run in the background)
nohup bun scripts/experiments/sgr-021/run.mjs --data ~/research/sgr-021-classic > ~/research/sgr-021-classic/run.log 2>&1 &
# 2. When run.log ends with "wrote public/research/sgr-021-*": build the entry
bun scripts/experiments/sgr-021/write-entry.mjs --conducted-on 2026-10-20 --publish-on 2026-10-21
# 3. Check, then commit by path (never git add -A), push to the PR, and merge once CI is green (Jack's standing go, 2026-10-11)
bunx vitest run src/test/research.test.ts
git add public/research/sgr-021-*.{json,csv,svg} src/data/research-pages.json public/research-pages.json
```
`run.mjs` is deterministic: the same panel, texts and seed give byte-identical outputs. If the texts
dir was lost, re-run `build-corpus.mjs --data ~/research/sgr-021-classic` first (about 3 hours,
resumable); it refuses a catalogue that does not match the frozen sha256, and the panel it writes
must be identical to the committed `panel.json` (`git diff --stat` should be empty; if not, stop and
list it as a deviation).

## Pilot (what was run in prep; not for publication)
```bash
bun scripts/experiments/sgr-021/run.mjs --data ~/research/sgr-021-classic --pilot     # writes to <data>/pilot/
bun scripts/experiments/sgr-021/write-entry.mjs --conducted-on 2026-10-11 --publish-on 2026-10-12 \
  --summary ~/research/sgr-021-classic/pilot/sgr-021-summary.json --allow-pilot       # then git checkout the two json files
```

## Notes for D-1
- The full run needs about 1 to 1.5 hours of one CPU core (about 0.55 s per book, much of it the
  product's `scanCliches` pattern scan) plus a few minutes of bootstrap.
- "testament to" is not in the frozen lists (SGR-007 lexicons); the per-tell table covers the lists
  as frozen. Do not add words after freezing; list any addition under "Deviations".
- Read the whole entry before merging: the findings text is generated from the results and
  labels H1 to H4 supported or not supported by the pre-registered criteria. Check that the
  sentences still make sense if a hypothesis failed.
- Go back to Jack only if a result cannot be reported as pre-registered, the run fails, or the date or topic would change.
