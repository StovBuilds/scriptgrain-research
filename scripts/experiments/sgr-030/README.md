# SGR-030: Does a brand change its voice for America?

Status: PREP ONLY. DRAFT pre-registration, not frozen. No page text has been collected. Release plan:
Fri 20 Nov 2026, run on D-1 (Thu 19 Nov), collection after the 22 Oct Firecrawl credit reset
(`docs/plans/research-next-8.md`, "UK and US English: SGR-028 to SGR-030"). To be frozen as
`docs/research/sgr-030-preregistration.md` before the full collection starts; later changes go under "Deviations".

| File | What it is |
|---|---|
| `candidate-seed.mjs` | The 224 UK/US base pairs I proposed (both brand.json corpora plus my own knowledge), unverified |
| `probe.mjs` | Plain-curl verifier (homepages, hreflang, robots.txt, sitemaps). No Firecrawl, no APIs. `--deep` re-reads more child sitemaps for pairs with no match yet |
| `finalize.mjs` | Applies the different-company exclusions, adds `pair_basis` and counts |
| `candidates.json` | The result: one row per pair with status, verification evidence and pair potential |
| `probe-cache.json`, `probe*.log` | Raw cache and logs of the probe run (13 Oct 2026) |
| `geo-traps.md` | Geo-redirect traps hit while probing |

## 1. Question

When a brand that runs both a UK and a US English site publishes "the same page" for both, how much of the
difference is spelling alone, and which brands really change their voice for the other country?

## 2. Hypotheses (directional, thresholds fixed before the data is read)

Unit of analysis: the brand (not the page pair), because pairs within a brand are not independent. Brand-level
figures are the mean over that brand's usable pairs; brands with fewer than 5 usable pairs are reported but not
in the headline numbers. Intervals are 95% cluster bootstrap over brands (1,000 resamples, seeded), as in SGR-019.

- **H1 (mostly the same words).** Across brands, the median share of pairs that are identical after spelling
  normalisation (measure a) is at least 50%. Not supported if the median is below 50%.
- **H2 (spelling is the main localisation).** Among pairs that are NOT identical, the median share that differ
  only in British/American spelling (measure b) is at least 50% of all non-identical pairs. This is the "localisation
  is a find-and-replace" claim.
