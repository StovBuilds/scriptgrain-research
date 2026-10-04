// DESK-415: which features separate same-brand from same-sector pairs on web copy?
// Per-feature AUC, then a non-negative reweighting (weights = production weight x a
// per-feature factor) fitted on 3 sectors and tested on the 4th (leave-one-sector-out).
import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("./feat.jsonl", import.meta.url), "utf8").trim().split("\n").map(JSON.parse).filter((r) => r.kind !== "cross_sector");
const auc = (pos, neg) => { if (!pos.length || !neg.length) return NaN; let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0; return w / (pos.length * neg.length); };
const feats = [...new Set(rows.flatMap((r) => Object.keys(r.f)))];
const fauc = (rs, k) => auc(rs.filter((r) => r.kind === "same_brand" && r.f[k]).map((r) => r.f[k][0]), rs.filter((r) => r.kind === "same_sector" && r.f[k]).map((r) => r.f[k][0]));
console.log("feature".padEnd(28), "AUC  weight");
const table = feats.map((k) => [k, fauc(rows, k), rows.find((r) => r.f[k])?.f[k][1]]).sort((a, b) => b[1] - a[1]);
for (const [k, a, w] of table) console.log(k.padEnd(28), a.toFixed(3), w);
// score with factors
const score = (r, fac) => { let n = 0, d = 0; for (const [k, [s, w]] of Object.entries(r.f)) { const ww = w * (fac[k] ?? 1); n += ww * s; d += ww; } return d ? n / d : 0; };
// factor rule fitted on training rows: factor = max(0, (auc-0.5))*k ; features at/below chance get 0
const fit = (tr) => Object.fromEntries(feats.map((k) => { const a = fauc(tr, k); return [k, Number.isFinite(a) ? Math.max(0, a - 0.5) * 10 : 0]; }));
const sectors = [...new Set(rows.map((r) => r.sector))];
let allPos = [], allNeg = [], basePos = [], baseNeg = [];
for (const s of sectors) {
  const tr = rows.filter((r) => r.sector !== s), te = rows.filter((r) => r.sector === s);
  const fac = fit(tr);
  const pos = te.filter((r) => r.kind === "same_brand"), neg = te.filter((r) => r.kind === "same_sector");
  const a1 = auc(pos.map((r) => r.raw), neg.map((r) => r.raw)), a2 = auc(pos.map((r) => score(r, fac)), neg.map((r) => score(r, fac)));
  console.log(`held-out ${s.padEnd(8)} production AUC ${a1.toFixed(3)}  reweighted AUC ${a2.toFixed(3)}  (top factors: ${Object.entries(fac).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")})`);
  basePos.push(...pos.map((r) => r.raw)); baseNeg.push(...neg.map((r) => r.raw));
  allPos.push(...pos.map((r) => score(r, fac))); allNeg.push(...neg.map((r) => score(r, fac)));
}
console.log(`pooled held-out: production ${auc(basePos, baseNeg).toFixed(3)} reweighted ${auc(allPos, allNeg).toFixed(3)}`);
