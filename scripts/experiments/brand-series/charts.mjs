#!/usr/bin/env bun
// Brand writing series charts (SGR-010, SGR-011): static SVGs in the brand palette (blue,
// gold, teal; no derived shades), light and dark via prefers-color-scheme, every series
// directly labelled. The pages' tables carry the same numbers.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const S10 = JSON.parse(readFileSync(dir + "summary-010.json", "utf8"));
const S11 = JSON.parse(readFileSync(dir + "summary-011.json", "utf8"));
const OUT = "public/research";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}
.grid{stroke:#11100E;stroke-opacity:.1}.ref{stroke:#11100E;stroke-opacity:.55;stroke-dasharray:4 3}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.c2{fill:#07A0C3;stroke:#07A0C3}
.ci{stroke:#11100E;stroke-opacity:.55;stroke-width:1.5}.line{fill:none;stroke-width:2}.dot{stroke:#F6F5F0;stroke-width:2}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.ref,.ci{stroke:#F6F5F0}
.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.c2{fill:#2CB8D8;stroke:#2CB8D8}.dot{stroke:#141310}}
</style>`;
const svg = (W, H, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;
const nice = (raw) => { const mag = 10 ** Math.floor(Math.log10(raw / 4)); const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * 4 >= raw); return { step, max: step * Math.ceil(raw / step) }; };
const SECTOR = { bank: "Banks", energy: "Energy", telecom: "Telecoms", software: "Software", grocery: "Supermarkets", travel: "Travel", insurance: "Insurance", fashion: "Fashion", charity: "Charities", food: "Food and drink" };

// 1. SGR-011: AI-associated words by year, with ChatGPT's launch marked.
{
  const ys = Object.entries(S11.byYear).map(([y, v]) => [+y, v.ai_ism_per1000, v.pages]);
  const W = 760, H = 380, L = 56, R = 40, T = 70, Bm = 52;
  const { step, max } = nice(Math.max(...ys.map((d) => d[1])) * 1.1);
  const x = (y) => L + ((y - 2015) / 11) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - Bm);
  let b = "";
  for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
  for (const [yr, , n] of ys) b += `<text x="${x(yr)}" y="${H - Bm + 18}" text-anchor="middle">${yr}</text><text x="${x(yr)}" y="${H - Bm + 34}" text-anchor="middle" style="font-size:10px">${n}</text>`;
  const cx = x(2022 + 11 / 12);
  b += `<line class="ref" x1="${cx}" x2="${cx}" y1="${T - 6}" y2="${H - Bm}"/><text class="lbl" x="${cx + 6}" y="${T + 6}">ChatGPT launches, Nov 2022</text>`;
  b += `<path class="line c0" style="fill:none" d="M${ys.map(([yr, v]) => `${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("L")}"/>`;
  for (const [yr, v] of ys) b += `<circle class="c0 dot" cx="${x(yr)}" cy="${y(v)}" r="4.5"/>`;
  const peak = ys.reduce((a, d) => (d[1] > a[1] ? d : a));
  b += `<text class="lbl b" x="${x(peak[0])}" y="${y(peak[1]) - 12}" text-anchor="middle">${peak[1].toFixed(2)}</text>`;
  b += `<text class="lbl b" x="${x(2015)}" y="${y(ys[0][1]) - 12}" text-anchor="start">${ys[0][1].toFixed(2)}</text>`;
  b += `<text class="lbl b" x="${x(2026) - 10}" y="${y(ys.at(-1)[1]) + 20}" text-anchor="end">${ys.at(-1)[1].toFixed(2)}</text>`;
  writeFileSync(`${OUT}/sgr-011-by-year.svg`, svg(W, H, "AI-associated words in UK brands' blogs and press releases", "uses per 1,000 words, mean over brands each year; small figures: pages measured", b));
}

// 2. SGR-011: within-brand change, 2019-22 to 2024-26, as a % of the 2019-22 level, with 95% intervals.
{
  const rows = [["AI-associated words", "H1", S11.H1], ["Em dashes", "H3", S11.H3], ["AI sentence shapes", "H4", S11.H4], ["Average sentence length", "H5", S11.H5]].map(([l, h, s]) => ({ l, h, pt: (100 * s.point) / s.late_mean, lo: (100 * s.lo) / s.late_mean, hi: (100 * s.hi) / s.late_mean, s }));
  const W = 760, L = 230, R = 70, T = 88, rowH = 40, H = T + rows.length * rowH + 40;
  const lo = Math.min(-30, ...rows.map((r) => r.lo)) , hi = Math.max(60, ...rows.map((r) => r.hi));
  const a = Math.floor(lo / 20) * 20, z = Math.ceil(hi / 20) * 20;
  const x = (v) => L + ((v - a) / (z - a)) * (W - L - R);
  let b = "";
  for (let v = a; v <= z; v += 20) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - 32}"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v > 0 ? "+" : ""}${v}%</text>`;
  b += `<line class="ref" x1="${x(0)}" x2="${x(0)}" y1="${T - 14}" y2="${H - 32}"/><text class="lbl" x="${x(0)}" y="${T - 20}" text-anchor="middle">no change</text>`;
  rows.forEach((r, i) => {
    const y = T + i * rowH + 14;
    const sig = r.lo > 0 || r.hi < 0;
    b += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${esc(r.l)}</text>`;
    b += `<line class="ci" x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${y}" y2="${y}"/><circle class="${sig ? "c0" : "c1"} dot" cx="${x(r.pt)}" cy="${y}" r="6"/>`;
    b += `<text class="lbl b" x="${W - 12}" y="${y + 4}" text-anchor="end">${r.pt > 0 ? "+" : ""}${r.pt.toFixed(0)}%</text>`;
  });
  writeFileSync(`${OUT}/sgr-011-change.svg`, svg(W, H, "What changed within the same brands after ChatGPT", "2024-26 against 2019-22, % of the 2019-22 level; line: 95% interval; blue: interval clears zero", b));
}

// 3. SGR-010: press release minus blog post, within brand, % of the blog level.
{
  const pick = [["avg_sentence_length", "Average sentence length"], ["long_word_share", "Long words (7+ letters)"], ["commas_per_sentence", "Commas per sentence"], ["ai_ism_per1000", "AI-associated words"], ["contractions_per1000", "Contractions"], ["you_share", "'You' share of I, we, you"], ["questions_per1000", "Questions"], ["exclamations_per1000", "Exclamation marks"]];
  const rows = pick.map(([k, l]) => { const d = S10.pressVsBlog[k]; const base = S10.byCategory.blog[k].brand_weighted_mean; return { l, pt: (100 * d.point) / base, lo: (100 * d.lo) / base, hi: (100 * d.hi) / base }; });
  const W = 760, L = 230, R = 70, T = 88, rowH = 32, H = T + rows.length * rowH + 40;
  const a = Math.floor(Math.min(...rows.map((r) => r.lo)) / 20) * 20, z = Math.ceil(Math.max(...rows.map((r) => r.hi)) / 20) * 20;
  const x = (v) => L + ((v - a) / (z - a)) * (W - L - R);
  let b = "";
  for (let v = a; v <= z; v += 20) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - 32}"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v > 0 ? "+" : ""}${v}%</text>`;
  b += `<line class="ref" x1="${x(0)}" x2="${x(0)}" y1="${T - 14}" y2="${H - 32}"/><text class="lbl" x="${x(0)}" y="${T - 20}" text-anchor="middle">same as the blog</text>`;
  rows.forEach((r, i) => {
    const y = T + i * rowH + 12;
    b += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${esc(r.l)}</text>`;
    b += `<line class="ci" x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${y}" y2="${y}"/><circle class="${r.pt >= 0 ? "c0" : "c2"} dot" cx="${x(r.pt)}" cy="${y}" r="5.5"/>`;
    b += `<text class="lbl b" x="${W - 12}" y="${y + 4}" text-anchor="end">${r.pt > 0 ? "+" : ""}${r.pt.toFixed(0)}%</text>`;
  });
  writeFileSync(`${OUT}/sgr-010-press-vs-blog.svg`, svg(W, H, "Press release against blog post, within the same brand", "difference as % of the brand's blog level; line: 95% interval; blue: more in press releases, teal: less", b));
}

// 4. SGR-010: sectors on two habits (average sentence length, 'you' share), brand-weighted, blog + press.
{
  const pts = Object.entries(S10.bySector).map(([s, m]) => ({ s, x: m.avg_sentence_length.brand_weighted_mean, y: m.you_share.brand_weighted_mean }));
  const W = 760, H = 460, L = 60, R = 30, T = 70, Bm = 48;
  const x0 = Math.floor(Math.min(...pts.map((p) => p.x)) - 1), x1 = Math.ceil(Math.max(...pts.map((p) => p.x)) + 1);
  const y0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p.y)) - 0.05) * 10) / 10), y1 = Math.min(1, Math.ceil((Math.max(...pts.map((p) => p.y)) + 0.05) * 10) / 10);
  const x = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R), y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - Bm);
  let b = "";
  for (let v = x0; v <= x1; v += 1) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - Bm}"/><text x="${x(v)}" y="${H - Bm + 18}" text-anchor="middle">${v}</text>`;
  for (let v = y0; v <= y1 + 1e-9; v += 0.1) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  b += `<text x="${W - R}" y="${H - 8}" text-anchor="end">average words per sentence →</text><text x="${L}" y="${T - 12}">↑ "you" as a share of I, we and you</text>`;
  const placed = [];
  for (const p of pts.sort((a, c) => c.y - a.y)) {
    b += `<circle class="c0 dot" cx="${x(p.x)}" cy="${y(p.y)}" r="6"/>`;
    let ly = y(p.y) + 4; const lx = x(p.x) + 10;
    for (const q of placed) if (Math.abs(q.x - lx) < 110 && Math.abs(q.y - ly) < 15) ly = q.y + 15;
    placed.push({ x: lx, y: ly });
    b += `<text class="lbl" x="${lx}" y="${ly}">${SECTOR[p.s]}</text>`;
  }
  writeFileSync(`${OUT}/sgr-010-sectors.svg`, svg(W, H, "How each sector writes: sentence length and 'you'", "blog posts and press releases, mean over the brands in each sector", b));
}
console.error("charts written");
