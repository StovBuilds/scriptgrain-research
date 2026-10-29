# SGR-024 pre-registration: did the AI tells reach medicine? SGR-008 replicated on PubMed abstracts, 2015 to 2026

Frozen: 2026-10-11, committed before any analysis of the collected data (including the pilot). The git
commit that adds this file is the timestamp. Any change after that commit is listed under
"Deviations" at the bottom with its date and reason. The full run is on Wednesday 29 October 2026 (the
page's "conducted" date); the page goes live on Thursday 30 October 2026.

This study repeats SGR-008 (arXiv, published at /research/the-ai-tells-moved) on a different body of
scientific writing. It keeps SGR-008's measures, word lists, periods and hypothesis structure so the two
results can be set side by side. Every difference is listed in section 10 with its reason.

## 0. Question

SGR-008 found, on every arXiv abstract from 2015 to September 2026, that a set of words widely named as
ChatGPT tells in 2024 ("delve", "intricate", "pivotal"...) rose and then fell back below its pre-ChatGPT
level, while a different set of words rose in its place and overtook it. Did the same happen in medicine
and biomedicine, as seen in PubMed abstracts: the frozen 2024 set up then down, the frozen 2026 set up
and overtaking, the newest excess words different from the 2024 ones, and sentence rhythm unchanged?

## 1. What is already known, and how this study relates to it

All items below were read at their source on 11 October 2026 (arXiv abstract pages, the PubMed record
through NCBI E-utilities, and the authors' public repository).

- **Kobak, Gonzalez-Marquez, Horvat and Lause (Science Advances 11(27), eadt3813, 2025; PubMed
  40601754; doi 10.1126/sciadv.adt3813; preprint arXiv 2406.07016)** studied "over 15 million
  biomedical abstracts from 2010-2024 indexed by PubMed", found an abrupt increase in the frequency of
  certain style words after LLMs appeared, and concluded that "at least 13.5% of 2024 abstracts were
  processed with LLMs", a lower bound reaching 40% for some subcorpora. They published their 900 excess
  words with annotations (content or style) and the yearly document counts of 362,441 words for 2010 to
  2024 (https://github.com/berenslab/llm-excess-vocab, MIT licence), and posted an update in July 2025 with
  six more months of data. **That work already shows the 2024 spike in PubMed. This study does not claim
  to find it.** Our excess-word method (section 5) is theirs, applied to a sample.
- Kousha and Thelwall (arXiv 2509.09596, v2 March 2026) tracked 12 LLM-associated terms in six
  databases including PubMed from 2015 to 2024 and in 2.4 million PMC full texts to July 2025: "delve",
  "underscore" and "intricate" rose most between 2022 and 2024.
- Siler (PNAS 2026; PubMed 42213755; doi 10.1073/pnas.2605754123) scored the full texts of 7.3 million
  articles from four publishers, 2020 to 2025, on 228 focal words: an estimated 57% of articles in 2025
  showed LLM influence, up from 12% in 2023.
- Holzwarth, Gonzalez-Marquez and Kobak (arXiv 2608.10715, 11 August 2026) estimate that by the end of
  2025, 89% of open-access PubMed Central papers show an excess of LLM-associated vocabulary.
- Saner et al. (Saudi Journal of Anaesthesia 20, 2026; PubMed 41710616; doi 10.4103/sja.sja_526_25)
  counted "delve" in 1,996 of 2,193,871 PubMed manuscripts from 1 December 2022 to 14 May 2024.
- Liang et al. (Nature Human Behaviour 9, 2025; PubMed 40760036; doi 10.1038/s41562-025-02273-8) covered
  arXiv, bioRxiv and Nature portfolio journals, not PubMed.
- SGR-008 (ScriptGrain, 2026, https://scriptgrain.com/research/the-ai-tells-moved) is the arXiv study
  this one replicates.

**What these studies leave open, and what this one adds.** The PubMed work above ends in 2024 (or measures
prevalence from full texts and different word lists). None of it, as far as we found, asks the SGR-008
question for medicine: whether the words that were jokes in 2024 have fallen back by 2026 and a different
set has taken over, using fixed word lists written down before looking. The new thing here is that
test, run on PubMed with the same lists and rules as on arXiv, and the side-by-side. The headline
prevalence numbers are lower bounds from a method already published; they are not a new estimate.

**Not blind.** The 2026 word set was chosen on an arXiv pilot sample (SGR-008), never on PubMed. We have
seen Kobak et al.'s published curves for 2010 to 2024, so H1's first half (OLD rises by 2024) is
expected, not a discovery. We have not looked at any PubMed-based figure for 2025 or 2026 beyond the
abstract-level claims cited above, and no word of the PubMed sample has been analysed before this
document was frozen.

## 2. Data

**D1, a fixed 10% sample of PubMed records, entered 2015 to September 2026.** Source: NCBI's PubMed
annual baseline (pubmed26n0001 to pubmed26n1334, the 2026 baseline) and daily update files
(pubmed26n1335 onward, read through the last file listed when the collection finished; the exact last
file is recorded in `manifest.json` and published), from https://ftp.ncbi.nlm.nih.gov/pubmed/. The
records are streamed from NCBI and only the sample is kept. NCBI's data are public; some abstracts are
under their publishers' copyright, so abstract text is never republished (counts and shares only).

- **Sample rule (frozen).** A PMID is in the sample if the first eight hex digits of
  `sha1("sgr-024:" + PMID)`, read as an integer, modulo 1,000,000, are below 100,000. The rule depends on
  the PMID alone: it does not depend on file order, on the collection date or on anything an abstract
  says. About one record in ten. Anyone can recompute it. Baseline files below pubmed26n0800 were not
  read. A probe before collection placed the start of 2015 near file 813; collection began at file 800
  as a margin, and the collection log confirms it: files 800 to 815 held no sampled record entered in
  2015 or later, file 816 held some and file 817 onward are full.
- **Latest version.** A PMID that appears in several files (a revised record) is kept once, as its
  latest version (highest file number). A PMID listed in a later file's DeleteCitation section is
  dropped. PubMed records are revised for metadata reasons all the time, so, unlike arXiv, a revision
  date does not tell us the abstract's wording changed; we report the share of baseline-period records
  whose last revision date is after 30 November 2022 for context and apply no exclusion (section 6).
- **Date used: the entry date.** Every record is placed in a month by the date it first entered PubMed
  (the `PubMedPubDate` with status `entrez`; if a record has none, its electronic article date).
  Reasons: it exists for every record, it cannot be in the future, it does not lag, and for most
  journals it falls within days of the article's first online publication, which is when the abstract's
  wording was fixed. The issue date (`PubDate`) is often a season or a year and can be months after
  the text was written, and for 2026 it includes issues dated in the future. The publication-date
  alternative is run as a sensitivity analysis (section 6a): the electronic article date's month where
  present, otherwise the year-month of `PubDate`.
- **Window.** Entry date from 2015-01-01 to 2026-09-30 (October 2026 is incomplete).
- **Abstract text.** The `Abstract` element's `AbstractText` sections joined with spaces, markup removed,
  `CopyrightInformation` left out. **Structured abstracts** (BACKGROUND, METHODS, RESULTS...) carry
  their section labels as an attribute, as bold markup inside the text (for example
  `<b>Methods:</b>`), or as plain text. The label words are not part of the abstract's wording, so they
  are removed: label attributes are never read, a bold element whose text ends in a colon and has at
  most six words is dropped, and a closed list of standard section labels (background, objective,
  aim, purpose, introduction, context, design, setting, participants, patients, subjects, methods,
  materials, results, findings, conclusions, importance, interventions, exposures, measures, outcomes,
  interpretation, funding, significance, discussion, limitations, implications, relevance, registration,
  study design, data sources, study selection, data extraction, data synthesis, and combinations such as
  "materials and methods" or "conclusions and relevance") followed by a colon at the start of a section
  or after a sentence end is removed (`collect.py`, `LABEL_RE`). A section that does not end in
  terminal punctuation gets a full stop so that sentence counts do not merge sections. This matters:
  "Results" is one of our control words and would otherwise count in every structured abstract. No other
  cleaning is applied; in particular SGR-008's LaTeX stripping is not, because PubMed abstracts rarely
  contain LaTeX and "$" is usually a currency sign. The number of sections found is stored and used in
  a sensitivity analysis (structured against unstructured abstracts).

### Inclusion and exclusions (each counted and reported, in this order)

1. Entry date in the window.
2. The record has an abstract (the other records of the sample are counted and left out).
3. Language: the record's language list includes `eng`.
4. Publication type: `Journal Article` is present, and none of: Retraction of Publication, Published
   Erratum, Comment, Editorial, Letter, News, Newspaper Article, Biography, Autobiography, Interview,
   Lecture, Expression of Concern, Introductory Journal Article, Portrait, Personal Narrative, Webcast,
   Video-Audio Media, Legal Case, Congress, Duplicate Publication, Consensus Development Conference,
   Clinical Conference. (Reviews, case reports, clinical trials and so on are kept.)
5. At least 50 words after cleaning (SGR-008's rule).
6. English: at least 5% of the abstract's tokens are in SGR-008's 50-word English stopword list.
7. Not an exact duplicate: an abstract whose text (lower-cased, whitespace-normalised) already appeared
   earlier in the sample file is left out.

**Retracted papers** (publication type `Retracted Publication`) are KEPT in the primary analysis, because
retractions arrive years late and removing them would thin the baseline years and not the recent ones;
retraction notices are excluded under rule 4. A sensitivity analysis drops them (section 6b).

### Subject groups and clusters

- **Cluster = journal** (the NLM Unique ID). Confidence intervals resample whole journals.
- **Subject group = the journal's group**, one of eight, from the MeSH major topics of its records entered
  January 2015 to November 2022 (rules in `fields.json`; MeSH 2026 tree), plus "general" and
  "unclassified" journals. The eight are cancer; heart, blood vessels and metabolism; brain and mind;
  infection and immunity; other body systems and surgery; health services, public health and society;
  methods and techniques; molecular and cell biology, chemicals and drugs. Fixing a journal's group on
  pre-ChatGPT records keeps the grouping from moving with the language it is used to study.

### Sampling check against the full corpus

Kobak et al. published the number of PubMed abstracts containing each of 362,441 words in each year 2010
to 2024 and the number of abstracts per year (`results/yearly-counts.csv.gz`). Check C2 (section 4) compares
our sample's yearly shares for our 29 frozen words to those full-corpus shares. In addition, the
collection script re-fetches 300 sampled records through NCBI E-utilities (efetch, `tool=scriptgrain-research`,
`email=support@scriptgrain.com`, under three requests a second) and compares date, journal, language,
publication types and cleaned text with the parsed baseline record; differences are records revised at NCBI
since the snapshot. Both are reported.

## 3. Frozen word sets (taken unchanged from SGR-008; chosen on arXiv, never on PubMed)

- OLD (2024 tells): innovative, utilized, advancements, pivotal, facilitates, firstly, tackle, showcasing,
  underscores, delve, delves, intricate
- NEW (arXiv pilot 2026 risers): underexplored, grounded, aligns, synthesizes, replaces, leaving,
  recovers, expose, structurally, reproducible, treats, vanishes
- CONTROL: however, results, using, show, method

Matched as whole lowercase tokens (letters and hyphens, at least three characters; exact forms listed, no
stemming). A document "contains" a word if the word is among its tokens. A caution we state in advance:
several NEW words have ordinary clinical senses ("treats", "replaces", "recovers", "grounded" as in
grounded theory), so their medical baseline share may be higher than on arXiv. That is why the tests below
compare each period with the same word set's own baseline and why the pre-registered ratio condition
(H2) is a ratio, not a level.

## 4. Hypotheses (confirmatory)

Periods, by entry month: BASE = 2020-01 to 2022-11; Y2024 = 2024-01 to 2024-12; Y2026 = 2026-01 to
2026-09. Measure: the share of included abstracts that contain at least one word of a set. Intervals:
95% cluster bootstrap over journals (2,000 resamples, seed 20261029), percentile method. A hypothesis
that fails is reported as failed, in the same place and at the same prominence as one that passes.

- **H1 (OLD set rose, then fell).** OLD share Y2024 > BASE, and Y2026 < Y2024. Supported if both
  differences have 95% intervals excluding zero.
- **H2 (NEW set rose after 2024).** NEW share Y2026 > Y2024 and Y2026 > BASE, both intervals excluding
  zero, AND Y2026 / BASE >= 2 in at least 6 of the 8 subject groups (journals classified into a group;
  the "general" and "unclassified" journals are not counted as groups).
- **H3 (crossover).** There is a calendar half-year in 2025H1 to 2026H2 from which the NEW share exceeds
  the OLD share in every later half-year (2026H2 is July to September). Reported with its half-year.
- **H4 (rhythm unchanged).** Mean words per sentence in Y2026 is within 1.0 word of BASE
  (equivalence: the 90% cluster-bootstrap interval of the difference lies inside -1 to +1).
  Sentences and words are counted by ScriptGrain's `measureTextFeatures`.
- **H5 (the tells moved).** Excess vocabulary (section 5) is computed separately for 2024 and for 2026
  (January to September). Among the top 50 excess STYLE words of each year, the Jaccard overlap is below
  0.5.
- **H6 (agreement with the published list).** Take our 50 words with the largest selection-half excess
  gap in 2024 (section 5; common words with a counterfactual share of 5% or more excluded; no
  content/style filter). Supported if at least 30 of the 50 (60%) are among the 900 excess words that
  Kobak et al. published. This is a check that our method run on a 10% sample finds the same words their
  method found on the full corpus; it is not about the ChatGPT era after 2024.

**Replication checks (reported beside the hypotheses; they test whether this study is sound, not the
SGR-008 claim):**

- **C1 (the lower bound is the right size).** The 2024 lower bound on the share of LLM-processed
  abstracts from the 2024-selected style set (section 5), pooled over all included journals, has a 95%
  interval whose lower end is above zero and a point estimate between 6.75% and 27% (half to double
  Kobak et al.'s 13.5%). Their set was larger than ours (all excess style words, not the top 50), so we
  expect to land at or below theirs; the window is wide on purpose.
- **C2 (the sample matches the full corpus).** For each of our 29 frozen words and each year 2015 to
  2024 in which Kobak et al.'s count is at least 1,000 abstracts, the ratio of our sample's share to
  their share (their count divided by their total abstracts) lies between 0.8 and 1.4. Passed if at
  least 80% of those word-years do. The upper bound above 1 is there because our denominator leaves out
  non-English-language records, non-article types and abstracts under 50 words, which theirs includes.

**Verdict wording on the page** (decided now): the arXiv pattern "replicates" in PubMed if H1, H2 and H3 are
all supported; "partly replicates" if at least one but not all are; "does not replicate" if none is. H4 and
H5 are reported beside that verdict, not inside it.

**Fixed side-by-side with SGR-008** (no pass or fail): the published arXiv shares for the same word sets
and periods, ratios Y2024/BASE and Y2026/BASE, the crossover half-year, the H5 overlap and the lower
bounds, copied into `sgr008-reference.json` from SGR-008's committed results; our figures sit beside them
with their intervals.

## 5. Excess-vocabulary method (after Kobak et al.; identical to SGR-008 except where marked)

For each word w (lowercase tokens, at least three letters, letters and hyphens) and year t, p_t(w) is the
share of included abstracts containing w. Counterfactual q_t(w) = p_2022(w) + max(0, p_2022(w) -
p_2021(w)) x (t - 2022), with 2021 the full year and 2022 January to November. Excess gap d = p - q;
ratio r = p / q.

- **Candidate words:** p_t >= 0.0005 AND (d >= 0.001, or r >= 2 with p_t >= 0.001).
- **Split sample:** words are SELECTED on abstracts entered in odd months and SCORED on abstracts entered in
  even months.
- **Counterfactual cap:** words whose selection-half counterfactual q is 5% or more are excluded from the
  lists, the H5 sets and the bounds (SGR-008's clarified rule 7), because a union of very common words
  saturates the bound.
- **H5 and bounds use the top 50 STYLE words** per year (2024; 2026 = January to September), ranked by the
  selection-half gap d.
- **Content or style** (the one place this study departs from SGR-008's procedure, because a fixed,
  automatic rule is needed for an unattended run and no language model is used). The 200 candidates with
  the largest selection-half gap d in 2024 and in 2026 (union) are labelled by the first rule that applies:
  1. the word is in Kobak et al.'s published annotation file: their label `style` gives STYLE, any other
     label (content, content/style, other...) gives CONTENT;
  2. the word was labelled in SGR-008 (351 words, `labels.json` in its results): that label;
  3. the word is an artificial-intelligence topic token: ai, llm, llms, chatgpt, gpt (with or without a
     trailing hyphen), generative, chatbot, chatbots, copilot, gemini, claude, llama, bert, transformer,
     transformers, nlp, deep-learning, machine-learning, large-language, or any token beginning "ai-",
     "llm" or "chatgpt": CONTENT. The study itself is about writing tools, and AI topics rise in medicine
     for reasons unrelated to how abstracts are phrased;
  4. otherwise a **breadth rule**: STYLE if the word is measurable in at least five of the eight subject
     groups (selection-half share at least 0.0003 in the group in the target year) and in at least 80% of
     the groups where it is measurable its selection-half share in the target year is at least 1.5 times
     its counterfactual in that group (the same trend formula, applied inside the group, with a floor of
     0.0001 on the counterfactual); else CONTENT.
  The source of each label (1 to 4) is published with it. Two sensitivity analyses repeat H5 and the
  bounds with rule 4 only, and with rules 1 to 3 only (words without a published label dropped).
- **Lower bound on the LLM-processed share.** For a set W of style words with union frequency p and
  counterfactual q, if a fraction s of abstracts is LLM-processed and such an abstract contains a word from
  W with probability w <= 1, then p = (1 - s) q + s w, so s >= (p - q) / (1 - q). Reported per year
  (2023 to 2026) and per subject group (2024 and 2026), as a LOWER bound, scored on even months, with
  cluster-bootstrap intervals (2,000 resamples). Three sets: the 2024-selected top-50 style words, the
  2026-selected, and their union. A bound whose interval is wider than 40 points is shown as "too
  uncertain".
- **Placebo (pre-registered here; in SGR-008 it was added afterwards).** The method is run five years
  earlier on 2016 to 2021 data, where no language model existed: (A) the actual 2024 and 2026 sets as
  "targets" 2018 to 2021 against a 2016-17 trend; (B) the whole selection procedure re-run on the
  pseudo years 2019 and 2021 (top 50 by gap, q below 5%, words with a published CONTENT label under rules
  1 to 3 removed, scored on even months). The true answer is zero, so any positive bound is what drift
  and selection alone produce. It is reported next to the real bounds, whatever it shows.

## 6. Secondary and exploratory analyses (labelled as such on the page)

- Monthly and half-year series for OLD, NEW and CONTROL, overall and by subject group.
- **ScriptGrain instruments** on every included abstract (`measureTextFeatures`, `scanCliches`): average
  sentence length, sentence-length variance, comma density, semicolon rate, share of "we", long-word
  share, AI-tell scanner rate per 1,000 words, em dash rate, words per abstract. Medical abstracts have
  decimals, abbreviations and "p = 0.05" in them, which the sentence splitter handles imperfectly; we
  compare periods within PubMed, never PubMed with arXiv, on these measures.
- "However" was falling in SGR-008's 2026 arXiv pilot; we report the same word here.
- **Sensitivity analyses** (each repeats H1 and H2 and reports the differences): (a) publication date
  instead of entry date; (b) retracted papers dropped; (c) structured abstracts only and unstructured only;
  (d) the baseline moved to 2018-01 to 2019-12 (before COVID-19); (e) journals with at least 30 included
  records in BASE and at least 30 in Y2026 only (a within-journal comparison that holds the journal mix
  roughly fixed); (f) journals weighted equally instead of abstracts; (g) the share of baseline-period records
  with a last revision date after 30 November 2022, for context.
- Composition: records per month, share structured, share from the largest 20 journals, by year.
- The labelling-rule sensitivity analyses of section 5.

## 7. What we publish

Aggregates only: set shares by month, half-year, year and subject group; every candidate and frozen word
with yearly document frequency and its label and label source; excess-word statistics for both halves;
every interval; the bounds and placebo; the exclusion counts; the collection manifest; the
sampling-check results. No abstract text and no per-record data. The sample rule is published, so the
sample can be recomputed from PubMed. Our dataset: CC BY 4.0. PubMed records are NLM's public data;
abstracts remain their publishers'. Kobak et al.'s published list is MIT-licensed and is credited.

## 8. What the study cannot show

- Word frequencies show style, not authorship. A rising word does not prove any one paper used a model,
  and writers adopt model vocabulary second-hand. A falling word does not prove less use: writers learn which
  words are mocked.
- PubMed is not all of medicine (it indexes journals chosen by NLM and by deposit in PubMed Central, and
  its composition shifted towards open-access publishers during these years), and a 10% sample of
  records is not the whole corpus.
- Journal-mix changes between BASE and 2026 can move word shares for reasons unrelated to writing tools.
  The within-journal sensitivity analysis (6e) and the journal-level bootstrap address this only in part.
- Topic changes (AI, GLP-1 drugs, long COVID) move content words. The labelling rules reduce this and do
  not remove it.
- The lower bounds assume each word's 2021 to 2022 trend would have continued in a straight line. The
  placebo measures what that assumption costs.
- The frozen NEW set was found on arXiv; if it does not rise in medicine, that says the arXiv list did not
  transfer, not that medical abstracts did not change. The excess-word analysis (H5, bounds) finds
  medicine's own words.
- It does not establish that voice measurement can tell whether a text was written by AI.

## 9. Pilot

`run.mjs --pilot` tests the scripts end to end on the sampled records with `h < 4000` in the sample (4% of
the sample, 0.4% of PubMed), with 200 bootstrap resamples. Pilot numbers are not reported anywhere and the
pilot outputs are not committed. The pilot is for fixing code. No hypothesis, threshold, word list or
window in this document was changed after seeing pilot numbers; anything the pilot forced to change in the
code is listed under Deviations with its reason. Before this document was frozen the collected records had
been looked at only to check that the parser works (abstract text of a handful of records, counts of
records per file and of parse errors).

## 10. Differences from SGR-008, each with its reason

| SGR-008 | SGR-024 | Reason |
|---|---|---|
| arXiv, every record | PubMed, a 10% PMID-hash sample | 35 million records, about 13 million in the window, are more than disk and time allow; a hash sample is unbiased and reproducible |
| Cluster: primary arXiv category | Cluster: journal | PubMed has no category; the journal is the unit that shares an editor, a style sheet and a house vocabulary |
| Groups: 8 arXiv archive groups | Groups: 8 journal subject groups from MeSH | the same "in at least 6 of 8 groups" rule needs groups; MeSH is what PubMed has |
| Month from the arXiv id | Month from the PubMed entry date | section 2 |
| Revision rule: drop baseline papers with a version after Nov 2022 | No rule; report the share revised | arXiv serves the latest version's text; a PubMed revision is usually metadata |
| Pilot papers (used to pick the NEW list) excluded | Nothing excluded | the lists were not chosen on this sample |
| LaTeX stripped | Section labels stripped, no LaTeX handling | section 2 |
| Content/style labels from two model passes plus a third | Fixed four-step rule (published annotations, SGR-008 labels, AI-topic list, breadth rule) | an unattended D-1 run with no model call; published labels used where they exist |
| Placebo added after the confirmatory run | Placebo pre-registered | the lesson of SGR-008 |
| Withdrawn papers removed | Retraction notices removed, retracted papers kept | section 2 |

## 11. Reproduction

`scripts/experiments/sgr-024/README.md` has the exact commands and the run time. The data are collected
ahead of time and stored under `~/research/sgr-024` (never committed). `run.mjs` makes no network request,
no language-model call and uses no API key.

## Deviations
None. The full run on 2026-10-29 followed this document unchanged. (Anything changed after the freeze is listed here with the date and the reason.)
