# SGR-028: Is ChatGPT Americanising British business writing?

**Status: pre-registration FROZEN 2026-11-10** in `docs/research/sgr-028-preregistration.md` (the
authority; this file only says what runs). Full run on D-1, Thursday 12 November 2026; release Friday
13 November. Changes after freezing go under "Deviations" in the pre-registration, with date and reason.

| File | What it does |
|---|---|
| `terms.mjs` | The pre-registered lists: 168 spelling pairs (2,979 word forms), 30 phrases, the descriptive UK markers, the excluded pairs with reasons |
| `measure.mjs` | Text to counts: cleaning, exclusions, tokenising, matching. Local; no network, no model |
| `pilot.mjs` | The 2026-10-13 pilot (10 UK brands, term checks). Not part of the full run |
| `run.mjs` | THE FULL RUN. Streams every eligible UK brand (30+ dated pages each side) and US control brand (10+) from the Storage Box, measures every dated page, bootstrap (10,000, seed 20261112), Wilcoxon, US control, sensitivities, instrument check. Writes `public/research/sgr-028-summary.json`, `sgr-028-brands.csv`, `sgr-028-change.svg`. Exits 2 if the instrument check fails |
| `write-entry.mjs` | Builds the study entry in `src/data/research-pages.json` (+ `public/research-pages.json`) from the summary. Refuses a pilot summary, a failed instrument check, or dates that are not ranOn / ranOn + 1 |

## D-1 (12 November 2026)

    node scripts/experiments/sgr-028/run.mjs            # about 5 to 10 minutes; needs ~/bin/rclone and the storagebox remote
    node scripts/experiments/sgr-028/write-entry.mjs --conducted-on 2026-11-12 --publish-on 2026-11-13

Then CI, merge, and the research mirror after release (`scripts/research-mirror/sync.sh`). If `run.mjs`
exits 2, do not publish: the pre-registration says no result is reported, and that goes to Jack.

Pilot (plumbing only, never committed): `node scripts/experiments/sgr-028/run.mjs --pilot --out /tmp/sgr028`.
