// SGR-023 charts: static SVGs in the brand palette, light and dark via prefers-color-scheme, series labelled directly.
import { writeFileSync } from "node:fs";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.b{font-weight:600}.grid{stroke:#11100E;stroke-opacity:.1}.ref{stroke:#11100E;stroke-opacity:.55;stroke-dasharray:4 3}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.c2{fill:#07A0C3;stroke:#07A0C3}
.line{fill:none;stroke-width:2}.wide{stroke-width:9;stroke-opacity:.35}.thin{stroke-width:1.5}.dot{stroke:#F6F5F0;stroke-width:1.5}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.ref{stroke:#F6F5F0}
.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.c2{fill:#2CB8D8;stroke:#2CB8D8}.dot{stroke:#141310}}
</style>`;
const svg = (W, H, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;
const f = (x) => (Math.round(x * 100) / 100).toString();
const SECTOR = { bank: "Banks", energy: "Energy", telecom: "Telecoms", software: "Software", grocery: "Supermarkets", travel: "Travel", insurance: "Insurance", fashion: "Fashion", charity: "Charities", food: "Food and drink" };

export function charts(S, OUT) {
  // 1. reading age by sector: brand spread (p10-p90 thin, p25-p75 thick, median dot)
  {
    const rows = Object.entries(S.levels.by_sector).map(([k, v]) => ({ k, p: v.reading_age.brand_p, n: v.brands })).filter((r) => r.p.every(Number.isFinite)).sort((a, b) => b.p[2] - a.p[2]);
    const W = 760, L = 150, R = 60, T = 70, rowH = 34, H = T + rows.length * rowH + 40;
    const lo = Math.floor(Math.min(...rows.map((r) => r.p[0]))), hi = Math.ceil(Math.max(...rows.map((r) => r.p[4])));
    const x = (v) => L + ((v - lo) / Math.max(1, hi - lo)) * (W - L - R);
    let b = "";
    for (let v = lo; v <= hi; v++) b += `<line class="grid" x1="${f(x(v))}" x2="${f(x(v))}" y1="${T - 8}" y2="${H - 32}"/><text x="${f(x(v))}" y="${H - 14}" text-anchor="middle">${v}</text>`;
    rows.forEach((r, i) => { const y = T + i * rowH + 12;
      b += `<text class="lbl" x="${L - 10}" y="${y + 4}" text-anchor="end">${esc(SECTOR[r.k] ?? r.k)}</text><line class="c0 line thin" x1="${f(x(r.p[0]))}" x2="${f(x(r.p[4]))}" y1="${y}" y2="${y}"/><line class="c0 line wide" x1="${f(x(r.p[1]))}" x2="${f(x(r.p[3]))}" y1="${y}" y2="${y}"/><circle class="c0 dot" cx="${f(x(r.p[2]))}" cy="${y}" r="5.5"/><text class="lbl b" x="${W - 12}" y="${y + 4}" text-anchor="end">${f(r.p[2])}</text>`; });
    writeFileSync(`${OUT}/sgr-023-sectors.svg`, svg(W, H, "Reading age of UK brands' blogs and press releases, by sector", "Flesch-Kincaid grade + 5, brand means: dot median, bar 25th to 75th, line 10th to 90th percentile", b));
  }
  // 2. by year: blog and press
  {
    const W = 760, H = 380, L = 56, R = 60, T = 70, Bm = 52;
    const series = ["blog", "press"].map((c) => S.by_year.filter((r) => r.category === c && r.reading_age != null));
    const all = series.flat(); if (!all.length) return;
    const lo = Math.floor(Math.min(...all.map((r) => r.reading_age))), hi = Math.ceil(Math.max(...all.map((r) => r.reading_age)));
    const x = (yr) => L + ((yr - 2015) / 11) * (W - L - R), y = (v) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - Bm);
    let b = "";
    for (let v = lo; v <= hi; v++) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${f(y(v))}" y2="${f(y(v))}"/><text x="${L - 8}" y="${f(y(v) + 4)}" text-anchor="end">${v}</text>`;
    for (let yr = 2015; yr <= 2026; yr++) b += `<text x="${f(x(yr))}" y="${H - Bm + 18}" text-anchor="middle">${yr}</text>`;
    for (const [lab, yv, dy] of [["ChatGPT, Nov 2022", 2022 + 11 / 12, 0], ["Consumer Duty in force, 31 Jul 2023", 2023 + 7 / 12, 16]]) b += `<line class="ref" x1="${f(x(yv))}" x2="${f(x(yv))}" y1="${T - 6}" y2="${H - Bm}"/><text class="lbl" x="${f(x(yv) + 6)}" y="${T + 6 + dy}">${lab}</text>`;
    series.forEach((s, i) => { if (!s.length) return; const c = i === 0 ? "c0" : "c1"; b += `<path class="${c} line" d="M${s.map((r) => `${f(x(r.year))},${f(y(r.reading_age))}`).join("L")}"/>` + s.map((r) => `<circle class="${c} dot" cx="${f(x(r.year))}" cy="${f(y(r.reading_age))}" r="4"/>`).join("") + `<text class="lbl b" x="${f(x(s.at(-1).year) + 8)}" y="${f(y(s.at(-1).reading_age) + 4)}">${i === 0 ? "Blog" : "Press"}</text>`; });
    writeFileSync(`${OUT}/sgr-023-by-year.svg`, svg(W, H, "Reading age of UK brand writing by year, 2015 to 2026", "Flesch-Kincaid grade + 5; mean over brands each year, dated pages only", b));
  }
}
