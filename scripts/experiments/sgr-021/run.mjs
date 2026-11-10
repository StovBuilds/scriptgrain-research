#!/usr/bin/env bun
// SGR-021: full measurement and analysis. Deterministic: same panel + texts + seed = same bytes.
//
//   bun scripts/experiments/sgr-021/run.mjs --data ~/research/sgr-021-classic [--pilot] [--out-dir public/research]
//
// Reads panel.json and the cached Gutenberg texts, counts the frozen AI-ism word lists in every
// book (SGR-007's lexicons.json, same matching rule as instruments.mjs; checked below), runs the
// analysis frozen in docs/research/sgr-021-preregistration.md and writes:
//   sgr-021-summary.json, sgr-021-books.csv, sgr-021-authors.csv, sgr-021-tells.csv, two SVG charts.
// --pilot: a seeded 5% of authors, written to <data>/pilot/ (never public/). Numbers from a pilot
// are for checking the code and are not reported.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { CFG, rng, sha256, cleanBook, narrationOf, dialogueWords, QUOTED, words, readGz } from "./lib.mjs";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";
import { writeCharts } from "./charts.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DATA = opt("--data", null), PILOT = args.includes("--pilot");
if (!DATA) throw new Error("--data required");
const OUT = opt("--out-dir", PILOT ? `${DATA}/pilot` : "public/research");
mkdirSync(OUT, { recursive: true });
const A = CFG.analysis, SEED = CFG.seed;
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);
// Rates in this study are small (about 0.1 to 1 per 1,000 words), so every rate keeps 3 decimals.
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const r3 = r2;

// ---- panel -----------------------------------------------------------------------------------
const panelFile = opt("--panel", new URL("./panel.json", import.meta.url).pathname);
const PANEL = JSON.parse(readFileSync(panelFile, "utf8"));
let authors = PANEL.authors;
if (PILOT) {
  // Pilot authors: the lowest 5% by sha256(seed:id), so the pilot is the same on every machine.
  const k = Math.max(3, Math.ceil(authors.length * CFG.pilot.author_share));
  authors = [...authors].sort((a, b) => sha256(`${SEED}:${a.id}`).localeCompare(sha256(`${SEED}:${b.id}`))).slice(0, k);
}

// ---- word lists ------------------------------------------------------------------------------
const LEX = JSON.parse(readFileSync(new URL("../sgr-007/lexicons.json", import.meta.url), "utf8"));
const toRe = (w) => new RegExp(`\\b${w.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "[- ]").replace(/\*$/, "\\w*")}\\b`, "gi");
const entries = [...new Set(["OLD", "CALLED_OUT", "MARKETING"].flatMap((k) => LEX[k]))];
// A "tell" is one list entry; entries covered by another entry's wildcard stem (delve, showcasing) or
// spelled twice (game changer / game-changer) are folded into it for the per-tell table. The union
// (the primary measure) counts every word occurrence once whatever the lists.
const stems = entries.filter((e) => e.endsWith("*")).map((e) => e.slice(0, -1));
const TELLS = entries.filter((e) => !(!e.endsWith("*") && stems.some((s) => e.startsWith(s))) && e !== "game changer");
const RE_ALL = entries.map((e) => toRe(e));
const RE_TELL = TELLS.map((e) => toRe(e));

function countBook(text) {
  const spans = []; QUOTED.lastIndex = 0; let q; while ((q = QUOTED.exec(text))) spans.push([q.index, q.index + q[0].length]);
  const inQ = (i) => { let lo = 0, hi = spans.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (i < spans[m][0]) hi = m - 1; else if (i >= spans[m][1]) lo = m + 1; else return true; } return false; };
  const pos = new Set();
  for (const re of RE_ALL) { re.lastIndex = 0; let m; while ((m = re.exec(text))) pos.add(m.index); }
  let narr = 0; for (const p of pos) if (!inQ(p)) narr++;
  const tell = RE_TELL.map((re) => { re.lastIndex = 0; let c = 0; while (re.exec(text)) c++; return c; });
  return { all: pos.size, narr, tell };
}

