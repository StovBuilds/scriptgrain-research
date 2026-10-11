# SGR-025: The ScriptGrain Writing Index, Q4 2026 (pre-registration)

Frozen: 2026-10-11, committed before any full measurement of the new pages. The git commit that adds
this file is the timestamp. Changes after it go under "Deviations" at the bottom with the date and the
reason. The full run is on Monday 3 November 2026 (the page's "conducted" date) and the page goes live
on Tuesday 4 November 2026.

## 0. Question and what this study is

SGR-004 measured 161 long-lived company homepages once a year from 2000 to 2026. The "Ongoing: the
Index" item of `docs/plans/writing-index-research-plan.md` asks for a quarterly refresh and one
dataset with stable column names and a changelog, called **The ScriptGrain Writing Index**. This is
its first refresh and first release. Two questions:

1. What is the Index reading for the fourth quarter of 2026 (period `2026-Q4`) on a frozen set of
   measures?
2. Did the writing on the panel's homepages differ between its mid-2026 reading (SGR-004) and
   `2026-Q4`?

The second is a comparison across about four months and across two ways of obtaining a page (section 8).
**We expect little or no change, and say so in advance.** A report of "no detectable change" is a
complete result.

## 1. Data

| Part | What | Size |
|---|---|---|
| Panel | `scripts/experiments/sgr-004/panel.json`, unchanged: 161 UK and US company homepages in 11 sectors | 161 |
| History | SGR-004's published rows, `public/research/sgr-004-web-copy-rows.json`: one Wayback capture per site per year, 2000 to 2026 | 4,347 site-years, 2,950 measured |
| Baseline | The history's 2026 rows. Their captures are dated **30 June to early July 2026** (SGR-004 fetched them on 4 October 2026, but the pages are the archive's June and July copies). So the gap to `2026-Q4` is about three and a half months, not one quarter | 107 measured |
| New point | Each panel company's CURRENT homepage, fetched once, live, `https://<domain>/` (falling back to `https://www.<domain>/` if that fails), through Firecrawl's `/v1/scrape` with the same settings as SGR-004's `render.mjs` (`rawHtml`, JavaScript run, `waitFor` 2000, `onlyMainContent` false) plus `maxAge: 0` so no cached copy is served | 161 requests |

**Collection window.** The brief allowed the week of 27 October. The fetch was done early, on
**11 October 2026 (UTC), 21:30 to 21:39**, because the D-1 run then needs no network and cannot be
broken by a rate limit or a refused site on the day. Nothing else was fetched live (apart from the
checks in section 6). The page therefore says "collected 11 October 2026". The quarter label `2026-Q4`
is the calendar quarter of the fetch. Fetch outcomes only (HTML saved or not) had been looked at before
this document was committed: 155 pages saved and 6 refused by the service (aa.com, ebay.com, linkedin.com,
ryanair.com, southwest.com, yelp.com: "we do not support this site", or a timeout on retry). No page had been measured except the 8
pilot sites (section 9) and a run-time check of the three largest files (status only).

**Firecrawl account.** One key is shared fleet-wide with the live product. Budget for this study 500
credits; floor 10,000. Balance read from `GET /v2/team/credit-usage` before the first call (49,513) and
after the last (49,315): 198 credits spent. Every call also logs to `~/research/sgr-025/credits.jsonl`.
The D-1 run makes no Firecrawl call.

Pages are stored gzipped under `~/research/sgr-025/` (about 26 MB) for the run, never committed and
never published. Only counts and rates are published.

## 2. Inclusion and exclusions

Same rules as SGR-004, applied to the new pages:

- A homepage is **measured** if, after extraction (section 3), it has at least 100 words of prose.
- Otherwise it is recorded under one status and counted: `too_little_prose`, `bot_wall` (the SGR-004
  bot-check pattern appears in the first 600 characters or the title), `fetch_failed` (refused or
  no page returned), or `http_error` (final HTTP status 400 or above).
- A homepage that redirects to another domain (comcast.com to xfinity.com) is measured as served, as
  SGR-004 did, and counted under `redirected_off_domain`.
