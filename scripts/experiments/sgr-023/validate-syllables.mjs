#!/usr/bin/env bun
// Validate syllables.mjs against the CMU Pronouncing Dictionary (cmudict.dict).
//   bun scripts/experiments/sgr-023/validate-syllables.mjs [--set dev|test|all] [--cmu path] [--show 30]
import { readFileSync } from "node:fs";
import { syllables, hash01 } from "./syllables.mjs";
const a = process.argv.slice(2), opt = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
const CMU = opt("--cmu", `${process.env.HOME}/research/sgr-023/cmudict.dict`), SET = opt("--set", "dev"), SHOW = +opt("--show", 0);
const dict = new Map();
for (const line of readFileSync(CMU, "utf8").split("\n")) {
  const [w0, ...ph] = line.trim().split(/\s+/); if (!w0) continue;
  const w = w0.replace(/\(\d+\)$/, ""); if (!/^[a-z]+$/.test(w)) continue;
  const n = ph.filter((p) => /\d$/.test(p)).length; if (!n) continue;
  (dict.get(w) ?? dict.set(w, []).get(w)).push(n);
}
const words = [...dict.keys()].filter((w) => SET === "all" || (SET === "dev") === (hash01(w) < 0.5));
let ex = 0, any = 0, bias = 0; const miss = [];
for (const w of words) { const c = syllables(w), v = dict.get(w); if (c === v[0]) ex++; if (v.includes(c)) any++; else miss.push([w, c, v.join("/")]); bias += c - v[0]; }
console.log(JSON.stringify({ set: SET, words: words.length, exact_first: +(ex / words.length).toFixed(4), exact_any: +(any / words.length).toFixed(4), within1: +(words.filter((w) => Math.abs(syllables(w) - dict.get(w)[0]) <= 1).length / words.length).toFixed(4), mean_bias: +(bias / words.length).toFixed(4) }));
if (SHOW) { const s = miss.sort((x, y) => (dict.get(y[0]).length - dict.get(x[0]).length) || x[0].localeCompare(y[0])); console.log(s.filter((_, i) => i % Math.max(1, Math.floor(s.length / SHOW)) === 0).slice(0, SHOW).map((m) => m.join(" ")).join("\n")); }
