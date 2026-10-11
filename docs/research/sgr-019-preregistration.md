# SGR-019: Has the em dash really taken over? (pre-registration)

Frozen: 2026-10-11, committed before any full measurement. The git commit that adds this
file is the timestamp. Changes after it go under "Deviations" at the bottom with the date and
the reason. The full run is on Monday 13 October 2026 (the page's "conducted" date) and the page
goes live on Tuesday 14 October 2026.

## 0. Question

How many em dashes per 1,000 words did published English use from 1800 to 2026, did their
use in three modern bodies of writing (UK brand blogs and press releases, arXiv abstracts,
company homepages) rise after ChatGPT's launch (30 November 2022) beyond where each body's own
2015 to 2022 trend was heading, and is today's rate high or low against 19th-century books?

## 1. Data

All collections are already held by ScriptGrain. Nothing is crawled or bought for this study;
the only new download is the full text of Project Gutenberg books that SGR-005 and SGR-006
sampled in passages (their text was measured and discarded).

| Collection | What | Period | Size at registration |
|---|---|---|---|
| arXiv | Abstracts in the SGR-008 census (`~/research/sgr-008`, read only), the included set of `census-papers.jsonl.gz` | 2015-01 to 2026 | about 2.06 million after exclusions |
| Brand writing | The brand deep corpus v1.4 (122 UK brands, 10 sectors; Storage Box copy under `~/research/sgr-019/brand`): blog, press and announcement pages | 2015 to 2026, dated | 17,056 stored pages before the rules below |
| Homepages | SGR-004's published measured rows (`public/research/sgr-004-web-copy-rows.json`): 2,950 homepage-years, 27 years, the panel of companies SGR-004 chose | 2000 to 2026 | 2,950 rows |
| Books | Project Gutenberg whole books: the SGR-005 panel (453 works by 35 authors, with publication years) and the SGR-006 book sample (823 further books by genre and author era) | 1700s to early 1900s | 1,276 books (`books.json`) |
| Web 2021 | SGR-007's published rows for web pages captured in 2021 (news, press releases, blogs, essay mills, how-to, forums, Wikipedia, GOV.UK) | 2021 | about 6,600 rows |

Text for arXiv, brand writing and books is stored under `~/research/sgr-019` or its sources for
the run and is never committed or published. Only counts and rates are published.

**Where homepage text no longer exists.** The Wayback text behind SGR-004 was deleted when that
study was published. Homepages and the 2021 web pages therefore enter as the published
per-page rates and word counts, and cannot be recounted under this study's dash rule (section 3).
They are reported as lower bounds and never pooled with the other collections.

### Exclusions (each counted and reported)

- arXiv: abstracts of fewer than 30 words; papers dated up to November 2022 with any version
  dated after 30 November 2022 (the latest version's wording would be post-ChatGPT; SGR-008's
  rule, taken from its `base_ok` flag). Posted from December 2022, all papers are kept.
  SGR-008's `pilot` flag marked papers used to choose word lists and does not matter here, so it
  is ignored.
- Brand writing: the SGR-010/011 page rules (fewer than 150 words; exact-duplicate text within a
  brand, the later copy going; pages where more than 40% of the words sit in lines of six words or
  fewer), plus **all information packs (PDF annual reports, impact reports, fact sheets)**:
  their tables use dashes as empty cells and single files run to hundreds of thousands of words.
  Only blog, press and announcement pages are measured.
- Brand pages with no date from metadata, structured data, URL or archive capture, or dated
  before 2015, are kept in the overview counts and left out of every time comparison.
  A date with a year but no month is placed in July of that year.
- Books: fewer than 5,000 words between the Project Gutenberg START and END markers; files that
  cannot be downloaded.

## 2. Text and words

- Brand pages: SGR-010's plain-text conversion of the markdown (`mdToPlain`), unchanged.
- Books: the text between the `*** START OF` and `*** END OF` markers. Prefaces, editors' notes
  and footnotes inside the markers stay in.
- arXiv: the abstract as stored.
- **Words.** Every dash mark (section 3) is replaced by a space; then a word is a run of
  non-space characters containing at least one letter or digit. So `word--word` is two words and a
  spaced dash is never a word. SGR-010 counted every run of non-space characters, which also
  counts a spaced dash as a word; the two differ in the second decimal place of a rate.

## 3. The dash rule (the measure)

**Reuse of SGR-010:** an *em dash mark* is U+2014 or an en dash (U+2013) with a space on both
sides. That is the **strict rate**, computed for every text and published beside the main rate.

**Plain-text conventions (the main rate adds these, because the source cannot hold U+2014):**

| Family | Extra marks counted |
|---|---|
| Typeset text (brand pages, 2021 web) | none; strict = main |
| Project Gutenberg books | a run of exactly two or three hyphens (`word--word`, `no---stop`, `a -- b`). Runs of four or more (rules, redactions such as `Mr. ----`) are not dashes |
| arXiv abstracts | three hyphens (LaTeX `---`) or two hyphens with whitespace or text-edge on both sides (`a -- b`). An unspaced `--` is LaTeX's en dash for ranges (`1--10`, `Erdos--Renyi`) and is **not** counted. Two hyphens inside a longer run are not counted |

ASCII hyphen-minus with spaces (`a - b`) is not counted in any collection (it is also the minus
sign). Horizontal bars, `&mdash;` entities and `\textemdash` are not counted (none was found in
the arXiv sample used to write the rule).

**Who made the dash.** In books the dash may be the editor's or typesetter's, not the author's, and
the Gutenberg file shows the dash as two hyphens whichever mark the print edition used. In arXiv
the dash is the author's but only if typed as above. In brand copy it may be a CMS's typographic
substitution. The page says so; the study measures the text as published.

**Rate** = dash marks per 1,000 words, **pooled** over the texts in a group (total marks / total
words), so a long text weighs more. Also reported: the share of texts with at least one mark
(arXiv, brand pages, homepages).

## 4. Windows

- EARLY = January 2015 to December 2018. LATE = January 2019 to November 2022 (pre-ChatGPT).
- TRANSITION = December 2022 to December 2023, left out of every pre/post comparison.
- AFTER = January 2024 onward (to the last month with data).
- Homepages use years: pre = 2015 to 2022, post = 2024 to 2026 (captured 1 July each year).

## 5. Hypotheses and pass/fail rules

Intervals are 95% cluster bootstrap percentile intervals (section 7).

**Trend projection (H1 to H3).** For a collection, pool words and marks by quarter over the pre
window (2015-01 to 2022-11), fit a straight line to the quarterly pooled rates by weighted least
squares (weights = words), carry it forward, and average the fitted values over the AFTER
quarters, weighted by the words observed in each. *Projected* = that average. *Observed* =
the pooled AFTER rate. *Difference* = observed minus projected. Homepages: the same with
years as the periods. Clusters: brands (brand writing), primary subject categories (arXiv), sites
(homepages).

- **H1 (brand writing).** Observed is above projected: **supported** if the lower end of the
  interval for the difference is above 0; **reversed** if the upper end is below 0; otherwise
  not supported.
- **H2 (arXiv abstracts).** The same rule on arXiv abstracts.
- **H3 (homepages).** The same rule on homepages (U+2014 only; a lower bound).
- **H4 (today against the 19th century).** (a) The pooled brand-writing AFTER rate divided by the
  pooled rate in 19th-century non-fiction Gutenberg books (SGR-006 books of the 1800s era in the
  genres biography, essays, history, letters, philosophy and religion, science, travel).
  (b) The pooled arXiv AFTER rate divided by the rate in 19th-century science books (SGR-006,
  1800s era). Each is **supported** (today is lower) if the upper end of the interval for the ratio
  is below 1; **reversed** (higher) if the lower end is above 1; otherwise not supported. Books
  and modern texts are resampled independently. The prediction is that today's rate is lower,
  because 19th-century punctuation used dashes freely; we would not be surprised by either result.
  Fiction and literary works are shown beside these as a descriptive comparison and are not a
  test, because the modern collections contain no fiction.
- **H5 (rising before ChatGPT).** In brand writing, the pooled LATE rate divided by the pooled
  EARLY rate: **supported** if the lower end of the interval is above 1; **reversed** if the upper
  end is below 1.
- **H6 (breadth).** Among brands with at least 5 dated pages in LATE and at least 5 in AFTER, the
  share whose pooled AFTER rate is higher than its LATE rate: **supported** if the share is at
  least 60% and the lower end of its Wilson 95% interval is above 50%; **reversed** if the share
  is at most 40% and the upper end is below 50%; otherwise not supported.

A failed hypothesis is reported at the same prominence as a passed one. The page states each
result in the words "supported", "not supported" or "reversed".

### What we already know (not blind)

SGR-011 (brand writing, same corpus, before and after) reported the within-brand change in em
dashes per 1,000 words as not supported (a small positive change with an interval around zero)
and SGR-004 reported homepage em dash use rising for two decades before ChatGPT. So H1 and H3
are not independent of results we have seen. What is new here is the trend-projection test
(a rise can be "not a step" and still be above the trend, or the reverse), arXiv, books, and the
long axis. We did not look at any arXiv or book dash rate before the pilot, and the pilot used
under 5% of each collection.

## 6. Fixed outputs

1. `public/research/sgr-019-summary.json`: counts, exclusions, all hypothesis results with
   intervals, levels (EARLY, LATE, AFTER by collection; 1800s books by kind), yearly series,
   exploratory cuts (arXiv by subject group, brand writing by sector, books by genre and era,
   web 2021 by kind, strict against main rate), run time.
2. `sgr-019-by-year.csv` (collection, year, texts, words, marks, rate, interval, strict rate,
   share of texts with a mark); `sgr-019-books.csv` (one row per book); `sgr-019-brand-pages.csv`
   (one row per brand page, URL and date, no text); `sgr-019-arxiv-monthly.csv` (month by subject
   group: texts, words, marks).
3. Two figures: the 1800 to 2026 series and the three trend panels.

## 7. Analysis plan

- Bootstrap: 1,000 resamples, seed 20261013 (+ a fixed offset per statistic), resampling
  whole clusters with replacement: brands (brand writing), primary arXiv category (a cluster is
  at least 3 categories or no interval is reported), site (homepages), first-listed author
  (books). Percentile intervals (2.5th and 97.5th).
- Yearly series use calendar years (books: decades of publication year for SGR-005 works, and
  the author-era bands 1700s / 1800s / early 1900s for all books).
- Exploratory cuts are labelled as such and carry intervals but no hypotheses.
- Deterministic: the same inputs and seed give the same files. `run.mjs` makes no network
  request and no model call.

## 8. What the study cannot show

- Authorship. A dash count does not show whether text was written, edited or reformatted by AI,
  and the page says voice measurement cannot establish that.
- Cause. Before and after differ in many ways besides AI tools.
- That the collections represent English or the web: books are the ones the earlier studies drew,
  the brand and homepage panels are UK-chosen company lists, arXiv is one scientific archive.
- Comparability across collections: genres differ, so the lines in the long-run chart are not one
  sample of English over time.
- Dash habits that arXiv's ASCII storage hides (unspaced `--` meant as a dash) or that Gutenberg's
  conversion merges.

## 9. Pilot

`run.mjs --pilot` was run to test the script end to end on at most 5% of each collection (every
40th arXiv census file, about 2.5%; 5 of 122 brands; 36 of 1,276 books; about 3% of the homepage
rows and about 4% of the 2021 pages), with 200 bootstrap resamples. Pilot numbers are not reported anywhere
and the pilot outputs are not committed. The pilot was used to fix the script and to decide the
rule on information packs (section 1), which was made before any full measurement. No hypothesis,
threshold or window was changed after seeing pilot numbers.

## 10. Reproduction

`scripts/experiments/sgr-019/README.md` has the exact commands and the run time.

## Deviations
(None yet. Anything changed after the freeze is listed here with the date and reason.)
