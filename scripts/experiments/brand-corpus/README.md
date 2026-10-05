# Brand deep corpus (v1, October 2026)

Long-form writing from every brand in ScriptGrain's website studies: blog posts, press
releases and news, product announcements, and information packs (annual, impact and
sustainability reports, press and media packs, brand documents). Built because
homepage and product copy (SGR-009) shows little brand voice; a brand's longer writing
is more likely to show it. Budget: 25,000 Firecrawl credits (Jack, 2026-10-04).

## Where everything is

| What | Where | In git? |
|---|---|---|
| Page text (markdown + the product's own `htmlToText` reading; live pages and, from v1.3, archived pre-ChatGPT pages) | **Storage Box** `storagebox:research/scriptgrain-brand-corpus/v1/pages/<domain>.jsonl.gz` | No: third-party text, and too big |
| One row per stored page: brand, sector, category, URL, title, date, words, sha256, storage path | `manifest.csv` (this folder) | Yes |
| Per brand: hosts mapped, candidates found by category, pages stored, credits | `discovery.json` | Yes |
| Credits spent, by kind | `ledger.json` | Yes |
| The brands (SGR-009 panel + DESK-415 pilot, 122) | `brands.json` | Yes |

The Storage Box is the Hetzner box behind the Jarvis Files tab (rclone remote
`storagebox:`, binary `~/bin/rclone` on the VPS). Read a brand's pages:

```bash
~/bin/rclone cat storagebox:research/scriptgrain-brand-corpus/v1/pages/tesco.com.jsonl.gz | gunzip | head -1 | jq '{url, category, title, words}'
# everything (about 1 GB unpacked at most; never stage the whole box locally):
~/bin/rclone copy storagebox:research/scriptgrain-brand-corpus/v1/pages ./pages
```

Each line of a `.jsonl.gz` file is one page:
`domain, sector, study, url, category, finalUrl, title, published, language, words,
pdf_pages, pdf_total_pages, fetched_at, sha256, markdown, text_product (null for PDFs),
metadata` (Firecrawl's page metadata). `sha256` is of `markdown` and matches the manifest.

## How pages were chosen (`fetch.mjs`)

1. **Discovery.** Firecrawl map of `https://www.<domain>` with subdomains (up to 5,000
   links). Two Firecrawl searches (`<brand> press releases newsroom`,
   `<brand> annual report pdf`) find newsrooms and corporate sites on other domains
   (for example tescoplc.com). Up to two such hosts are mapped too. A host counts if its
   name contains the brand's name.
2. **Excluded:** forums, help centres, docs, status, careers, shop and account
   subdomains (customer-written or not prose); legal, cookie, tag, category, author and
   search pages; listing pages (an article URL needs at least two path segments and a
   hyphenated slug of 12 or more characters); modern-slavery, pay-gap and tax statements.
3. **Categories** by URL and title: `announcement` (launch, introducing, what's new,
   product updates, release notes), `press` (press, news, newsroom, media), `blog`
   (blog, insights, stories, articles, magazine, guides, learn and similar), `info_pack`
   (PDFs whose name says annual, report, impact, sustainability, brand, press or media
   pack, fact sheet, information and similar).
4. **Sampling.** Candidates in each category shuffled with a fixed seed per brand, then
   fetched round-robin across categories until the quota (announcement 25, press 60,
   blog 70, info packs 4) or the brand's credit cap (210) is reached. PDFs are parsed
   to at most 25 pages.
5. **Kept** if Firecrawl returned at least 150 words and no error status. Exact
   duplicates (same markdown) are dropped.

Dates come from the page's own metadata when it has one (`published`); many pages do
not say, so check before using dates.

## v1.1 clean-up and top-up (same day)

An audit of the first pass found pages outside the brief: about 420 non-English pages
(locale paths such as `primark.com/de-at`, `clickup.com/pt-BR`, `canva.com/ar_eg`),
help-centre articles (`/help`, `/support`) and shop UI (`/gol-ui`, `/shop`, `/browse`).
The rules now exclude those (`FOREIGN_LOCALE`, `SKIP_PATH`, and any page whose metadata
language is not English; Slack's `/intl/en-gb` stays in). `bun fetch.mjs --v1.1` removed
861 stored pages that broke the new rules, then re-ran discovery for 47 brands that were
thin (under 15 pages) or lost 10 or more, with three more searches each (`<brand> blog`,
`<brand> news stories`, `<brand> press release <year>`) and maps of any own subdomains
and corporate hosts they found, capped at 150 credits a brand. `build-manifest.mjs`
then rebuilt `manifest.csv` from the stored files.

## What is in v1.1

8,585 pages from 122 brands. Credits: 15,812 by the ledger (Firecrawl's own
counter agreed within 1%), {"map": 221, "search": 974, "scrape": 11655, "pdf_pages": 2962}.

| Sector | Brands | Pages | Blog | Press | Announcements | Info packs | Under 15 pages |
|---|---|---|---|---|---|---|---|
| bank | 18 | 1,419 | 791 | 502 | 82 | 44 | chase.co.uk (5), coventrybuildingsociety.co.uk (7) |
| energy | 12 | 950 | 611 | 307 | 22 | 10 | ecotricity.co.uk (1), outfoxthemarket.co.uk (1) |
| telecom | 16 | 1,129 | 799 | 245 | 70 | 15 | lebara.co.uk (0), hyperoptic.com (12), bt.com (14) |
| software | 16 | 1,769 | 1,036 | 429 | 294 | 10 | none |
| grocery | 10 | 502 | 155 | 333 | 0 | 14 | aldi.co.uk (1), booths.co.uk (2) |
| travel | 10 | 286 | 162 | 114 | 2 | 8 | ryanair.com (0), loganair.co.uk (1), thetrainline.com (1), nationalexpress.com (0), eurostar.com (0) |
| insurance | 10 | 975 | 601 | 331 | 33 | 10 | none |
| fashion | 10 | 191 | 83 | 77 | 15 | 16 | next.co.uk (8), boohoo.com (0), riverisland.com (1), newlook.com (1) |
| charity | 10 | 996 | 518 | 444 | 19 | 15 | rnli.org (12), rspca.org.uk (4) |
| food | 10 | 368 | 268 | 64 | 33 | 3 | innocentdrinks.co.uk (3), pret.com (5), leon.co (0), wagamama.com (0), gailsbread.co.uk (0) |

Thin brands either publish little long-form writing on their own sites, keep it on
platforms the rules exclude (social, Medium, job sites) or block crawling (Ryanair's map
returned nothing). Most pages carry no machine-readable publish date (`published` is null);
date them from the URL or text before using time.

## v1.2 deeper, across years (2026-10-05, Jack: option a)

For the 84 brands with at least 40 stored pages, `bun fetch.mjs --v1.2` mapped the site
again and added up to 60 more blog posts, 40 press releases, 20 announcements and 2
info packs each (104 credits a brand at most). Candidates were **spread across years**:
bucketed by the year in their URL (undated URLs as one more bucket), each bucket shuffled
with the brand's seed, then taken in turn, oldest year first. The same pass re-applied
the rules to every stored page (one meeting-booking page from `meetings.hubspot.com`
removed; `meetings.` and `calendar.` hosts are now excluded).

**Dates.** `dates.mjs` gives every page a best date and its source, and
`build-manifest.mjs` writes them to `manifest.csv` as `date_best` and `date_source`:
`meta` (the page's own published-time metadata), `jsonld` (schema.org `datePublished`,
read from the raw HTML; pages fetched from v1.2 on), `url` (a year or year-month in the
path), `text` (a full date in the first 1,500 characters, never on or after the fetch day),
`modified` (a v1 fallback that stored a last-modified time; least trusted). `text` and
`modified` are guesses: check them before building anything on a date.

| Sector | Brands with pages | Pages | Dated | Before 2020 | 2020-22 | 2023-26 |
|---|---|---|---|---|---|---|
| bank | 18 | 1,994 | 62% | 206 | 312 | 710 |
| energy | 12 | 1,527 | 59% | 75 | 200 | 619 |
| telecom | 15 | 1,604 | 73% | 231 | 242 | 699 |
| software | 16 | 2,706 | 57% | 135 | 330 | 1069 |
| grocery | 10 | 645 | 45% | 82 | 45 | 163 |
| travel | 7 | 413 | 46% | 91 | 23 | 76 |
| insurance | 10 | 1,534 | 60% | 75 | 134 | 709 |
| fashion | 9 | 191 | 27% | 6 | 10 | 36 |
| charity | 10 | 1,494 | 73% | 68 | 245 | 777 |
| food | 7 | 565 | 48% | 22 | 25 | 222 |

**Credits, final.** The ledger counted 21,615 credits across v1, v1.1 and v1.2. Firecrawl's
own account counter moved 25,011 between the start of the pilot (86,683 remaining) and
the end of v1.2 (61,672), so the project used its 25,000 budget by Firecrawl's count. The
ledger matched the counter within 1% after v1 (13,668 against 13,545); the 3,396 gap
opened during v1.2. The Firecrawl key is shared with the live product and other lanes, but
the product made no overnight Firecrawl calls we could find (no company re-crawls, no page
rewrites) and the counter did not move in a 10-minute idle check, so the likeliest cause is
calls the ledger counts once that Firecrawl billed twice: a scrape that hits the script's
120-second timeout is retried and can be billed again. Count credits from the account
counter (`GET /v2/team/credit-usage`), not the ledger, before the next run.

## v1.3 writing from before ChatGPT (2026-10-05, Jack: more credits, keep 10k back)

`bun wayback.mjs` added **4,845 archived pages** as each brand published them between
2015 and 30 November 2022 (ChatGPT's launch), so "before" text is the original, not a later
edit of a page that is still live.

- **Discovery (free):** the Wayback Machine's CDX index, one query per blog or newsroom
  path prefix. A brand's prefixes are the top three first path segments of its stored blog,
  press and announcement pages (at least 3 pages each); brands with fewer than 40 pages
  got `/blog/`, `/news/`, `/press/` and `/media/`. Queries ran one at a time, 3 seconds apart
  (archive.org blocks faster callers; skill `wayback-bulk-fetch`). No 429 this run. The
  index answers are cached in `.stage/cdx/` (not committed).
- **Selection:** the rules in `fetch.mjs` (`classify`), URLs not already stored, year
  (URL year, else the first capture's year) between 2015 and 2022, spread across years
  the same way as v1.2. Quota per brand: 55 blog, 28 press, 7 announcement.
- **Fetch:** Firecrawl on `https://web.archive.org/web/<timestamp>id_/<url>`: the archived
  original bytes, no Wayback toolbar. A capture that redirected past 30 Nov 2022 is
  dropped, as are archive holding pages and bot walls.
- **Stored** in the brand's same file with `source: "wayback"`, `pre_chatgpt: true`,
  `wayback_ts` and `wayback_url`. The manifest gained `source` and `wayback_ts` columns.
  An archived page with no better date gets its capture month (`date_source` = `captured`),
  which is an upper bound on when it was published.
- **Credits:** 5,319 by Firecrawl's own account counter (`ledger.v13.spentByCounter`),
  against a 12,000 cap and a hard stop if the account fell to 10,500 (Jack: keep 10,000
  back). About 9 in 10 archived fetches gave a usable page.

## Before and after ChatGPT (v1.3)

17,518 pages. "Before" = archived, or dated before December 2022. "Undated" = live pages
with no date from any source. 45 of the 117 brands with pages have at least 30 dated pages
on each side.

| Sector | Brands | Pages | Archived | Before, 2015-18 | Before, 2019-22 | After (Dec 2022 on) | Undated |
|---|---|---|---|---|---|---|---|
| bank | 18 | 2,782 | 788 | 368 | 931 | 717 | 766 |
| energy | 12 | 2,031 | 504 | 285 | 486 | 627 | 633 |
| telecom | 15 | 2,203 | 599 | 307 | 761 | 715 | 420 |
| software | 16 | 3,766 | 1,060 | 431 | 1084 | 1080 | 1171 |
| grocery | 10 | 844 | 199 | 82 | 244 | 164 | 354 |
| travel | 8 | 559 | 146 | 130 | 130 | 76 | 223 |
| insurance | 10 | 2,176 | 642 | 294 | 552 | 714 | 616 |
| fashion | 10 | 267 | 76 | 45 | 47 | 36 | 139 |
| charity | 10 | 2,078 | 584 | 243 | 647 | 784 | 404 |
| food | 8 | 812 | 247 | 247 | 46 | 225 | 294 |

## v1.4 correction: pages from other organisations removed (2026-10-05)

The v1 to v1.3 discovery accepted a newsroom or corporate site on another domain if its name was
the brand's name plus a word such as "news", "group" or "plc", and accepted an annual-report PDF
from any host whose name contained the brand's name. Short or common brand names matched unrelated
sites: **eenews.net** (E&E News, a US politics site) was taken as EE's newsroom (261 pages),
**notionpress.com** as Notion's (104), **octopus-news.com** (newsroom software) as Octopus Energy's
(24), plus single pages from miroforestry.com, nivabupa.com, lvmh, macmillanjersey.com and others.
**avivainvestors.com** (Aviva's separately branded asset manager, 58 pages), **santander.com** (the
Spanish parent) and **image.savethechildren.org** (the international charity) were also removed as
not the UK brand's own writing. 462 stored pages in all. claude-4 found the EE case while building
brandsovertime.com.

The rule is now `host-rules.mjs`: a page counts if its host is the brand's domain or a subdomain of
it, or one of the brand's own group sites listed there by hand (tescoplc.com, natwestgroup.com,
skygroup.sky, home.barclays, virginmediao2.co.uk and others). `clean-v14.mjs` applied it to every
stored file and `fetch.mjs` uses it for any future run. The manifest was rebuilt (17,056 pages).

## Re-run or extend

`bun fetch.mjs` resumes: brands in `ledger.json` → `brandsDone` are skipped. `bun fetch.mjs --v1.1` is the clean-up and top-up pass (resumes on `discovery.<brand>.v11` and `ledger.pass2Done`). `bun fetch.mjs --v1.2` is the deeper pass (resumes on `ledger.v12Done`). `bun wayback.mjs` is the pre-ChatGPT pass (resumes on `ledger.v13.brandsDone`; `--cap`, `--floor`). After any run, `bun build-manifest.mjs`.
`--only a.com,b.com` runs a subset, `--budget` caps the run, `--per-brand` caps a brand.
