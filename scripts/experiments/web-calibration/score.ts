#!/usr/bin/env bun
// DESK-415 offline scorer. Mirrors voice-check-run.ts::scorePieces with the production
// code (measureTextFeatures, pseudoProfileFromText, computeVoiceMatch,
// calibratePairwiseScore) on judged.json, for every ordered page pair in corpus.json.
// Also scores an experimental "genre baseline" variant (see baselineRaw). Writes
// pairs.jsonl (no text): main, other, kind, raw, raw_baseline.
import { readFileSync, writeFileSync } from "node:fs";
import {
  measureTextFeatures, pseudoProfileFromText, computeVoiceMatch,
  type MeasuredFeatures, type JudgedFeatures,
} from "../../../supabase/functions/_shared/voice-match.ts";

const dir = new URL(".", import.meta.url).pathname;
const corpus = JSON.parse(readFileSync(dir + "corpus.json", "utf8")) as Record<string, { sector: string; pages: { url: string; text: string }[] }>;
const judged = JSON.parse(readFileSync(dir + "judged.json", "utf8")) as Record<string, JudgedFeatures>;

export interface Page { url: string; brand: string; sector: string; m: MeasuredFeatures; j: JudgedFeatures | null }
export const pages: Page[] = [];
for (const [brand, { sector, pages: ps }] of Object.entries(corpus)) {
  for (const p of ps) pages.push({ url: p.url, brand, sector, m: measureTextFeatures(p.text), j: judged[p.url] ?? null });
}

const med = (xs: number[]) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mode = (xs: unknown[]) => { const c = new Map<string, number>(); for (const x of xs) if (x != null) c.set(JSON.stringify(x), (c.get(JSON.stringify(x)) ?? 0) + 1); let best: string | null = null, n = 0; for (const [k, v] of c) if (v > n) { best = k; n = v; } return best === null ? null : JSON.parse(best); };
const meanDist = (ds: Record<string, number>[]) => { const out: Record<string, number> = {}; for (const d of ds) for (const [k, v] of Object.entries(d ?? {})) out[k] = (out[k] ?? 0) + v / ds.length; return out; };

/** A "typical web copy" piece: medians / modes over a set of pages. */
export function baselineOf(set: Page[]): { m: MeasuredFeatures; j: JudgedFeatures } {
  const M = set.map((p) => p.m);
  const num = (k: keyof MeasuredFeatures) => med(M.map((x) => x[k] as number)) as number;
  const m = {
    word_count: num("word_count"), avg_sentence_length: num("avg_sentence_length"), sentence_length_variance: num("sentence_length_variance"),
    contraction_frequency: num("contraction_frequency"), comma_density: num("comma_density"), exclamation_rate: num("exclamation_rate"),
    semicolon_frequency: num("semicolon_frequency"), parenthetical_rate: num("parenthetical_rate"),
    question_mark_in_body: mode(M.map((x) => x.question_mark_in_body)) as boolean, ellipsis_per_1000: num("ellipsis_per_1000"),
    pronoun_distribution: meanDist(M.map((x) => x.pronoun_distribution)), the_a_an_ratio: meanDist(M.map((x) => x.the_a_an_ratio)),
    word_length_distribution: meanDist(M.map((x) => x.word_length_distribution)),
  } as MeasuredFeatures;
  const J = set.map((p) => p.j).filter(Boolean) as JudgedFeatures[];
  const j: JudgedFeatures = {};
  const keys = new Set(J.flatMap((x) => Object.keys(x)));
  for (const k of keys) {
    const vals = J.map((x) => x[k]);
    j[k] = vals.every((v) => typeof v === "number") ? med(vals as number[]) : mode(vals);
  }
  return { m, j };
}

const NO_PHRASES = { pool: 0, hits: 0, found: [] as string[] };
/** Production raw: exactly what scorePieces computes. */
export function prodRaw(main: Page, other: Page): number {
  const pseudo = pseudoProfileFromText(main.m, main.j);
  return computeVoiceMatch(pseudo, other.m, other.j, NO_PHRASES)!.raw;
}

/**
 * Genre-baseline variant: each feature's weight is scaled by how far the MAIN piece sits
 * from typical web copy on that feature (1 - sim(baseline, main)), floored at `floor`.
 * A feature where the main piece is generic (every bank page is formal 7/10, humour
 * none) stops carrying the score; features where it is distinctive carry it.
 */
export function baselineRaw(main: Page, other: Page, base: { m: MeasuredFeatures; j: JudgedFeatures }, floor = 0.15, power = 1): number {
  const pseudo = pseudoProfileFromText(main.m, main.j);
  const comp = computeVoiceMatch(pseudo, other.m, other.j, NO_PHRASES)!;
  const ref = computeVoiceMatch(pseudo, base.m, base.j, NO_PHRASES)!;
  const typical = new Map(ref.deltas.map((d) => [d.feature, d.similarity]));
  let num = 0, den = 0;
  for (const d of comp.deltas) {
    const t = typical.get(d.feature);
    const w = d.weight * Math.max(floor, Math.pow(1 - (t ?? 0), power));
    num += w * d.similarity; den += w;
  }
  return den ? num / den : comp.raw;
}

if (import.meta.main) {
  const ok = pages.filter((p) => p.j);
  const rows: string[] = [];
  for (const a of ok) {
    // baseline built WITHOUT the main brand (and without its sector, for honesty: leave-sector-out)
    const baseAll = baselineOf(ok.filter((p) => p.brand !== a.brand));
    const baseOut = baselineOf(ok.filter((p) => p.sector !== a.sector));
    for (const b of ok) {
      if (a.url === b.url) continue;
      const kind = a.brand === b.brand ? "same_brand" : a.sector === b.sector ? "same_sector" : "cross_sector";
      rows.push(JSON.stringify({
        main: a.url, other: b.url, mb: a.brand, ob: b.brand, sector: a.sector, kind,
        raw: +prodRaw(a, b).toFixed(4),
        raw_base: +baselineRaw(a, b, baseAll).toFixed(4),
        raw_base_lso: +baselineRaw(a, b, baseOut).toFixed(4),
      }));
    }
  }
  writeFileSync(dir + "pairs.jsonl", rows.join("\n") + "\n");
  console.log("pages", ok.length, "of", pages.length, "pairs", rows.length);
}
