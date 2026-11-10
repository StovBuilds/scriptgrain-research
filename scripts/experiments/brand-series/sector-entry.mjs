#!/usr/bin/env bun
// SGR-013..018 sector reports: write six study entries in src/data/research-pages.json from
// summary-sectors.json (prereg section 6: descriptive). No brand names on the pages; they are in
// the data files.
//   bun scripts/experiments/brand-series/sector-entry.mjs --first-publish YYYY-MM-DD
// One report a day from --first-publish, in the order below.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { calibratePairwiseScore } from "../../../supabase/functions/_shared/voice-check.ts";
import { SLUG as FILE, HABITS as CHART_HABITS, sizes } from "./sector-charts.mjs";
const args = process.argv.slice(2);
const FIRST = args.includes("--first-publish") ? args[args.indexOf("--first-publish") + 1] : null;
if (!FIRST) throw new Error("--first-publish required");
const dir = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(dir + "summary-sectors.json", "utf8"));
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(dir + "../shared/analysts.json", "utf8"));
const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (x, d) => `${x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const signed = (x, d) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const ciIn = (h, d) => `95% interval ${num(h.lo, d)} to ${num(h.hi, d)}`;
const clear = (h) => h.lo > 0 || h.hi < 0;
const disp = (raw) => Math.round(calibratePairwiseScore(raw) * 100);
const pct = (x) => `${n(x * 100)}%`;
const addDays = (iso, k) => new Date(Date.parse(iso + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const cnt = (k) => (k <= 10 ? WORDS[k] : String(k));
const Cap = (s) => s[0].toUpperCase() + s.slice(1);

const SECTORS = {
  bank: { id: "SGR-013", slug: "how-uk-banks-write", plural: "banks", who: "UK banks and building societies", short: "banks" },
  energy: { id: "SGR-014", slug: "how-uk-energy-companies-write", plural: "energy companies", who: "UK energy suppliers and energy brands", short: "energy companies" },
  telecom: { id: "SGR-015", slug: "how-uk-telecoms-brands-write", plural: "telecoms brands", who: "UK mobile, broadband and TV providers", short: "telecoms brands" },
  software: { id: "SGR-016", slug: "how-software-companies-write", plural: "software companies", who: "software companies with UK sites", short: "software companies" },
  insurance: { id: "SGR-017", slug: "how-uk-insurers-write", plural: "insurers", who: "UK insurers and insurance brands", short: "insurers" },
  charity: { id: "SGR-018", slug: "how-uk-charities-write", plural: "charities", who: "UK charities", short: "charities" },
};

// every habit in the table: label, unit formatter, words for higher / lower
const H = {
  avg_sentence_length: { kn: "words per sentence", label: "Words per sentence", f: (v) => n(v, 1), up: "longer sentences", down: "shorter sentences" },
  sentence_variation: { kn: "sentence length variation", label: "Sentence length variation", f: (v) => n(v, 2), up: "more varied sentence lengths", down: "more even sentence lengths" },
  long_word_share: { kn: "long words (seven letters or more)", label: "Long words (7+ letters)", f: pct, up: "more long words", down: "fewer long words" },
  you_share: { kn: "\"you\" share of I, we and you words", label: "\"You\" share of I, we, you", f: pct, up: "more \"you\"", down: "less \"you\"" },
  we_share: { kn: "\"we\" share of I, we and you words", label: "\"We\" share of I, we, you", f: pct, up: "more \"we\"", down: "less \"we\"" },
  contractions_per1000: { kn: "contractions per 1,000 words", label: "Contractions per 1,000 words", f: (v) => n(v, 1), up: "more contractions", down: "fewer contractions" },
  questions_per1000: { kn: "questions per 1,000 words", label: "Questions per 1,000 words", f: (v) => n(v, 1), up: "more questions", down: "fewer questions" },
  exclamations_per1000: { kn: "exclamation marks per 1,000 words", label: "Exclamation marks per 1,000 words", f: (v) => n(v, 2), up: "more exclamation marks", down: "fewer exclamation marks" },
  em_dash_per1000: { kn: "em dashes per 1,000 words", label: "Em dashes per 1,000 words", f: (v) => n(v, 2), up: "more em dashes", down: "fewer em dashes" },
  ai_ism_per1000: { kn: "AI-associated words per 1,000 words", label: "AI-associated words per 1,000", f: (v) => n(v, 2), up: "more AI-associated words", down: "fewer AI-associated words" },
  marketing_per1000: { kn: "AI-era marketing words per 1,000 words", label: "AI-era marketing words per 1,000", f: (v) => n(v, 2), up: "more AI-era marketing words", down: "fewer AI-era marketing words" },
  words: { kn: "words per page", label: "Words per page", f: (v) => n(v), up: "longer pages", down: "shorter pages" },
};
const ord = (r) => (r === 1 ? "1st" : r === 2 ? "2nd" : r === 3 ? "3rd" : `${r}th`);
const rankShort = (r) => (r === 1 ? "highest of 10 sectors" : r === 10 ? "lowest of 10 sectors" : r <= 5 ? `${ord(r)} highest of 10 sectors` : `${ord(11 - r)} lowest of 10 sectors`);
const diffPct = (h) => (h.sector - h.others) / h.others;

const PVB = {
  avg_sentence_length: { label: "Words per sentence", d: 1, unit: " words", f: (x) => signed(x, 1) },
  you_share: { label: "\"You\" share", d: 1, unit: " points", f: (x) => signed(x * 100, 1), scale: 100 },
  contractions_per1000: { label: "Contractions per 1,000 words", d: 1, unit: "", f: (x) => signed(x, 1) },
  ai_ism_per1000: { label: "AI-associated words per 1,000", d: 2, unit: "", f: (x) => signed(x, 2) },
};
const BA = {
  ai_ism_per1000: "AI-associated words per 1,000",
  marketing_per1000: "AI-era marketing words per 1,000",
  ai_shape_per1000: "AI sentence shapes per 1,000",
  em_dash_per1000: "Em dashes per 1,000 words",
  avg_sentence_length: "Words per sentence",
};
const ciCell = (h, scale = 1, d = 2) => `${signed(h.point * scale, d)} (${num(h.lo * scale, d)} to ${num(h.hi * scale, d)})`;

const studies = [];
Object.entries(SECTORS).forEach(([k, M], idx) => {
  const d = S[k];
  const PUBLISH_ON = addDays(FIRST, idx);
  const hs = Object.entries(H).map(([key, meta]) => ({ key, meta, h: d.habits[key], dp: diffPct(d.habits[key]) }));
  const marked = hs.filter((x) => x.key !== "we_share" && x.key !== "exclamations_per1000").sort((a, b) => Math.abs(b.dp) - Math.abs(a.dp));
  const top = marked.filter((x) => Math.abs(x.dp) >= 0.1).slice(0, 4);
  const describe = (x) => `${x.dp > 0 ? x.meta.up : x.meta.down} (${x.meta.f(x.h.sector)} against ${x.meta.f(x.h.others)}, ${rankShort(x.h.rank_of_10)})`;
  const within = hs.filter((x) => x.h.others >= x.h.brand_p25 && x.h.others <= x.h.brand_p75).length;
  const ai = d.habits.ai_ism_per1000, aiR = ai.rank_of_10;
  const pv = d.pressVsBlog, ba = d.beforeAfter, s12 = d.sgr012 && d.sgr012.brands >= 3 && d.sgr012.obsc != null ? d.sgr012 : null;
  const yrs = Object.entries(d.years).filter(([, v]) => v.pages >= 10);
  const peak = yrs.reduce((a, b) => (b[1].ai_ism_per1000 > a[1].ai_ism_per1000 ? b : a));
  const words10 = d.words.slice(0, 10);
  const LEAD = k === "software" ? "Software companies with UK sites" : `UK ${M.short}`;
  const TITLE = `How do ${M.who.replace(/^UK /, "UK ")} write? ${d.brands} brands measured against nine other sectors`;
  const pvSentence = (key, phr) => {
    const h = pv[key]; if (!h) return null; const m = PVB[key];
    return clear(h) ? `${phr[h.point > 0 ? 0 : 1]} (${m.f(h.point)}${m.unit}, ${ciIn({ lo: h.lo * (m.scale ?? 1), hi: h.hi * (m.scale ?? 1) }, m.d)})` : null;
  };
  const pvLines = [
    pvSentence("avg_sentence_length", ["longer sentences", "shorter sentences"]),
    pvSentence("you_share", ["more \"you\"", "less \"you\""]),
    pvSentence("contractions_per1000", ["more contractions", "fewer contractions"]),
    pvSentence("ai_ism_per1000", ["more AI-associated words", "fewer AI-associated words"]),
  ].filter(Boolean);
  const baAi = ba.ai_ism_per1000;
  const baText = ba.brands >= 2
    ? `${Cap(cnt(ba.brands))} of the ${d.brands} ${M.plural} had at least 10 dated pages in one channel both before ChatGPT (2019 to November 2022) and from 2024. In that writing, AI-associated words went from ${n(baAi.before, 2)} to ${n(baAi.after, 2)} per 1,000 words (${signed(baAi.point, 2)}, ${ciIn(baAi, 2)}).${ba.brands < 5 ? ` With ${cnt(ba.brands)} brands, treat that as a description of those brands, not of the sector.` : ""}`
    : `Too few ${M.plural} had dated writing on both sides of ChatGPT to compare before and after within the sector.`;

  const study = {
    id: M.id, slug: M.slug, title: TITLE,
    seoTitle: `How do UK ${M.short} write? ${d.brands} brands, ${n(d.pages)} pages measured · ScriptGrain Research`.replace("UK software companies", "software companies"),
    question: `How does the writing of ${M.who} differ from other sectors' on counted habits such as sentence length, "you", contractions and AI-associated words, and how has it changed since 2015?`,
    conductedOn: "2026-10-05", publishOn: PUBLISH_ON,
    description: `${n(d.pages)} blog posts and press releases from ${d.brands} ${M.who}, measured on the same counted habits as the rest of ScriptGrain's brand writing series and set against nine other sectors. The sector report behind [SGR-010](/research/how-uk-brands-write) and [SGR-011](/research/did-brand-writing-change-after-chatgpt). Free data under CC BY 4.0.`.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"),
    abstract: [
      { label: "Background", text: `[SGR-010](/research/how-uk-brands-write) measured how 117 UK brands in 10 sectors write, and [SGR-011](/research/did-brand-writing-change-after-chatgpt) tested whether that changed after ChatGPT. This report takes one sector, ${M.plural}, and sets its writing against the other nine.` },
      { label: "What we did", text: `We measured ${n(d.pages)} pages from ${d.brands} ${M.who}: ${n(d.counts.blog)} blog posts and ${n(d.counts.press)} press releases and announcements, ${n(d.counts.archived)} of them from the Internet Archive. Every measure is a count made in code. Each brand counts once, however many pages it has.` },
      { label: "What we found", text: top.length ? `Against the other nine sectors, ${M.plural} wrote with ${top.map(describe).join("; ")}. ${top.length < 3 ? `On the other habits ${M.plural} sat close to the rest. ` : ""}${Cap(M.plural)}' most distinctive words were ${words10.slice(0, 6).map((w) => `"${w.word}"`).join(", ")}.` : `${Cap(M.plural)} sat close to the other sectors on every habit measured.` },
      { label: "What it means", text: `These are sector averages over brands. ${within >= 7 ? `On ${within} of the ${hs.length} habits the middle half of the sector's own brands spans the other sectors' average, so ${M.plural} differ among themselves more than the sector differs from the rest.` : `On ${hs.length - within} of the ${hs.length} habits the middle half of the sector's own brands sits wholly to one side of the other sectors' average, so on those habits at least three in four of its brands sit on the same side.`} The report describes; it was not set up to test a hypothesis.` },
    ],
    keyNumbers: [
      ...top.slice(0, 3).map((x) => `${LEAD} averaged ${x.meta.f(x.h.sector)} ${x.meta.kn}, against ${x.meta.f(x.h.others)} in the other nine sectors (${rankShort(x.h.rank_of_10)}; ScriptGrain, 2026; ${d.brands} brands, ${n(d.pages)} pages).`),
      `AI-associated words in ${M.plural}' writing peaked in ${peak[0]} at ${n(peak[1].ai_ism_per1000, 2)} per 1,000 words (ScriptGrain, 2026; ${d.brands} brands, brand-weighted by year).`,
    ],
    measures: [
      { term: "Habits", definition: "Words per sentence and its variation (standard deviation over mean), the share of words of seven letters or more, the \"you\" and \"we\" shares of all I, we and you words, and contractions, questions, exclamation marks and em dashes per 1,000 words, all counted in code by the same functions as [SGR-010](/research/how-uk-brands-write)." },
      { term: "AI-associated words", definition: "Uses per 1,000 words of three published word lists: words studies of scientific writing found language models over-use, words publicly mocked as ChatGPT tells, and AI-era marketing words (\"seamless\", \"elevate\", \"unlock\", \"empower\"…). AI-era marketing words are the last list on its own. The same measure as [SGR-007](/research/where-did-ai-isms-come-from). Humans use all of these words; the rate says nothing about who wrote a page." },
      { term: "Other sectors", definition: "The brand-weighted average of the other nine sectors' brands: banks, energy, telecoms, software, supermarkets, travel, insurance, fashion, charities, and food and drink, less this one." },
      { term: "Rank", definition: "Where the sector's brand-weighted average sits among all 10 sectors, 1 being the highest." },
      { term: "Brand range", definition: "The 25th to 75th percentile of the sector's brand averages: the middle half of its brands." },
      { term: "Distinctive words", definition: "Words this sector uses more than the others, ranked by a log-odds score. A word counts only if at least three of the sector's brands use it and no one brand supplies more than half its uses; brand names and page furniture are removed." },
      { term: "95% interval", definition: "From 2,000 bootstrap resamples of the sector's brands." },
    ],
    analyst: ANALYSTS["jack-stovell"],
    competingInterests: "ScriptGrain sells writing-voice measurement, and the analyst builds it. The sector reports were planned in the series pre-registration before any page was measured, every number is a count made in code, and the data and scripts are public.",
    notShown: [
      "That any page, or any brand, used AI to write. Word counts show style; humans used these words before ChatGPT and keep using them.",
      "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
      `That one ${M.short.replace(/ies$/, "y").replace(/s$/, "")}'s writing is better than another's, or that the sector's habits work. Nothing here measures readers, sales or search.`,
    ],
    productNote: `ScriptGrain measures writing voice, the habits that make a writer recognisable. The counts in this report are the ones the free [writing style analyser](/tools/writing-style-analysis) and [AI cliché checker](/tools/ai-cliche-checker) run on any text you paste. This report describes how a sector writes; it is not a test of who, or what, wrote any page.`,
    sample: {
      description: `${d.brands} ${M.who} from ScriptGrain's brand deep corpus (October 2026): blog posts, press releases, product announcements and information packs from their own sites, fetched on 4 and 5 October 2026, plus archived pages from 2015 to November 2022. ${n(d.pages)} pages measured.`,
      size: d.pages,
      inclusionCriteria: ["Written by the brand on its own site or newsroom, in English", "At least 150 words of main text", "Not a link list or menu"],
      exclusions: ["Exact duplicates within a brand", "Brand names are in the data files; the page reports the sector only", "No page text is published"],
    },
    method: [
      "Plan: the sector reports were set out in the series pre-registration (docs/research/brand-series-preregistration.md section 6) before any page was measured: the SGR-010 tables for the sector against all other sectors, and the SGR-011 measures within the sector, exploratory, with intervals.",
      "Text and measures: as in SGR-010. Each page's main content reduced to plain text and counted in code.",
      "Weighting: each brand's pages are averaged first, then brands, here and for the other nine sectors.",
      "Years: pages with a date from their metadata, structured data or URL, or an archive capture date. A year is shown for the sector when it has 10 or more pages.",
      "Before and after: SGR-011's rule, inside the sector: a brand channel with at least 10 dated pages from 2019 to November 2022 and 10 from 2024 on.",
    ],
    variablesMeasured: Object.values(H).map((m) => m.label),
    findings: [
      ...top.map((x) => ({ label: `${Cap(x.dp > 0 ? x.meta.up : x.meta.down)} than other sectors`, value: `${x.meta.f(x.h.sector)} against ${x.meta.f(x.h.others)} (${signed(x.dp * 100, 0)}%)`, explanation: `${Cap(M.plural)} ranked ${rankShort(x.h.rank_of_10)}. The middle half of the sector's brands ran from ${x.meta.f(x.h.brand_p25)} to ${x.meta.f(x.h.brand_p75)}.` })),
      { label: "AI-associated words by year", value: `Peak in ${peak[0]}: ${n(peak[1].ai_ism_per1000, 2)} per 1,000 words`, explanation: `Across all 10 sectors the peak was 2024 (${n(d.allYearsAi["2024"], 2)}). ${Cap(M.plural)} ranked ${rankShort(aiR)} on these words over the whole period.` },
      { label: "Press releases against the same brands' blogs", value: pvLines.length ? Cap(pvLines.join("; ")) : "No clear difference on the four measures", explanation: `${Cap(cnt(pv.brands))} ${M.plural} had at least five of each. Positive numbers mean the press releases had more.` },
      { label: "Before and after ChatGPT (exploratory)", value: ba.brands >= 2 ? `${n(baAi.before, 2)} to ${n(baAi.after, 2)} AI-associated words per 1,000; ${cnt(ba.brands)} brands` : "Too few brands", explanation: baText },
      ...(s12 ? [{ label: "One voice across channels (from SGR-012)", value: `Same brand, same channel ${disp(s12.sbsc)}; same brand, other channel ${disp(s12.sboc)}; rival, same channel ${disp(s12.obsc)} (out of 100)`, explanation: `${Cap(cnt(s12.brands))} ${M.plural} qualified for [SGR-012](/research/does-a-brand-keep-one-voice). ${s12.obsc > s12.sboc ? "Here a rival's page in the same channel scored closer than the brand's own other channel." : "Here the brand's own other channel scored closer than a rival's page in the same channel."}` }] : []),
    ],
    sections: [
      { heading: `How ${M.plural} write, against the other nine sectors`, figure: { src: `/research/sgr-sector-${FILE[k]}-habits.svg`, alt: `Bar chart of six habits as a percentage above or below the other sectors: ${CHART_HABITS.map(([h, l]) => `${l.toLowerCase()} ${signed(diffPct(d.habits[h]) * 100, 0)}%`).join(", ")}.`, caption: "Source: ScriptGrain, CC BY 4.0.", width: 760, height: sizes[`habits-${k}`] } },
      { heading: "Every habit measured", paragraphs: ["Brand-weighted averages. Rank among all 10 sectors, 1 being the highest."], table: { columns: ["Habit", Cap(M.plural), "Other sectors", "Middle half of the sector's brands", "Rank of 10"], rows: hs.map((x) => [x.meta.label, x.meta.f(x.h.sector), x.meta.f(x.h.others), `${x.meta.f(x.h.brand_p25)} to ${x.meta.f(x.h.brand_p75)}`, String(x.h.rank_of_10)]) } },
      { heading: "AI-associated words by year", figure: { src: `/research/sgr-sector-${FILE[k]}-years.svg`, alt: `Line chart of AI-associated words per 1,000 by year, ${M.plural} against all brands, 2015 to 2026. ${Cap(M.plural)} peak in ${peak[0]} at ${n(peak[1].ai_ism_per1000, 2)}.`, caption: "2026 runs to early October. Source: ScriptGrain, CC BY 4.0.", width: 760, height: sizes[`years-${k}`] } },
      { heading: "Words this sector uses more than others", paragraphs: ["Uses per 10,000 words. Mostly the sector's subject matter; the voice is in the habits above."], table: { columns: ["Word", Cap(M.plural), "Other sectors"], rows: words10.map((w) => [w.word, n(w.sector_per10k, 1), n(w.others_per10k, 1)]) } },
      { heading: "Press releases against blogs, within the same brands", paragraphs: [`Press releases minus the same brand's blog posts, averaged over the ${cnt(pv.brands)} ${M.plural} with at least five of each (95% interval in brackets).`], table: { columns: ["Measure", "Difference"], rows: Object.entries(PVB).filter(([key]) => pv[key]).map(([key, m]) => [m.label, ciCell(pv[key], m.scale ?? 1, m.d) + (m.scale ? " points" : "")]) } },
      ...(ba.brands >= 2 ? [{ heading: "Before and after ChatGPT, within the sector (exploratory)", paragraphs: [baText], table: { columns: ["Measure", "2019 to Nov 2022", "2024 on", "Change (95% interval)"], rows: Object.entries(BA).map(([key, l]) => [l, n(ba[key].before, 2), n(ba[key].after, 2), ciCell(ba[key])]) } }] : []),
    ],
    limitations: [
      `${d.brands} brands. A sector average can move with one or two brands; the brand range column shows the spread.`,
      "Pages are what each brand publishes on its own sites. Brands that publish little have few pages.",
      "Counts of surface habits only. They describe style, not quality.",
      "Descriptive. Differences from other sectors are reported without significance tests.",
    ],
    reproducibility: ["Scripts: scripts/experiments/brand-series/sectors.mjs, sector-charts.mjs and sector-entry.mjs in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research).", "Every page's URL, brand, sector and measures are in the brand writing dataset below."],
    dataDownloads: [
      { label: "Summary: all six sector reports, habits, ranks, years, intervals (JSON)", path: "/research/sgr-sectors-summary.json", format: "json" },
      { label: "Every page in the brand writing series, with its measures (CSV)", path: "/research/brand-writing-pages.csv", format: "csv" },
    ],
    license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    howToCite: `ScriptGrain (2026). ${TITLE} (Study ${M.id}, conducted 5 October 2026). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${M.slug}`,
    citations: [
      { name: "ScriptGrain (2026). How do UK brands write? (SGR-010)", url: "https://scriptgrain.com/research/how-uk-brands-write" },
      { name: "ScriptGrain (2026). Did brand writing change after ChatGPT? (SGR-011)", url: "https://scriptgrain.com/research/did-brand-writing-change-after-chatgpt" },
    ],
  };
  studies.push(study);
});

const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
for (const study of studies) { const i = data.studies.findIndex((x) => x.id === study.id); if (i === -1) data.studies.push(study); else data.studies[i] = study; }
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
copyFileSync(dir + "summary-sectors.json", "public/research/sgr-sectors-summary.json");
if (args.includes("--print")) for (const s of studies) console.log(JSON.stringify({ id: s.id, title: s.title, publishOn: s.publishOn, abstract: s.abstract.map((a) => a.text), keyNumbers: s.keyNumbers, findings: s.findings.map((f) => [f.label, f.value]), notShown2: s.notShown[2] }, null, 1));
console.error("sector reports written:", studies.map((s) => `${s.id} ${s.publishOn}`).join(", "));
