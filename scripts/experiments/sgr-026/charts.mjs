// SGR-026 charts: static SVGs in the brand palette (same house style as the brand series and SGR-020),
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
const qx = (k) => { const [y, q] = k.split("-Q").map(Number); return y + (q - 0.5) / 4; };

export function writeCharts(S, OUT) {
  // 1. AI-associated words by quarter, with ChatGPT's launch marked.
  {
    const ys = Object.entries(S.byQuarter).filter(([, v]) => v.ai_ism_per1000 != null && v.months >= 1).map(([k, v]) => [qx(k), v.ai_ism_per1000, k]);
    if (ys.length >= 2) {
      const W = 760, H = 380, L = 56, R = 40, T = 70, Bm = 44;
      const { step, max } = nice(Math.max(...ys.map((d) => d[1])) * 1.1);
      const x = (yr) => L + ((yr - 2015) / 12) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - Bm);
      let b = "";
      for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
      for (let yr = 2015; yr <= 2026; yr++) b += `<text x="${x(yr + 0.5)}" y="${H - Bm + 18}" text-anchor="middle">${yr}</text>`;
      const cx = x(2022 + 11 / 12);
      b += `<line class="ref" x1="${cx}" x2="${cx}" y1="${T - 6}" y2="${H - Bm}"/><text class="lbl" x="${cx - 6}" y="${T + 6}" text-anchor="end">ChatGPT launches, Nov 2022</text>`;
      b += `<path class="line c0" d="M${ys.map(([yr, v]) => `${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("L")}"/>`;
      for (const [yr, v] of ys) b += `<circle class="c0 dot" cx="${x(yr)}" cy="${y(v)}" r="3.5"/>`;
      const peak = ys.reduce((a, d) => (d[1] > a[1] ? d : a));
      b += `<text class="lbl b" x="${x(peak[0])}" y="${y(peak[1]) - 10}" text-anchor="middle">${peak[1].toFixed(2)}</text>`;
      b += `<text class="lbl b" x="${x(ys[0][0])}" y="${y(ys[0][1]) - 10}" text-anchor="start">${ys[0][1].toFixed(2)}</text>`;
      b += `<text class="lbl b" x="${x(ys.at(-1)[0]) - 8}" y="${y(ys.at(-1)[1]) + 20}" text-anchor="end">${ys.at(-1)[1].toFixed(2)}</text>`;
      writeFileSync(`${OUT}/sgr-026-by-quarter.svg`, svg(W, H, "AI-associated words in new English Wikipedia articles", "uses per 1,000 words in the first revision, mean of monthly means by quarter", b));
    }
  }
  // 2. Change from 2019-22 to 2024-26, % of the earlier level, with 95% intervals.
  {
    const rows = [["AI-associated words", S.H1], ["Em dashes", S.H3], ["AI sentence shapes", S.H4], ["Average sentence length", S.H5]].filter(([, s]) => s.lo != null && s.from_mean).map(([l, s]) => ({ l, pt: (100 * s.point) / s.from_mean, lo: (100 * s.lo) / s.from_mean, hi: (100 * s.hi) / s.from_mean }));
    if (rows.length) {
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
      writeFileSync(`${OUT}/sgr-026-change.svg`, svg(W, H, "What changed in new Wikipedia articles after ChatGPT", "2024 to Sep 2026 against 2019 to Nov 2022, % of the earlier level; line: 95% interval; blue: interval clears zero", b));
    }
  }
  // 3. Share of new article-namespace pages later deleted, by quarter (creation log, from mid-2018).
  {
    const ds = Object.entries(S.deletions.by_quarter).filter(([, v]) => v.share != null && v.entries >= 100).map(([k, v]) => [qx(k), v.share * 100]).sort((a, b) => a[0] - b[0]);
    if (ds.length >= 2) {
      const W = 760, H = 340, L = 56, R = 40, T = 70, Bm = 44;
      const { step, max } = nice(Math.max(...ds.map((d) => d[1])) * 1.1);
      const x = (yr) => L + ((yr - 2018) / 9) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - Bm);
      let b = "";
      for (let v = 0; v <= max + 1e-9; v += step) b += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(1)}%</text>`;
      for (let yr = 2018; yr <= 2026; yr++) b += `<text x="${x(yr + 0.5)}" y="${H - Bm + 18}" text-anchor="middle">${yr}</text>`;
      const cx = x(2022 + 11 / 12);
      b += `<line class="ref" x1="${cx}" x2="${cx}" y1="${T - 6}" y2="${H - Bm}"/><text class="lbl" x="${cx - 6}" y="${T + 6}" text-anchor="end">ChatGPT launches</text>`;
      b += `<path class="line c1" d="M${ds.map(([yr, v]) => `${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("L")}"/>`;
      for (const [yr, v] of ds) b += `<circle class="c1 dot" cx="${x(yr)}" cy="${y(v)}" r="3.5"/>`;
      b += `<text class="lbl b" x="${x(ds.at(-1)[0]) - 8}" y="${y(ds.at(-1)[1]) - 10}" text-anchor="end">${ds.at(-1)[1].toFixed(1)}%</text>`;
      writeFileSync(`${OUT}/sgr-026-deleted.svg`, svg(W, H, "New article-namespace pages that have since been deleted", "share of creation-log entries (sampled eight windows a month) whose page no longer exists, by quarter", b));
    }
  }
}
