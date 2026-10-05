# Brand writing series (SGR-010 to SGR-018): pre-registration

Frozen: 2026-10-05, committed before any page of the brand corpus was measured. The git
commit that adds this file is the timestamp. Changes after it go under "Deviations" at the
bottom with the date and the reason.

## 1. Data
The brand deep corpus v1.3 (`scripts/experiments/brand-corpus/`, text on the Storage Box):
17,518 pages from 122 UK brands in 10 sectors. Each page has a category (blog, press,
announcement, info_pack), a source (`live`, fetched 4 to 5 October 2026, or `wayback`,
the archived original captured between 2015 and 30 November 2022) and a best date with its
source (`dates.mjs`: meta, jsonld, url, text, captured, modified).

**Text measured.** The page's markdown (Firecrawl, main content only) turned into plain
text: images, link targets, table rows, code and markdown symbols removed, headings and list
items kept as lines. Not `text_product`, which keeps navigation and footer text (SGR-009,
limitations). Info packs (PDFs) are measured for SGR-010 only.

**Exclusions** (counted and reported): fewer than 150 words after cleaning; a page whose
text is identical to another page of the same brand (the later copy goes); pages whose
plain text is more than 40% lines of six words or fewer (menus, lists of links).

**Eras.** Pre = before 1 December 2022, split into EARLY (2015 to 2018) and LATE (2019
to November 2022). TRANSITION = December 2022 to December 2023. AFTER = January 2024
onwards. Era comes from the best date; archived pages are always pre (their capture
predates 1 December 2022). Pages with no date are left out of every time comparison and
kept in the overview. Primary time analyses use only dates from meta, jsonld, url and
captured; text and modified dates are added in a sensitivity analysis.

## 2. Measures (product code, no language model)
Per page, with `scripts/experiments/sgr-007/instruments.mjs` (unchanged) plus:
- **AI-ism rate (primary for SGR-011):** uses per 1,000 words of SGR-007's frozen lists
  OLD + CALLED_OUT + MARKETING, each occurrence counted once (`ai_ism_per1000`). Also
  each list separately, and QUIET.
- **AI sentence shapes:** `scanCliches(text).per1000` (the free AI cliché checker's scan).
- **Em dashes per 1,000 words** (U+2014 and spaced en dashes).
- Average sentence length; sentence-length variation (`measureBurstiness`: SD / mean);
  share of sentences under 8 words; contractions per 1,000 words; commas per sentence;
  exclamation marks per 1,000 words; questions per 1,000 words; the share of I, we and
  you among those three (`measureTextFeatures`); long-word share (7+ letters).
- **Pairwise voice score (SGR-012 only):** the production `computeVoiceMatch` with
  `pseudoProfileFromText` and no judge (counted features only; SGR-009 found this as
  informative as the judged score on web copy). No API calls in this series.

Brand-level summaries use the mean over a brand's pages, so a brand with many pages does
not dominate. Intervals are 95% cluster bootstraps over brands (2,000 resamples, fixed
seed, brands resampled within sectors).

## 3. SGR-010 How UK brands write (descriptive)
All pages, all eras. Fixed outputs: for every measure, the 10th / 25th / 50th / 75th /
90th percentile by category and by sector (brand-weighted), and the brand-level spread
within each sector. Two pre-registered comparisons, within brand (brands with at least 10
press and 10 blog pages after exclusions):
- **O1.** Press releases have longer average sentences than the same brand's blog posts.
- **O2.** Blog posts have a higher share of "you" than the same brand's press releases.
Supported if the 95% interval of the mean within-brand difference excludes zero in the
predicted direction.

## 4. SGR-011 Did brand writing change after ChatGPT? (confirmatory)
**Cells.** A brand-category cell (blog or press; announcements pooled with press) is
eligible if it has at least 10 LATE pages and at least 10 AFTER pages. Cell change =
mean(AFTER) minus mean(LATE). The headline is the mean cell change over eligible cells,
each brand weighted equally (a brand with two eligible cells has each weighted one half).
- **H1 (AI-isms rose).** Mean within-brand change in the AI-ism rate is above zero.
- **H2 (not a continuing trend).** For cells that also have at least 10 EARLY pages, the
  LATE-to-AFTER change in the AI-ism rate is larger than the EARLY-to-LATE change, scaled
  per year (LATE-to-AFTER spans a median of about 4 years; the difference is computed per
  year using each cell's median page dates).
- **H3 (em dashes rose).** Mean within-brand change in em dashes per 1,000 words is above zero.
- **H4 (AI sentence shapes rose).** Mean within-brand change in the sentence-shape rate is above zero.
- **H5 (rhythm stayed put).** The mean within-brand change in average sentence length is
  within 1.5 words of zero (equivalence: 90% interval inside [-1.5, +1.5]).
H1, H3 and H4 are supported if the 95% interval excludes zero in the predicted direction.
A failed hypothesis is reported in the same place and at the same prominence as a passed one.

**Robustness (labelled).** (a) The source check: brands with at least 10 LIVE pages and at
least 10 ARCHIVED pages from 2019 to 2022 compare the two, to show whether live old pages
have been edited since; (b) blog and press separately; (c) by sector; (d) with text and
modified dates included; (e) TRANSITION (2023) as its own era; (f) the QUIET list.

## 5. SGR-012 Press release or blog post: does a brand keep one voice? (confirmatory)
AFTER-era pages of 300 or more words, brands with at least 8 blog and 8 press pages. Ordered
pairs scored with the counted-features voice score (raw). Pair kinds: same brand same
category (SB-SC), same brand other category (SB-OC), other brand same sector same category
(OB-SC).
- **C1.** SB-SC pairs score higher than SB-OC pairs (median raw, within brand).
- **C2 (channel beats brand).** OB-SC pairs score higher than SB-OC pairs. This retests,
  on long-form writing, the idea SGR-009 rejected for landing pages.
Supported if the 95% interval of the difference in medians excludes zero.

## 6. SGR-013 to SGR-018 Sector reports (descriptive)
Banks, energy, telecoms, software, insurance, charities (the sectors with at least 1,500
pages). Each: the SGR-010 tables for the sector against all other sectors, and the SGR-011
measures within the sector (exploratory, with intervals). Fashion, travel, grocery and food
appear in SGR-010 only.

## 7. What we publish
Per-page measurements (URL, brand, sector, category, source, date and date source, every
measure), every table and interval, the scripts. No page text. Licence CC BY 4.0. Pages
report sectors and spreads; brand names appear in the data files.

## 8. Limits we already know
- Word lists count spellings, and their words rose in human writing for decades before
  ChatGPT (SGR-007). A rise shows style, not authorship; nothing here can tell whether a
  page was written with AI, and no page will say it can.
- Before is archived and after is live: different collection routes. The source check (4a)
  measures how much that matters.
- Pages were sampled by fixed rules, not at random from everything a brand published.
- Dates from `captured` are upper bounds on publication; `text` dates are guesses.
- UK consumer brands only.

## Deviations and clarifications
1. **2026-10-05, before any outcome was analysed: the list-like rule.** Section 1 excluded
   pages whose plain text is "more than 40% lines of six words or fewer". The first run
   excluded 10,774 of 17,518 pages (61%) on that rule: Firecrawl's markdown puts headings,
   bylines, dates, captions and buttons on lines of their own, so most real articles cross
   40% of lines. The rule existed to drop menus and lists of links, so it now reads: more than
   40% of the page's **words** sit in lines of six words or fewer. On a structure-only check of
   one brand in six (no outcome measure was looked at), that excludes 3% of pages, and the
   pages it catches are blog index and navigation pages. The threshold is unchanged.
