# SGR-020: Did government writing change after ChatGPT? Pre-registration

Frozen: 2026-10-11, committed before any page was measured in full. The git commit that adds
this file is the timestamp. The collection rules in section 1 were fixed in
`scripts/experiments/sgr-020/collect.mjs` before its first request and the collection began
the same evening; collecting text does not read any outcome. Changes after the freeze go under
"Deviations" at the bottom with the date and the reason.

Release: Thursday 16 October 2026. The full measurement and analysis run on Wednesday
15 October 2026 (the day before), and that is the study's "conducted" date. The corpus is
collected ahead of that; the run is not. See the README in `scripts/experiments/sgr-020/`.

This study copies the design of the brand series (`brand-series-preregistration.md`, SGR-011
"Did brand writing change after ChatGPT?") so the two can be compared: same eras, same
measures, same hypotheses, same word lists, same kind of interval. Where government data
forces a difference it is listed in section 8.

## 1. Data
**Source.** GOV.UK, through its public APIs: the Search API
(`https://www.gov.uk/api/search.json`) to list items and the Content API
(`https://www.gov.uk/api/content/<path>`) for each item's body. Open Government Licence v3.0:
we publish numbers only (plus page paths), credit the source and link the licence.

**Frame.** Every item of document type `press_release` or `news_story` on GOV.UK. Listing is
by `public_timestamp` (the date of the last public update), month by month from January 2015,
with the last window open-ended, so every item that has any public timestamp from 2015 on is
listed once. At the time of writing that is 62,399 items. Not included: `world_news_story`
(embassy and overseas-mission stories), `government_response`, speeches, statements, and
every other document type.

**Census, not a sample.** The full population is small enough to collect (62,399 requests at
four a second is a little over four hours), and department-by-year cells are small (a few
dozen to a few hundred items), so no sampling is used. Every listed item's body is fetched.

**Politeness.** One identified User-Agent (ScriptGrain research, contact support@scriptgrain.com), at
most four requests a second in total (GOV.UK asks for no more than ten), back-off on 429 and
5xx responses honouring Retry-After, resumable, every request error logged
(`~/research/sgr-020/collect.log`).

**Dates.** The publication date is the Content API's `first_published_at` (the date shown as
"Published"), as written in London local time. `public_timestamp` (last update) is not used
for the main analysis because updating an old release would move it; it is used in one
sensitivity check (section 6). Items first published before 1 January 2015 or after
30 September 2026 are left out (the collection ends mid-October and a complete month is
cleaner than a partial one).

**Exclusions** (counted and reported, by reason and by year): item not found; no body
(redirects, stubs); locale other than English (translations); withdrawn (by the Search API
flag or the Content API's withdrawn notice; the Search API lists withdrawn items only when
asked, so this is mostly a safety net); fewer than 150 words after cleaning; exact duplicate
text within the same unit (the later copy goes); and list-like pages: more than 40% of the
page's words sit in lines of six words or fewer (the series rule as amended by its Deviation 1).

**Text measured.** The body HTML turned into plain text: tables, scripts and comments
removed; tags removed; headings, paragraphs and list items kept as lines; entities decoded.
Everything from the first heading of a contact or boilerplate section to the end is dropped:
"Notes to editors" / "Notes for editors", "Media enquiries", "Press enquiries", "General
enquiries", "Further information", "More information", "Contact the press office", "Contact",
"Useful links", "Related links"; and everything from a paragraph that reads only "Ends". The
title and any summary line are not measured. Quotations from ministers and officials are part
of the body and are measured; the study cannot separate them from the press office's own prose.

## 2. Units: departments
A page's organisation is the **primary publishing organisation** in the Content API (the Search
API's value if absent). **Departments** (the confirmatory set) are twenty units, with
renamed, merged and split departments joined into the lineage they came from, because GOV.UK
changes the name of a department but a press office and its habits persist:

