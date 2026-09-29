import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("./results.jsonl", import.meta.url), "utf8").trim().split("\n").map(JSON.parse).filter((r) => r.raw != null);
const errs = readFileSync(new URL("./results.jsonl", import.meta.url), "utf8").trim().split("\n").map(JSON.parse).filter((r) => r.error).length;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return +(s[lo] + (s[hi] - s[lo]) * (i - lo)).toFixed(3); };
const auc = (pos, neg) => { let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0; return +(w / (pos.length * neg.length)).toFixed(3); };
const OLD = [[0, 0.05], [0.3, 0.25], [0.45, 0.45], [0.6, 0.75], [0.7, 0.88], [0.85, 0.96], [1, 0.99]];
const cal = (A) => (r) => { if (r <= A[0][0]) return A[0][1]; for (let i = 1; i < A.length; i++) { const [x1, y1] = A[i - 1], [x2, y2] = A[i]; if (r <= x2) return y1 + ((r - x1) / (x2 - x1)) * (y2 - y1); } return 0.99; };
const band = (s) => (s >= 0.8 ? "on" : s >= 0.55 ? "drift" : "off");
const report = (label, A) => {
  console.log(`\n== ${label}`);
  for (const len of ["short", "long", "all"]) {
    const sel = rows.filter((r) => len === "all" || r.len === len);
    const same = sel.filter((r) => r.kind === "same").map((r) => r.raw), cross = sel.filter((r) => r.kind === "cross").map((r) => r.raw);
    const f = cal(A);
    const cnt = (xs) => { const b = { on: 0, drift: 0, off: 0 }; xs.forEach((x) => b[band(f(x))]++); return `on ${b.on} / drift ${b.drift} / off ${b.off}`; };
    console.log(`${len.padEnd(5)} same n=${same.length} raw p10 ${q(same, 0.1)} p50 ${q(same, 0.5)} p90 ${q(same, 0.9)} | cross n=${cross.length} raw p10 ${q(cross, 0.1)} p50 ${q(cross, 0.5)} p90 ${q(cross, 0.9)} | AUC ${auc(same, cross)}`);
    console.log(`      same → ${cnt(same)}   cross → ${cnt(cross)}`);
  }
};
console.log(`rows ${rows.length}, errors ${errs}`);
report("current anchors", OLD);
export { rows, q, auc, cal, band, OLD };
