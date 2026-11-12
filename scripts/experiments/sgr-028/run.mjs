#!/usr/bin/env node
// SGR-028 FULL RUN (pre-registration: docs/research/sgr-028-preregistration.md). Run once, on D-1.
//
//   node scripts/experiments/sgr-028/run.mjs                 # full run -> public/research/sgr-028-*
//   node scripts/experiments/sgr-028/run.mjs --pilot --out /tmp/x   # small plumbing test (4 UK + 3 US brands), never committed
//
// Streams each brand's file from the Storage Box (never stored locally), measures every dated page with
// measure.mjs (local code, no network, no model), and writes numbers only: a summary JSON, a brand CSV
// and one SVG. No third-party text is written anywhere.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { measurePage } from "./measure.mjs";
import { buildLookup } from "./terms.mjs";

const here = new URL(".", import.meta.url).pathname;
const RCLONE = process.env.RCLONE ?? `${process.env.HOME}/bin/rclone`;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PILOT = args.includes("--pilot");
const OUT = opt("--out", "public/research");
const B = +opt("--boot", PILOT ? 1000 : 10000);
const SEED = 20261112;
const UK_REMOTE = "storagebox:research/scriptgrain-brand-corpus/v1/pages";
const US_REMOTE = "storagebox:research/scriptgrain-brand-corpus-us/v1/pages";
const LOOK = buildLookup();

// ---------- pre-registered rules (section 2 and 4) ----------
export const DATED = new Set(["meta", "jsonld", "url", "text"]);
export function period(row) {
  const d = row.date_best, s = row.date_source;
  if (!d) return null;
  const year = d.length === 4;
  if (s === "captured") return d <= "2022-11" ? "before" : null;
  if (!DATED.has(s)) return null;
  if (year) return +d <= 2021 ? "before" : +d >= 2023 ? "after" : null;
  if (d <= "2022-11") return "before";
  if (d >= "2023-01") return row.source === "wayback" ? null : "after";
  return null;
}
const MIN_PAGES = { uk: 30, us: 10 };   // US control: 10+ dated pages each side (pre-registration section 2)
const MIN_TOKENS = 30;                 // variant-pair tokens each side, spelling measures
const MIN_OXFORD = 10;                 // Oxford-proof tokens each side, for the Oxford-proof share
const GUARD = 0.5;                     // house-style guard on the before-period American share (all pairs)
const US_SANITY = 0.98;

