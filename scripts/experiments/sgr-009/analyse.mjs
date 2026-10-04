#!/usr/bin/env bun
// SGR-009 analysis: pre-registration sections 5-6. Reads pairs.csv + features.json,
// writes summary.json. CIs: 95% cluster bootstrap over brands, resampled within sectors
// (2,000 resamples). A pair's bootstrap weight is the product of its two brands' draw
// counts (its main brand's count for same-brand pairs).
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const B = Number(process.env.BOOT ?? 2000);
const pages = JSON.parse(readFileSync(dir + "features.json", "utf8"));
const [head, ...body] = readFileSync(dir + "pairs.csv", "utf8").trim().split("\n");
const cols = head.split(",");
const RUNCOLS = cols.slice(4);
const N = body.length;
const A = new Int32Array(N), Bq = new Int32Array(N), KIND = new Uint8Array(N), ST = new Uint8Array(N);
const RAW = Object.fromEntries(RUNCOLS.map((c) => [c, new Float64Array(N)]));
const KMAP = { SB: 0, SS: 1, XS: 2 };
body.forEach((l, i) => { const f = l.split(","); A[i] = +f[0]; Bq[i] = +f[1]; KIND[i] = KMAP[f[2]]; ST[i] = +f[3]; RUNCOLS.forEach((c, k) => (RAW[c][i] = +f[4 + k])); });

const brands = [...new Set(pages.map((p) => p.brand))];
const brandIdx = new Map(brands.map((b, i) => [b, i]));
const pb = Int32Array.from(pages, (p) => brandIdx.get(p.brand));
const sectorOfBrand = brands.map((b) => pages.find((p) => p.brand === b).sector);
const sectors = [...new Set(sectorOfBrand)];
const typeOf = pages.map((p) => p.type);
const sectorOfPage = pages.map((p) => p.sector);

// mulberry32, fixed seed so CIs are reproducible
let seed = 0x5009;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function drawBrands() {
  const w = new Float64Array(brands.length);
  for (const s of sectors) { const bs = brands.map((_, i) => i).filter((i) => sectorOfBrand[i] === s); for (let k = 0; k < bs.length; k++) w[bs[Math.floor(rnd() * bs.length)]]++; }
  return w;
}
const ONES = new Float64Array(brands.length).fill(1);
const pairW = (i, bw) => (KIND[i] === 0 ? bw[pb[A[i]]] : bw[pb[A[i]]] * bw[pb[Bq[i]]]);

/** Weighted AUC P(pos > neg) + 0.5 ties, over index lists. */
function auc(raw, pos, neg, bw) {
  const items = [];
  for (const i of pos) { const w = pairW(i, bw); if (w) items.push([raw[i], w, 1]); }
  for (const i of neg) { const w = pairW(i, bw); if (w) items.push([raw[i], w, 0]); }
  items.sort((x, y) => x[0] - y[0]);
  let negBelow = 0, num = 0, P = 0, Nn = 0;
  for (let k = 0; k < items.length;) {
    let j = k, tp = 0, tn = 0;
    while (j < items.length && items[j][0] === items[k][0]) { if (items[j][2]) tp += items[j][1]; else tn += items[j][1]; j++; }
    num += tp * (negBelow + tn / 2); negBelow += tn; P += tp; Nn += tn; k = j;
  }
  return P && Nn ? num / (P * Nn) : NaN;
}
function wmedian(raw, idx, bw) {
  const it = idx.map((i) => [raw[i], pairW(i, bw)]).filter((x) => x[1]).sort((a, b) => a[0] - b[0]);
  const tot = it.reduce((s, x) => s + x[1], 0); let c = 0;
  for (const [v, w] of it) { c += w; if (c >= tot / 2) return v; }
  return NaN;
}
const q = (xs, p) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const r3 = (x) => Math.round(x * 1000) / 1000;
const ci = (point, boots) => ({ point: r3(point), lo: r3(q(boots, 0.025)), hi: r3(q(boots, 0.975)) });

