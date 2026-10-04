# SGR-008 pre-registration: the LLM tells in scientific abstracts, 2015 to 2026

Frozen: 2026-10-04, committed before any census figure was computed. The git
commit that adds this file is the timestamp. Any change after that commit is
listed under "Deviations" at the bottom with its reason.

## 1. Background and what is already known
Published work (all checked on arxiv.org) shows a 2023-24 spike in words such
as "delve", "intricate" and "underscore" in scientific abstracts (Kobak et al.,
2406.07016; Liang et al., 2404.01268; 2509.09596), a drop in "delve" after it
became a public joke in early 2024 (Geng and Trotta, 2502.09606), and rising
estimates of LLM-assisted writing through 2025-26 (2609.10664: 54% of astro-ph
papers in 2025; 2608.10715: 89% of PMC full texts by end 2025).

Our pilot (Research Index sample, 41,657 arXiv abstracts, 4 Oct 2026) suggested
something not yet reported: the 2024 word set has fallen back near its
pre-ChatGPT level, and a DIFFERENT set of words rose through 2025-26. If true, word
lists built from 2023-24 models now undercount LLM use, and anyone using them
(detectors, editors, studies) is measuring a fading signal. The pilot's 2026 word
list was chosen after seeing the data, so this study tests it on data it was
not chosen from.