function parseCsv(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
  const [h, ...rest] = out; return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const rng = (seed) => { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const mean = (xs) => { const v = xs.filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const q = (sorted, p) => { if (!sorted.length) return null; const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); };
const r6 = (x) => (x == null ? null : Math.round(x * 1e6) / 1e6);

// ---------- Deviation 1 (2026-11-12, after the freeze): locale rule, both corpora ----------
// A page labelled for another market is dropped. See "Deviations" in the pre-registration. --frozen-corpus turns it off.
const FROZEN = args.includes("--frozen-corpus");
const HOME = { uk: ["gb", "uk"], us: ["us"] };
const AREAS = { uk: ["001", "150", "154"], us: ["001", "003", "019", "021"] };
const REGION_SECTIONS = new Set(["intl", "international", "emea", "apac", "ap", "latam", "lac", "lac-en", "eu", "europe"]);
export function foreignLocale(row, country) {
  const home = HOME[country];
  const tag = (row.language || "").split(",")[0].trim().toLowerCase().replace(/_/g, "-");
  const reg = tag.match(/^[a-z]{2,3}-([a-z]{2}|\d{3})(?:-|$)/)?.[1];
  if (reg && !home.includes(reg) && !AREAS[country].includes(reg)) return "language";
  let segs; try { segs = new URL(row.url).pathname.toLowerCase().split("/").filter(Boolean); } catch { return null; }
  const [a = "", b = ""] = segs;
  const loc = [a, b].map((x) => x.match(/^en[-_]([a-z]{2})$/)?.[1]).find(Boolean);
  if (loc) return home.includes(loc) ? null : "path";
  if (REGION_SECTIONS.has(a)) return "path";
  if (/^[a-z]{2}$/.test(a) && /^en(?:[-_][a-z]{2})?$/.test(b)) return home.includes(a) ? null : "path";
  if (country === "us" ? a === "uk" || a === "gb" : a === "us") return "path";
  return null;
}
const localeDropped = { uk: { pages: 0, language: 0, path: 0, brands: {} }, us: { pages: 0, language: 0, path: 0, brands: {} } };

function brandsOf(dir, country) {
  const rows = parseCsv(readFileSync(here + `../${dir}/manifest.csv`, "utf8"));
  const m = new Map();
  for (const r of rows) {
    if (!FROZEN) { const why = foreignLocale(r, country); if (why) { const L = localeDropped[country]; L.pages++; L[why]++; L.brands[r.domain] = (L.brands[r.domain] ?? 0) + 1; continue; } } if (!m.has(r.domain)) m.set(r.domain, { sector: r.sector, rows: [] }); m.get(r.domain).rows.push(r); }
  return m;
}
function readBrand(remote, domain) {
  const buf = execFileSync(RCLONE, ["cat", `${remote}/${domain}.jsonl.gz`], { maxBuffer: 1 << 30 });
  return gunzipSync(buf).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const blank = () => ({ pages: 0, words: 0, us: 0, uk: 0, usOther: 0, ukOther: 0, usIze: 0, ukIze: 0, phr: 0, phrases: {}, markers: {}, terms: {} });
function add(a, m) {
  a.pages++; a.words += m.words; for (const k of ["us", "uk", "usOther", "ukOther", "usIze", "ukIze"]) a[k] += m[k];
  for (const [k, v] of Object.entries(m.phrases)) { a.phrases[k] = (a.phrases[k] ?? 0) + v; a.phr += v; }
  for (const f of ["markers", "terms"]) for (const [k, v] of Object.entries(m[f])) a[f][k] = (a[f][k] ?? 0) + v;
}
const share = (u, k) => (u + k > 0 ? u / (u + k) : null);
const stats = (a) => ({
  pages: a.pages, words: a.words, variant_tokens: a.us + a.uk, oxford_tokens: a.usOther + a.ukOther, ize_tokens: a.usIze + a.ukIze,
  us_share: share(a.us, a.uk), us_share_oxford: share(a.usOther, a.ukOther), us_share_ize: share(a.usIze, a.ukIze),
  phrases_per_1000: a.words ? (1000 * a.phr) / a.words : null,
});

/** Measure one brand: accumulators for every period variant the analysis needs. */
function measureBrand(remote, domain, meta) {
  const metaBySha = new Map(meta.rows.map((r) => [r.sha256, r]));
  const acc = { before: blank(), after: blank(), before_live: blank(), after_2024: blank() };
  const seen = new Set();
  const label = domain.split(".")[0];
  for (const r of readBrand(remote, domain)) {
    const mr = metaBySha.get(r.sha256); if (!mr || seen.has(r.sha256)) continue; seen.add(r.sha256);
    const p = period(mr); if (!p) continue;
    const m = measurePage(r.markdown ?? "", label);
    add(acc[p], m);
    if (p === "before" && mr.source === "live") add(acc.before_live, m);
    if (p === "after" && mr.date_best >= "2024") add(acc.after_2024, m);
  }
  return acc;
}

// ---------- which brands ----------
const UK = brandsOf("brand-corpus", "uk"), US = brandsOf("brand-corpus-us", "us");
const count = (b) => { const n = { before: 0, after: 0 }; for (const r of b.rows) { const p = period(r); if (p) n[p]++; } return n; };
const pick = (M, min) => [...M].map(([d, b]) => ({ domain: d, sector: b.sector, ...count(b) })).filter((e) => e.before >= min && e.after >= min).sort((a, b) => (a.domain < b.domain ? -1 : 1));
let ukList = pick(UK, MIN_PAGES.uk), usList = pick(US, MIN_PAGES.us);
if (PILOT) { // deterministic small sample for plumbing tests
  const h = (l, n, tag) => [...l].sort((a, b) => hash01(tag + a.domain) - hash01(tag + b.domain)).slice(0, n);
  ukList = h(ukList, +opt("--uk", 4), "sgr028-pilot-uk"); usList = h(usList, +opt("--us", 3), "sgr028-pilot-us");
}
process.stderr.write(`UK brands with ${MIN_PAGES.uk}+ dated pages each side: ${ukList.length}; US: ${usList.length}${PILOT ? " (PILOT sample)" : ""}\n`);

const brands = {}; const accs = {};
for (const [country, list, remote, M] of [["uk", ukList, UK_REMOTE, UK], ["us", usList, US_REMOTE, US]]) {
  for (const e of list) {
    let acc; try { acc = measureBrand(remote, e.domain, M.get(e.domain)); } catch (err) { process.stderr.write(`${e.domain}: could not read (${String(err).slice(0, 80)})\n`); brands[e.domain] = { country, sector: e.sector, error: "unreadable" }; continue; }
    accs[e.domain] = acc;
    brands[e.domain] = { country, sector: e.sector, before: stats(acc.before), after: stats(acc.after), before_live: stats(acc.before_live), after_2024: stats(acc.after_2024) };
    process.stderr.write(`${country} ${e.domain}: ${acc.before.pages} before / ${acc.after.pages} after\n`);
  }
}

// ---------- eligibility per measure ----------
const ok = (b) => b && !b.error;
const guarded = Object.entries(brands).filter(([, b]) => ok(b) && b.country === "uk" && (b.before.us_share ?? 0) > GUARD).map(([d]) => d);
const MEASURES = {
  us_share: { tokens: (s) => s.variant_tokens >= MIN_TOKENS },
  us_share_oxford: { tokens: (s) => s.variant_tokens >= MIN_TOKENS && s.oxford_tokens >= MIN_OXFORD },
  us_share_ize: { tokens: (s) => s.variant_tokens >= MIN_TOKENS && s.ize_tokens >= MIN_OXFORD },
  phrases_per_1000: { tokens: () => true },
};
/** Within-brand changes for a measure, over a set of brands, with optional period keys. */
function changes(country, k, { from = "before", to = "after", filter = () => true } = {}) {
  const out = [];
  for (const [d, b] of Object.entries(brands)) {
    if (!ok(b) || b.country !== country || !filter(d, b)) continue;
    if (country === "uk" && guarded.includes(d)) continue;
    const s0 = b[from], s1 = b[to];
    if (!s0?.pages || !s1?.pages || !MEASURES[k].tokens(s0) || !MEASURES[k].tokens(s1)) continue;
    if (s0[k] == null || s1[k] == null) continue;
    out.push({ d, sector: b.sector, before: s0[k], after: s1[k], change: s1[k] - s0[k] });
  }
  return out;
}
function boot(xs, seed = SEED) {
  if (xs.length < 3) return { lo: null, hi: null };
  const rnd = rng(seed), draws = new Float64Array(B);
  for (let i = 0; i < B; i++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(rnd() * xs.length)]; draws[i] = s / xs.length; }
  const s = [...draws].sort((a, b) => a - b); return { lo: q(s, 0.025), hi: q(s, 0.975) };
}
function bootDiff(a, b) {
  if (a.length < 3 || b.length < 3) return { lo: null, hi: null };
  const ra = rng(SEED), rb = rng(SEED + 1), draws = new Float64Array(B);
  for (let i = 0; i < B; i++) { let sa = 0, sb = 0; for (let j = 0; j < a.length; j++) sa += a[Math.floor(ra() * a.length)]; for (let j = 0; j < b.length; j++) sb += b[Math.floor(rb() * b.length)]; draws[i] = sa / a.length - sb / b.length; }
  const s = [...draws].sort((x, y) => x - y); return { lo: q(s, 0.025), hi: q(s, 0.975) };
}
/** Wilcoxon signed-rank, two-sided, normal approximation with tie and zero (Pratt-dropped) handling. */
function wilcoxon(xs) {
  const v = xs.filter((x) => x !== 0); const n = v.length; if (n < 5) return { n, p: null };
  const r = v.map((x, i) => ({ a: Math.abs(x), s: Math.sign(x), i })).sort((p, q2) => p.a - q2.a);
  const ranks = new Array(n); let tie = 0;
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && r[j + 1].a === r[i].a) j++; const rk = (i + j + 2) / 2; for (let k = i; k <= j; k++) ranks[k] = rk; const t = j - i + 1; tie += t * t * t - t; i = j + 1; }
  let W = 0; for (let k = 0; k < n; k++) if (r[k].s > 0) W += ranks[k];
  const mu = (n * (n + 1)) / 4, sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tie / 48);
  const z = sd ? (W - mu) / sd : 0; const p = 2 * (1 - Phi(Math.abs(z)));
  return { n, W, z: r6(z), p: r6(p) };
}
function Phi(x) { const t = 1 / (1 + 0.2316419 * x), d = 0.3989423 * Math.exp((-x * x) / 2); return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); }
function summarise(rows) {
  const xs = rows.map((r) => r.change); const ci = boot(xs);
  return { n: rows.length, from_mean: r6(mean(rows.map((r) => r.before))), to_mean: r6(mean(rows.map((r) => r.after))), point: r6(mean(xs)), lo: r6(ci.lo), hi: r6(ci.hi), up: xs.filter((x) => x > 0).length, share_up: rows.length ? r6(xs.filter((x) => x > 0).length / rows.length) : null, wilcoxon: wilcoxon(xs) };
}
const test = (s, threshold) => ({ ...s, threshold, result: s.lo == null ? "not testable" : s.point >= threshold && s.lo > 0 && s.share_up >= 0.6 ? "supported" : "not supported" });


