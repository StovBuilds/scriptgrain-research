#!/usr/bin/env bun
// SGR-007 step 5: write the study entry in src/data/research-pages.json from
// the published summary, so every number on the page is the run's number.
//
//   bun scripts/experiments/sgr-007/write-entry.mjs --publish-on YYYY-MM-DD [--summary public/research/sgr-007-summary.json]
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const PUBLISH_ON = opt("--publish-on", null);
if (!PUBLISH_ON) throw new Error("--publish-on required");
const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-007-summary.json"), "utf8"));
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const LEX = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));

const n = (x, d = 0) => Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const f2 = (x) => n(x, 2), f1 = (x) => n(x, 1), f3 = (x) => n(x, 3);
// Stems shown as the word a reader would recognise.
const WORD = { "underscor*": "underscore", "revolutioniz*": "revolutionize", "revolutionis*": "revolutionise", "reimagin*": "reimagine", "redefin*": "redefine", "showcas*": "showcase", "notabl*": "notably", "enhanc*": "enhance", "comprehensive*": "comprehensive", "significant*": "significant", "delve*": "delve", "intricate*": "intricate", "meticulous*": "meticulous", "seamless*": "seamless", "empower*": "empower", "streamline*": "streamline", "unlock*": "unlock", "elevate*": "elevate", "unleash*": "unleash", "effortless*": "effortless", "harness*": "harness", "embark*": "embark", "supercharge*": "supercharge" };
const word = (w) => WORD[w] ?? w.replace(/\*$/, "");
const pct = (x, d = 0) => `${n(x * 100, d)}%`;
const G = (g) => S.byGroup.find((b) => b.group === g);
const L = (g) => (CFG.labels[g] ?? g);
const lc = (g) => L(g).replace(/^News, /, "news from ").replace(/^Books before 1928: /, "pre-1928 books: ").toLowerCase().replace(/\buk\b/, "the UK").replace(/\bus\b/, "the US");
const SLUG = "where-did-ai-isms-come-from";
const TITLE = "Where did the AI-isms come from? 17,000 pieces of writing from before ChatGPT, measured";
const PAGE_URL = `https://scriptgrain.com/research/${SLUG}`;
const { _readme: _a, ...ANALYSTS } = JSON.parse(readFileSync(new URL("../shared/analysts.json", import.meta.url), "utf8"));
const ANALYST = ANALYSTS["jack-stovell"];

