// SGR-023: small statistics helpers (brand-weighted summaries, cluster bootstrap). Same method as
// scripts/experiments/brand-series/analyse.mjs: brands are resampled within sectors.
export const mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN; };
export const round = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
export function quantile(a, p) { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
export const median = (a) => quantile(a, 0.5);
export function hash01(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
export function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Bootstrap of stat(brandList) -> number, resampling brands within sectors. sectorOf: brand -> sector. */
export function bootstrap(brands, stat, { sectorOf, B, seed }) {
  const point = stat(brands);
  const sectors = [...new Set(brands.map((b) => sectorOf[b]))].sort();
  const groups = sectors.map((s) => brands.filter((b) => sectorOf[b] === s));
  const rnd = rng(seed), draws = [];
  for (let i = 0; i < B; i++) { const pick = []; for (const g of groups) for (let k = 0; k < g.length; k++) pick.push(g[Math.floor(rnd() * g.length)]); const v = stat(pick); if (Number.isFinite(v)) draws.push(v); }
  const ok = brands.length >= 3 && draws.length >= 100;
  return { point: round(point), lo: ok ? round(quantile(draws, 0.025)) : null, hi: ok ? round(quantile(draws, 0.975)) : null, lo90: ok ? round(quantile(draws, 0.05)) : null, hi90: ok ? round(quantile(draws, 0.95)) : null, n: brands.length };
}
export const verdict = (r, dir) => (r.lo == null ? "not testable" : dir === "positive" ? (r.lo > 0 ? "supported" : r.hi < 0 ? "reversed" : "not supported") : (r.hi < 0 ? "supported" : r.lo > 0 ? "reversed" : "not supported"));
export function pearson(x, y) { const n = x.length; const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); }
