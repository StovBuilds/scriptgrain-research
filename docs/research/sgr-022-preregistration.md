# SGR-022: Do ministers' written answers sound different since ChatGPT? Pre-registration

Frozen: 2026-10-11, committed before any text was measured in full. The git commit that adds
this file is the timestamp. The collection rules in section 1 and the sampling rule in section 2
were fixed in `scripts/experiments/sgr-022/collect.mjs` before its first request; the collection
started the same evening. Collecting text reads no outcome. Changes after the freeze go under
"Deviations" at the bottom with the date and the reason.

Release: Thursday 23 October 2026. The full measurement and analysis run on Wednesday
22 October 2026 (the day before), and that is the study's "conducted" date. The corpus is
collected ahead of that; the run is not. See the README in `scripts/experiments/sgr-022/`.

This study copies the design of the brand series (`brand-series-preregistration.md`, SGR-011
"Did brand writing change after ChatGPT?") and of SGR-020 (GOV.UK press releases), so the three
can be compared: same eras, same measures, same hypotheses, same word lists, same kind of
interval, same unit (a department compared only with itself). Where parliamentary data forces
a difference it is listed in section 9.

## 1. Data
**Source.** UK Parliament Written Questions and Statements API
(`https://questions-statements-api.parliament.uk/api`): `writtenquestions/questions` to list
questions, `writtenquestions/questions/{id}` for an answer's full text, `writtenstatements/statements`
and `.../{id}` for written ministerial statements. Open Parliament Licence v3.0: we publish
numbers only (plus question and statement IDs), credit the source and link the licence. The
API's list endpoints return an answer cut to 250 characters; the full text needs the per-item
call.

**Series.**
- **A, written answers (primary).** Answers to written questions (both Houses) given from
  1 January 2015 to 30 September 2026. Answers are drafted by civil servants and given in a
  minister's name.
- **S, written ministerial statements (secondary).** Every statement made in the same window.
  Pre-registered with the same six tests, as a secondary series.
- **Q, the questions themselves (comparison).** The text of the question for each sampled
  answer. Questions are written by MPs, peers and their staff, not by civil servants, so they
  show what a change in the language of Parliament in general would look like. Estimates only,
  no hypothesis and no verdict.

**Frame (answers).** Every question that is answered, listed by the week it was tabled from
1 October 2014 (a quarter early, so a question tabled in late 2014 and answered in January 2015
is caught) to 10 October 2026, with the API's own `answered=Answered` filter. Listing by
tabled date and not answered date is deliberate: the API's answered-date filter times out on
large windows. From the list, an item is in the frame if its answer date falls in the window,
it is not withdrawn and it is not flagged as a holding answer. The API holds about 696,000 written questions in all; the frame size and every dropped row are
reported.

**Census of statements.** Written statements are a few hundred a year (about 18,000 in all), so
every statement made in the window is fetched, listed by month.

**Politeness.** One identified User-Agent (`ScriptGrain research (support@scriptgrain.com)`), at most
three requests a second in total (one global pacer; list calls run three at a time but the
API answers them in 5 to 30 seconds), back-off on 429 and 5xx responses honouring Retry-After,
resumable, every warning and error logged (`~/research/sgr-022-hansard/collect.log`).

**Dates.** An answer's date is the API's `dateAnswered` (the day the answer was given).
Statements use `dateMade`. A question's own date is its answer's. Corrected answers keep the
original answer date and are flagged (`answerIsCorrection`); the main analysis keeps them
(the text is what Parliament now holds), and a robustness check drops them.

**Exclusions** (counted and reported, by reason and by year, per series): item not found; no
text; date outside the window; fewer than 50 words after cleaning (questions: fewer than 20);
a holding answer, by the API's flag or by its text (an answer under 100 words that promises a
reply "as soon as possible" or says it is a holding answer); an answer that was only a table
(under 50 words once tables are removed, reported separately as `table_only`); list-like
text (more than 40% of the words sit in lines of six words or fewer, the brand series' rule as
amended by its Deviation 1); figure lists (more than half the words are numerals or amounts);
and exact duplicate text within the same series and department (the later copy goes: grouped
questions share one answer).

