#!/usr/bin/env bun
// SGR-008 step 2: measure every harvested arXiv abstract with the product's own
// instruments and write one row of numbers per paper. No text leaves this
// script: rows hold the arXiv id, year, category and counts/rates only.
//
//   bun scripts/experiments/sgr-008/measure.mjs --cache ~/research/sgr-008/harvest [--out ~/research/sgr-008/rows.json]
//
// Year comes from the arXiv identifier (YYMM.nnnnn = first submission), not the
// search window, so a paper revised in a later year still counts in the year it
// was first written. Non-arXiv hits (journal DOIs) are dropped. A paper found by
// more than one cell is measured once, under the first category that found it.
// LaTeX math ($...$) and commands are stripped before measuring.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CACHE = opt("--cache", null);
const OUT = opt("--out", `${CACHE}/../rows.json`);
const MIN_WORDS = 60;
const lex = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));
const toRe = (w) => new RegExp(`\\b${w.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*$|\*$/, "\\w*")}\\b`, "gi");
const groups = ["called_out", "quiet", "control"];
const lexRes = Object.fromEntries(groups.map((k) => [k, lex[k].map((w) => [w, toRe(w)])]));
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

const clean = (s) => s
  .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " X ")          // inline/display math -> one token
  .replace(/\\(?:cite|ref|label)\{[^}]*\}/g, " ")
  .replace(/\\[a-zA-Z]+\*?(\{[^}]*\})?/g, (m, g) => (g ? g.slice(1, -1) : " "))
  .replace(/---/g, "—").replace(/--/g, "–")
  .replace(/[{}~]/g, " ").replace(/\s+/g, " ").trim();

const seen = new Set();
const rows = [];
let dropped = { non_arxiv: 0, old_id: 0, short: 0, dup: 0, truncated: 0 };
for (const f of readdirSync(CACHE).sort()) {
  if (!f.endsWith(".json")) continue;
  const cell = JSON.parse(readFileSync(`${CACHE}/${f}`, "utf8"));
  for (const p of cell.results) {
    const m = p.primaryId.match(/^arxiv:(\d{2})(\d{2})\.\d{4,5}$/);
    if (!p.primaryId.startsWith("arxiv:")) { dropped.non_arxiv++; continue; }
    if (!m) { dropped.old_id++; continue; }
    if (seen.has(p.primaryId)) { dropped.dup++; continue; }
    seen.add(p.primaryId);
    if (/…$/.test(p.abstract)) { dropped.truncated++; continue; }
    const t = clean(p.abstract);
    const words = t.split(/\s+/).filter(Boolean).length;
    if (words < MIN_WORDS) { dropped.short++; continue; }
    const feat = measureTextFeatures(t);
    const scan = scanCliches(t);
    const per1k = (n) => r2((n / words) * 1000);
    const lexOut = {};
    for (const k of groups) {
      let total = 0; const hits = {};
      for (const [w, re] of lexRes[k]) { const c = (t.match(re) ?? []).length; if (c) { hits[w] = c; total += c; } }
      lexOut[`${k}_per1000`] = per1k(total); lexOut[`${k}_hits`] = hits;
    }
    const pat = Object.fromEntries(scan.patterns.map((x) => [x.id, x.count]));
    rows.push({
      id: p.primaryId.slice(6), year: 2000 + +m[1], month: +m[2], cat: cell.cat, query: cell.query, words,
      avg_sentence_length: r2(feat.avg_sentence_length),
      sentence_length_variance: r2(feat.sentence_length_variance),
      comma_density: r2(feat.comma_density),
      semicolon_frequency: r2(feat.semicolon_frequency),
      pronoun_we: r2(feat.pronoun_distribution?.we), pronoun_i: r2(feat.pronoun_distribution?.I),
      word_long: r2(feat.word_length_distribution?.long),
      ai_tell_per1000: scan.per1000,
      ai_tell_phrases: Object.fromEntries(scan.phrases.map((x) => [x.phrase, x.count])),
      not_x_but_y: pat.not_x_but_y ?? 0, triadic_list: pat.triadic_list ?? 0,
      em_only_per1000: per1k((t.match(/—/g) ?? []).length),
      burstiness_variation: r2(scan.burstiness.variation),
      ...lexOut,
    });
  }
}
writeFileSync(OUT, JSON.stringify(rows));
console.error(`${rows.length} abstracts measured; dropped ${JSON.stringify(dropped)}`);
