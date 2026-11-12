# SGR-028: Is ChatGPT Americanising British business writing? (pre-registration)

Frozen: 2026-11-10, committed before any full measurement. The git commit that adds this file is the
timestamp. Changes after it go under "Deviations" at the bottom with the date and the reason. The full
run is on Thursday 12 November 2026 (the page's "conducted" date) and the page goes live on Friday
13 November 2026. Drafted 2026-10-13 in `scripts/experiments/sgr-028/README.md`; section 8 lists what
changed between that draft and this frozen version, all of it decided on the pilots below and on
manifest counts, before any full-run data.

Scripts: `terms.mjs` (word lists), `measure.mjs` (text to counts), `run.mjs` (the full run; `--pilot`
for a plumbing test on 4 UK and 3 US brands, never committed), `write-entry.mjs` (builds the page from
`public/research/sgr-028-summary.json`). Run on D-1:

    node scripts/experiments/sgr-028/run.mjs
    node scripts/experiments/sgr-028/write-entry.mjs --conducted-on 2026-11-12 --publish-on 2026-11-13

`run.mjs` exits 2 and `write-entry.mjs` refuses if the instrument check (section 4) fails.

## 1. Question

Has British brand writing moved towards American spelling and American business phrasing since
ChatGPT's launch (30 November 2022), and is any movement larger than American writing's own
drift? Spelling is reported on its own line because "colour" against "color" is not voice.

## 2. Data and periods

**UK:** the brand corpus v1.4 (`scripts/experiments/brand-corpus/manifest.csv`, 122 brands; text
on the Storage Box, streamed a brand at a time, never stored locally). Only the manifest's
`date_best` and `date_source` are used for dating.

- **Counts as dated:** `date_source` in `meta`, `jsonld`, `url`, `text`, and (before only) `captured`.
  `captured` is the Wayback capture month, an upper bound on publication, and captures after
  November 2022 were already dropped, so a captured page is safely "before".
- **Never counts:** `modified` (a last-modified guess) and undated pages.
- **Before:** `date_best` up to 2022-11 (year-only dates up to 2021). **After:** live pages with a
  dated `date_best` from 2023-01 (year-only from 2023). **Buffer:** December 2022, and year-only
  2022 (could be December), are excluded from both. Wayback pages never count as "after".
- **Eligible brand (UK):** at least 30 dated pages in each period and passing the house-style guard
  (section 4). In v1.4, 41 of 117 brands with pages have 30+ dated pages each side.
- **Token rules, per measure and per period (UK and US alike):** the spelling shares need at least 30
  variant-pair tokens; the Oxford-proof share also needs at least 10 Oxford-proof tokens, and the `-ize`
  share at least 10 `-ize` tokens. A brand that misses a measure's rule is left out of that measure only.
  The phrase rate has no token rule. Each table states the brands it uses.

**Control:** the US brand corpus v1 (`scripts/experiments/brand-corpus-us/manifest.csv`, 115 brands with
pages; text on the Storage Box at `storagebox:research/scriptgrain-brand-corpus-us/v1/pages/`). Its manifest
now carries `date_best`, `date_source` and `source` from the same `build-manifest.mjs`, so the same period
rules apply. Every US page is a live page (no Wayback pass was made), so the US "before" is live pages dated
up to November 2022. **US eligibility: at least 10 dated pages in each period** (44 brands; at 30 there are
only 10, four of them software, too few for a control). The 30-page US set is reported as a sensitivity.
The token rules below apply to the US as to the UK; the house-style guard does not (US brands are expected
to write American).

## 3. Measures

Counted on each page's text after cleaning (`measure.mjs`): markdown to plain text; tables, code
and blockquote lines removed; URLs and email addresses removed; double-quoted spans of 3 to 500
characters removed (quotes are not the brand's voice); the brand's own name skipped; **and any
capitalised word that is not the first word of a sentence or line, and any ALL-CAPS word, is
skipped** (proper names, product names, Title Case headings). Words are counted as letter runs.

**(a) American spelling share** = US forms / (US forms + UK forms), over the pre-registered pairs.
Reported three ways: all pairs; the **Oxford-proof** set (group `other`, 70 pairs); the `-ize`
set (group `ize`, 98 pairs) alone. Oxford spelling (-ize with -our, -re, -yse) is legitimate British
usage, so the headline test (H1) uses the Oxford-proof set as its guard.

**(b) Americanism phrase rate** = phrase hits per 1,000 words, over the 30 phrases in `terms.mjs`
(reach out, going forward, moving forward, touch base, circle back, deep dive, low-hanging fruit,
game changer, move the needle, double down, heads up, on the same page, in the loop, pain point,
next level, best in class, learnings, gotten, awesome, ballpark, vacation, cell phone, sidewalk,
zip code, parking lot, diaper, faucet, gas station, trash can, and "leverage" as a verb).

### Rules for the term lists

- **-ise/-ize counts only for genuine variant pairs.** It is a closed list of 98 stems
  (organis/organiz, recognis/recogniz, ...), each expanded to explicit word forms; there is no
  pattern like `*ize`, so "size", "prize", "seize", "advise", "promise", "franchise", "surprise",
  "exercise" and "comprise" cannot match. `analyse/analyze`, `paralyse/paralyze`,
  `catalyse/catalyze` go in the Oxford-proof group (Oxford spelling also uses -yse). UK
  "analyses" is skipped: it is also the plural of "analysis".
- **"programme/program" is excluded.** UK computing writes "program", and "program" is also a
  scheme name ("loyalty program"); the UK panel has 16 software brands. Not a clean pair here.
- Also excluded, with reasons in `EXCLUDED_PAIRS`: licence/license, practise/practice,
  labour/labor (Labour Party), metre/meter (gas and smart meters), catalogue/dialogue/analogue,
  cheque/tyre/kerb/draught, judgement, enrol, artefact, learnt, speciality, enquire.
- **"leverage"** counts only as a verb (inflections, or "leverage" after a verb-context word),
  because noun "leverage" is ordinary bank and insurance English.
- Brand names, quotes and URLs are excluded (section 3). `bandwidth` and `elevator` are not in the
  list (telecom and "elevator pitch" use). "whilst", "amongst", "learnt", "towards" are counted
  and reported as descriptive British markers only; they are in no hypothesis.

## 4. Analysis

Unit = brand. For each eligible brand compute the share and rate in each period, then the
**within-brand change** (after minus before). Everything below is on the mean of those changes
with equal weight per brand, so brand mix and page volume cannot drive it (a brand that
published more after does not count more).

- **House-style guard.** A brand whose before-period American spelling share is above 0.5 writes
  American, not British (the UK panel includes US-headquartered SaaS: ClickUp and Airtable in
  the pilot). It is listed and excluded from the UK tests, and its numbers reported separately.
- **Interval:** 10,000 bootstrap resamples of brands (seed 20261112), percentile 95% interval on
  the mean change. Secondary: Wilcoxon signed-rank on the changes; share of brands whose change
  is above zero.
- **Control and difference-in-differences:** the same statistics on US brands. H3 uses the
  UK mean change minus the US mean change (UK and US brands resampled separately).
- **Sensitivities (reported, not tested):** pre-period live pages only (removes the
  Wayback-versus-live extraction difference); after-period 2024 onward; each sector alone;
  software excluded; the `-ize` set alone.
- **Sensitivities, added before freezing:** the US control restricted to brands with 30+ dated pages
  each side.
- **Sanity check on the instrument:** the POOLED American share of variant-pair tokens over every US
  control page, both periods together, must be at least 0.98. Below that, the pair list or cleaning is
  misclassifying and the run stops (no result is published; `write-entry.mjs` refuses). Per-period
  pooled shares and brand means are reported alongside.

## 5. Hypotheses and thresholds

Every threshold is for the **mean within-brand change, UK eligible brands**.

| | Statement | Passes if |
|---|---|---|
| **H1** | American spelling rose (Oxford-proof set) | change >= +0.25 percentage points, 95% interval lower bound > 0, and at least 60% of brands up |
| **H1b** | American spelling rose (all pairs) | change >= +0.5 percentage points, interval lower bound > 0, at least 60% of brands up |
| **H2** | Americanism phrase rate rose | change >= +0.10 per 1,000 words (about a doubling of the pilot's before-level, 0.11), interval lower bound > 0, at least 60% of brands up |
| **H3** | UK moved towards the US more than the US moved | UK minus US change in phrase rate has an interval lower bound > 0 (spelling: same test on the Oxford-proof share) |

The baseline in the pilot is low (UK American share about 1.4% before), so the spelling
thresholds are small in absolute terms. They were set after seeing the pilot's baselines and
before any full-run data, and are the smallest changes we would call a finding.

**Result wording.** All of H1, H2, H3 pass: "British brand writing moved towards American
spelling and phrasing after November 2022, beyond US drift". Only H2 (or H3 on phrases): a
phrasing, not a spelling, finding. H1 and H2 pass but H3 fails: both countries drifted
together; not Americanisation. Anything else: no detected shift.

### What a null looks like

The interval on the mean change includes 0, or the point estimate is below the threshold. The
page then reports the interval and says what size of shift the data could have detected (the
interval's width), and does not say "no effect". A null is a result and is published. The
pilot is on course for a null on spelling (change -0.6 pp).

## 6. Limitations (also go in the entry's limitations)

- Correlation with the ChatGPT era is **not** evidence that any text was written by AI. Nothing
  here identifies an author or tool; American phrasing also spreads through hiring, US parents,
  global templates, and style guides.
- Oxford spelling is legitimate British usage: -ize is not an error and is not counted as
  evidence in the Oxford-proof tests.
- "Before" text is mostly Wayback captures, "after" mostly live pages: different extraction
  boilerplate (mitigated by cleaning, the live-only sensitivity, and the US control).
- Dating uses page metadata, URL years and in-text dates; `text` dates are guesses.
- A brand's blog and press pages are written by many hands and sometimes agencies.
- Capital-letter skipping loses some real tokens (Title Case headings) on both sides equally.
- Phrase counts are low (about 0.1 per 1,000 words), so a few brands can dominate; hence the
  brand-level bootstrap and the share-of-brands-up condition.
- Publish numbers only: no third-party text is quoted anywhere. Datasets CC BY 4.0, counts only.

## 7. Pilot (2026-10-13)

`pilot.mjs`: 10 UK brands with 30+ dated pages each side, chosen deterministically (at most 2 per
sector, hash order) from the 41 eligible. 2,031 pages, 2.5 million words. Two (clickup.com,
airtable.com, both US software) were caught by the house-style guard (before-period American
share 0.985 and 0.995), leaving **8 UK-voiced brands**: goodenergy.co.uk, nationwide.co.uk,
zurich.co.uk, sky.com, redcross.org.uk, macmillan.org.uk, starlingbank.com, legalandgeneral.com.

| 8 UK brands | Before (to Nov 2022) | After (2023 on) | Mean within-brand change | Brands up |
|---|---|---|---|---|
| Pages / words | 905 / 697,264 | 929 / 1,064,293 | | |
| Variant-pair tokens | 1,950 | 3,384 | | |
| American share, all pairs (mean of brands) | 1.44% | 0.88% | -0.56 pp | 2 of 8 |
| American share, Oxford-proof set | 0.63% | 0.75% | +0.11 pp | 3 of 8 |
| American share, -ize set | 1.81% | 1.03% | -0.79 pp | n/a |
| Phrases per 1,000 words (mean of brands) | 0.095 | 0.108 | +0.013 | 3 of 8 |
| Pooled share, all pairs / phrases per 1,000 | 1.38% / 0.113 | 0.89% / 0.139 | | |

Both pilot changes are far below the H1/H2 thresholds, so on 8 brands neither would pass. The
pilot is a plumbing and term check, not a finding; the full run will have about 40 brands.

**Instrument check on the US corpus** (5 US brands already collected, up to 80 pages each, 190
pages, 312,268 words; no dates yet so no periods): American share 99.6% all pairs, 99.0%
Oxford-proof (chase.com 99.5%, salesforce.com 99.9%, delta.com and kroger.com 100%). The pair list reads American
text as American.

**US software caught by the guard** (not UK voice): their after-period phrase rates are 2.0 and
0.9 per 1,000 words and "leverage" as verb is a large share; they show why the guard is needed.

**Terms that misfired or need watching (counts only, 8 UK brands, both periods):**
- `movie`: 293 hits in one telecom brand (a product name). **Removed from the list.**
- `leverage (verb)`: 59 hits over both periods in 6 brands, 35 of them in one insurer (legalandgeneral.com). Read the contexts before the full run (finance sense may leak through the verb-context rule).
- `best in class`: 33 hits, 19 of them in one telecom brand (sky.com): phrase totals are brand-driven, which is why the test is per brand.
- `defence`: 142 UK-side hits, 108 in sky.com (sport and security vocabulary). It is a valid pair but a sector-skewed one; the sector sensitivity covers it.
- `diarrhoea` (29 of 31 in redcross.org.uk) and `leukaemia` (26 of 26 in macmillan.org.uk): medical spelling pairs are real but concentrated in single health charities.
- `mum`: 48 UK-side hits, 25 in the two charities (could be a person in a story); harmless to the direction of any test.
- `aging` (3, two brands), `fertilizer` (5) and `civilization` (1) on the US side in UK brands: legitimate use of the US form; the noise floor is about 1% of variant tokens.
- Not tested yet: `grey`/`gray` (surnames), `centre`/`center` (US proper names like "Center for" are
  capitalised and skipped), `fibre`/`fiber` ("fiber optic" is genuinely US).

### Pilot of run.mjs (2026-11-10, plumbing only)

`run.mjs --pilot`: 4 UK brands (one, intercom.com, caught by the house-style guard) and 3 US brands
(feedingamerica.org, twilio.com, unitedway.org), 1,000 bootstrap draws. It runs end to end in about
20 seconds and writes the summary, the brand CSV and the chart; `write-entry.mjs --allow-pilot` built an
entry that passed `src/test/research.test.ts` and the other research tests (reverted, not committed).
The instrument check on the 3 US brands: brand-mean American share 0.968 before and 0.992 after; pooled
0.975 before, 0.985 after, 0.984 both periods together. Every British form found in the US brands was a
real British spelling used by that brand's writers (for example "initialise", "organisation" and
"labelled" on one software brand's blog), not a misread word, and the brands with the lowest shares had
the fewest tokens (39 and 82). That is why the check is pooled (section 8).

## 8. Changes from the 2026-10-13 draft, made before freezing

1. **US control dating.** The draft said the US manifest had no dates and needed a Wayback pass. It now
   has dates from `build-manifest.mjs` (1,523 pages dated before 2023, 3,762 from 2023), so no Wayback pass
   and no Firecrawl spend; the US "before" is live pages only.
2. **US eligibility 10+ dated pages each side** (44 brands), not 30 (10 brands). Decided on manifest
   counts only. The 30-page US set is a reported sensitivity.
3. **Token rules per measure** (30 variant tokens; 10 Oxford-proof or `-ize` tokens for those shares),
   so a brand with two Oxford-proof words cannot swing a share by 50 points.
4. **Instrument check pooled over both periods**, not per-period brand means (pilot above): it tests
   whether the word list reads American text as American, which is its purpose; brand means on small
   token counts measure brands' writers, not the instrument.
5. `run.mjs` and `write-entry.mjs` written; output files `public/research/sgr-028-summary.json`,
   `sgr-028-brands.csv`, `sgr-028-change.svg`.

The release go (Jack, 2026-10-14) covers SGR-028 on these dates; it is in `~/research/sg-d1/schedule.json`.

## Deviations

### Deviation 1 (2026-11-12, after the freeze and after the full run): locale rule on both corpora

**What failed.** The full run on 2026-11-12 failed the instrument check in section 4, which is left
unchanged above. The pooled American share of variant-pair tokens over the 37 US control brands was 0.948
against the 0.98 floor (0.994 before December 2022, 0.932 from 2023). Three US brands drove most of it:
habitat.org (American share 0.22 after), stripe.com (0.30) and expedia.com (0.63). As section 4 requires,
no result was published.

**Cause, found by reading the pages.** Some pages in the US corpus are not written for the US market:
- stripe.com: 103 of its 119 pages declare `lang="en-GB"`. Stripe serves the British edition of
  `/resources/` and `/newsroom/` at the same URLs, by visitor location. About 545 of the 1,003 British
  tokens in the whole US corpus are on these pages.
- habitat.org: regional sections (`/emea/`, `/ap/`, `/lac-en/`, tagged `en-150`, `en-142`, `en-419`), and one
  PDF report by Habitat for Humanity Great Britain hosted on habitat.org (164 British tokens, no locale tag).
- expedia.com: global newsroom releases tagged `en-US` but issued from London ("travellers", "cosy"), and one
  French page.

The word list itself was not misreading anything: every British form found was a real British spelling.

**Rule, written and committed before the re-run.** A page is dropped from a corpus if it is labelled for
another market. The rule is the same for both corpora; "home" is US for the control and GB/UK for the UK corpus.
1. Its declared language (the page's `lang`, first value) has a region that is not home and not a UN M.49
   area containing home (US: 001, 003, 019, 021; UK: 001, 150, 154). A bare `en` or no tag is kept.
2. Or its URL path is a locale section for another market: an `en-XX` segment in the first two path
   segments with XX not home; else a first segment of `intl`, `international`, `emea`, `apac`, `ap`,
   `latam`, `lac`, `lac-en`, `eu` or `europe`; else a two-letter country segment followed by an `en` segment
   (`/be/en/`), country not home; else `/uk/` or `/gb/` in the US corpus and `/us/` in the UK corpus.

Brand eligibility (the 30 and 10 page minimums) is counted after the rule. No page or brand is removed by
hand, and the 0.98 floor is unchanged. The UK results are also reported on the frozen corpus (no locale
rule) as a sensitivity, so the rule's effect on the UK side can be seen.

**Known limit, stated before the re-run.** The rule cannot catch the Habitat GB PDF or Expedia's
London-issued releases, because neither is labelled for another market. Removing them would need a
judgement about each page, which this rule does not make. If the check still fails with the rule, the
study is not published and the decision goes back to Jack.
