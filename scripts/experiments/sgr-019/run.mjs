#!/usr/bin/env bun
// SGR-019: Has the em dash really taken over? The full measurement and analysis, as frozen in
// docs/research/sgr-019-preregistration.md. Deterministic: same inputs, same outputs.
//   bun scripts/experiments/sgr-019/run.mjs              full run (D-1)
//   bun scripts/experiments/sgr-019/run.mjs --pilot      <= 5% of the data, outputs to a scratch folder
// Writes public/research/sgr-019-*.{json,csv,svg}. Numbers only; no text leaves this script.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { gunzipSync, createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { countTyped, countGutenberg, countArxiv, gutenbergBody } from "./dash.mjs";
import { parseCsv, Panel, rate, range, trendStat, sumOver, hash01, wilson, r3, ci, rng } from "./lib.mjs";
import { mdToPlain } from "../brand-series/measure.mjs";
import { bestDate } from "../brand-corpus/dates.mjs";

const args = process.argv.slice(2);
const PILOT = args.includes("--pilot");
const HOME = process.env.HOME;
const R = process.env.SGR019_DIR ?? `${HOME}/research/sgr-019`;
const ARXIV = process.env.SGR019_ARXIV ?? `${HOME}/research/sgr-008`;
const OUT = PILOT ? `${R}/pilot-out` : (process.env.SGR019_OUT ?? "public/research");
mkdirSync(OUT, { recursive: true });
const here = new URL(".", import.meta.url).pathname;
const B = PILOT ? 200 : 1000;
const SEED = 20261013;
const inPilot = (key) => !PILOT || hash01(String(key)) < 0.04;
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);
const t0 = Date.now();

// ---- time axes -----------------------------------------------------------------------------
const MONTH0 = 2015;                       // month index 0 = January 2015
const T_M = (2026 - MONTH0 + 1) * 12;      // through December 2026
const mIdx = (y, m) => (y - MONTH0) * 12 + (m - 1);
const LAUNCH = mIdx(2022, 12);             // first month after ChatGPT's launch (30 Nov 2022)
const PRE = range(0, LAUNCH - 1);          // 2015-01 .. 2022-11
const EARLY = range(0, mIdx(2018, 12));    // 2015-2018
const LATE = range(mIdx(2019, 1), LAUNCH - 1);
const POST = range(mIdx(2024, 1), T_M - 1);
const yearMonths = (y) => range(mIdx(y, 1), mIdx(y, 12));
const YEARS_M = range(2015, 2026);
const dateToT = (date) => { // "YYYY" | "YYYY-MM" | "YYYY-MM-DD" -> month index (year-only -> July) or null
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(date ?? ""); if (!m) return null;
  const y = +m[1], mo = m[2] ? +m[2] : 7; if (y < MONTH0 || y > 2026 || mo < 1 || mo > 12) return null; return mIdx(y, mo);
};

const exclusions = {};
const bump = (corpus, k, n = 1) => { ((exclusions[corpus] ??= {})[k] = (exclusions[corpus][k] ?? 0) + n); };

