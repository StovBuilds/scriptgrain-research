# SGR-021 pre-registration: which classic authors write most like an AI?

Frozen 2026-10-11, before any SGR-021 book was measured. The only contact with book text
before this file was frozen is downloading each candidate book once and counting its words to
apply the 15,000-word rule (`build-corpus.mjs`); nothing was scored. Changes after this point
are listed under "Deviations" at the end with the date and reason; nothing above that heading
is edited.

## 1. Question
Which human writers, before any language model existed, already used the words that are now
called AI-isms, and how much? We rank every author in the corpus by how often their books use
the frozen AI-ism word lists, and show where each listed word "lived" before 2022.

This is a question about habits of human writers. It is correlation and curiosity only: it says
nothing about what any model learned from whom, and it cannot show that measurement can tell
whether a text was written by AI. The page says so.

## 2. Data
- **Books:** Project Gutenberg, English-language texts in the catalogue snapshot of 2026-10-04
  (`pg_catalog.csv`, sha256 `52cc0ffbef2b79d8d07fdd16dada95d29952f47ce21a1557598c580ee6188bea`,
  the file SGR-007 used). This is the pool behind SGR-005 (a Wikidata-checked panel of 35 authors)
  and SGR-006 (a random sample of books by genre and era). Those studies kept only numbers and
  discarded the text, and SGR-006 sampled books at random, not by author, so it holds too few
  books per author to rank anyone. SGR-021 therefore rebuilds the corpus from the same catalogue
  by one author-level rule (below). SGR-005's 35 authors are included wherever the rule admits them.
- **Who counts as an English-language author:** Wikidata (CC0), query in `wd-authors.rq`, saved
  result `scripts/experiments/sgr-021/wd-authors.json` (9,240 person records with known birth and death years, fetched 2026-10-11). A person qualifies if
  they have a Project Gutenberg author ID, birth and death dates, and English as a native,
  writing or spoken language (properties P103, P6886, P1412), the SGR-005 rule. A catalogue
  author ("Surname, Forenames, 1812-1870", one author only) is matched to a person when exactly
  one person has the same birth and death years and a label that contains the surname. No match,
  or more than one, drops the author. This keeps translated authors (Plato, Dumas) out. It will
  also drop some English writers whose catalogue name differs from their Wikidata label; the
  count is reported.
- **Collection:** from `gutenberg.org`, or its pglaf mirror when the main host is down, at
  most one request per 1.1 seconds, User-Agent `ScriptGrain research (support@scriptgrain.com)`.
  Texts are kept gzipped outside the repository and are never published. Only numbers are.

## 3. Inclusion rule (fixed before the panel was built)
All applied by `build-corpus.mjs` from `sources.json`; the panel is whatever they produce, with
no hand edits.
1. **Work:** catalogue Type Text, Language `en`, a single author. Dropped if the subjects or title
   match: translat*, drama, play(s), poetry, poems, verse, dictionar*, encyclop*, concordance,
   bibliograph*, periodical, or a title starting "Complete works", "Collected works", "Works of",
   "Selected works". Duplicate editions are folded by normalised title, keeping the lowest
   Gutenberg number.
2. **Author:** matched to Wikidata as above; the year they turned 40 (birth + 40, "midlife year")
   between 1650 and 1949; at least 3 eligible works in the catalogue.
3. **Books per author:** in a seeded order (seed 20261019, shuffled per author), take books until 8
   have at least 15,000 words once the paragraph filter of step 4 is applied (before the 5% trim). An author needs at least 3 such books
   to be in the panel. Authors with fewer are dropped, and counted.
4. **Cleaning:** text between the Gutenberg START and END markers; keep paragraphs of more than 12
   words that are not headings (CHAPTER, BOOK, VOLUME, PART, SECTION, LETTER, ACT, SCENE, PREFACE,
   CONTENTS, Roman numerals) and do not mention a transcriber, Project Gutenberg, an illustration,
   footnote, note or sidenote tag; then drop the first 5% and last 5% of the words, to remove
   editors' introductions, notes and indexes. The whole remaining book is measured (not samples).
5. **Era:** the century of the author's midlife year (1600s, 1700s, 1800s, 1900s).
   **Genre:** per book, fiction if the catalogue subjects match fiction, stories, novel or tales,
   otherwise non-fiction. Genre is the catalogue's label and is not checked book by book.
6. **Ranked authors:** at least 3 books and at least 100,000 words after cleaning.

"Every author with at least three works" is therefore: every Wikidata-matched English-language
author with at least 3 eligible books of at least 15,000 words, up to 8 each.

## 4. Measures
- **AI-ism rate (primary):** uses per 1,000 words of OLD, CALLED_OUT and MARKETING from
  `scripts/experiments/sgr-007/lexicons.json` (frozen 2026-10-04, SGR-007 section 4), each word
  occurrence counted once. Matching rule as SGR-007's `instruments.mjs` (whole words,
  case-insensitive, trailing `*` for any ending, hyphen matches hyphen or space); `run.mjs`
  checks its counts against that file's `measure()` on two books before it writes anything.
  No list says a text was written by AI.
- **Narration rate:** the same, counting only occurrences outside paired double quotation marks
  (straight or curly) within a paragraph, per 1,000 words outside them. **Dialogue share:** the
  share of words inside those quotes. Gutenberg punctuation can be the editor's: dashes and
  semicolons are not used anywhere in this study, and single-quote dialogue is not detected.
