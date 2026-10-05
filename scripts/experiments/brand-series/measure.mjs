#!/usr/bin/env bun
// Brand writing series (SGR-010..018): measure every page of the brand corpus, exactly as
// docs/research/brand-series-preregistration.md sections 1-2 say. Reads each brand's file
// from the Storage Box, writes numbers only (no text):
//   measures.jsonl   one row per kept page
//   exclusions.json  counts per brand and reason
//   bun scripts/experiments/brand-series/measure.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { measure } from "../sgr-007/instruments.mjs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { measureBurstiness, splitSentences } from "../../../supabase/functions/_shared/ai-cliches.ts";
import { bestDate } from "../brand-corpus/dates.mjs";

const dir = new URL(".", import.meta.url).pathname;
const RCLONE = "rclone", REMOTE = "storagebox:research/scriptgrain-brand-corpus/v1/pages";
const { brands } = JSON.parse(readFileSync(dir + "../brand-corpus/brands.json", "utf8"));

/** Markdown -> plain text: images, link targets, tables, code and markdown symbols out; headings and list items kept as lines. */
export function mdToPlain(md) {
  return md
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .filter((l) => !/^\s*\|/.test(l) && !/^\s*[-|: ]+\s*$/.test(l))
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s+/, "").replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/(\*\*|__|\*|_)(\S[\s\S]*?\S|\S)\1/g, "$2").replace(/\\([\\`*_{}[\]()#+.!-])/g, "$1").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const words = (t) => (t.match(/\S+/g) ?? []).length;
export function era(d) {
  if (!d) return null;
  if (d < "2015") return "PRE2015";
  if (d < "2019") return "EARLY";
  if (d < "2022-12") return "LATE";
  if (d < "2024") return "TRANSITION";
  return "AFTER";
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

if (import.meta.main) {
const out = [], excl = {};
const bump = (b, k) => { (excl[b] ??= {})[k] = (excl[b][k] ?? 0) + 1; };
for (const b of brands) {
  let rows = [];
  try { rows = gunzipSync(execFileSync(RCLONE, ["cat", `${REMOTE}/${b.domain}.jsonl.gz`], { maxBuffer: 1 << 30 })).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { bump(b.domain, "no_file"); continue; }
  const seen = new Set();
  // oldest first, so "the later copy goes" for exact duplicates
  rows.sort((x, y) => (bestDate(x).date ?? "9999").localeCompare(bestDate(y).date ?? "9999"));
  for (const r of rows) {
    const text = mdToPlain(r.markdown ?? "");
    const w = words(text);
    if (w < 150) { bump(b.domain, "under_150_words"); continue; }
    const h = createHash("sha256").update(text).digest("hex");
    if (seen.has(h)) { bump(b.domain, "duplicate_text"); continue; }
    seen.add(h);
    // Deviation 1 (2026-10-05): share of WORDS in lines of six words or fewer, not share of lines.
    const shortWords = text.split("\n").filter((l) => l.trim() && words(l) <= 6).reduce((a, l) => a + words(l), 0);
    if (shortWords / w > 0.4) { bump(b.domain, "list_like"); continue; }
    const { date, source: dsrc } = bestDate(r);
    const m = measure(text, w);
    const f = measureTextFeatures(text);
    const burst = measureBurstiness(text);
    const sentences = splitSentences(text);
    const pron = f.pronoun_distribution ?? {};
    const tokens = text.match(/[A-Za-z]+/g) ?? [];
    out.push({
      brand: b.domain, sector: b.sector, study: b.study, category: r.category, source: r.source ?? "live",
      url: r.url, wayback_ts: r.wayback_ts ?? null, date, date_source: dsrc, era: era(date),
      words: w,
      ai_ism_per1000: m.ai_ism_per1000, old_per1000: m.old_per1000, called_out_per1000: m.called_out_per1000,
      marketing_per1000: m.marketing_per1000, quiet_per1000: m.quiet_per1000,
      ai_shape_per1000: m.ai_tell_per1000,
      em_dash_per1000: r3(((text.match(/—/g) ?? []).length + (text.match(/ – /g) ?? []).length) / w * 1000),
      avg_sentence_length: m.avg_sentence_length,
      sentence_variation: burst.variation, short_sentence_share: burst.shortShare,
      contractions_per1000: m.contraction_frequency, commas_per_sentence: m.comma_density,
      exclamations_per1000: r3((text.match(/!/g) ?? []).length / w * 1000),
      questions_per1000: r3((text.match(/\?/g) ?? []).length / w * 1000),
      you_share: r3(pron.you ?? null), we_share: r3(pron.we ?? null), i_share: r3(pron.I ?? pron.i ?? null),
      long_word_share: r3(tokens.length ? tokens.filter((t) => t.length >= 7).length / tokens.length : null),
      sentences: sentences.length,
    });
  }
  console.log(b.sector.padEnd(9), b.domain.padEnd(30), "kept", out.filter((x) => x.brand === b.domain).length, JSON.stringify(excl[b.domain] ?? {}));
}
writeFileSync(dir + "measures.jsonl", out.map((x) => JSON.stringify(x)).join("\n") + "\n");
writeFileSync(dir + "exclusions.json", JSON.stringify(excl, null, 1));
console.log("pages kept", out.length);
}
