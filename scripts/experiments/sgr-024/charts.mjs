// SGR-024 charts: static SVGs in the brand palette, light and dark via prefers-color-scheme,
// every series directly labelled. The page's tables carry the same numbers.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const STYLE = `<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.lbl{fill:#11100E}.grid{stroke:#11100E;stroke-opacity:.1}.ref{stroke:#11100E;stroke-opacity:.55;stroke-dasharray:4 3}
.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.c2{fill:#07A0C3;stroke:#07A0C3}.c3{fill:#11100E;stroke:#11100E}
.line{fill:none;stroke-width:2}.band{fill:none;stroke-width:6;stroke-opacity:.45}.dot{stroke:#F6F5F0;stroke-width:1.5}
@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.ref{stroke:#F6F5F0}
.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.c2{fill:#2CB8D8;stroke:#2CB8D8}.c3{fill:#F6F5F0;stroke:#F6F5F0}.dot{stroke:#141310}}
</style>`;
const svg = (W, H, title, sub, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">${STYLE}<text class="t" x="16" y="24">${esc(title)}</text><text x="16" y="42">${esc(sub)}</text>${body}</svg>`;
const niceMax = (v) => { const mag = 10 ** Math.floor(Math.log10(Math.max(v, 0.01) / 4)); const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * 4 >= v) ?? mag * 10; return { step, max: step * Math.ceil(v / step) }; };
const f = (x) => (Math.round(x * 100) / 100).toString();

function axes(x0, y0, w, h, xmin, xmax, ymax, xticks, yfmt = (v) => v) {
  const { step, max } = niceMax(ymax); let g = "";
  for (let v = 0; v <= max + 1e-9; v += step) { const y = y0 + h - (v / max) * h; g += `<line class="grid" x1="${x0}" x2="${x0 + w}" y1="${f(y)}" y2="${f(y)}"/><text x="${x0 - 6}" y="${f(y + 4)}" text-anchor="end">${yfmt(Math.round(v * 100) / 100)}</text>`; }
  for (const t of xticks) g += `<text x="${f(x0 + ((t - xmin) / (xmax - xmin)) * w)}" y="${y0 + h + 16}" text-anchor="middle">${t}</text>`;
  return { g, X: (v) => x0 + ((v - xmin) / (xmax - xmin)) * w, Y: (v) => y0 + h - (v / max) * h, max };
}

export function halfYearChart(rows, ref) {
  const W = 760, H = 380, x0 = 52, y0 = 60, w = W - 52 - 110, h = 270;
  const pts = rows.filter((r) => r.docs > 0);
  const xs = pts.map((r) => { const [y, hh] = r.half.split("H"); return +y + (+hh - 1) * 0.5; });
  const ymax = Math.max(...pts.flatMap((r) => [r.old_pct, r.new_pct]), 1) * 1.1;
  const a = axes(x0, y0, w, h, 2015, 2027, ymax, [2015, 2017, 2019, 2021, 2023, 2025], (v) => v + "%");
  let body = a.g;
  const line = (key, cls, label, dy) => {
    const p = pts.map((r, i) => [a.X(xs[i]), a.Y(r[key])]);
    let s = `<polyline class="line ${cls}" points="${p.map((q) => `${f(q[0])},${f(q[1])}`).join(" ")}"/>`;
    for (const q of p) s += `<circle class="dot ${cls}" cx="${f(q[0])}" cy="${f(q[1])}" r="3"/>`;
    const l = p[p.length - 1];
    return s + `<text class="lbl" x="${f(l[0] + 8)}" y="${f(l[1] + 4 + dy)}">${esc(label)}</text>`;
  };
  body += line("old_pct", "c1", "Old tells", 0) + line("new_pct", "c0", "New words", 0);
  body += `<line class="ref" x1="${f(a.X(2022.92))}" x2="${f(a.X(2022.92))}" y1="${y0}" y2="${y0 + h}"/><text x="${f(a.X(2022.92) - 6)}" y="${y0 + 12}" text-anchor="end">ChatGPT</text>`;
  body += `<text x="${x0}" y="${H - 14}">Share of PubMed abstracts containing at least one word of each set, by half-year of entry. Source: ScriptGrain SGR-024, CC BY 4.0.</text>`;
  return svg(W, H, "Did the AI tells reach medicine?", "Old-tell and new-word sets from SGR-008, measured on a 10% sample of PubMed abstracts", body);
}

export function boundsChart(bounds, placebo) {
  const W = 760, H = 330, x0 = 52, y0 = 60, w = W - 52 - 150, h = 220;
  const years = [2023, 2024, 2025, 2026];
  const series = [["union", "c0", "2024 and 2026 style words"], ["set2024", "c1", "2024 style words"], ["set2026", "c2", "2026 style words"]];
  const all = series.flatMap(([k]) => years.map((y) => bounds[k]?.[y]?.hi)).filter((v) => v != null);
  const a = axes(x0, y0, w, h, 2022.6, 2026.4, Math.max(...all, 5) * 1.1, years, (v) => v + "%");
  let body = a.g;
  series.forEach(([k, cls, label], si) => {
    const p = years.map((y) => [y, bounds[k]?.[y]]).filter(([, b]) => b && b.pct != null);
    if (!p.length) return;
    for (const [y, b] of p) if (b.lo != null) body += `<line class="band ${cls}" x1="${f(a.X(y + si * 0.04 - 0.04))}" x2="${f(a.X(y + si * 0.04 - 0.04))}" y1="${f(a.Y(Math.max(b.lo, 0)))}" y2="${f(a.Y(b.hi))}"/>`;
    body += `<polyline class="line ${cls}" points="${p.map(([y, b]) => `${f(a.X(y + si * 0.04 - 0.04))},${f(a.Y(b.pct))}`).join(" ")}"/>`;
    for (const [y, b] of p) body += `<circle class="dot ${cls}" cx="${f(a.X(y + si * 0.04 - 0.04))}" cy="${f(a.Y(b.pct))}" r="3"/>`;
    const l = p[p.length - 1];
    body += `<text class="lbl" x="${f(a.X(l[0]) + 10)}" y="${f(a.Y(l[1].pct) + 4)}">${esc(label)}</text>`;
  });
  body += `<text x="${x0}" y="${H - 14}">Lower bound on the share of abstracts using the words, with 95% intervals over journals. Source: ScriptGrain SGR-024, CC BY 4.0.</text>`;
  return svg(W, H, "Lower bound on abstracts touched by style words", "Share above the pre-ChatGPT trend, by year of entry", body);
}
