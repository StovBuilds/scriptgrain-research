#!/usr/bin/env bun
// Sector reports (SGR-013 to SGR-018): pre-registration section 6. For banks, energy,
// telecoms, software, insurance and charities: the SGR-010 measures for the sector against
// all other sectors, press against blog inside the sector, the SGR-011 within-brand change
// inside the sector (exploratory, with intervals), a year series, and the words the sector
// uses more than every other sector (weighted log-odds on the page text). Numbers only.
//   bun scripts/experiments/brand-series/sectors.mjs [--boot 2000]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { mdToPlain } from "./measure.mjs";

const dir = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const B = Number(args.includes("--boot") ? args[args.indexOf("--boot") + 1] : 2000);
const SECTORS = ["bank", "energy", "telecom", "software", "insurance", "charity"];
const P = readFileSync(dir + "measures.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.category !== "info_pack");
const S12 = JSON.parse(readFileSync(dir + "summary-012.json", "utf8"));
const KEYS = ["avg_sentence_length", "you_share", "we_share", "contractions_per1000", "questions_per1000", "exclamations_per1000", "em_dash_per1000", "ai_ism_per1000", "marketing_per1000", "long_word_share", "sentence_variation", "words"];
const STRICT = new Set(["meta", "jsonld", "url", "captured"]);
const mean = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : NaN; };
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const r = (x, d = 3) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const byBrand = (rows) => { const m = new Map(); for (const x of rows) { if (!m.has(x.brand)) m.set(x.brand, []); m.get(x.brand).push(x); } return m; };
const brandMeans = (rows, k) => [...byBrand(rows).values()].map((xs) => mean(xs.map((x) => x[k])));
let seed = 0x5013;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function boot(brands, stat) { const pt = stat(brands), d = []; for (let i = 0; i < B; i++) { const pk = []; for (let k = 0; k < brands.length; k++) pk.push(brands[Math.floor(rnd() * brands.length)]); d.push(stat(pk)); } return { point: r(pt), lo: r(q(d, 0.025)), hi: r(q(d, 0.975)), n: brands.length }; }
const cat = (c) => (c === "blog" ? "blog" : "press");