- The comparison (section 5) uses **matched sites**: companies measured in both the baseline and
  `2026-Q4`. If fewer than **80** are matched, the comparison is "not assessed" and the entry builder
  refuses to write the page; the study then goes back to Jack.

## 3. Extraction and measures (identical to SGR-004)

The page text comes from `scripts/experiments/sgr-004/homepage-text.mjs` (imported, not copied), and
every measure from `scripts/experiments/sgr-007/instruments` as used by SGR-004:
`measureTextFeatures` and `scanCliches` from the product code, plus SGR-004's two fixed word lists
(`lexicons.json`). `lib.mjs` `measureHtml` is a copy of the row-building part of SGR-004's `measure.mjs`
(that script is not importable). No language model is used to read or score a page. Derived field
`ai_era_style_per1000` is SGR-004's disclosed rule: the AI-era rate with "ai-powered" and "powered by
ai" removed.

**Instrument reproduction.** SGR-004's text was not kept, so the old rows cannot be re-measured from
text. Instead `collect.mjs --wayback-verify` re-renders SGR-004's own 2026 capture (same timestamp) of
the 8 pilot sites and `verify.mjs` checks that this code reproduces the published row on every numeric
column. A replay is re-rendered by Firecrawl each time and can come back different (an empty script
shell, or content that loads differently), so each site gets up to three attempts and counts as
reproduced if one attempt matches the published row exactly. **Pass: at least 4 of 8 sites.** Result
on 11 October: 4 of 8 (apple.com, adobe.com, mastercard.com and dhl.com identical on all columns;
atlassian.com, bestbuy.com, zappos.com and comcast.com differed because the replay itself returned
a different page on each attempt, for example comcast.com returned 0, 419 and 1,024 words on three
attempts). This is a test of the code, not of the pilot's live pages.

## 4. The Index definition (v1.0.0, frozen: `scripts/experiments/sgr-025/index-definition.json`)

**Six headline measures, no composite.** The measures move in different directions (homepages get
longer while sentences stay short; vocabulary rises while dotcom words fall), so any single number
would hide that, and its weights would be a free choice that could be tuned after seeing data. The set
is fixed:

| id | Column | Level statistic | Change statistic (matched sites) |
|---|---|---|---|
| `words` | `words` | median | median of site-by-site differences |
| `sentence_length` | `avg_sentence_length` | median | median of differences |
| `ai_era_vocab` | `ai_era_style_per1000` | mean | mean of differences |
| `dotcom_vocab` | `dotcom_vocab_per1000` | mean | mean of differences |
| `em_dash_share` | `em_only_per1000` (> 0) | share of measured homepages with at least one em dash (U+2014) | difference in the share, matched sites |
| `ai_tell` | `ai_tell_per1000` | mean | mean of differences |

**Dataset.** `public/research/scriptgrain-writing-index.csv`: one row per company per period, columns
`index_version, period, collected, domain, sector, source, status` followed by SGR-004's measure
columns (including `ai_era_style_per1000`). `period` is a calendar year (SGR-004 rows) or a quarter
(`2026-Q4`). Names are stable: a column is never renamed or repurposed within a major version; a new
column is added at the end and noted in the changelog. A changed measure, statistic or threshold is a
new major version. `scriptgrain-writing-index.json` holds the definition, column descriptions, the
series for every period, the latest comparison and the changelog. The two file names do not carry a
study number, so the URLs survive every refresh. The page slug is `scriptgrain-writing-index`; later
refreshes update that page (`updatedOn`) and append a changelog entry.

## 5. Fixed outputs and pass/fail rules