// ---- measure ---------------------------------------------------------------------------------
const books = [];
const t0 = Date.now(); let done = 0, missing = 0;
for (const a of authors) for (const w of a.works) {
  const f = `${DATA}/texts/${w.pg}.txt.gz`;
  if (!existsSync(f)) { missing++; continue; }
  const c = cleanBook(readGz(f));
  const cnt = countBook(c.text);
  const nar = narrationOf(c.text), nw = words(nar), dw = dialogueWords(c.text);
  const scan = scanCliches(c.text);
  books.push({ aid: a.id, name: a.name, century: a.midlife_century, decade: a.midlife_decade, pg: w.pg, title: w.title, genre: w.genre, words: c.words, hits: cnt.all, nwords: nw, nhits: cnt.narr, dwords: dw, tell: cnt.tell, aitell: scan.per1000 });
  if (++done % 200 === 0) log(`${done} books measured, ${Math.round((Date.now() - t0) / 1000)}s`);
}
if (missing) throw new Error(`${missing} panel books have no cached text; run build-corpus.mjs first`);
log(`${books.length} books, ${authors.length} authors measured in ${Math.round((Date.now() - t0) / 1000)}s`);

// Self-check: our counts equal SGR-007's instruments on a few books (its per-1000 is rounded to 2 dp).
{
  const { measure } = await import("../sgr-007/instruments.mjs");
  for (const b of books.slice(0, 2)) {
    const t = cleanBook(readGz(`${DATA}/texts/${b.pg}.txt.gz`)).text;
    const want = measure(t, words(t)).ai_ism_per1000, got = Math.round((b.hits / b.words) * 1e5) / 100;
    if (want !== got) throw new Error(`self-check failed for PG ${b.pg}: instruments ${want}, run.mjs ${got}`);
  }
  log("self-check against sgr-007 instruments: ok");
}

