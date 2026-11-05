# SGR-026: Are new Wikipedia articles written differently since ChatGPT? Pre-registration

Frozen: 2026-10-11, committed before any article was measured in full. The git commit that adds
this file is the timestamp. The sampling rules in section 1 were fixed in
`scripts/experiments/sgr-026/collect.mjs` before its first request and the collection began
the same evening; collecting text does not read any outcome. The cleaner (section 3) was fixed in
`scripts/experiments/sgr-026/lib.mjs` and validated on a separate check (section 3) before the pilot.
Changes after the freeze go under "Deviations" at the bottom with the date and the reason.

Release: Thursday 6 November 2026. The full measurement and analysis run on Wednesday
5 November 2026 (the day before), and that is the study's "conducted" date. The articles are
collected ahead of that; the run is not. See the README in `scripts/experiments/sgr-026/`.

This study copies the design of the brand series (`brand-series-preregistration.md`, SGR-011
"Did brand writing change after ChatGPT?") and of SGR-020 (government press writing) so the three can
be compared: same eras, same measures, same word lists, same hypotheses, same kind of interval. Where
Wikipedia forces a difference it is listed in section 8.

## 1. Data
**Source.** The English Wikipedia, through the MediaWiki Action API (`https://en.wikipedia.org/w/api.php`).
Article text is licensed CC BY-SA 4.0. We store the text on our own disk for the day-before run and
publish **numbers only** (plus page IDs, which let anyone look an article up), crediting Wikipedia and its
editors. No article text, title or author name is published or committed.

**What a "new article" is here.** A page that is an article today (namespace 0, not a redirect, not a
disambiguation page) whose **first revision** was saved between 1 January 2015 and 30 September 2026
(UTC). The text measured is that first revision, not the page as it reads now. The study is about how
a new article begins, which is the closest thing the edit history gives to "what was written when it
was created".

**Frame and sampling.** Wikipedia gives every page an ID when it is created, in order, so the pages
created in a month are an interval of IDs (shared with every other namespace: talk pages, user pages,
drafts, categories and the pages later deleted). For each of the 141 months from January 2015 to
September 2026:
1. The interval is found by binary search on the creation time of the first revision of the page
   at a given ID (`collect.mjs bounds`; the boundary is the lowest ID whose first revision is at or
   after the first of the month, 00:00 UTC).
2. IDs are drawn uniformly at random from the interval, without replacement, with a fixed seed
   (a hash of `sgr-026|YYYY-MM`), 50 at a time. Each batch is looked up with `prop=info|pageprops`.
   An ID is kept only if the page exists, is in namespace 0, is not a redirect and does not carry the
   `disambiguation` page property. Drawing stops when **120 pages have been kept** (the first 120 in
   draw order) or at a ceiling of 40,000 draws. Everything drawn is counted by outcome (`collect.mjs index`),
   which gives the sampling frame's composition and an estimate of how many surviving articles each
   month produced (IDs in the interval times the share of draws that were articles).
