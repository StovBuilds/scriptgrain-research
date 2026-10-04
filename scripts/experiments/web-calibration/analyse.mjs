// DESK-415 analysis of pairs.jsonl: does compare_voice tell brands apart on website copy,
// and does the genre-baseline variant help? Same-brand pairs are the positives; the hard
// negatives are other brands in the SAME sector (UK banks vs UK banks).
import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("./pairs.jsonl", import.meta.url), "utf8").trim().split("\n").map(JSON.parse);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return +(s[lo] + (s[hi] - s[lo]) * (i - lo)).toFixed(3); };
const auc = (pos, neg) => { let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0; return +(w / (pos.length * neg.length)).toFixed(3); };
export const PAIRWISE = [[0, 0.05], [0.3, 0.2], [0.45, 0.4], [0.56, 0.55], [0.72, 0.8], [0.85, 0.93], [1, 0.99]];
export const cal = (A) => (r) => { if (r <= A[0][0]) return A[0][1]; for (let i = 1; i < A.length; i++) { const [x1, y1] = A[i - 1], [x2, y2] = A[i]; if (r <= x2) return y1 + ((r - x1) / (x2 - x1)) * (y2 - y1); } return 0.99; };
const band = (s) => (s >= 0.8 ? "on" : s >= 0.55 ? "drift" : "off");
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const KINDS = ["same_brand", "same_sector", "cross_sector"];
export function report(field, A = PAIRWISE, label = field) {
  const f = cal(A);
  const by = Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.kind === k).map((r) => r[field])]));
  console.log(`\n== ${label}`);
  for (const k of KINDS) {
    const xs = by[k]; const b = { on: 0, drift: 0, off: 0 }; xs.forEach((x) => b[band(f(x))]++);
    console.log(`${k.padEnd(13)} n=${String(xs.length).padStart(4)}  raw p10 ${q(xs, 0.1)} p50 ${q(xs, 0.5)} p90 ${q(xs, 0.9)}  | on ${pct(b.on, xs.length)} drift ${pct(b.drift, xs.length)} off ${pct(b.off, xs.length)}`);
  }
  console.log(`AUC same_brand vs same_sector ${auc(by.same_brand, by.same_sector)} · vs cross_sector ${auc(by.same_brand, by.cross_sector)} · same_sector vs cross_sector ${auc(by.same_sector, by.cross_sector)}`);
  // per sector
  const sectors = [...new Set(rows.map((r) => r.sector))];
  console.log("per sector AUC (same brand vs same sector): " + sectors.map((s) => `${s} ${auc(rows.filter((r) => r.sector === s && r.kind === "same_brand").map((r) => r[field]), rows.filter((r) => r.sector === s && r.kind === "same_sector").map((r) => r[field]))}`).join(" · "));
  return by;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`pairs ${rows.length}`);
  report("raw", PAIRWISE, "production raw, current pairwise anchors");
  report("raw_base", PAIRWISE, "genre baseline (all other brands), current anchors");
  report("raw_base_lso", PAIRWISE, "genre baseline (other sectors only), current anchors");
}