**Text measured.** The answer HTML turned into plain text: tables, scripts and comments removed;
tags removed; paragraphs and list items kept as lines; entities decoded. The question text is
not part of the answer. Quotations and statistics inside an answer are measured with it.

## 2. Sampling design (answers; fixed before any text was read)
A fixed-seed stratified draw. The strata are the answer **year** (2015 to 2026) and the
**unit** (section 3). Each year has a quota of 5,000 answers.
1. Every unit in the year first gets `min(frame size, 200)`.
2. The remainder of the quota is shared among units with answers left, in proportion to
   their frame size (repeated until the quota is used or the units are exhausted).
3. Within a year and unit, answers are ranked by `sha256("sgr022-v1|" + question id)` and the
   first k are taken. The seed string, the quota and the floor are in `lib.mjs`. The draw is a
   pure function of the index, so it is reproducible by anyone with the same index; the drawn
   IDs are published in the dataset.

The sampling is non-proportional on purpose (every department has at least 200 answers a year
where it has that many), so **every mean in the analysis is weighted by the inverse of the
answer's chance of selection** (frame size of its year and unit divided by the number sampled).
Weighted and unweighted results are both reported. About 60,000 answers are drawn in all, and
roughly 40 to 60% of them survive the exclusions (many answers are one or two lines).

## 3. Units: departments
A text's unit is its **answering body** as Parliament names it, with renamed, merged and split
departments joined into the same lineages as SGR-020 where Parliament uses the same body:

| Unit | Parliament answering bodies joined |
|---|---|
| Prime Minister's Office | Prime Minister |
| Ministry of Defence | Ministry of Defence |
| Foreign, Commonwealth and Development Office | FCO, DfID, FCDO |
| Defra | Department for Environment, Food and Rural Affairs |
| Health and Social Care | Department of Health, Department of Health and Social Care |
| Home Office | Home Office |
| HM Treasury | HM Treasury (HMRC questions are answered through the Treasury, so HMRC is counted here, not as its own unit as in SGR-020) |
| Transport | Department for Transport |
| Culture, Media and Sport | the DCMS names (with and without commas, "Digital") |
| Education | Department for Education |
| Ministry of Justice | Ministry of Justice |
| Cabinet Office | Cabinet Office, Deputy Prime Minister |
| Business, energy, trade, science | BIS, DECC, BEIS, DIT, DBT, DESNZ, DSIT |
| Housing, communities and local government | DCLG, MHCLG, DLUHC |
| Work and Pensions | Department for Work and Pensions |
| Attorney General's Office | Attorney General |
| Northern Ireland Office | Northern Ireland Office |
| Wales Office | Wales Office |
| Scotland Office | Scotland Office |

That is 19 **departments**, the confirmatory set. The exact rules are `RULES` in
`scripts/experiments/sgr-022/lib.mjs`; the answering-body names are listed in the summary. All
other answering bodies (the House of Commons Commission, Leader of the House, the Church
Commissioners, the Electoral and Parliamentary standards committees, Women and Equalities, the
Department for Exiting the EU and the rest) are **other bodies**: analysed separately and
exploratorily, one unit per body. Departments that ended before 2022 fall into other bodies and
drop out of every change test by having no answers in the later era.

## 4. Measures (product code, no language model)
Per text, the brand series' measures with `scripts/experiments/sgr-007/instruments.mjs`
(unchanged) and the same code as `brand-series/measure.mjs` and SGR-020:
- **AI-ism rate (primary):** uses per 1,000 words of SGR-007's frozen lists OLD + CALLED_OUT +
  MARKETING, each occurrence counted once (`ai_ism_per1000`). Each list separately, and QUIET.
