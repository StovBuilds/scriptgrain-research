import { readFileSync } from "node:fs";
const rows = readFileSync(new URL("./results.jsonl", import.meta.url), "utf8").trim().split("\n").map(JSON.parse).filter((r) => r.raw != null);
const cal = (A) => (r) => { if (r <= A[0][0]) return A[0][1]; for (let i = 1; i < A.length; i++) { const [x1, y1] = A[i - 1], [x2, y2] = A[i]; if (r <= x2) return y1 + ((r - x1) / (x2 - x1)) * (y2 - y1); } return 0.99; };
const band = (s) => (s >= 0.8 ? "on" : s >= 0.55 ? "drift" : "off");
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const show = (label, A) => {
  const f = cal(A); const out = [];
  for (const len of ["short", "long", "all"]) {
    const sel = rows.filter((r) => len === "all" || r.len === len);
    const same = sel.filter((r) => r.kind === "same"), cross = sel.filter((r) => r.kind === "cross");
    const c = (xs, b) => xs.filter((r) => band(f(r.raw)) === b).length;
    out.push(`${len}: same on ${pct(c(same, "on"), same.length)} drift ${pct(c(same, "drift"), same.length)} off ${pct(c(same, "off"), same.length)} | diff on ${pct(c(cross, "on"), cross.length)} drift ${pct(c(cross, "drift"), cross.length)} off ${pct(c(cross, "off"), cross.length)}`);
  }
  const probes = [["identical", 1], ["formal vs chatty (2026-09-20)", 0.44], ["gushing vs plain reply (today)", 0.68], ["RN barber vs drafts (≈)", 0.57], ["same-writer median", 0.667], ["diff-writer median", 0.62]].map(([n, r]) => `${n} ${r}→${f(r).toFixed(2)} ${band(f(r))}`);
  console.log(`\n== ${label}\n${out.join("\n")}\n${probes.join(" · ")}`);
};
show("current", [[0, 0.05], [0.3, 0.25], [0.45, 0.45], [0.6, 0.75], [0.7, 0.88], [0.85, 0.96], [1, 0.99]]);
show("proposed", [[0, 0.05], [0.3, 0.2], [0.45, 0.4], [0.56, 0.55], [0.72, 0.8], [0.85, 0.93], [1, 0.99]]);
show("proposed-b (on at 0.74)", [[0, 0.05], [0.3, 0.2], [0.45, 0.4], [0.56, 0.55], [0.74, 0.8], [0.85, 0.93], [1, 0.99]]);
