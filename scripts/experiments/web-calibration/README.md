# Website-copy voice-check calibration (DESK-415, 2026-10-04)

Does the pairwise scale behind the free off-voice check, `/v1/compare-voice` and MCP `compare_voice` tell **brands** apart on **website copy**? It came up in a Lloyds Bank study: every Lloyds era scored "on voice" against today's homepage (0.86 to 0.93), and so did nationwide.co.uk (0.87), monzo.com (0.84) and bbc.co.uk/news (0.80).

**Corpus (`fetch.mjs`):** 26 UK brands in 4 sectors (banks 8, energy 6, telecoms 6, SaaS 6), the homepage plus up to 3 shallow marketing pages each, 101 pages. Firecrawl `rawHtml` through the product's own `htmlToText`, cut to 700 words (139 Firecrawl credits). `corpus.json` holds third-party text and is not committed.

**Judge (`judge.mjs`):** each page judged once with the production prompt (`VOICE_JUDGE_SYSTEM`) on Haiku 4.5 via the Claude Code CLI (subscription). `judged.json` is committed (no text).

**Scoring (`score.ts`):** every ordered pair (10,100) through the production `measureTextFeatures` → `pseudoProfileFromText` → `computeVoiceMatch`, exactly as `scorePieces` does. `pairs.jsonl` keeps `raw` per pair (no text). Same-brand pairs are the positives; other brands in the **same sector** are the hard negatives.

**Live check (`live.mjs`):** 24 pairs through the live `/v1/compare-voice` with a throwaway key (revoked after). Live minus offline raw: mean +0.014, median absolute 0.048 (judge run-to-run variation; production pins temperature 0, the CLI cannot). The live sample tells the same story (other brands in the sector scored at least as close as the brand's own pages).

## Result (`analyse.mjs`)

| pairs | n | raw p10 / p50 / p90 | on voice | drifting | off voice |
|---|---|---|---|---|---|
| same brand | 296 | 0.528 / 0.651 / 0.764 | 24% | 61% | 15% |
| other brand, same sector | 2,220 | 0.529 / 0.642 / 0.746 | 17% | 65% | 18% |
| other sector | 7,584 | 0.504 / 0.618 / 0.729 | 12% | 62% | 26% |

AUC same brand vs same sector **0.54** (bank 0.61, energy 0.48, telecom 0.56, SaaS 0.45); same brand vs other sector 0.61; same sector vs other sector 0.57. Pages of 600+ words: 0.55.

**Page type beats brand:** two different brands' homepages score raw 0.673 (median); a brand's homepage against its own inner pages 0.653.

## What was tried

- **Genre baseline** (`baselineRaw` in `score.ts`): scale each feature's weight by how far the main piece sits from typical web copy (all other brands, or other sectors only). AUC 0.54 / 0.53, and it drags every score down. Not adopted.
- **Per-feature reweighting** (`features.ts`, `reweight.mjs`): no feature separates brands (best: formality 0.56); weights fitted on 3 sectors and tested on the 4th score below production (pooled held-out 0.51 vs 0.54). Not adopted.
- **Web-specific anchors:** cannot help. With same-brand and same-sector distributions overlapping, any threshold moves both equally.

## What shipped

The scale is unchanged. Reports with a URL piece carry `notes: [WEB_COPY_NOTE]` (`_shared/voice-check.ts`); the free tool and shared reports headline web comparisons as "N pages measured against …" instead of "N drift from …"; shared-report band notes describe the measurement instead of saying the brand is slipping; the MCP tool description, `docs/api/v1.md` and the checker FAQ say what the score can and cannot do on website copy.

**Re-run:** `bun fetch.mjs` → `bun judge.mjs` → `bun score.ts` → `node analyse.mjs` → `bun features.ts && node reweight.mjs`. `live.mjs` needs `key.json` `{"secret":"sg_live_…"}` (throwaway; revoke after).