// ---- 1. arXiv abstracts ---------------------------------------------------------------------
async function loadArxiv() {
  log("arXiv: reading inclusion table");
  const meta = new Map();
  // Streamed: the file is 550 MB compressed and gunzipSync of it needs ~8 GB.
  const rl = createInterface({ input: createReadStream(`${ARXIV}/census-papers.jsonl.gz`).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l) continue;
    const p = JSON.parse(l);
    if (p.ym < "2015-01" || p.ym > "2026-12") { bump("arxiv", "outside_2015_2026"); continue; }
    if (p.ym <= "2022-11" && !p.base_ok) { bump("arxiv", "revised_after_nov_2022"); continue; }
    meta.set(p.id, [p.ym, p.cat, p.group]);
  }
  log(`arXiv: ${meta.size} included ids`);
  const parts = readdirSync(`${ARXIV}/census`).filter((f) => f.endsWith(".jsonl.gz")).sort();
  const cells = [], groupOf = {}, monthly = new Map();
  const cellMap = new Map();
  let seen = 0, used = 0;
  for (const [pi, f] of parts.entries()) {
    if (PILOT && pi % 40 !== 0) continue;
    for (const l of gunzipSync(readFileSync(`${ARXIV}/census/${f}`)).toString("utf8").split("\n")) {
      if (!l) continue;
      seen++;
      const j = JSON.parse(l), m = meta.get(j.id);
      if (!m) continue;
      const { d, ds, w } = countArxiv(j.abstract ?? "");
      if (w < 30) { bump("arxiv", "under_30_words"); continue; }
      used++;
      const t = mIdx(+m[0].slice(0, 4), +m[0].slice(5, 7));
      groupOf[m[1]] = m[2];
      const k = `${m[1]}|${t}`; let c = cellMap.get(k);
      if (!c) cellMap.set(k, (c = { cluster: m[1], t, d: 0, ds: 0, w: 0, n: 0, nd: 0 }));
      c.d += d; c.ds += ds; c.w += w; c.n++; if (d > 0) c.nd++;
      const mk = `${m[0]}|${m[2]}`; const mm = monthly.get(mk) ?? monthly.set(mk, { ym: m[0], group: m[2], docs: 0, words: 0, dashes: 0 }).get(mk);
      mm.docs++; mm.words += w; mm.dashes += d;
    }
    if (pi % 300 === 0) log(`arXiv: part ${pi}/${parts.length}`);
  }
  log(`arXiv: ${used} abstracts measured (${seen} records scanned)`);
  return { panel: new Panel([...cellMap.values()], T_M, "arxiv"), groupOf, monthly: [...monthly.values()].sort((a, b) => (a.ym + a.group).localeCompare(b.ym + b.group)), cells: [...cellMap.values()] };
}

// ---- 2. Brand deep corpus v1.4 --------------------------------------------------------------
const PRIMARY_DATE = new Set(["meta", "jsonld", "url", "captured"]);
function eraOf(date) { if (!date) return null; if (date < "2015") return "PRE2015"; if (date < "2019") return "EARLY"; if (date < "2022-12") return "LATE"; if (date < "2024") return "TRANSITION"; return "AFTER"; }
function loadBrand() {
  const { brands } = JSON.parse(readFileSync(here + "../brand-corpus/brands.json", "utf8"));
  const cells = [], pages = [], sectorOf = {}, catOf = {};
  const sel = brands.filter((b, i) => !PILOT || i % 25 === 3);
  for (const b of sel) {
    const file = `${R}/brand/${b.domain}.jsonl.gz`;
    if (!existsSync(file)) { bump("brand", "no_file"); continue; }
    const rows = gunzipSync(readFileSync(file)).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    rows.sort((x, y) => (bestDate(x).date ?? "9999").localeCompare(bestDate(y).date ?? "9999"));
    const seen = new Set();
    sectorOf[b.domain] = b.sector;
    for (const r of rows) {
      if (r.category === "info_pack") { bump("brand", "info_pack_excluded"); continue; }
      const text = mdToPlain(r.markdown ?? "");
      const words0 = (text.match(/\S+/g) ?? []).length;
      if (words0 < 150) { bump("brand", "under_150_words"); continue; }
      const h = text.length + ":" + text.slice(0, 200) + text.slice(-200);
      if (seen.has(h)) { bump("brand", "duplicate_text"); continue; }
      seen.add(h);
      const shortWords = text.split("\n").filter((l) => l.trim() && (l.match(/\S+/g) ?? []).length <= 6).reduce((a, l) => a + (l.match(/\S+/g) ?? []).length, 0);
      if (shortWords / words0 > 0.4) { bump("brand", "list_like"); continue; }
      const { date, source: dsrc } = bestDate(r);
      const { d, ds, w } = countTyped(text);
      pages.push({ url: r.url, brand: b.domain, sector: b.sector, category: r.category, source: r.source ?? "live", date: date ?? "", date_source: dsrc ?? "", era: eraOf(date) ?? "UNDATED", words: w, dashes: d, dashes_strict: ds });
      const t = PRIMARY_DATE.has(dsrc) ? dateToT(date) : null;
      if (t == null) { bump("brand", date ? "date_not_primary_or_before_2015" : "undated"); continue; }
      cells.push({ cluster: b.domain, t, d, ds, w, n: 1, nd: d > 0 ? 1 : 0 });
      catOf[b.domain] = 1;
    }
  }
  log(`brand: ${pages.length} pages kept, ${cells.length} in time analysis`);
  return { panel: new Panel(cells, T_M, "brand"), pages, sectorOf, cells };
}

