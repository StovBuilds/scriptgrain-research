#!/usr/bin/env bun
// SGR-004 step 4: write the study entry in src/data/research-pages.json from the
// published summaries, so every number on the page is the run's number.
//
//   bun scripts/experiments/sgr-004/write-entry.mjs --publish-on YYYY-MM-DD
//
// Reads public/research/sgr-004-web-copy-summary.json (rendered pass) and
// sgr-004-web-copy-summary-raw.json (raw-HTML check). Upserts by id.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = opt("--dir", "public/research");
const PUBLISH_ON = opt("--publish-on", null);
if (!PUBLISH_ON) throw new Error("--publish-on required");
const S = JSON.parse(readFileSync(`${DIR}/sgr-004-web-copy-summary.json`, "utf8"));
const RAW = JSON.parse(readFileSync(`${DIR}/sgr-004-web-copy-summary-raw.json`, "utf8"));
const { sites: panelSites } = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));
const lex = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f2 = (x) => n(x, 2), f1 = (x) => n(x, 1);
const pct = (x) => `${Math.round(x * 100)}%`;
const Y = (y) => S.byYear.find((b) => b.year === y);
const RY = (y) => RAW.byYear.find((b) => b.year === y);
const pp = S.prePost, rp = RAW.prePost;
const st = S.stablePanel;
const SY = (y) => st.byYear.find((b) => b.year === y);
const ratio = (a, b) => (a > 0 ? b / a : null);
const measuredTotal = S.status.measured;
const sectors = [...new Set(panelSites.map((s) => s.sector))].length;

// Vocabulary movers, per 100,000 words, before vs after.
const v = S.vocab;
const per100k = (c, w) => (c * 1e5) / w;
const movers = (k) => [...new Set([...Object.keys(v[k].pre), ...Object.keys(v[k].post)])]
  .map((w) => ({ w, pre: per100k(v[k].pre[w] || 0, v.pre_words), post: per100k(v[k].post[w] || 0, v.post_words), cp: v[k].pre[w] || 0, cq: v[k].post[w] || 0 }))
  .sort((a, b) => (b.post - b.pre) - (a.post - a.pre));
const aiMovers = movers("ai_era");
const dotMovers = movers("dotcom");
const word = (w) => aiMovers.find((m) => m.w === w);

const style = pp.ai_era_style_per1000, full = pp.ai_era_vocab_per1000, dot = pp.dotcom_vocab_per1000;
const words = pp.words, contr = pp.contraction_frequency, tell = pp.ai_tell_per1000, sent = pp.avg_sentence_length;
const yFirst = S.byYear[0], yLast = S.byYear[S.byYear.length - 1];
const unlock = word("unlock*"), seamless = word("seamless*"), streamline = word("streamline*");
const TOPIC = ["ai-powered", "powered by ai"];
const lenX = yLast.words.median / yFirst.words.median;
const lenWord = lenX >= 3.2 ? "more than tripled" : lenX >= 2.8 ? "roughly tripled" : lenX >= 2.2 ? "more than doubled" : `grew by ${Math.round((lenX - 1) * 100)}%`;
const emPerYearBefore = ((Y(2022).share_with_em_only - yFirst.share_with_em_only) * 100) / (2022 - yFirst.year);
const emPerYearAfter = ((yLast.share_with_em_only - Y(2022).share_with_em_only) * 100) / (yLast.year - 2022);
const x = style.after_mean / style.before_mean;
const riseWord = x >= 2.5 ? `more than doubled` : x >= 1.95 ? "doubled" : x >= 1.7 ? "nearly doubled" : `rose by ${Math.round((x - 1) * 100)}%`;
const crossYear = S.byYear.find((b) => b.year > 2010 && b.ai_era_style_per1000.mean > b.dotcom_vocab_per1000.mean && S.byYear.filter((c) => c.year >= b.year).every((c) => c.ai_era_style_per1000.mean > c.dotcom_vocab_per1000.mean))?.year;