// ---- helpers ---------------------------------------------------------------------------------
const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
const rate = (h, w) => (w > 0 ? (h / w) * 1000 : NaN);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const ci = (xs) => { xs = xs.filter(Number.isFinite); return xs.length ? [pct(xs, 0.025), pct(xs, 0.975)] : [NaN, NaN]; };
const R = rng(SEED);
const pick = (n) => Math.floor(R() * n);
function rank(xs) { const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(xs.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
function pearson(x, y) { const n = x.length, mx = sum(x) / n, my = sum(y) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); }
const spearman = (x, y) => pearson(rank(x), rank(y));

const byAuthor = new Map(authors.map((a) => [a.id, { ...a, books: [] }]));
for (const b of books) byAuthor.get(b.aid).books.push(b);
const A_ = [...byAuthor.values()].filter((a) => a.books.length >= A.min_author_books && sum(a.books, (b) => b.words) >= A.min_author_words);
const BOOKS = A_.flatMap((a) => a.books);
const TOT = { words: sum(BOOKS, (b) => b.words), hits: sum(BOOKS, (b) => b.hits) };
const corpusRate = rate(TOT.hits, TOT.words);

// Leave-author-out expected rate by genre within the author's midlife century.
const cell = new Map();
for (const b of BOOKS) { const k = `${b.century}|${b.genre}`; const c = cell.get(k) ?? { h: 0, w: 0 }; c.h += b.hits; c.w += b.words; cell.set(k, c); }
const expected = (a, b) => {
  const k = `${a.midlife_century}|${b.genre}`, c = cell.get(k);
  const own = a.books.filter((x) => x.genre === b.genre), h = c.h - sum(own, (x) => x.hits), w = c.w - sum(own, (x) => x.words);
  if (w >= 200000) return (h / w) * b.words;
  const cc = [...cell].filter(([kk]) => kk.startsWith(`${a.midlife_century}|`)).reduce((s, [, v]) => ({ h: s.h + v.h, w: s.w + v.w }), { h: 0, w: 0 });
  const oh = cc.h - sum(a.books, (x) => x.hits), ow = cc.w - sum(a.books, (x) => x.words);
  return ow > 0 ? (oh / ow) * b.words : corpusRate * b.words / 1000;
};

// ---- authors: rate, interval over books, leave-one-book-out, adjusted ----------------------------
const N = A.bootstrap_resamples;
const rows = A_.map((a) => {
  const bs = a.books, w = sum(bs, (b) => b.words), h = sum(bs, (b) => b.hits);
  const e = bs.map((b) => expected(a, b));
  const rs = [], rsN = [], adj = [];
  for (let i = 0; i < N; i++) {
    let hh = 0, ww = 0, nh = 0, nw = 0, ee = 0;
    for (let j = 0; j < bs.length; j++) { const k = pick(bs.length); hh += bs[k].hits; ww += bs[k].words; nh += bs[k].nhits; nw += bs[k].nwords; ee += e[k]; }
    rs.push(rate(hh, ww)); rsN.push(rate(nh, nw)); adj.push(hh / ee);
  }
  const loo = bs.map((_, i) => rate(h - bs[i].hits, w - bs[i].words));
  const fic = sum(bs.filter((b) => b.genre === "fiction"), (b) => b.words) / w;
  return {
    id: a.id, name: a.name, born: a.born, died: a.died, midlife_decade: a.midlife_decade, century: a.midlife_century,
    books: bs.length, words: w, fiction_share: r2(fic),
    rate: rate(h, w), lo: ci(rs)[0], hi: ci(rs)[1],
    narr_rate: rate(sum(bs, (b) => b.nhits), sum(bs, (b) => b.nwords)), narr_lo: ci(rsN)[0], narr_hi: ci(rsN)[1],
    stable_rate: Math.min(...loo), top_book_pg: bs.reduce((m, b) => (rate(b.hits, b.words) > rate(m.hits, m.words) ? b : m)).pg,
    top_book_share: Math.max(...bs.map((b) => b.hits)) / h,
    adj_ratio: h / sum(e), adj_lo: ci(adj)[0], adj_hi: ci(adj)[1],
    dialogue_share: sum(bs, (b) => b.dwords) / w,
    ai_tell_per1000: sum(bs, (b) => b.aitell * b.words) / w,
  };
});
const orderBy = (key, dir = -1) => { const o = [...rows].sort((x, y) => dir * (x[key] - y[key]) || x.id.localeCompare(y.id)); const m = new Map(o.map((x, i) => [x.id, i + 1])); return m; };
const rk = { raw: orderBy("rate"), narr: orderBy("narr_rate"), stable: orderBy("stable_rate"), adj: orderBy("adj_ratio") };
for (const r of rows) { r.rank = rk.raw.get(r.id); r.rank_narration = rk.narr.get(r.id); r.rank_stable = rk.stable.get(r.id); r.rank_adjusted = rk.adj.get(r.id); r.above_corpus = r.lo > corpusRate; }
rows.sort((x, y) => x.rank - y.rank);

// ---- hypotheses -----------------------------------------------------------------------------------
const AU = A_.map((a) => ({ a, f: { h: sum(a.books.filter((b) => b.genre === "fiction"), (b) => b.hits), w: sum(a.books.filter((b) => b.genre === "fiction"), (b) => b.words) }, n: { h: sum(a.books.filter((b) => b.genre !== "fiction"), (b) => b.hits), w: sum(a.books.filter((b) => b.genre !== "fiction"), (b) => b.words) } }));
const boot = (fn) => { const o = []; for (let i = 0; i < N; i++) o.push(fn()); return ci(o); };
const dirIn = (lo, hi, want) => (want === "pos" ? lo > 0 : want === "neg" ? hi < 0 : lo > 0 || hi < 0);
// H1: non-fiction minus fiction, pooled rate per 1,000 words; authors resampled.
const h1 = (S) => rate(sum(S, (x) => x.n.h), sum(S, (x) => x.n.w)) - rate(sum(S, (x) => x.f.h), sum(S, (x) => x.f.w));
const H1 = { est: h1(AU), ci: boot(() => h1(Array.from({ length: AU.length }, () => AU[pick(AU.length)]))), fiction_rate: rate(sum(AU, (x) => x.f.h), sum(AU, (x) => x.f.w)), nonfiction_rate: rate(sum(AU, (x) => x.n.h), sum(AU, (x) => x.n.w)) };
H1.holds = dirIn(H1.ci[0], H1.ci[1], "pos");
// H2: mean author rate, midlife 1900s authors minus 1800s authors (two-sided).
const g18 = rows.filter((r) => r.century === 1800).map((r) => r.rate), g19 = rows.filter((r) => r.century === 1900).map((r) => r.rate);
const mean = (xs) => sum(xs) / xs.length, res = (xs) => Array.from({ length: xs.length }, () => xs[pick(xs.length)]);
const H2 = { est: mean(g19) - mean(g18), n1800: g18.length, n1900: g19.length, mean1800: mean(g18), mean1900: mean(g19) };
H2.ci = boot(() => mean(res(g19)) - mean(res(g18))); H2.holds = dirIn(H2.ci[0], H2.ci[1], "both");
// H3: ranking is not a dialogue artefact: Spearman of all-text vs narration author rates >= 0.9.
const sp = (S) => spearman(S.map((r) => r.rate), S.map((r) => r.narr_rate));
const H3 = { rho: sp(rows), ci: boot(() => sp(res(rows))) }; H3.holds = H3.rho >= A.narration_rho_min;
// H4: ICC(1) of book rates within authors, intervals over authors.
const icc = (S) => {
  const g = S.map((a) => a.books.map((b) => rate(b.hits, b.words))), a = g.length, n = sum(g, (x) => x.length);
  const gm = sum(g, (x) => sum(x)) / n; const n0 = (n - sum(g, (x) => x.length ** 2) / n) / (a - 1);
  const msb = sum(g, (x) => x.length * (mean(x) - gm) ** 2) / (a - 1), msw = sum(g, (x) => sum(x, (v) => (v - mean(x)) ** 2)) / (n - a);
  return (msb - msw) / (msb + (n0 - 1) * msw);
};
const ar = A_.map((a) => ({ books: a.books }));
const H4 = { icc: icc(ar), ci: boot(() => icc(res(ar))) }; H4.holds = H4.ci[0] > A.icc_lower_bound;

// ---- per-tell: pooled rate, top author, earliest strong home -----------------------------------------
const decades = [...new Set(A_.map((a) => a.midlife_decade))].sort((x, y) => x - y);
const tells = TELLS.map((t, ti) => {
  const hits = sum(BOOKS, (b) => b.tell[ti]), pooled = rate(hits, TOT.words);
  const perAuthor = A_.map((a) => ({ a, h: sum(a.books, (b) => b.tell[ti]), w: sum(a.books, (b) => b.words) }));
  const topA = perAuthor.filter((x) => x.h >= A.tell_min_author_hits && x.w >= A.tell_min_author_words).sort((x, y) => rate(y.h, y.w) - rate(x.h, x.w) || x.a.id.localeCompare(y.a.id))[0];
  const dec = decades.map((d) => {
    const S = perAuthor.filter((x) => x.a.midlife_decade === d), h = sum(S, (x) => x.h), w = sum(S, (x) => x.w);
    const top = [...S].sort((x, y) => rate(y.h, y.w) - rate(x.h, x.w))[0];
    return { decade: d, hits: h, words: w, rate: rate(h, w), ratio: pooled > 0 ? rate(h, w) / pooled : NaN, authors_with_hits: S.filter((x) => x.h > 0).length, top_author: top && top.h > 0 ? top.a.name : null };
  });
  const strong = dec.filter((d) => d.hits >= A.home_decade_min_hits && d.authors_with_hits >= A.home_decade_min_authors && d.ratio >= A.home_decade_min_ratio);
  const peak = [...dec].filter((d) => d.hits >= A.home_decade_min_hits && d.authors_with_hits >= A.home_decade_min_authors).sort((x, y) => y.ratio - x.ratio)[0];
  return { tell: t, hits, per1000: pooled, authors_using: perAuthor.filter((x) => x.h > 0).length, top_author: topA?.a.name ?? null, top_author_per1000: topA ? rate(topA.h, topA.w) : null, top_author_hits: topA?.h ?? null, earliest_strong_decade: strong[0]?.decade ?? null, earliest_strong_ratio: strong[0]?.ratio ?? null, earliest_strong_top_author: strong[0]?.top_author ?? null, peak_decade: peak?.decade ?? null, peak_ratio: peak?.ratio ?? null };
}).sort((x, y) => y.hits - x.hits);

// ---- baselines and counts -----------------------------------------------------------------------------
const cellRows = [...cell].map(([k, v]) => { const [c, g] = k.split("|"); const bs = BOOKS.filter((b) => `${b.century}|${b.genre}` === k); return { century: +c, genre: g, authors: new Set(bs.map((b) => b.aid)).size, books: bs.length, words: v.w, rate: rate(v.h, v.w), narr_rate: rate(sum(bs, (b) => b.nhits), sum(bs, (b) => b.nwords)) }; }).sort((x, y) => x.century - y.century || x.genre.localeCompare(y.genre));
const bucket = (f) => { const m = {}; for (const b of BOOKS) { const k = f(b); m[k] ??= { books: 0, words: 0, authors: new Set() }; m[k].books++; m[k].words += b.words; m[k].authors.add(b.aid); } return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { books: v.books, words: v.words, authors: v.authors.size }])); };
const dlg = { rho_rate_vs_dialogue: spearman(rows.map((r) => r.rate), rows.map((r) => r.dialogue_share)) };

