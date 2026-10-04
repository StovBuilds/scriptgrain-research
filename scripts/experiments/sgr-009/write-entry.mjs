#!/usr/bin/env bun
// SGR-009: write the study entry in src/data/research-pages.json from the published
// summary, so every number on the page is the run's number.
//   bun scripts/experiments/sgr-009/write-entry.mjs --publish-on YYYY-MM-DD
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PUBLISH_ON = opt("--publish-on");
if (!PUBLISH_ON) throw new Error("--publish-on required");
const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-009-summary.json"), "utf8"));
const PANEL = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));
const { _readme: _a, ...ANALYSTS } = JSON.parse(readFileSync(new URL("../shared/analysts.json", import.meta.url), "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f2 = (x) => n(x, 2), f3 = (x) => n(x, 3);
const pct = (x) => `${Math.round(x * 100)}%`;
const SLUG = "do-brands-in-the-same-sector-sound-the-same";
const TITLE = "Do brands in the same sector sound the same? 89 UK brands' websites, measured";
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const C = S.confirmatory, B = S.bands.J1a, G = S.typeBrandGrid;
const rob = Object.fromEntries(S.robustness.map((r) => [r.run, r]));
const sonnet = ["J2a", "J2b", "J2c"].map((r) => rob[r]);
const ci = (h) => `${f3(h.point)} (95% interval ${f3(h.lo)} to ${f3(h.hi)})`;
const sectorsSorted = Object.entries(S.perSector).sort((a, b) => b[1] - a[1]);
const SECTOR_NAME = { bank: "banks", energy: "energy", telecom: "telecoms", software: "software", grocery: "supermarkets", travel: "travel", insurance: "insurance", fashion: "fashion", charity: "charities", food: "food and drink" };
const TYPE_NAME = { home: "homepage", about: "about", product: "product", pricing: "pricing", careers: "careers" };
const agree = S.judgeAgreement;
const haikuSame = agree["J1a~J1b"].attrExactAgreement, crossAgree = agree["J1a~J2a"].attrExactAgreement;
const sonnetSelf = (agree["J2a~J2b"].attrExactAgreement + agree["J2a~J2c"].attrExactAgreement + agree["J2b~J2c"].attrExactAgreement) / 3;
const usd = Object.values(S.judgeUsage).reduce((s, u) => s + u.usd, 0);
// Exploratory, computed from pairs.csv by analyse-home.mjs (the pilot's homepage comparison).
const HOME = JSON.parse(readFileSync(new URL("./home-check.json", import.meta.url), "utf8"));
const PILOT = { auc: 0.54, brands: 26, pages: 101, rivalHomes: 0.673, homeInner: 0.653 };
const verdict = (v) => (v === "supported" ? "Supported" : v === "reversed" ? "Reversed" : "Not supported");

const study = {
  id: "SGR-009",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Do brands in the same sector sound the same? ${S.brands} UK brand websites measured · ScriptGrain Research`,
  question: "Measured with a pairwise voice score, are two pages from the same brand's website more alike than a page from that brand and a page from a rival in the same sector?",
  conductedOn: "2026-10-04",
  publishOn: PUBLISH_ON,
  description: `A pre-registered study of ${n(S.pages)} pages from ${S.brands} UK brands' websites in 10 sectors, from banks to charities: homepage, about, product, pricing and careers pages, every pair scored with ScriptGrain's pairwise voice score and judged by two AI models in five runs. A brand's own pages were barely more alike than a rival's. Free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: `Brand guidelines promise a distinctive voice, and many readers say company websites in the same sector all sound alike. ScriptGrain's pairwise voice score treats one page as the baseline and scores others against it. A pilot on ${PILOT.pages} pages from ${PILOT.brands} brands found it told a brand's own pages from a rival's barely better than chance (AUC ${f2(PILOT.auc)}), and that two rivals' homepages scored closer than a homepage did to its own inner pages. This study tests both findings on new brands chosen before any page was read.` },
    { label: "What we did", text: `We fixed three hypotheses, a panel of 96 UK brands in 10 sectors and the rules for picking five page types (homepage, about, product, pricing, careers) and published them before fetching anything. ${S.brands} brands had at least two readable pages, giving ${n(S.pages)} pages and ${n(S.pairs)} ordered page pairs. Every pair was scored with the production computation; each page's qualitative attributes were judged by Claude Haiku 4.5 at temperature 0, as in the product, and again by Claude Sonnet 5.5 in three separate runs.` },
    { label: "What we found", text: `Two pages from the same brand scored higher than a page pair from rivals in the same sector ${pct(C.h1.point)} of the time (AUC ${f3(C.h1.point)}, 95% interval ${f3(C.h1.lo)} to ${f3(C.h1.hi)}), where 50% is a coin toss. ${pct(B.SB.on)} of a brand's own page pairs read "on voice" and ${pct(B.SB.off)} read "off voice"; for rivals in the same sector, ${pct(B.SS.on)} read on voice. The pilot's second finding did not hold: same-type pages from rival brands scored no closer than different pages from one brand (median ${f3(C.medians.SS_ST)} against ${f3(C.medians.SB_DT)}). Every judge run and the counted features alone gave the same answer.` },
    { label: "What it means", text: "Measured this way, a UK brand's website pages are only slightly more like each other than like a rival's, in every sector but one. Either brands in a sector write very alike, or this kind of measure reads little brand voice in website copy, or both; the study cannot separate the two. It describes one measure on one set of pages; it does not rate any brand's writing." },
  ],
  keyNumbers: [
    `Scored with a pairwise voice measure, two pages from the same UK brand's website were more alike than two pages from rival brands in the same sector only ${pct(C.h1.point)} of the time, against 50% for a coin toss (ScriptGrain, 2026; ${S.brands} brands, ${n(S.pages)} pages).`,
    `${pct(B.SB.off)} of pairs of pages from the same brand's website scored "off voice" against each other, and only ${pct(B.SB.on)} scored "on voice" (ScriptGrain, 2026).`,
    `A page from a rival brand in the same sector scored "on voice" against a brand's own page in ${pct(B.SS.on)} of pairs, and a page from a brand in another sector in ${pct(B.XS.on)}.`,
    `Pages of the same type from rival brands, such as two banks' pricing pages, scored no closer than two different pages from one brand: a median of ${f3(C.medians.SS_ST)} against ${f3(C.medians.SB_DT)} on the raw scale.`,
    `By sector, energy brands were the easiest to tell apart from their rivals (AUC ${f2(S.perSector.energy)}) and banks the hardest (${f2(S.perSector.bank)}, no better than chance).`,
    `A larger AI judge (Claude Sonnet 5.5, three runs) disagreed with the production judge on ${pct(1 - crossAgree)} of its readings of tone and structure, yet gave the same answer: AUC ${sonnet.map((r) => f3(r.h1.point)).join(", ")}.`,
    `Counted features alone (sentence length, punctuation, pronouns, contractions), with no AI judge, told brands apart as well as the full score: AUC ${f3(rob.none.h1.point)} against ${f3(C.h1.point)}.`,
  ],
  measures: [
    { term: "Pairwise voice score", definition: "ScriptGrain's comparison of one text against another: the first text's counted features and judged attributes become a baseline profile, the second is compared with it attribute by attribute, and a weighted agreement (the raw score, 0 to 1) is mapped to a display score with bands: on voice (0.80 and above), drifting (0.55 to 0.80), off voice (below 0.55). This is the score behind the off-voice check and the compare-voice API." },
    { term: "Counted features", definition: "Measured in code, the same way every time: sentence length and its spread, contractions, commas, exclamation marks, semicolons, brackets, question marks, ellipses, the share of I, we and you, the share of the, a and an, and word lengths." },
    { term: "Judged attributes", definition: "Thirteen qualitative readings made by an AI model with ScriptGrain's production judge prompt, such as formality (0 to 10), humour, opening style, argument structure and rhythm. The model sees only the page's text." },
    { term: "AUC", definition: "The probability that a randomly chosen pair of a brand's own pages scores higher than a randomly chosen pair of rival pages (ties count half). 0.5 means the score cannot tell them apart; 1.0 means it always can." },
    { term: "Pair kinds", definition: "Same brand: two different pages from one brand's site. Rival, same sector: a page from one brand and a page from another brand in the same sector. Other sector: a page from one brand and a page from a brand in another sector. Each ordered pair is scored once, with the first page as the baseline." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of brands, drawn within each sector, so a brand with many pages cannot dominate the estimate." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells the score this study measures, and the analyst builds it. The study looks for a weakness in it. The hypotheses, brand panel and page rules were committed to the public repository before any page was fetched, every hypothesis is reported whether it passed or not, and the data and scripts are public.",
  notShown: [
    "That brands in a sector really do sound the same to readers. The study measures one score; it does not ask people, and a low AUC can mean the measure misses what makes a brand distinct.",
    "Which brands write well or badly. No page or brand is rated, and the per-brand numbers are not a league table.",
    "That a page, or a website, was written by AI, or that voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "How the score behaves on other kinds of writing, such as articles, emails or a single author's work. Website copy is written by many hands and shares a lot with every site in its sector.",
  ],
  productNote: "This is the pairwise score behind ScriptGrain's off-voice check, the compare-voice API and its MCP tool. Since the pilot, every report that compares website pages carries a note saying what the score can and cannot tell on marketing copy, and this study is the measurement that note rests on.",
  sample: {
    description: `A panel of 96 UK consumer brands in 10 sectors (10 per sector, 6 in energy), frozen before fetching, none from the pilot and no two in a sector sharing a parent company. For each brand: the homepage plus the shortest URL matching fixed rules for an about, product, pricing and careers page, fetched on 4 October 2026 from a UK location and reduced to text with the product's own page reader, cut to the first 700 words. ${S.brands} brands had at least two readable pages.`,
    size: S.pages,
    inclusionCriteria: [
      "Page found by the frozen URL rules for its type on the brand's own domain or a subdomain",
      "At least 150 words after the product's page reader removed scripts, styles and markup",
      "A brand is included if at least two of its pages qualify",
    ],
    exclusions: [
      `${S.excluded.length} brands had fewer than two readable pages: ${S.excluded.map((e) => e.brand).join(", ")}`,
      "A missing page type was never replaced with another page, another domain or a hand-picked URL",
      "No page text is published or kept beyond the analysis; only measurements",
    ],
  },
  method: [
    "Pre-registration: hypotheses H1 to H3, the brand panel, the page-type rules and both judges were committed to the public repository before any page was fetched (docs/research/sgr-009-preregistration.md and scripts/experiments/sgr-009/panel.json).",
    "Pages: Firecrawl's site map of each brand, the page-type rules applied to its links (shortest URL first, up to three tries per type), Firecrawl's raw HTML from a UK location, and ScriptGrain's own page reader, exactly what the product reads when given a URL.",
    "Judges: every page judged with the production judge prompt. Primary: Claude Haiku 4.5 at temperature 0 with the production limits, run twice. Robustness: Claude Sonnet 5.5, run three times (its temperature cannot be set). No judge call failed.",
    "Scoring: every ordered pair of included pages through the production computation, once per judge run and once with counted features only.",
    "Tests: AUC and difference in medians with 95% intervals from 2,000 bootstrap resamples of brands within sectors (fixed seed). Analyses beyond H1 to H3 are labelled exploratory.",
  ],
  variablesMeasured: ["Pairwise voice score (raw and band)", "AUC, same brand against rival brands", "Counted features per page", "Judged attributes per page, five runs", "Judge agreement between runs"],
  findings: [
    {
      label: `H1 (${verdict(C.H1).toLowerCase()}): a brand's own pages were barely more alike than a rival's`,
      value: `AUC ${ci(C.h1)}`,
      explanation: `We predicted the score would tell a brand's own page pairs from rival pairs in the same sector less than 60% of the time. It did so ${pct(C.h1.point)} of the time, in line with the pilot (${f2(PILOT.auc)}). The interval stays above 0.50, so there is a little brand signal, but it is small: the middle of the range for a brand's own pairs (median raw ${f3(B.SB.p50)}) sits close to rivals' (${f3(B.SS.p50)}). Against brands in other sectors the figure was ${f3(C.sbx.point)}.`,
    },
    {
      label: `H2 (${verdict(C.H2).toLowerCase()}): page type did not beat brand`,
      value: `median ${f3(C.medians.SS_ST)} (rivals, same page type) against ${f3(C.medians.SB_DT)} (same brand, different page type); difference ${ci(C.h2)}`,
      explanation: `We predicted, from the pilot, that two rivals' pages of the same type would score closer than two different pages from one brand. They scored the same. The pilot's version of the test also reversed: rival homepages scored a median ${f3(HOME.rivalHomes)} against each other and a homepage scored ${f3(HOME.homeInner)} against its own inner pages (pilot: ${f3(PILOT.rivalHomes)} and ${f3(PILOT.homeInner)}). Page type does carry some signal, about as much as brand: among pairs from different brands, same-type pairs scored higher than different-type pairs ${pct(S.typeAUC)} of the time.`,
    },
    {
      label: `H3 (${verdict(C.H3).toLowerCase()}): sector carried a little signal`,
      value: `AUC ${ci(C.h3)}`,
      explanation: `A rival's page in the same sector scored higher than a page from another sector ${pct(C.h3.point)} of the time. ${pct(B.XS.off)} of other-sector pairs read off voice, against ${pct(B.SS.off)} of same-sector pairs and ${pct(B.SB.off)} of a brand's own.`,
    },
    {
      label: "Robustness: every judge gave the same answer",
      value: `H1 AUC ${sonnet.map((r) => f3(r.h1.point)).join(", ")} on three Sonnet 5.5 runs; ${f3(rob.none.h1.point)} with no judge`,
      explanation: `As pre-registered, the result counts as robust to the judge only if H1 held on all three Sonnet runs and H2 and H3 matched on at least two. All three runs matched on all three hypotheses. The two models read the pages differently (they agreed exactly on ${pct(crossAgree)} of attribute readings), yet the conclusions did not move. Haiku at temperature 0 was close to repeatable (${n(haikuSame * 100, 1)}% of readings identical across two runs; median change in a pair's raw score 0, largest ${f3(agree["J1a~J1b"].pairRaw.max)}); Sonnet's three runs agreed on ${pct(sonnetSelf)}.`,
    },
    {
      label: "Exploratory: sectors differ, but no sector stands out clearly",
      value: `AUC from ${f2(sectorsSorted[0][1])} (${SECTOR_NAME[sectorsSorted[0][0]]}) to ${f2(sectorsSorted.at(-1)[1])} (${SECTOR_NAME[sectorsSorted.at(-1)[0]]})`,
      explanation: `Energy and travel brands were the easiest to tell from their rivals; banks, software and insurance the hardest. Each sector has six to ten brands, so these are point estimates without intervals and small differences between sectors should not be read as rankings. By page type the AUC ranged from ${f2(Math.min(...Object.values(S.perType)))} to ${f2(Math.max(...Object.values(S.perType)))}; using only pages of 600 words or more gave ${f3(S.long600)}.`,
    },
  ],
  sections: [
    { heading: "How a brand's pages scored", figure: { src: "/research/sgr-009-bands.svg", alt: `Stacked bars: a brand's own page pairs ${pct(B.SB.on)} on voice, ${pct(B.SB.drifting)} drifting, ${pct(B.SB.off)} off voice; rival brands in the same sector ${pct(B.SS.on)}, ${pct(B.SS.drifting)}, ${pct(B.SS.off)}; brands in other sectors ${pct(B.XS.on)}, ${pct(B.XS.drifting)}, ${pct(B.XS.off)}.`, caption: "Source: ScriptGrain SGR-009, CC BY 4.0.", width: 760, height: 244 } },
    { heading: "Five judge runs, one answer", figure: { src: "/research/sgr-009-judges.svg", alt: `Dot chart of AUC with 95% intervals: Haiku ${f3(C.h1.point)}, three Sonnet runs ${sonnet.map((r) => f3(r.h1.point)).join(", ")}, counted features only ${f3(rob.none.h1.point)}; all between chance and the pre-registered 0.60 line.`, caption: "Source: ScriptGrain SGR-009, CC BY 4.0.", width: 760, height: 298 } },
    { heading: "Sector by sector", figure: { src: "/research/sgr-009-sectors.svg", alt: `Bar chart of AUC by sector, from ${SECTOR_NAME[sectorsSorted[0][0]]} ${f2(sectorsSorted[0][1])} to ${SECTOR_NAME[sectorsSorted.at(-1)[0]]} ${f2(sectorsSorted.at(-1)[1])}.`, caption: "Source: ScriptGrain SGR-009, CC BY 4.0.", width: 760, height: 62 + sectorsSorted.length * 26 + 34 } },
    {
      heading: "Pre-registered hypotheses and results",
      table: { columns: ["Hypothesis", "Result", "Primary judge (Haiku 4.5)", "Sonnet 5.5 runs A, B, C"], rows: [
        ["H1: the score tells a brand's own page pairs from rival pairs in the same sector less than 60% of the time (AUC below 0.60)", verdict(C.H1), ci(C.h1), sonnet.map((r) => f3(r.h1.point)).join(", ")],
        ["H2: same-type pages from rival brands score higher than different-type pages from the same brand (difference in medians above zero)", verdict(C.H2), ci(C.h2), sonnet.map((r) => f3(r.h2.point)).join(", ")],
        ["H3: a rival's page in the same sector scores higher than a page from another sector (AUC above 0.50)", verdict(C.H3), ci(C.h3), sonnet.map((r) => f3(r.h3.point)).join(", ")],
      ] },
    },
    {
      heading: "Scores by kind of pair",
      paragraphs: ["Raw scores (0 to 1) and band shares under the primary judge. Each ordered pair is counted once."],
      table: { columns: ["Pair", "Pairs", "Raw 10th percentile", "Median", "90th percentile", "On voice", "Drifting", "Off voice"], rows: [["A brand's own pages", B.SB], ["Rival brand, same sector", B.SS], ["Brand in another sector", B.XS]].map(([l, r]) => [l, n(r.n), f3(r.p10), f3(r.p50), f3(r.p90), pct(r.on), pct(r.drifting), pct(r.off)]) },
    },
    {
      heading: "Brand against page type",
      paragraphs: ["Median raw score for each combination. The same brand can only be paired with a different page type, because each brand has one page of each type."],
      table: { columns: ["", "Same page type", "Different page type"], rows: [
        ["Same brand", "not possible", f3(G.sameBrand_diffType)],
        ["Rival brand, same sector", f3(G.sameSector_sameType), f3(G.sameSector_diffType)],
        ["Brand in another sector", f3(G.otherSector_sameType), f3(G.otherSector_diffType)],
      ] },
    },
    {
      heading: "By sector",
      table: { columns: ["Sector", "Brands analysed", "Pages", "AUC, own pages against rivals"], rows: sectorsSorted.map(([s, v]) => [SECTOR_NAME[s], String(S.coverage[s].brands_included), String(S.bySector[s].pages), f2(v)]) },
    },
    {
      heading: "AUC by the type of the baseline page",
      table: { columns: ["Baseline page", "Pages", "AUC"], rows: Object.entries(S.perType).map(([t, v]) => [TYPE_NAME[t], String(S.byType[t]), f2(v)]) },
    },
    {
      heading: "How much the judges agreed",
      paragraphs: ["Exact agreement: the share of attribute readings that were identical between two runs. Pair score change: how far a page pair's raw score moved between the runs."],
      table: { columns: ["Runs compared", "Exact agreement", "Median pair score change", "95th percentile change"], rows: [
        ["Haiku run 1 and Haiku run 2", pct(agree["J1a~J1b"].attrExactAgreement), f3(agree["J1a~J1b"].pairRaw.medianAbs), f3(agree["J1a~J1b"].pairRaw.p95Abs)],
        ["Sonnet run A and Sonnet run B", pct(agree["J2a~J2b"].attrExactAgreement), f3(agree["J2a~J2b"].pairRaw.medianAbs), f3(agree["J2a~J2b"].pairRaw.p95Abs)],
        ["Haiku run 1 and Sonnet run A", pct(agree["J1a~J2a"].attrExactAgreement), f3(agree["J1a~J2a"].pairRaw.medianAbs), f3(agree["J1a~J2a"].pairRaw.p95Abs)],
      ] },
    },
    {
      heading: "Coverage",
      paragraphs: ["How many brands in each sector had each page type missing under the frozen rules. Careers pages often live on separate job sites, and many homepages build their text in the browser, which the page reader does not run."],
      table: { columns: ["Sector", "Brands", "Included", "No homepage", "No about", "No product", "No pricing", "No careers"], rows: Object.entries(S.coverage).map(([s, c]) => [SECTOR_NAME[s], String(c.brands), String(c.brands_included), String(c.missing.home), String(c.missing.about), String(c.missing.product), String(c.missing.pricing), String(c.missing.careers)]) },
    },
    {
      heading: "The brand panel",
      table: { columns: ["Sector", "Brands"], rows: Object.entries(PANEL.sectors).map(([s, ds]) => [SECTOR_NAME[s], ds.join(", ")]) },
    },
  ],
  limitations: [
    `${n(S.pages)} pages from ${S.brands} brands rather than the 480 the design allowed: careers and pricing pages were often missing, and some homepages build their text in the browser. The rules were applied as frozen and every gap is shown above.`,
    "The page reader keeps navigation, footer and cookie text, which every page of one site shares. That raises same-brand scores, so the true separation of brand voice by this measure is, if anything, lower.",
    "Website pages are written by many people and agencies over years. 'Same brand' is a label, not a single writer.",
    "UK consumer brands in one week of October 2026, in English. Business-to-business, public-sector and personal sites are not covered.",
    "Both judges are Claude models; another vendor's model would read the pages differently. The counted-features-only result does not depend on any model.",
    "Per-sector figures rest on six to ten brands each and have no intervals.",
  ],
  reproducibility: [
    "Pre-registration, brand panel and every script: docs/research/sgr-009-preregistration.md and scripts/experiments/sgr-009/ in the ScriptGrain repository.",
    "Every page is named by URL and fetch time, so any page can be fetched again and measured; pages change, so expect small differences.",
    `Cost of the judges: ${n(usd, 2)} US dollars of API calls across five runs.`,
  ],
  dataDownloads: [
    { label: "Every page: brand, sector, type, URL, counted features and the primary judge's readings (CSV)", path: "/research/sgr-009-pages.csv", format: "csv" },
    { label: `Every ordered page pair: kind and raw score under Haiku, Sonnet and counted features only (CSV, ${n(S.pairs)} rows)`, path: "/research/sgr-009-pairs.csv", format: "csv" },
    { label: "Every judge reading, all five runs (JSON)", path: "/research/sgr-009-judgements.json", format: "json" },
    { label: "Summary: hypotheses, intervals, bands, coverage, judge agreement (JSON)", path: "/research/sgr-009-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-009, conducted 4 October 2026). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "Hanley, J. A. and McNeil, B. J. (1982). The meaning and use of the area under a receiver operating characteristic (ROC) curve. Radiology", url: "https://doi.org/10.1148/radiology.143.1.7063747" },
    { name: "Firecrawl (site map and page fetching)", url: "https://www.firecrawl.dev/" },
  ],
};

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-009 ${i === -1 ? "added" : "updated"}; publishOn ${PUBLISH_ON}`);