// ---- 3. SGR-004 homepages (published rows; text no longer held) -------------------------------
function loadHomepages() {
  const rows = JSON.parse(readFileSync(here + "../../../public/research/sgr-004-web-copy-rows.json", "utf8")).filter((r) => r.status === "measured" && inPilot(r.domain));
  const cells = rows.map((r) => ({ cluster: r.domain, t: r.year - 2000, d: (r.em_only_per1000 * r.words) / 1000, ds: (r.em_only_per1000 * r.words) / 1000, w: r.words, n: 1, nd: r.em_only_per1000 > 0 ? 1 : 0 }));
  const sectorOf = Object.fromEntries(rows.map((r) => [r.domain, r.sector]));
  log(`homepages: ${rows.length} measured rows`);
  return { panel: new Panel(cells, 27, "homepages"), sectorOf, cells };
}

// ---- 4. Gutenberg ---------------------------------------------------------------------------
const NONFIC = new Set(["biography", "essays", "history", "letters", "philosophy_religion", "science", "travel"]);
const bandOf = (year, era) => (year != null ? (year < 1800 ? "1700s" : year < 1900 ? "1800s" : "early 1900s") : era);
function loadGutenberg() {
  const { books } = JSON.parse(readFileSync(here + "books.json", "utf8"));
  const out = [];
  for (const b of books) {
    if (!inPilot(b.id)) continue;
    const f = `${R}/gutenberg/${b.id}.txt.gz`;
    if (!existsSync(f)) { bump("gutenberg", "not_downloaded"); continue; }
    const raw = gunzipSync(readFileSync(f)).toString("utf8");
    if (!raw) { bump("gutenberg", "empty_file"); continue; }
    const { d, ds, w } = countGutenberg(gutenbergBody(raw));
    if (w < 5000) { bump("gutenberg", "under_5000_words"); continue; }
    const genre = b.also6?.genre ?? b.genre;
    out.push({ id: b.id, panel: b.panel, author: b.author, cluster: b.cluster, year: b.year, band: bandOf(b.year, b.era ?? b.also6?.era), genre, nonfiction: NONFIC.has(genre), words: w, dashes: d, dashes_strict: ds });
  }
  log(`gutenberg: ${out.length} books measured`);
  return out;
}

// ---- 5. Web 2021 (SGR-007 published rows) ---------------------------------------------------
function loadWeb2021() {
  const rows = parseCsv(readFileSync(here + "../../../public/research/sgr-007-pages.csv", "utf8"));
  const cells = [];
  for (const r of rows) {
    if (r.status !== "measured" || r.source === "arxiv.org" || r.source === "gutenberg" || r.group === "homepages" || r.group === "arxiv" || r.group.startsWith("gutenberg")) continue;
    const w = +r.words, e = +r.em_dash_per1000; if (!(w > 0) || !inPilot(r.url)) continue;
    cells.push({ cluster: `${r.group}|${r.source}`, group: r.group, t: 0, d: (e * w) / 1000, ds: (e * w) / 1000, w, n: 1, nd: e > 0 ? 1 : 0 });
  }
  log(`web2021: ${cells.length} pages`);
  return cells;
}