For each measure, over matched sites, with 95% percentile intervals from **2,000 bootstrap resamples of
sites, seed 20261103 (+ the measure's position, 0 to 5)**:

- Report the baseline level, the `2026-Q4` level (both on matched sites) and the change with its interval.
- Report the result as one of three, by rule:
  - **No detectable change**: the interval includes zero.
  - **Moved, below the threshold**: the interval excludes zero and |change| is below the threshold.
  - **Changed**: the interval excludes zero and |change| is at least the threshold.
- **Thresholds** are the largest absolute whole-year move of the same change statistic among matched
  sites in SGR-004's published data, 2022 to 2023, 2023 to 2024, 2024 to 2025 and 2025 to 2026
  (`thresholds.mjs`; no new data). A quarter-on-quarter move must be as large as the biggest recent
  whole-year move to count as a change. They are judgements, not statistical properties.

| Measure | 2022-23 | 2023-24 | 2024-25 | 2025-26 | Threshold |
|---|---|---|---|---|---|
| Median words | +33 | +18 | +24.5 | −11 | 33 |
| Median sentence length | 0 | +0.025 | +0.065 | +0.02 | 0.07 |
| AI-era vocabulary per 1,000 | +0.517 | +0.203 | +0.119 | +0.214 | 0.52 |
| Dotcom vocabulary per 1,000 | +0.192 | −0.009 | +0.012 | +0.590 | 0.59 |
| Share with an em dash | +0.061 | 0 | −0.019 | +0.055 | 0.06 |
| AI-tell density per 1,000 | −0.084 | +0.063 | +0.059 | −0.002 | 0.08 |

Also published, without tests: the Index series for every period (all measured homepages), `2026-Q4`
by sector, coverage by status, the repeat-fetch and instrument checks, and the credits used.

A "changed" result is reported at the same prominence as "no detectable change". The page says in plain
words that even a "changed" measure means "the two readings differ" (section 8), not that a company
rewrote its page.

## 6. Checks

- **Repeat fetch.** 16 sites fixed by hash (`sgr-025-repeat`) were fetched a second time shortly after
  the first (`collect.mjs --repeat`, 14 credits). The page reports, for sites measured both times, the
  median absolute difference per headline measure and how many changed between having and not having
  an em dash. It is the size of difference a live page shows against itself.
- **Instrument reproduction**: section 3.
- **Credits**: section 1. The entry builder refuses if the study spent over 500 credits or left the
  balance under 10,000.

## 7. Analysis plan

`run.mjs` makes no network request and no model call; the same files and seed give the same output
(except `generated` and `runtime_seconds`). It measures the 161 stored pages, joins them to SGR-004's
rows, builds the Index files and the summary, and draws two SVG figures. `write-entry.mjs` writes the
study entry from the summary only.

## 8. What the study cannot show

- Authorship. The Index measures vocabulary and punctuation; it does not show a page was written, edited
  or reformatted by AI, and the page says voice measurement cannot establish that.
- Real change in the writing. The baseline is a rendered Wayback Machine replay of a June or July 2026
  capture; the new point is a live fetch. A page can differ between an archive replay and the live site
  for reasons unrelated to its copy (consent banners, personalisation, scripts that no longer load,
  content that loads later, the service's location), so any "changed" result includes a method component
  that this design cannot separate. The repeat-fetch check measures only the live-against-live part.
- A trend. One quarterly reading shows none.
- Companies outside the panel, pages other than homepages, or the six sites the service refuses.

## 9. Pilot

`run.mjs --pilot` ran the whole script on 8 sites (5% of 161) chosen by SHA-256 of `sgr-025-pilot:<domain>`
among sites with a measured 2026 row (atlassian.com, apple.com, bestbuy.com, zappos.com, adobe.com,
dhl.com, mastercard.com, comcast.com), with 200 resamples, to `~/research/sgr-025/pilot-out`. The entry
builder was tested on a synthetic summary built from the pilot summary with made-up comparison values
(never committed). Pilot numbers are not reported anywhere. The pilot was used to fix the script. No
measure, statistic, threshold or rule was changed after seeing pilot numbers; the thresholds were set
from SGR-004's published rows before any new page was measured.

## 10. Reproduction

`scripts/experiments/sgr-025/README.md` has the exact commands and the run time.

## Deviations
(None yet. Anything changed after the freeze is listed here with the date and reason.)
