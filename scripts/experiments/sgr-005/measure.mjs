#!/usr/bin/env bun
// SGR-005: five ~1,000-word passages per panel work (10/30/50/70/90% of the
// body, paragraph boundaries), each measured as narration (paired double-quoted
// runs removed; the primary measure) and as all text. Numbers only.
//
//   bun scripts/experiments/sgr-005/measure.mjs --cache <text dir> --out <rows.jsonl>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CACHE = opt("--cache", null), OUT = opt("--out", null);
const { authors } = JSON.parse(readFileSync(new URL("./panel.json", import.meta.url), "utf8"));
const POS = [0.1, 0.3, 0.5, 0.7, 0.9], PIECE = 1000;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

function body(id) {
  let t = readFileSync(`${CACHE}/${id}.txt`, "utf8").replace(/\r/g, "");
  const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/);
  if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined);
  return t;
}
// Paired double quotes, straight or curly; a quote may run across line breaks
// inside one paragraph but never across paragraphs.
const QUOTED = /"[^"\n]*(?:\n(?!\s*\n)[^"\n]*)*"|“[^”]*?”/g;
const words = (t) => t.split(/\s+/).filter(Boolean).length;

function features(text) {
  const w = words(text);
  if (w < 200) return null;
  const f = measureTextFeatures(text), s = scanCliches(text);
  return {
    words: w,
    sentence_length: r3(f.avg_sentence_length),
    sentence_cv: r3(s.burstiness.variation),
    commas_per_sentence: r3(f.comma_density),
    semicolons_per1000: r3(f.semicolon_frequency),
    contractions_per1000: r3(f.contraction_frequency),
    exclamations_per1000: r3(f.exclamation_rate),
    long_word_share: r3(f.word_length_distribution?.long),
    pronoun_i: r3(f.pronoun_distribution?.I), pronoun_we: r3(f.pronoun_distribution?.we), pronoun_you: r3(f.pronoun_distribution?.you),
    em_dash_per1000: r3(((text.match(/—|--/g) ?? []).length / w) * 1000),
    ai_tell_per1000: r3(s.per1000),
  };
}

const out = [];
for (const a of authors) for (const work of a.works) {
  if (!existsSync(`${CACHE}/${work.pg}.txt`)) continue;
  const paras = body(work.pg).split(/\n\s*\n/).map((p) => p.trim()).filter((p) => words(p) > 12 && !/^(CHAPTER|BOOK|VOLUME|PART|SECTION|LETTER|[IVXLC]+\.)\b/i.test(p));
  const total = paras.reduce((s, p) => s + words(p), 0);
  POS.forEach((pos, k) => {
    let acc = 0, i = 0;
    while (i < paras.length && acc < total * pos) acc += words(paras[i++]);
    const piece = [];
    let w = 0;
    while (i < paras.length && w < PIECE) { piece.push(paras[i]); w += words(paras[i++]); }
    const all = piece.join("\n\n").replace(/[ \t]*\n(?!\s*\n)[ \t]*/g, " ").replace(/\n{2,}/g, "\n\n");
    const narration = all.replace(QUOTED, " ").replace(/[ \t]{2,}/g, " ");
    const dialogue_share = r3(1 - words(narration) / words(all));
    out.push({ author: a.id, name: a.name, born: a.born, work: work.work, title: work.title, year: work.year, age: work.year - a.born, piece: k, dialogue_share, narration: features(narration), all: features(all) });
  });
}
writeFileSync(OUT, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.error(`${out.length} passages from ${new Set(out.map((r) => r.work)).size} works by ${new Set(out.map((r) => r.author)).size} authors`);
