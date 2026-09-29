import { readFileSync } from "node:fs";
import { measureTextFeatures, pseudoProfileFromText, computeVoiceMatch } from "../../../supabase/functions/_shared/voice-match.ts";
const corpus: Record<string, { short: string; long: string }[]> = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url), "utf8"));
const ref = JSON.parse(readFileSync(new URL("../../../src/data/reference-corpus.json", import.meta.url), "utf8"));
const auc = (pos: number[], neg: number[]) => { let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0; return +(w / (pos.length * neg.length)).toFixed(3); };
const sd = (k: string, fallback: number) => { const p = ref[k]?.percentiles ?? ref.features?.[k]?.percentiles; return p ? (p.p75 - p.p25) / 1.349 : fallback; };
const FW = "the and of to a in that is it i you we for on with as this but be are not was have at they or so if what my your our can do there about just more one all will would when".split(" ");
const fwRates = (t: string) => { const w = t.toLowerCase().match(/[a-z']+/g) ?? []; return FW.map((f) => (w.filter((x) => x === f).length / w.length) * 1000); };
for (const len of ["short", "long"] as const) {
  const items: { a: string; t: string; m: ReturnType<typeof measureTextFeatures>; fw: number[] }[] = [];
  for (const [a, ps] of Object.entries(corpus)) for (const p of ps) items.push({ a, t: p[len], m: measureTextFeatures(p[len]), fw: fwRates(p[len]) });
  // function-word z-scoring from the study pool itself (experiment only)
  const mu = FW.map((_, j) => items.reduce((s, x) => s + x.fw[j], 0) / items.length);
  const sg = FW.map((_, j) => Math.sqrt(items.reduce((s, x) => s + (x.fw[j] - mu[j]) ** 2, 0) / items.length) || 1);
  const scalar = (m: ReturnType<typeof measureTextFeatures>) => {
    const v: number[] = [];
    const add = (x: number | null, k: string, fb: number, log = false) => v.push(((log ? Math.log1p(x ?? 0) : x ?? 0)) / (log ? 0.6 : sd(k, fb)));
    add(m.avg_sentence_length, "avg_sentence_length", 4.5); add(m.sentence_length_variance, "sentence_length_variance", 0, true);
    add(m.contraction_frequency, "contraction_frequency", 8); add(m.comma_density, "comma_density", 0.3);
    add(m.exclamation_rate, "exclamation_rate", 2); add(m.semicolon_frequency, "semicolon_frequency", 1.5); add(m.parenthetical_rate, "parenthetical_rate", 1);
    for (const k of ["i", "we", "you"]) v.push((m.pronoun_distribution?.[k] ?? 0) / 0.2);
    for (const k of ["short", "medium", "long"]) v.push((m.word_length_distribution?.[k] ?? 0) / 0.05);
    return v;
  };
  const same: Record<string, number[]> = { engine: [], delta: [], fw: [], combo: [] }, cross: Record<string, number[]> = { engine: [], delta: [], fw: [], combo: [] };
  for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
    if (i === j) continue;
    const A = items[i], B = items[j];
    const eng = computeVoiceMatch(pseudoProfileFromText(A.m, null), B.m, null, { pool: 0, hits: 0, found: [] } as Parameters<typeof computeVoiceMatch>[3]).raw;
    const sa = scalar(A.m), sb = scalar(B.m);
    const delta = -sa.reduce((s, x, k) => s + Math.abs(x - sb[k]), 0) / sa.length;
    const fw = -FW.reduce((s, _, k) => s + Math.abs((A.fw[k] - mu[k]) / sg[k] - (B.fw[k] - mu[k]) / sg[k]), 0) / FW.length;
    const bucket = A.a === B.a ? same : cross;
    bucket.engine.push(eng); bucket.delta.push(delta); bucket.fw.push(fw); bucket.combo.push(delta + fw);
  }
  console.log(len, `pairs same ${same.engine.length} cross ${cross.engine.length}`, Object.keys(same).map((k) => `${k} AUC ${auc(same[k], cross[k])}`).join(" | "));
}
