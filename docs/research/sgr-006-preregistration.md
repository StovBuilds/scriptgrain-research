# SGR-006 pre-registration: what does normal writing look like, by genre and era?

Frozen 2026-10-04, before any SGR-006 text was measured. Changes after this point are
listed at the end with the date and reason; nothing above that list is edited.

## 1. Question
For each habit the product measures, what is the normal range in human writing, by
genre, and how has it moved from the 1700s to the web of 2021, before ChatGPT? The
main output is a set of percentile tables, a baseline other studies and readers can
compare against.

## 2. Sources
- **Books:** Project Gutenberg English texts in nine genres, classified by the
  catalogue's subjects and Library of Congress class. The rules are in
  `scripts/experiments/sgr-006/sources.json`. Poetry is excluded because its line
  breaks defeat sentence measures; drama is kept as its own genre.
- **Era of a book:** the catalogue gives an author's birth year, not a book's date.
  A book is placed in the century in which its author turned 40. The eras are the
  1700s, the 1800s and the early 1900s (public-domain texts stop around 1930). This
  is an approximation and the page will say so.
- **The web of 2021:** ten kinds of writing from SGR-007's frozen source list, read
  from Common Crawl CC-MAIN-2021-43 the same way:
  - news (UK and US)
  - press releases
  - Wikipedia
  - Q&A forum
  - marketing and SEO blogs
  - essay-mill essays
  - how-to content
  - self-help and productivity
  - Medium posts
- **Scientific abstracts:** 1,000 arXiv abstracts from SGR-008's census, base_ok,
  2015-01 to 2022-11, read-only by agreement with that lane, cleaned of LaTeX the same
  way as SGR-007.

## 3. Sampling
- **Books:** 30 per genre and era where at least 30 exist; fewer cells are dropped,
  not filled. Order is seeded random (seed 20261004). Three passages of about 1,000
  words at 20%, 50% and 80% of the body, from books with at least 5,000 words.
- **Web:** 100 pages per source, the first 100 that pass extraction (200 words or
  more) in SGR-007's seeded order. Different pages from SGR-007's are fine; the
  order is the frozen one.
- **Abstracts:** a seeded sample of 1,000.

## 4. Measures
All measures are the product's deterministic instruments, on all text:
- average sentence length, sentence length variation, share of sentences under eight words
- commas per sentence, semicolons, exclamation marks, question marks
- contractions per 1,000 words
- parentheticals
- word-length shares
- pronoun shares
- em dashes per 1,000 words
- AI-tell density

## 5. Confirmatory hypotheses
- **H1 (genre):** in every era with the cells, fiction's mean sentence length is below
  that of history, of science and of philosophy and religion.
- **H2 (time):** mean sentence length in non-fiction books (history, science,
  philosophy and religion, travel, biography, pooled) is lower in the early 1900s
  than in the 1700s, and lower again in 2021 web non-fiction (news, Wikipedia,
  how-to content, pooled).
- **H3 (informality):** contractions per 1,000 words are higher in early-1900s
  non-fiction books than in 1700s non-fiction books, and higher again in 2021 web
  non-fiction.

**Test:** each comparison is a difference in means, with a 95% bootstrap interval over
texts (10,000 resamples, seed 20261004) that must exclude zero in the stated direction.
A hypothesis holds only if every one of its comparisons does.

## 6. Exploratory (labelled as such)
- Percentile tables (10th, 25th, 50th, 75th, 90th) for every measure, genre and era.
- Comparisons of the other genres and measures.

## 7. Changes after freezing
(none yet)
