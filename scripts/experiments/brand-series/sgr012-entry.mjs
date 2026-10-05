#!/usr/bin/env bun
// SGR-012: write the study entry in src/data/research-pages.json from summary-012.json.
//   bun scripts/experiments/brand-series/sgr012-entry.mjs --publish-on YYYY-MM-DD
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { calibratePairwiseScore } from "../../../supabase/functions/_shared/voice-check.ts";
const args = process.argv.slice(2);
const PUBLISH_ON = args.includes("--publish-on") ? args[args.indexOf("--publish-on") + 1] : null;
if (!PUBLISH_ON) throw new Error("--publish-on required");
const dir = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(dir + "summary-012.json", "utf8"));
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(dir + "../shared/analysts.json", "utf8"));
const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (x, d) => `${x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const ci = (h, d = 3) => `${h.point > 0 ? "+" : h.point < 0 ? "−" : ""}${n(Math.abs(h.point), d)} (95% interval ${num(h.lo, d)} to ${num(h.hi, d)})`;
const disp = (raw) => Math.round(calibratePairwiseScore(raw) * 100);
const L = S.levels, C1 = S.C1, C2 = S.C2;
const NAME = { bank: "banks", energy: "energy", telecom: "telecoms", software: "software", insurance: "insurance", charity: "charities" };
const secRows = Object.entries(S.bySector).filter(([, v]) => v.obsc != null);
const channelWins = secRows.filter(([, v]) => v.obsc > v.sboc).map(([k]) => NAME[k]);
const brandWins = secRows.filter(([, v]) => v.obsc <= v.sboc).map(([k]) => NAME[k]);
const verdict = (v) => (v === "supported" ? "Supported" : v === "reversed" ? "Reversed" : "Not supported");
const SLUG = "does-a-brand-keep-one-voice";
const TITLE = `Does a brand keep one voice across its press releases and blog? ${S.brands} UK brands, measured`;

const study = {
  id: "SGR-012", slug: SLUG, title: TITLE,
  seoTitle: `Does a brand keep one voice across press releases and blog? ${S.brands} UK brands measured · ScriptGrain Research`,
  question: "Measured with a writing-voice score, are two pages from the same brand and channel more alike than the same brand's blog and press releases, and is a rival's page in the same channel as close as the brand's own other channel?",
  conductedOn: "2026-10-05", publishOn: PUBLISH_ON,
  description: `A pre-registered test on ${n(S.pages)} blog posts and press releases from ${S.brands} UK brands, 2024 to 2026: ${n(S.pairs)} page pairs scored with ScriptGrain's counted-features voice score. A brand's pages in one channel agreed far more than its pages across channels, and a rival's page in the same channel came about as close as the brand's own other channel. Free data under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: "Brand guidelines usually promise one voice everywhere. In practice a press office and a blog team write for different readers. [SGR-010](/research/how-uk-brands-write) found the same brand's press releases run longer sentences and say \"you\" far less than its blog. This study asks how far that splits the brand's measured voice, and whether channel or brand matters more." },
    { label: "What we did", text: `We fixed two hypotheses before scoring anything. For ${S.brands} UK brands with at least 8 blog posts and 8 press releases (or announcements) of 300 words or more from 2024 to 2026, we scored every ordered pair of pages with the same counted-features voice score the free checker uses: ${n(S.pairs)} pairs. Each page was compared with the same brand's pages in the same channel, the same brand's pages in the other channel, and other brands' pages in the same channel and sector.` },
    { label: "What we found", text: `Two pages from the same brand and channel had a median agreement of ${n(L.sbsc, 3)} on the raw scale (${disp(L.sbsc)} on the checker's 0 to 100 display), against ${n(L.sboc, 3)} (${disp(L.sboc)}) for the same brand across channels: the gap held in ${C1.brandsWhereHolds} of ${C1.n} brands. A rival's page in the same channel scored ${n(L.obsc, 3)} (${disp(L.obsc)}), about as close as the brand's own other channel; the difference was within chance. By sector, channel came out ahead in ${channelWins.join(" and ")}, brand in ${brandWins.join(" and ")}.` },
    { label: "What it means", text: "On this measure, a brand's blog and its own press releases are about as alike as the brand's blog and a competitor's blog. Channel shapes measured voice as much as brand does. The study measures counted writing habits only; it does not ask readers whether they can tell the brands apart." },
  ],
  keyNumbers: [
    `Two blog posts (or two press releases) from the same UK brand scored a median ${disp(L.sbsc)} out of 100 for voice agreement; the same brand's blog against its own press releases scored ${disp(L.sboc)} (ScriptGrain, 2026; ${S.brands} brands, pre-registered).`,
    `Pages in the same channel were more alike than pages across channels in ${C1.brandsWhereHolds} of ${C1.n} UK brands measured.`,
    `A rival brand's page in the same channel scored ${disp(L.obsc)} out of 100 against a brand's page, about as close as the brand's own other channel (${disp(L.sboc)}); the difference was within chance.`,
    `In ${channelWins.join(" and ")} (exploratory, three to five brands each), a rival's page in the same channel scored closer to a brand's page than the brand's own other channel did.`,
  ],
  measures: [
    { term: "Voice agreement score", definition: "ScriptGrain's pairwise voice score on counted features only: one page's sentence lengths and their spread, contractions, punctuation rates, pronoun mix, article mix and word lengths become a baseline, and the other page is compared with it feature by feature. The raw score runs from 0 to 1. The display score (0 to 100) is the same number through the free checker's calibration: 80 and above reads \"on voice\", 55 to 80 \"drifting\"." },
    { term: "Channel", definition: "Blog posts, or press releases and product announcements together." },
    { term: "Pair kinds", definition: "Same brand, same channel; same brand, other channel; rival brand (same sector), same channel. Every ordered pair is scored, with the first page as the baseline." },
    { term: "Within-brand median", definition: "For each brand, the median score of each pair kind with that brand's pages as the baseline; the headline averages those medians over brands, so a brand with many pages does not dominate." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of brands, drawn within each sector." },
  ],
  analyst: ANALYSTS["jack-stovell"],
  competingInterests: "ScriptGrain sells the voice score this study uses, and the analyst builds it. The hypotheses, the page rules and the test were committed to the public repository before any pair was scored, both results are reported, and the data and scripts are public.",
  notShown: [
    "That readers hear the difference. The score counts writing habits; nobody was asked to tell the brands or the channels apart.",
    "That one channel's writing is better or more on-brand than the other's.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
  ],
  productNote: "ScriptGrain's free [brand voice consistency checker](/tools/brand-voice-consistency-checker) runs the same pairwise score on any pages you paste or link. This study is why its reports suggest comparing a page with others in the same channel, not across channels.",
  sample: {
    description: `UK consumer brands from ScriptGrain's brand deep corpus (October 2026) with at least 8 blog posts and 8 press releases or announcements of 300 words or more dated January 2024 or later: ${S.brands} brands, ${n(S.pages)} pages, ${n(S.pairs)} scored pairs.`,
    size: S.pages,
    inclusionCriteria: ["Written by the brand on its own site or newsroom, in English", "Dated January 2024 or later from the page's metadata, structured data or URL", "At least 300 words of main text", "Brand has at least 8 pages in each channel"],
    exclusions: ["Pages before 2024 (other eras are in SGR-011)", `A brand alone in its sector has no rival pairs and is left out of the rival comparison (${L.obsc_brands} of the ${S.brands} brands have one)`, "No page text is published"],
  },
  method: [
    "Pre-registration: hypotheses C1 and C2 were committed with the series plan before any page was measured (docs/research/brand-series-preregistration.md section 5), and four clarifications (how channels are pooled, which dates count, how medians are taken) before any pair was scored.",
    "Text: each page's main content reduced to plain text, as in SGR-010 and SGR-011.",
    "Scoring: the production computeVoiceMatch with pseudoProfileFromText and no AI judge (counted features only), the computation behind the free checker and the compare-voice API. [SGR-009](/research/do-brands-in-the-same-sector-sound-the-same) found counted features alone carry as much brand signal as the full score on web copy.",
    "Tests: C1 and C2 are the within-brand difference in median scores, averaged over brands, with a 95% brand bootstrap within sectors.",
  ],
  variablesMeasured: ["Pairwise voice score (raw and display)", "Pair kind", "Brand, sector, channel"],
  findings: [
    { label: `C1 (${verdict(C1.result).toLowerCase()}): a brand's pages agree more within a channel than across channels`, value: `${ci(C1)} on the raw scale; ${disp(L.sbsc)} against ${disp(L.sboc)} out of 100`, explanation: `The gap held in ${C1.brandsWhereHolds} of ${C1.n} brands. On the checker's bands, same-channel pairs sit at the "on voice" line and cross-channel pairs in "drifting".` },
    { label: `C2 (${verdict(C2.result).toLowerCase()}): a rival's same-channel page came about as close as the brand's own other channel`, value: `${ci(C2)} on the raw scale; ${disp(L.obsc)} against ${disp(L.sboc)} out of 100`, explanation: `We predicted, as SGR-009 had for landing pages, that channel would beat brand: that a rival's blog would score closer to a brand's blog than the brand's own press releases do. On long-form writing the two were level overall (${C2.brandsWhereHolds} of ${C2.n} brands leaned that way), so the hypothesis is not supported. Channel and brand pulled about equally.` },
    { label: "Exploratory: sectors split", value: `Channel ahead in ${channelWins.join(", ")}; brand ahead in ${brandWins.join(", ")}`, explanation: "Each sector here has two to five brands, so these are descriptions, not findings." },
  ],
  sections: [
    { heading: "How alike two pages score", figure: { src: "/research/sgr-012-pairs.svg", alt: `Dot chart of median voice agreement by pair kind: same brand and channel ${n(L.sbsc, 2)}, rival brand in the same channel ${n(L.obsc, 2)}, same brand across channels ${n(L.sboc, 2)}, overall and by sector.`, caption: "Source: ScriptGrain SGR-012, CC BY 4.0.", width: 760, height: 342 } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Difference in medians (raw, 95% interval)", "Brands"], rows: [
      ["C1: same brand, same channel scores higher than same brand, other channel", verdict(C1.result), ci(C1), String(C1.n)],
      ["C2: rival brand, same channel scores higher than same brand, other channel", verdict(C2.result), ci(C2), String(C2.n)],
    ] } },
    { heading: "By sector", paragraphs: ["Exploratory. Mean of brand medians, raw scale (display score out of 100 in brackets)."], table: { columns: ["Sector", "Brands", "Same brand, same channel", "Same brand, other channel", "Rival, same channel"], rows: Object.entries(S.bySector).map(([k, v]) => [NAME[k] ?? k, String(v.brands), `${n(v.sbsc, 3)} (${disp(v.sbsc)})`, `${n(v.sboc, 3)} (${disp(v.sboc)})`, v.obsc == null ? "no rival in the sample" : `${n(v.obsc, 3)} (${disp(v.obsc)})`]) } },
  ],
  limitations: [`${S.brands} brands qualified: many brands publish too few press releases or too few long blog posts. Sector rows rest on one to five brands.`, "The score counts surface habits only. Two pages can agree on sentence length and punctuation and still read differently to a person.", "Recent writing only (2024 to 2026).", "UK consumer brands only."],
  reproducibility: ["Pre-registration and scripts: docs/research/brand-series-preregistration.md and scripts/experiments/brand-series/sgr012.mjs in the ScriptGrain repository.", "Every page's URL is in the brand writing dataset, so any pair can be re-scored with the free checker."],
  dataDownloads: [
    { label: "Summary: medians per brand and pair kind, sector means, tests (JSON)", path: "/research/sgr-012-summary.json", format: "json" },
    { label: "Every page in the brand writing series, with its measures (CSV)", path: "/research/brand-writing-pages.csv", format: "csv" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-012, conducted 5 October 2026). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${SLUG}`,
  citations: [
    { name: "ScriptGrain (2026). How do UK brands write? (SGR-010)", url: "https://scriptgrain.com/research/how-uk-brands-write" },
    { name: "ScriptGrain (2026). Do brands in the same sector sound the same? (SGR-009)", url: "https://scriptgrain.com/research/do-brands-in-the-same-sector-sound-the-same" },
  ],
};
const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
const i = data.studies.findIndex((x) => x.id === study.id); if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
copyFileSync(dir + "summary-012.json", "public/research/sgr-012-summary.json");
console.error("SGR-012 written; publishOn", PUBLISH_ON);