// ---------- pooled descriptive counts (numbers only) ----------
const pool = (country) => { const P = { before: blank(), after: blank() };
  for (const [d, acc] of Object.entries(accs)) { const b = brands[d]; if (b.country !== country || guarded.includes(d)) continue;
    for (const p of ["before", "after"]) { const a = acc[p], T = P[p]; T.pages += a.pages; T.words += a.words; for (const f of ["us", "uk", "usOther", "ukOther", "usIze", "ukIze", "phr"]) T[f] += a[f]; for (const f of ["phrases", "markers", "terms"]) for (const [t, v] of Object.entries(a[f])) T[f][t] = (T[f][t] ?? 0) + v; } }
  return P; };
const Puk = pool("uk"), Pus = pool("us");
// ---------- instrument sanity check (section 4): POOLED US variant tokens, both periods together ----------
const usAll = changes("us", "us_share");
const usLevel = { before: stats(Pus.before).us_share, after: stats(Pus.after).us_share, brand_mean_before: mean(usAll.map((r) => r.before)), brand_mean_after: mean(usAll.map((r) => r.after)) };
usLevel.pooled_both = share(Pus.before.us + Pus.after.us, Pus.before.uk + Pus.after.uk);
const instrumentOk = usAll.length > 0 && usLevel.pooled_both != null && usLevel.pooled_both >= US_SANITY;