## 2. Datasets
**D1, arXiv census (confirmatory).** Every arXiv record from arXiv's OAI-PMH
endpoint (https://oaipmh.arxiv.org/oai, format arXivRaw), harvested 4-5 Oct 2026.
Fields kept: id, categories, title, abstract, licence, every version's date.
- Inclusion: new-style ids from 1501 to 2609 (first submitted Jan 2015 to Sep
  2026; Oct 2026 is incomplete and excluded). The submission month is read from the id.
- Field: the primary category is the first one listed. Archive groups: cs, math,
  physics (astro-ph, cond-mat, gr-qc, hep-*, math-ph, nlin, nucl-*, physics,
  quant-ph), stat, eess, q-bio, q-fin, econ.
- Exclusions (each counted and reported): papers withdrawn (abstract starts
  "This paper has been withdrawn" or similar), abstracts under 50 words after
  cleaning, and non-English abstracts (fewer than 5% of tokens in a 50-word English
  stopword list).
- Pilot papers (the 41,657 ids in D2) are EXCLUDED from every confirmatory test.
- Revision rule: arXiv serves the LATEST version's abstract. For the baseline
  years (2020-22) the primary analysis keeps only papers with NO version dated
  after 2022-11-30, so no baseline abstract can have been revised in the ChatGPT era.
  A sensitivity analysis repeats everything with all papers.
- Cleaning: LaTeX math ($...$) becomes one token, LaTeX commands are stripped, and
  "---" becomes an em dash (same as the pilot's measure.mjs).

**D2, Research Index pilot sample (exploratory, already analysed).** 38 arXiv
categories x 3 fixed topic searches x 2015-2026 via Firecrawl Research Index.
It was used to derive the 2026 word list. It is reported as a pilot only.

**D3, literature corpus.** 20 fixed Research Index searches (litmap-queries.txt),
plus any extra searches listed with their date, screened to on-topic papers. Every
paper cited on the published page is checked on arxiv.org or PubMed.

## 3. Frozen word sets (from the pilot, not changed)
- OLD (2024 tells): innovative, utilized, advancements, pivotal, facilitates,
  firstly, tackle, showcasing, underscores, delve, delves, intricate
- NEW (pilot 2026 risers): underexplored, grounded, aligns, synthesizes,
  replaces, leaving, recovers, expose, structurally, reproducible, treats, vanishes
- CONTROL: however, results, using, show, method
Matched as whole lowercase words (exact forms listed, no stemming).

## 4. Confirmatory hypotheses (D1, pilot papers excluded)
Periods: BASE = 2020-01 to 2022-11 (ids 2001-2211); Y2024 = 2024-01 to
2024-12; Y2026 = 2026-01 to 2026-09.
Measure: the share of abstracts containing at least one word of a set.
CIs: 95% cluster bootstrap over primary categories (2,000 resamples).

- **H1 (old set rose, then fell).** OLD share Y2024 > BASE, and Y2026 < Y2024.
  Support: both differences have CIs excluding zero.
- **H2 (new set rose after 2024).** NEW share Y2026 > Y2024 and Y2026 > BASE,
  CIs excluding zero, AND Y2026 / BASE >= 2 in at least 6 of the 8 archive groups.
- **H3 (crossover).** There is a calendar half-year in 2025-26 from which NEW
  share exceeds OLD share in every later half-year. Reported with its date.
- **H4 (rhythm unchanged).** Mean words per sentence in Y2026 is within 1.0
  word of BASE (equivalence, 90% CI inside [-1, +1]).
- **H5 (the tells moved).** Excess vocabulary (section 5) is computed separately
  for 2024 and for 2026 (Jan-Sep). Among the top 50 excess STYLE words of each
  year, the overlap (Jaccard) is below 0.5.

A hypothesis that fails is reported as failed, in the same place and at the same
prominence as one that passes.

## 5. Excess-vocabulary method (after Kobak et al. 2406.07016)
For each word w (lowercased, at least 3 letters, letters and hyphens) and year
t, p_t(w) = share of abstracts containing w. Counterfactual
q_t(w) = p_2022 + max(0, p_2022 - p_2021) x (t - 2022), using BASE-rule papers
for 2021 and 2022 (2022 = Jan to Nov). Excess gap d = p - q and ratio r = p / q.
- Candidate words: p_t >= 0.0005 (about 1 in 2,000 abstracts) AND
  (d >= 0.001 or r >= 2 with p_t >= 0.001).
- Split-sample to avoid choosing and scoring on the same papers: words are
  SELECTED on abstracts with odd submission months and SCORED on even months.
- Content vs style: every candidate word is labelled CONTENT (topic: a thing,
  method or field, e.g. "llm", "agentic", "splatting") or STYLE (anything a
  writer could use in any field). Labels come from two independent model passes
  given only the word list and these definitions. A third pass resolves
  disagreements. All labels are published. Only STYLE words count in H5 and in
  the lower bounds.
- **Lower bound on LLM-processed share.** For a set W of style words with
  union frequency p and counterfactual q, if a fraction s of abstracts is
  LLM-processed and such an abstract contains a word from W with probability
  w <= 1, then p = (1 - s) q + s w, so s >= (p - q) / (1 - q). We report this per year
  and per archive group as a LOWER bound, with bootstrap CIs. It is not an estimate
  of the total. Separate bounds are computed from the 2024-selected and the
  2026-selected style sets, to show how much the choice of list changes the answer.

## 6. Secondary and exploratory analyses (labelled as such on the page)
- Monthly series for OLD, NEW, CONTROL; per-group series; the 38 pilot categories.
- ScriptGrain instruments on every abstract: average sentence length, sentence
  length variance, comma density, semicolon rate, share of "we", long-word
  share, AI-tell scanner rate per 1,000 words, em dash rate, words per abstract.
- "However" was falling in the 2026 pilot sample; we test whether the census shows it.
- Sensitivity: (a) all papers, ignoring the revision rule; (b) primary category
  only vs any category; (c) pooled vs category-balanced shares.
- Licence: share of abstracts under each licence, by year (context only).

## 7. What we publish
Aggregates only: per year x archive group x word frequencies for every
candidate word, all set shares, all instrument means, every CI, the full word
labels, and the list of paper ids in each sample (ids, not text). arXiv metadata
is CC0. Our dataset: CC BY 4.0. Abstract text is not republished.

## 8. Limits we already know
- Word frequencies show style, not authorship. A word rising does not prove any
  one paper used a model, and humans adopt model vocabulary second-hand.
- arXiv is not all of science: it over-represents physics, maths and CS.
- The latest-version issue is handled for the baseline by the revision rule. For
  2024 and 2026 abstracts the latest version may postdate submission by months. We report
  how often.
- Topic shifts (the LLM boom itself) can move words. That is why the content/style split
  exists, and why the control words are tracked.

## Deviations and clarifications
- 2026-10-04 11:30Z, before any census data was analysed (harvest at 2% of records):
  1. H5 ranking: "top 50 excess STYLE words" means ranked by excess gap d computed on the
     SELECTION half (odd months), among candidates passing the section 5 thresholds.
  2. Pilot papers are excluded from section 5 (excess vocabulary) as well as from H1-H4.
  3. The non-English stopword list in census-build.py had 48 words; two ("they",
     "there") were added to make the 50 the plan states.
  4. The 2022 counterfactual year uses Jan to Nov 2022 (ids 2201-2211), matching BASE.
  5. Labelling scope: the 200 candidates with the largest selection-half gap d in 2024,
     and the 200 in 2026 (union), are labelled CONTENT/STYLE. The lower-bound sets are
     the top 50 STYLE words by selection-half d for each year (the same 50 as H5).
  7. DEVIATION (2026-10-04, found running the pipeline on stand-in data built from the
     pilot sample, before any census figure existed): ranking candidates by absolute gap d
     admits very common words ("for", "these", "within"), whose union is present in nearly
     every abstract, so q approaches 1 and (p - q) / (1 - q) becomes unstable or undefined.
     Words whose selection-half counterfactual q is 5% or more are therefore excluded from
     the labelling list, the H5 sets and the lower-bound sets. Section 5's candidate
     thresholds are otherwise unchanged, and the full candidate list (all q) is still published.
  6. The revision rule is applied to every paper submitted up to 2022-11 (not only
     2020-22), so the descriptive 2015-2022 series follows the same rule as BASE.

## Added after the confirmatory run (exploratory, labelled as such on the page)
- 2026-10-04 ~15:35Z, after H1-H3 and H5/bounds were computed: a placebo test (census-placebo.py)
  shifts the bound method five years earlier (2016-17 trend, 2018-21 targets) to measure how much
  ordinary drift and the selection procedure produce with no language models. Added because the
  bounds were larger than expected; reported in full whatever it showed.
- The revised-vs-unrevised comparison of 2020-22 papers (retro-polish.json), from the H1-H3 counts.
- Lower bounds whose 95% interval is wider than 40 points are shown as "too uncertain" on the page.

