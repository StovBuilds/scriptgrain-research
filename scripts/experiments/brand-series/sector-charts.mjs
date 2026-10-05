#!/usr/bin/env bun
// Sector report charts (SGR-013..018): for each sector, (1) six habits as % above or below the
// other nine sectors, (2) AI-associated words by year, the sector against all brands.
// Brand palette, light/dark, direct labels.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const S = JSON.parse(readFileSync(dir + "summary-sectors.json", "utf8"));
export const SLUG = { bank: "banks", energy: "energy", telecom: "telecoms", software: "software", insurance: "insurance", charity: "charities" };
const NAME = { bank: "Banks", energy: "Energy companies", telecom: "Telecoms brands", software: "Software companies", insurance: "Insurers", charity: "Charities" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.lbl.b{font-weight:600}.grid{stroke:#11100E;stroke-opacity:.1}.ref{stroke:#11100E;stroke-opacity:.55;stroke-dasharray:4 3}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.c2{fill:#07A0C3;stroke:#07A0C3}.line{fill:none;stroke-width:2}.dot{stroke:#F6F5F0;stroke-width:2}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.ref{stroke:#F6F5F0}.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.c2{fill:#2CB8D8;stroke:#2CB8D8}.dot{stroke:#141310}}
</style>`;
const svg = (W, H, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>\n`;
export const HABITS = [["avg_sentence_length", "Words per sentence"], ["you_share", "'You' share of I, we, you"], ["contractions_per1000", "Contractions"], ["questions_per1000", "Questions"], ["em_dash_per1000", "Em dashes"], ["ai_ism_per1000", "AI-associated words"]];
export const sizes = {};
for (const [k, d] of Object.entries(S)) {
  // 1. habits vs other sectors
  {
    const rows = HABITS.map(([h, l]) => ({ l, v: (100 * (d.habits[h].sector - d.habits[h].others)) / d.habits[h].others }));
    const W = 760, L = 230, R = 70, T = 88, rowH = 34, H = T + rows.length * rowH + 40;
    const m = Math.max(40, ...rows.map((r) => Math.abs(r.v))); const a = -Math.ceil(m / 20) * 20, z = -a;
    const x = (v) => L + ((v - a) / (z - a)) * (W - L - R);
    let b = "";
    for (let v = a; v <= z; v += 20) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - 32}"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v > 0 ? "+" : ""}${v}%</text>`;
    b += `<line class="ref" x1="${x(0)}" x2="${x(0)}" y1="${T - 14}" y2="${H - 32}"/><text class="lbl" x="${x(0)}" y="${T - 20}" text-anchor="middle">other sectors</text>`;
    rows.forEach((r, i) => {
      const y = T + i * rowH + 12, x0 = x(Math.min(0, r.v)), x1 = x(Math.max(0, r.v));
      b += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${esc(r.l)}</text>`;
      b += `<rect class="${r.v >= 0 ? "c0" : "c2"}" x="${x0}" y="${y - 9}" width="${Math.max(1, x1 - x0)}" height="18" rx="2"/>`;
      b += `<text class="lbl b" x="${W - 12}" y="${y + 4}" text-anchor="end">${r.v > 0 ? "+" : ""}${Math.round(r.v)}%</text>`;
    });
    writeFileSync(`public/research/sgr-sector-${SLUG[k]}-habits.svg`, svg(W, H, `How ${NAME[k].toLowerCase()} write, against the other nine sectors`, `difference from the mean of the other sectors' brands, blog posts and press releases; ${d.brands} brands`, b));
    sizes[`habits-${k}`] = H;
  }
  // 2. year series vs all brands
  {
    const yrs = Object.keys(d.allYearsAi).map(Number).sort();
    const sec = yrs.filter((y) => d.years[y] && d.years[y].pages >= 10).map((y) => [y, d.years[y].ai_ism_per1000]);
    const all = yrs.map((y) => [y, d.allYearsAi[y]]);
    const W = 760, H = 360, L = 56, R = 130, T = 66, Bm = 44;
    const mx = Math.max(...sec.map((p) => p[1]), ...all.map((p) => p[1])) * 1.12;
    const step = mx > 3 ? 1 : 0.5, max = Math.ceil(mx / step) * step;
    const x = (y) => L + ((y - 2015) / 11) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - Bm);
    let b = "";
    for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    for (let yr = 2015; yr <= 2026; yr += 1) b += `<text x="${x(yr)}" y="${H - Bm + 18}" text-anchor="middle" style="font-size:10px">${yr}</text>`;
    const cx = x(2022 + 11 / 12); b += `<line class="ref" x1="${cx}" x2="${cx}" y1="${T - 6}" y2="${H - Bm}"/><text class="lbl" x="${cx + 6}" y="${T + 6}">ChatGPT, Nov 2022</text>`;
    const path = (pts, cls) => `<path class="line ${cls}" style="fill:none" d="M${pts.map(([a, v]) => `${x(a).toFixed(1)},${y(v).toFixed(1)}`).join("L")}"/>` + pts.map(([a, v]) => `<circle class="${cls} dot" cx="${x(a)}" cy="${y(v)}" r="4"/>`).join("");
    b += path(all, "c1") + path(sec, "c0");
    const le = (pts, cls, t) => { const [a, v] = pts.at(-1); return `<text class="lbl b" x="${x(a) + 9}" y="${y(v) + 4}">${t}</text>`; };
    const sl = sec.at(-1), al = all.at(-1); const dy = sl && al && Math.abs(y(sl[1]) - y(al[1])) < 16 ? 16 : 0;
    if (sec.length) b += `<text class="lbl b" x="${x(sl[0]) + 9}" y="${y(sl[1]) + 4 - (sl[1] >= al[1] ? dy : 0)}">${esc(NAME[k])}</text>`;
    b += `<text class="lbl" x="${x(al[0]) + 9}" y="${y(al[1]) + 4 + (sl && sl[1] >= al[1] ? 0 : dy)}">All brands</text>`;
    writeFileSync(`public/research/sgr-sector-${SLUG[k]}-years.svg`, svg(W, H, `AI-associated words in ${NAME[k].toLowerCase()}' writing, by year`, "uses per 1,000 words, mean over brands each year; years with 10+ pages", b));
    sizes[`years-${k}`] = H;
  }
}
if (import.meta.main) console.error("sector charts", JSON.stringify(sizes));
