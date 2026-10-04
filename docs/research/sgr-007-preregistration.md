# SGR-007 pre-registration: where did the AI-isms come from?

Frozen 2026-10-04, before any SGR-007 page was measured. Changes after this point are
listed at the end with the date and the reason; nothing above that list is edited.

## 1. Question
Before ChatGPT (30 November 2022), which kinds of human writing already used the words
and habits now called "AI-isms" most? When did each one become common?
We can show where the closest pre-AI match lives. We cannot show where a model learned
anything, and the page will say so.

## 2. Sources (all written before 30 November 2022)
- **Web, as language models saw it:** Common Crawl CC-MAIN-2021-43 (crawled October 2021),
  read through its public CDX index and WARC files. One source = one URL prefix. Sources
  and groups are listed in `scripts/experiments/sgr-007/sources.json`, fixed with this file.
- **Books, 1800 to 2019:** Google Books Ngram (English 2019 corpus), word by word.
- **Books by genre, before 1928:** Project Gutenberg, sampled by Library of Congress class
  (fiction, essays, religion and sermons, conduct of life and self-help, oratory, commerce,
  history, science). Classes are fixed in sources.json.
- **Scientific abstracts:** SGR-008's arXiv census, using only papers with no version after
  2022-11-30 (`base_ok`). Read-only, by agreement with the SGR-008 lane.
- **Company homepages:** the SGR-004 panel's root URLs, as captured in CC-MAIN-2021-43.

## 3. Sampling
- Web: for each source, captures with status 200, MIME text/html, one per URL, shuffled
  with seed 20261004. Pages are read in that order until 200 pass extraction, or the
  captures run out. A page passes if the product's article extractor (`htmlToText`)
  returns at least 200 words and the URL is not an index, tag, category, author or
  search page (pattern list in sources.json).
- Gutenberg: 25 books per class, seed 20261004. Three pieces of about 800 words from
  each book, at fixed positions (20%, 50%, 80% of the body).
- Text is measured and discarded. Only numbers are kept.

## 4. Measures
Word lists are frozen in `scripts/experiments/sgr-007/lexicons.json`:
- **OLD:** SGR-008's 2024 tells, frozen in sgr-008-preregistration.md §3 (innovative,
  utilized, advancements, pivotal, facilitates, firstly, tackle, showcasing, underscores,
  delve, delves, intricate). Exact forms.
- **CALLED_OUT** and **QUIET:** SGR-008's pilot lexicon (the words publicly mocked as
  ChatGPT tells, and the quieter LLM-favoured words), with its sources.
- **MARKETING:** SGR-004's AI-era vocabulary, style words only (no AI-topic phrases).
- **DELVE:** delve, delves, delved, delving (for H2).
- **CONTROL:** however, results, using, show, method, people, time, year.
- **Pattern density:** ScriptGrain's published AI-tell scan (`scanCliches`) per 1,000 words.
- **Em dash** per 1,000 words.

**Primary outcome: the AI-ism rate.** Uses per 1,000 words of OLD ∪ CALLED_OUT ∪ MARKETING,
deduplicated.

## 5. Confirmatory hypotheses
- **H1:** Among the web groups, press releases, marketing/SEO blogs and essay-mill essays
  each have a higher mean AI-ism rate than news (all countries pooled) and than Wikipedia.
- **H2:** The DELVE rate is higher in Nigerian and Kenyan news, pooled, than in UK and US
  news, pooled. The same holds for the OLD rate. This tests the claim that "delve" came
  from the English of the people who rated model answers, by measuring public writing in
  those countries. It does not measure the raters.
- **H3:** Gutenberg fiction has the lowest AI-ism rate of every group measured.
- **H4:** In Google Books, most words on OLD ∪ CALLED_OUT ∪ MARKETING are more frequent
  in 2019 than in 1980.

**Test:** difference in mean rate per page, with a 95% bootstrap interval (10,000 resamples
of pages, seed 20261004). A hypothesis holds if the interval excludes zero in the stated
direction. H4 is a simple count.

## 6. Exploratory (labelled as such on the page)
- Each word's "home": the group where its rate is highest relative to the pooled rate.
- Take-off year in Google Books: the first year after which the 5-year mean stays above
  twice its 1950 to 1980 mean.
- Em dash and pattern density by group.
- Indian and Philippine news, reported alongside H2. They are not part of the test.

## 7. Changes after freezing
- 2026-10-04, before any Gutenberg text was read: the sermons, conduct, oratory and commerce
  classes now also exclude books with a "Fiction" subject. Counting the catalogue showed
  that subjects such as "Conduct of life -- Juvenile fiction" would put novels in the
  self-help class. Only book counts per class had been seen.
- Wording: "before 1928" for Gutenberg means Project Gutenberg's public-domain English
  texts, almost all first published before 1929. The catalogue gives the e-text date,
  not the first-edition date, so no date filter is applied.
- 2026-10-04, before any arXiv abstract was read: the arXiv group is measured from
  abstract TEXT, not word presence. The other 24 groups use rates per 1,000 words,
  which need occurrence counts, and the census stores only unique tokens. A seeded
  random sample of 10,000 eligible abstracts (base_ok, 2015-01 to 2022-11) is
  cleaned of LaTeX with SGR-008's clean() and measured with instruments.mjs, by
  agreement with the SGR-008 lane. The full-census share of papers containing each
  OLD word, from presence, is reported alongside. The arXiv group is outside every
  confirmatory hypothesis (H1 to H4), so this changes no test.
