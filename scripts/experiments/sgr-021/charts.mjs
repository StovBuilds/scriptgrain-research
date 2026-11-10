#!/usr/bin/env bun
// SGR-021 charts (brand palette; the same style as SGR-005). Called by run.mjs; can also rebuild the two SVGs
// from a written summary without re-measuring:
//
//   bun scripts/experiments/sgr-021/charts.mjs [--summary public/research/sgr-021-summary.json] [--out-dir public/research]
//
// Rates in this study are about 0.02 to 2 per 1,000 words, so labels keep 3 decimals and the axis ticks
// step to suit the range (a 1-decimal label showed the 1600s non-fiction rate of 0.040 as "0.0").
import { readFileSync, writeFileSync } from "node:fs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.grid{stroke:#11100E;stroke-opacity:.1}.ci{stroke:#11100E;stroke-opacity:.5;stroke-width:1.5}
.c0{fill:#674BFF}.c1{fill:#9D8420}.ref{stroke:#9D8420;stroke-dasharray:4 3}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid{stroke:#F6F5F0}.ci{stroke:#F6F5F0}.c0{fill:#7A61FF}.c1{fill:#C9A72C}.ref{stroke:#C9A72C}}
</style>`;
const svg = (w, h, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;
const fmt = (v) => v.toFixed(3);
// About four ticks over [0, max]: step 0.05, 0.1, 0.25, 0.5, 1 or 2.
const scale = (max) => {
  const step = [0.05, 0.1, 0.25, 0.5, 1, 2].find((s) => max / s <= 5) ?? 5;
  return { step, mx: Math.ceil(max / step) * step };
};
const axis = (x, mx, step, top, bottom) => {
  let b = "";
  for (let i = 0; i * step <= mx + 1e-9; i++) {
    const v = i * step, lab = step < 0.1 ? v.toFixed(2) : step < 1 ? v.toFixed(step < 0.5 ? 2 : 1) : String(v);
    b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${bottom}"/><text x="${x(v)}" y="${bottom + 16}" text-anchor="middle">${lab}</text>`;
  }
  return b;
};

/** top: [{name, rate, lo, hi}] (20 rows); corpusRate: number; cells: [{century, genre, rate, authors}]. */
export function renderCharts({ top, corpusRate, cells }) {
  const out = {};
  {
    const s = top, w = 760, L = 210, Rr = 70, T = 70, rh = 22, h = T + s.length * rh + 40;
    const { step, mx } = scale(Math.max(...s.map((r) => r.hi))), x = (v) => L + (v / mx) * (w - L - Rr);
    let b = axis(x, mx, step, T - 6, h - 30);
    b += `<line class="ref" x1="${x(corpusRate)}" x2="${x(corpusRate)}" y1="${T - 6}" y2="${h - 30}"/><text class="lbl" x="${x(corpusRate) + 4}" y="${T - 10}">all authors ${fmt(corpusRate)}</text>`;
    s.forEach((r, i) => { const y = T + i * rh; b += `<text class="lbl" x="${L - 10}" y="${y + 14}" text-anchor="end">${esc(r.name)}</text><rect class="c0" x="${L}" y="${y + 4}" width="${Math.max(1, x(r.rate) - L)}" height="${rh - 8}" rx="2"/><line class="ci" x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${y + rh / 2}" y2="${y + rh / 2}"/><text class="lbl" x="${x(r.hi) + 6}" y="${y + 14}">${fmt(r.rate)}</text>`; });
    out["top20.svg"] = svg(w, h, "The 20 authors with the highest AI-ism rate", "uses per 1,000 words of the frozen AI-ism lists; line: 95% interval over each author's books", b);
  }
  {
    const s = cells, w = 760, L = 190, Rr = 150, T = 70, rh = 26, h = T + s.length * rh + 40;
    const { step, mx } = scale(Math.max(...s.map((r) => r.rate))), x = (v) => L + (v / mx) * (w - L - Rr);
    let b = axis(x, mx, step, T - 6, h - 30);
    s.forEach((r, i) => { const y = T + i * rh; b += `<text class="lbl" x="${L - 10}" y="${y + 16}" text-anchor="end">${r.century}s, ${r.genre === "fiction" ? "fiction" : "non-fiction"}</text><rect class="${r.genre === "fiction" ? "c0" : "c1"}" x="${L}" y="${y + 5}" width="${Math.max(1, x(r.rate) - L)}" height="${rh - 10}" rx="2"/><text class="lbl" x="${x(r.rate) + 6}" y="${y + 16}">${fmt(r.rate)} (${r.authors} author${r.authors === 1 ? "" : "s"})</text>`; });
    out["baselines.svg"] = svg(w, h, "The baseline moves with era and genre", "uses per 1,000 words; era = the century the author turned 40", b);
  }
  return out;
}

export function writeCharts(outDir, data) {
  for (const [name, body] of Object.entries(renderCharts(data))) writeFileSync(`${outDir}/sgr-021-${name}`, body);
}

if (import.meta.main) {
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
  const S = JSON.parse(readFileSync(opt("--summary", "public/research/sgr-021-summary.json"), "utf8"));
  writeCharts(opt("--out-dir", "public/research"), { top: S.top, corpusRate: S.corpus.ai_isms_per1000, cells: S.baselines });
  process.stderr.write("wrote sgr-021-top20.svg and sgr-021-baselines.svg from the summary\n");
}
