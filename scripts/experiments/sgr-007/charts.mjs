#!/usr/bin/env bun
// SGR-007 charts: static SVGs in the brand palette (blue, gold, teal; no
// derived shades), light and dark via prefers-color-scheme, every series
// directly labelled. The page's tables carry the same numbers.
//
//   bun scripts/experiments/sgr-007/charts.mjs --summary <summary.json> --outdir public/research
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const S = JSON.parse(readFileSync(opt("--summary", null), "utf8"));
const OUT = opt("--outdir", "public/research");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}
.grid{stroke:#11100E;stroke-opacity:.1}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.c2{fill:#07A0C3;stroke:#07A0C3}
.ci{stroke:#11100E;stroke-opacity:.45;stroke-width:1.5}.line{fill:none;stroke-width:2}.dot{stroke:#F6F5F0;stroke-width:2}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid{stroke:#F6F5F0}.ci{stroke:#F6F5F0}
.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.c2{fill:#2CB8D8;stroke:#2CB8D8}.dot{stroke:#141310}}
</style>`;
const nice = (raw) => { const mag = 10 ** Math.floor(Math.log10(raw / 4)); const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * 4 >= raw); return { step, max: step * Math.ceil(raw / step) }; };
const svg = (W, H, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;

// 1. Horizontal bars: AI-ism rate by kind of writing, 95% interval whiskers.
{
  const g = S.byGroup, W = 760, L = 300, R = 60, T = 66, rowH = 22, H = T + g.length * rowH + 30;
  const { step, max } = nice(Math.max(...g.map((x) => x.ai_ism_ci[1])));
  const x = (v) => L + (v / max) * (W - L - R);
  let b = "";
  for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 6}" y2="${H - 26}"/><text x="${x(v)}" y="${H - 10}" text-anchor="middle">${+v.toFixed(2)}</text>`;
  g.forEach((r, i) => {
    const y = T + i * rowH;
    const cls = r.group.startsWith("gutenberg") ? "c1" : r.group === "arxiv" ? "c2" : "c0";
    b += `<text class="lbl" x="${L - 10}" y="${y + 13}" text-anchor="end">${esc(r.label.replace("Books before 1928: ", "Books: "))}</text>`;
    b += `<rect class="${cls}" x="${L}" y="${y + 3}" width="${Math.max(1, x(r.ai_ism_per1000) - L)}" height="${rowH - 8}" rx="2"/>`;
    b += `<line class="ci" x1="${x(r.ai_ism_ci[0])}" x2="${x(r.ai_ism_ci[1])}" y1="${y + 10}" y2="${y + 10}"/>`;
    b += `<text class="lbl" x="${x(r.ai_ism_ci[1]) + 6}" y="${y + 14}">${r.ai_ism_per1000.toFixed(2)}</text>`;
  });
  writeFileSync(`${OUT}/sgr-007-by-genre.svg`, svg(W, H, "AI-isms in writing from before ChatGPT", `uses per 1,000 words, mean per page; web (blue), books before 1928 (gold)${g.some((r) => r.group === "arxiv") ? ", scientific abstracts (teal)" : ""}; whisker: 95% interval`, b));
}

// 2. Scatter: vocabulary tells (x) against sentence-shape tells (y), one point per group.
{
  const g = S.byGroup, W = 760, H = 480, L = 56, R = 24, T = 84, B = 44;
  const xs = nice(Math.max(...g.map((r) => r.ai_ism_per1000)) * 1.05), ys = nice(Math.max(...g.map((r) => r.ai_tell_per1000)) * 1.05);
  const x = (v) => L + (v / xs.max) * (W - L - R), y = (v) => T + (1 - v / ys.max) * (H - T - B);
  let b = "";
  for (let v = 0; v <= xs.max + 1e-9; v += xs.step) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - B}"/><text x="${x(v)}" y="${H - B + 18}" text-anchor="middle">${+v.toFixed(2)}</text>`;
  for (let v = 0; v <= ys.max + 1e-9; v += ys.step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
  b += `<text x="${W - R}" y="${H - 8}" text-anchor="end">AI-ism words per 1,000 words →</text><text x="${L}" y="${T - 12}">↑ AI sentence shapes per 1,000 words</text>`;
  for (const r of g) {
    const cls = r.group.startsWith("gutenberg") ? "c1" : r.group === "arxiv" ? "c2" : "c0";
    b += `<circle class="${cls} dot" cx="${x(r.ai_ism_per1000)}" cy="${y(r.ai_tell_per1000)}" r="5"/>`;
  }
  // Selective direct labels, nudged apart vertically so none overlap.
  const LABEL = ["press_releases", "homepages", "gutenberg_oratory", "gutenberg_sermons", "gutenberg_science", "essay_mills", "self_help", "marketing_seo_blogs", "news_uk", "wikipedia", "qa_forum", "arxiv"];
  const labs = g.filter((r) => LABEL.includes(r.group)).map((r) => ({ r, px: x(r.ai_ism_per1000), py: y(r.ai_tell_per1000) + 4 })).sort((a, b) => a.py - b.py);
  const placed = [];
  for (const l of labs) {
    const right = l.px < W - 220;
    const text = l.r.label.replace("Books before 1928: ", "Books: ");
    const w = text.length * 7.3;
    const x0 = right ? l.px + 9 : l.px - 9 - w, x1 = x0 + w;
    let ly = l.py;
    for (const p of placed) if (x0 < p.x1 && x1 > p.x0 && Math.abs(ly - p.y) < 15) ly = p.y + 15;
    placed.push({ x0, x1, y: ly });
    b += `<text class="lbl" x="${right ? l.px + 9 : l.px - 9}" y="${ly}" text-anchor="${right ? "start" : "end"}">${esc(text)}</text>`;
  }
  writeFileSync(`${OUT}/sgr-007-two-ancestries.svg`, svg(W, H, "Two kinds of AI tell, two different homes", `each point is one kind of writing from before ChatGPT; web (blue), books before 1928 (gold)${g.some((r) => r.group === "arxiv") ? ", scientific abstracts (teal)" : ""}`, b));
}

// 3. Google Books, 1900-2019: three words, per million words.
{
  const words = ["innovative", "transformative", "delve"], W = 760, H = 380, L = 56, R = 130, T = 66, B = 44;
  const ser = words.map((w) => ({ w, pts: Object.entries(S.ngramSeries[w]).map(([yr, v]) => [+yr, v]).filter(([yr]) => yr >= 1900) }));
  const { step, max } = nice(Math.max(...ser.flatMap((s) => s.pts.map((p) => p[1]))) * 1.05);
  const x = (yr) => L + ((yr - 1900) / 119) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - B);
  let b = "";
  for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
  for (let yr = 1900; yr <= 2019; yr += 20) b += `<text x="${x(yr)}" y="${H - B + 18}" text-anchor="middle">${yr}</text>`;
  ser.forEach((s, i) => {
    // 5-year trailing mean, so single-year noise does not read as a trend.
    const sm = s.pts.map(([yr], k) => [yr, s.pts.slice(Math.max(0, k - 4), k + 1).reduce((a, p) => a + p[1], 0) / Math.min(5, k + 1)]);
    b += `<path class="line c${i}" style="fill:none" d="M${sm.map(([yr, v]) => `${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("L")}"/>`;
    const [ly, lv] = sm[sm.length - 1];
    b += `<text class="lbl b" x="${x(ly) + 8}" y="${y(lv) + 4}">${s.w}</text>`;
  });
  writeFileSync(`${OUT}/sgr-007-books.svg`, svg(W, H, "Three AI-isms in English-language books, 1900 to 2019", "uses per million words, 5-year mean; Google Books Ngram (English 2019)", b));
}
console.error("charts written");