// ---- write ----------------------------------------------------------------------------------------------
const csv = (hdr, rs) => [hdr.join(","), ...rs.map((r) => hdr.map((h) => { const v = r[h]; return v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v; }).join(","))].join("\n") + "\n";
const P = (n) => `${OUT}/sgr-021-${n}`;
const brow = BOOKS.map((b) => ({ author: b.name, author_wikidata: b.aid, midlife_decade: b.decade, pg: b.pg, title: b.title, genre: b.genre, words: b.words, ai_isms: b.hits, ai_isms_per1000: r2(rate(b.hits, b.words)), narration_words: b.nwords, narration_ai_isms: b.nhits, narration_per1000: r2(rate(b.nhits, b.nwords)), dialogue_share: r3(b.dwords / b.words), ai_tell_pattern_per1000: r2(b.aitell) }));
writeFileSync(P("books.csv"), csv(Object.keys(brow[0]), brow));
const arows = rows.map((r) => ({ rank: r.rank, author: r.name, author_wikidata: r.id, born: r.born, died: r.died, midlife_decade: r.midlife_decade, books: r.books, words: r.words, fiction_share: r.fiction_share, ai_isms_per1000: r2(r.rate), lo95: r2(r.lo), hi95: r2(r.hi), narration_per1000: r2(r.narr_rate), rank_narration: r.rank_narration, without_top_book_per1000: r2(r.stable_rate), rank_without_top_book: r.rank_stable, top_book_share_of_hits: r3(r.top_book_share), vs_peers_ratio: r2(r.adj_ratio), vs_peers_lo95: r2(r.adj_lo), vs_peers_hi95: r2(r.adj_hi), rank_vs_peers: r.rank_adjusted, dialogue_share: r3(r.dialogue_share), ai_tell_pattern_per1000: r2(r.ai_tell_per1000) }));
writeFileSync(P("authors.csv"), csv(Object.keys(arows[0]), arows));
const trows = tells.map((t) => ({ tell: t.tell, hits: t.hits, per1000: r3(t.per1000), authors_using: t.authors_using, top_author: t.top_author, top_author_per1000: r2(t.top_author_per1000), top_author_hits: t.top_author_hits, earliest_strong_decade: t.earliest_strong_decade, earliest_strong_ratio: r2(t.earliest_strong_ratio), earliest_strong_top_author: t.earliest_strong_top_author, peak_decade: t.peak_decade, peak_ratio: r2(t.peak_ratio) }));
writeFileSync(P("tells.csv"), csv(Object.keys(trows[0]), trows));