// ---------- hypotheses (section 5) ----------
const ukOx = changes("uk", "us_share_oxford"), ukAll = changes("uk", "us_share"), ukPh = changes("uk", "phrases_per_1000");
const usOx = changes("us", "us_share_oxford"), usPh = changes("us", "phrases_per_1000");
const H1 = test(summarise(ukOx), 0.0025);
const H1b = test(summarise(ukAll), 0.005);
const H2 = test(summarise(ukPh), 0.10);
const diffPh = bootDiff(ukPh.map((r) => r.change), usPh.map((r) => r.change));
const diffOx = bootDiff(ukOx.map((r) => r.change), usOx.map((r) => r.change));
const H3 = { phrases: { uk: H2.point, us: r6(mean(usPh.map((r) => r.change))), n_uk: ukPh.length, n_us: usPh.length, point: r6(H2.point - mean(usPh.map((r) => r.change))), lo: r6(diffPh.lo), hi: r6(diffPh.hi) },
  spelling_oxford: { uk: H1.point, us: r6(mean(usOx.map((r) => r.change))), n_uk: ukOx.length, n_us: usOx.length, point: r6(H1.point - mean(usOx.map((r) => r.change))), lo: r6(diffOx.lo), hi: r6(diffOx.hi) } };
H3.phrases.result = H3.phrases.lo == null ? "not testable" : H3.phrases.lo > 0 ? "supported" : "not supported";
H3.spelling_oxford.result = H3.spelling_oxford.lo == null ? "not testable" : H3.spelling_oxford.lo > 0 ? "supported" : "not supported";
H3.result = H3.phrases.result;
const pass = (h) => h.result === "supported";
const wording = !instrumentOk ? "instrument check failed: no result reported"
  : pass(H1) && pass(H2) && pass(H3) ? "British brand writing moved towards American spelling and phrasing after November 2022, beyond US drift"
  : pass(H1) && pass(H2) && !pass(H3) ? "both countries drifted together; not Americanisation"
  : pass(H2) || H3.phrases.result === "supported" ? "a phrasing, not a spelling, finding"
  : "no detected shift";

// ---------- sensitivities (reported, not tested) ----------
const sens = {};
const both = (label, opts, country = "uk") => { sens[label] = Object.fromEntries(["us_share", "us_share_oxford", "us_share_ize", "phrases_per_1000"].map((k) => [k, summarise(changes(country, k, opts))])); };
both("before_live_only", { from: "before_live" });
both("after_2024_on", { to: "after_2024" });
both("software_excluded", { filter: (d, b) => b.sector !== "software" });
both("us_brands_30plus", { filter: (d) => { const c = count(US.get(d)); return c.before >= 30 && c.after >= 30; } }, "us");
sens.by_sector = {};
for (const sec of [...new Set(Object.values(brands).filter((b) => ok(b) && b.country === "uk").map((b) => b.sector))].sort()) sens.by_sector[sec] = Object.fromEntries(["us_share_oxford", "phrases_per_1000"].map((k) => [k, summarise(changes("uk", k, { filter: (d, b) => b.sector === sec }))]));
const usAllMeasures = Object.fromEntries(["us_share", "us_share_oxford", "us_share_ize", "phrases_per_1000"].map((k) => [k, summarise(changes("us", k))]));