// ---- analysis helpers -------------------------------------------------------------------------
let seedN = 0;
const nextSeed = () => SEED + 7919 * ++seedN;
const A = (p, f) => p.boot(f, B, nextSeed());
function yearly(panel, years, tOfYear, corpus) {
  const res = A(panel, (s) => { const o = {}; for (const y of years) { const ts = tOfYear(y); o[`r${y}`] = rate(s, ts); o[`s${y}`] = rate(s, ts, "DS"); } return o; });
  const s0 = panel.sums(null);
  return years.map((y) => { const ts = tOfYear(y); return { corpus, year: y, docs: sumOver(s0, "N", ts), words: sumOver(s0, "W", ts), dashes: Math.round(sumOver(s0, "D", ts)), per1000: r3(res.point[`r${y}`]), lo: r3(res.lo?.[`r${y}`]), hi: r3(res.hi?.[`r${y}`]), strict_per1000: r3(res.point[`s${y}`]), share_docs_with_dash: sumOver(s0, "N", ts) ? r3(sumOver(s0, "ND", ts) / sumOver(s0, "N", ts)) : null }; }).filter((r) => r.docs > 0);
}
const sub = (cells, pred) => cells.filter(pred);
const rd = (x) => (x == null ? null : { obs: r3(x.obs), proj: r3(x.proj), diff: r3(x.diff), ratio: r3(x.ratio) });
function trendTest(panel, pre, post, per) {
  const res = A(panel, (s) => trendStat(s, pre, post, per));
  const lo = res.lo, hi = res.hi, p = res.point;
  if (!p) return { result: "not testable", reason: "too few periods or no post data" };
  const result = lo?.diff == null ? "no interval" : lo.diff > 0 ? "supported" : hi.diff < 0 ? "reversed" : "not supported";
  return { result, obs: r3(p.obs), proj: r3(p.proj), diff: r3(p.diff), diff_lo: r3(lo?.diff), diff_hi: r3(hi?.diff), ratio: r3(p.ratio), ratio_lo: r3(lo?.ratio), ratio_hi: r3(hi?.ratio), clusters: panel.C, post_words: Math.round(sumOver(panel.sums(null), "W", post)) };
}
function ratioTest(pa, tsA, pb, tsB, key = "D") {
  const ra = rng(nextSeed()), rb = rng(nextSeed());
  const draw = (p, r) => { const m = new Int32Array(p.C); for (let i = 0; i < p.C; i++) m[Math.floor(r() * p.C)]++; return m; };
  const point = rate(pa.sums(null), tsA, key) / rate(pb.sums(null), tsB, key);
  const ds = [];
  if (pa.C >= 3 && pb.C >= 3) for (let b = 0; b < B; b++) ds.push(rate(pa.sums(draw(pa, ra)), tsA, key) / rate(pb.sums(draw(pb, rb)), tsB, key));
  return { ratio: r3(point), lo: r3(ci(ds).lo), hi: r3(ci(ds).hi), a: r3(rate(pa.sums(null), tsA, key)), b: r3(rate(pb.sums(null), tsB, key)) };
}
const level = (panel, ts) => { const r = A(panel, (s) => rate(s, ts)); return { per1000: r3(r.point), lo: r3(r.lo), hi: r3(r.hi), words: Math.round(sumOver(panel.sums(null), "W", ts)), docs: Math.round(sumOver(panel.sums(null), "N", ts)), clusters: panel.C }; };

// ---- run ------------------------------------------------------------------------------------
const arx = await loadArxiv();
const brand = loadBrand();
const home = loadHomepages();
const gut = loadGutenberg();
const web = loadWeb2021();
log(`loaded in ${Math.round((Date.now() - t0) / 1000)} s`);

// Gutenberg panels: decades of publication year (SGR-005 books) and century bands (all books).
const gDecade = new Panel(gut.filter((b) => b.year != null).map((b) => ({ cluster: b.cluster, t: Math.max(0, Math.floor(b.year / 10) - 178), d: b.dashes, ds: b.dashes_strict, w: b.words, n: 1, nd: 0 })), 20, "gut-decades");
const BANDS = ["1700s", "1800s", "early 1900s"];
const gBand = (pred) => new Panel(gut.filter(pred).filter((b) => BANDS.includes(b.band)).map((b) => ({ cluster: b.cluster, t: BANDS.indexOf(b.band), d: b.dashes, ds: b.dashes_strict, w: b.words, n: 1, nd: 0 })), 3, "gut-bands");
const gAll = gBand(() => true);
const g1800 = (pred) => new Panel(gut.filter((b) => b.band === "1800s" && pred(b)).map((b) => ({ cluster: b.cluster, t: 0, d: b.dashes, ds: b.dashes_strict, w: b.words, n: 1, nd: 0 })), 1);
const gNonFic1800 = g1800((b) => b.nonfiction && b.panel === "SGR-006");
const gSci1800 = g1800((b) => b.genre === "science" && b.panel === "SGR-006");
const gFic1800 = g1800((b) => !b.nonfiction || b.panel === "SGR-005");
const gAll1800 = g1800(() => true);