const q2 = (x) => r2(x), q2a = (a) => a.map(r2);
const summary = {
  study: "SGR-021", pilot: PILOT, seed: SEED, bootstrap_resamples: N,
  counts: { authors: A_.length, books: BOOKS.length, words: TOT.words, by_century: bucket((b) => b.century), by_genre: bucket((b) => b.genre), panel_built: PANEL.built, authors_eligible_before_download: PANEL.authors_eligible_before_download },
  corpus: { ai_isms_per1000: r3(corpusRate), hits: TOT.hits, narration_per1000: r3(rate(sum(BOOKS, (b) => b.nhits), sum(BOOKS, (b) => b.nwords))), dialogue_share: r3(sum(BOOKS, (b) => b.dwords) / TOT.words), median_author_rate: r2(pct(rows.map((r) => r.rate), 0.5)), authors_above_corpus_ci: rows.filter((r) => r.above_corpus).length },
  baselines: cellRows.map((c) => ({ ...c, rate: r2(c.rate), narr_rate: r2(c.narr_rate) })),
  H1: { claim: "non-fiction books have a higher AI-ism rate than fiction", est: q2(H1.est), ci: q2a(H1.ci), fiction_rate: q2(H1.fiction_rate), nonfiction_rate: q2(H1.nonfiction_rate), holds: H1.holds },
  H2: { claim: "authors who turned 40 in the 1900s differ from those who turned 40 in the 1800s (two-sided)", est: q2(H2.est), ci: q2a(H2.ci), mean1800: q2(H2.mean1800), mean1900: q2(H2.mean1900), n1800: H2.n1800, n1900: H2.n1900, holds: H2.holds },
  H3: { claim: "author ranking is not a dialogue artefact (Spearman all-text vs narration >= 0.9)", rho: r3(H3.rho), ci: H3.ci.map(r3), holds: H3.holds },
  H4: { claim: "ICC(1) of book rates within authors has a lower bound above 0.25", icc: r3(H4.icc), ci: H4.ci.map(r3), holds: H4.holds },
  dialogue: { rho_rate_vs_dialogue_share: r3(dlg.rho_rate_vs_dialogue) },
  top: rows.slice(0, 20).map((r) => ({ rank: r.rank, name: r.name, born: r.born, died: r.died, books: r.books, words: r.words, rate: r2(r.rate), lo: r2(r.lo), hi: r2(r.hi), stable_rate: r2(r.stable_rate), rank_stable: r.rank_stable, rank_narration: r.rank_narration, vs_peers: r2(r.adj_ratio), rank_adjusted: r.rank_adjusted, fiction_share: r.fiction_share })),
  bottom: rows.slice(-10).map((r) => ({ rank: r.rank, name: r.name, books: r.books, words: r.words, rate: r2(r.rate), lo: r2(r.lo), hi: r2(r.hi) })),
  top_stable: [...rows].sort((x, y) => x.rank_stable - y.rank_stable).slice(0, 10).map((r) => ({ rank_stable: r.rank_stable, rank: r.rank, name: r.name, stable_rate: r2(r.stable_rate), rate: r2(r.rate) })),
  top_adjusted: [...rows].sort((x, y) => x.rank_adjusted - y.rank_adjusted).slice(0, 10).map((r) => ({ rank_adjusted: r.rank_adjusted, rank: r.rank, name: r.name, ratio: r2(r.adj_ratio), lo: r2(r.adj_lo), hi: r2(r.adj_hi) })),
  top20_overlap: { stable_in_raw_top20: rows.filter((r) => r.rank <= 20 && r.rank_stable <= 20).length, narration_in_raw_top20: rows.filter((r) => r.rank <= 20 && r.rank_narration <= 20).length, adjusted_in_raw_top20: rows.filter((r) => r.rank <= 20 && r.rank_adjusted <= 20).length },
  one_book_authors_in_top20: rows.slice(0, 20).filter((r) => r.top_book_share > 0.5).length,
  tells: tells.map((t) => ({ tell: t.tell, hits: t.hits, per1000: r3(t.per1000), authors_using: t.authors_using, top_author: t.top_author, top_author_per1000: r2(t.top_author_per1000), top_author_hits: t.top_author_hits, earliest_strong_decade: t.earliest_strong_decade, earliest_strong_ratio: r2(t.earliest_strong_ratio), earliest_strong_top_author: t.earliest_strong_top_author, peak_decade: t.peak_decade, peak_ratio: r2(t.peak_ratio) })),
  tell_list: TELLS,
  ranking_columns: "authors.csv",
};
writeFileSync(P("summary.json"), JSON.stringify(summary, null, 1) + "\n");

// ---- charts (charts.mjs; also rebuildable from the summary alone) ----------------------------------------
writeCharts(OUT, { top: rows.slice(0, 20), corpusRate, cells: cellRows });
log(`wrote ${OUT}/sgr-021-*  (${Math.round((Date.now() - t0) / 1000)}s total)`);
