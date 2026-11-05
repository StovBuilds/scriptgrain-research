#!/usr/bin/env bun
// Brand writing series: write the SGR-010 and SGR-011 entries in src/data/research-pages.json
// from the analysis summaries, so every number on the pages is the run's number.
//   bun scripts/experiments/brand-series/write-entry.mjs --publish-on YYYY-MM-DD
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PUBLISH_ON = opt("--publish-on");
if (!PUBLISH_ON) throw new Error("--publish-on required");
const dir = new URL(".", import.meta.url).pathname;
// Correction notes (2026-10-05, corpus v1.4): pass --updated-on and --old-010/--old-011 (the
// summaries as first published) to add a dated note listing every headline figure that moved.
const UPDATED_ON = opt("--updated-on", null);
const OLD10 = opt("--old-010", null) ? JSON.parse(readFileSync(opt("--old-010"), "utf8")) : null;
const OLD11 = opt("--old-011", null) ? JSON.parse(readFileSync(opt("--old-011"), "utf8")) : null;
const A = JSON.parse(readFileSync(dir + "summary-010.json", "utf8"));
const S = JSON.parse(readFileSync(dir + "summary-011.json", "utf8"));
const LEX = JSON.parse(readFileSync(dir + "../sgr-007/lexicons.json", "utf8"));
const { _readme: _r, ...ANALYSTS } = JSON.parse(readFileSync(dir + "../shared/analysts.json", "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f1 = (x) => n(x, 1), f2 = (x) => n(x, 2), f3 = (x) => n(x, 3);
const pct = (x) => `${Math.round(x * 100)}%`;
const rel = (d, base) => Math.round((100 * d) / base);
const sg = (x) => (x > 0 ? "+" : x < 0 ? "−" : "");
const num = (x, d) => `${x < 0 ? "−" : ""}${n(Math.abs(x), d)}`;
const ci = (h, d = 2) => `${sg(h.point)}${n(Math.abs(h.point), d)} (95% interval ${num(h.lo, d)} to ${num(h.hi, d)})`;
// for use inside parentheses: no nested brackets
const ciIn = (h, d = 2) => `${sg(h.point)}${n(Math.abs(h.point), d)}, 95% interval ${num(h.lo, d)} to ${num(h.hi, d)}`;
const verdict = (v) => (v === "supported" ? "Supported" : v === "reversed" ? "Reversed" : "Not supported");
const SECTOR = { bank: "banks", energy: "energy", telecom: "telecoms", software: "software", grocery: "supermarkets", travel: "travel", insurance: "insurance", fashion: "fashion", charity: "charities", food: "food and drink" };
// Show whole words only: a stem such as "enhanc*" (any ending) would read as a typo.
const WHOLE = new Set(["seamless", "elevate", "unlock", "empower", "streamline", "supercharge", "unleash", "effortless", "comprehensive", "significant", "harness", "embark", "delve", "intricate", "meticulous"]);
const listWords = (k) => LEX[k].map((w) => (w.endsWith("*") ? (WHOLE.has(w.slice(0, -1)) ? w.slice(0, -1) : null) : w)).filter(Boolean).slice(0, 8).map((w) => `"${w}"`).join(", ");
const analystBlock = { analyst: ANALYST };
const methodsShared = [
  "Corpus: the brand deep corpus (October 2026): blog posts, press releases, product announcements and information packs from 122 UK consumer brands in 10 sectors, sampled by fixed rules from each brand's own sites, plus 4,845 archived pages from before ChatGPT's launch read from the Wayback Machine as they were published. Scripts and the full method: scripts/experiments/brand-corpus/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research).",
  "Text measured: each page's main content (Firecrawl markdown) reduced to plain text, so menus and footers do not count. Pages under 150 words, exact duplicates within a brand, and pages where more than 40% of the words sit in lines of six words or fewer (link lists, menus) were excluded.",
  "Measures: computed in code by ScriptGrain's own instruments, the same counts the free tools run. No language model read or scored any page.",
  "Pre-registration: the hypotheses, eras, exclusions and tests for this series were committed to [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research) before any page was measured (docs/research/brand-series-preregistration.md). One rule was changed before any result was looked at, and the file records why.",
];
const notShownShared = [
  "That any page, or any brand, used AI to write. Word counts show style; humans used these words before ChatGPT and keep using them.",
  "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
];

// ── SGR-010 ─────────────────────────────────────────────────────────────────
const BL = A.byCategory.blog, PR = A.byCategory.press;
const PVB = A.pressVsBlog;
const sectors = Object.entries(A.bySector).map(([s, m]) => ({ s, sl: m.avg_sentence_length.brand_weighted_mean, you: m.you_share.brand_weighted_mean, con: m.contractions_per1000.brand_weighted_mean, ai: m.ai_ism_per1000.brand_weighted_mean, em: m.em_dash_per1000.brand_weighted_mean, brands: m.words.brands, pages: m.words.pages }));
const by = (k, dir = -1) => [...sectors].sort((a, b) => dir * (a[k] - b[k]));
const SLUG10 = "how-uk-brands-write";
const TITLE10 = `How do UK brands write? ${n(A.pages)} blog posts and press releases, measured`;
const s010 = {
  id: "SGR-010", slug: SLUG10, title: TITLE10,
  seoTitle: `How UK brands write: ${n(A.pages)} brand blog posts and press releases measured · ScriptGrain Research`,
  question: "What is normal in the long-form writing of UK brands, by sector and by channel, and does a brand write the same way in its press releases as on its blog?",
  conductedOn: "2026-10-05", publishOn: PUBLISH_ON,
  description: `A baseline for brand writing: ${n(A.pages)} blog posts, press releases, announcements and reports from ${A.brands} UK brands in 10 sectors, 2015 to 2026, measured with ScriptGrain's instruments. Typical ranges for sentence length, "you", contractions, dashes and AI-associated words by sector and channel, two pre-registered comparisons, and a free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: "Brand voice is usually described in adjectives: warm, clear, human. There are few published numbers for how brands actually write, and none we know of that compare one brand's channels with each other using the same instrument." },
    { label: "What we did", text: `We gathered the blog posts, press releases, announcements and reports of ${A.brands} UK consumer brands, banks to charities, from their own sites and from the Wayback Machine (${n(A.counts.bySource.wayback)} archived pages from 2015 to 2022), and measured every page of 150 words or more with ScriptGrain's code. We fixed two comparisons before measuring, each testing a brand against itself.` },
    { label: "What we found", text: `Press releases ran ${f1(A.O1.point)} words longer per sentence than the same brand's blog posts (${rel(PVB.avg_sentence_length.point, BL.avg_sentence_length.brand_weighted_mean)}% longer), used ${Math.abs(rel(PVB.contractions_per1000.point, BL.contractions_per1000.brand_weighted_mean))}% fewer contractions and ${Math.abs(rel(PVB.questions_per1000.point, BL.questions_per1000.brand_weighted_mean))}% fewer questions, and spoke to "you" far less: "you" made up ${pct(PR.you_share.brand_weighted_mean)} of I, we and you in press releases and ${pct(BL.you_share.brand_weighted_mean)} on blogs. Sectors differed as much as channels: insurance brands wrote most to "you" (${pct(by("you")[0].you)}), supermarkets least (${pct(by("you", 1)[0].you)}); fashion wrote the shortest sentences (${f1(by("sl", 1)[0].sl)} words) and energy and supermarkets the longest.` },
    { label: "What it means", text: "A brand does not have one written voice. Its press office and its blog write measurably differently, and the sector sets much of the baseline. The tables give a normal range for each habit, by channel and sector, so a figure from any brand page can be read against what is typical for its kind." },
  ],
  keyNumbers: [
    `UK brands' press releases averaged ${f1(PR.avg_sentence_length.brand_weighted_mean)} words per sentence, against ${f1(BL.avg_sentence_length.brand_weighted_mean)} on their blogs (ScriptGrain, 2026; ${n(A.pages)} pages from ${A.brands} brands).`,
    `Within the same brand, press releases ran ${f1(A.O1.point)} words longer per sentence than blog posts (95% interval ${f1(A.O1.lo)} to ${f1(A.O1.hi)}; ${A.O1.n} brands).`,
    `"You" made up ${pct(BL.you_share.brand_weighted_mean)} of the words I, we and you on UK brand blogs, and ${pct(PR.you_share.brand_weighted_mean)} in the same brands' press releases.`,
    `UK brand press releases asked ${Math.abs(rel(PVB.questions_per1000.point, BL.questions_per1000.brand_weighted_mean))}% fewer questions and used ${Math.abs(rel(PVB.contractions_per1000.point, BL.contractions_per1000.brand_weighted_mean))}% fewer contractions than the same brands' blog posts.`,
    `Insurance brands wrote to "you" the most of ten UK sectors (${pct(by("you")[0].you)} of I, we and you); supermarkets the least (${pct(by("you", 1)[0].you)}).`,
    `Fashion brands wrote the shortest sentences of ten UK sectors (${f1(by("sl", 1)[0].sl)} words on average); ${SECTOR[by("sl")[0].s]} the longest (${f1(by("sl")[0].sl)}).`,
    `Software brands used AI-associated words most (${f2(by("ai")[0].ai)} per 1,000 words), ${f1(by("ai")[0].ai / by("ai", 1)[0].ai)} times as often as ${SECTOR[by("ai", 1)[0].s]} (${f2(by("ai", 1)[0].ai)}).`,
  ],
  measures: [
    { term: "Average sentence length", definition: "Words per sentence, from ScriptGrain's sentence splitter, averaged over a page." },
    { term: '"You" share', definition: "Uses of you, your and yours as a share of all uses of I, we and you words on the page. 100% means every personal pronoun addressed the reader." },
    { term: "Contractions", definition: "Words such as don't, we're and it's per 1,000 words." },
    { term: "AI-associated words", definition: `Uses per 1,000 words of three published word lists, each occurrence counted once: the 2024 words studies of scientific writing found language models over-use (${listWords("OLD")}…), words publicly mocked as ChatGPT tells, and AI-era marketing words (${listWords("MARKETING")}…). The same measure as [SGR-007](/research/where-did-ai-isms-come-from). Humans use all of these words; the rate says nothing about who wrote a page.` },
    { term: "Brand-weighted", definition: "Each brand's pages are averaged first, then brands are averaged, so a brand with many pages does not dominate a sector or a channel." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of brands, drawn within each sector." },
  ],
  ...analystBlock,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The comparisons, measures and exclusions were committed to ScriptGrain's research repository (public on GitHub) before any page was measured, and the data and scripts are public.",
  notShown: [...notShownShared, "Whether one way of writing works better than another. Nothing here measures readers, sales or search."],
  productNote: "ScriptGrain measures writing voice, the habits that make a writer recognisable. Every measure in this study is a count the free tools also run, such as the [AI cliché checker](/tools/ai-cliche-checker). This study describes how brands write; it is not a test of who, or what, wrote any page.",
  sample: {
    description: `The brand deep corpus (October 2026): ${A.brands} UK consumer brands in 10 sectors (banks, energy, telecoms, software, supermarkets, travel, insurance, fashion, charities, food and drink). For each, blog posts, press releases, product announcements and information packs found on its own sites by fixed URL rules and fetched on 4 and 5 October 2026, plus archived pages from 2015 to November 2022. ${n(A.counts.bySource.live)} live and ${n(A.counts.bySource.wayback)} archived pages were measured.`,
    size: A.pages,
    inclusionCriteria: ["Written by the brand on its own site or newsroom (customer forums, help centres and other languages excluded)", "At least 150 words of main text", "Not a link list or menu (no more than 40% of words in lines of six words or fewer)"],
    exclusions: ["Exact duplicates within a brand", "Brand names are in the data file; the page reports sectors and channels only", "No page text is published"],
  },
  method: methodsShared,
  variablesMeasured: ["Average sentence length", "Sentence-length variation", '"You", "we" and "I" shares', "Contractions per 1,000 words", "Commas per sentence", "Questions and exclamation marks per 1,000 words", "Long-word share", "Em dashes per 1,000 words", "AI-associated words per 1,000 words", "AI sentence shapes per 1,000 words"],
  findings: [
    { label: `O1 (${verdict(A.O1.result).toLowerCase()}): press releases use longer sentences than the same brand's blog`, value: `${ci(A.O1, 1)} words per sentence`, explanation: `In ${A.O1.n} brands with at least 10 press releases and 10 blog posts each, the press release sentence was longer in the brand average. Press releases also used ${rel(PVB.long_word_share.point, BL.long_word_share.brand_weighted_mean)}% more long words and ${rel(PVB.commas_per_sentence.point, BL.commas_per_sentence.brand_weighted_mean)}% more commas per sentence.` },
    { label: `O2 (${verdict(A.O2.result).toLowerCase()}): blogs speak to "you" more than the same brand's press releases`, value: `${sg(A.O2.point)}${Math.round(A.O2.point * 100)} points of the I, we and you mix (95% interval ${Math.round(A.O2.lo * 100)} to ${Math.round(A.O2.hi * 100)})`, explanation: `Press releases are written about the company ("we", the brand name) and blogs to the reader. Questions follow the same split: blog posts asked ${f1(1 / (1 + PVB.questions_per1000.point / BL.questions_per1000.brand_weighted_mean))} times as many questions as press releases.` },
    { label: "Exploratory: AI-associated words are more common in press releases", value: `${f2(PR.ai_ism_per1000.brand_weighted_mean)} per 1,000 words in press releases, ${f2(BL.ai_ism_per1000.brand_weighted_mean)} on blogs`, explanation: `Within the same brands, press releases used ${rel(PVB.ai_ism_per1000.point, BL.ai_ism_per1000.brand_weighted_mean)}% more of the listed words (95% interval ${rel(PVB.ai_ism_per1000.lo, BL.ai_ism_per1000.brand_weighted_mean)}% to ${rel(PVB.ai_ism_per1000.hi, BL.ai_ism_per1000.brand_weighted_mean)}%). That matches [SGR-007](/research/where-did-ai-isms-come-from), which found press releases were the densest home of these words before ChatGPT existed.` },
    { label: "Exploratory: sectors write differently", value: `"You" from ${pct(by("you", 1)[0].you)} (${SECTOR[by("you", 1)[0].s]}) to ${pct(by("you")[0].you)} (${SECTOR[by("you")[0].s]}); sentences from ${f1(by("sl", 1)[0].sl)} to ${f1(by("sl")[0].sl)} words`, explanation: `Sectors that sell to individuals over the phone and online (insurance, software, telecoms) wrote most to "you". Supermarkets and charities wrote most about themselves and their work. Food and drink brands used the most contractions (${f1(by("con")[0].con)} per 1,000 words). Sector figures rest on 8 to 18 brands each and carry no intervals.` },
  ],
  sections: [
    { heading: "Press release against blog post", figure: { src: "/research/sgr-010-press-vs-blog.svg", alt: `Dot chart of within-brand differences: press releases have longer sentences (+${rel(PVB.avg_sentence_length.point, BL.avg_sentence_length.brand_weighted_mean)}%), more commas, fewer contractions, a lower 'you' share and far fewer questions than the same brand's blog posts.`, caption: "Source: ScriptGrain SGR-010, CC BY 4.0.", width: 760, height: 384 } },
    { heading: "How each sector writes", figure: { src: "/research/sgr-010-sectors.svg", alt: `Scatter chart of ten sectors by average sentence length and 'you' share: insurance highest on 'you', supermarkets lowest; fashion shortest sentences.`, caption: "Source: ScriptGrain SGR-010, CC BY 4.0.", width: 760, height: 460 } },
    { heading: "Pre-registered comparisons", table: { columns: ["Comparison", "Result", "Within-brand difference", "Brands"], rows: [
      ["O1: press releases have longer sentences than the same brand's blog posts", verdict(A.O1.result), `${ci(A.O1, 1)} words`, String(A.O1.n)],
      ["O2: blog posts have a higher 'you' share than the same brand's press releases", verdict(A.O2.result), `${sg(A.O2.point)}${Math.round(A.O2.point * 100)} points (${Math.round(A.O2.lo * 100)} to ${Math.round(A.O2.hi * 100)})`, String(A.O2.n)],
    ] } },
    { heading: "Typical ranges by channel", paragraphs: ["Middle 50% of brands (25th to 75th percentile of brand averages), and the median brand."], table: { columns: ["Measure", "Blog: median brand", "Blog: middle 50%", "Press: median brand", "Press: middle 50%"], rows: [
      ["Average sentence length (words)", "avg_sentence_length", 1], ['"You" share', "you_share", "%"], ["Contractions per 1,000 words", "contractions_per1000", 1], ["Commas per sentence", "commas_per_sentence", 2], ["Questions per 1,000 words", "questions_per1000", 1], ["Exclamation marks per 1,000 words", "exclamations_per1000", 1], ["Em dashes per 1,000 words", "em_dash_per1000", 1], ["AI-associated words per 1,000 words", "ai_ism_per1000", 2], ["Long-word share (7+ letters)", "long_word_share", "%"], ["Words per page", "words", 0],
    ].map(([l, k, d]) => { const fm = (v) => (d === "%" ? pct(v) : n(v, d)); const b = BL[k].brand_mean_p, p = PR[k].brand_mean_p; return [l, fm(b[2]), `${fm(b[1])} to ${fm(b[3])}`, fm(p[2]), `${fm(p[1])} to ${fm(p[3])}`]; }) } },
    { heading: "By sector", paragraphs: ["Blog posts and press releases together, brand-weighted."], table: { columns: ["Sector", "Brands", "Pages", "Words per sentence", '"You" share', "Contractions per 1,000", "Em dashes per 1,000", "AI-associated words per 1,000"], rows: by("you").map((x) => [SECTOR[x.s], String(x.brands), n(x.pages), f1(x.sl), pct(x.you), f1(x.con), f1(x.em), f2(x.ai)]) } },
    { heading: "What was measured", table: { columns: ["", "Pages"], rows: [["Blog posts", n(A.counts.byCategory.blog)], ["Press releases", n(A.counts.byCategory.press)], ["Product announcements", n(A.counts.byCategory.announcement)], ["Information packs (PDF, first 25 pages)", n(A.counts.byCategory.info_pack)], ["Live pages (fetched October 2026)", n(A.counts.bySource.live)], ["Archived pages (2015 to November 2022)", n(A.counts.bySource.wayback)], ["Dated before 2019", n(A.counts.byEra.PRE2015 + A.counts.byEra.EARLY)], ["Dated 2019 to November 2022", n(A.counts.byEra.LATE)], ["Dated December 2022 to 2023", n(A.counts.byEra.TRANSITION)], ["Dated 2024 to 2026", n(A.counts.byEra.AFTER)], ["No date found", n(A.counts.byEra.undated)]] } },
  ],
  limitations: ["Pages were chosen by fixed URL rules from what each brand publishes, not at random, and brands publish very different amounts.", "Ten sectors of UK consumer brands; business-to-business brands, public bodies and other countries are not covered.", "Every measure is a count of surface features. None says whether writing is good, effective or on-brand.", "Sector figures rest on 8 to 18 brands each."],
  reproducibility: ["Pre-registration and scripts: docs/research/brand-series-preregistration.md and scripts/experiments/brand-series/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research); corpus scripts in scripts/experiments/brand-corpus/.", "Every page is named by URL (and archive capture time where archived), so any page can be fetched and measured again."],
  dataDownloads: [
    { label: "Every page measured: brand, sector, channel, URL, date, every measure (CSV)", path: "/research/brand-writing-pages.csv", format: "csv" },
    { label: "Summary: percentiles by channel and sector, comparisons, intervals (JSON)", path: "/research/sgr-010-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE10} (Study SGR-010, conducted 5 October 2026). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${SLUG10}`,
  citations: [
    { name: "ScriptGrain (2026). Where did AI-isms come from? (SGR-007)", url: "https://scriptgrain.com/research/where-did-ai-isms-come-from" },
    { name: "Internet Archive Wayback Machine", url: "https://web.archive.org/" },
  ],
};

// ── SGR-011 ─────────────────────────────────────────────────────────────────
const H1 = S.H1, H2 = S.H2, H3 = S.H3, H4 = S.H4, H5 = S.H5, AM = S.allMeasures, BC = S.byCategory;
const pc = (h) => rel(h.point, h.late_mean);
const yrs = S.byYear;
const peakYear = Object.entries(yrs).filter(([y]) => +y >= 2023).reduce((a, b) => (b[1].ai_ism_per1000 > a[1].ai_ism_per1000 ? b : a));
const pre = ["2019", "2020", "2021", "2022"].map((y) => yrs[y].ai_ism_per1000);
const preMean = pre.reduce((a, b) => a + b, 0) / pre.length;
const SLUG11 = "did-brand-writing-change-after-chatgpt";
const TITLE11 = `Did brand writing change after ChatGPT? ${H1.n} UK brands, before and after`;
const s011 = {
  id: "SGR-011", slug: SLUG11, title: TITLE11,
  seoTitle: `Did brand writing change after ChatGPT? ${H1.n} UK brands measured before and after · ScriptGrain Research`,
  question: "Within the same brands, did blog posts and press releases written after ChatGPT use more of the words and habits associated with AI writing than those written before it?",
  conductedOn: "2026-10-05", publishOn: PUBLISH_ON,
  description: `A pre-registered before-and-after study of UK brands' own writing: each brand's blog posts and press releases from 2019 to 2022, read as published from the Wayback Machine, against the same brand's writing from 2024 to 2026. AI-associated words rose ${pc(H1)}%; em dashes, AI sentence shapes and sentence length did not change. Free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: "Readers say company writing has started to sound like ChatGPT: the same words, the same dashes, the same tidy sentences. That claim is usually made from impressions. Measuring it needs the same brands' writing from before ChatGPT, as it was published then, not as it reads after later edits." },
    { label: "What we did", text: `We fixed five hypotheses before measuring anything. For UK brands with at least 10 pages from 2019 to November 2022 and at least 10 from 2024 to 2026 in the same channel (blog or press), we compared each brand with itself: the before pages read from the Wayback Machine as they were archived, the after pages from the live sites in October 2026. ${H1.n} brands qualified, across ${H1.cells} brand-channel pairs. Every page was measured in code by ScriptGrain's instruments.` },
    { label: "What we found", text: `AI-associated words rose ${pc(H1)}% within the same brands (${f2(H1.late_mean)} to ${f2(H1.after_mean)} per 1,000 words). The rise came from marketing words such as "seamless", "unlock" and "journey" and quieter ones such as "crucial" and "enhance", not from the famous tells: the 2024 words such as "delve" and "tapestry" rose less, and within chance. It was not clearly faster than the slow climb these words were already on from 2015 to 2022. Em dashes, AI-style sentence shapes and sentence length did not change. By calendar year, the words peaked in ${peakYear[0]} and fell back in 2026.` },
    { label: "What it means", text: "Brand writing did shift after ChatGPT, but in vocabulary, not punctuation or sentence structure, and partly along a trend that started years earlier. The habits people most often point to as signs of AI writing, the em dash above all, did not change in these brands' writing. A rise in a word list describes style; it does not show who, or what, wrote any page." },
  ],
  keyNumbers: [
    `UK brands' blog posts and press releases used ${pc(H1)}% more AI-associated words in 2024 to 2026 than the same brands' writing from 2019 to 2022 (ScriptGrain, 2026; ${H1.n} brands, pre-registered).`,
    `Marketing words such as "seamless", "unlock" and "journey" rose ${pc(AM.marketing_per1000)}% in UK brands' writing after ChatGPT; the 2024 tells such as "delve" did not rise beyond chance.`,
    `Em dashes did not rise beyond chance in UK brands' writing after ChatGPT: ${f2(H3.late_mean)} per 1,000 words before and ${f2(H3.after_mean)} after, within the same ${H3.n} brands.`,
    `AI-associated words in UK brand writing peaked in ${peakYear[0]} at ${f2(peakYear[1].ai_ism_per1000)} per 1,000 words, against ${f2(preMean)} in 2019 to 2022, and fell to ${f2(yrs["2026"].ai_ism_per1000)} in 2026.`,
    `The rise in AI-associated words came from brand blogs (+${pc(BC.blog.ai_ism_per1000)}%), not press releases, where the change was within chance.`,
    `Sentence shapes associated with AI writing, such as "not X but Y", did not rise beyond chance in UK brands' writing after ChatGPT (${f2(H4.late_mean)} to ${f2(H4.after_mean)} per 1,000 words).`,
  ],
  measures: [
    { term: "Before and after", definition: "Before: pages published from January 2019 to November 2022 (ChatGPT launched on 30 November 2022). After: January 2024 to October 2026. 2023 is left out of the main test as a transition year and reported separately. The 2015 to 2018 pages are used only to test whether the change is a continuing trend." },
    { term: "Within-brand change", definition: "For each brand and channel (blog, or press releases and announcements together), the average after a page minus the average before; then averaged over brands, each brand counting once. A brand is compared only with itself, so a shift in which brands are measured cannot create a trend." },
    { term: "AI-associated words", definition: `Uses per 1,000 words of three published word lists, each occurrence counted once: the 2024 words studies of scientific writing found language models over-use (${listWords("OLD")}…), words publicly mocked as ChatGPT tells, and AI-era marketing words (${listWords("MARKETING")}…). The same measure as [SGR-007](/research/where-did-ai-isms-come-from). A separate list of quieter words (${listWords("QUIET")}…) is reported on its own.` },
    { term: "AI sentence shapes", definition: "The free [AI cliché checker](/tools/ai-cliche-checker)'s scan for 'not X but Y' balancing, reflexive lists of three, chains of semicolons and stock phrases, per 1,000 words." },
    { term: "Dates", definition: "From the page's own metadata, its structured data, its URL, or (for archived pages) the month it was first archived, which is a latest possible date. Dates guessed from the page text are left out of the main test and added back in a sensitivity check." },
    { term: "95% interval", definition: "From 2,000 bootstrap resamples of brands, drawn within each sector. A hypothesis counts as supported only if the interval excludes zero in the predicted direction (for H5, if the 90% interval sits inside ±1.5 words)." },
  ],
  ...analystBlock,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, eras, measures and tests were committed to ScriptGrain's research repository (public on GitHub) before any page was measured, every result is reported whether it passed or failed, and the data and scripts are public.",
  notShown: [...notShownShared, "Why the words rose. Writers read AI-written text, agencies and tools changed, and topics shifted (more about AI itself); this study measures the change, not its cause."],
  productNote: "ScriptGrain measures writing voice, the habits that make a writer recognisable, and its free [AI cliché checker](/tools/ai-cliche-checker) runs the sentence-shape scan used here. This study is about how brand writing changed; it is not a test of who, or what, wrote any page.",
  sample: {
    description: `UK consumer brands from the brand deep corpus (October 2026) with at least 10 dated pages in the same channel both before (2019 to November 2022) and after (2024 to 2026): ${H1.n} brands and ${H1.cells} brand-channel pairs. Before pages are mostly the archived originals from the Wayback Machine; after pages come from the brands' live sites, fetched on 4 and 5 October 2026.`,
    size: H1.cells,
    inclusionCriteria: ["Blog posts, press releases and product announcements on the brand's own sites", "At least 150 words of main text; link lists and menus excluded", "A date from metadata, structured data, the URL or the archive capture", "At least 10 pages before and 10 after in the same brand and channel"],
    exclusions: ["2023 pages (transition year) in the main test", "Pages dated only from their text, in the main test", "Information packs (PDFs)"],
  },
  method: [...methodsShared, "Tests: within-brand change in brand-weighted means, with 95% intervals from 2,000 bootstrap resamples of brands within sectors (fixed seed). H2 compares the per-year rate of change from 2015-18 to 2019-22 with that from 2019-22 to 2024-26, for brands with all three eras. Analyses beyond H1 to H5 are labelled exploratory."],
  variablesMeasured: ["AI-associated words per 1,000 words (and each word list)", "AI sentence shapes per 1,000 words", "Em dashes per 1,000 words", "Average sentence length", "Contractions per 1,000 words", '"You" share'],
  findings: [
    { label: `H1 (${verdict(H1.result).toLowerCase()}): AI-associated words rose within the same brands`, value: `${ci(H1)} per 1,000 words, ${sg(pc(H1))}${Math.abs(pc(H1))}%`, explanation: `From ${f2(H1.late_mean)} to ${f2(H1.after_mean)} per 1,000 words across ${H1.n} brands. By word list: AI-era marketing words ${sg(pc(AM.marketing_per1000))}${Math.abs(pc(AM.marketing_per1000))}% (interval clears zero), the quieter LLM-favoured words ${sg(pc(AM.quiet_per1000))}${Math.abs(pc(AM.quiet_per1000))}% (clears zero), the 2024 tells such as "delve" ${sg(pc(AM.old_per1000))}${Math.abs(pc(AM.old_per1000))}% and the publicly mocked words ${sg(pc(AM.called_out_per1000))}${Math.abs(pc(AM.called_out_per1000))}% (neither clears zero).` },
    { label: `H2 (${verdict(H2.result).toLowerCase()}): the rise was not clearly a break from the trend before`, value: `${f3(H2.late_to_after_per_year)} per 1,000 words a year after, against ${f3(H2.early_to_late_per_year)} a year from 2015-18 to 2019-22`, explanation: `For the ${H2.n} brands with pages in all three eras, the yearly rise after ChatGPT was larger, but the difference (${ciIn(H2, 3)}) includes zero. These words were already climbing in brand writing before ChatGPT, as [SGR-007](/research/where-did-ai-isms-come-from) found in books and the web. The calendar-year series below shows a sharper jump in 2023 and 2024 than this per-year test can resolve.` },
    { label: `H3 (${verdict(H3.result).toLowerCase()}): em dashes did not rise`, value: `${f2(H3.late_mean)} to ${f2(H3.after_mean)} per 1,000 words; change ${ci(H3)}`, explanation: `Despite the 'ChatGPT dash' reputation, brand writing used em dashes at the same rate after ChatGPT as before. Exploratory: press releases did gain dashes (${ciIn(BC.press.em_dash_per1000)}), blog posts did not (${ciIn(BC.blog.em_dash_per1000)}).` },
    { label: `H4 (${verdict(H4.result).toLowerCase()}): AI sentence shapes did not rise`, value: `${f2(H4.late_mean)} to ${f2(H4.after_mean)} per 1,000 words; change ${ci(H4)}`, explanation: "'Not X but Y' constructions, reflexive lists of three and the cliché checker's stock phrases were as rare after ChatGPT as before." },
    { label: `H5 (${verdict(H5.result).toLowerCase()}): sentence length stayed within 1.5 words`, value: `${f1(H5.late_mean)} to ${f1(H5.after_mean)} words; change ${ci(H5, 2)}`, explanation: `The 90% interval (${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}) sits inside ±1.5 words. Sentences got slightly shorter, if anything.` },
    { label: "Robustness: the result held under every pre-registered check", value: `H1 with text dates added ${ci(S.withGuessedDates.ai_ism_per1000)}; with 2023 counted as after ${ci(S.transitionAsAfter.ai_ism_per1000)}`, explanation: `Archived and live copies of 2019-22 pages (${S.sourceCheck.ai_ism_per1000.n} brands with both) used AI-associated words at the same rate (difference ${ciIn(S.sourceCheck.ai_ism_per1000)}), so mixing archived before-pages with live after-pages does not create the rise. Live copies did carry fewer em dashes (${ciIn(S.sourceCheck.em_dash_per1000)}) and slightly longer sentences than their archived versions, a sign some old pages were edited since.` },
  ],
  sections: [
    { heading: "AI-associated words, year by year", paragraphs: ["Exploratory. Each year is the mean over the brands with pages that year, so the brand mix varies from year to year; the pre-registered tests above compare each brand only with itself."], figure: { src: "/research/sgr-011-by-year.svg", alt: `Line chart of AI-associated words per 1,000 words in UK brand writing by year: about 1 from 2017 to 2022, rising to ${f2(peakYear[1].ai_ism_per1000)} in ${peakYear[0]} and falling to ${f2(yrs["2026"].ai_ism_per1000)} in 2026.`, caption: "Source: ScriptGrain SGR-011, CC BY 4.0.", width: 760, height: 380 } },
    { heading: "What changed, within the same brands", figure: { src: "/research/sgr-011-change.svg", alt: `Dot chart of within-brand change from 2019-22 to 2024-26: AI-associated words +${pc(H1)}% with an interval clear of zero; em dashes, AI sentence shapes and sentence length close to zero.`, caption: "Source: ScriptGrain SGR-011, CC BY 4.0.", width: 760, height: 288 } },
    { heading: "Pre-registered hypotheses and results", table: { columns: ["Hypothesis", "Result", "Within-brand change (95% interval)"], rows: [
      ["H1: AI-associated words rose", verdict(H1.result), `${ci(H1)} per 1,000 words`],
      ["H2: the rise after ChatGPT was faster than the trend before it", verdict(H2.result), `${ci(H2, 3)} per 1,000 words a year`],
      ["H3: em dashes rose", verdict(H3.result), `${ci(H3)} per 1,000 words`],
      ["H4: AI sentence shapes rose", verdict(H4.result), `${ci(H4)} per 1,000 words`],
      ["H5: average sentence length changed by less than 1.5 words", verdict(H5.result), `${ci(H5)} words; 90% interval ${num(H5.lo90, 2)} to ${num(H5.hi90, 2)}`],
    ] } },
    { heading: "By word list and habit", paragraphs: ["Within-brand change from 2019-22 to 2024-26, same brands as H1."], table: { columns: ["Measure", "Before", "After", "Change (95% interval)"], rows: [["AI-associated words (H1)", "ai_ism_per1000", 2], ["AI-era marketing words", "marketing_per1000", 2], ["Quieter LLM-favoured words", "quiet_per1000", 2], ["2024 tells (delve and others)", "old_per1000", 2], ["Publicly mocked ChatGPT words", "called_out_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 1], ["Contractions", "contractions_per1000", 1], ['"You" share', "you_share", 2], ["Sentence-length variation", "sentence_variation", 2]].map(([l, k, d]) => [l, n(AM[k].late_mean, d), n(AM[k].after_mean, d), ci(AM[k], d)]) } },
    { heading: "Blog posts and press releases separately", table: { columns: ["Measure", "Blog change (95% interval)", "Press change (95% interval)"], rows: [["AI-associated words", "ai_ism_per1000", 2], ["Em dashes", "em_dash_per1000", 2], ["AI sentence shapes", "ai_shape_per1000", 2], ["Average sentence length", "avg_sentence_length", 2]].map(([l, k, d]) => [l, `${ci(BC.blog[k], d)} (${BC.blog[k].n} brands)`, `${ci(BC.press[k], d)} (${BC.press[k].n} brands)`]) } },
    { heading: "Year by year", paragraphs: ["Exploratory; brand-weighted means of the brands with dated pages each year."], table: { columns: ["Year", "Pages", "Brands", "AI-associated words", "Em dashes", "AI sentence shapes", "Words per sentence"], rows: Object.entries(yrs).map(([y, v]) => [y, n(v.pages), String(v.brands), f2(v.ai_ism_per1000), f2(v.em_dash_per1000), f2(v.ai_shape_per1000), f1(v.avg_sentence_length)]) } },
    { heading: "By sector", paragraphs: ["Exploratory. Within-brand change in AI-associated words, sectors with at least 3 eligible brands."], table: { columns: ["Sector", "Brands", "Before", "After", "Change (95% interval)"], rows: Object.entries(S.bySector).filter(([, m]) => m.ai_ism_per1000.n >= 3).map(([s, m]) => [SECTOR[s], String(m.ai_ism_per1000.n), f2(m.ai_ism_per1000.late_mean), f2(m.ai_ism_per1000.after_mean), ci(m.ai_ism_per1000)]) } },
  ],
  limitations: ["Before pages are mostly archived copies and after pages are live. The source check above found no difference in AI-associated words between archived and live copies of the same era, but live copies had fewer em dashes, so the em dash comparison may understate any rise.", "A page's date is its publication date where the page says so, and otherwise the month it was first archived (a latest possible date).", "Word lists count spellings. These words rose in human writing for decades before ChatGPT, and topics shifted too: brands now write more about AI itself.", "Brands publish different amounts, and only brands with enough pages in both eras are in the test, which favours brands with active blogs and newsrooms.", "UK consumer brands only."],
  reproducibility: ["Pre-registration and scripts: docs/research/brand-series-preregistration.md and scripts/experiments/brand-series/ in [ScriptGrain's research repository](https://github.com/StovBuilds/scriptgrain-research); corpus scripts in scripts/experiments/brand-corpus/.", "Every archived page is named by URL and capture time, so any page can be fetched from the Wayback Machine and measured again."],
  dataDownloads: [
    { label: "Every page measured: brand, sector, channel, URL, date and date source, era, every measure (CSV)", path: "/research/brand-writing-pages.csv", format: "csv" },
    { label: "Summary: hypotheses, intervals, robustness checks, year series (JSON)", path: "/research/sgr-011-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE11} (Study SGR-011, conducted 5 October 2026). Dataset licensed CC BY 4.0. https://scriptgrain.com/research/${SLUG11}`,
  citations: [
    { name: "ScriptGrain (2026). Where did AI-isms come from? (SGR-007)", url: "https://scriptgrain.com/research/where-did-ai-isms-come-from" },
    { name: "ScriptGrain (2026). The AI tells moved (SGR-008)", url: "https://scriptgrain.com/research/the-ai-tells-moved" },
    { name: "ScriptGrain (2026). How do UK brands write? (SGR-010)", url: `https://scriptgrain.com/research/${SLUG10}` },
    { name: "Kobak, D. et al. (2025). Delving into LLM-assisted writing in biomedical publications through excess vocabulary. Science Advances", url: "https://doi.org/10.1126/sciadv.adt3813" },
    { name: "Internet Archive Wayback Machine", url: "https://web.archive.org/" },
  ],
};

const CORR_INTRO = "Correction, 5 October 2026: 322 of the pages first measured came from other organisations' websites that a discovery rule had mistaken for the brands' own (mostly a US news site taken as EE's newsroom, 219 pages; also Aviva's separately branded asset manager, a newsroom-software company named Octopus and a publisher named Notion Press). They were removed and every analysis was re-run with its pre-registered rules unchanged.";
if (UPDATED_ON && OLD10) {
  const o = OLD10, c = A;
  s010.updatedOn = UPDATED_ON;
  s010.sections.unshift({ heading: "Correction (5 October 2026)", paragraphs: [CORR_INTRO, `No result changed. Figures that moved: pages measured ${n(o.pages)} to ${n(c.pages)}; press release minus blog sentence length ${f1(o.O1.point)} to ${f1(c.O1.point)} words (${o.O1.n} to ${c.O1.n} brands); blog minus press 'you' share ${Math.round(o.O2.point * 100)} to ${Math.round(c.O2.point * 100)} points; telecoms 'you' share ${pct(o.bySector.telecom.you_share.brand_weighted_mean)} to ${pct(c.bySector.telecom.you_share.brand_weighted_mean)}. The first version's data is kept in the repository history.`] });
}
if (UPDATED_ON && OLD11) {
  const o = OLD11, c = S, p0 = (h) => rel(h.point, h.late_mean);
  s011.updatedOn = UPDATED_ON;
  s011.sections.unshift({ heading: "Correction (5 October 2026)", paragraphs: [CORR_INTRO, `No hypothesis changed outcome. Figures that moved: AI-associated words ${sg(p0(o.H1))}${Math.abs(p0(o.H1))}% to ${sg(p0(c.H1))}${Math.abs(p0(c.H1))}% within brand (${o.H1.n} to ${c.H1.n} brands); em dashes ${f2(o.H3.late_mean)} to ${f2(o.H3.after_mean)} became ${f2(c.H3.late_mean)} to ${f2(c.H3.after_mean)} per 1,000 words; the 2024 peak ${f2(o.byYear["2024"].ai_ism_per1000)} to ${f2(c.byYear["2024"].ai_ism_per1000)}. The first version's data is kept in the repository history.`] });
}
const PJ = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(PJ, "utf8"));
for (const st of [s010, s011]) { const i = data.studies.findIndex((x) => x.id === st.id); if (i === -1) data.studies.push(st); else data.studies[i] = st; }
writeFileSync(PJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error("SGR-010 + SGR-011 written; publishOn", PUBLISH_ON);