3. The first revision of each kept page (`prop=revisions&rvdir=newer&rvlimit=1&rvslots=main`,
   with the revision's user, whether it was anonymous, its tags and edit summary) and the
   page's first 50 revisions without text (edit summaries and tags) are fetched (`collect.mjs fetch`).
4. Every first-revision author's current group membership is looked up (`list=users&usprop=groups`),
   to identify bot accounts (`collect.mjs users`).

120 a month is 16,920 articles at most. The ceiling is the same for every month so each month has
equal weight; months where fewer than 15 articles survive the text rules are dropped from the tests
(section 4). In the first 36 months collected (the collection order spreads the months across
the eras), between one in five and one in two of the sampled first revisions reached 150 words
(roughly 20 to 60 articles a month, rising over time as stubs became rarer); that is how the minimum
of 15 was chosen, from counts and before any measurement.

**Boundary check.** A single imported page (an old timestamp) can send the binary search for a month's
first ID the wrong way. After the fetch, any month in which more than 6% of the sampled first revisions
fall in another month is re-bounded with a more robust probe (the median first-revision time of five pages instead
of one) and its neighbour is re-sampled (`collect.mjs repair`, then `index` and `fetch` again). The check
looks only at timestamps, never at text or measures. Month boundaries found this way are the ones used;
the first 36 months fetched showed one such month (January 2015: 20% of its draws were from February).

**Politeness.** One identified User-Agent (ScriptGrain research, contact support@scriptgrain.com), strictly
serial requests (one in flight at a time, at least 250 ms between starts, widening automatically after
any HTTP 429), `maxlag=5` on every request (the servers say when to wait and we wait as long as
`Retry-After` says), back-off on 429 and 5xx, resumable, every retry logged
(`~/research/sgr-026/collect.log`). IDs are batched 50 to a request wherever the API allows it; first
revisions can only be fetched one page at a time.

**Dates.** The month is the UTC month of the first revision's timestamp. An article whose first
revision falls in a different month from the ID interval it was drawn from (imported pages and rare
oddities) is dropped and counted.

**Exclusions** (each counted and reported by reason and by year):
- the page was deleted between sampling and the fetch;
- the first revision is not wikitext;
- the first revision is a redirect (the page was created as a redirect and expanded later);
- the first revision's month is outside January 2015 to September 2026, or differs from the month of the ID
  interval;
- fewer than 150 words of plain prose after cleaning;
- list-like: more than 40% of the words sit in lines of six words or fewer (the series rule);
- exact duplicate text within the same month (the later page ID goes);
- **bot-created pages**: the first-revision author is in the `bot` group today. These are counted and
  set aside; they are put back for one robustness check (section 6). Automated stubs are not the
  writing the question is about.

Nothing is excluded for being about a particular topic, being promotional, or having been tagged.

## 2. Units: months
The unit of analysis is the **month** (141 of them). A month's value for a measure is the mean over
its measured articles, and every month with at least 15 measured articles (8 in a sub-group, 5 for the
moved-in group in section 6) counts equally in its period, whatever the month's article count. A
period's value is the mean of its months' values. The change between two periods is the later period's
value minus the earlier one's. This is the same equal-weight idea as the department-weighted means
of SGR-020 and the brand-weighted means of SGR-011, with months in place of departments, and it
removes any dependence of a period on a few very large or very small months.

## 3. Text and measures (product code, no language model)
**Plain prose from wikitext** (`wikitextToPlain` in `lib.mjs`, documented here and exercised by
`selftest.mjs`). In order: a first revision starting `#REDIRECT` yields nothing; HTML comments are
removed; `<ref>` elements (both forms) are removed with their contents; `<math>`, `<chem>`,
`<gallery>`, `<imagemap>`, `<timeline>`, `<score>`, `<syntaxhighlight>`, `<source>`, `<pre>`, `<poem>`, `<mapframe>`,
`<maplink>`, `<graph>`, `<noinclude>` and `<references>` blocks are removed with their contents; every
`{{template}}` is removed, innermost first (this removes infoboxes, citation templates, hatnotes, stub
and maintenance banners, short descriptions, `{{sfn}}` footnotes and also the text inside quotation,
language and convert templates); tables `{| ... |}` are removed; remaining HTML tags are removed and
their contents kept; links keep their visible label (`[[a|b]]` becomes `b`), while files, images,
categories, project-namespace links and interlanguage links (`[[fr:...]]`) are removed whole;
external links keep their label, bare URLs are removed; bold and italic quote marks are removed;
HTML entities are decoded. Lines are then processed: headings are dropped as lines, and the
non-prose sections (see also, references, external links, further reading, notes, footnotes, sources,
bibliography, citations, works cited, publications, selected works, discography, filmography,
awards, honours, gallery, links, related articles, sister projects) are dropped up to the next heading of the same
or a higher level; leading list and indent markers are removed; lines starting with a table
remnant are dropped; empty brackets left by removed templates (for example "( )" where a date
template stood) are removed. Other sections' lists are kept as lines of prose, and the list-like rule
catches pages made mostly of them. The title is not measured.

**Cleaner validation** (`validate-cleaner.mjs`, run before the pilot, on the **current** revision of
100 articles drawn from our own sample by a hash of the page ID, never on the corpus): our plain
prose is compared with Wikipedia's own plain-text rendering of the same revision (the
TextExtracts extension, `prop=extracts&explaintext`) after the rendering's headings and non-prose
sections are removed the same way. The cleaner counts as valid if the **median ratio** of our word
count to the rendering's is between 0.90 and 1.10 **and** at least 80% of the articles have a ratio
between 0.75 and 1.25. If it fails, the cleaner is revised and re-validated before the freeze commit, and the revision is
recorded below. **Result (run 2026-10-11, before the pilot and the freeze commit):** of the 100 articles drawn, 71 had at least 100 words in Wikipedia's rendering and were compared. Median ratio 1.000 (10th to 90th percentile 0.943 to 1.000); 95.8% of articles were within 0.75 to 1.25; the criteria were met without revising the cleaner. The articles were current revisions of newly sampled pages, so they are mostly short, plain pages; on two long articles spot-checked by hand (Albert Einstein, Mount Everest) our word count was about 8% below the rendering's, because the cleaner drops template text such as unit conversions and formulas. The same direction of error applies in every period.