| Unit | GOV.UK organisations joined |
|---|---|
| Prime Minister's Office (10 Downing Street) | prime-ministers-office-10-downing-street |
| Ministry of Defence | ministry-of-defence |
| Foreign, Commonwealth and Development Office | FCDO, Foreign and Commonwealth Office, Department for International Development |
| Defra | department-for-environment-food-rural-affairs |
| Health and Social Care | department-of-health-and-social-care, department-of-health |
| Home Office | home-office |
| HM Treasury | hm-treasury |
| Transport | department-for-transport |
| Culture, Media and Sport | the DCMS slugs (digital-culture-media-sport, culture-media-and-sport, digital-culture-media-and-sport) |
| Education | department-for-education |
| Ministry of Justice | ministry-of-justice |
| Cabinet Office | cabinet-office |
| Business, energy, trade, science | BIS, DECC, BEIS, DIT, DBT, DESNZ, DSIT and department-for-business-innovation-science-and-trade |
| Housing, communities and local government | DCLG, MHCLG (both slugs), DLUHC |
| Work and Pensions | department-for-work-pensions |
| HM Revenue and Customs | hm-revenue-customs |
| Attorney General's Office | attorney-generals-office |
| Northern Ireland Office | northern-ireland-office |
| Wales Office | office-of-the-secretary-of-state-for-wales, wales-office |
| Scotland Office | office-of-the-secretary-of-state-for-scotland, scotland-office |