const NEWS = ["news_uk", "news_us", "news_nigeria", "news_kenya", "news_india", "news_philippines"];
const newsMean = (k) => { const g = NEWS.map(G).filter(Boolean); return g.reduce((s, x) => s + x[k] * x.pages, 0) / g.reduce((s, x) => s + x.pages, 0); };
const top = S.byGroup[0], bottom = S.byGroup[S.byGroup.length - 1];
const pr = G("press_releases"), wiki = G("wikipedia"), ukn = G("news_uk"), usn = G("news_us"), ng = G("news_nigeria"), ke = G("news_kenya");
const byTell = [...S.byGroup].sort((a, b) => b.ai_tell_per1000 - a.ai_tell_per1000);
const books = S.byGroup.filter((g) => g.group.startsWith("gutenberg"));
const web = S.byGroup.filter((g) => !g.group.startsWith("gutenberg") && g.group !== "arxiv" && g.group !== "homepages");
const meanOf = (gs, k) => gs.reduce((s, x) => s + x[k] * x.pages, 0) / gs.reduce((s, x) => s + x.pages, 0);
const H1 = Object.fromEntries(S.H1.map((h) => [h.group, h]));
const H2d = S.H2.find((h) => h.metric === "delve_per1000"), H2o = S.H2.find((h) => h.metric === "old_per1000");
const delvePages = (g) => Math.round(G(g).share_with_delve * G(g).pages);
const withHome = S.homes.filter((h) => h.home && h.uses >= 20);
const homesPR = [...new Set(withHome.filter((h) => h.home === "press_releases").map((h) => word(h.word)))];
const homesEssay = [...new Set(withHome.filter((h) => h.home === "essay_mills").map((h) => word(h.word)))];
const nWithHome = new Set(withHome.map((h) => word(h.word))).size;
const below = (k, refs) => books.filter((b) => refs.some((r) => b[k] <= G(r)[k]));
const ngDown = S.ngram.filter((w) => w.per_million_2019 <= w.per_million_1980).map((w) => `"${word(w.word)}"`);
const NG = Object.fromEntries(S.ngram.map((w) => [w.word, w]));
const AX = G("arxiv");
const PRES = JSON.parse(readFileSync(opt("--presence", "public/research/sgr-007-arxiv-presence.json"), "utf8"));
const axRank = S.byGroup.findIndex((g) => g.group === "arxiv") + 1;
const quietRank = [...S.byGroup].sort((a, b) => b.quiet_per1000 - a.quiet_per1000).findIndex((g) => g.group === "arxiv") + 1;
const modern = S.byGroup.filter((g) => !g.group.startsWith("gutenberg"));
const tellRankModern = [...modern].sort((a, b) => b.ai_tell_per1000 - a.ai_tell_per1000).findIndex((g) => g.group === "arxiv") + 1;
const homesAX = [...new Set(S.homes.filter((h) => h.home === "arxiv" && h.uses >= 20).map((h) => word(h.word)))];
const oneIn = (share) => n(Math.round(1 / share));
const verdict = (h) => (h ? "Supported" : "Not supported");
const ci = (t) => `${f2(t.diff)} (95% interval ${f2(t.lo)} to ${f2(t.hi)})`;

