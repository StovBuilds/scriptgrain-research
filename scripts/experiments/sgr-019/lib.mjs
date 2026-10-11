// Shared helpers for SGR-019 (CSV parsing, seeded random, bootstrap).
export function parseCsv(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  const [h, ...rest] = out;
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** FNV-1a hash of a string to [0,1): deterministic pilot selection. */
export function hash01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

/**
 * Cluster-by-period table. cells: [{cluster, t, d, ds, w, n, nd}] (n docs, nd docs with a dash).
 * Resampling clusters with replacement gives B pooled series per period, so any statistic that
 * is a function of pooled-by-period sums gets an interval for free.
 */
export class Panel {
  constructor(cells, T, label = "") {
    this.label = label; this.T = T;
    const ids = [...new Set(cells.map((c) => c.cluster))].sort();
    this.ids = ids; this.C = ids.length;
    const ix = new Map(ids.map((k, i) => [k, i]));
    const mk = () => new Float64Array(ids.length * T);
    this.D = mk(); this.DS = mk(); this.W = mk(); this.N = mk(); this.ND = mk();
    for (const c of cells) {
      const k = ix.get(c.cluster) * T + c.t;
      this.D[k] += c.d; this.DS[k] += c.ds; this.W[k] += c.w; this.N[k] += c.n ?? 1; this.ND[k] += c.nd ?? 0;
    }
  }
  /** pooled sums by period for a multiplicity vector (null = the data as they are). */
  sums(mult) {
    const { T, C } = this, out = { D: new Float64Array(T), DS: new Float64Array(T), W: new Float64Array(T), N: new Float64Array(T), ND: new Float64Array(T) };
    for (let c = 0; c < C; c++) {
      const m = mult ? mult[c] : 1; if (!m) continue;
      const o = c * T;
      for (let t = 0; t < T; t++) { out.D[t] += m * this.D[o + t]; out.DS[t] += m * this.DS[o + t]; out.W[t] += m * this.W[o + t]; out.N[t] += m * this.N[o + t]; out.ND[t] += m * this.ND[o + t]; }
    }
    return out;
  }
  /** B bootstrap draws, seeded; stat(sums) -> number|object of numbers. Returns {point, lo, hi}. */
  boot(stat, B, seed) {
    const point = stat(this.sums(null));
    if (this.C < 3 || point == null) return { point, lo: null, hi: null };
    const r = rng(seed), draws = [];
    for (let b = 0; b < B; b++) {
      const mult = new Int32Array(this.C);
      for (let i = 0; i < this.C; i++) mult[Math.floor(r() * this.C)]++;
      draws.push(stat(this.sums(mult)));
    }
    if (point && typeof point === "object") {
      const lo = {}, hi = {};
      for (const k of Object.keys(point)) { const r2 = ci(draws.map((d) => (d ? d[k] : null))); lo[k] = r2.lo; hi[k] = r2.hi; }
      return { point, lo, hi };
    }
    return { point, ...ci(draws) };
  }
  clusterRates(ts) { // per-cluster pooled rate over a set of periods: [{id, d, w, rate}]
    const out = [];
    for (let c = 0; c < this.C; c++) { let d = 0, w = 0; for (const t of ts) { d += this.D[c * this.T + t]; w += this.W[c * this.T + t]; } out.push({ id: this.ids[c], d, w, rate: w ? (d / w) * 1000 : null }); }
    return out;
  }
}
export function ci(draws) {
  const ok = draws.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (ok.length < 20) return { lo: null, hi: null };
  return { lo: ok[Math.floor(0.025 * ok.length)], hi: ok[Math.min(ok.length - 1, Math.floor(0.975 * ok.length))] };
}
export const sumOver = (s, key, ts) => ts.reduce((a, t) => a + s[key][t], 0);
export const rate = (s, ts, key = "D") => { const w = sumOver(s, "W", ts); return w ? (sumOver(s, key, ts) / w) * 1000 : null; };
export const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/** Weighted least squares line through groups [{x, y, w}]; returns {a, b} (y = a + b x). */
export function wls(g) {
  const sw = g.reduce((s, p) => s + p.w, 0), mx = g.reduce((s, p) => s + p.w * p.x, 0) / sw, my = g.reduce((s, p) => s + p.w * p.y, 0) / sw;
  const sxx = g.reduce((s, p) => s + p.w * (p.x - mx) ** 2, 0), sxy = g.reduce((s, p) => s + p.w * (p.x - mx) * (p.y - my), 0);
  const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b };
}
/**
 * Trend-projection statistic. Pooled rate in groups of `per` periods over the pre window, a weighted
 * line fitted to those group rates, projected to the post window and averaged with the observed
 * post words as weights. Returns {obs, proj, diff, ratio}.
 */
export function trendStat(s, pre, post, per) {
  const grp = (ts) => { const m = new Map(); for (const t of ts) { const g = Math.floor(t / per); (m.get(g) ?? m.set(g, []).get(g)).push(t); } return [...m.entries()].map(([g, t]) => ({ x: g, ts: t })); };
  const pg = grp(pre).map((g) => ({ x: g.x, y: rate(s, g.ts), w: sumOver(s, "W", g.ts) })).filter((p) => p.y != null && p.w > 0);
  if (pg.length < 4) return null;
  const { a, b } = wls(pg);
  const qg = grp(post).map((g) => ({ x: g.x, w: sumOver(s, "W", g.ts) })).filter((p) => p.w > 0);
  const sw = qg.reduce((x, p) => x + p.w, 0);
  if (!sw) return null;
  const proj = qg.reduce((x, p) => x + p.w * (a + b * p.x), 0) / sw, obs = rate(s, post);
  return { obs, proj, diff: obs - proj, ratio: proj > 0 ? obs / proj : null, slope_per_group: b };
}
export const pick = (o, k) => (o == null ? null : o[k]);

/** Wilson 95% interval for a proportion. */
export function wilson(k, n) { if (!n) return { lo: null, hi: null }; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n); return { lo: (c - m) / d, hi: (c + m) / d }; }
export const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