The exact slug lists are in `scripts/experiments/sgr-020/lib.mjs`. The joined units are
imperfect (DSIT took work from DCMS and BEIS; DfID's output joins FCDO from 2020 on) and the
limits section says so. **Other bodies** (agencies, regulators, non-ministerial departments:
Environment Agency, Competition and Markets Authority, MHRA and the other 300 or so) are
analysed separately as an exploratory set, one unit per organisation. Departments that ended
before 2022 (Exiting the EU) fall in "other bodies" and drop out of every change test by
having no pages in the later era.

## 3. Measures (product code, no language model)
Per page, the brand series' measures with `scripts/experiments/sgr-007/instruments.mjs`
(unchanged) and the same code as `brand-series/measure.mjs`:
- **AI-ism rate (primary):** uses per 1,000 words of SGR-007's frozen lists OLD + CALLED_OUT +
  MARKETING, each occurrence counted once (`ai_ism_per1000`). Each list separately, and QUIET.
- **AI sentence shapes:** `scanCliches(text).per1000`.
- **Em dashes per 1,000 words** (U+2014 and spaced en dashes; both are counted because the
  GOV.UK content style may favour the spaced en dash, and the series counted both).
- Average sentence length; sentence-length variation (SD / mean); share of sentences under
  8 words; contractions per 1,000 words; commas per sentence; exclamation marks and questions
  per 1,000 words; the share of I, we and you among those three; long-word share (7+ letters).

No language model reads, scores or generates anything. No API key is used.

## 4. Eras and cells
**Eras** (by publication date). EARLY = 1 January 2015 to 31 December 2018. LATE = 1 January
2019 to 30 November 2022. TRANSITION = 1 December 2022 to 31 December 2023. AFTER = 1 January
2024 to 30 September 2026. Sub-period of AFTER, used by H6 only: AFTER-C = 1 January to
4 July 2024 (the last day of the Sunak government; the general election was 4 July).

**Cells.** A cell is a department and a document type (press release or news story). A cell
is eligible for a comparison if it has at least 10 pages in each era compared. Cell change =
mean(later era) minus mean(earlier era). A department's change is the mean over its eligible
cells. The headline is the mean over departments, each department weighted equally. Intervals
are 95% cluster bootstraps over departments (2,000 resamples, fixed seed per statistic).

## 5. Hypotheses (confirmatory, departments only)
H1, H3, H4 and H6 are supported if the 95% interval excludes zero in the predicted direction.
A failed hypothesis is reported in the same place and with the same prominence as a passed one.
- **H1 (AI-isms rose).** The mean within-department change in the AI-ism rate, LATE to AFTER,
  is above zero.
- **H2 (not a continuing trend).** For cells with at least 10 pages in EARLY, LATE and AFTER,
  the LATE-to-AFTER change in the AI-ism rate per year is larger than the EARLY-to-LATE
  change per year (each scaled by the gap between the cells' median dates). Supported if the
  95% interval of the mean difference excludes zero above.
- **H3 (em dashes rose).** Mean within-department change in em dashes per 1,000 words,
  LATE to AFTER, is above zero.
- **H4 (AI sentence shapes rose).** Same for the sentence-shape rate.
- **H5 (rhythm stayed put).** The mean within-department change in average sentence length is
  within 1.5 words of zero: the 90% interval lies inside [-1.5, +1.5].
- **H6 (not only a change of government).** The AI-ism rate was already above its LATE level
  in the Conservative months of AFTER, 1 January to 4 July 2024: LATE-to-AFTER-C change above
  zero, 95% interval excluding zero. A failed H6 does not mean the rise came with the new
  government, only that this study cannot separate the two (AFTER-C is six months and an
  election campaign).

Pre-set expectations, written before any full measurement: no outcome is guessed here. The
brand series found H1 supported, H3 and H4 not supported, H5 supported, and this study
repeats those tests without a forecast so that a failure counts.

**Comparison (descriptive, not a test).** The headline changes are shown beside the brand
series' published within-brand changes (SGR-011, read from `brand-series/summary-011.json`),
as a percentage of each study's own LATE level. No hypothesis is attached to the difference.

## 6. Robustness and exploratory (labelled as such)
(a) Press releases and news stories separately. (b) Pages of 300 or more words only.
(c) TRANSITION counted as AFTER. (d) Era from the last-update date instead of the first
publication date. (e) AFTER split into Conservative months and Labour months (5 July 2024
onwards), each against LATE. (f) Every measure in the list in section 3 for the main
comparison. (g) Leave-one-department-out range for H1. (h) The same four headline measures
for other bodies (one unit per organisation, same cell rule). (i) A year-by-year series
(department-weighted, a department-year needing 5 pages) and a table for each department.

## 7. Fixed outputs
`public/research/sgr-020-summary.json` (corpus counts, exclusions, every test above, year
series, department table), `sgr-020-pages.csv` (one row per page: path, department, organisation,
type, date, era, words and every measure; no text), `sgr-020-departments.csv` (department by era
means), `sgr-020-by-year.csv`, three SVG charts, and the study entry in
`src/data/research-pages.json` built from the summary with no number typed by hand.
Licence CC BY 4.0 on our data; the source is credited under the Open Government Licence v3.0.

## 8. What the study cannot show
- That any press office used AI. Government communications has always had templates, shared
  boilerplate, ministerial quotes written by staff, and agencies' house style; and the words
  counted rose in human writing for decades before ChatGPT (SGR-007). A rise shows style,
  not authorship. Nothing here establishes that voice measurement can tell whether a text was
  written by AI.
- Why the writing changed. Candidates this study cannot separate: AI tools, new staff and
  agencies, a change of government and of ministers (July 2024) and of prime minister, a change
  of subject (more about AI itself), the end of pandemic communications, updated GOV.UK
  guidance, and the fact that the release volume and mix changed.
- Anything about speeches, written answers (SGR-021), local government or non-English text.
- Differences from SGR-011 are not like-for-like: SGR-011's before-text was archived and its
  after-text live (a source gap); here every page comes from the same live source. Departments
  here are fewer (20) than brands there (37), so intervals are wider.

## 9. Limits we already know
- The Content API serves the page as it is now. Corrected or edited old releases are measured
  as edited, and edits to releases are not tracked beyond the date check in (d).
- Ministerial quotes, boilerplate and lists of facts sit inside many releases.
- Joined departments (section 2) are a judgement; the joined business unit mixes six
  departments that did different work.
- The COVID-19 years (2020 to 2021) are inside LATE and changed the mix of what departments
  wrote; cells are weighted by department, not by page, so the high volume does not dominate.
- Some departments wrote no releases in some eras and so do not enter the tests.
- A department-year is a small sample; a single press officer or minister can move it.

## 10. Pilot
The run script is tested on a pilot of at most 5% of the collected corpus (a fixed hash of the
page path selects 4%), end to end, including the entry builder and the entry's checks in
`src/test/research.test.ts`. The pilot relaxes only the minimum cell size (to 2 pages) so
that the code path is exercised on so small a sample. Pilot numbers are not reported anywhere,
not in the entry, the README or the pull request; pilot output is never committed. The full
analysis is run once, on the day before release.

## Deviations and clarifications
(none yet)