const idx = (pred) => { const o = []; for (let i = 0; i < N; i++) if (pred(i)) o.push(i); return o; };
const SB = idx((i) => KIND[i] === 0), SS = idx((i) => KIND[i] === 1), XS = idx((i) => KIND[i] === 2);
const SB_DT = SB.filter((i) => !ST[i]), SS_ST = SS.filter((i) => ST[i]);

function hypotheses(run, boot = true) {
  const raw = RAW[run];
  const stat = (bw) => ({
    h1: auc(raw, SB, SS, bw),
    h2: wmedian(raw, SS_ST, bw) - wmedian(raw, SB_DT, bw),
    h3: auc(raw, SS, XS, bw),
    sbx: auc(raw, SB, XS, bw),
  });
  const pt = stat(ONES);
  const out = { run };
  if (!boot) { for (const k of Object.keys(pt)) out[k] = { point: r3(pt[k]) }; return out; }
  const bs = { h1: [], h2: [], h3: [], sbx: [] };
  for (let b = 0; b < B; b++) { const s = stat(drawBrands()); for (const k of Object.keys(bs)) bs[k].push(s[k]); }
  for (const k of Object.keys(bs)) out[k] = ci(pt[k], bs[k]);
  out.medians = { SS_ST: r3(wmedian(raw, SS_ST, ONES)), SB_DT: r3(wmedian(raw, SB_DT, ONES)) };
  out.H1 = out.h1.point < 0.6 ? "supported" : "not supported";
  out.H2 = out.h2.lo > 0 ? "supported" : out.h2.hi < 0 ? "reversed" : "not supported";
  out.H3 = out.h3.lo > 0.5 ? "supported" : "not supported";
  return out;
}

// --- band shares (calibratePairwiseScore anchors, as in _shared/voice-check.ts)
const ANCH = [[0, 0.05], [0.3, 0.2], [0.45, 0.4], [0.56, 0.55], [0.72, 0.8], [0.85, 0.93], [1, 0.99]];
const cal = (r) => { if (r <= ANCH[0][0]) return ANCH[0][1]; for (let i = 1; i < ANCH.length; i++) { const [x1, y1] = ANCH[i - 1], [x2, y2] = ANCH[i]; if (r <= x2) return y1 + ((r - x1) / (x2 - x1)) * (y2 - y1); } return 0.99; };
function bands(raw, ix) {
  const c = { on: 0, drifting: 0, off: 0 };
  for (const i of ix) { const s = cal(raw[i]); c[s >= 0.8 ? "on" : s >= 0.55 ? "drifting" : "off"]++; }
  return { n: ix.length, p10: r3(q(ix.map((i) => raw[i]), 0.1)), p50: r3(q(ix.map((i) => raw[i]), 0.5)), p90: r3(q(ix.map((i) => raw[i]), 0.9)), on: r3(c.on / ix.length), drifting: r3(c.drifting / ix.length), off: r3(c.off / ix.length) };
}