const study = {
  id: "SGR-007",
  slug: SLUG,
  title: TITLE,
  seoTitle: `Where did AI-isms come from? ${n(S.pages_measured)} pre-ChatGPT pages measured · ScriptGrain Research`,
  question: "Before ChatGPT, which kinds of human writing already used the words and habits now called AI-isms most, and when did each become common?",
  conductedOn: "2026-10-04",
  publishOn: PUBLISH_ON,
  description: `${n(S.pages_measured)} pieces of writing and ${n(S.words_measured / 1e6, 1)} million words from before ChatGPT, in ${S.byGroup.length} kinds of writing: the 2021 web that language models learned from (news in six countries, press releases, essay mills, marketing blogs, Wikipedia and more), ${n(AX.pages)} scientific abstracts, public-domain books by genre, and Google Books back to 1800. Pre-registered, measured with the product's own instruments, and published as a free dataset under CC BY 4.0.`,
  abstract: [
    { label: "Background", text: `Words such as "delve", "pivotal" and "seamless", and shapes such as "not X but Y", are now widely read as signs of AI writing. Models learned to write from human text, so these habits must have had human homes first. Popular explanations exist, most famously that "delve" came from the formal English of outsourced workers in Africa, especially Nigeria, who rated model answers ([The Guardian, April 2024](https://www.theguardian.com/technology/2024/apr/16/techscape-ai-gadgest-humane-ai-pin-chatgpt)), but they have rarely been measured.` },
    { label: "What we did", text: `We fixed four hypotheses, the sources and the word lists before measuring anything, and published them. We then sampled ${n(web.reduce((s, g) => s + g.pages, 0))} pages from Common Crawl's October 2021 snapshot of the web, the kind of text language models were trained on, across ${web.length} kinds of writing, plus ${n(G("homepages").pages)} company homepages from the same crawl, ${n(AX.pages)} arXiv abstracts written before ChatGPT, ${n(books.reduce((s, g) => s + g.pages, 0))} passages from pre-1928 books in ${books.length} genres, and traced every listed word through Google Books from 1800 to 2019. Every text was measured with the same deterministic code ScriptGrain uses, and only the numbers were kept.` },
    { label: "What we found", text: `Press releases were the densest home of AI-isms before ChatGPT: ${f2(pr.ai_ism_per1000)} uses per 1,000 words, against ${f2(newsMean("ai_ism_per1000"))} in news and ${f2(wiki.ai_ism_per1000)} in Wikipedia. Of the ${nWithHome} listed words common enough to place, ${homesPR.length} were most at home there. The sentence shapes associated with AI writing had a different home: pre-1928 speeches, sermons and conduct books. In books, ${S.H4.more_frequent_2019_than_1980} of ${S.H4.words} listed words were already more common in 2019 than in 1980. The "delve came from Nigerian English" claim was not supported: Nigerian and Kenyan news used "delve" a little more than UK and US news, but the word was rare everywhere and the difference was within chance.` },
    { label: "What it means", text: `The "AI voice" looks less like an invention than an inheritance: the vocabulary of corporate announcements laid over the rhetorical shapes of older speeches and sermons, both well established in human writing long before language models. This study shows where the closest human matches were, not where any model learned anything.` },
  ],
  keyNumbers: [
    `Before ChatGPT, press releases used AI-isms such as "innovative", "pivotal" and "seamless" ${f1(pr.ai_ism_per1000 / newsMean("ai_ism_per1000"))} times as often as news articles: ${f2(pr.ai_ism_per1000)} against ${f2(newsMean("ai_ism_per1000"))} uses per 1,000 words in pages from 2021 and earlier (ScriptGrain, 2026).`,
    `Words that studies of scientific writing found language models over-use, including ${homesPR.slice(0, 8).map((w) => `"${w}"`).join(", ")}, were most common in press releases in writing from before ChatGPT.`,
    `The sentence shapes associated with AI writing, such as "not X but Y" and reflexive lists of three, were most frequent in pre-1928 ${lc(byTell[0].group).replace("pre-1928 books: ", "")} (${f2(byTell[0].ai_tell_per1000)} per 1,000 words) and ${lc(byTell[1].group).replace("pre-1928 books: ", "")} (${f2(byTell[1].ai_tell_per1000)}), against ${f2(ukn.ai_tell_per1000)} in UK news.`,
    `"Delve" was rare in 2021 news everywhere: it appeared on ${delvePages("news_nigeria")} of ${ng.pages} Nigerian news pages, ${delvePages("news_kenya")} of ${ke.pages} Kenyan, and none of ${n(ukn.pages + usn.pages)} UK and US pages.`,
    `In English-language books, "innovative" went from ${f2(NG.innovative.per_million_1950)} to ${f2(NG.innovative.per_million_1980)} uses per million words between 1950 and 1980; "transformative" rose ${n(NG.transformative.ratio_2019_1980)} times between 1980 and 2019, long before ChatGPT.`,
    `Before ChatGPT, "delve" appeared in about 1 in ${oneIn(PRES.share_by_word.delve)} arXiv abstracts (${n(PRES.eligible)} abstracts from 2015 to November 2022 with no later revision); only ${n(PRES.share_with_any_old * 100, 1)}% contained any of the twelve words later identified as 2024 AI tells.`,
    `"Delve" was already ${f1(NG.delve.ratio_2019_1980)} times as common in English-language books in 2019 as in 1980 (Google Books).`,
    `${S.H4.more_frequent_2019_than_1980} of ${S.H4.words} words now called AI-isms were more common in English-language books in 2019 than in 1980.`,
    `Of ${S.byGroup.length} kinds of writing measured, a Q&A forum (English Stack Exchange) used AI-isms least: ${f2(bottom.ai_ism_per1000)} per 1,000 words, ${n(pr.ai_ism_per1000 / bottom.ai_ism_per1000)} times less than press releases.`,
  ],
  measures: [
    { term: "AI-ism rate (the primary measure)", definition: `Uses per 1,000 words of three published word lists combined, each occurrence counted once: [SGR-008](/research/the-ai-tells-moved)'s 2024 tells (${LEX.OLD.join(", ")}), SGR-008's list of words publicly mocked as ChatGPT tells (${LEX.CALLED_OUT.map((w) => w.replace(/\*$/, "")).join(", ")}), and [SGR-004](/research/did-chatgpt-change-how-companies-write)'s AI-era marketing words.` },
    { term: "AI sentence shapes", definition: "ScriptGrain's published scan for AI-associated sentence shapes and transitions per 1,000 words, the same scan as the free [AI cliché checker](/tools/ai-cliche-checker): 'not X but Y' balancing, reflexive lists of three, chains of semicolons and stock connectives." },
    { term: "Delve rate", definition: "Uses of delve, delves, delved and delving per 1,000 words (for hypothesis H2)." },
    { term: "Home", definition: "For each word, the kind of writing where its rate is highest relative to its rate across everything measured. Counted only for words with at least 20 uses." },
    { term: "Take-off year", definition: "In Google Books, the first year after which the word's 5-year average stays above twice its 1950 to 1980 average." },
    { term: "95% interval", definition: "From 10,000 bootstrap resamples of pages. A pre-registered hypothesis counts as supported only if the interval for the difference excludes zero in the predicted direction." },
  ],
  analyst: ANALYST,
  competingInterests: "ScriptGrain sells writing-voice measurement and generation, and the analyst builds it. The hypotheses, sources and word lists were fixed and published before anything was measured, nothing was re-run or selected, and the scripts are public, so the numbers can be checked without taking our word for them.",
  notShown: [
    "Where any language model learned anything. The study finds the human writing that most resembles today's AI-isms; it does not trace a model's training.",
    "Anything about the people who rated model answers. H2 measures public news writing in Nigeria and Kenya, not the raters, so it neither confirms nor rules out the rater explanation.",
    "That a text containing these words or shapes was written by AI, or that voice measurement, ScriptGrain's or anyone's, can tell whether a text was written by AI. Nothing in this study tests that.",
    "What the words meant. Lists count spellings, so 'harness' in a pre-1928 commerce book is usually a horse's, not 'harness the power of'.",
  ],
  productNote: "ScriptGrain measures writing voice: the habits that make a writer recognisable. The sentence-shape scan in this study is the one behind the free [AI cliché checker](/tools/ai-cliche-checker). This study is about where those habits come from; it is not a test of who, or what, wrote any text.",
  sample: {
    description: `${CFG.web_groups && Object.values(CFG.web_groups).flat().length} web sources in ${Object.keys(CFG.web_groups).length} kinds of writing, read from Common Crawl's October 2021 crawl (CC-MAIN-2021-43): up to ${CFG.pages_per_source} pages per source, in a seeded random order, kept if the product's article reader found at least ${CFG.min_words} words. The ${G("homepages")?.pages ?? 0} company homepages are the SGR-004 panel as Common Crawl saw them in October 2021. Scientific abstracts: ${n(AX.pages)} arXiv abstracts, a seeded random sample of the ${n(PRES.eligible)} from 2015 to November 2022 with no revision after 30 November 2022 (SGR-008's census). Books: ${G("gutenberg_fiction").pages / 3} public-domain books in each of ${books.length} genres from Project Gutenberg, three passages of about 800 words from each. Google Books Ngram (English 2019 corpus) for every listed word, 1800 to 2019.`,
    size: S.pages_measured,
    inclusionCriteria: [
      "Written before ChatGPT launched (30 November 2022): the web pages were crawled in October 2021, and the books are older",
      "English pages with status 200, one capture per URL, no index, tag, category, author or search pages",
      `At least ${CFG.min_words} words of article text for web pages, 100 for homepages`,
    ],
    exclusions: [
      "linkedin.com/pulse was in the draft plan and dropped before freezing: Common Crawl holds no pages from it",
      "No page text is published or stored; only counts",
    ],
  },
  method: [
    "Pre-registration: hypotheses H1 to H4, sources, sampling and word lists were committed to the public repository before any page was measured (docs/research/sgr-007-preregistration.md). Two clarifications made before measuring are listed there with reasons.",
    "Scientific abstracts: a seeded random sample of 10,000 from the 1,057,471 arXiv abstracts dated 2015 to November 2022 with no revision after ChatGPT's launch, from [SGR-008](/research/the-ai-tells-moved)'s census of arXiv, cleaned of LaTeX and measured like every other text; the share of all eligible abstracts containing each word is reported alongside.",
    "Web pages: looked up in Common Crawl's own index files (read directly, not through its busy query server), fetched from its WARC archives and reduced to article text with the product's reader.",
    "Measurement: each page or passage is scored with the same deterministic code ScriptGrain uses, for the word lists, the sentence-shape scan, em dashes, sentence length and contractions. No language model reads or scores any text.",
    "Word lists: [SGR-008](/research/the-ai-tells-moved)'s lists of 2024 tells and publicly mocked ChatGPT words (built from published studies of scientific writing) and SGR-004's AI-era marketing words, used unchanged.",
    "Tests: differences in mean rate per page with 95% bootstrap intervals (10,000 resamples, seed 20261004). Exploratory analyses are labelled as such.",
  ],
  variablesMeasured: ["AI-ism rate per 1,000 words", "Rate for each word list", "Delve rate", "AI sentence shapes per 1,000 words", "Em dashes per 1,000 words", "Average sentence length", "Contractions per 1,000 words", "Google Books frequency per million words, 1800 to 2019"],
  findings: [
    {
      label: "H1 (supported): press releases were the densest pre-AI home of AI-isms",
      value: `${f2(pr.ai_ism_per1000)} per 1,000 words, against ${f2(newsMean("ai_ism_per1000"))} in news and ${f2(wiki.ai_ism_per1000)} in Wikipedia`,
      explanation: `Press releases led every kind of writing measured, followed by company homepages (${f2(G("homepages").ai_ism_per1000)}). As pre-registered, press releases, marketing and SEO blogs (${f2(G("marketing_seo_blogs").ai_ism_per1000)}) and essay-mill essays (${f2(G("essay_mills").ai_ism_per1000)}) each used more than news, all countries pooled, and more than Wikipedia. Press releases against news: difference ${ci(H1.press_releases.vs_news)}. Essay mills only just cleared news: ${ci(H1.essay_mills.vs_news)}.`,
    },
    {
      label: "Exploratory: the classic ChatGPT words were most at home in press releases",
      value: `${homesPR.length} of ${nWithHome} words`,
      explanation: `For each word with at least 20 uses, we found the kind of writing where its rate was highest relative to everything measured. Of ${nWithHome} words common enough to place, press releases were home to ${homesPR.length}: ${homesPR.map((w) => `"${w}"`).join(", ")}. Essay mills were home to ${homesEssay.map((w) => `"${w}"`).join(", ")}, the vocabulary of the student essay. The word lists were picked from what models over-use, so this is a description of where they lived, not a test.`,
    },
    {
      label: "Exploratory: AI sentence shapes had a different, older home",
      value: `${f2(byTell[0].ai_tell_per1000)} per 1,000 words in pre-1928 ${lc(byTell[0].group).replace("pre-1928 books: ", "")}, ${f2(ukn.ai_tell_per1000)} in UK news`,
      explanation: `The shapes the AI cliché scan looks for ("not X but Y" balancing, reflexive lists of three, stock connectives) were densest not on the modern web but in pre-1928 ${byTell.slice(0, 4).map((g) => lc(g.group).replace("pre-1928 books: ", "")).join(", ")}. ${(() => { const ex = below("ai_tell_per1000", ["news_uk", "news_us", "wikipedia"]); return ex.length === 0 ? "Every book genre measured used them more often than UK news, US news or Wikipedia." : `${books.length - ex.length} of ${books.length} book genres used them more often than UK news, US news and Wikipedia; the exception${ex.length > 1 ? "s were" : " was"} ${ex.map((b) => lc(b.group).replace("pre-1928 books: ", "")).join(" and ")}.`; })()} Vocabulary and shape point to different ancestors: the announcement and the pulpit.`,
    },
    {
      label: "Exploratory: scientific abstracts had the quieter words, not the famous ones",
      value: `${f2(AX.ai_ism_per1000)} AI-isms per 1,000 words (${axRank} of ${S.byGroup.length}); first of ${S.byGroup.length} for the quieter words`,
      explanation: `Pre-ChatGPT arXiv abstracts were mid-table on the main AI-ism rate but used the quieter LLM-favoured words more than any other writing measured (${f2(AX.quiet_per1000)} per 1,000 words of words such as "significant", "enhance", "additionally" and "potential"), and were home to ${homesAX.map((w) => `"${w}"`).join(", ")}. Their AI sentence-shape rate (${f2(AX.ai_tell_per1000)}) was ${tellRankModern === 1 ? "the highest" : `number ${tellRankModern}`} of any modern writing measured. The famous words were rare: across all ${n(PRES.eligible)} eligible abstracts, "delve" appeared in about 1 in ${oneIn(PRES.share_by_word.delve)}. Studies of scientific writing since 2023 report large rises in exactly those words; see the citations.`,
    },
    {
      label: "H2 (not supported): no clear 'delve' gap between Nigerian or Kenyan news and UK or US news",
      value: `difference ${f3(H2d.diff)} per 1,000 words, 95% interval ${f3(H2d.lo)} to ${f3(H2d.hi)}`,
      explanation: `"Delve" was used a little more in Nigerian and Kenyan news (pooled) than in UK and US news, in the predicted direction, but the interval reaches zero: it appeared on ${delvePages("news_nigeria")} of ${ng.pages} Nigerian pages, ${delvePages("news_kenya")} of ${ke.pages} Kenyan pages and none of ${n(ukn.pages + usn.pages)} UK and US pages. The wider 2024 tell list showed no difference either: ${f3(H2o.diff)} (95% interval ${f3(H2o.lo)} to ${f3(H2o.hi)}). In public news writing from 2021, "delve" was too rare anywhere to carry the explanation on its own. This does not test the raters themselves.`,
    },
    {
      label: "H4 (supported): the words were rising in books for decades before ChatGPT",
      value: `${S.H4.more_frequent_2019_than_1980} of ${S.H4.words} words more common in 2019 than in 1980`,
      explanation: `In Google Books, "innovative" took off around ${NG.innovative.takeoff_year} (${f2(NG.innovative.per_million_1950)} uses per million words in 1950, ${f2(NG.innovative.per_million_1980)} in 1980), "transformative" rose ${n(NG.transformative.ratio_2019_1980)} times between 1980 and 2019, "reimagine" ${n(NG["reimagin*"].ratio_2019_1980)} times, and "delve" took off around ${NG.delve.takeoff_year}. The exceptions, ${ngDown.join(", ")}, had peaked earlier.`,
    },
    {
      label: "H3 (not supported): fiction was not the least AI-like writing; casual Q&A was",
      value: `Q&A forum ${f2(bottom.ai_ism_per1000)}, pre-1928 fiction ${f2(G("gutenberg_fiction").ai_ism_per1000)} per 1,000 words`,
      explanation: `We predicted that pre-1928 fiction would use AI-isms least. It was low, but several book genres were lower, and the lowest of all was English Stack Exchange, where people answer each other's questions in plain words. In this sample, writing that announces or persuades used the most AI-isms, and plain answers to questions used the fewest.`,
    },
  ],
  sections: [
    { heading: "AI-isms by kind of writing", figure: { src: "/research/sgr-007-by-genre.svg", alt: `Bar chart of AI-ism rate by kind of writing: press releases highest at ${f2(pr.ai_ism_per1000)} per 1,000 words, Q&A forum lowest at ${f2(bottom.ai_ism_per1000)}.`, caption: "Source: ScriptGrain SGR-007, CC BY 4.0.", width: 760, height: 66 + S.byGroup.length * 22 + 30 } },
    { heading: "Two kinds of AI tell, two homes", paragraphs: ["Each point is one kind of writing. Left to right: AI-ism vocabulary. Bottom to top: AI sentence shapes. Pre-1928 books sit high and to the left; press releases and company homepages sit far to the right."], figure: { src: "/research/sgr-007-two-ancestries.svg", alt: "Scatter chart: pre-1928 books have the most AI sentence shapes and few AI-ism words; press releases and company homepages have the most AI-ism words and few AI sentence shapes.", caption: "Source: ScriptGrain SGR-007, CC BY 4.0.", width: 760, height: 480 } },
    { heading: "Three AI-isms in books, 1900 to 2019", figure: { src: "/research/sgr-007-books.svg", alt: `Line chart from Google Books: "innovative" rises sharply from the 1960s, "transformative" climbs from the 1990s and "delve" rises slowly after 2000.`, caption: "Source: Google Books Ngram (English 2019), compiled by ScriptGrain SGR-007.", width: 760, height: 380 } },
    {
      heading: "Pre-registered hypotheses and results",
      table: { columns: ["Hypothesis", "Result", "Test"], rows: [
        ["H1: press releases, marketing blogs and essay mills each use more AI-isms than news and than Wikipedia", verdict(S.H1.every((h) => h.holds)), S.H1.map((h) => `${L(h.group)}: vs news ${ci(h.vs_news)}`).join("; ")],
        ["H2: 'delve' and the 2024 tells are more common in Nigerian and Kenyan news than in UK and US news", verdict(S.H2.every((h) => h.holds)), `delve ${f3(H2d.diff)} (${f3(H2d.lo)} to ${f3(H2d.hi)}); 2024 tells ${f3(H2o.diff)} (${f3(H2o.lo)} to ${f3(H2o.hi)})`],
        ["H3: pre-1928 fiction uses AI-isms least of every kind of writing", verdict(S.H3.holds), `lowest was ${L(S.H3.lowest_by_mean)}`],
        ["H4: most listed words are more common in books in 2019 than in 1980", verdict(S.H4.holds), `${S.H4.more_frequent_2019_than_1980} of ${S.H4.words} words`],
      ] },
    },
    {
      heading: "Every kind of writing measured",
      table: { columns: ["Kind of writing", "Pages or passages", "AI-isms per 1,000", "95% interval", "AI sentence shapes per 1,000", "Em dashes per 1,000", "Pages with 'delve'"], rows: S.byGroup.map((g) => [g.label, n(g.pages), f2(g.ai_ism_per1000), `${f2(g.ai_ism_ci[0])} to ${f2(g.ai_ism_ci[1])}`, f2(g.ai_tell_per1000), f2(g.em_dash_per1000), pct(g.share_with_delve, 1)]) },
    },
    {
      heading: "Where each word was most at home",
      paragraphs: ["Words with at least 20 uses across everything measured. 'Times its overall rate' compares the word's rate in its home with its rate across all the writing measured."],
      table: { columns: ["Word", "Uses", "Home", "Times its overall rate", "Runner-up"], rows: S.homes.filter((h) => h.home).sort((a, b) => b.home_ratio - a.home_ratio).map((h) => [word(h.word), n(h.uses), L(h.home), f1(h.home_ratio), L(h.runner_up)]) },
    },
    {
      heading: "Each word in Google Books",
      table: { columns: ["Word", "1950", "1980", "2019", "2019 vs 1980", "Take-off year"], rows: [...S.ngram].sort((a, b) => (a.takeoff_year ?? 9999) - (b.takeoff_year ?? 9999)).map((w) => [word(w.word), f2(w.per_million_1950), f2(w.per_million_1980), f2(w.per_million_2019), w.ratio_2019_1980 == null ? "new" : `${f1(w.ratio_2019_1980)}x`, w.takeoff_year ? String(w.takeoff_year) : "none"]) },
    },
    {
      heading: "Coverage",
      paragraphs: ["What happened to every page or passage read, by kind of writing."],
      table: { columns: ["Kind of writing", "Measured", "Too short", "No capture"], rows: Object.entries(S.status).map(([g, s]) => [L(g), n(s.measured ?? 0), n(s.too_short ?? 0), n(s.no_capture ?? 0)]) },
    },
  ],
  limitations: [
    "One snapshot of the web (October 2021) and a few sources per kind of writing. A different month or different outlets would move individual numbers; the large gaps, such as press releases against news, are the finding, not the decimals.",
    "Word lists were taken from studies of what models over-use, so finding them in press releases describes where those words lived; it does not show that press releases were over-represented in any model's training data.",
    "Pre-1928 books are a different era as well as a different genre, so their high rate of AI sentence shapes may reflect period style as much as genre.",
    "The sentence-shape scan is ScriptGrain's own instrument; it over-fires on some ordinary sentences, and another checker would count differently.",
    "Some 'homes' rest on a few dozen uses. The table shows the counts.",
  ],
  reproducibility: [
    "Pre-registration, sources, word lists and every script: docs/research/sgr-007-preregistration.md and scripts/experiments/sgr-007/ in the ScriptGrain repository.",
    "Every web page in the data is named by URL and Common Crawl capture time, so any page can be fetched again from the CC-MAIN-2021-43 archive and measured.",
  ],
  dataDownloads: [
    { label: "Every page and passage measured (CSV)", path: "/research/sgr-007-pages.csv", format: "csv" },
    { label: "Summary: groups, hypotheses, word homes, Google Books (JSON)", path: "/research/sgr-007-summary.json", format: "json" },
    { label: "arXiv: share of all eligible abstracts containing each 2024 tell word (JSON)", path: "/research/sgr-007-arxiv-presence.json", format: "json" },
  ],
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  howToCite: `ScriptGrain (2026). ${TITLE} (Study SGR-007, conducted 4 October 2026). Dataset licensed CC BY 4.0. ${PAGE_URL}`,
  citations: [
    { name: "Hern, A. (2024). TechScape: How cheap, outsourced labour in Africa is shaping AI English. The Guardian", url: "https://www.theguardian.com/technology/2024/apr/16/techscape-ai-gadgest-humane-ai-pin-chatgpt" },
    { name: "Kobak, D. et al. (2025). Delving into LLM-assisted writing in biomedical publications through excess vocabulary. Science Advances", url: "https://doi.org/10.1126/sciadv.adt3813" },
    { name: "Kousha, K. et al. (2025). How much are LLMs changing the language of academic papers after ChatGPT? arXiv:2509.09596", url: "https://arxiv.org/abs/2509.09596" },
    { name: "ScriptGrain (2026). The AI tells moved: 2.1 million arXiv abstracts, 2015 to 2026 (SGR-008)", url: "https://scriptgrain.com/research/the-ai-tells-moved" },
    { name: "Common Crawl, CC-MAIN-2021-43", url: "https://commoncrawl.org/" },
    { name: "arXiv (abstracts via the OAI-PMH interface)", url: "https://arxiv.org/" },
    { name: "Google Books Ngram Viewer", url: "https://books.google.com/ngrams" },
  ],
};

const P = "src/data/research-pages.json";
const data = JSON.parse(readFileSync(P, "utf8"));
const i = data.studies.findIndex((s) => s.id === study.id);
if (i === -1) data.studies.push(study); else data.studies[i] = study;
writeFileSync(P, JSON.stringify(data, null, 2) + "\n");
writeFileSync("public/research-pages.json", JSON.stringify(data));
console.error(`SGR-007 ${i === -1 ? "added" : "updated"}; publishOn ${PUBLISH_ON}`);