- **Pattern density (secondary, reported not ranked):** the product's published AI-tell scan
  (`scanCliches`) per 1,000 words.
- **Per-tell counts:** each list entry counted separately (entries folded into a wildcard stem
  that covers them, such as `delve` into `delve*`, are not listed twice).
- All code is deterministic. No language model reads or scores any text.

## 5. Analysis
- **Author rate:** total uses divided by total words across the author's books, per 1,000 words.
  **95% interval:** 10,000 bootstrap resamples of that author's books with replacement (seed
  20261019), percentile method. An author's rank is by rate; the intervals are shown beside it.
- **Without their top book:** the lowest rate obtainable by leaving out one of the author's books.
  This is the guard against one odd book: the "robust ranking" is by this number.
- **Versus peers (era and genre adjustment):** for each book, the expected uses are the rate of all
  other authors' books of the same genre in the same midlife century, times its words (if those
  have under 200,000 words, the century's rate for all genres). An author's ratio is observed
  over expected uses, with the same bootstrap. 1.0 means "as the peers of their era and genre".
- **Per tell:** pooled rate, number of authors using it, the author with the highest rate (at
  least 100,000 words and 5 uses), and its **earliest strong home**: the earliest midlife decade
  whose rate is at least 2 times the corpus rate for that tell, with at least 10 uses and at
  least 2 authors using it. Also its peak decade. Decade = decade of the author's midlife year,
  not of publication (Gutenberg does not date first editions).
- Pooled rates are word-weighted. Author-level means (H2) are unweighted over authors.

## 6. Confirmatory hypotheses
All intervals are 95% percentile bootstrap intervals with 10,000 resamples of authors (seed
20261019, authors resampled with all their books).
- **H1 (genre):** non-fiction books have a higher AI-ism rate than fiction. *Statistic:* pooled
  non-fiction rate minus pooled fiction rate. *Holds if* the interval lies above zero.
- **H2 (era, two-sided):** authors whose midlife year is in the 1900s have a different mean
  author rate from authors whose midlife year is in the 1800s. *Statistic:* difference in mean
  author rate, each group resampled separately. *Holds if* the interval excludes zero. We do not
  predict a direction.
- **H3 (not a dialogue artefact):** the author ranking barely changes when dialogue is removed.
  *Statistic:* Spearman correlation between all-text and narration author rates. *Holds if* it is
  at least 0.9.
- **H4 (the ranking measures something stable about an author):** book rates cluster within
  authors. *Statistic:* intraclass correlation ICC(1) of book rates (one-way, unbalanced).
  *Holds if* the lower bound of the interval is above 0.25.
A hypothesis that does not hold is reported as not supported, in the same place and size.

## 7. Fixed outputs (produced whatever the results)
1. The ranked table of every author (rate, interval, books, words, rank without top book, ratio
   versus peers, narration rank, dialogue share) as a CSV and the top 20 as a chart with intervals.
2. Corpus counts: authors, books and words by midlife century and by genre.
3. The era-by-genre baseline table and chart.
4. The robust top 10 (by rate without the top book), the top 10 versus peers, and how many of
   the top 20 by rate appear in each of those lists and in the narration top 20.
5. The per-tell table: pooled rate, top author, earliest strong home, peak decade.
6. H1 to H4 with their intervals and verdicts.
7. The Spearman correlation of author rate with dialogue share (exploratory).
8. The `books.csv`, `authors.csv`, `tells.csv` and `summary.json` datasets (numbers only), CC BY 4.0.

## 8. Exploratory (labelled as such)
Anything on the page that is not in sections 6 and 7: which tells travel together, which genres
drive an author's rank, nationality, comparisons with SGR-005 and SGR-007 results.

## 9. What this cannot show
- That any author, book or word list "sounds like AI", or that a model learned from an author.
- That measurement can tell whether a text was written by AI. Nothing here tests that.
- Anything about first publication: Gutenberg gives e-text dates, so eras are by the author's
  midlife, not the book's date.
- Authors' own punctuation or spelling: texts are particular editions, sometimes modernised or
  edited. Words, not punctuation, are counted.
- Many words on the lists (realm, journey, landscape, potential-style words, "harness") are ordinary
  English with older senses. A high rate means the author used those words, not that they used them
  as a model does.
- Coverage: only authors Wikidata and the catalogue let us match, and only those on Project
  Gutenberg. Women and non-British writers are under-represented in the public-domain record.
  The panel is not a canon.

## 10. Pilot
A pilot of at most 5% of authors (the 5% with the lowest sha256 of `seed:wikidata id`; run with
`--pilot`) tests that the code runs end to end and that its counts match SGR-007's instruments.
The pilot ran on 58 of 1,157 authors (322 of 6,381 books) after the panel was built. Pilot numbers are not reported. No rule, list, threshold or hypothesis was changed because of
pilot output. A run on 3 authors (18 books) while the code was being written found and fixed
four bugs (undefined bootstrap intervals on tiny samples, a missing fallback when a century has
no peers, rates rounded too coarsely, a stale panel path); none concerned the rules above.

## 11. Deviations
None. The full run on 2026-10-20 used the committed `panel.json` and cached texts unchanged (6,381 books by 1,157 authors measured; 1,129 authors and 6,293 books met rule 6 and were ranked), the self-check against SGR-007's instruments passed, and every rule, list, threshold and hypothesis above was applied as frozen.