const summary = { pages: pages.length, brands: brands.length, pairs: N, bootstrap: B, counts: { SB: SB.length, SS: SS.length, XS: XS.length, SB_DT: SB_DT.length, SS_ST: SS_ST.length } };
summary.byType = Object.fromEntries(["home", "about", "product", "pricing", "careers"].map((t) => [t, pages.filter((p) => p.type === t).length]));
summary.bySector = Object.fromEntries(sectors.map((s) => [s, { brands: sectorOfBrand.filter((x) => x === s).length, pages: pages.filter((p) => p.sector === s).length }]));
summary.confirmatory = hypotheses("J1a");
summary.robustness = RUNCOLS.filter((c) => c !== "J1a").map((c) => hypotheses(c, c.startsWith("J2") || c === "none"));
summary.bands = Object.fromEntries(RUNCOLS.map((c) => [c, { SB: bands(RAW[c], SB), SS: bands(RAW[c], SS), XS: bands(RAW[c], XS) }]));
// secondary: per sector, per page type (pairs where main page is that type and other page same type), long pages
const raw = RAW.J1a;
summary.perSector = Object.fromEntries(sectors.map((s) => [s, r3(auc(raw, SB.filter((i) => sectorOfPage[A[i]] === s), SS.filter((i) => sectorOfPage[A[i]] === s), ONES))]));
summary.perType = Object.fromEntries(["home", "about", "product", "pricing", "careers"].map((t) => [t, r3(auc(raw, SB.filter((i) => typeOf[A[i]] === t), SS.filter((i) => typeOf[A[i]] === t), ONES))]));
const long = (i) => pages[A[i]].words >= 600 && pages[Bq[i]].words >= 600;
summary.long600 = r3(auc(raw, SB.filter(long), SS.filter(long), ONES));
// type vs brand: median raw for the four cells
const cell = (k, st) => r3(wmedian(raw, idx((i) => KIND[i] === k && ST[i] === st), ONES));
summary.typeBrandGrid = { sameBrand_sameType: cell(0, 1), sameBrand_diffType: cell(0, 0), sameSector_sameType: cell(1, 1), sameSector_diffType: cell(1, 0), otherSector_sameType: cell(2, 1), otherSector_diffType: cell(2, 0) };
// same-type AUC: does page type separate pairs better than brand does?
summary.typeAUC = r3(auc(raw, idx((i) => ST[i] && KIND[i] !== 0), idx((i) => !ST[i] && KIND[i] !== 0), ONES));
// judge agreement
const JRUNS = RUNCOLS.filter((c) => c !== "none");
const agree = (r1, r2) => {
  let same = 0, tot = 0, num = 0, nd = 0;
  for (const p of pages) { const a = p.judged[r1], b = p.judged[r2]; if (!a || !b) continue;
    for (const k of Object.keys(a)) { if (!(k in b)) continue; tot++; if (JSON.stringify(a[k]) === JSON.stringify(b[k])) same++; if (typeof a[k] === "number" && typeof b[k] === "number") { num += Math.abs(a[k] - b[k]); nd++; } } }
  return { attrExactAgreement: r3(same / tot), meanAbsNumericDiff: r3(num / nd) };
};
const pairSpread = (r1, r2) => { const d = []; for (let i = 0; i < N; i += 7) d.push(Math.abs(RAW[r1][i] - RAW[r2][i])); return { medianAbs: r3(q(d, 0.5)), p95Abs: r3(q(d, 0.95)), max: r3(Math.max(...d)) }; };
summary.judgeAgreement = {};
for (let x = 0; x < JRUNS.length; x++) for (let y = x + 1; y < JRUNS.length; y++) summary.judgeAgreement[`${JRUNS[x]}~${JRUNS[y]}`] = { ...agree(JRUNS[x], JRUNS[y]), pairRaw: pairSpread(JRUNS[x], JRUNS[y]) };
summary.judgeNulls = Object.fromEntries(JRUNS.map((r) => [r, pages.filter((p) => !p.judged[r]).length]));

writeFileSync(dir + "summary.json", JSON.stringify(summary, null, 1));
const c = summary.confirmatory;
console.log(`pages ${summary.pages} brands ${summary.brands} pairs ${N}`);
console.log(`H1 AUC SB vs SS ${JSON.stringify(c.h1)} -> ${c.H1}`);
console.log(`H2 median SS-ST minus SB-DT ${JSON.stringify(c.h2)} (${c.medians.SS_ST} vs ${c.medians.SB_DT}) -> ${c.H2}`);
console.log(`H3 AUC SS vs XS ${JSON.stringify(c.h3)} -> ${c.H3}`);
for (const r of summary.robustness) console.log(`  ${r.run}: H1 ${r.h1.point} H2 ${r.h2.point} H3 ${r.h3.point} ${r.H1 ?? ""} ${r.H2 ?? ""} ${r.H3 ?? ""}`);
console.log("perSector", JSON.stringify(summary.perSector));
console.log("perType", JSON.stringify(summary.perType), "long600", summary.long600, "typeAUC", summary.typeAUC);
console.log("grid", JSON.stringify(summary.typeBrandGrid));