const summary = { study: "SGR-019", pilot: PILOT, generated: new Date().toISOString(), seed: SEED, bootstrap_resamples: B };
const cnt = (p) => ({ clusters: p.C, docs: Math.round(sumOver(p.sums(null), "N", range(0, p.T - 1))), words: Math.round(sumOver(p.sums(null), "W", range(0, p.T - 1))) });
summary.corpora = {
  arxiv: { ...cnt(arx.panel), by_year: undefined }, brand: { ...cnt(brand.panel), pages_kept_all_dates: brand.pages.length, brands: new Set(brand.pages.map((p) => p.brand)).size },
  homepages: cnt(home.panel), gutenberg: { books: gut.length, words: gut.reduce((a, b) => a + b.words, 0), sgr005: gut.filter((b) => b.panel === "SGR-005").length, sgr006_only: gut.filter((b) => b.panel === "SGR-006").length },
  web2021: { pages: web.length, words: Math.round(web.reduce((a, c) => a + c.w, 0)) },
};
delete summary.corpora.arxiv.by_year;
summary.exclusions = exclusions;

log("yearly series");
const SER = [];
SER.push(...yearly(arx.panel, YEARS_M, yearMonths, "arxiv"));
SER.push(...yearly(brand.panel, YEARS_M, yearMonths, "brand"));
SER.push(...yearly(home.panel, range(2000, 2026), (y) => [y - 2000], "homepages"));
const decades = range(180, 197).map((x) => x * 10);
const gdSeries = A(gDecade, (s) => { const o = {}; decades.forEach((d, i) => { o[`r${d}`] = rate(s, [i + 2]); o[`s${d}`] = rate(s, [i + 2], "DS"); }); return o; });
const gd0 = gDecade.sums(null);
for (const [i, d] of decades.entries()) { const ts = [i + 2]; if (!sumOver(gd0, "N", ts)) continue; SER.push({ corpus: "gutenberg_decades", year: d, docs: sumOver(gd0, "N", ts), words: sumOver(gd0, "W", ts), dashes: Math.round(sumOver(gd0, "D", ts)), per1000: r3(gdSeries.point[`r${d}`]), lo: r3(gdSeries.lo?.[`r${d}`]), hi: r3(gdSeries.hi?.[`r${d}`]), strict_per1000: r3(gdSeries.point[`s${d}`]), share_docs_with_dash: null }); }
summary.series_by_year = SER;

const bandRows = BANDS.map((b, i) => { const r = A(gAll, (s) => rate(s, [i])); const rs = A(gAll, (s) => rate(s, [i], "DS")); const s0 = gAll.sums(null); return { band: b, books: sumOver(s0, "N", [i]), words: sumOver(s0, "W", [i]), per1000: r3(r.point), lo: r3(r.lo), hi: r3(r.hi), strict_per1000: r3(rs.point) }; });
summary.gutenberg_bands = bandRows;

