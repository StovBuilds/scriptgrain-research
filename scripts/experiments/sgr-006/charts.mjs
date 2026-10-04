#!/usr/bin/env bun
// SGR-006 charts: brand palette (blue, gold; no derived shades), light and dark,
// direct labels. The page's tables and the CSV carry the same numbers.
//
//   bun scripts/experiments/sgr-006/charts.mjs --summary <summary.json> --check <prose-check.json> --outdir public/research
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n) => args[args.indexOf(n) + 1];
const S = JSON.parse(readFileSync(opt("--summary"), "utf8"));
const OUT = opt("--outdir");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}.st{font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}.grid{stroke:#11100E;stroke-opacity:.1}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.line{fill:none;stroke-width:2}.dot{stroke:#F6F5F0;stroke-width:2}
.rng{stroke-width:6;stroke-linecap:round;stroke-opacity:.35}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.st,.lbl{fill:#F6F5F0}.grid{stroke:#F6F5F0}.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.dot{stroke:#141310}}
</style>`;
const svg = (w, h, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;
const ERAS = ["1700s", "1800s", "early 1900s", "2021 web"];
const meanOf = (groups, era, k) => { const c = S.cells.filter((x) => groups.includes(x.group) && x.era === era); const n = c.reduce((s, x) => s + x.texts, 0); return n ? c.reduce((s, x) => s + x[k].mean * x.texts, 0) / n : null; };
const NF = ["history", "science", "philosophy_religion", "travel", "biography"], WNF = ["news", "wikipedia", "how_to_content"];

// 1. Sentence length through time: non-fiction and fiction.
{
  const w = 760, h = 380, L = 56, R = 150, T = 66, B = 44;
  const ser = [
    { n: "Non-fiction", c: "c0", v: ERAS.map((e) => (e === "2021 web" ? meanOf(WNF, e, "sentence_length") : meanOf(NF, e, "sentence_length"))) },
    { n: "Fiction", c: "c1", v: ERAS.slice(0, 3).map((e) => meanOf(["fiction"], e, "sentence_length")) },
  ];
  const X = (i) => L + (i / 3) * (w - L - R), Y = (v) => T + (1 - v / 40) * (h - T - B);
  let b = "";
  for (let v = 0; v <= 40; v += 10) b += `<line class="grid" x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  ERAS.forEach((e, i) => (b += `<text x="${X(i)}" y="${h - B + 18}" text-anchor="middle">${e}</text>`));
  for (const s of ser) {
    b += `<path class="line ${s.c}" style="fill:none" d="M${s.v.map((v, i) => `${X(i)},${Y(v)}`).join("L")}"/>`;
    s.v.forEach((v, i) => (b += `<circle class="${s.c} dot" cx="${X(i)}" cy="${Y(v)}" r="5"/><text class="lbl" x="${X(i)}" y="${Y(v) - 10}" text-anchor="middle">${v.toFixed(1)}</text>`));
    b += `<text class="lbl b" x="${X(s.v.length - 1) + 12}" y="${Y(s.v.at(-1)) + 4}">${s.n}</text>`;
  }
  writeFileSync(`${OUT}/sgr-006-sentences.svg`, svg(w, h, "Sentences have been getting shorter for three centuries", "average words per sentence; books by era, then news, Wikipedia and how-to pages from the 2021 web", b));
}

// 2. Punctuation and informality through time: three small panels, each on its own scale.
{
  const panels = [["semicolons_per1000", "Semicolons per 1,000 words"], ["em_dash_per1000", "Dashes per 1,000 words"], ["contractions_per1000", "Contractions per 1,000 words"]];
  const w = 760, h = 300, pw = (w - 32) / 3, T = 84, B = 44;
  let b = "";
  panels.forEach(([k, name], p) => {
    const v = ERAS.map((e) => (e === "2021 web" ? meanOf(WNF, e, k) : meanOf(NF, e, k)));
    const max = Math.ceil(Math.max(...v) / 5) * 5, x0 = 16 + p * pw + 30, x1 = 16 + (p + 1) * pw - 16;
    const X = (i) => x0 + (i / 3) * (x1 - x0), Y = (val) => T + (1 - val / max) * (h - T - B);
    b += `<text class="st" x="${x0 - 24}" y="${T - 22}">${name}</text>`;
    for (let g = 0; g <= max; g += max / 2) b += `<line class="grid" x1="${x0}" x2="${x1}" y1="${Y(g)}" y2="${Y(g)}"/><text x="${x0 - 6}" y="${Y(g) + 4}" text-anchor="end">${g}</text>`;
    ["1700s", "1800s", "1900s", "2021"].forEach((e, i) => (b += `<text x="${X(i)}" y="${h - B + 18}" text-anchor="middle">${e}</text>`));
    b += `<path class="line c0" style="fill:none" d="M${v.map((val, i) => `${X(i)},${Y(val)}`).join("L")}"/>`;
    v.forEach((val, i) => (b += `<circle class="c0 dot" cx="${X(i)}" cy="${Y(val)}" r="4.5"/><text class="lbl" x="${X(i)}" y="${Y(val) - 9}" text-anchor="middle">${val.toFixed(1)}</text>`));
  });
  writeFileSync(`${OUT}/sgr-006-punctuation.svg`, svg(w, h, "Semicolons faded, dashes rose then fell, contractions arrived late", "non-fiction books by era (1900s = early 1900s); 2021 = news, Wikipedia, how-to pages", b));
}

// 3. The baseline: sentence length, middle half and median, for every genre and era.
{
  const c = S.cells, w = 760, L = 270, R = 40, T = 66, rh = 18, h = T + c.length * rh + 30;
  const max = 50, X = (v) => L + (Math.min(v, max) / max) * (w - L - R);
  let b = "";
  for (let v = 0; v <= max; v += 10) b += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T - 6}" y2="${h - 26}"/><text x="${X(v)}" y="${h - 10}" text-anchor="middle">${v}</text>`;
  c.forEach((x, i) => {
    const y = T + i * rh + 9, cls = x.era.match(/^\d{4}s|early/) ? "c1" : "c0", s = x.sentence_length;
    const short = x.group === "arxiv" ? "arXiv abstracts, 2015 to 2022" : `${x.label.replace("Philosophy and religion", "Philosophy, religion").replace("Self-help and productivity", "Self-help")}, ${x.era}`;
    b += `<text class="lbl" x="${L - 10}" y="${y + 4}" text-anchor="end">${esc(short)}</text>`;
    b += `<line class="${cls} rng" x1="${X(s.p25)}" x2="${X(s.p75)}" y1="${y}" y2="${y}"/><circle class="${cls} dot" cx="${X(s.p50)}" cy="${y}" r="4"/>`;
  });
  writeFileSync(`${OUT}/sgr-006-baseline.svg`, svg(w, h, "Normal sentence length, by genre and era", "dot: median; bar: middle half of texts; books (gold), 2021 web and abstracts (blue)", b));
}
console.error("charts written");