const per1000 = (o, words) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, { count: v, per_1000: r6((1000 * v) / words) }]));
const topUsTerms = (o, n = 15) => Object.entries(o).filter(([w]) => LOOK.get(w)?.side === "us").sort((a, b) => b[1] - a[1]).slice(0, n);
// brands that drive the phrase totals: share of all after-period UK phrase hits from the top brand
const phraseBy = Object.entries(accs).filter(([d]) => brands[d].country === "uk" && !guarded.includes(d)).map(([d, a]) => [d, a.after.phr]).sort((a, b) => b[1] - a[1]);

const today = new Date().toISOString().slice(0, 10);
const S = {
  study: "SGR-028", pilot: PILOT, ranOn: today, seed: SEED, bootstrap: B,
  locale_rule: FROZEN ? { applied: false } : { applied: true, deviation: "Deviation 1, 2026-11-12, after the freeze", uk: { pages: localeDropped.uk.pages, by_language: localeDropped.uk.language, by_path: localeDropped.uk.path }, us: { pages: localeDropped.us.pages, by_language: localeDropped.us.language, by_path: localeDropped.us.path, top_brands: Object.fromEntries(Object.entries(localeDropped.us.brands).sort((a, b) => b[1] - a[1]).slice(0, 10)) } },
  rules: { min_pages: MIN_PAGES, min_tokens: MIN_TOKENS, min_oxford_tokens: MIN_OXFORD, house_style_guard: GUARD, us_sanity: US_SANITY },
  corpus: {
    uk_brands_eligible_pages: ukList.length, us_brands_eligible_pages: usList.length,
    uk_guarded: guarded, unreadable: Object.entries(brands).filter(([, b]) => b.error).map(([d]) => d),
    uk: { before: stats(Puk.before), after: stats(Puk.after) }, us: { before: stats(Pus.before), after: stats(Pus.after) },
  },
  instrument: { ok: instrumentOk, rule: "pooled American share of variant tokens, all US control pages in both periods, >= 0.98", us_brands: usAll.length, pooled_us_share: r6(usLevel.pooled_both), pooled_us_share_before: r6(usLevel.before), pooled_us_share_after: r6(usLevel.after), brand_mean_us_share_before: r6(usLevel.brand_mean_before), brand_mean_us_share_after: r6(usLevel.brand_mean_after) },
  H1, H1b, H2, H3, wording,
  ize_alone: summarise(changes("uk", "us_share_ize")),
  us_control: usAllMeasures,
  guarded_brands: Object.fromEntries(guarded.map((d) => [d, { sector: brands[d].sector, before: brands[d].before, after: brands[d].after }])),
  sensitivities: sens,
  phrases: { uk_before: per1000(Puk.before.phrases, Puk.before.words), uk_after: per1000(Puk.after.phrases, Puk.after.words), us_before: per1000(Pus.before.phrases, Pus.before.words), us_after: per1000(Pus.after.phrases, Pus.after.words) },
  uk_markers: { before: per1000(Puk.before.markers, Puk.before.words), after: per1000(Puk.after.markers, Puk.after.words) },
  uk_us_side_terms: { before: topUsTerms(Puk.before.terms), after: topUsTerms(Puk.after.terms) },
  phrase_concentration: { top_brand_share_after: phraseBy.length && Puk.after.phr ? r6(phraseBy[0][1] / Puk.after.phr) : null },
};