log("hypotheses");
const H = {};
H.H1 = { corpus: "brand", ...trendTest(brand.panel, PRE, POST, 3) };
H.H2 = { corpus: "arxiv", ...trendTest(arx.panel, PRE, POST, 3) };
H.H3 = { corpus: "homepages", ...trendTest(home.panel, range(15, 22), range(24, 26), 1) };
// H4: level against 19th-century Gutenberg
const brandNow = POST, arxNow = POST;
const mk4 = (name, r, lowerIsExpected = true) => ({ ...r, result: r.lo == null ? "no interval" : r.hi < 1 ? "supported" : r.lo > 1 ? "reversed" : "not supported", name });
H.H4a = mk4("brand 2024-26 vs 19th-century non-fiction books", ratioTest(brand.panel, brandNow, gNonFic1800, [0]));
H.H4b = mk4("arXiv 2024-26 vs 19th-century science books", ratioTest(arx.panel, arxNow, gSci1800, [0]));
// H5: already rising before
{
  const r = A(brand.panel, (s) => rate(s, LATE) / rate(s, EARLY));
  H.H5 = { corpus: "brand", early: r3(rate(brand.panel.sums(null), EARLY)), late: r3(rate(brand.panel.sums(null), LATE)), ratio: r3(r.point), lo: r3(r.lo), hi: r3(r.hi), result: r.lo == null ? "no interval" : r.lo > 1 ? "supported" : r.hi < 1 ? "reversed" : "not supported" };
}
// H6: breadth across brands
{
  const P = brand.panel, nOf = (c, ts) => ts.reduce((a, t) => a + P.N[c * P.T + t], 0);
  const L = P.clusterRates(LATE), Af = P.clusterRates(POST);
  let n = 0, up = 0;
  for (let c = 0; c < P.C; c++) if (nOf(c, LATE) >= 5 && nOf(c, POST) >= 5 && L[c].rate != null && Af[c].rate != null) { n++; if (Af[c].rate > L[c].rate) up++; }
  const w = wilson(up, n);
  H.H6 = { corpus: "brand", brands: n, higher: up, share: n ? r3(up / n) : null, lo: r3(w.lo), hi: r3(w.hi), result: !n ? "not testable" : up / n >= 0.6 && w.lo > 0.5 ? "supported" : up / n <= 0.4 && w.hi < 0.5 ? "reversed" : "not supported" };
}
summary.hypotheses = H;

log("levels and exploratory");
const E = {};
E.levels = {
  brand_late: level(brand.panel, LATE), brand_after: level(brand.panel, POST), brand_early: level(brand.panel, EARLY),
  arxiv_late: level(arx.panel, LATE), arxiv_after: level(arx.panel, POST), arxiv_early: level(arx.panel, EARLY),
  gutenberg_1800s_all: level(gAll1800, [0]), gutenberg_1800s_nonfiction: level(gNonFic1800, [0]), gutenberg_1800s_science: level(gSci1800, [0]), gutenberg_1800s_fiction_literary: level(gFic1800, [0]),
};
E.change = {
  brand_after_vs_late: ratioTest(brand.panel, POST, brand.panel, LATE), arxiv_after_vs_late: ratioTest(arx.panel, POST, arx.panel, LATE),
  brand_after_vs_gutenberg_1800s_fiction: ratioTest(brand.panel, POST, gFic1800, [0]), brand_after_vs_gutenberg_1800s_all: ratioTest(brand.panel, POST, gAll1800, [0]),
};
E.rank_of_today_among_gutenberg_books = (() => { const now = rate(brand.panel.sums(null), POST); const rs = gut.map((b) => (b.dashes / b.words) * 1000); return { brand_after_per1000: r3(now), books_below: rs.filter((x) => x < now).length, books: rs.length }; })();
// by arXiv group, brand sector, gutenberg genre
const byGroup = (cells, label, groupOf, minClusters) => {
  const groups = [...new Set(Object.values(groupOf))].sort(); const out = [];
  for (const g of groups) { const p = new Panel(cells.filter((c) => groupOf[c.cluster] === g), T_M); if (p.C < minClusters) continue; const s = p.sums(null); out.push({ group: g, clusters: p.C, docs: sumOver(s, "N", range(0, T_M - 1)), late: level(p, LATE).per1000, after: level(p, POST), early: r3(rate(s, EARLY)), trend: trendTest(p, PRE, POST, 3) }); }
  return out;
};
E.arxiv_by_group = byGroup(arx.cells, "arxiv", arx.groupOf, 3);
E.brand_by_sector = byGroup(brand.cells, "brand", brand.sectorOf, 3);
E.gutenberg_by_genre = [...new Set(gut.map((b) => b.genre))].sort().map((g) => { const p = new Panel(gut.filter((b) => b.genre === g && BANDS.includes(b.band)).map((b) => ({ cluster: b.cluster, t: BANDS.indexOf(b.band), d: b.dashes, ds: b.dashes_strict, w: b.words, n: 1, nd: 0 })), 3); const s = p.sums(null); return { genre: g, books: sumOver(s, "N", [0, 1, 2]), by_band: BANDS.map((b, i) => ({ band: b, books: sumOver(s, "N", [i]), per1000: sumOver(s, "W", [i]) ? r3(rate(s, [i])) : null })) }; });
E.gutenberg_convention = { note: "Strict rate counts U+2014 and spaced en dashes only; the primary rule adds plain-text '--' and '---'.", all_books_primary: r3(rate(gAll.sums(null), [0, 1, 2])), all_books_strict: r3(rate(gAll.sums(null), [0, 1, 2], "DS")) };
E.web2021 = (() => { const groups = [...new Set(web.map((c) => c.group))].sort(); const rows = groups.map((g) => { const p = new Panel(web.filter((c) => c.group === g), 1); const r = A(p, (s) => rate(s, [0])); return { group: g, pages: Math.round(sumOver(p.sums(null), "N", [0])), per1000: r3(r.point), lo: r3(r.lo), hi: r3(r.hi) }; }); const p = new Panel(web, 1); const r = A(p, (s) => rate(s, [0])); return { note: "Reused SGR-007 rows: U+2014 only (no spaced en dash). 2021 captures.", all: { per1000: r3(r.point), lo: r3(r.lo), hi: r3(r.hi), pages: web.length }, groups: rows }; })();
E.arxiv_ascii_only_note = "arXiv metadata is ASCII: its strict rate is zero by construction.";
summary.exploratory = E;

