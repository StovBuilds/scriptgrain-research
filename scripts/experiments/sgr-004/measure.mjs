#!/usr/bin/env bun
// SGR-004 step 2: measure every cached homepage with the product's own
// instruments and write one row of numbers per site-year. No text leaves this
// script: rows hold counts and rates only.
//
//   bun scripts/experiments/sgr-004/measure.mjs --cache <dir> [--out public/research/sgr-004-web-copy-rows.json]
//
// Text extraction. The product's htmlToText is built for ARTICLES: it drops
// <header>, <form> and <aside> subtrees, which on a homepage is where the hero
// copy lives (and ASP.NET sites wrap the whole page in one <form>). So this
// study uses homepageText (homepage-text.mjs): the same block splitting, entity decoding and
// prose-line rule as htmlToText, minus those three drops, plus removal of exact
// repeated lines (desktop and mobile copies of one carousel). The article
// extractor's word count is kept alongside (words_article) for comparison.
// A page with under MIN_WORDS words of prose is recorded as excluded, not
// measured; exclusions are reported per year so the bias is visible.
//
// --source raw|rendered: raw = Wayback's original HTML (crawl.mjs); rendered =
// the same capture rendered with JavaScript by Firecrawl (render.mjs).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
import { homepageText } from "./homepage-text.mjs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CACHE = opt("--cache", null);
const SOURCE = opt("--source", "raw");
const OUT = opt("--out", "public/research/sgr-004-web-copy-rows.json");
const MIN_WORDS = 100;
const BOT_WALL = /request has been blocked|access denied|just a moment\.\.\.|attention required|enable javascript and cookies|are you a robot|verify you are (a )?human|captcha|site can.t be reached|page not found|404 not found|domain (is )?for sale|this domain may be for sale/i;
const { sites } = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));
const lex = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));
const sectorOf = Object.fromEntries(sites.map((s) => [s.domain, s.sector]));

const toRe = (w) => new RegExp(`\\b${w.replace(/[.+?^${}()|[\]\\-]/g, (c) => (c === "-" ? "[- ]" : `\\${c}`)).replace(/\\\*$|\*$/, "\\w*")}\\b`, "gi");
const lexRes = Object.fromEntries(["ai_era", "dotcom_corporate"].map((k) => [k, lex[k].map((w) => [w, toRe(w)])]));
const r1 = (x) => (x == null ? null : Math.round(x * 100) / 100);

const rows = [];
const files = readdirSync(CACHE);
for (const f of files) {
  const m = f.match(/^(.+)\.(\d{4})\.html(\.fail)?$/);
  if (!m) continue;
  const [, domain, year, fail] = m;
  const base = { domain, sector: sectorOf[domain], year: +year, source: SOURCE };
  // A redirect hop that failed leaves the holding page AND a .fail; count the page.
  if (fail && files.includes(f.replace(/\.fail$/, ""))) continue;
  if (fail) {
    const why = readFileSync(`${CACHE}/${f}`, "utf8");
    rows.push({ ...base, status: SOURCE === "rendered" && !why.startsWith("no capture") ? "render_failed" : "no_capture" });
    continue;
  }
  const html = readFileSync(`${CACHE}/${f}`, "utf8");
  const ts = (html.match(/^<!-- sgr004 ts=(\d{14})/) || [])[1];
  const page = homepageText(html);
  const words_article = htmlToText(html).words;
  // A capture that was itself a redirect, replayed as Wayback's holding page
  // and not resolved by render.mjs's redirect-following.
  if (/Got an HTTP 30\d response at crawl time/.test(html)) { rows.push({ ...base, capture: ts, status: "archive_redirect" }); continue; }
  // archive.org's own page instead of a capture: the site is not available in the
  // Wayback Machine (booking.com, yelp.com), so the request never resolved.
  // (Its donation banner also survives in some real renders, so test the title.)
  if ((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() === "Wayback Machine") { rows.push({ ...base, capture: ts, status: "no_capture" }); continue; }
  // Wayback sometimes archived a bot wall instead of the homepage.
  if (BOT_WALL.test(page.text.slice(0, 600)) || BOT_WALL.test(page.title)) { rows.push({ ...base, capture: ts, status: "bot_wall" }); continue; }
  if (page.words < MIN_WORDS) { rows.push({ ...base, capture: ts, status: "too_little_prose", words: page.words }); continue; }
  const t = page.text;
  const feat = measureTextFeatures(t);
  const scan = scanCliches(t);
  const per1k = (n) => r1((n / page.words) * 1000);
  const lexCounts = Object.fromEntries(Object.entries(lexRes).map(([k, list]) => {
    const hits = {};
    let total = 0;
    for (const [w, re] of list) { const c = (t.match(re) ?? []).length; if (c) { hits[w] = c; total += c; } }
    return [k, { per1000: per1k(total), hits }];
  }));
  const pat = Object.fromEntries(scan.patterns.map((p) => [p.id, p.count]));
  rows.push({
    ...base, capture: ts, status: "measured", words: page.words, words_article,
    avg_sentence_length: r1(feat.avg_sentence_length),
    sentence_length_variance: r1(feat.sentence_length_variance),
    comma_density: r1(feat.comma_density),
    exclamation_rate: r1(feat.exclamation_rate),
    semicolon_frequency: r1(feat.semicolon_frequency),
    contraction_frequency: r1(feat.contraction_frequency),
    question_mark_in_body: feat.question_mark_in_body,
    pronoun_i: r1(feat.pronoun_distribution?.I), pronoun_we: r1(feat.pronoun_distribution?.we), pronoun_you: r1(feat.pronoun_distribution?.you),
    word_short: r1(feat.word_length_distribution?.short), word_medium: r1(feat.word_length_distribution?.medium), word_long: r1(feat.word_length_distribution?.long),
    ai_tell_per1000: scan.per1000,
    ai_tell_phrases: Object.fromEntries(scan.phrases.map((p) => [p.phrase, p.count])),
    not_x_but_y: pat.not_x_but_y ?? 0, triadic_list: pat.triadic_list ?? 0,
    em_dash_per1000: per1k(pat.em_dash ?? 0),
    // scanCliches counts em and en dashes together; en dashes also mark ranges
    // ("2000\u20132026"), so the em dash is counted on its own too.
    em_only_per1000: per1k((t.match(/\u2014/g) ?? []).length),
    burstiness_variation: r1(scan.burstiness.variation), short_sentence_share: r1(scan.burstiness.shortShare),
    ai_era_vocab_per1000: lexCounts.ai_era.per1000, ai_era_vocab_hits: lexCounts.ai_era.hits,
    dotcom_vocab_per1000: lexCounts.dotcom_corporate.per1000, dotcom_vocab_hits: lexCounts.dotcom_corporate.hits,
  });
}
// Every panel site-year gets a row: one with no file at all here was never
// rendered because the raw crawl found no capture for it.
const seen = new Set(rows.map((r) => `${r.domain}.${r.year}`));
for (const st of sites) for (let year = 2000; year <= 2026; year++) {
  if (!seen.has(`${st.domain}.${year}`)) rows.push({ domain: st.domain, sector: st.sector, year, source: SOURCE, status: "no_capture" });
}
rows.sort((a, b) => a.domain.localeCompare(b.domain) || a.year - b.year);
writeFileSync(OUT, JSON.stringify(rows));
const by = (s) => rows.filter((r) => r.status === s).length;
console.error(`${rows.length} site-years: ${by("measured")} measured, ${by("too_little_prose")} too little prose, ${by("bot_wall")} bot wall, ${by("archive_redirect")} unresolved archive redirect, ${by("no_capture")} no capture`);
