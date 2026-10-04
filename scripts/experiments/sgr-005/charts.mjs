#!/usr/bin/env bun
// SGR-005 charts: static SVGs in the brand palette (blue, gold; no derived
// shades), light and dark via prefers-color-scheme, direct labels throughout.
//
//   bun scripts/experiments/sgr-005/charts.mjs --summary <summary.json> --works <works.csv> --outdir public/research
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const S = JSON.parse(readFileSync(opt("--summary", null), "utf8"));
const OUT = opt("--outdir", "public/research");
const [hdr, ...lines] = readFileSync(opt("--works", null), "utf8").trim().split("\n");
const cols = hdr.split(",");
const parse = (l) => { const o = [], re = /("([^"]|"")*"|[^,]*)(,|$)/g; let m; while ((m = re.exec(l)) && o.length < cols.length) { o.push(m[1].startsWith('"') ? m[1].slice(1, -1).replace(/""/g, '"') : m[1]); if (m[3] === "") break; } return Object.fromEntries(cols.map((c, i) => [c, o[i]])); };
const W = lines.map(parse);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}
.grid{stroke:#11100E;stroke-opacity:.1}.zero{stroke:#11100E;stroke-opacity:.5}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}
.ci{stroke:#11100E;stroke-opacity:.45;stroke-width:1.5}.line{fill:none;stroke-width:2}.dot{stroke:#F6F5F0;stroke-width:1.5}
.bar{stroke:#9D8420;stroke-dasharray:4 3}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid{stroke:#F6F5F0}.zero{stroke:#F6F5F0}.ci{stroke:#F6F5F0}
.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.dot{stroke:#141310}.bar{stroke:#C9A72C}}
</style>`;
const svg = (w, h, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;

// 1. Per-author slope, sorted; bars from zero.
{
  const s = S.slopes, w = 760, L = 230, R = 70, T = 66, rh = 20, h = T + s.length * rh + 30;
  const lim = Math.ceil(Math.max(...s.map((x) => Math.abs(x.slope)))) ;
  const x = (v) => L + ((v + lim) / (2 * lim)) * (w - L - R);
  let b = "";
  for (let v = -lim; v <= lim; v += lim >= 6 ? 2 : 1) b += `<line class="${v === 0 ? "zero" : "grid"}" x1="${x(v)}" x2="${x(v)}" y1="${T - 6}" y2="${h - 26}"/><text x="${x(v)}" y="${h - 10}" text-anchor="middle">${v > 0 ? "+" : ""}${v}</text>`;
  s.forEach((r, i) => {
    const y = T + i * rh, cls = r.slope >= 0 ? "c0" : "c1";
    b += `<text class="lbl" x="${L - 10}" y="${y + 13}" text-anchor="end">${esc(r.name.replace(", 18th Baron of Dunsany", " (Dunsany)"))}</text>`;
    b += `<rect class="${cls}" x="${Math.min(x(0), x(r.slope))}" y="${y + 4}" width="${Math.max(1, Math.abs(x(r.slope) - x(0)))}" height="${rh - 8}" rx="2"/>`;
    b += `<text class="lbl" x="${r.slope >= 0 ? x(r.slope) + 6 : x(r.slope) - 6}" y="${y + 13}" text-anchor="${r.slope >= 0 ? "start" : "end"}">${Math.abs(r.slope) < 0.05 ? "0.0" : `${r.slope >= 0 ? "+" : ""}${r.slope.toFixed(1)}`}</text>`;
  });
  writeFileSync(`${OUT}/sgr-005-authors.svg`, svg(w, h, "How each writer's sentences changed with age", "change in words per sentence (narration) per decade of age; longer (blue), shorter (gold)", b));
}

// 2. Two careers: Henry James and Anthony Trollope.
{
  const who = [["Henry James", "c0"], ["Anthony Trollope", "c1"]], w = 760, h = 400, L = 56, R = 140, T = 66, B = 44;
  const pts = who.map(([n, c]) => ({ n, c, p: W.filter((r) => r.name === n).map((r) => [+r.year, +r.n_sentence_length]).filter((p) => Number.isFinite(p[1])).sort((a, b) => a[0] - b[0]) }));
  const ys = pts.flatMap((s) => s.p.map((p) => p[1])), xs = pts.flatMap((s) => s.p.map((p) => p[0]));
  const y0 = Math.floor(Math.min(...ys) / 5) * 5, y1 = Math.ceil(Math.max(...ys) / 5) * 5, x0 = Math.floor(Math.min(...xs) / 10) * 10, x1 = Math.ceil(Math.max(...xs) / 10) * 10;
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (w - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (h - T - B);
  let b = "";
  for (let v = y0; v <= y1; v += 5) b += `<line class="grid" x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  for (let v = x0; v <= x1; v += 10) b += `<text x="${X(v)}" y="${h - B + 18}" text-anchor="middle">${v}</text>`;
  for (const s of pts) {
    for (const [a, v] of s.p) b += `<circle class="${s.c} dot" cx="${X(a)}" cy="${Y(v)}" r="4.5"/>`;
    const mx = s.p.reduce((t, p) => t + p[0], 0) / s.p.length, my = s.p.reduce((t, p) => t + p[1], 0) / s.p.length;
    const k = s.p.reduce((t, p) => t + (p[0] - mx) * (p[1] - my), 0) / s.p.reduce((t, p) => t + (p[0] - mx) ** 2, 0);
    const a0 = s.p[0][0], a1 = s.p.at(-1)[0];
    b += `<line class="${s.c} line" x1="${X(a0)}" y1="${Y(my + k * (a0 - mx))}" x2="${X(a1)}" y2="${Y(my + k * (a1 - mx))}"/>`;
    b += `<text class="lbl b" x="${X(a1) + 8}" y="${Y(my + k * (a1 - mx)) + 4}">${esc(s.n)}</text>`;
  }
  writeFileSync(`${OUT}/sgr-005-two-careers.svg`, svg(w, h, "Two careers, opposite directions", "words per sentence in each book's narration, by year first published; line: straight-line trend", b));
}

// 3. ICC per feature with 95% intervals; the pre-registered bar at 0.5.
{
  const NAMES = { sentence_length: "Sentence length", sentence_cv: "Sentence length variation", commas_per_sentence: "Commas per sentence", semicolons_per1000: "Semicolons", contractions_per1000: "Contractions", long_word_share: "Long words" };
  const f = Object.entries(S.H2.features).sort((a, b) => b[1].icc - a[1].icc), w = 760, L = 230, R = 60, T = 84, rh = 30, h = T + f.length * rh + 34;
  const x = (v) => L + v * (w - L - R);
  let b = "";
  for (let v = 0; v <= 1.0001; v += 0.25) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 6}" y2="${h - 28}"/><text x="${x(v)}" y="${h - 12}" text-anchor="middle">${v}</text>`;
  b += `<line class="bar" x1="${x(0.5)}" x2="${x(0.5)}" y1="${T - 10}" y2="${h - 28}"/><text x="${x(0.5) + 6}" y="${T - 12}">pre-registered bar</text>`;
  f.forEach(([k, v], i) => {
    const y = T + i * rh;
    b += `<text class="lbl" x="${L - 10}" y="${y + 17}" text-anchor="end">${NAMES[k]}</text>`;
    b += `<rect class="c0" x="${L}" y="${y + 6}" width="${x(v.icc) - L}" height="${rh - 12}" rx="2"/><line class="ci" x1="${x(v.lo)}" x2="${x(v.hi)}" y1="${y + 15}" y2="${y + 15}"/>`;
    b += `<text class="lbl" x="${x(v.hi) + 6}" y="${y + 19}">${v.icc.toFixed(2)}</text>`;
  });
  writeFileSync(`${OUT}/sgr-005-fingerprint.svg`, svg(w, h, "How much of each habit belongs to the author", "share of the variation between books explained by who wrote them (ICC); whisker: 95% interval", b));
}
console.error("charts written");
