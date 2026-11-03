// SGR-025 charts: static SVG line charts over the Index periods (years, then 2026-Q4), light and dark.
export function lineChart({ title, sub, periods, series, fmt = (v) => String(v), max = null }) {
  const W = 760, H = 380, L = 56, R = 120, T = 48, B = 44;
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  const raw = (max ?? Math.max(...all) * 1.08) || 1;
  const mag = 10 ** Math.floor(Math.log10(raw / 4));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st * 4 >= raw);
  const ticks = max != null ? 4 : Math.ceil(raw / step), yMax = max != null ? max : step * ticks;
  const n = periods.length;
  const x = (i) => L + (i / (n - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  let g = "";
  for (let i = 0; i <= ticks; i++) { const v = (yMax / ticks) * i; g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(Math.round(v * 100) / 100)}</text>`; }
  periods.forEach((p, i) => { if (i % 2 === 0 || i === n - 1) g += `<text class="ax" x="${x(i)}" y="${H - B + 20}" text-anchor="middle">${p}</text>`; });
  let s = "";
  series.forEach((sr, k) => {
    const pts = sr.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    s += `<path class="line s${k}" d="M${pts.map((p) => p.join(",")).join("L")}"/>`;
    sr.values.forEach((v, i) => { if (v != null) s += `<circle class="dot s${k}${i === n - 1 ? " q4" : ""}" cx="${x(i)}" cy="${y(v)}" r="${i === n - 1 ? 5 : 3}"/>`; });
    const last = sr.values.length - 1;
    if (sr.values[last] != null) s += `<text class="lbl" x="${x(last) + 10}" y="${y(sr.values[last]) + 4}">${sr.label} ${fmt(Math.round(sr.values[last] * 100) / 100)}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}">
<style>
text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px}
.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}
.ax{fill:#6b6862}.lbl{fill:#11100E;font-weight:600}
.grid{stroke:#11100E;stroke-opacity:.1}
.line{fill:none;stroke-width:2}.s0.line{stroke:#674BFF}.s1.line{stroke:#9D8420}
.s0.dot{fill:#674BFF;stroke:#F6F5F0;stroke-width:2}.s1.dot{fill:#9D8420;stroke:#F6F5F0;stroke-width:2}
@media (prefers-color-scheme:dark){.t,.lbl{fill:#F6F5F0}.ax{fill:#a8a49b}.grid{stroke:#F6F5F0}
.s0.line{stroke:#7A61FF}.s1.line{stroke:#C9A72C}.s0.dot{fill:#7A61FF;stroke:#141310}.s1.dot{fill:#C9A72C;stroke:#141310}}
</style>
<text class="t" x="${L}" y="22">${title}</text><text class="ax" x="${L}" y="38">${sub}</text>
${g}${s}</svg>\n`;
}
