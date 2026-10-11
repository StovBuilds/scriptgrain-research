# SGR-024: Did the AI tells reach medicine?

Pre-registration: `docs/research/sgr-024-preregistration.md` (frozen 2026-10-11, first commit of this
branch). A replication of SGR-008 (arXiv) on a 10% hash sample of PubMed abstracts. Release Thursday
30 October 2026; the full run is on D-1, Wednesday 29 October 2026, so the page's "conducted" date is
true. Measurement uses product code only (`measureTextFeatures`, `scanCliches`), no language model, no
network, no API key.

| File | What it does |
|---|---|
| `collect.py` | Data collection, already done (`probe`, `run`, `build`, `verify`, `selftest`). Streams NCBI's baseline and update files, keeps the hash sample. Not part of the D-1 run |
| `mesh-trees.py` | Builds `~/research/sgr-024/ref/mesh-trees.tsv` from the MeSH 2026 descriptor file. Already done |
| `fields.json` | MeSH tree prefix to subject group map (8 groups) and the journal assignment thresholds |
| `sgr008-reference.json` | SGR-008's published numbers, used only as fixed reference values |
| `lib.mjs` | Seeded random numbers, growable typed arrays, cluster table with the journal bootstrap, CSV helpers |
| `run.mjs` | The whole measurement and analysis. Writes `public/research/sgr-024-*` |
| `charts.mjs` | The two SVG figures (called by `run.mjs`) |
| `write-entry.mjs` | Builds the `SGR-024` entry in `src/data/research-pages.json` (and the `public/research-pages.json` mirror) from the summary |

## Data on disk (nothing to download on D-1)

- `~/research/sgr-024/sample.jsonl.gz`: the frozen sample (about 800 MB, 1,673,128 records of which about 1.2 million pass the rules). One JSON object per record, latest version, deletions applied. Built on 2026-10-11 from baseline files 800 to 1334 and update files 1335 to 1676. Never committed or published.
- `~/research/sgr-024/manifest.json`, `verify.json`: collection counts and a 300-record efetch check (all 300 matched on entry date, journal, language, type and text).
- `~/research/sgr-024/ref/`: Kobak et al.'s `excess_words.csv` and `yearly-counts.csv.gz` (MIT licence, copied from github.com/berenslab/llm-excess-vocab), the MeSH 2026 trees.
- `~/research/sgr-024/meta/`: per-file collection counts (records seen, sampled, kept, deletions). The per-file parts were removed after the build to stay under 2 GB; `run.mjs` reads only the sample file.

Do not re-collect on D-1. The sample is frozen so the full run measures exactly what was pre-registered.

## D-1 commands (Wednesday 29 October 2026)

Run after 00:00 UTC on 29 October (the entry builder refuses a summary generated on another UTC date).
The tests need the repo's `node_modules`: `ln -s ~/repos/scriptgrain/node_modules node_modules`, and
remove the symlink before committing.

```bash
cd ~/repos/scriptgrain-sgr-024 && git fetch -q && git merge origin/main        # worktree on research/sgr-024-prep
ls -la ~/research/sgr-024/sample.jsonl.gz                                      # expect about 800 MB
python3 -I -c "import json;print(json.load(open('~/research/sgr-024/manifest.json'))['in_sample_file'])"   # expect 1673128
ls ~/research/sgr-024/ref                                                      # expect excess_words.csv, yearly-counts.csv.gz, mesh-trees.tsv
nohup bun scripts/experiments/sgr-024/run.mjs > ~/research/sgr-024/run.log 2>&1 &   # full run, about 70 minutes; allow 2 hours
tail -f ~/research/sgr-024/run.log                                             # progress lines; last line "done in N s"
bun scripts/experiments/sgr-024/write-entry.mjs --conducted-on 2026-10-29 --publish-on 2026-10-30
npx vitest run src/test/research.test.ts src/test/pages/Research.test.tsx src/test/llms-coverage.test.ts src/test/worker   # then the full suite and typecheck, as CI does
git add public/research/sgr-024-* public/research-pages.json src/data/research-pages.json public/llms.txt
```

Then commit by path, push, wait for CI green, update the PR body with the results, ask for Jack's go
(his standing go covers these dates), merge on the evening of D-1. Do not run it twice at once.
`run.mjs --pilot` (records with hash below 4,000, 200 resamples) writes to
`~/research/sgr-024/pilot-out` and never touches the repo. `write-entry.mjs` refuses a pilot summary.

## Runtime and memory (from the pilot, 55,199 abstracts, 7 minutes)

| Step | Pilot | Full (estimated) |
|---|---|---|
| Read the sample and measure each abstract (pass 1) | about 6 min (reading 1.67 M lines about 4 min, measuring about 2 min) | about 50 min |
| Document frequencies, selection, labelling, bounds | under 1 min | 3 to 5 min |
| Bootstraps (200 pilot, 2,000 full, over about 15,000 journals) and sensitivity analyses | under 1 min | 10 to 20 min |

Expect about 70 minutes; allow 2 hours. Peak memory was 0.55 GB in the pilot; the full run keeps
every abstract's token ids in memory and should need about 2 GB. Output is deterministic: re-running
gives identical files except the `generated` and `runtime_seconds` fields (checked on two pilot runs).

## What to check before `write-entry.mjs`

Open `public/research/sgr-024-summary.json` and confirm:

- `pilot` is `false` and `generated` is today's date (UTC).
- `sample.included` is about 1.2 million; `exclusions` lists no surprise (no_abstract is the largest; `non_english_text` should be tiny).
- `n_by_period` has BASE, Y2024 and Y2026 all in the tens of thousands or more.
- `by_group` has all eight named groups with journals and abstracts in every period; General and Unclassified are separate.
- `excess.style_2024` and `style_2026` each have 50 words (fewer is allowed, but note it); `excess.label_sources` shows how many words each rule labelled.
- `checks.C2.word_years` is 185 (29 words by up to 10 years above Kobak's 1,000-count floor, see the pre-registration).
- `efetch_check` holds the 300-record check (`same_text` 300).
- Nothing in the summary is a text snippet; it holds counts, shares, words from the fixed lists and Kobak/our selected word lists only.

If any pre-registered hypothesis comes out the opposite way to SGR-008, that is the result; publish it as is.

## What could break on D-1

- `sample.jsonl.gz` or `ref/` missing or moved: the run fails fast with a file error.
- Memory: if the box is short of RAM (other lanes running), `run.mjs` may be killed by the kernel with no message; check `dmesg | tail` and re-run when quiet. Free memory of about 3 GB is enough.
- The summary must be generated on the same UTC date as `--conducted-on`. A run that crosses midnight UTC: re-run.
- `write-entry.mjs` fails if a number it needs is missing from the summary; do not patch the entry by hand, fix the cause and re-run it.
- `write-entry.mjs` also adds the page's line to `public/llms.txt` (commit it). The sitemap is regenerated by the deploy cron; `src/test/llms-coverage.test.ts` and `research.test.ts` cover the rest.
