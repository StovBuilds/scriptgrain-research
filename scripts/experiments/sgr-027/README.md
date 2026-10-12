# SGR-027: what does a humaniser actually change?

Pre-registration: `docs/research/sgr-027-preregistration.md` (frozen before generation).

Re-run, in order, from the repo root:

1. `bun scripts/experiments/sgr-027/generate.mjs`: 20 bare passages from `prompts.json`
   (Claude via the `claude` CLI, GPT via the `codex` CLI, subscription logins; the script
   strips API keys from the child env). Output `out/passages.json`. Skips ids already there.
2. `bun scripts/experiments/sgr-027/run.mjs`: humanises each passage (`/v1/humanize`,
   `force: true`) and measures both texts (`/v1/ai-detect`, `/v1/voice-match` against the
   ScriptGrain Brand profile, plus `scanCliches` and `measureTextFeatures` locally). Needs
   `SCRIPTGRAIN_API_KEY` in `~/.bot-infra.env`; humanise bills ScriptGrain's model key.
   Output `out/results.json`. Run it on the day before publication (conductedOn = D-1).
   `--pilot` runs `pilot-passage.json` (outside the corpus) to `out/pilot.json`, a pipeline
   check that is not part of the study.
3. `bun scripts/experiments/sgr-027/analyse.mjs`: H1-H4 with paired bootstrap intervals
   (10,000 resamples, seed 20261012) and the exploratory measures. Output `out/analysis.json`.

Model outputs are not deterministic, so a re-run reproduces the method, not the exact texts;
the texts measured are published in `out/results.json`.