**Measures.** Per article, the brand series' measures with `scripts/experiments/sgr-007/instruments.mjs`
(unchanged) and the same code as `brand-series/measure.mjs` and SGR-020:
- **AI-ism rate (primary):** uses per 1,000 words of SGR-007's frozen lists OLD + CALLED_OUT +
  MARKETING, each occurrence counted once (`ai_ism_per1000`). Each list separately, and QUIET.
- **AI sentence shapes:** `scanCliches(text).per1000`.
- **Em dashes per 1,000 words** (U+2014 and spaced en dashes).
- Average sentence length; sentence-length variation (SD / mean); share of sentences under
  8 words; contractions per 1,000 words; commas per sentence; exclamation marks and questions
  per 1,000 words; the share of I, we and you among those three; long-word share (7+ letters).

No language model reads, scores or generates anything. No API key is used.

## 4. Eras and tests
**Eras** (by the month of the first revision). EARLY = January 2015 to December 2018. LATE = January
2019 to November 2022. TRANSITION = December 2022 to December 2023. AFTER = January 2024 to September 2026.
A month enters a test only with at least 15 measured articles (pilot: 1). The change for a measure is
mean(AFTER months) minus mean(LATE months) as in section 2. The interval is a 95% bootstrap over months:
the months of each period are resampled with replacement within the period (2,000 resamples, a fixed
seed per statistic) and the difference of the resampled means is recorded. A hypothesis that predicts a
rise is supported if the 95% interval's lower end is above zero.

