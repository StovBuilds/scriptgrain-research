// Shared helpers for SGR-024: seeded random numbers, growable typed arrays, cluster tables with a
// cluster bootstrap, CSV output.

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A typed array that doubles when it fills; read the live part with .view(). */
export class Grow {
  constructor(Type, cap = 1 << 20) { this.Type = Type; this.a = new Type(cap); this.n = 0; }
  push(v) { if (this.n === this.a.length) { const b = new this.Type(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; }
  view() { return this.a.subarray(0, this.n); }
}

/**
 * Clusters x columns table of additive counts. bootMany() resamples whole clusters with replacement and
 * evaluates every statistic on the resampled column sums, so one set of draws serves all statistics.
 */
export class ClusterTable {
  constructor(C, K) { this.C = C; this.K = K; this.a = new Float64Array(C * K); }
  add(c, k, v = 1) { this.a[c * this.K + k] += v; }
  /** column sums over the clusters in `list` (default all), each with multiplicity 1 */
  sums(list = null) {
    const { K, a } = this, out = new Float64Array(K);
    if (!list) { for (let c = 0; c < this.C; c++) { const o = c * K; for (let k = 0; k < K; k++) out[k] += a[o + k]; } return out; }
    for (const c of list) { const o = c * K; for (let k = 0; k < K; k++) out[k] += a[o + k]; }
    return out;
  }
  /**
   * stats: { name: (sums) => number|null }. Returns { name: { point, lo, hi } } where lo/hi are the 2.5th and
   * 97.5th percentiles of B cluster-bootstrap draws (or the levels given in `levels`), restricted to the
   * clusters in `list` (default all clusters). Percentile index: floor(level * n) and ceil(level * n) - 1.
   */
  bootMany(stats, B, seed, list = null, levels = { lo: 0.025, hi: 0.975 }) {
    const names = Object.keys(stats), { K, a } = this;
    const L = list ?? Array.from({ length: this.C }, (_, i) => i), n = L.length;
    const point = this.sums(L), res = {}, draws = Object.fromEntries(names.map((k) => [k, []]));
    for (const k of names) res[k] = { point: stats[k](point), lo: null, hi: null };
    if (n >= 3) {
      const r = rng(seed), s = new Float64Array(K);
      for (let b = 0; b < B; b++) {
        s.fill(0);
        for (let i = 0; i < n; i++) { const o = L[Math.floor(r() * n)] * K; for (let k = 0; k < K; k++) s[k] += a[o + k]; }
        for (const k of names) draws[k].push(stats[k](s));
      }
      for (const k of names) {
        const ok = draws[k].filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
        if (ok.length >= 20) { res[k].lo = ok[Math.min(ok.length - 1, Math.floor(levels.lo * ok.length))]; res[k].hi = ok[Math.min(ok.length - 1, Math.ceil(levels.hi * ok.length) - 1)]; }
      }
    }
    return res;
  }
}

export const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
export const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
export const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000);
export const r6 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6);

export function csv(rows, cols) {
  const q = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n") + "\n";
}

/** Minimal CSV line parser for the reference files (handles quotes). */
export function parseCsvLine(line) {
  const out = []; let f = "", qd = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (qd) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else qd = false; } else f += c; }
    else if (c === '"') qd = true; else if (c === ",") { out.push(f); f = ""; } else f += c;
  }
  out.push(f);
  return out;
}
