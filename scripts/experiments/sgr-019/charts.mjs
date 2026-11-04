// SGR-019 charts: static SVGs in the brand palette, light and dark via prefers-color-scheme,
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
// Footnotes are 12px mono (~7.2px a character) in a 760-wide viewBox, so anything past
// ~100 characters runs off the edge: split notes into lines instead.
const note = (x, y, lines) => lines.map((t, i) => `<text x="${x}" y="${y + i * 14}">${esc(t)}</text>`).join("");
// End labels that share a column must not overlap: push neighbours apart to a 14px gap,
// keeping each pair centred on where its points sit.
function spreadLabels(ends, gap = 14) {
  const out = ends.map((e) => ({ ...e })).sort((a, b) => a.y - b.y);
  for (let k = 0; k < 50; k++) for (let i = 1; i < out.length; i++) {
    const a = out[i - 1], b = out[i];
    if (Math.abs(a.x - b.x) > 60) continue;
    const d = gap - (b.y - a.y);
    if (d > 0) { a.y -= d / 2; b.y += d / 2; }
  }
  return out;
}

function axes(x0, y0, w, h, xmin, xmax, ymax, xticks, yfmt = (v) => v) {
  const { step, max } = niceMax(ymax); let g = "";
  for (let v = 0; v <= max + 1e-9; v += step) { const y = y0 + h - (v / max) * h; g += `<line class="grid" x1="${x0}" x2="${x0 + w}" y1="${f(y)}" y2="${f(y)}"/><text x="${x0 - 6}" y="${f(y + 4)}" text-anchor="end">${yfmt(Math.round(v * 100) / 100)}</text>`; }
  for (const t of xticks) g += `<text x="${f(x0 + ((t - xmin) / (xmax - xmin)) * w)}" y="${y0 + h + 16}" text-anchor="middle">${t}</text>`;
  return { g, X: (v) => x0 + ((v - xmin) / (xmax - xmin)) * w, Y: (v) => y0 + h - (v / max) * h, max };
}

export function longRun({ gutDecades, bands, home, brand, arxiv }) {
  const W = 760, H = 414, x0 = 52, y0 = 60, w = W - 52 - 120, h = 290;
  const all = [...gutDecades, ...home, ...brand, ...arxiv].flatMap((r) => [r.hi ?? r.per1000, r.per1000]).filter((v) => v != null);
  const bandTop = bands.map((b) => b.hi ?? b.per1000).filter((v) => v != null);
  const a = axes(x0, y0, w, h, 1800, 2030, Math.max(...all, ...bandTop, 1) * 1.05, [1800, 1850, 1900, 1950, 2000, 2025]);
  let body = a.g;
  const BX = { "1700s": [1800, 1800], "1800s": [1800, 1899], "early 1900s": [1900, 1999] };
  for (const b of bands) { if (b.per1000 == null || !BX[b.band] || b.band === "1700s") continue; body += `<line class="band c0" x1="${f(a.X(BX[b.band][0]))}" x2="${f(a.X(BX[b.band][1]))}" y1="${f(a.Y(b.per1000))}" y2="${f(a.Y(b.per1000))}"/>`; }
  const line = (rows, cls, label, dx = 0, dy = 0, xo = 0) => {
    const pts = rows.filter((r) => r.per1000 != null).map((r) => [a.X(r.year + xo), a.Y(r.per1000), r]);
    if (!pts.length) return "";
    let s = `<polyline class="line ${cls}" points="${pts.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}"/>`;
    for (const p of pts) s += `<circle class="dot ${cls}" cx="${f(p[0])}" cy="${f(p[1])}" r="3"/>`;
    const l = pts[pts.length - 1];
    ends.push({ x: l[0] + 8 + dx, y: l[1] + 4 + dy, label });
    return s;
  };
  const ends = [];
  body += line(gutDecades, "c0", "Books", 0, 0, 5) + line(home, "c2", "Homepages") + line(brand, "c1", "UK brands") + line(arxiv, "c3", "arXiv");
  body += spreadLabels(ends).map((e) => `<text class="lbl" x="${f(e.x)}" y="${f(e.y)}">${esc(e.label)}</text>`).join("");
  body += `<line class="ref" x1="${f(a.X(2022.92))}" x2="${f(a.X(2022.92))}" y1="${y0}" y2="${y0 + h}"/><text x="${f(a.X(2022.92) - 6)}" y="${y0 + 12}" text-anchor="end">ChatGPT</text>`;
  body += note(x0, H - 28, ["Em dashes per 1,000 words. Thick bars: Gutenberg books by author era (1800s, 1900s).", "Source: ScriptGrain SGR-019, CC BY 4.0."]);
  return svg(W, H, "Em dashes per 1,000 words, 1800 to 2026", "Five bodies of writing; each dot is one decade (books) or one year", body);
}

export function afterChat(panels) {
  const W = 760, ph = 190, H = 60 + panels.length * ph + 38;
  let body = "";
  panels.forEach((p, i) => {
    const x0 = 52, y0 = 70 + i * ph, w = W - 52 - 40, h = ph - 60, xs = p.groups.map((g) => g.x);
    if (!xs.length) return;
    const xmin = Math.min(...xs), xmax = Math.max(...xs, xmin + 1), ymax = Math.max(...p.groups.map((g) => g.rate), 0.5) * 1.1;
    const a = axes(x0, y0, w, h, xmin, xmax, ymax, [...new Set(xs.map((x) => Math.floor(x)))].filter((_, k) => k % 2 === 0));
    body += `<text class="lbl" x="${x0}" y="${y0 - 8}">${esc(p.title)}</text>` + a.g;
    const pre = p.groups.filter((g) => g.isPre);
    if (pre.length >= 4) { // same weighted-free eyeball line as the test's fit: unweighted OLS for display only
      const n = pre.length, mx = pre.reduce((s, g) => s + g.x, 0) / n, my = pre.reduce((s, g) => s + g.rate, 0) / n;
      const b = pre.reduce((s, g) => s + (g.x - mx) * (g.rate - my), 0) / pre.reduce((s, g) => s + (g.x - mx) ** 2, 0), c = my - b * mx;
      body += `<line class="ref" x1="${f(a.X(pre[0].x))}" x2="${f(a.X(xmax))}" y1="${f(a.Y(c + b * pre[0].x))}" y2="${f(a.Y(c + b * xmax))}"/>`;
    }
    for (const g of p.groups) body += `<circle class="dot ${g.isPost ? "c1" : "c0"}" cx="${f(a.X(g.x))}" cy="${f(a.Y(g.rate))}" r="3"/>`;
  });
  body += note(16, H - 22, ["Blue: before ChatGPT. Gold: 2024 onward. Dashed: 2015 to Nov 2022 trend carried forward.", "Source: ScriptGrain SGR-019."]);
  return svg(W, H, "Is the rate above the pre-ChatGPT trend?", "Em dashes per 1,000 words; the test compares 2024 onward with the dashed line", body);
}