## 5. Hypotheses (confirmatory)
H1, H3, H4 and H6 are supported if the 95% interval excludes zero in the predicted direction.
A failed hypothesis is reported in the same place and with the same prominence as a passed one.
- **H1 (AI-isms rose).** The change in the AI-ism rate, LATE to AFTER, is above zero.
- **H2 (not a continuing trend).** The LATE-to-AFTER change per year is larger than the
  EARLY-to-LATE change per year (each is the difference of two period means, divided by the
  gap in years between the periods' mean dates; the months of all three periods are resampled).
  Supported if the 95% interval of the difference excludes zero above.
- **H3 (em dashes rose).** Change in em dashes per 1,000 words, LATE to AFTER, is above zero.
- **H4 (AI sentence shapes rose).** Same for the sentence-shape rate.
- **H5 (rhythm stayed put).** The change in average sentence length is within 1.5 words of zero:
  the 90% interval lies inside [-1.5, +1.5].
- **H6 (not only drafts moved in).** H1 holds among articles with no sign of having been moved
  into the article namespace from a draft or user page (a month needs 8 such articles to enter).
  A page is "moved in" if, in its first 50 revisions, an edit summary reads `moved page [[Draft:...`,
  `[[User:...`, `[[Wikipedia:...`, `[[Talk:...` or `[[Draft talk:...` (MediaWiki writes
  that summary automatically when a page is moved; `lib.mjs` has the exact expression).
  Pages moved into the article namespace after their 50th revision are classed as direct, a known
  misclassification. A failed H6 does not mean the rise is due to moved-in drafts, only that this
  study cannot show it among direct creations.

Pre-set expectations, written before any full measurement: no outcome is guessed here. The brand and
government series found and will find what they find, and this study repeats the same tests
without a forecast so that a failure counts.

**Comparison (descriptive, not a test).** The headline changes are shown beside SGR-011's published
within-brand changes (`brand-series/summary-011.json`) and SGR-020's within-department changes
(`public/research/sgr-020-summary.json`, once published), as a percentage of each study's own LATE level. No
hypothesis is attached to the difference.

## 6. Robustness and exploratory (labelled as such)
(a) Moved-in pages only (a month needs 5). (b) Articles of 300 or more words only; articles of
150 to 600 words only. (c) TRANSITION counted as AFTER. (d) Content-translation pages (tagged
`contenttranslation`) left out. (e) Bot-created pages put back. (f) Registered accounts only
(anonymous creators left out). (g) Every measure in section 3 for the main comparison. (h)
Leave-one-month-out range for H1. (i) EARLY to LATE change for the four headline measures (the trend
control). (j) Quarter, year and month tables with the median length and the share created
directly. (k) The sampling frame by year: IDs drawn, share that were articles, redirects, not found, and
the estimated number of surviving new articles.
**Deletions (exploratory).** The page-creation log (`list=logevents&letype=create&lenamespace=0`) starts in
mid-2018. For each month from July 2018 to September 2026, eight random start times are drawn with a fixed
seed and up to 250 consecutive entries are read from each (`collect.mjs deletions`). An entry whose
`pageid` is 0 is a page that has since been deleted. The share of entries with `pageid` 0, by
year and quarter, is reported next to the main result so the reader can see how much of what was
created is no longer visible. The denominator is every page created in the article namespace
(including redirects and pages later moved elsewhere), so the share is not the deletion rate of
articles.

## 7. Fixed outputs
`public/research/sgr-026-summary.json` (corpus counts, exclusions, every test above, year and quarter
series, sampling frame, deletions), `sgr-026-articles.csv` (one row per article: page ID, month, era, words,
direct, anonymous, bot, translation, and every measure; no text, title or author),
`sgr-026-by-month.csv`, `sgr-026-by-year.csv`, `sgr-026-frame.csv`, three SVG charts, and the study entry in
`src/data/research-pages.json` built from the summary with no number typed by hand.
Licence CC BY 4.0 on our data; Wikipedia and its editors are credited and the article text, which is
CC BY-SA 4.0, is not redistributed.

## 8. What the study cannot show
- That any article was written with AI. Wikipedia's own list of signs of AI writing says that
  "not all text featuring these indicators is AI-generated", and that the list is "descriptive, not
  prescriptive"; the words counted here rose in human writing for decades before ChatGPT (SGR-007).
  A rise shows style, not authorship. Nothing here establishes that voice measurement can tell whether a
  text was written by AI.
- What Wikipedia's editors removed. Deleted pages are not visible through the API, so the sample is
  articles that survive today. If machine-generated pages were created in volume after 2022 and
  deleted (Wikipedia has a speedy-deletion criterion, G15, for pages that are unambiguously
  LLM-generated), the AFTER period understates what was submitted, and the deletion table
  describes only how many pages are missing, not what they said.
- Why the writing changed. Candidates this study cannot separate: AI tools, a change in who writes new
  articles, the draft-review process, tighter sourcing and notability expectations, a change in what
  topics get articles (including articles about AI), and Wikipedia's guidance on AI writing itself.
- Anything about how articles read after later editing, about other language editions, or about the
  draft and user namespaces.
- Differences from SGR-011 and SGR-020 are not like-for-like: the unit here is the month rather than the brand or
  the department, so the intervals reflect month-to-month variation, and the text is a first revision,
  not a finished page.

## 9. Limits we already know
- **Survivorship**, as above. It cuts both ways: an article that was deleted for another reason (spam,
  copyright, no notability) is gone whatever it was written with.
- A first revision is often a rough or partial start; the same article, a day later, can read differently.
- Many creators start from a template, an earlier language edition or a machine translation
  (the `contenttranslation` tag is used in a robustness check); some paste prose from elsewhere.
- Page IDs follow creation order closely but not exactly; imports and rare cases are dropped.
- The cleaner drops the text inside templates (a quotation template's quotation, for example).
- Bot detection uses today's group membership; a former bot is missed.
- Move detection uses the first 50 revisions' edit summaries.
- Early months with few pages of 150 words or more have wider monthly means; they count equally.
- A month is a small sample (at most 120 articles); one editor writing many similar articles in a month
  (a project, an edit-a-thon) can move that month's mean.

## 10. Wikipedia's own guidance, cited from its pages
Wikipedia's volunteers maintain **Wikipedia:Signs of AI writing**, a list of "writing and formatting
conventions typical of AI chatbots such as ChatGPT, with real examples taken from Wikipedia articles,
drafts, comments, and other content", which says it is "descriptive, not prescriptive", warns that "not all
text featuring these indicators is AI-generated", and warns against relying solely on AI-detection
tools or on one's own judgement; **WikiProject AI Cleanup** ("a collaboration to combat AI-generated
content on Wikipedia"); and speedy-deletion criterion **G15** ("Unambiguously LLM-generated
pages"), which is limited to a few objective signs (communication meant for the user, non-existent or
nonsensical references, and the like). Both of the first two pages were created on 4 December 2023
(first revisions of the pages, read through the API on 11 October 2026). ScriptGrain's
[reference page on the markers of AI writing](https://scriptgrain.com/reference/markers-of-ai-writing)
and the blog post [Wikipedia's signs of AI writing](https://scriptgrain.com/blog/wikipedia-signs-of-ai-writing)
already cover that list. **This study does not use Wikipedia's list as an instrument.** Its measures are
ScriptGrain's frozen SGR-007 lists, used unchanged in SGR-011 and SGR-020, so that the three studies
compare; Wikipedia's list is descriptive, long and still moving, and cannot be frozen. All we claim
from Wikipedia's pages is what they say about themselves, as quoted above.

## 11. Pilot
The run script is tested on a pilot of at most 5% of the collected articles (a fixed hash of the page ID selects 4%),
end to end, including the entry builder and the entry's checks in `src/test/research.test.ts`. The pilot
relaxes only the minimum month size (to 1 article, and 1 in sub-groups) so that the code path is
exercised on so small a sample. Pilot numbers are not reported anywhere, not in the entry, the README or
the pull request; pilot output is never committed. The full analysis is run once, on the day before
release.

## Deviations and clarifications
- 2026-10-12, boundary check run after the fetch (section 1). Only January 2015 exceeded the 6% threshold: 24 of its 120 first
  revisions were from February, because the February 2015 boundary had been placed at page ID 45,357,279; the robust probe moved it
  to 45,269,626. January and February 2015 were re-indexed and re-fetched. Afterwards no month had more than 3% of its
  first revisions in another month. No other month was changed. The check used timestamps only.
- 2026-10-12, collection complete: 141 months, 16,920 articles sampled, 16,920 first revisions fetched (a few pages were deleted before the fetch; counted at the run).
- 2026-11-05, weekdays (clarification). The header above and the README say Thursday 6 November and Wednesday 5 November. Those weekdays are wrong: 5 November 2026 is a Thursday and 6 November a Friday. The dates, which are what the calendar in `docs/plans/research-next-8.md` set, are unchanged.
- 2026-11-05, section 6(g) (deviation). The summary's `allMeasures` block omits the share of "I" among I, we and you, because `run.mjs` left it out of its list. Noticed after the single full run. The run was not repeated for it; `i_share` is in `sgr-026-articles.csv` for every article. No hypothesis uses it.
- 2026-11-05, section 1 and README. `corpus.excluded` shows no exact duplicates and 66 pages deleted before the fetch. Only one measured page came from an account in the bot group (three such accounts in the sample, 88 first revisions, the rest removed by the text rules), so robustness check (e) has almost nothing to add.
- 2026-11-05, entry wording (no change to the analysis). `write-entry.mjs` was edited after the run, before the entry was published: the "public repository" sentences now say the repository is private, because it is; "today" became October 2026, when the sample was read; the fall from EARLY to LATE and the smaller absolute change against SGR-011 and SGR-020 are stated next to the headline, because the percentage alone overstated the picture. The table by word list now quotes each hypothesis's own interval, so a statistic has one interval on the page (`allMeasures` resamples under a different seed label and differs by about 0.01). Two chart labels were moved or shortened so they fit, and the charts redrawn from the same summary. No number in the summary, threshold, list, era or test changed.
- 2026-11-05, entry wording again (no change to the analysis, DESK-591). The pre-registrations, scripts and derived data of every study are now mirrored, with their commit history, to github.com/StovBuilds/scriptgrain-research, so the entry's repository sentences point readers there instead of saying the repository is private, and "the data are published here" became "the data and scripts are public".
