# SGR-023: What reading age do UK brands write for? (pre-registration)

Frozen: 2026-10-12, committed before any full measurement. The git commit that adds this file
is the timestamp. Changes after it go under "Deviations" at the bottom with the date and the
reason. The full run is on Monday 27 October 2026 (the page's "conducted" date) and the page
goes live on Tuesday 28 October 2026.

## 0. Question

What Flesch-Kincaid grade, and so what UK-style reading age, do UK brands' blog posts and press
releases demand; how do the 10 sectors differ; are press releases harder to read than the same
brand's blog posts; and did readability change between 2015 and 2026, in particular for the
FCA-regulated sectors after the Consumer Duty came into force?

## 1. Data

The brand deep corpus v1.4 (`scripts/experiments/brand-corpus/`; text on the Storage Box, a copy
on disk at `~/research/sgr-023/brand`, 122 files, a copy of the one under `~/research/sgr-019`, read only): UK brands in 10 sectors (bank,
energy, telecom, software, grocery, travel, insurance, fashion, charity, food). Each page has a
category (blog, press, announcement, info_pack), a source (`live`, fetched 4 and 5 October 2026,
or `wayback`, the archived original captured 2015 to 30 November 2022) and a best date with its
source (`dates.mjs`). Nothing is crawled or bought for this study.

**Pages and exclusions** (each counted and reported). The SGR-010 to SGR-018 rules, unchanged and
with the same text conversion (`mdToPlain` in `scripts/experiments/brand-series/measure.mjs`, deviation 1
of `brand-series-preregistration.md` included): fewer than 150 words after conversion; text identical
to another page of the same brand (the later copy goes); more than 40% of the page's words in lines of
six words or fewer. Then, new here: **information packs (PDFs) are not measured** (tables and
cover-page text, not prose); and a page needs **at least 100 words and at least 5 sentences of
running prose** (section 2) to be scored, because readability formulas are unstable below that.
At registration SGR-010 measured 16,070 pages from 117 brands, 120 of them information packs; five of the
122 brands have no page left after the rules.

**Categories.** `blog`; `press` (press releases and news); `announcement` (product launches and release
notes). H1 compares press with blog only. Announcements are pooled with press in H2 and H3 (as SGR-011 did) and
shown on their own in the descriptive tables.

**Eras and dates** as in `brand-series-preregistration.md` section 1: EARLY = 2015 to 2018, LATE = 2019 to
November 2022, TRANSITION = December 2022 to December 2023, AFTER = January 2024 onward. The primary time
analyses use dates from `meta`, `jsonld`, `url` and `captured` (archived pages are always before December
2022); `text` and `modified` dates are added in a sensitivity run. Undated pages are kept in every level
comparison and left out of every comparison over time.

## 2. Text: running prose

Readability formulas were built for sentences in running text. Firecrawl's markdown puts headings,
bylines, dates, captions and buttons on lines of their own, and counting each as a sentence would make
every page look easier than it reads. So, for the primary measure:

1. Take the converted plain text and keep only **lines that end in a full stop, question mark or exclamation
   mark** (optionally followed by a closing quote or bracket). Headings, bylines, captions, buttons and
   unpunctuated list items are dropped.
2. Split each kept line into sentences after `.`, `!` or `?` (plus closing quotes) followed by whitespace and
   a capital letter, digit or opening mark, except after the abbreviations Mr, Mrs, Ms, Dr, Prof, St, vs, Inc,
   Ltd, plc, Co, No, approx, e.g, i.e, etc, the month abbreviations, and single letters.
3. **Words** are runs of letters with inner apostrophes, taken from whitespace-separated chunks. A chunk that
   contains a digit, an `@`, `://` or `www.` is skipped (numerals, prices, years, addresses have no defined
   syllable count in the standard formulas). Hyphens and slashes split a chunk, so `state-of-the-art` is four
   words.
4. A page is **scored** if its running prose has at least 100 words and 5 sentences. Pages that fail are counted
   and reported (`unscorable`).

The code is `scripts/experiments/sgr-023/readability.mjs`. **Labelled variant:** the product's own sentence splitter
(`splitSentences`, which also splits on newlines, so headings and list lines become sentences) applied to the whole
converted text, the convention SGR-010 used for average sentence length.

## 3. Measures (product code and published formulas; no language model)

With W words, S sentences and Y syllables per page (A = W / S, the average sentence length; Y / W = syllables per word):

| Measure | Formula | Source |
|---|---|---|
| **Flesch Reading Ease (FRE)** | 206.835 − 1.015 × (W / S) − 84.6 × (Y / W) | Flesch, R. (1948). A new readability yardstick. *Journal of Applied Psychology* 32(3), 221 to 233 |
| **Flesch-Kincaid grade (FK)**, the primary measure | 0.39 × (W / S) + 11.8 × (Y / W) − 15.59 | Kincaid, J. P., et al. (1975). *Derivation of New Readability Formulas (Automated Readability Index, Fog Count and Flesch Reading Ease Formula) for Navy Enlisted Personnel.* Naval Technical Training Command Research Branch, Millington TN, February 1975; DTIC ADA006655, doi:10.21236/ada006655 (record checked in Crossref 2026-10-12; Flesch 1948 checked in Crossref, doi:10.1037/h0057532, vol. 32 no. 3, pp. 221-233) |
| **Reading age** | FK + 5 | A convention: US grade 1 is the school year of six-year-olds. We know no standards body that defines this conversion, so the page presents it as a translation, and FK as the measure |

**Supporting measures** (they explain the grade): average sentence length W / S; syllables per word Y / W; the
share of words of seven or more letters (SGR-010's long-word rule, letters only); the share of words of three or more
syllables; letters per word; and the share of sentences longer than 25 words. The grade is exactly the sum of a
sentence term and a word term, and the page splits each difference into the two.

**Syllable counter** (`syllables.mjs`; rules only, no dictionary at run time). Lower-case letters only; a table of 70
exceptions for common words that the rules get wrong (chosen without reference to the test half below); otherwise count vowel groups
`[aeiouy]+` after removing a silent final `e`, `-ed` after a consonant other than `t` or `d`, and `-es` after a
consonant other than `l s x z c h`, and a leading `y`; then add one for each of: `ia` not before `n`, `ua` not after
`q` or `g`, `uo`, `eo` not before a vowel, `ing` after a vowel, `iu`, `ie` before `t`, `io` not before `u` or `n`,
`ea` before final `l` or `t`, and for `-ism`. A minimum of one. **Capitalised tokens of 2 to 5 letters are read as
initialisms** (FCA, VAT, BT: one syllable per letter, W counting three) except a fixed list of acronyms that are
spoken as words (NATO, NASA, ISA, SIM, COVID, and so on; `readability.mjs`).

**Validation, before freezing.** Reference: the CMU Pronouncing Dictionary, `cmudict.dict` from
github.com/cmusphinx/cmudict (Carnegie Mellon University, BSD-style licence), SHA-256
`81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22`; a word's syllables are the number of vowel
phonemes in its first listed pronunciation. The dictionary's 117,486 words made only of letters were split by a hash of
the word into a **dev half** (used to write the rules and the exception table) and a **test half** (looked at after the
rules were frozen). Result at freeze (`validate-syllables.mjs`):

| Half | Words | Exact match | Any pronunciation | Within one | Mean error (counter minus dictionary) |
|---|---|---|---|---|---|
| dev | 58,117 | 89.7% | 90.3% | 99.7% | −0.041 |
| test | 59,369 | 90.1% | 90.7% | 99.7% | −0.036 |

Dictionary types are dominated by proper names, which are harder than the words brands use, so the run also checks the
counter on the word occurrences in the corpus (`syllable_validation` in the summary). On the pilot (4 brands, 232 pages) the
counter matched the dictionary on 96% of word occurrences, with a mean error of 0.002 syllables a word. **Validation criteria**,
fixed now and computed again in the full run over all word occurrences found in the dictionary: exact agreement at least
0.92; absolute mean error per word at most 0.05; correlation between page FK from the rules and page FK using dictionary
syllables where available at least 0.98; absolute mean page FK difference at most 0.3 grades. If any fails, `write-entry.mjs`
refuses to write the page and the study comes back to Jack. It is never silently switched to the dictionary count.
The dictionary count (American pronunciation; contractions and names missing fall back to the rules) is a labelled sensitivity.

**Aggregation.** A brand's value is the mean over its scored pages in the group; groups are summarised across brands
(median, 10th, 25th, 75th and 90th percentile, and the brand-weighted mean), so a brand with many pages does not dominate.
Intervals are 95% cluster bootstraps over brands (2,000 resamples, seed 20261027 plus a fixed offset per statistic,
brands resampled within sectors), the method of the brand series.

## 4. Hypotheses and pass or fail rules

A failed hypothesis is reported at the same prominence as a passed one. The page states each result as "supported",
"not supported", "reversed" or "not testable", and each is a statement about FK grade.

**H1 (press releases are harder to read than the same brand's blog posts).** Brands with at least 10 scored press
pages (category `press` only, announcements excluded) and at least 10 scored blog pages. For each brand,
mean FK of its press pages minus mean FK of its blog pages; the statistic is the mean over brands. **Supported** if the lower end of the 95%
interval is above 0; **reversed** if the upper end is below 0; otherwise not supported. The page also splits the
difference into a sentence-length part (0.39 × the difference in W / S) and a word-length part (11.8 × the difference in
syllables per word).

**H2 (writing became harder to read between 2015 to 2018 and 2024 onward).** Cells are a brand and channel (blog; press
and announcements together) with at least 10 scored pages dated EARLY and at least 10 dated AFTER, using the strict
date sources and archived pages. Cell change = mean FK (AFTER) minus mean FK (EARLY); a brand's change is the mean over its cells;
the statistic is the mean over brands. **Supported** (harder) if the lower end of the 95% interval is above 0; **reversed**
(easier) if the upper end is below 0; otherwise not supported.

**H3 (banks and insurers became easier to read, relative to other sectors, once the Consumer Duty applied).**
*Source and date, checked on the FCA's own pages on 2026-10-12.* The FCA published the final rules as PS22/9 on 27 July 2022,
and the Consumer Duty came into force on 31 July 2023 for open products and services (31 July 2024 for closed products).
PRIN 2A.5.3R requires a firm's communications to retail customers to "meet the information needs of retail customers", to be
"likely to be understood by retail customers", and to "equip retail customers to make decisions that are effective, timely
and properly informed". The Duty is a regulatory requirement about understanding, not a plain-English commitment by
individual brands. *Groups.* **Regulated** = the bank and insurance sectors (28 brands, all FCA-regulated retail
firms). **Comparison** = the other eight sectors. *Windows* (month precision of the date required): PRE = January 2015 to June
2022 (before the final rules were published); POST = August 2023 onward (after the Duty took effect); July 2022 to July 2023 is left out.
Cells are a brand and channel with at least 10 scored pages in each window. A brand's change = mean over its cells of
mean FK (POST) minus mean FK (PRE). The statistic is the mean change over regulated brands minus the mean change over comparison brands (a
difference in differences, so that a rise or fall shared by all sectors, including any effect of ChatGPT, drops out).
It needs at least 8 eligible brands in each group, otherwise it is **not testable**. **Supported** (regulated brands became relatively easier to read)
if the upper end of the 95% interval is below 0; **reversed** if the lower end is above 0; otherwise not supported. Page counts
by cell (not readability values) were checked in advance to choose the 10-page threshold and the January 2015 start; with them
about 8 regulated and 19 comparison brands qualify, which is why the test has little power and the page says so.

**What we already know (not blind).** SGR-010 found press releases had longer sentences than the same brand's blog posts
(+2.87 words, supported), so H1 is nearly settled on the sentence term already; what is new is the syllable term and the grade.
SGR-011 reported by-year average sentence length (its splitter) rising from 12.8 words in 2015 to between 13.4 and 15.0 in each year from 2019 to 2026,
so H2's prediction of "harder" rests on a number we have seen. No readability or syllable measure has been computed for the
corpus before the pilot, and the pilot used under 5% of it. The Consumer Duty comparison is new.

## 5. Fixed outputs

1. `public/research/sgr-023-summary.json`: counts and exclusions; the syllable validation; every hypothesis result with its interval;
   brand-weighted levels (mean, median, 10th, 25th, 75th and 90th percentile across brands, with intervals for the mean and median of FK, reading age and FRE) for all brands, each of the 10 sectors, each channel, each
   sector-channel pair, each era and each source, for FK, reading age, FRE, sentence length, syllables per word, long-word share, three-or-more-syllable share and share of sentences over 25 words; the decomposition of each sector's FK into sentence-length and word-length parts; correlations across brands of FK with each supporting measure; the reference comparison (below); mean by calendar year 2015 to 2026 (all, blog, press) with intervals; every sensitivity (section 6).
2. `sgr-023-pages.csv` (one row per scored page: URL, brand, sector, category, source, date, date source, era, words, sentences, FK, reading age, FRE, supporting measures, FK under both variants; no text), `sgr-023-brands.csv`, `sgr-023-sectors.csv`, `sgr-023-by-year.csv`.
3. Two figures: reading age by sector (spread across brands) and by year (blog and press).

**Reference for plain English.** The only source we have for a plain-English target is GOV.UK's *Writing to GOV.UK standards*,
"Use clear language" (guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/):
"Try to split up sentences that are over 25 words long." The study reports the share of sentences over 25 words, the share of brands whose average
sentence is over 25 words, and the share of pages with more than a quarter of their sentences over 25 words. A "reading age of 9" is
quoted as GOV.UK guidance by other public-sector pages (for example the Home Office design manual) but we did not find it on the current GOV.UK
page, so it is **not used** as a target; the page says so.

## 6. Sensitivity and robustness (labelled exploratory)

Each of H1, H2 and H3 is repeated with: the product's sentence splitter on all lines; dictionary syllables; FRE in place of FK;
pages of 300 words or more; a threshold of 5 pages per cell. Also, H1: live pages only; announcements pooled with press. H2: guessed dates
(text and modified) included; average sentence length and syllables per word as the outcome; blog only and press only; EARLY to LATE and LATE to AFTER separately; each sector alone (cells of 8 pages). H3: PRE from January 2019; supermarkets removed (some run FCA-regulated arms); banks alone and insurers alone against the
comparison; sentence length and syllables per word as the outcome. The source check: brands with 10 live and 10 archived
pages from 2019 to November 2022, live minus archived, for FK, sentence length and syllables per word.

## 7. Analysis plan

Deterministic: the same inputs and seed give the same files. `run.mjs` makes no network request and no model call; it reads the
brand files and `cmudict.dict` (SHA-256 checked) from disk. Exclusions are counted per brand. Brand-weighted throughout.

## 8. What the study cannot show

- **Comprehension.** Readability formulas measure sentence length and word length. They do not measure whether a reader understood,
  the reader's prior knowledge, layout, or whether a page suits its audience; specialist pages can score hard and serve readers well.
- **Authorship.** Nothing here shows whether a page was written with AI, and the page says voice measurement cannot establish that.
- **Cause.** A change over time is not shown to be caused by AI tools or by the Consumer Duty. H3 asks only whether regulated sectors
  moved differently from the rest, with few brands, and the Duty's wording is about communications to retail customers, which may not be the blog and press pages measured.
- **A reading age of any person.** Reading age is FK + 5, a convention.
- **Representativeness.** Pages were sampled by fixed rules from each brand's own sites, UK consumer brands only; many pages are undated.
- Archived pages (to November 2022) and live pages (after) came by different routes; the source check measures how much that matters.

## 9. Pilot

`run.mjs --pilot` was run to test the script end to end on 5 of the 122 brands (chosen by a hash of the domain; 232 scored pages, 1.5% of
the corpus) with 200 bootstrap resamples; `run.mjs --synthetic` tested the analysis code on invented data with known effects (an
added 1.0-grade press effect, a 0.5-grade change, a 1.0-grade regulated-sector change; the code recovered all three).
Pilot numbers are not reported anywhere and the pilot outputs are not committed. The syllable validation found a bug (a word such as
"constructor" matched an object property in the exception table), fixed before the freeze. The pilot also informed the corpus-token criteria in section 3, which sit below the pilot figures.
No hypothesis, threshold or window was changed after seeing pilot readability numbers.

## 10. Reproduction

`scripts/experiments/sgr-023/README.md` has the exact commands and the run time.

## Deviations
None. The full run on 2026-10-27 followed this document unchanged. (Anything changed after the freeze is listed here with the date and reason.)