- **AI sentence shapes:** `scanCliches(text).per1000`.
- **Em dashes per 1,000 words** (U+2014 and spaced en dashes).
- Average sentence length; sentence-length variation (SD / mean); share of sentences under
  8 words; contractions per 1,000 words; commas per sentence; exclamation marks and questions
  per 1,000 words; the share of I, we and you among those three; long-word share (7+ letters).

No language model reads, scores or generates anything. No API key is used.

## 5. Eras and cells
**Eras** (by answer date), identical to SGR-011 and SGR-020. EARLY = 1 January 2015 to
31 December 2018. LATE = 1 January 2019 to 30 November 2022. TRANSITION = 1 December 2022 to
31 December 2023. AFTER = 1 January 2024 to 30 September 2026. H6 uses AFTER-C = 1 January to
4 July 2024 (the last day of the Sunak government). Parliament was dissolved on 30 May 2024,
and written answers stop during a dissolution, so AFTER-C holds about five months of answers.

**Cells.** A cell is a department and a house (Commons or Lords; the two Houses answer in different
registers). A cell is eligible for a comparison if it has at least 10 texts in each era compared.
Cell change = mean(later era) minus mean(earlier era), design-weighted (section 2). A department's
change is the mean over its eligible cells. The headline is the mean over departments, each
department weighted equally. Intervals are 95% cluster bootstraps over departments (2,000
resamples, fixed seed per statistic).

## 6. Hypotheses (confirmatory, answers, departments only)
H1, H3, H4 and H6 are supported if the 95% interval excludes zero in the predicted direction.
A failed hypothesis is reported in the same place and with the same prominence as a passed one.
- **H1 (AI-isms rose).** The mean within-department change in the AI-ism rate, LATE to AFTER, is
  above zero.
