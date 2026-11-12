# US brand corpus (v1, 13 October 2026)

The US counterpart of the UK brand deep corpus (`../brand-corpus/`), collected for
SGR-029 ("Do UK and US brands write differently?") and as the control for SGR-028.
It covers 122 US brands, matched to the UK corpus by sector with the same 10 sectors and
the same counts (`brands.json`). Jack asked for it on 2026-10-13.

## Where everything is

| What | Where | In git? |
|---|---|---|
| Page text | **Storage Box** `storagebox:research/scriptgrain-brand-corpus-us/v1/pages/<domain>.jsonl.gz` | No |
| One row per stored page, with `date_best`/`date_source` | `manifest.csv` | Yes |
| Per brand: hosts, candidates, pages stored, credits | `discovery.json` | Yes |
| Credits by kind | `ledger.json` | Yes |

The line format and the read commands are the same as the UK corpus. See `../brand-corpus/README.md`.

## How it was built

The same script and the same rules as the UK corpus:
`../brand-corpus/fetch.mjs --dir ../brand-corpus-us --remote <above> --skip-locale
'^/(en[-_]?(gb|uk|ca|au|ie|nz|in)|uk|gb|ca|au|ie)(/|$)'`. That is a first pass (cap
150 credits a brand), then `--v1.1` (clean-up plus a deeper pass for thin brands, cap
100), then `build-manifest.mjs --dir ../brand-corpus-us --remote <above>`. UK,
Canadian and other English-locale paths are dropped, so US copy only.

## What is in v1

**7,138 pages from 115 brands.**
- **Dated:** 1,523 pages are dated before 2023 and 3,762 from 2023 on. The rest are undated.
- **No pages:** gap.com, oldnavy.com, urbanoutfitters.com, sweetgreen.com, jetblue.com,
  spirit.com and ting.com. As with the UK corpus, these sites keep little long-form
  writing on their own domains, or block mapping.

| Sector | Brands with pages | Pages | Blog | Press | Announcements | Info packs | Under 15 pages |
|---|---|---|---|---|---|---|---|
| bank | 18 | 1,568 | 1,109 | 356 | 73 | 30 | none |
| charity | 10 | 918 | 364 | 490 | 43 | 21 | none |
| energy | 12 | 626 | 308 | 296 | 3 | 19 | none |
| fashion | 7 | 192 | 73 | 108 | 7 | 4 | ae.com, jcrew.com, everlane.com |
| food | 9 | 374 | 82 | 254 | 29 | 9 | chipotle.com, shakeshack.com, cava.com, liquiddeath.com |
| grocery | 10 | 328 | 121 | 187 | 13 | 7 | kroger.com, costco.com, albertsons.com, publix.com |
| insurance | 10 | 706 | 597 | 102 | 5 | 2 | geico.com |
| software | 16 | 1,375 | 823 | 338 | 191 | 23 | none |
| telecom | 15 | 789 | 555 | 186 | 33 | 15 | visible.com, cricketwireless.com, boostmobile.com, uscellular.com, cox.com |
| travel | 8 | 262 | 42 | 204 | 6 | 10 | united.com, aa.com, southwest.com |

## Credits, and one incident

- **Ledger:** 11,892 credits (map 201, search 888, scrape 8,524, pdf_pages 2,279).
- **Firecrawl's own counter:** 38,335 credits remaining before collection, 19,993 after, so
  about 18,300 used. That includes live ScriptGrain product use on the shared key.
- **Why the gap:** for about 45 minutes on 13 October, two copies of the first pass ran at
  once. The second was started because the first looked dead: its wrapper PID had exited,
  but the bun process was still running. The overlap fetched some brands twice, overwrote
  each other's ledger, and failed 10 uploads on a size check.
- **Repair:** the manifest was rebuilt from what is actually stored (`build-manifest.mjs`),
  so it has no duplicates. The 10 failed brands were re-fetched on their own.
- **Lesson:** watch the bun PID, not a wrapper's, or run the job as a systemd unit.

## Notes for the studies

- The UK panel's software sector is mostly US-headquartered SaaS (HubSpot, Slack, Asana and
  others). The US software brands are therefore US SaaS that is not in the UK panel.
  SGR-029 reports software both with and without that overlap.
- **SGR-028 control:** the US side has about 1,500 pre-2023 dated pages, against about 3,800
  after. If the per-brand before/after test needs more, a Wayback pass like the UK's v1.3
  (`../brand-corpus/wayback.mjs`) is the way to fill 2015-2022.
