# SGR-005 pre-registration: does a writer's voice change over a career?

Frozen 2026-10-04, before any SGR-005 book text was read. Changes after this point are
listed at the end with the date and reason; nothing above that list is edited.

## 1. Question
As writers age, which habits of their prose change and which stay fixed? Is there a
general direction of change, for example longer sentences late in a career?

## 2. Panel (fixed before measuring)
- Works and dates come from Wikidata (query in `scripts/experiments/sgr-005/wikidata-works.rq`).
  The query takes works with a Project Gutenberg ID (P2034), an author (P50), a
  publication date (P577) and language English (P407). Authors must have a birth date,
  a death date, and English as a native, writing or spoken language (P103, P6886 or P1412).
  The query result is saved in the repository, so the panel can be rebuilt exactly.
- A work's date is its earliest P577. It is kept only if it falls between the author's
  15th birthday and two years after their death; later dates are editions.
- A work is excluded if its Project Gutenberg subjects mention drama, plays, poetry,
  poems or verse.
- A work must have at least 15,000 words of body text, between the Gutenberg start and
  end markers.
- An author is in the panel if, after these rules, they have at least 6 works whose
  publication dates span at least 15 years. `build-panel.mjs` applies the rules and
  writes `panel.json`; the panel is whatever those rules produce, with no hand edits.
  Downloading a book to count its words is the only contact with text before measuring.

## 3. Sampling
Five passages per work of about 1,000 words each, starting at 10%, 30%, 50%, 70% and
90% of the body and cut at paragraph boundaries. Chapter headings are skipped. Text is
measured and discarded.

## 4. Measures
Each passage is measured twice:
- **Narration (primary):** with every run of text inside paired double quotation
  marks removed. This keeps a change in how much dialogue a book has from passing for
  a change in style.
- **All text (secondary).**

The measures are the product's deterministic `measureTextFeatures` and `scanCliches`:
- average sentence length
- sentence length variation (coefficient of variation)
- commas per sentence
- semicolons per 1,000 words
- contractions per 1,000 words
- exclamation marks per 1,000 words
- share of long words
- the I/we/you pronoun shares
- em dashes per 1,000 words
- AI-tell density
- dialogue share (the share of words inside quotation marks)

Work-level values are the means of that work's five passages.

## 5. Confirmatory hypotheses
- **H1 (lengthening):** within authors, narration sentence length rises with the
  author's age at publication.
  - *Test:* the mean of the per-author slopes (words per sentence per decade of
    age, ordinary least squares on that author's works) is above zero, and its 95%
    bootstrap interval over authors (10,000 resamples, seed 20261004) excludes zero.
- **H2 (fingerprint):** an author's works are more alike than different authors' works.
  - *Test:* for each of the six core narration features (sentence length, sentence
    length variation, commas per sentence, semicolons, contractions, long-word share),
    the intraclass correlation of work means within authors, ICC(1), is above 0.5.
  - *Holds if:* the bootstrap 95% interval over authors has a lower bound above 0.5
    for at least four of the six.

## 6. Exploratory (labelled as such)
- Which features drift most, and which authors changed most.
- Early (first third of a career by date) against late (last third), per author.
- All-text results beside narration results.
- Age against period: within one author, age and calendar year move together and
  cannot be separated. The page will say so.

## 7. Changes after freezing
(none yet)
