#!/usr/bin/env bun
// SGR-006 robustness check (added after the main run, disclosed on the page):
// web pages carry headings, captions, list items and reference entries that the
// sentence measure reads as very short sentences, which books do not. This
// re-fetches the web pages behind H2/H3's web comparison and re-measures them on
// PROSE LINES only (8+ words, ending in sentence punctuation), and applies the
// same filter to the non-fiction book passages, so the comparison is like for like.
//
//   bun scripts/experiments/sgr-006/prose-check.mjs --cluster <cluster.idx> --web web.jsonl --books books.jsonl --cache <book texts> --out prose-check.json
import { readFileSync, writeFileSync } from "node:fs";
import { loadCluster, capturesFor, fetchRecord } from "../sgr-007/cc-index.mjs";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";

const args = process.argv.slice(2);
const opt = (n) => args[args.indexOf(n) + 1];
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const jl = (f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const PROSE = (line) => line.trim().split(/\s+/).length >= 8 && /[.!?]["”')]?$/.test(line.trim());
const proseOnly = (text) => text.split(/\n+/).filter(PROSE).join("\n\n");
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const r2 = (x) => Math.round(x * 100) / 100;

const cluster = loadCluster(opt("--cluster"));
const web = jl(opt("--web")).filter((r) => CFG.web.nonfiction_for_H2_H3.includes(r.group));
const out = { web: {}, books: {} };
const q = [...web];
const res = [];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (q.length) {
    const r = q.shift();
    const caps = await capturesFor(CFG.web.collection, cluster, r.id.replace(/^https?:\/\//, "").replace(/\?.*$/, ""), { maxBlocks: 2 });
    const c = caps.find((x) => x.url === r.id && x.status === "200");
    if (!c) continue;
    const t = proseOnly(htmlToText((await fetchRecord(c)) || "").text);
    if (t.split(/\s+/).length < 100) continue;
    res.push({ group: r.group, all: r.sentence_length, prose: measureTextFeatures(t).avg_sentence_length, contractions: measureTextFeatures(t).contraction_frequency });
  }
}));
for (const g of CFG.web.nonfiction_for_H2_H3) {
  const m = res.filter((x) => x.group === g);
  out.web[g] = { pages: m.length, all_text: r2(mean(m.map((x) => x.all))), prose_only: r2(mean(m.map((x) => x.prose))), contractions_prose_only: r2(mean(m.map((x) => x.contractions))) };
}
out.web.pooled = { pages: res.length, all_text: r2(mean(res.map((x) => x.all))), prose_only: r2(mean(res.map((x) => x.prose))), contractions_prose_only: r2(mean(res.map((x) => x.contractions))) };

// Books: rebuild the same passages from the cached texts and apply the same filter.
const B = CFG.books, words = (t) => t.split(/\s+/).filter(Boolean).length;
const books = jl(opt("--books")).filter((r) => B.nonfiction_for_H2_H3.includes(r.group));
const byEra = {};
for (const r of books) {
  let t = readFileSync(`${opt("--cache")}/${r.id}.txt`, "utf8").replace(/\r/g, "");
  const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/);
  if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined);
  const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => words(p) > 12 && !/^(CHAPTER|BOOK|VOLUME|PART|SECTION|LETTER|ACT|SCENE|[IVXLC]+\.)\b/i.test(p));
  const total = paras.reduce((s, p) => s + words(p), 0);
  let acc = 0, i = 0; while (i < paras.length && acc < total * B.positions[r.piece]) acc += words(paras[i++]);
  const piece = []; let w = 0; while (i < paras.length && w < B.piece_words) { piece.push(paras[i]); w += words(paras[i++]); }
  const prose = proseOnly(piece.join("\n"));
  if (words(prose) < 100) continue;
  (byEra[r.era] ??= []).push({ all: r.sentence_length, prose: measureTextFeatures(prose).avg_sentence_length });
}
for (const [e, m] of Object.entries(byEra)) out.books[e] = { passages: m.length, all_text: r2(mean(m.map((x) => x.all))), prose_only: r2(mean(m.map((x) => x.prose))) };
writeFileSync(opt("--out"), JSON.stringify(out, null, 1));
console.error(JSON.stringify(out));