const SLUG = "did-chatgpt-change-how-companies-write";
// The accountable analyst (Jack, 2026-10-04: named analyst, findings kept apart from product claims).
const { _readme: _a, ...ANALYSTS } = JSON.parse(readFileSync(new URL("../shared/analysts.json", import.meta.url), "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];
const TITLE = "Did ChatGPT change how companies write? 27 years of homepages, measured";
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const SECTOR_NAMES = { software: "Software", hardware_electronics: "Hardware and electronics", retail: "Retail", finance: "Banking and finance", insurance: "Insurance", telecom_media: "Telecoms and media", travel: "Travel", consumer_brands: "Consumer brands", logistics_auto: "Logistics and cars", agencies_services: "Agencies and consultancies", web_saas_marketing: "Web and marketing tools" };
const sec = (k) => S.bySector.find((b) => b.sector === k);
const secs = [...S.bySector].sort((a, b) => b.ai_era_style.after_mean - a.ai_era_style.after_mean);
const secX = (b) => (b.ai_era_style.before_mean > 0 ? b.ai_era_style.after_mean / b.ai_era_style.before_mean : null);
const secsByRise = [...S.bySector].filter((b) => b.ai_era_style.sites >= 8 && secX(b)).sort((a, b) => secX(b) - secX(a));
const emSecs = [...S.bySector].sort((a, b) => b.recent_em_share - a.recent_em_share);

const study = {
  id: "SGR-004",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Did ChatGPT change how companies write? ${n(measuredTotal)} homepages, 2000 to 2026 · ScriptGrain Research`,
  question: "How has the writing on company homepages changed over 27 years, and did anything shift after ChatGPT arrived in November 2022?",
  conductedOn: "2026-10-04",
  publishOn: PUBLISH_ON,
  description: `${panelSites.length} long-lived company homepages, one Wayback Machine capture a year from 2000 to 2026, rendered as a visitor saw them and measured with the same instruments the product uses. ${n(measuredTotal)} homepages measured across ${n(S.sites_measured)} sites. The text was measured and discarded; only the numbers are published, as a free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: `Since ChatGPT launched in November 2022, people have said that the web "sounds like AI": the same words (seamless, unlock, elevate) and the same punctuation (the em dash) everywhere. Most of that is anecdote. This study measures it on the pages companies care most about, their homepages, across 27 years, so the change after 2022 can be seen against the two decades before it.` },
    { label: "What we did", text: `We fixed a panel of ${panelSites.length} long-lived UK and US company homepages in ${sectors} sectors, and two word lists, before measuring anything. For every site and every year from 2000 to 2026 we took the Wayback Machine's capture nearest 1 July, rendered it as a visitor would have seen it, kept only the prose (no menus, footers or scripts) and measured it with the same code ScriptGrain uses on writing every day. ${n(measuredTotal)} homepages had enough prose to measure. To separate a real change from a change in which sites were measured, every site was compared with itself: its homepages from 2019 to 2022 against its homepages from 2023 to 2026.` },
    { label: "What we found", text: `The words changed; the sentences did not. AI-era marketing vocabulary ${riseWord} after ChatGPT (${f2(style.before_mean)} to ${f2(style.after_mean)} uses per 1,000 words, up on ${style.sites_up} sites and down on ${style.sites_down}), and in ${crossYear} it overtook the dotcom vocabulary of "solutions" and "click here" that had led since 2000. But the rise began years before ChatGPT, the em dash had been spreading for two decades before it, and the sentence shapes people associate with AI writing did not increase at all. Homepages also ${lenWord} in length over the period.` },
    { label: "What it means", text: `On company homepages, the "AI voice" is mostly a vocabulary, and an older one than its name suggests: marketing was drifting towards these words long before a model could write them, and ChatGPT appears to have sped the drift up rather than started it. So, on homepages, these words on their own are weak evidence that a page was written with AI.` },
  ],
  keyNumbers: [
    `AI-era marketing words such as "seamless", "unlock" and "streamline" ${riseWord} on company homepages after ChatGPT: from ${f2(style.before_mean)} to ${f2(style.after_mean)} uses per 1,000 words, comparing each of ${style.sites} sites with itself (ScriptGrain, 2026).`,
    `The word "unlock" appeared ${f1(unlock.post / unlock.pre)} times as often on company homepages in 2023 to 2026 as in 2019 to 2022 (${f1(unlock.pre)} to ${f1(unlock.post)} uses per 100,000 words).`,
    `AI-era vocabulary was already rising before ChatGPT: it averaged ${f2(Y(2012).ai_era_style_per1000.mean)} uses per 1,000 homepage words in 2012 and ${f2(Y(2019).ai_era_style_per1000.mean)} in 2019, three years before ChatGPT launched.`,
    `In ${crossYear}, AI-era words overtook the dotcom vocabulary ("solutions", "world-class", "click here") on company homepages for the first time in the 27 years measured.`,
    `${pct(yFirst.share_with_em_only)} of company homepages used an em dash in ${yFirst.year}, ${pct(Y(2022).share_with_em_only)} in 2022 and ${pct(yLast.share_with_em_only)} in ${yLast.year}: the em dash was spreading for two decades before ChatGPT.`,
    `${pct(sec("software").recent_em_share)} of software company homepages used an em dash in 2023 to 2026, against ${pct(sec("finance").recent_em_share)} of banking and finance homepages.`,
    `Software homepages carry the most AI-era marketing vocabulary of any sector: ${f2(sec("software").ai_era_style.after_mean)} uses per 1,000 words since 2023, against ${f2(sec("finance").ai_era_style.after_mean)} for banks and ${f2(sec("insurance").ai_era_style.after_mean)} for insurers.`,
    `The sentence shapes associated with AI writing ("not X but Y", reflexive lists of three, "furthermore") did not increase on company homepages after ChatGPT: ${f2(tell.before_mean)} per 1,000 words before, ${f2(tell.after_mean)} after.`,
    `The median company homepage carried ${n(yFirst.words.median)} words of prose in ${yFirst.year} and ${n(yLast.words.median)} in ${yLast.year}; ${words.sites_up} of ${words.sites} sites got longer after ChatGPT.`,
  ],
  measures: [
    { term: "Words of prose", definition: "Words in lines that read as sentences or headlines (at least four words, or ending like a sentence), after scripts, navigation and footers are removed. Menu items and button labels do not count." },
    { term: "AI-era vocabulary", definition: `Uses per 1,000 words of a fixed list of ${lex.ai_era.length} words and phrases widely reported as over-used in AI-assisted marketing copy: ${lex.ai_era.filter((w) => !TOPIC.includes(w)).map((w) => w.replace(/\*$/, "")).join(", ")}. The headline figure ("style words only") leaves out ai-powered and powered by AI, which describe a product rather than a style.` },
    { term: "Dotcom corporate vocabulary", definition: `Uses per 1,000 words of a fixed list of ${lex.dotcom_corporate.length} stock phrases of 2000s corporate sites: ${lex.dotcom_corporate.join(", ")}.` },
    { term: "AI-tell density", definition: "ScriptGrain's published count of AI-associated transitions and sentence shapes per 1,000 words, the same scan as the free [AI cliché checker](/tools/ai-cliche-checker): stock connectives (furthermore, delve into, in today's world), 'not X but Y' balancing, reflexive lists of three, chains of semicolons and similar." },
    { term: "Em dash share", definition: "The share of homepages with at least one em dash (the long dash). En dashes are not counted here, because they also mark ranges such as 2000 to 2026." },
    { term: "Average sentence length", definition: "Words per sentence across the homepage's prose. Homepage copy is mostly headlines and short claims, so it runs far shorter than articles." },
    { term: "Contractions", definition: "Uses of forms such as we're, don't and it's per 1,000 words: a simple measure of how conversational the copy is." },
    { term: "Paired before and after", definition: "Each site's average over its 2019 to 2022 homepages compared with its own average over 2023 to 2026. Only sites measured in both windows count, so the result cannot come from which sites happened to be in the archive." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The panel and both word lists were fixed before anything was measured, nothing was re-run or selected, and the scripts are published, so the numbers can be checked without taking our word for them.",
  notShown: [
    "Which homepages, if any, were written with AI. The study measures vocabulary on public pages, not who or what wrote them.",
    "That voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "Why the vocabulary changed. The timing fits AI-assisted writing, and it also fits copywriters adopting words that AI made familiar; the data cannot separate the two.",
    "Anything about pages other than homepages, or about companies outside the panel.",
  ],
  productNote: "ScriptGrain measures writing voice: the habits that make a writer recognisable, such as sentence rhythm, punctuation and vocabulary. The AI-tell scan in this study is the one behind the free [AI cliché checker](/tools/ai-cliche-checker). Neither is a test of who, or what, wrote a text.",
  sample: {
    description: `A fixed panel of ${panelSites.length} companies whose homepages have been online since 2000 or soon after, chosen before anything was measured: ${sectors} sectors (software, hardware, retail, finance, insurance, telecoms and media, travel, consumer brands, logistics and cars, agencies and consultancies, web and marketing tools), UK and US. For each site and each year, the homepage was requested from the Wayback Machine at 1 July; the nearest capture was kept only if it fell in the same calendar year. Each capture was then rendered with JavaScript (so a homepage built in the browser is measured on what a visitor saw, not an empty shell), and the raw archived HTML was measured too, as a check.`,
    size: measuredTotal,
    inclusionCriteria: [
      "The homepage (the domain's root URL) only, never a deeper page",
      "A capture in the target calendar year; the nearest to 1 July",
      "At least 100 words of prose after menus, footers and scripts were removed",
    ],
    exclusions: [
      `${n(S.status.too_little_prose)} captures with under 100 words of prose (image-led homepages, many of Apple's among them, and pages the archive saved without their content)`,
      `${n(S.status.bot_wall)} captures where the archive had saved a bot check or block page instead of the homepage`,
      `${n(S.status.no_capture)} site-years with no capture in that year (including every year of the sites the archive does not hold, such as booking.com and yelp.com), and ${n(S.status.render_failed + S.status.archive_redirect)} whose capture could not be rendered`,
    ],
  },
  method: [
    "Panel and vocabularies fixed on 4 October 2026, before any page was measured (scripts/experiments/sgr-004/panel.json and lexicons.json).",
    "Fetch: the Wayback Machine's raw capture for each site-year (crawl.mjs), then the same capture rendered with JavaScript by Firecrawl with the archive's toolbar removed (render.mjs). Two thirds of the way through, the archive rate-limited our server; the remaining site-years were requested by date through Firecrawl only, so they have no raw-HTML twin.",
    "Extraction: visible prose lines, with scripts, navigation and footers removed, using the same block splitting and prose-line rule as the product's URL reader. Unlike that reader, page headers, forms and asides are kept, because on a homepage that is where the headline copy sits; repeated lines (desktop and mobile copies of one carousel) are counted once.",
    "Measurement: the product's own deterministic instruments, measureTextFeatures and scanCliches, the same code that powers the [AI cliché checker](/tools/ai-cliche-checker) and voice matching. No language model was used to read or score any page.",
    `Vocabularies: an AI-era list (${lex.ai_era.length} entries, among them seamless, unlock, elevate, streamline) and a dotcom corporate list (${lex.dotcom_corporate.length} entries, among them solutions, world-class, synergy, click here), counted per 1,000 words. Neither says a page was written by AI; they track vocabulary only.`,
    "Before and after: each site's mean over its 2019 to 2022 captures against its mean over its 2023 to 2026 captures, paired by site, so sites entering or leaving the panel cannot move the result. ChatGPT launched on 30 November 2022; captures are taken nearest 1 July, so 2022 is before and 2023 after.",
  ],
  variablesMeasured: [
    "Words of prose on the homepage",
    "Average sentence length and its variance",
    "Contractions, exclamation marks and em dashes per 1,000 words",
    "Share of I, we and you among first and second person pronouns",
    "AI-era and dotcom vocabulary per 1,000 words",
    "ScriptGrain AI-tell density per 1,000 words (phrases and sentence shapes)",
  ],
  findings: [
    {
      label: `AI-era marketing words ${riseWord} after ChatGPT`,
      value: `${f2(style.before_mean)} to ${f2(style.after_mean)} per 1,000 words; ${style.sites_up} sites up, ${style.sites_down} down`,
      explanation: `Pairing each site's own homepage before and after November 2022, the AI-era vocabulary (style words only) rose from ${f2(style.before_mean)} to ${f2(style.after_mean)} uses per 1,000 words on average: up on ${style.sites_up} of ${style.sites} sites, down on ${style.sites_down}, unchanged on ${style.sites_same}. "Unlock" went from ${f1(unlock.pre)} to ${f1(unlock.post)} uses per 100,000 words, "seamless" from ${f1(seamless.pre)} to ${f1(seamless.post)}, "streamline" from ${f1(streamline.pre)} to ${f1(streamline.post)}. The rise started before ChatGPT: the yearly average was ${f2(Y(2012).ai_era_style_per1000.mean)} in 2012 and ${f2(Y(2019).ai_era_style_per1000.mean)} in 2019. After 2022 it reached ${f2(yLast.ai_era_style_per1000.mean)} in ${yLast.year}.`,
    },
    {
      label: crossYear ? `The dotcom vocabulary faded, and the AI-era words overtook it in ${crossYear}` : "The dotcom vocabulary faded",
      value: `${f2(yFirst.dotcom_vocab_per1000.mean)} per 1,000 words in ${yFirst.year}, ${f2(yLast.dotcom_vocab_per1000.mean)} in ${yLast.year}`,
      explanation: `"Solutions", "world-class", "click here", "welcome to" and the rest of the 2000s corporate vocabulary averaged ${f2(yFirst.dotcom_vocab_per1000.mean)} uses per 1,000 words in ${yFirst.year} and ${f2(yLast.dotcom_vocab_per1000.mean)} in ${yLast.year}. Most of that fall came early: paired by site, the dotcom rate was ${f2(dot.before_mean)} before ChatGPT and ${f2(dot.after_mean)} after. ${crossYear ? `So when the AI-era words became the more common of the two in ${crossYear}, and stayed so every year since, it was because they rose, not because the old words fell further. ` : ""}One vocabulary of borrowed confidence replaced another: in ${yFirst.year} homepages said "solutions", in ${yLast.year} they say "seamless".`,
    },
    {
      label: "AI did not bring the em dash to homepages",
      value: `${pct(yFirst.share_with_em_only)} of homepages in ${yFirst.year}, ${pct(Y(2022).share_with_em_only)} in 2022, ${pct(yLast.share_with_em_only)} in ${yLast.year}`,
      explanation: `The share of homepages using at least one em dash climbed for two decades before ChatGPT: ${pct(yFirst.share_with_em_only)} in ${yFirst.year}, ${pct(Y(2010).share_with_em_only)} in 2010, ${pct(Y(2022).share_with_em_only)} in 2022. It kept rising after, to ${pct(yLast.share_with_em_only)} in ${yLast.year}: ${f1(emPerYearAfter)} points a year since 2022 against ${f1(emPerYearBefore)} a year before it. Paired by site, the em dash rate per 1,000 words went from ${f2(pp.em_only_per1000.before_mean)} before ChatGPT to ${f2(pp.em_only_per1000.after_mean)} after (up on ${pp.em_only_per1000.sites_up} sites, down on ${pp.em_only_per1000.sites_down}). The habit was already well under way; AI may have quickened its spread, but it did not start it.`,
    },
    {
      label: "The sentence shapes people call AI did not arrive on homepages",
      value: `${f2(tell.before_mean)} before, ${f2(tell.after_mean)} after, per 1,000 words`,
      explanation: `ScriptGrain's [AI-tell density](/tools/ai-cliche-checker) (stock transitions such as "furthermore" and "delve into", plus shapes such as "not X but Y" and the reflexive list of three) was low throughout and did not rise: ${f2(tell.before_mean)} per 1,000 words before ChatGPT, ${f2(tell.after_mean)} after, with ${tell.sites_same} of ${tell.sites} sites at the same level. Homepage copy is short and headline-shaped, which leaves little room for those shapes; the change shows in the words, not the sentences.`,
    },
    {
      label: "Homepages got longer and a little less conversational",
      value: `median ${n(yFirst.words.median)} words in ${yFirst.year}, ${n(yLast.words.median)} in ${yLast.year}`,
      explanation: `The median homepage carried ${n(yFirst.words.median)} words of prose in ${yFirst.year}, ${n(Y(2010).words.median)} in 2010, ${n(Y(2022).words.median)} in 2022 and ${n(yLast.words.median)} in ${yLast.year}. Paired by site, ${words.sites_up} of ${words.sites} homepages were longer after ChatGPT than before. Sentences lengthened slightly (median ${f1(yFirst.avg_sentence_length.median)} words in ${yFirst.year}, ${f1(yLast.avg_sentence_length.median)} in ${yLast.year}), and contractions fell after 2022 on ${contr.sites_down} of ${contr.sites} sites (${f1(contr.before_mean)} to ${f1(contr.after_mean)} per 1,000 words).`,
    },
  ],
  sections: [
    {
      heading: "Two vocabularies, 2000 to 2026",
      paragraphs: ["Mean uses per 1,000 words across every homepage measured that year. The AI-era line is style words only; the two AI-topic phrases are excluded (see Limitations)."],
      figure: { src: "/research/sgr-004-vocab.svg", alt: `Line chart: AI-era marketing words rise from about ${f1(yFirst.ai_era_style_per1000.mean)} per 1,000 words in ${yFirst.year} to ${f1(yLast.ai_era_style_per1000.mean)} in ${yLast.year}, while dotcom words fall from ${f1(yFirst.dotcom_vocab_per1000.mean)} to ${f1(yLast.dotcom_vocab_per1000.mean)}.`, caption: "Source: ScriptGrain SGR-004, CC BY 4.0.", width: 760, height: 380 },
    },
    {
      heading: "Homepages using an em dash",
      figure: { src: "/research/sgr-004-em-dash.svg", alt: `Line chart: the share of homepages with at least one em dash rises from ${pct(yFirst.share_with_em_only)} in ${yFirst.year} to ${pct(Y(2022).share_with_em_only)} in 2022 and ${pct(yLast.share_with_em_only)} in ${yLast.year}.`, caption: "Source: ScriptGrain SGR-004, CC BY 4.0.", width: 760, height: 380 },
    },
    {
      heading: "Words of prose on the homepage",
      figure: { src: "/research/sgr-004-words.svg", alt: `Line chart: median words of prose on a homepage rise from ${n(yFirst.words.median)} in ${yFirst.year} to ${n(yLast.words.median)} in ${yLast.year}.`, caption: "Median, with the middle half of sites shaded. Source: ScriptGrain SGR-004, CC BY 4.0.", width: 760, height: 380 },
    },
    {
      heading: "Before and after ChatGPT, paired by site",
      paragraphs: [`Each site's mean over 2019 to 2022 against its mean over 2023 to 2026. Only sites measured in both windows count (${style.sites} sites).`],
      table: {
        columns: ["Measure", "Before (mean)", "After (mean)", "Sites up", "Sites down", "Sites unchanged"],
        rows: ["ai_era_style_per1000", "ai_era_vocab_per1000", "dotcom_vocab_per1000", "words", "avg_sentence_length", "contraction_frequency", "exclamation_rate", "em_only_per1000", "ai_tell_per1000", "pronoun_you"].map((k) => [pp[k].label, f2(pp[k].before_mean), f2(pp[k].after_mean), String(pp[k].sites_up), String(pp[k].sites_down), String(pp[k].sites_same)]),
      },
    },
    {
      heading: "The AI-era words that moved most",
      paragraphs: [`Uses per 100,000 words, all homepages in 2019 to 2022 (an asterisk covers every ending: unlock* counts unlock, unlocks, unlocked and unlocking) , ${n(v.pre_words)} words, against 2023 to 2026 (${n(v.post_words)} words).`],
      table: {
        columns: ["Word or phrase", "2019 to 2022", "2023 to 2026", "Uses before", "Uses after"],
        rows: aiMovers.slice(0, 10).map((m) => [TOPIC.includes(m.w) ? `${m.w} (AI topic, not in the headline figure)` : m.w, f1(m.pre), f1(m.post), String(m.cp), String(m.cq)]),
      },
    },
    {
      heading: "By sector",
      paragraphs: [`Paired before and after within each sector, plus each sector's level from 2023 to 2026. Some sectors have under ten sites, so read single sectors as indications rather than findings. The biggest relative rises were in ${secsByRise.slice(0, 2).map((b) => SECTOR_NAMES[b.sector].toLowerCase()).join(" and ")}; ${SECTOR_NAMES[emSecs[0].sector].toLowerCase()} homepages use the em dash most (${pct(emSecs[0].recent_em_share)} of them since 2023).`],
      table: {
        columns: ["Sector", "Sites", "AI-era words per 1,000, before", "After", "Sites up", "Sites down", "Median words, 2023 to 2026", "With an em dash, 2023 to 2026"],
        rows: secs.map((b) => [SECTOR_NAMES[b.sector], String(b.sites), f2(b.ai_era_style.before_mean), f2(b.ai_era_style.after_mean), String(b.ai_era_style.sites_up), String(b.ai_era_style.sites_down), n(b.recent_words_median), pct(b.recent_em_share)]),
      },
    },
    {
      heading: "Year by year",
      table: {
        columns: ["Year", "Homepages measured", "Median words", "Median sentence length", "AI-era words per 1,000 (style)", "Dotcom words per 1,000", "With an em dash", "With an exclamation mark"],
        rows: S.byYear.map((b) => [String(b.year), String(b.measured), n(b.words.median), f1(b.avg_sentence_length.median), f2(b.ai_era_style_per1000.mean), f2(b.dotcom_vocab_per1000.mean), pct(b.share_with_em_only), pct(b.share_with_exclamation)]),
      },
    },
    {
      heading: "Coverage: what happened to every site and year",
      paragraphs: [`${n(panelSites.length)} sites over 27 years is ${n(S.site_years)} site-years. Every one is accounted for here, so the gaps can be judged.`],
      table: {
        columns: ["Year", "Measured", "Under 100 words of prose", "Bot or block page", "No capture that year", "Could not be rendered"],
        rows: S.coverage.map((c) => [String(c.year), String(c.measured), String(c.too_little_prose), String(c.bot_wall), String(c.no_capture), String(c.render_failed + c.archive_redirect)]),
      },
    },
    {
      heading: "Checks",
      paragraphs: [
        `Fixed panel: repeating the yearly trend on the ${st.sites} sites measured in at least 9 of the 12 years from 2015 gives the same picture: AI-era words (style) ${f2(SY(2021).ai_era_style_per1000.mean)} per 1,000 in 2021, ${f2(SY(2022).ai_era_style_per1000.mean)} in 2022, ${f2(SY(yLast.year).ai_era_style_per1000.mean)} in ${yLast.year}; median homepage ${n(SY(2022).words.median)} words in 2022 and ${n(SY(yLast.year).words.median)} in ${yLast.year}.`,
        `Raw HTML instead of rendered pages, for the ${n(RAW.site_years - RAW.status.no_capture)} captures fetched directly from the archive: measuring the archived HTML without running its scripts gives the same before and after direction: AI-era words (style) ${f2(rp.ai_era_style_per1000.before_mean)} to ${f2(rp.ai_era_style_per1000.after_mean)} per 1,000, up on ${rp.ai_era_style_per1000.sites_up} sites and down on ${rp.ai_era_style_per1000.sites_down}.`,
        `With the AI-topic phrases left in, the full AI-era list rises from ${f2(full.before_mean)} to ${f2(full.after_mean)} per 1,000 words (up on ${full.sites_up} sites, down on ${full.sites_down}).`,
      ],
    },
  ],
  limitations: [
    "Homepages only. A homepage is the most edited, most headline-shaped page a company has; blog posts and product pages may have moved differently.",
    `The panel is ${panelSites.length} large, long-lived companies, mostly UK and US. Small businesses and companies founded after 2010 are not represented, and a young company's copy may look different.`,
    "Vocabulary is not authorship. A rise in 'unlock' and 'seamless' is consistent with AI-assisted writing, and also with copywriters adopting the words that AI made familiar. This study cannot tell those apart, and it does not try to say which homepage was written by a model.",
    "'AI-powered' and 'powered by AI' were on the AI-era list as fixed before measuring. They mostly describe what a company sells, not how its copy reads, so the headline figures exclude them. That exclusion was decided after the list was fixed and is disclosed here; the figure with them left in is in Checks and in the data.",
    "The Wayback Machine keeps what it captured, when it captured it. Some captures are partial, some years have none, and the nearest capture to 1 July can be weeks away from it. Rendering an old capture runs its archived scripts, and some of those no longer load.",
    "Medians and means over a changing set of sites can move because the set changed. The paired before and after comparison and the fixed-panel check exist for that reason; the yearly lines should be read as the broad trend.",
  ],
  reproducibility: [
    "Panel, vocabularies and every script: scripts/experiments/sgr-004/ in the ScriptGrain repository (crawl.mjs, render.mjs, measure.mjs, analyse.mjs, write-entry.mjs).",
    "Instruments: supabase/functions/_shared/voice-match.ts (measureTextFeatures) and ai-cliches.ts (scanCliches), the code the product runs.",
    "The archived HTML is not republished. Every row in the data names the capture's timestamp, so any page can be reopened on the Wayback Machine and measured again.",
  ],
  dataDownloads: [
    { label: "Every homepage measured, one row per site and year (CSV)", path: "/research/sgr-004-web-copy.csv", format: "csv" },
    { label: "Every homepage, with word-level vocabulary counts (JSON)", path: "/research/sgr-004-web-copy-rows.json", format: "json" },
    { label: "Yearly summary, sectors, coverage, before and after, and checks (JSON)", path: "/research/sgr-004-web-copy-summary.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-004, conducted 4 October 2026). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "Wayback Machine, Internet Archive", url: "https://web.archive.org/" },
  ],
};

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
console.error(`SGR-004 ${i === -1 ? "added" : "updated"}; publishOn ${PUBLISH_ON}`);
