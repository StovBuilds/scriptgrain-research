#!/usr/bin/env bun
// SGR-009 scorer: pre-registration section 4. Every ordered pair of included pages,
// scored with the production computation (scorePieces: measureTextFeatures ->
// pseudoProfileFromText -> computeVoiceMatch, no phrases), once per judge run plus a
// measured-only run (judge null). Writes features.json (per page: counted features and
// every judge output; no text) and pairs.csv (no text).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  measureTextFeatures, pseudoProfileFromText, computeVoiceMatch,
  type MeasuredFeatures, type JudgedFeatures,
} from "../../../supabase/functions/_shared/voice-match.ts";

const dir = new URL(".", import.meta.url).pathname;
type Corpus = Record<string, { sector: string; pages: { type: string; url: string; words: number; text: string }[] }>;
const corpus = JSON.parse(readFileSync(dir + "corpus.json", "utf8")) as Corpus;
export const RUNS = ["J1a", "J1b", "J2a", "J2b", "J2c"].filter((r) => existsSync(`${dir}judged-${r}.json`));
const judged: Record<string, Record<string, JudgedFeatures | null>> = {};
for (const r of RUNS) judged[r] = JSON.parse(readFileSync(`${dir}judged-${r}.json`, "utf8"));
const COLS = [...RUNS, "none"];

interface Page { id: number; url: string; brand: string; sector: string; type: string; words: number; m: MeasuredFeatures }
const pages: Page[] = [];
for (const [brand, b] of Object.entries(corpus)) {
  if (b.pages.length < 2) continue; // inclusion rule: at least 2 pages
  for (const p of b.pages) pages.push({ id: pages.length, url: p.url, brand, sector: b.sector, type: p.type, words: p.words, m: measureTextFeatures(p.text) });
}

const NO_PHRASES = { pool: 0, hits: 0, found: [] as string[] };
const j = (run: string, p: Page) => (run === "none" ? null : judged[run][p.url] ?? null);
const lines = [["a", "b", "kind", "same_type", ...COLS].join(",")];
for (const a of pages) {
  const pseudo = Object.fromEntries(COLS.map((c) => [c, pseudoProfileFromText(a.m, j(c, a))]));
  for (const b of pages) {
    if (a.id === b.id) continue;
    const kind = a.brand === b.brand ? "SB" : a.sector === b.sector ? "SS" : "XS";
    const raws = COLS.map((c) => computeVoiceMatch(pseudo[c], b.m, j(c, b), NO_PHRASES)!.raw.toFixed(4));
    lines.push([a.id, b.id, kind, a.type === b.type ? 1 : 0, ...raws].join(","));
  }
}
writeFileSync(dir + "pairs.csv", lines.join("\n") + "\n");
writeFileSync(dir + "features.json", JSON.stringify(pages.map(({ m, ...p }) => ({ ...p, measured: m, judged: Object.fromEntries(RUNS.map((r) => [r, judged[r][p.url] ?? null])) }))));
console.log("pages", pages.length, "brands", new Set(pages.map((p) => p.brand)).size, "pairs", lines.length - 1, "runs", COLS.join(" "));