// ---------- outputs ----------
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/sgr-028-summary.json`, JSON.stringify(S, null, 1) + "\n");
const cols = ["brand", "country", "sector", "guarded", "pages_before", "pages_after", "words_before", "words_after", "variant_tokens_before", "variant_tokens_after", "us_share_before", "us_share_after", "us_share_oxford_before", "us_share_oxford_after", "us_share_ize_before", "us_share_ize_after", "phrases_per_1000_before", "phrases_per_1000_after"];
const csv = [cols.join(",")];
for (const [d, b] of Object.entries(brands).sort()) { if (!ok(b)) continue;
  csv.push([d, b.country, b.sector, guarded.includes(d) ? "yes" : "no", b.before.pages, b.after.pages, b.before.words, b.after.words, b.before.variant_tokens, b.after.variant_tokens,
    ...["us_share", "us_share_oxford", "us_share_ize", "phrases_per_1000"].flatMap((k) => [b.before[k], b.after[k]].map((x) => (x == null ? "" : r6(x))))].join(",")); }
writeFileSync(`${OUT}/sgr-028-brands.csv`, csv.join("\n") + "\n");
chart(S, OUT);
console.log(JSON.stringify({ pilot: PILOT, ranOn: today, instrument: S.instrument, H1: [H1.point, H1.lo, H1.hi, H1.n, H1.result], H1b: [H1b.point, H1b.lo, H1b.hi, H1b.result], H2: [H2.point, H2.lo, H2.hi, H2.n, H2.result], H3: [H3.phrases.point, H3.phrases.lo, H3.phrases.hi, H3.result], wording }, null, 1));
if (!instrumentOk) { process.stderr.write("STOP: the US instrument check failed (pre-registration section 4). Do not publish.\n"); process.exit(2); }

// ---------- chart: within-brand change, UK vs US, phrases and Oxford-proof spelling ----------
function chart(S, dir) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const STYLE = `<style>text{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;fill:#6b6862}.t{font-family:Archivo,system-ui,sans-serif;font-size:15px;font-weight:700;fill:#11100E}.lbl{fill:#11100E}.grid{stroke:#11100E;stroke-opacity:.1}.zero{stroke:#11100E;stroke-opacity:.55}.c0{fill:#674BFF;stroke:#674BFF}.c1{fill:#9D8420;stroke:#9D8420}.ln{stroke-width:2.5}.dot{stroke:#F6F5F0;stroke-width:1.5}@media (prefers-color-scheme:dark){text{fill:#a8a49b}.t,.lbl{fill:#F6F5F0}.grid,.zero{stroke:#F6F5F0}.c0{fill:#7A61FF;stroke:#7A61FF}.c1{fill:#C9A72C;stroke:#C9A72C}.dot{stroke:#141310}}</style>`;
  const panels = [["Americanism phrases per 1,000 words", [["UK brands", S.H2], ["US brands", S.us_control.phrases_per_1000]], 1, ""], ["American spelling share, Oxford-proof words", [["UK brands", S.H1], ["US brands", S.us_control.us_share_oxford]], 100, " pp"]];
  const W = 760, L = 150, R = 40, rowH = 30; let y0 = 64, body = "";
  for (const [title, rows, scale, unit] of panels) {
    const vals = rows.flatMap(([, s]) => [s.lo, s.hi, s.point]).filter((v) => v != null).map((v) => v * scale);
    const m = Math.max(0.01, ...vals.map(Math.abs)) * 1.15; const x = (v) => L + ((v * scale + m) / (2 * m)) * (W - L - R);
    body += `<text class="lbl" x="16" y="${y0}">${esc(title)}: mean within-brand change, 95% interval</text>`;
    const top = y0 + 12, bot = top + rows.length * rowH;
    body += `<line class="zero" x1="${x(0).toFixed(1)}" x2="${x(0).toFixed(1)}" y1="${top}" y2="${bot}"/>`;
    for (const v of [-m, m]) body += `<text x="${(L + ((v + m) / (2 * m)) * (W - L - R)).toFixed(1)}" y="${bot + 14}" text-anchor="middle">${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}${unit}</text>`;
    rows.forEach(([lab, s], i) => { const y = top + i * rowH + 15, c = i ? "c1" : "c0";
      body += `<text class="lbl" x="${L - 10}" y="${y + 4}" text-anchor="end">${lab} (${s.n})</text>`;
      if (s.lo != null) body += `<line class="${c} ln" x1="${x(s.lo).toFixed(1)}" x2="${x(s.hi).toFixed(1)}" y1="${y}" y2="${y}"/>`;
      if (s.point != null) body += `<circle class="${c} dot" cx="${x(s.point).toFixed(1)}" cy="${y}" r="5.5"/>`; });
    y0 = bot + 44;
  }
  const H = y0 - 10;
  writeFileSync(`${dir}/sgr-028-change.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Within-brand change after November 2022, UK and US brands">${STYLE}<text class="t" x="16" y="24">Did UK brands move towards American English after ChatGPT?</text><text x="16" y="42">Change from before December 2022 to 2023 on, each brand compared with itself</text>${body}</svg>\n`);
}
