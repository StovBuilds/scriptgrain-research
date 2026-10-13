# SGR-028: Is ChatGPT Americanising British business writing?

**Status: pre-registration DRAFT (prepared 2026-10-13). Not frozen.** Freeze it (commit with
"frozen" and the date) before the full run on D-1, Thursday 12 November 2026; release Friday
13 November. After freezing, changes go under "Deviations" with date and reason. No full run
has been made; the only data touched is the pilot below.

| File | What it does |
|---|---|
| `terms.mjs` | The pre-registered lists: 168 spelling pairs (2,979 word forms), 30 phrases, the descriptive UK markers, the excluded pairs with reasons |
| `measure.mjs` | Text to counts: cleaning, exclusions, tokenising, matching. Local; no network, no model |
| `pilot.mjs` | The pilot (10 brands). `node scripts/experiments/sgr-028/pilot.mjs [--out f.json]` takes about 30 s |
| `run.mjs` | NOT WRITTEN YET: the full run (all eligible brands, bootstrap, US control, outputs). Reuse `measure.mjs` and `period()` from `pilot.mjs` |

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
- **Eligible brand:** at least 30 dated pages in each period, at least 30 variant-pair tokens in
  each period (spelling measure only), and passing the house-style guard (section 4). In v1.4,
  41 of 117 brands with pages have 30+ dated pages each side (pilot count).

**Control:** the US brand corpus `scripts/experiments/brand-corpus-us/`, same method, same
eligibility, same period rules. Status on 2026-10-13: collection under way (96 manifest rows
at the time of writing), and its manifest has no `date_best`, `date_source` or `source`
columns yet. The control needs dated pages on both sides, so it needs the Wayback pass
(research plan: "Pre-ChatGPT US pages") and a rebuilt manifest with dates.

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
- **Sanity check on the instrument:** US brands' American share must be at least 0.98 in both
  periods. Below that, the pair list or cleaning is misclassifying and the run stops.

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

## 8. Open items before the full run

1. Freeze this document (commit with the date).
2. Write `run.mjs` (bootstrap, outputs) and the entry builder, as in sgr-019.
3. US control needs dates: the US manifest, a Wayback pre-ChatGPT pass or a documented
   post-only fallback, and `build-manifest.mjs` run with `--dir`.
4. Confirm Jack's release go covers SGR-028 and add it to `~/research/sg-d1/schedule.json`.

## Deviations

(none yet)
