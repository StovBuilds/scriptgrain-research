#!/usr/bin/env bun
// SGR-012 chart: three median pair scores per sector (and overall), brand palette, light/dark.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(dir + "summary-012.json", "utf8"));
const NAME = { bank: "Banks", energy: "Energy", telecom: "Telecoms", software: "Software", insurance: "Insurance", charity: "Charities" };
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}.grid{stroke:#11100E;stroke-opacity:.1}.link{stroke:#11100E;stroke-opacity:.25;stroke-width:2}
.c0{fill:#674BFF}.c1{fill:#9D8420}.c2{fill:#07A0C3}.dot{stroke:#F6F5F0;stroke-width:2}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.link{stroke:#F6F5F0}.c0{fill:#7A61FF}.c1{fill:#C9A72C}.c2{fill:#2CB8D8}.dot{stroke:#141310}}
</style>`;
const rows = [["All brands", S.levels.sbsc, S.levels.sboc, S.levels.obsc, S.brands, true], ...Object.entries(S.bySector).filter(([, v]) => v.obsc != null).map(([k, v]) => [NAME[k] ?? k, v.sbsc, v.sboc, v.obsc, v.brands, false])];
const W = 760, L = 150, R = 30, T = 112, rowH = 40, H = T + rows.length * rowH + 30;
const lo = 0.55, hi = 0.75, x = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
let b = "";
const leg = [["c0", "Same brand, same channel"], ["c1", "Same brand, other channel"], ["c2", "Rival brand, same channel"]];
leg.forEach(([c, t], i) => { b += `<circle class="${c}" cx="${16 + i * 245 + 6}" cy="${70}" r="6"/><text class="lbl" x="${16 + i * 245 + 18}" y="${74}">${t}</text>`; });
for (let v = lo; v <= hi + 1e-9; v += 0.05) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 12}" y2="${H - 28}"/><text x="${x(v)}" y="${H - 10}" text-anchor="middle">${v.toFixed(2)}</text>`;
rows.forEach(([l, a, o, r, n, bold], i) => {
  const y = T + i * rowH + 10;
  b += `<text class="lbl${bold ? " b" : ""}" x="${L - 12}" y="${y + 4}" text-anchor="end">${l}</text><text x="${L - 12}" y="${y + 18}" text-anchor="end">${n} brand${n > 1 ? "s" : ""}</text>`;
  const xs = [a, o, r].map(x);
  b += `<line class="link" x1="${Math.min(...xs)}" x2="${Math.max(...xs)}" y1="${y}" y2="${y}"/>`;
  b += `<circle class="c1 dot" cx="${x(o)}" cy="${y}" r="6.5"/><circle class="c2 dot" cx="${x(r)}" cy="${y}" r="6.5"/><circle class="c0 dot" cx="${x(a)}" cy="${y}" r="6.5"/>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="How alike pages score, by pair kind">${STYLE}<text class="t" x="16" y="24">How alike two pages score, by who wrote them and where</text><text x="16" y="42">median voice-score agreement (raw, counted features), mean over brands; higher = more alike</text>${b}</svg>\n`;
writeFileSync("public/research/sgr-012-pairs.svg", svg); console.error("chart", H);