- **H3 (a minority of brands rewrite).** At least 10% of brands, and no more than 40%, are "voice changers"
  (defined in section 5: at least 3 of the 6 voice measures differ beyond the thresholds there, in the same
  direction on at least 60% of the brand's remaining pairs). Fewer than 10% = voice is essentially fixed; more than 40% = rewriting is normal.
- **H4 (direction).** Where voice differs, the US version has shorter sentences and more second-person address
  than the UK version, in the pooled paired differences (sign test over brands, two-sided alpha 0.05).
  Exploratory, reported whichever way it goes.

H1 to H3 are the headline questions. H4 is exploratory and labelled so.

## 3. Pairing method

1. **Candidates.** `candidates.json`, statuses `verified-hreflang` or `verified-200`, then cut to a final list of
   about 100 brands by pair potential. Brands with an exclusion note are out (Nationwide UK and US are different
   companies; so are the other rows marked `excluded`). Pairs where the two sites are separate legal entities
   under one brand (Save the Children, Oxfam, Santander, Habitat) are flagged and reported separately because their
   copy is not necessarily co-written.
2. **Discovery.** For each side, a Firecrawl `map` of the base (host or prefix), fetched with the locale set (section 7).
   Keep only URLs in scope of the base (a path-prefix base keeps only that prefix).
3. **Match by path.** Strip the locale prefix (the base prefix, e.g. `/uk`, `/en-gb`, `/gb/en`), lowercase, drop
   trailing slash and `.html`/`.php`. Two URLs are a pair when the remaining path is identical. No fuzzy matching, no
   title matching: a page that moved is not a pair.
4. **Long-form only.** Keep a pair only if BOTH pages have at least 150 words of body text and are English
   (`language` en*), same rules as `brand-corpus/fetch.mjs` (`MIN_WORDS = 150`, same `SKIP_PATH` and `SKIP_HOST`
   exclusions: login, legal, cookie, tag/category pages, help and support hosts, shop/basket paths; PDFs capped at 25 pages).
   Drop the home page, which is a navigation page.
5. **Sampling.** Up to 20 pairs per brand. If a brand has more than 20 eligible pairs, take a seeded random sample
   (seed 20261120) stratified by the first path segment, so one section does not dominate. Brands with fewer than 5
   eligible pairs are logged as exclusions, never padded.
6. **Fetch.** Both sides of a pair on the same day, and the same fetch settings. Store markdown and the text
   product exactly as the brand corpus does. Record `finalUrl` and reject a page whose final URL is not on the
   intended side (geo-redirect), counting it under exclusions.
7. **Not in scope:** pages in the existing UK or US corpora are reused where the same URL was already fetched
   (check the manifest first), which saves credits.

## 4. Spelling normalisation

One fixed, versioned word list (British to American) built before collection: the `-our`/`-or`, `-ise`/`-ize`,
`-re`/`-er`, `-ogue`/`-og`, doubled-L (`travelling`), `-ence`/`-ense`, `programme`, `grey`, `tyre`, `aluminium` and
similar classes, plus a hand list of the 200 commonest differing words. All text is normalised to the American
form before comparison, whichever side it came from. Brand names and quoted names are protected (list built from the
page titles) so "Centre Parcs" style names do not count as spelling. Normalisation uses no model.

## 5. Measures

Per pair, on text product with whitespace and punctuation normalised:

- **(a) Identical after normalisation.** The normalised texts are the same after removing boilerplate that appears on
  both sides (nav, footer, cookie text, prices and currency symbols, phone numbers, dates, addresses). Allow a tolerance of
  at most 2% of tokens differing after those removals, so a different price does not make a pair "different".
- **(b) Differs only in spelling.** Not identical as written, but identical (same 2% tolerance) after normalisation.
  Reported on its own line, never folded into voice.
- **(c) Voice differs (the rest).** Pairs that remain different after normalisation. On those, the paired difference (US minus UK) in:
  1. mean sentence length (words)
  2. formality (the product's formality score, `measureTextFeatures`)
  3. second person: "you/your" per 1,000 words
  4. hedging: hedge terms per 1,000 words (the SGR-007 list)
  5. superlatives: "best/most/-est/leading/#1" per 1,000 words
  6. reading age (SGR-023's measure)

  A measure counts as "differs" for a pair when the absolute paired difference exceeds the smallest effect
  that would be visible in the UK corpus's own between-page spread: 0.25 of the pooled within-brand standard
  deviation from the UK brand corpus (set once, from the corpus, before the paired data is read). A brand is a voice changer under H3 as defined above.

Also reported: the share of pairs where the two pages differ in length by more than 25% (a different page, not a different voice),
which are excluded from (c) and shown separately.

Instruments: product code only (`scripts/experiments/sgr-007/instruments.mjs`, `scanCliches`, `measureTextFeatures`,
`measureBurstiness`), run locally. No language-model calls in a measurement. Publish numbers, never text (CC BY 4.0 data).

## 6. Sample and credit estimate

Target: about 100 brands x up to 20 pairs = up to 2,000 pairs = 4,000 pages.

| Item | Credits |
|---|---|
| Page fetch: 100 brands x 20 pairs x 2 pages x ~1 credit | about 4,000 |
| Map/discovery: 2 calls per brand (some brands need a second search pass) | about 200 to 400 |
| Over-fetch to reach 20 pairs after the 150-word and 5-pair filters (about 1.3x fetches, pairs where one side fails) | +1,000 to 1,200 |
| **Planned** | **about 4,000 (the plan figure); budget 5,500 as a cap** |

Realistic yield is below 100 brands x 20: many verified pairs are e-commerce sites whose pages are short product listings
(under 150 words), and several brands share almost no sitemap paths. Of the 85 verified candidates, only 34 showed matching
paths in their sitemaps and about 11 showed 20 or more matching blog, about or product paths. So expect 60 to 80 brands
at 10 to 20 pairs each, 2,500 to 3,500 credits, unless the longer list (bot-blocked and geo-trapped brands, see below) is brought in
with Firecrawl, which sees them through its own proxies.
Reuse of already-fetched URLs from the two corpora cuts that further for the roughly 15 same-company brands.

## 7. What a null result looks like

- If H1 fails and H2 fails: brands rewrite rather than respell, and "localisation" means real copy changes. Reported as such.
- If most pairs are identical after normalisation (H1 holds by a wide margin, median above 90%): brand voice does not change for America;
  the headline is "the same page with different spellings", which is a null for voice difference and still a finding.
- If H3 gives under 10% voice-changers with intervals that include 0%: no evidence that brands as a group change voice; do not claim any particular brand changed.
- With fewer than 40 usable brands, the page says the sample was too small for the pre-registered thresholds and reports descriptives only.
- A result that depends on the 2% tolerance or the 0.25 SD threshold is shown with both neighbours (1% and 4%; 0.15 and 0.5) as a sensitivity table.

## 8. Limitations (go on the page)

- **Geo-redirects.** The VPS and Firecrawl exit IPs are not in the UK or US; many sites redirect to a regional site or an
  "EU" locale by IP (see `geo-traps.md`). Pages whose final URL is not the requested side are dropped, so geo-hostile brands are under-represented.
- **The US site may be the default.** For many global brands the root domain (`apple.com`) is the US site and `/uk` is the variant.
  The comparison is symmetric, but the US copy may be the original and the UK the adaptation; direction of causality is not testable here.
- **Machine localisation.** Some UK pages may be an automatic spelling swap or a translation-memory output. That is part of what (a) and (b) measure; the study cannot tell human from machine localisation.
- **Sitemap matching is by path only.** A localised URL slug (`/colour` vs `/color`, `/sustainability` vs `/impact`) will hide a real pair.
  This biases the sample toward pages that were copied unchanged, and so towards H1. A sensitivity pass with a spelling-normalised slug match is planned.
- **Survivorship.** Only brands that run both sites are in; brands that chose not to localise are invisible. E-commerce and bot-protected sites are under-represented.
- **Not all pairs are the same company's copy.** Separate legal entities under one brand are flagged.
- **Currency, legal and product differences** are real content differences, partly removed by boilerplate stripping, not fully.
- Voice measures here do not establish that voice measurement can tell whether a text was written by AI.

## 9. Decisions needed (see the hand-off note)

Locale/proxy setting for Firecrawl; whether bot-blocked brands are in; whether same-entity-different-company charities are in; credit cap; final brand count.

## Deviations

(none yet)