// Words: weighted log-odds (Monroe et al. 2008) of each sector against all other sectors.
const FURNITURE = new Set("org uk www-dot cookie cookies preferences consent accept reject privacy policy ads advert adverts advertising website site web com www http https html article articles post posts comments comment reply share shares click read more menu login log sign skip content page pages link links blog newsletter subscribe email emails follow twitter facebook instagram linkedin youtube tiktok copyright rights reserved terms conditions javascript browser loading image images video videos photo photos credit min mins opens window tab optional relevant necessary analytics functional performance targeting show hide settings manage essential strictly third-party partners".split(" "));
const STOP = new Set("the a an and or but of to in on at for with by from as is are was were be been being it its this that these those we our us you your yours i my me they them their he she his her not no so if then than there here which who whom whose what when where why how all any each more most other some such only own same too very can will just should now also into about over after before up down out off again further once one two new get got make made may might must could would do does did have has had".split(" "));
const brandTokens = new Set();
const wc = Object.fromEntries([...new Set(P.map((x) => x.sector))].map((s) => [s, { m: new Map(), total: 0 }]));
// per sector, per word: how many uses each brand contributes (sector vocabulary must be shared,
// not one brand's name or product: "red" from British Red Cross, "sports" from Sky Sports)
const perBrand = Object.fromEntries(Object.keys(wc).map((s) => [s, new Map()]));
const brandsAll = [...new Set(P.map((x) => x.brand))];
for (const b of brandsAll) for (const t of b.split(".")[0].split("-").concat(b.split(".")[0].replace(/-/g, ""))) if (t.length >= 3) brandTokens.add(t);
for (const b of brandsAll) {
  const sector = P.find((x) => x.brand === b).sector;
  const urls = new Set(P.filter((x) => x.brand === b).map((x) => x.url));
  let rows = [];
  try { rows = gunzipSync(execFileSync("rclone", ["cat", `storagebox:research/scriptgrain-brand-corpus/v1/pages/${b}.jsonl.gz`], { maxBuffer: 1 << 30 })).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { continue; }
  const seen = new Set();
  for (const row of rows) {
    if (!urls.has(row.url) || seen.has(row.url)) continue; seen.add(row.url);
    for (const w of mdToPlain(row.markdown ?? "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (STOP.has(w) || FURNITURE.has(w)) continue;
      // a brand's own name is not sector vocabulary
      if (brandTokens.has(w) || [...brandTokens].some((t) => t.length >= 5 && (t.includes(w) && w.length >= 5))) continue;
      wc[sector].m.set(w, (wc[sector].m.get(w) ?? 0) + 1); wc[sector].total++;
      const pb = perBrand[sector]; if (!pb.has(w)) pb.set(w, new Map()); pb.get(w).set(b, (pb.get(w).get(b) ?? 0) + 1);
    }
  }
}
function sectorWords(s) {
  const me = wc[s], rest = { m: new Map(), total: 0 };
  for (const [k, v] of Object.entries(wc)) if (k !== s) { rest.total += v.total; for (const [w, c] of v.m) rest.m.set(w, (rest.m.get(w) ?? 0) + c); }
  const out = [];
  for (const [w, y1] of me.m) {
    if (y1 < 30) continue;
    const users = perBrand[s].get(w); const top = Math.max(...users.values());
    if (users.size < 3 || top / y1 > 0.5) continue;
    // sector vocabulary, not one brand's: at least 3 brands use it and no brand supplies more than half its uses
    const y2 = rest.m.get(w) ?? 0, a = 0.5;
    const d = Math.log((y1 + a) / (me.total - y1 + a)) - Math.log((y2 + a) / (rest.total - y2 + a));
    out.push({ word: w, z: r(d / Math.sqrt(1 / (y1 + a) + 1 / (y2 + a)), 2), sector_per10k: r((y1 / me.total) * 1e4, 2), others_per10k: r((y2 / rest.total) * 1e4, 2) });
  }
  return out.sort((x, y) => y.z - x.z).slice(0, 30);
}

const out = {};
for (const s of SECTORS) {
  const mine = P.filter((x) => x.sector === s), others = P.filter((x) => x.sector !== s);
  const brands = [...byBrand(mine).keys()];
  // habits vs all other sectors (brand-weighted), with the sector's brand range
  const habits = Object.fromEntries(KEYS.map((k) => { const bm = brandMeans(mine, k); return [k, { sector: r(mean(bm)), others: r(mean(brandMeans(others, k))), brand_p25: r(q(bm, 0.25)), brand_p75: r(q(bm, 0.75)), rank_of_10: null }]; }));
  // rank among all 10 sectors (1 = highest)
  for (const k of KEYS) { const all = [...new Set(P.map((x) => x.sector))].map((t) => [t, mean(brandMeans(P.filter((x) => x.sector === t), k))]).sort((a, b) => b[1] - a[1]); habits[k].rank_of_10 = all.findIndex(([t]) => t === s) + 1; }
  // press vs blog inside the sector (brands with >= 5 of each)
  const BB = byBrand(mine);
  const pvbBrands = [...BB].filter(([, xs]) => xs.filter((x) => cat(x.category) === "press").length >= 5 && xs.filter((x) => cat(x.category) === "blog").length >= 5).map(([b]) => b);
  const pvb = Object.fromEntries(["avg_sentence_length", "you_share", "contractions_per1000", "ai_ism_per1000"].map((k) => [k, pvbBrands.length >= 2 ? boot(pvbBrands, (bs) => mean(bs.map((b) => mean(BB.get(b).filter((x) => cat(x.category) === "press").map((x) => x[k])) - mean(BB.get(b).filter((x) => cat(x.category) === "blog").map((x) => x[k]))))) : null]));
  // before/after inside the sector: SGR-011 cells (>= 10 LATE and >= 10 AFTER in a channel)
  const cells = new Map();
  for (const x of mine) { if (!x.era || !(STRICT.has(x.date_source) || x.source === "wayback")) continue; const key = `${x.brand}|${cat(x.category)}`; if (!cells.has(key)) cells.set(key, { brand: x.brand, LATE: [], AFTER: [] }); const c = cells.get(key); if (x.era === "LATE") c.LATE.push(x); if (x.era === "AFTER") c.AFTER.push(x); }
  const elig = [...cells.values()].filter((c) => c.LATE.length >= 10 && c.AFTER.length >= 10);
  const eb = [...new Set(elig.map((c) => c.brand))];
  const change = (k) => (bs) => mean(bs.map((b) => mean(elig.filter((c) => c.brand === b).map((c) => mean(c.AFTER.map((x) => x[k])) - mean(c.LATE.map((x) => x[k]))))));
  const level = (k, era) => r(mean(eb.map((b) => mean(elig.filter((c) => c.brand === b).map((c) => mean(c[era].map((x) => x[k])))))));
  const beforeAfter = eb.length >= 2 ? Object.fromEntries(["ai_ism_per1000", "marketing_per1000", "em_dash_per1000", "ai_shape_per1000", "avg_sentence_length"].map((k) => [k, { ...boot(eb, change(k)), before: level(k, "LATE"), after: level(k, "AFTER") }])) : null;
  // year series (dated pages, strict dates), brand-weighted
  const years = {};
  for (let y = 2015; y <= 2026; y++) { const ys = mine.filter((x) => x.date && (STRICT.has(x.date_source) || x.source === "wayback") && +x.date.slice(0, 4) === y); const bb = byBrand(ys); if (ys.length) years[y] = { pages: ys.length, brands: bb.size, ai_ism_per1000: r(mean([...bb.values()].map((xs) => mean(xs.map((x) => x.ai_ism_per1000))))), avg_sentence_length: r(mean([...bb.values()].map((xs) => mean(xs.map((x) => x.avg_sentence_length))))), you_share: r(mean([...bb.values()].map((xs) => mean(xs.map((x) => x.you_share))))) }; }
  const allYears = {};
  for (let y = 2015; y <= 2026; y++) { const ys = P.filter((x) => x.date && (STRICT.has(x.date_source) || x.source === "wayback") && +x.date.slice(0, 4) === y); const bb = byBrand(ys); allYears[y] = r(mean([...bb.values()].map((xs) => mean(xs.map((x) => x.ai_ism_per1000))))); }
  out[s] = {
    sector: s, brands: brands.length, brandList: brands.sort(), pages: mine.length,
    counts: { blog: mine.filter((x) => x.category === "blog").length, press: mine.filter((x) => x.category !== "blog").length, archived: mine.filter((x) => x.source === "wayback").length },
    habits, pressVsBlog: { brands: pvbBrands.length, ...pvb }, beforeAfter: beforeAfter ? { brands: eb.length, cells: elig.length, ...beforeAfter } : { brands: eb.length },
    years, allYearsAi: allYears, sgr012: S12.bySector[s] ?? null, words: sectorWords(s),
  };
  console.log(s, "brands", brands.length, "pages", mine.length, "beforeAfter brands", eb.length, "words", out[s].words.slice(0, 10).map((w) => w.word).join(","));
}
writeFileSync(dir + "summary-sectors.json", JSON.stringify(out, null, 1));
