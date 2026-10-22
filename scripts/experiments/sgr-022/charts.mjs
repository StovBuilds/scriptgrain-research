// SGR-022 charts: static SVGs in the brand palette (same house style as the brand series),
// light and dark via prefers-color-scheme, every series directly labelled.
import { writeFileSync } from "node:fs";
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

export function writeCharts(S, OUT) {
  // 1. AI-associated words by year, with ChatGPT's launch marked.
  {
    const ys = Object.entries(S.byYear).map(([y, v]) => [+y, v.ai_ism_per1000, v.texts]).filter((d) => d[1] != null);
    const W = 760, H = 380, L = 56, R = 40, T = 70, Bm = 52;
    const { step, max } = nice(Math.max(...ys.map((d) => d[1])) * 1.1);
    const x = (y) => L + ((y - 2015) / 11) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - Bm);
    let b = "";
    for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
    for (const [yr, , n] of ys) b += `<text x="${x(yr)}" y="${H - Bm + 18}" text-anchor="middle">${yr}</text><text x="${x(yr)}" y="${H - Bm + 34}" text-anchor="middle" style="font-size:10px">${n}</text>`;
    const cx = x(2022 + 11 / 12);
    b += `<line class="ref" x1="${cx}" x2="${cx}" y1="${T - 6}" y2="${H - Bm}"/><text class="lbl" x="${cx + 6}" y="${T + 6}">ChatGPT launches, Nov 2022</text>`;
    b += `<path class="line c0" d="M${ys.map(([yr, v]) => `${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("L")}"/>`;
    for (const [yr, v] of ys) b += `<circle class="c0 dot" cx="${x(yr)}" cy="${y(v)}" r="4.5"/>`;
    const peak = ys.reduce((a, d) => (d[1] > a[1] ? d : a));
    b += `<text class="lbl b" x="${x(peak[0])}" y="${y(peak[1]) - 12}" text-anchor="middle">${peak[1].toFixed(2)}</text>`;
    b += `<text class="lbl b" x="${x(ys[0][0])}" y="${y(ys[0][1]) - 12}" text-anchor="start">${ys[0][1].toFixed(2)}</text>`;
    b += `<text class="lbl b" x="${x(ys.at(-1)[0]) - 10}" y="${y(ys.at(-1)[1]) + 20}" text-anchor="end">${ys.at(-1)[1].toFixed(2)}</text>`;
    writeFileSync(`${OUT}/sgr-022-by-year.svg`, svg(W, H, "AI-associated words in ministers' written answers in Parliament", "uses per 1,000 words, mean over departments each year; small figures: pages measured", b));
  }
  // 2. Within-department change, % of the 2019-22 level, with 95% intervals.
  {
    const rows = [["AI-associated words", S.answers.H1], ["Em dashes", S.answers.H3], ["AI sentence shapes", S.answers.H4], ["Average sentence length", S.answers.H5]].filter(([, s]) => s.lo != null && s.from_mean).map(([l, s]) => ({ l, pt: (100 * s.point) / s.from_mean, lo: (100 * s.lo) / s.from_mean, hi: (100 * s.hi) / s.from_mean }));
    const W = 760, L = 230, R = 70, T = 88, rowH = 40, H = T + rows.length * rowH + 40;
    const a = Math.floor(Math.min(-20, ...rows.map((r) => r.lo)) / 20) * 20, z = Math.ceil(Math.max(40, ...rows.map((r) => r.hi)) / 20) * 20;
    const x = (v) => L + ((v - a) / (z - a)) * (W - L - R);
    let b = "";
    for (let v = a; v <= z; v += 20) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - 32}"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v > 0 ? "+" : ""}${v}%</text>`;
    b += `<line class="ref" x1="${x(0)}" x2="${x(0)}" y1="${T - 14}" y2="${H - 32}"/><text class="lbl" x="${x(0)}" y="${T - 20}" text-anchor="middle">no change</text>`;
    rows.forEach((r, i) => {
      const y = T + i * rowH + 14, sig = r.lo > 0 || r.hi < 0;
      b += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${esc(r.l)}</text>`;
      b += `<line class="ci" x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${y}" y2="${y}"/><circle class="${sig ? "c0" : "c1"} dot" cx="${x(r.pt)}" cy="${y}" r="6"/>`;
      b += `<text class="lbl b" x="${W - 12}" y="${y + 4}" text-anchor="end">${r.pt > 0 ? "+" : ""}${r.pt.toFixed(0)}%</text>`;
    });
    writeFileSync(`${OUT}/sgr-022-change.svg`, svg(W, H, "What changed within the same departments after ChatGPT", "2024 to Sep 2026 against 2019 to Nov 2022, % of the earlier level; line: 95% interval; blue: interval clears zero", b));
  }
  // 3. Every department: AI-associated words 2019-22 against 2024-26, sorted by change.
  {
    const rows = S.units.filter((u) => u.ai_ism_per1000_late != null && u.ai_ism_per1000_after != null && u.LATE >= 10 && u.AFTER >= 10).sort((a, b) => b.ai_ism_per1000_after - b.ai_ism_per1000_late - (a.ai_ism_per1000_after - a.ai_ism_per1000_late));
    if (!rows.length) return;
    const short = (n) => n.replace(/ \(.*\)$/, "").replace("Foreign, Commonwealth and Development Office", "FCDO").replace("Prime Minister's Office", "Prime Minister's Office");
    const W = 760, L = 250, R = 50, T = 88, rowH = 26, H = T + rows.length * rowH + 40;
    const mx = Math.ceil(Math.max(...rows.flatMap((u) => [u.ai_ism_per1000_late, u.ai_ism_per1000_after])) * 1.1 * 2) / 2;
    const x = (v) => L + (v / mx) * (W - L - R);
    let b = "";
    for (let v = 0; v <= mx + 1e-9; v += mx / 4) b += `<line class="grid" x1="${x(v)}" x2="${x(v)}" y1="${T - 8}" y2="${H - 32}"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v.toFixed(1)}</text>`;
    b += `<circle class="c1" cx="${L + 4}" cy="${T - 30}" r="5"/><text class="lbl" x="${L + 14}" y="${T - 26}">2019 to Nov 2022</text><circle class="c0" cx="${L + 150}" cy="${T - 30}" r="5"/><text class="lbl" x="${L + 160}" y="${T - 26}">2024 to Sep 2026</text>`;
    rows.forEach((u, i) => {
      const y = T + i * rowH + 10;
      b += `<text class="lbl" x="${L - 12}" y="${y + 4}" text-anchor="end">${esc(short(u.name))}</text>`;
      b += `<line class="ci" x1="${x(u.ai_ism_per1000_late)}" x2="${x(u.ai_ism_per1000_after)}" y1="${y}" y2="${y}"/><circle class="c1 dot" cx="${x(u.ai_ism_per1000_late)}" cy="${y}" r="5"/><circle class="c0 dot" cx="${x(u.ai_ism_per1000_after)}" cy="${y}" r="5"/>`;
    });
    writeFileSync(`${OUT}/sgr-022-departments.svg`, svg(W, H, "AI-associated words, department by department", "uses per 1,000 words; departments with at least 10 answers in both periods; sorted by change", b));
  }
}