- **H2 (not a continuing trend).** For cells with at least 10 answers in EARLY, LATE and AFTER, the
  LATE-to-AFTER change in the AI-ism rate per year is larger than the EARLY-to-LATE change (each
  scaled by the gap between the cells' median dates). Supported if the 95% interval of the mean
  difference excludes zero above.
- **H3 (em dashes rose).** Mean within-department change in em dashes per 1,000 words, LATE to
  AFTER, is above zero.
- **H4 (AI sentence shapes rose).** Same for the sentence-shape rate.
- **H5 (rhythm stayed put).** The mean within-department change in average sentence length is
  within 1.5 words of zero: the 90% interval lies inside [-1.5, +1.5].
- **H6 (not only a change of government).** The AI-ism rate was already above its LATE level in the
  Conservative months of AFTER, 1 January to 4 July 2024: LATE-to-AFTER-C change above zero, 95%
  interval excluding zero. A failed H6 does not mean the rise came with the new government, only
  that this study cannot separate the two.

**Secondary series S (statements):** the same six tests on written ministerial statements, with
the same rules and a census in place of weights. They are pre-registered and reported at the
same prominence, but described as secondary because statements are fewer (intervals are wider).

**Comparison series Q (questions):** the LATE-to-AFTER change in AI-ism rate, em dashes, sentence
shapes and sentence length in the question text, same cells, no verdict. Exploratory D1: answers'
change minus questions' change, per department (departments with both), with a 95% interval.
Reported as estimates; nothing is claimed if it includes zero.

No outcome is forecast here. The brand series found H1 supported, H3 and H4 not supported and H5
supported; SGR-020 repeats the tests on GOV.UK press releases. This study repeats them on
parliamentary answers so that a failure counts.

**Comparison (descriptive, not a test).** The headline changes are shown beside SGR-011's and
SGR-020's published within-organisation changes, as a percentage of each study's own LATE level. No
hypothesis is attached to the difference.

## 7. Robustness and exploratory (labelled as such)
All on series A unless stated. (a) Unweighted means. (b) Pooled counts over words (sum of counts
divided by sum of words) instead of the mean of text rates, because short texts make a text's
rate noisy. (c) Answers of 150 words or more only (the SGR-011 and SGR-020 threshold). (d) Without
corrected answers. (e) Without answers that contained a table. (f) Commons and Lords separately.
(g) TRANSITION counted as AFTER. (h) AFTER split into Conservative months and Labour months (5 July 2024
onwards), each against LATE. (i) Every measure in section 4 for the main comparison. (j) Leave-one-
department-out range for H1. (k) Other bodies, one unit per body. (l) A year-by-year series
(department-weighted, a department-year needing 5 texts) for A, S and Q, and a table per
department.

## 8. Fixed outputs
`public/research/sgr-022-summary.json` (sampling design and frame counts, corpus counts,
exclusions, every test above, year series, department table), `sgr-022-texts.csv` (one row per
text: series, ID, house, department, answering body, date, era, words, sampling weight, flags and
every measure; no text), `sgr-022-departments.csv` (department by era means, answers and
statements), `sgr-022-by-year.csv`, three SVG charts, and the study entry in
`src/data/research-pages.json` built from the summary with no number typed by hand. Licence CC BY
4.0 on our data; the source is credited under the Open Parliament Licence v3.0.

## 9. What the study cannot show, and differences from SGR-011 and SGR-020
- That any department, minister or civil servant used AI. Written answers are drafted from
  templates, earlier answers and shared lines, and the words counted rose in human writing for
  decades before ChatGPT (SGR-007). A rise shows style, not authorship. Nothing here establishes that
  voice measurement can tell whether a text was written by AI.
- Why the writing changed. Candidates this study cannot separate: AI tools, new staff, a change of
  government and ministers (July 2024) and of prime minister, a change of subject (more questions
  about AI itself), updated drafting guidance, different question types after the pandemic, and
  templates reused across answers.
- Who wrote a word. An answer is drafted by an official and given in a minister's name; the data do
  not separate the two.
- Anything about oral questions, debates or committee evidence.
- Differences from SGR-011 and SGR-020 are not like-for-like: answers are a weighted sample and not
  a census, answers are short (the minimum is 50 words, not 150, because the median answer is under
  100), the unit cell is department and house, and HMRC sits in the Treasury. Departments here
  are 19, so intervals are wide.

## 10. Limits we already know
- Sampling of answers: up to 5,000 a year of roughly 55,000 a year. Weighting corrects the design, not the
  exclusions that follow it.
- The list API can return a question's answer cut at 250 characters, and the per-item call returns
  the answer as it stands now; a corrected answer replaces the original (the original text is
  not used).
- Many answers are one-liners, pointers to an earlier reply, or lists of figures. The study measures
  prose answers of 50 words or more.
- Parliament was prorogued or dissolved in 2017, 2019 (twice), 2022 and 2024, so months are not
  equally represented; cells are weighted by department, not by month.
- The COVID-19 years (2020 to 2021) sit inside LATE and changed what was asked and answered.
- A department-year is a small sample; a single minister or a policy surge (energy bills, Brexit,
  Ukraine) can move it.
- A few answers come from bodies whose names changed within a year; the lineage rules are a judgement.

## 11. Pilot
The run script is tested on a pilot of at most 5% of the collected corpus: a fixed hash of the item
ID selects 4%, end to end, including the entry builder and the entry's checks in
`src/test/research.test.ts`. Earlier code tests used a throwaway extract of under 2% of the texts
collected separately for development (one day per half-year, discarded). The pilot relaxes only the
minimum cell size (to 2 texts) and the department-year minimum (to 1) so that the code path is
exercised on so small a sample; pilot runs print counts but no result. Pilot numbers are not
reported anywhere: not in the entry, the README or the pull request. Pilot output is never
committed. The full analysis is run once, on the day before release.

## Deviations and clarifications
None in the analysis. The full run on 2026-10-22 (296 seconds, once) used the corpus collected from 11 to 12 October 2026 unchanged (60,000 sampled answers fetched, 17,730 statements fetched) and applied every rule, list, threshold, era and hypothesis above as frozen. Presentation only, 2026-10-22: the entry builder now shows each hypothesis measure with its confirmatory interval wherever it appears, gives readable exclusion labels, lists the statements' six tests in their own table, and keeps product mentions out of the method; no number was re-measured.