// ---- outputs ----------------------------------------------------------------------------------
const csv = (rows, cols) => cols.join(",") + "\n" + rows.map((r) => cols.map((c) => { const v = r[c] ?? ""; return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(",")).join("\n") + "\n";
writeFileSync(`${OUT}/sgr-019-by-year.csv`, csv(SER, ["corpus", "year", "docs", "words", "dashes", "per1000", "lo", "hi", "strict_per1000", "share_docs_with_dash"]));
writeFileSync(`${OUT}/sgr-019-books.csv`, csv(gut.map((b) => ({ ...b, per1000: r3((b.dashes / b.words) * 1000) })), ["id", "panel", "author", "year", "band", "genre", "words", "dashes", "dashes_strict", "per1000"]));
writeFileSync(`${OUT}/sgr-019-brand-pages.csv`, csv(brand.pages.map((p) => ({ ...p, per1000: r3((p.dashes / p.words) * 1000) })), ["url", "brand", "sector", "category", "source", "date", "date_source", "era", "words", "dashes", "dashes_strict", "per1000"]));
writeFileSync(`${OUT}/sgr-019-arxiv-monthly.csv`, csv(arx.monthly, ["ym", "group", "docs", "words", "dashes"]));

// charts
const { longRun, afterChat } = await import("./charts.mjs");
const seriesOf = (c) => SER.filter((r) => r.corpus === c);
writeFileSync(`${OUT}/sgr-019-long-run.svg`, longRun({ gutDecades: seriesOf("gutenberg_decades"), bands: bandRows, home: seriesOf("homepages"), brand: seriesOf("brand"), arxiv: seriesOf("arxiv") }));
const trendPanel = (panel, pre, post, per, ts, xOf) => { const s = panel.sums(null); return { groups: [...new Set(ts.map((t) => Math.floor(t / per)))].map((g) => { const tt = ts.filter((t) => Math.floor(t / per) === g); return { x: xOf(g), rate: sumOver(s, "W", tt) ? rate(s, tt) : null, isPost: tt.some((t) => post.includes(t)), isPre: tt.every((t) => pre.includes(t)) }; }).filter((g) => g.rate != null) }; };
writeFileSync(`${OUT}/sgr-019-after-chatgpt.svg`, afterChat([
  { title: "Brand writing (quarterly)", ...trendPanel(brand.panel, PRE, POST, 3, range(0, T_M - 1), (g) => MONTH0 + g / 4), test: H.H1 },
  { title: "arXiv abstracts (quarterly)", ...trendPanel(arx.panel, PRE, POST, 3, range(0, T_M - 1), (g) => MONTH0 + g / 4), test: H.H2 },
  { title: "Company homepages (yearly)", ...trendPanel(home.panel, range(15, 22), range(24, 26), 1, range(15, 26), (g) => 2000 + g), test: H.H3 },
]));
summary.runtime_seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${OUT}/sgr-019-summary.json`, JSON.stringify(summary, null, 1));
log(`done in ${summary.runtime_seconds} s -> ${OUT}`);
