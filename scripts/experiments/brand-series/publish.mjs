#!/usr/bin/env bun
// Brand writing series: public dataset (numbers only, no page text) to public/research/.
//   brand-writing-pages.csv  one row per measured page (16,392)
//   sgr-010-summary.json / sgr-011-summary.json  the analysis outputs
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const OUT = "public/research";
const P = readFileSync(dir + "measures.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const cols = ["brand", "sector", "category", "source", "url", "wayback_ts", "date", "date_source", "era", "words", "ai_ism_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "quiet_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "sentence_variation", "short_sentence_share", "contractions_per1000", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "you_share", "we_share", "i_share", "long_word_share"];
const cell = (v) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(`${OUT}/brand-writing-pages.csv`, [cols.join(","), ...P.map((p) => cols.map((c) => cell(p[c])).join(","))].join("\n") + "\n");
copyFileSync(dir + "summary-010.json", `${OUT}/sgr-010-summary.json`);
copyFileSync(dir + "summary-011.json", `${OUT}/sgr-011-summary.json`);
console.error("rows", P.length);
