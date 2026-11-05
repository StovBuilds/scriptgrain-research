# ScriptGrain Research

Pre-registrations, analysis scripts and the derived data behind [ScriptGrain's research studies](https://scriptgrain.com/research) (SGR-001 onwards).

ScriptGrain measures writing voice. Each study asks a question about how people, brands or machines write, fixes its hypotheses and tests before measuring anything, then reports every result whichever way it came out. This repository holds the paper trail, so that the numbers on each study page can be checked rather than taken on trust.

## What is here

```
docs/research/            one pre-registration per study (brand-series covers SGR-010 to SGR-018)
scripts/experiments/
  sgr-NNN/                collection, measurement, analysis and page-builder scripts for study NNN,
                          plus the derived data (counts, summaries, panels) the page reports
  brand-corpus/           how the UK brand corpus for SGR-009 to SGR-018 was gathered (scripts only)
  brand-series/           measurement and analysis for the brand series, SGR-010 to SGR-018
  web-calibration/,
  pairwise-calibration/   calibration runs for the voice-comparison scale
  shared/                 shared helpers and the analyst profile used on study pages
```

This repository is extracted from ScriptGrain's private product repository, where the studies are run. Many scripts import ScriptGrain's measurement code (`src/lib/`, `supabase/functions/_shared/`), which stays private, so they document the method exactly but will not run on their own here. The measures themselves are described on each study page and in each pre-registration.

## Studies

| ID | Study | Released | Pre-registration (first committed) | Scripts and data |
|---|---|---|---|---|
| SGR-001 | [Same Brief, Four Voices](https://scriptgrain.com/blog/same-brief-four-voices) | 2026-07-28 | none (study predates pre-registration) | none (written up by hand) |
| SGR-002 | [ChatGPT vs a measured voice](https://scriptgrain.com/research/chatgpt-vs-a-measured-voice) | 2026-09-20 | none (study predates pre-registration) | `scripts/experiments/run-study.mjs` |
| SGR-003 | [How many samples does a voice profile need before it stabilises?](https://scriptgrain.com/research/how-many-samples-does-a-voice-profile-need) | 2026-09-21 | none (study predates pre-registration) | `scripts/experiments/run-stability-study.mjs`, `write-sgr-003.mjs` |
| SGR-004 | [Did ChatGPT change how companies write? 27 years of homepages, measured](https://scriptgrain.com/research/did-chatgpt-change-how-companies-write) | 2026-10-04 | none (study predates pre-registration) | [sgr-004/](scripts/experiments/sgr-004/) |
| SGR-005 | [Does a writer's voice change with age? 35 authors, 464 books, measured](https://scriptgrain.com/research/does-a-writers-voice-change-with-age) | 2026-10-04 | [sgr-005-preregistration.md](docs/research/sgr-005-preregistration.md) (2026-10-04 15:43 UTC) | [sgr-005/](scripts/experiments/sgr-005/) |
| SGR-006 | [What does normal writing look like? Three centuries of human prose, measured](https://scriptgrain.com/research/what-does-normal-writing-look-like) | 2026-10-04 | [sgr-006-preregistration.md](docs/research/sgr-006-preregistration.md) (2026-10-04 16:29 UTC) | [sgr-006/](scripts/experiments/sgr-006/) |
| SGR-007 | [Where did the AI-isms come from? 17,000 pieces of writing from before ChatGPT, measured](https://scriptgrain.com/research/where-did-ai-isms-come-from) | 2026-10-04 | [sgr-007-preregistration.md](docs/research/sgr-007-preregistration.md) (2026-10-04 15:51 UTC) | [sgr-007/](scripts/experiments/sgr-007/) |
| SGR-008 | [The AI tells moved: 2.1 million arXiv abstracts, 2015 to 2026](https://scriptgrain.com/research/the-ai-tells-moved) | 2026-10-04 | [sgr-008-preregistration.md](docs/research/sgr-008-preregistration.md) (2026-10-04 11:23 UTC) | [sgr-008/](scripts/experiments/sgr-008/) |
| SGR-009 | [Do brands in the same sector sound the same? 89 UK brands' websites, measured](https://scriptgrain.com/research/do-brands-in-the-same-sector-sound-the-same) | 2026-10-04 | [sgr-009-preregistration.md](docs/research/sgr-009-preregistration.md) (2026-10-04 21:41 UTC) | [sgr-009/](scripts/experiments/sgr-009/) |
| SGR-010 | [How do UK brands write? 16,070 blog posts and press releases, measured](https://scriptgrain.com/research/how-uk-brands-write) | 2026-10-05 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-011 | [Did brand writing change after ChatGPT? 37 UK brands, before and after](https://scriptgrain.com/research/did-brand-writing-change-after-chatgpt) | 2026-10-05 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-012 | [Does a brand keep one voice across its press releases and blog? 14 UK brands, measured](https://scriptgrain.com/research/does-a-brand-keep-one-voice) | 2026-10-05 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-013 | [How do UK banks and building societies write? 18 brands measured against nine other sectors](https://scriptgrain.com/research/how-uk-banks-write) | 2026-10-06 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-014 | [How do UK energy suppliers and energy brands write? 11 brands measured against nine other sectors](https://scriptgrain.com/research/how-uk-energy-companies-write) | 2026-10-07 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-015 | [How do UK mobile, broadband and TV providers write? 15 brands measured against nine other sectors](https://scriptgrain.com/research/how-uk-telecoms-brands-write) | 2026-10-08 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-016 | [How do software companies with UK sites write? 16 brands measured against nine other sectors](https://scriptgrain.com/research/how-software-companies-write) | 2026-10-09 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-017 | [How do UK insurers and insurance brands write? 10 brands measured against nine other sectors](https://scriptgrain.com/research/how-uk-insurers-write) | 2026-10-10 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-018 | [How do UK charities write? 10 brands measured against nine other sectors](https://scriptgrain.com/research/how-uk-charities-write) | 2026-10-11 | [brand-series](docs/research/brand-series-preregistration.md) (2026-10-05 09:50 UTC) | [brand-series/](scripts/experiments/brand-series/), [brand-corpus/](scripts/experiments/brand-corpus/) |
| SGR-019 | [Has the em dash really taken over? Em dashes per 1,000 words in books, research papers and brand writing, 1800 to 2026](https://scriptgrain.com/research/has-the-em-dash-taken-over) | 2026-10-14 | [sgr-019-preregistration.md](docs/research/sgr-019-preregistration.md) (2026-10-11 21:02 UTC) | [sgr-019/](scripts/experiments/sgr-019/) |
| SGR-020 | [Did government writing change after ChatGPT? 55,350 GOV.UK press releases and news stories, 2015 to 2026](https://scriptgrain.com/research/did-government-writing-change-after-chatgpt) | 2026-10-16 | [sgr-020-preregistration.md](docs/research/sgr-020-preregistration.md) (2026-10-11 20:54 UTC) | [sgr-020/](scripts/experiments/sgr-020/) |
| SGR-021 | [Which classic authors write most like an AI? 1,129 authors, 6,293 books, measured](https://scriptgrain.com/research/which-classic-authors-write-most-like-an-ai) | 2026-10-21 | [sgr-021-preregistration.md](docs/research/sgr-021-preregistration.md) (2026-10-12 00:07 UTC) | [sgr-021/](scripts/experiments/sgr-021/) |
| SGR-022 | [Do ministers' written answers sound different since ChatGPT? 42,082 parliamentary answers and 17,292 written statements, 2015 to 2026](https://scriptgrain.com/research/do-ministers-written-answers-sound-different-since-chatgpt) | 2026-10-23 | [sgr-022-preregistration.md](docs/research/sgr-022-preregistration.md) (2026-10-11 21:15 UTC) | [sgr-022/](scripts/experiments/sgr-022/) |
| SGR-023 | [What reading age do UK brands write for? Readability of 115 brands' blogs and press releases, 2015 to 2026](https://scriptgrain.com/research/what-reading-age-do-uk-brands-write-for) | 2026-10-28 | [sgr-023-preregistration.md](docs/research/sgr-023-preregistration.md) (2026-10-11 21:38 UTC) | [sgr-023/](scripts/experiments/sgr-023/) |
| SGR-024 | [Did the AI tells reach medicine? 1.4 million PubMed abstracts, 2015 to 2026](https://scriptgrain.com/research/did-the-ai-tells-reach-medicine) | 2026-10-30 | [sgr-024-preregistration.md](docs/research/sgr-024-preregistration.md) (2026-10-11 21:58 UTC) | [sgr-024/](scripts/experiments/sgr-024/) |
| SGR-025 | [The ScriptGrain Writing Index, Q4 2026: 161 company homepages, measured every quarter](https://scriptgrain.com/research/scriptgrain-writing-index) | 2026-11-04 | [sgr-025-preregistration.md](docs/research/sgr-025-preregistration.md) (2026-10-11 21:47 UTC) | [sgr-025/](scripts/experiments/sgr-025/) |
| SGR-026 | [Are new Wikipedia articles written differently since ChatGPT?](https://scriptgrain.com/research/are-new-wikipedia-articles-written-differently-since-chatgpt) | 2026-11-06 | [sgr-026-preregistration.md](docs/research/sgr-026-preregistration.md) (2026-10-11 23:13 UTC) | [sgr-026/](scripts/experiments/sgr-026/) |
| SGR-027 | What does a humaniser actually change? (not yet released) | 2026-11-11 | [sgr-027-preregistration.md](docs/research/sgr-027-preregistration.md) (2026-10-12 11:38 UTC) | [sgr-027/](scripts/experiments/sgr-027/) |

SGR-027 is pre-registered but not yet released. Its results will be added when its page goes live.

## How the pre-registration timestamps work

Every study is pre-registered: before anything is measured, the hypotheses, data sources, sampling rules, measures and pass or fail rules are written into `docs/research/` and committed. Changes after that go into a dated "Deviations" section at the end of the file, never into the frozen text.

The commit that first adds a pre-registration is its timestamp. This repository was extracted from the private product repository with `git filter-repo`, which keeps every original commit's author and commit dates. So `git log --follow docs/research/<file>` shows when each pre-registration was written, and `git log -- scripts/experiments/sgr-NNN/` shows that the results were committed after it. Commit hashes differ from the private repository because the history was rewritten to keep only these paths.

Git dates are recorded by the committer's machine. They show the order in which the work was done, but on their own they are not third-party proof of time.

## What is not here

- **Third-party text.** The pages, books and articles that were measured are not reproduced. Each study publishes counts and measurements only, with links to the sources. The raw text of the UK brand corpus, and the manifest and discovery records that point at it, are left out; the scripts that gathered it are included.
- **Unreleased results.** Results for a study are added only once its page is live. A study's pre-registration can appear here before its results do.
- **Product code and credentials.** ScriptGrain's measurement engine and anything that identifies its infrastructure are not included.

## Licence

- **Scripts and code** (`*.mjs`, `*.ts`, `*.py` and other source files): [MIT](LICENSE).
- **Data, pre-registrations and text** (everything else, including `docs/research/` and the JSON, CSV and TSV files): [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Cite a study as shown on its page, for example: ScriptGrain (2026). *Study title* (Study SGR-NNN). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/...

Source material keeps its own licence: where a study measured Wikipedia, Project Gutenberg, arXiv, PubMed or GOV.UK text, only counts derived from it are published here.

## Contact

support@scriptgrain.com
