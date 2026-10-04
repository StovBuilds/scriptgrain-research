#!/usr/bin/env bun
// SGR-009 charts: static SVGs in the brand palette (blue, gold, teal; no derived
// shades), light and dark via prefers-color-scheme, every series directly labelled.
// The page's tables carry the same numbers.
//   bun scripts/experiments/sgr-009/charts.mjs [--summary public/research/sgr-009-summary.json] [--outdir public/research]
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-009-summary.json"), "utf8"));
const OUT = opt("--outdir", "public/research");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}.inv{fill:#FFFFFF;font-weight:600}
.grid{stroke:#11100E;stroke-opacity:.1}.ref{stroke:#11100E;stroke-opacity:.55;stroke-dasharray:4 3}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.c2{fill:#07A0C3;stroke:#07A0C3}
.ci{stroke:#11100E;stroke-opacity:.55;stroke-width:1.5}.gap{stroke:#F6F5F0;stroke-width:2}.dot{stroke:#F6F5F0;stroke-width:2}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.ref,.ci{stroke:#F6F5F0}
.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.c2{fill:#2CB8D8;stroke:#2CB8D8}.gap,.dot{stroke:#141310}.inv{fill:#141310}}
</style>`;
const svg = (W, H, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;
const pct = (x) => `${Math.round(x * 100)}%`;

// 1. Band shares by pair kind (primary judge), stacked 100% bars.
{
  const b0 = S.bands.J1a, W = 760, L = 230, R = 24, T = 92, rowH = 44, H = T + 3 * rowH + 20;
  const rows = [["A brand's own pages", b0.SB], ["Rival brand, same sector", b0.SS], ["Brand in another sector", b0.XS]];
  const x = (v) => L + v * (W - L - R);
  let b = "";
  const segs = [["on", "On voice", "c0"], ["drifting", "Drifting", "c1"], ["off", "Off voice", "c2"]];
  // legend
  let lx = L;
  for (const [, name, cls] of segs) { b += `<rect class="${cls}" x="${lx}" y="${T - 30}" width="12" height="12" rx="2"/><text class="lbl" x="${lx + 18}" y="${T - 20}">${name}</text>`; lx += 120; }
  rows.forEach(([label, r], i) => {
    const y = T + i * rowH;
    b += `<text class="lbl" x="${L - 12}" y="${y + 19}" text-anchor="end">${esc(label)}</text><text x="${L - 12}" y="${y + 33}" text-anchor="end">${r.n.toLocaleString("en-GB")} pairs</text>`;
    let acc = 0;
    for (const [k, , cls] of segs) {
      const w = r[k] * (W - L - R);
      b += `<rect class="${cls} gap" x="${x(acc)}" y="${y}" width="${Math.max(0, w)}" height="${rowH - 12}" rx="4"/>`;
      if (w > 34) b += `<text class="inv" x="${x(acc) + w / 2}" y="${y + 20}" text-anchor="middle">${pct(r[k])}</text>`;
      acc += r[k];
    }
  });
  writeFileSync(`${OUT}/sgr-009-bands.svg`, svg(W, H, "How a brand's pages scored against each other, and against rivals", "share of page pairs in each band of ScriptGrain's pairwise voice score; primary judge (Haiku 4.5)", b));
}

// 2. H1 AUC by judge run, with 95% intervals; chance (0.5) and the pre-registered 0.60 line.
{
  const runs = [["Haiku 4.5, temperature 0 (primary)", S.confirmatory.h1, "c0"], ...S.robustness.filter((r) => r.h1.lo != null).map((r) => [r.run === "none" ? "Counted features only, no judge" : `Sonnet 5.5, run ${r.run.slice(-1).toUpperCase()}`, r.h1, r.run === "none" ? "c1" : "c2"])];
  const W = 760, L = 270, R = 70, T = 88, rowH = 34, H = T + runs.length * rowH + 40;
  const lo = 0.45, hi = 0.65, x = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  let b = "";
  for (let v = lo; v <= hi + 1e-9; v += 0.05) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - 30}"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v.toFixed(2)}</text>`;
  b += `<line class="ref" x1="${x(0.5)}" x2="${x(0.5)}" y1="${T - 14}" y2="${H - 30}"/><text class="lbl" x="${x(0.5)}" y="${T - 20}" text-anchor="middle">chance</text>`;
  b += `<line class="ref" x1="${x(0.6)}" x2="${x(0.6)}" y1="${T - 14}" y2="${H - 30}"/><text class="lbl" x="${x(0.6)}" y="${T - 20}" text-anchor="middle">H1 line (0.60)</text>`;
  runs.forEach(([label, h, cls], i) => {
    const y = T + i * rowH + 12;
    b += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${esc(label)}</text>`;
    b += `<line class="ci" x1="${x(h.lo)}" x2="${x(h.hi)}" y1="${y}" y2="${y}"/><circle class="${cls} dot" cx="${x(h.point)}" cy="${y}" r="6"/>`;
    b += `<text class="lbl b" x="${W - 12}" y="${y + 4}" text-anchor="end">${h.point.toFixed(3)}</text>`;
  });
  writeFileSync(`${OUT}/sgr-009-judges.svg`, svg(W, H, "Every judge gave the same answer", "how often a brand's own page pair outscores a rival's (AUC); dot: estimate, line: 95% interval", b));
}

// 3. AUC per sector (point estimates), against chance.
{
  const rows = Object.entries(S.perSector).sort((a, b) => b[1] - a[1]);
  const W = 760, L = 130, R = 60, T = 62, rowH = 26, H = T + rows.length * rowH + 34;
  const lo = 0.4, hi = 0.7, x = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  let b = "";
  for (let v = lo; v <= hi + 1e-9; v += 0.05) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 6}" y2="${H - 28}"/><text x="${x(v)}" y="${H - 12}" text-anchor="middle">${v.toFixed(2)}</text>`;
  rows.forEach(([s, v], i) => {
    const y = T + i * rowH;
    const x0 = x(Math.min(0.5, v)), x1 = x(Math.max(0.5, v));
    b += `<text class="lbl" x="${L - 10}" y="${y + 15}" text-anchor="end">${s}</text>`;
    b += `<rect class="${v >= 0.5 ? "c0" : "c1"}" x="${x0}" y="${y + 4}" width="${Math.max(1, x1 - x0)}" height="${rowH - 9}" rx="2"/>`;
    b += `<text class="lbl" x="${v >= 0.5 ? x1 + 6 : x0 - 6}" y="${y + 16}" text-anchor="${v >= 0.5 ? "start" : "end"}">${v.toFixed(2)}</text>`;
  });
  b += `<line class="ref" x1="${x(0.5)}" x2="${x(0.5)}" y1="${T - 8}" y2="${H - 28}"/>`;
  writeFileSync(`${OUT}/sgr-009-sectors.svg`, svg(W, H, "Telling a brand from its rivals, sector by sector", "AUC, a brand's own page pairs against rival pairs in the same sector; 0.50 = chance (dashed line)", b));
}
console.error("charts written");
