# SGR-009 pre-registration: do brands in the same sector sound the same?

Frozen: 2026-10-04. Committed before any page was fetched. The git commit that
adds this file is the timestamp. Any change after it goes under "Deviations" at
the bottom, with the date and the reason.

## 1. Background
ScriptGrain's pairwise voice score (the free off-voice check, `/v1/compare-voice`,
MCP `compare_voice`) treats one piece of text as the baseline and scores others
against it. A pilot (DESK-415, 4 Oct 2026; `scripts/experiments/web-calibration`)
measured it on website copy: 26 UK brands in 4 sectors, 101 pages. The score
told a brand's own pages from other brands in the same sector barely better
than chance (AUC 0.54). Two brands' homepages scored closer to each other than a
brand's homepage did to its own inner pages (median raw 0.673 vs 0.653).

The pilot chose its pages informally and judged them with a CLI that cannot fix
the temperature (run-to-run variation up to 0.109). This study tests the pilot's
findings on new brands, chosen and frozen before fetching, with page types fixed
in advance, and with the production judge settings.

## 2. Panel
`scripts/experiments/sgr-009/panel.json`, frozen with this file: 96 UK brands in
10 sectors (bank, energy, telecom, software, grocery, travel, insurance, fashion,
charity, food). Every sector has 10 brands except energy, which has 6. None of
the pilot brands is included. No two brands in the same sector share a parent
company (the notes in panel.json list the exclusions).

## 3. Pages
Five page types per brand: **home, about, product, pricing, careers**.

- **Discovery.** Firecrawl `map` of `https://www.<domain>` (limit 400). A link
  counts if its host is the brand domain or a subdomain of it.
- **Selection.** Home is the site root. For every other type, the candidates are
  links whose path matches that type's rule in panel.json (product uses the
  sector's rule). Links that match the exclusion rule are dropped (login, legal,
  privacy, cookies, terms, press, news, blog posts, investors, PDFs, query
  strings, search, accessibility, complaints). A product or pricing candidate
  that also matches the careers or about rule is dropped. Candidates are
  ordered shortest URL first (ties alphabetically). The first one that fetches
  and passes the length rule is used. At most 3 candidates are tried per type.
- **Fetch.** Firecrawl `scrape`, `rawHtml`, location GB, wait 1.5 s. The text is
  the product's own `htmlToText` (`_shared/html-text.ts` at the frozen commit),
  which is exactly what `compare_voice` runs on a URL piece. It is cut to the
  first 700 words, as in the pilot.
- **Length rule.** A page must have at least 150 words after extraction.
- **Duplicates.** If two types resolve to the same URL, or to texts whose first
  200 words are identical, only the first type in the order above is kept.
- **Missing types (fallback rule).** A type that finds no candidate passing the
  rules is MISSING for that brand. It is never replaced with another type,
  another domain or a hand-picked URL. Missingness is reported by type and sector.
- **Inclusion.** A brand enters the analysis if it has at least 2 pages.
- Fetch dates are recorded per page. Third-party text is kept locally and is
  never published.

## 4. Measures
**Judges.** Each page is judged with the production judge prompt
(`VOICE_JUDGE_SYSTEM` in `_shared/voice-match.ts`) and the production user
message (`<text_to_analyse>…</text_to_analyse>`), through the Anthropic API.

- **J1, the primary judge:** `claude-haiku-4-5`, temperature 0, max_tokens 600.
  These are production's own settings. It runs twice (J1a, J1b) so that any
  run-to-run variation at temperature 0 is measured, not assumed away. Every
  confirmatory test uses J1a.
- **J2, the robustness judge:** `claude-sonnet-5-5`. Its sampling cannot be set
  (the API rejects a non-default temperature), so it runs **three times** (J2a,
  J2b, J2c). Thinking is set to `between_tools`, so no reasoning comes before
  the answer. max_tokens is 1000 to allow for its larger tokenizer.
- A response that does not parse as JSON is retried up to 3 times. A page that
  still fails is scored measured-only (judge null), which is what production does.

**Pair score.** For every ordered pair of included pages (A, B), A is the baseline:
`computeVoiceMatch(pseudoProfileFromText(measure(A), judge(A)), measure(B),
judge(B), no phrases).raw`. That is the production `scorePieces` computation.
The displayed score is `calibratePairwiseScore(raw)`, with bands on voice ≥ 0.80,
drifting 0.55 to 0.80, off voice < 0.55. AUCs are computed on raw (calibration
is monotone, so it does not change them).

**Pair kinds.** same brand (SB); other brand, same sector (SS); other sector (XS).
For H2: same brand, different type (SB-DT); different brand in the same sector,
same type (SS-ST).

## 5. Confirmatory hypotheses (J1a)
CIs are 95% cluster bootstraps over brands (2,000 resamples, resampling brands
within sectors). Every result is reported, pass or fail, in the same place and
at the same prominence.

- **H1 (brand is hard to tell from its sector).** AUC(SB vs SS) < 0.60.
  Supported if the point estimate is below 0.60. The CI is reported.
- **H2 (page type beats brand).** The median raw score of SS-ST pairs is higher
  than that of SB-DT pairs. Supported if the CI of the difference in medians
  excludes zero.
- **H3 (sector carries some signal).** AUC(SS vs XS) > 0.50. Supported if its
  CI excludes 0.50.

## 6. Robustness and secondary analyses (labelled as such)
- **J2 robustness.** H1 to H3 are recomputed on each Sonnet run. The conclusion
  is "robust to the judge" only if H1 holds on all three runs, and H2 and H3
  match their J1a outcome on at least two of the three.
- **Judge variation.** Per-attribute agreement between J1a and J1b and between
  the J2 runs, and the spread of pair raw scores across runs.
- **Measured-only score.** The same analysis with every judge set to null
  (counted features only).
- Per-sector and per-page-type AUCs; pages of 600 or more words only; band shares
  (on voice / drifting / off voice) for SB, SS and XS.
- A comparison with the pilot's numbers (cited, not re-run: the pilot's text was
  not kept).

## 7. What we publish
URLs, page types, fetch dates, word counts, every counted feature, every judge
output (J1a, J1b, J2a to J2c), every pair's raw score by judge, the scripts, and
aggregates. Licence CC BY 4.0. No page text is published.

## 8. Limits we already know
- 96 brands in one country and one language, crawled in one week of October 2026.
- A brand's pages may be written by many people and agencies. "Same brand" is a
  label, not a single author. This is the situation a website owner is in, which
  is the point of the study.
- htmlToText can keep navigation, footer and cookie text, which every page of a
  site shares. That raises same-brand scores, so it works against H1.
- Consumer brands only. B2B, public sector and personal sites are not covered.
- Two judges from one model family. This is not a test of other vendors' models.
- Cost: Firecrawl credits for about 100 maps and up to 1,000 scrapes, and
  roughly $10 of API calls across the five judge runs.

## Deviations and clarifications
- 2026-10-04, clarification, no change to any rule: while the fetch was running, J1a
  was run on the first 38 pages to test the pipeline end to end (same model, prompt
  and settings). The judge resumes by URL, so those 38 readings are part of J1a; no
  page was judged twice in J1a and no hypothesis was looked at before the full run.
- 2026-10-04, outcome of the frozen rules (not a deviation): 299 pages from 89 brands
  qualified, against 480 possible. Seven brands had fewer than two pages and were
  excluded under section 3. Missingness by type and sector is published.
