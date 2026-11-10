#!/usr/bin/env bun
// SGR-024: Did the AI tells reach medicine? The full measurement and analysis, as frozen in
// docs/research/sgr-024-preregistration.md. Deterministic: same sample file, same outputs (except the
// `generated` and `runtime_seconds` fields). No network request, no language model.
//   bun scripts/experiments/sgr-024/run.mjs              full run (D-1)
//   bun scripts/experiments/sgr-024/run.mjs --pilot      records with h < 4000 (4% of the sample), 200 resamples,
//                                                        outputs to ~/research/sgr-024/pilot-out
// Writes public/research/sgr-024-*.{json,csv,svg}. Numbers only; no abstract text leaves this script.
import { createReadStream, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createGunzip, gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";
import { Grow, ClusterTable, r2, r3, r4, r6, csv, parseCsvLine } from "./lib.mjs";
import { halfYearChart, boundsChart } from "./charts.mjs";

const args = process.argv.slice(2);
const PILOT = args.includes("--pilot");
const HOME = process.env.HOME;
const R = process.env.SGR024_DIR ?? `${HOME}/research/sgr-024`;
const OUT = PILOT ? `${R}/pilot-out` : (process.env.SGR024_OUT ?? "public/research");
const SAMPLE = process.env.SGR024_SAMPLE ?? `${R}/sample.jsonl.gz`;
const here = new URL(".", import.meta.url).pathname;
const B = PILOT ? 200 : 2000;
const SEED = 20261029;
const PILOT_BELOW = 4000;
mkdirSync(OUT, { recursive: true });
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);
const t0 = Date.now();
const jread = (p) => JSON.parse(readFileSync(p, "utf8"));
async function* lines(path) {
  const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) if (l) yield l;
}

// ---- frozen inputs ---------------------------------------------------------------------------------
const OLD = ["innovative", "utilized", "advancements", "pivotal", "facilitates", "firstly", "tackle", "showcasing", "underscores", "delve", "delves", "intricate"];
const NEW = ["underexplored", "grounded", "aligns", "synthesizes", "replaces", "leaving", "recovers", "expose", "structurally", "reproducible", "treats", "vanishes"];
const CONTROL = ["however", "results", "using", "show", "method"];
const FROZEN = [...OLD, ...NEW, ...CONTROL];
const STOP = new Set("the of and to in a is that for on with as by we this are be an at from it which can or our these has have was were their its not but also than been such into more two one between both where when how all they there".split(" "));
const EXCLUDED_TYPES = new Set(["Retraction of Publication", "Published Erratum", "Comment", "Editorial", "Letter", "News", "Newspaper Article", "Biography", "Autobiography", "Interview", "Lecture", "Expression of Concern", "Introductory Journal Article", "Portrait", "Personal Narrative", "Webcast", "Video-Audio Media", "Legal Case", "Congress", "Duplicate Publication", "Consensus Development Conference", "Clinical Conference"]);
const AI_TOPIC = /^(ai|llms?|chatgpt|gpt-?|generative|chatbots?|copilot|gemini|claude|llama|bert|transformers?|nlp|deep-learning|machine-learning|large-language)$|^(ai-|llm|chatgpt)/;
const FIELDS = jread(here + "fields.json");
const GN = [...FIELDS.groups, "general", "unclassified"];            // group index 0..7 named, 8 general, 9 unclassified
const NG = FIELDS.groups.length;
const REF8 = jread(here + "sgr008-reference.json");
const LABELS8 = jread(here + "../sgr-008/results/census/labels.json");

// Kobak et al. (Science Advances 2025) published files, downloaded to ref/ (MIT licence)
const kobak = new Map();
{
  const L = readFileSync(`${R}/ref/excess_words.csv`, "utf8").split("\n").slice(1).filter(Boolean);
  for (const l of L) { const c = parseCsvLine(l); kobak.set(c[1], (c[2] ?? "").trim()); }
}
const kobakYearly = new Map(); let kobakTotal = null;
{
  const L = gunzipSync(readFileSync(`${R}/ref/yearly-counts.csv.gz`)).toString("utf8").split("\n").filter(Boolean);
  const want = new Set(FROZEN);
  for (const l of L.slice(1)) {
    const c = l.split(",");
    if (c[0] === "") kobakTotal = c.slice(1).map(Number);
    else if (want.has(c[0])) kobakYearly.set(c[0], c.slice(1).map(Number));
  }
}
const KOBAK_YEARS = Array.from({ length: 15 }, (_, i) => 2010 + i);

// MeSH descriptor -> subject group votes
const meshField = new Map();
{
  const fieldOf = (tree) => FIELDS.overrides[tree.slice(0, 3)] ?? FIELDS.defaults[tree[0]] ?? null;
  for (const l of readFileSync(`${R}/ref/mesh-trees.tsv`, "utf8").split("\n").filter(Boolean)) {
    const [name, trees] = l.split("\t");
    const gs = [...new Set(trees.split(",").map(fieldOf).filter(Boolean))].map((g) => FIELDS.groups.indexOf(g)).filter((g) => g >= 0);
    if (gs.length) meshField.set(name, gs);
  }
}

// ---- time axes ---------------------------------------------------------------------------------------
const mIdx = (y, m) => (y - 2015) * 12 + (m - 1);                       // 0 = 2015-01
const T_M = 144;                                                         // through 2026-12
const M_LAST = mIdx(2026, 9), M_DEC22 = mIdx(2022, 12);
const PK = ["BASE", "Y2024", "Y2026", "BASE2", "Y2025"];
const PER = { BASE: [mIdx(2020, 1), mIdx(2022, 11)], Y2024: [mIdx(2024, 1), mIdx(2024, 12)], Y2026: [mIdx(2026, 1), mIdx(2026, 9)], BASE2: [mIdx(2018, 1), mIdx(2019, 12)], Y2025: [mIdx(2025, 1), mIdx(2025, 12)] };
const perOf = (m) => { for (let p = 0; p < PK.length; p++) if (m >= PER[PK[p]][0] && m <= PER[PK[p]][1]) return p; return -1; };
const yearOf = (m) => 2015 + Math.floor(m / 12);
const halfLabel = (h) => `${2015 + Math.floor(h / 2)}H${(h % 2) + 1}`;

// ---- pass 1: read the sample, apply the inclusion rules, keep compact per-document arrays ------------------
const ex = {};                                                           // exclusions, in rule order
const bump = (k) => { ex[k] = (ex[k] ?? 0) + 1; };
const jIndex = new Map(), jIds = [];
const Gm = new Grow(Uint8Array), Gj = new Grow(Int32Array), Gfl = new Grow(Uint8Array), Gw = new Grow(Uint16Array), Gpm = new Grow(Uint16Array), Gfs = new Grow(Uint8Array);
const Gtoff = new Grow(Int32Array), Gtch = new Grow(Uint16Array), Gtlen = new Grow(Uint16Array);
const METRICS = ["avg_sentence_length", "sentence_length_variance", "comma_density", "semicolon_frequency", "pronoun_we", "word_long", "ai_tell_per1000", "em_dash_per1000", "burstiness_variation", "words"];
const Gi = METRICS.map(() => new Grow(Float32Array));
const CH = 1 << 23; const pool = [new Int32Array(CH)]; let poolPos = 0;
const vocab = new Map(), words = [];
const seenText = new Set();
const votes = new Map();                                                 // journal idx -> Float64Array(NG)
let sampleRows = 0, retractedIncluded = 0;
const revisedLate = { total: 0, late: 0 };
const manifest = existsSync(`${R}/manifest.json`) ? jread(`${R}/manifest.json`) : null;
log(`pass 1: reading ${SAMPLE}${PILOT ? " (pilot: h < " + PILOT_BELOW + ")" : ""}`);
for await (const line of lines(SAMPLE)) {
  const r = JSON.parse(line);
  if (PILOT && r.h >= PILOT_BELOW) continue;
  sampleRows++;
  const ed = r.ed, y = +ed.slice(0, 4), mo = +ed.slice(5, 7), m = mIdx(y, mo);
  if (m < 0 || m > M_LAST) { bump("outside_window"); continue; }
  if (!r.x) { bump("no_abstract"); continue; }
  if (!(r.l ?? "").split(",").includes("eng")) { bump("not_english_language_field"); continue; }
  const types = (r.t ?? "").split(";");
  if (!types.includes("Journal Article")) { bump("not_journal_article"); continue; }
  if (types.some((t) => EXCLUDED_TYPES.has(t))) { bump("excluded_publication_type"); continue; }
  const text = r.x, wl = text.split(/\s+/).filter(Boolean);
  if (wl.length < 50) { bump("under_50_words"); continue; }
  let stop = 0; for (const w of wl) if (STOP.has(w.toLowerCase().replace(/^[.,;:()\[\]"']+|[.,;:()\[\]"']+$/g, ""))) stop++;
  if (stop / wl.length < 0.05) { bump("non_english_text"); continue; }
  const dk = createHash("md5").update(text.toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16);
  if (seenText.has(dk)) { bump("duplicate_text"); continue; }
  seenText.add(dk);
  // included
  let ji = jIndex.get(r.j); if (ji === undefined) { ji = jIds.length; jIndex.set(r.j, ji); jIds.push(r.j); }
  const retracted = types.includes("Retracted Publication");
  if (retracted) retractedIncluded++;
  let fl = (retracted ? 1 : 0) | ((r.ns ?? 0) >= 2 ? 2 : 0) | (r.rv > "2022-11-30" ? 4 : 0);
  if (m <= PER.BASE[1]) { revisedLate.total++; if (r.rv > "2022-11-30") revisedLate.late++; }
  // publication-date month (sensitivity): electronic article date if present, else the journal's PubDate year (July)
  let pm = 65535;
  if (r.ad) { const pmm = mIdx(+r.ad.slice(0, 4), +r.ad.slice(5, 7)); if (pmm >= 0 && pmm <= M_LAST) pm = pmm; }
  else if (r.py >= 2015 && r.py <= 2026) { const pmm = mIdx(r.py, 7); if (pmm <= M_LAST) pm = pmm; }
  const toks = new Set(text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []);
  let fs = 0;
  for (const w of OLD) if (toks.has(w)) { fs |= 1; break; }
  for (const w of NEW) if (toks.has(w)) { fs |= 2; break; }
  for (const w of CONTROL) if (toks.has(w)) { fs |= 4; break; }
  if (poolPos + toks.size > CH) { pool.push(new Int32Array(CH)); poolPos = 0; }
  const ch = pool[pool.length - 1], start = poolPos;
  for (const w of toks) { let id = vocab.get(w); if (id === undefined) { id = words.length; vocab.set(w, id); words.push(w); } ch[poolPos++] = id; }
  Gtoff.push(start); Gtch.push(pool.length - 1); Gtlen.push(toks.size);
  const feat = measureTextFeatures(text), scan = scanCliches(text);
  const nw = wl.length, nd = (text.match(/—/g) ?? []).length;
  const iv = [feat.avg_sentence_length, feat.sentence_length_variance, feat.comma_density, feat.semicolon_frequency, feat.pronoun_distribution?.we, feat.word_length_distribution?.long, scan.per1000, (nd / nw) * 1000, scan.burstiness?.variation, nw];
  for (let k = 0; k < METRICS.length; k++) Gi[k].push(Number.isFinite(iv[k]) ? iv[k] : NaN);
  Gm.push(m); Gj.push(ji); Gfl.push(fl); Gw.push(nw); Gpm.push(pm); Gfs.push(fs);
  if (m <= PER.BASE[1] && r.m) {
    let v = votes.get(ji); if (!v) votes.set(ji, (v = new Float64Array(NG)));
    for (const name of r.m.split(";")) { const gs = meshField.get(name); if (gs) for (const g of gs) v[g] += 1 / gs.length; }
  }
  if (sampleRows % 200000 === 0) log(`  ${sampleRows} read, ${Gm.n} included`);
}
const N = Gm.n, J = jIds.length, V = words.length;
log(`pass 1 done: ${sampleRows} sampled records, ${N} included, ${J} journals, ${V} distinct words`);
if (N < 1000) throw new Error("fewer than 1,000 included abstracts: wrong sample file?");
const M = Gm.view(), JI = Gj.view(), FL = Gfl.view(), W = Gw.view(), PM = Gpm.view(), FS = Gfs.view(), TOFF = Gtoff.view(), TCH = Gtch.view(), TLEN = Gtlen.view();
const INS = Gi.map((g) => g.view());

// journal subject groups, from pre-ChatGPT MeSH votes
const jgroup = new Int8Array(J).fill(9);
const jvotes = new Float64Array(J);
for (let j = 0; j < J; j++) {
  const v = votes.get(j); if (!v) continue;
  let tot = 0, best = 0; for (let g = 0; g < NG; g++) { tot += v[g]; if (v[g] > v[best]) best = g; }
  jvotes[j] = tot;
  if (tot >= FIELDS.min_votes) jgroup[j] = v[best] / tot >= FIELDS.min_share ? best : 8;
}
const DG = new Int8Array(N); for (let i = 0; i < N; i++) DG[i] = jgroup[JI[i]];
const groupMembers = GN.map((_, g) => { const l = []; for (let j = 0; j < J; j++) if (jgroup[j] === g) l.push(j); return l; });
const jDocs = new Int32Array(J); for (let i = 0; i < N; i++) jDocs[JI[i]]++;

// ---- tables for H1-H3 and the set-share sensitivity analyses ------------------------------------------------
const COLS = 8;                                                         // per period: n, old, new, ctl, has, shOld, shNew, shCtl
function buildSetTable(sel, mArr) {
  const t = new ClusterTable(J, PK.length * COLS), a = t.a, K = t.K;
  for (let i = 0; i < N; i++) {
    if (!sel(i)) continue;
    const m = mArr[i]; if (m === 65535) continue;
    const p = perOf(m); if (p < 0) continue;
    const o = JI[i] * K + p * COLS, f = FS[i];
    a[o]++; if (f & 1) a[o + 1]++; if (f & 2) a[o + 2]++; if (f & 4) a[o + 3]++;
  }
  for (let c = 0; c < J; c++) for (let p = 0; p < PK.length; p++) {
    const o = c * K + p * COLS, n = a[o];
    if (n > 0) { a[o + 4] = 1; a[o + 5] = a[o + 1] / n; a[o + 6] = a[o + 2] / n; a[o + 7] = a[o + 3] / n; }
  }
  return t;
}
const SETN = ["old", "new", "ctl"];
const share = (S, p, x) => (S[p * COLS] > 0 ? (100 * S[p * COLS + x]) / S[p * COLS] : null);          // x = 1 old, 2 new, 3 ctl
const bshare = (S, p, x) => (S[p * COLS + 4] > 0 ? (100 * S[p * COLS + 4 + x]) / S[p * COLS + 4] : null);
const sub = (a, b) => (a == null || b == null ? null : a - b);
const rat = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
function setStats(f = share) {
  const o = {};
  SETN.forEach((nm, k) => {
    const x = k + 1, g = (S, p) => f(S, p, x);
    for (const [key, p] of [["base", 0], ["y24", 1], ["y26", 2], ["base2", 3], ["y25", 4]]) o[`${nm}.${key}`] = (S) => g(S, p);
    o[`${nm}.d24b`] = (S) => sub(g(S, 1), g(S, 0)); o[`${nm}.d2624`] = (S) => sub(g(S, 2), g(S, 1)); o[`${nm}.d26b`] = (S) => sub(g(S, 2), g(S, 0));
    o[`${nm}.r24b`] = (S) => rat(g(S, 1), g(S, 0)); o[`${nm}.r26b`] = (S) => rat(g(S, 2), g(S, 0));
  });
  return o;
}
const nest = (flat) => { const o = {}; for (const [k, v] of Object.entries(flat)) { const [nm, key] = k.split("."); (o[nm] ??= {})[key] = { point: r4(v.point), lo: r4(v.lo), hi: r4(v.hi) }; } return o; };
const counts = (t, list = null) => { const S = t.sums(list); return Object.fromEntries(PK.map((p, i) => [p, S[i * COLS]])); };
const verdictH12 = (res) => {
  const o = res.old, n = res.new;
  const h1 = o.d24b.lo > 0 && o.d2624.hi < 0, h1Rev = o.d24b.hi < 0;
  return { h1_rose: o.d24b.lo > 0, h1_fell: o.d2624.hi < 0, h1, new_up_vs_24: n.d2624.lo > 0, new_up_vs_base: n.d26b.lo > 0 };
};

log("tables for H1-H3");
const T1 = buildSetTable(() => true, M);
const stats1 = setStats();
const boot1 = T1.bootMany(stats1, B, SEED);
const main = nest(boot1);
const mainCounts = counts(T1);

// subject groups: NEW share Y2026 against BASE, point ratio and cluster interval within the group
const byGroup = GN.map((name, g) => {
  const S = T1.sums(groupMembers[g]);
  const st = { base: (S2) => share(S2, 0, 2), y26: (S2) => share(S2, 2, 2), ratio: (S2) => rat(share(S2, 2, 2), share(S2, 0, 2)), old_base: (S2) => share(S2, 0, 1), old_y24: (S2) => share(S2, 1, 1), old_y26: (S2) => share(S2, 2, 1) };
  const bt = T1.bootMany(st, Math.min(B, 1000), SEED + 100 + g, groupMembers[g]);
  return { group: name, label: FIELDS.labels[name], journals: groupMembers[g].length, n_base: S[0], n_y24: S[COLS], n_y26: S[2 * COLS], new_base: r4(bt.base.point), new_y26: r4(bt.y26.point), ratio: r3(bt.ratio.point), ratio_lo: r3(bt.ratio.lo), ratio_hi: r3(bt.ratio.hi), old_base: r4(bt.old_base.point), old_y24: r4(bt.old_y24.point), old_y26: r4(bt.old_y26.point) };
});
const named = byGroup.slice(0, NG);
const groupsRatio2 = named.filter((g) => g.ratio != null && g.ratio >= 2).length;

// monthly aggregates by subject group (set shares, words)
const MA = new Float64Array(T_M * 10 * 6);                              // month x group x [n, old, new, ctl, words, structured]
for (let i = 0; i < N; i++) { const o = (M[i] * 10 + DG[i]) * 6, f = FS[i]; MA[o]++; if (f & 1) MA[o + 1]++; if (f & 2) MA[o + 2]++; if (f & 4) MA[o + 3]++; MA[o + 4] += W[i]; if (FL[i] & 2) MA[o + 5]++; }
const monthRows = [];
for (let m = 0; m <= M_LAST; m++) for (let g = 0; g < 10; g++) { const o = (m * 10 + g) * 6; if (MA[o] > 0) monthRows.push({ ym: `${yearOf(m)}-${String((m % 12) + 1).padStart(2, "0")}`, group: GN[g], docs: MA[o], old: MA[o + 1], new: MA[o + 2], control: MA[o + 3], words: MA[o + 4], structured: MA[o + 5] }); }
const halfAgg = (h, gs = null) => { const s = [0, 0, 0, 0]; for (let m = h * 6; m < h * 6 + 6 && m <= M_LAST; m++) for (let g = 0; g < 10; g++) { if (gs && !gs.includes(g)) continue; const o = (m * 10 + g) * 6; for (let k = 0; k < 4; k++) s[k] += MA[o + k]; } return s; };
const halfRows = [];
for (let h = 0; h <= Math.floor(M_LAST / 6); h++) {
  const s = halfAgg(h);
  halfRows.push({ half: halfLabel(h), group: "all", docs: s[0], old_pct: r4((100 * s[1]) / s[0]), new_pct: r4((100 * s[2]) / s[0]), control_pct: r4((100 * s[3]) / s[0]) });
  for (let g = 0; g < NG; g++) { const sg = halfAgg(h, [g]); if (sg[0] > 0) halfRows.push({ half: halfLabel(h), group: GN[g], docs: sg[0], old_pct: r4((100 * sg[1]) / sg[0]), new_pct: r4((100 * sg[2]) / sg[0]), control_pct: r4((100 * sg[3]) / sg[0]) }); }
}
// H3: a half-year from which NEW > OLD in every later half-year, among 2025H1..2026H2
const h25 = 20, hLast = Math.floor(M_LAST / 6);
const seq = []; for (let h = h25; h <= hLast; h++) { const s = halfAgg(h); seq.push({ half: halfLabel(h), docs: s[0], old: r4((100 * s[1]) / s[0]), new: r4((100 * s[2]) / s[0]), new_above: s[2] > s[1] }); }
let cross = null; for (let i = 0; i < seq.length; i++) if (seq.slice(i).every((x) => x.new_above)) { cross = seq[i].half; break; }
const H3 = { supported: cross != null, crossover_half: cross, sequence: seq };

// ---- instruments, H4 --------------------------------------------------------------------------------------------
log("instruments");
const IP = ["BASE", "Y2024", "Y2026"], NM = METRICS.length;
const T_I = new ClusterTable(J, IP.length * NM * 2);
for (let i = 0; i < N; i++) {
  const p = perOf(M[i]); if (p < 0 || p > 2) continue;
  for (let k = 0; k < NM; k++) { const v = INS[k][i]; if (!Number.isNaN(v)) { T_I.add(JI[i], (p * NM + k) * 2, v); T_I.add(JI[i], (p * NM + k) * 2 + 1, 1); } }
}
const imean = (S, p, k) => { const c = S[(p * NM + k) * 2 + 1]; return c > 0 ? S[(p * NM + k) * 2] / c : null; };
const iStats = {};
METRICS.forEach((nm, k) => { iStats[`${nm}.base`] = (S) => imean(S, 0, k); iStats[`${nm}.y24`] = (S) => imean(S, 1, k); iStats[`${nm}.y26`] = (S) => imean(S, 2, k); iStats[`${nm}.d26b`] = (S) => sub(imean(S, 2, k), imean(S, 0, k)); });
const iBoot95 = T_I.bootMany(iStats, B, SEED + 7);
const iBoot90 = T_I.bootMany({ d: iStats["avg_sentence_length.d26b"] }, B, SEED + 8, null, { lo: 0.05, hi: 0.95 });
const H4 = { diff: r3(iBoot90.d.point), ci90: [r3(iBoot90.d.lo), r3(iBoot90.d.hi)], supported: iBoot90.d.lo != null && iBoot90.d.lo > -1 && iBoot90.d.hi < 1, base_mean: r3(iBoot95["avg_sentence_length.base"].point), y26_mean: r3(iBoot95["avg_sentence_length.y26"].point) };
const instruments = { periods: Object.fromEntries(IP.map((p, pi) => [p, Object.fromEntries(METRICS.map((nm, k) => [nm, r3(imean(T_I.sums(), pi, k))]))])), diffs_2026_minus_base: Object.fromEntries(METRICS.map((nm) => [nm, { diff: r3(iBoot95[`${nm}.d26b`].point), lo: r3(iBoot95[`${nm}.d26b`].lo), hi: r3(iBoot95[`${nm}.d26b`].hi) }])) };
// instrument means by year (pooled) and by group-year for a few
const insYear = {};
for (let i = 0; i < N; i++) { const y = yearOf(M[i]); const o = (insYear[y] ??= { n: 0, s: new Float64Array(NM), c: new Float64Array(NM) }); o.n++; for (let k = 0; k < NM; k++) { const v = INS[k][i]; if (!Number.isNaN(v)) { o.s[k] += v; o.c[k]++; } } }
const instrumentsByYear = Object.fromEntries(Object.entries(insYear).map(([y, o]) => [y, { docs: o.n, ...Object.fromEntries(METRICS.map((nm, k) => [nm, r3(o.c[k] ? o.s[k] / o.c[k] : null)])) }]));

// ---- pass 2: document frequencies by year x half (odd entry months select, even months score) -------------------------
log("pass 2: document frequencies");
const NS = 24;                                                            // slot = (year-2015)*2 + (calendar month is odd ? 1 : 0)
const slotOf = (m) => (m === M_DEC22 ? -1 : (yearOf(m) - 2015) * 2 + ((m % 12) + 1) % 2);
const df = new Int32Array(V * NS), Nslot = new Float64Array(NS);
for (let i = 0; i < N; i++) {
  const s = slotOf(M[i]); if (s < 0) continue;
  Nslot[s]++;
  const ch = pool[TCH[i]], e = TOFF[i] + TLEN[i];
  for (let k = TOFF[i]; k < e; k++) df[ch[k] * NS + s]++;
}
const SEL = 1, SCO = 0;
const slotIdx = (y, par) => (y - 2015) * 2 + par;
const pShare = (id, y, par) => { const n = Nslot[slotIdx(y, par)]; return n ? df[id * NS + slotIdx(y, par)] / n : 0; };
function exStats(id, y, par) {
  const p21 = pShare(id, 2021, par), p22 = pShare(id, 2022, par), pt = pShare(id, y, par);
  const q = p22 + Math.max(0, p22 - p21) * (y - 2022);
  return { p: pt, q, d: pt - q, r: q > 0 ? pt / q : null };
}
const isCandidate = (s) => s.p >= 0.0005 && (s.d >= 0.001 || ((s.r == null || s.r >= 2) && s.p >= 0.001));
const YEARS_T = [2023, 2024, 2025, 2026];
const cands = new Map();                                                  // word id -> { year -> {sel, sco} }
const ranked = {};                                                         // year -> ids with q < 5%, by selection gap
for (const y of YEARS_T) {
  const rows = [];
  for (let id = 0; id < V; id++) {
    if (df[id * NS + slotIdx(y, SEL)] < 5) continue;
    const s = exStats(id, y, SEL);
    if (!isCandidate(s)) continue;
    let c = cands.get(id); if (!c) cands.set(id, (c = {}));
    c[y] = { sel: s, sco: exStats(id, y, SCO) };
    if (s.q < 0.05) rows.push([id, s.d]);
  }
  rows.sort((a, b) => b[1] - a[1] || (words[a[0]] < words[b[0]] ? -1 : 1));
  ranked[y] = rows.map((r) => r[0]);
}
log(`  ${cands.size} candidate words; ranked 2024: ${ranked[2024].length}, 2026: ${ranked[2026].length}`);

// ---- labelling: content or style --------------------------------------------------------------------------------------
const toLabelIds = [...new Set([...ranked[2024].slice(0, 200), ...ranked[2026].slice(0, 200)])];
const kobakTop50_2024 = ranked[2024].slice(0, 50);
const trackIds = [...new Set([...toLabelIds, ...FROZEN.map((w) => vocab.get(w)).filter((x) => x !== undefined), ...ranked[2024].slice(0, 50), ...ranked[2026].slice(0, 50)])];
const trackIdx = new Int32Array(V).fill(-1); trackIds.forEach((id, k) => { trackIdx[id] = k; });
const GY = [2021, 2022, 2024, 2026];                                       // years for the breadth rule (selection half)
const gyIdx = new Int8Array(T_M).fill(-1); for (let m = 0; m <= M_LAST; m++) { if (m === M_DEC22) continue; const k = GY.indexOf(yearOf(m)); if (k >= 0 && ((m % 12) + 1) % 2 === 1) gyIdx[m] = k; }
const TY = 12;
const yearCnt = new Float64Array(trackIds.length * TY), Nyear = new Float64Array(TY);
const grpCnt = new Float64Array(trackIds.length * NG * GY.length), Ngrp = new Float64Array(NG * GY.length);
for (let i = 0; i < N; i++) {
  const m = M[i], yi = yearOf(m) - 2015, gi = gyIdx[m], g = DG[i];
  Nyear[yi]++; if (gi >= 0 && g < NG) Ngrp[g * GY.length + gi]++;
  const ch = pool[TCH[i]], e = TOFF[i] + TLEN[i];
  for (let k = TOFF[i]; k < e; k++) { const t = trackIdx[ch[k]]; if (t < 0) continue; yearCnt[t * TY + yi]++; if (gi >= 0 && g < NG) grpCnt[(t * NG + g) * GY.length + gi]++; }
}
function breadth(id, y) {
  const t = trackIdx[id], yk = GY.indexOf(y); let meas = 0, hit = 0;
  for (let g = 0; g < NG; g++) {
    const n = (k) => Ngrp[g * GY.length + k], c = (k) => grpCnt[(t * NG + g) * GY.length + k];
    const pt = c(yk) / n(yk); if (!(pt >= 0.0003)) continue;
    meas++;
    const p21 = c(0) / n(0), p22 = c(1) / n(1), q = Math.max(p22 + Math.max(0, p22 - p21) * (y - 2022), 0.0001);
    if (pt / q >= 1.5) hit++;
  }
  return { measurable: meas, hits: hit, style: meas >= 5 && hit / meas >= 0.8 };
}
function labelRules13(w) {
  if (kobak.has(w)) return { label: kobak.get(w) === "style" ? "STYLE" : "CONTENT", source: "kobak" };
  if (LABELS8[w]) return { label: LABELS8[w], source: "sgr008" };
  if (AI_TOPIC.test(w)) return { label: "CONTENT", source: "ai_topic" };
  return null;
}
function labelFor(id, y) {
  const w = words[id], l = labelRules13(w);
  if (l) return l;
  const b = breadth(id, y);
  return { label: b.style ? "STYLE" : "CONTENT", source: "breadth", measurable: b.measurable, hits: b.hits };
}
const labelTable = new Map();                                              // `${id}|${year}` -> label
const topStyle = (y, mode = "full") => {
  const out = [];
  for (const id of ranked[y].slice(0, 200)) {
    if (out.length >= 50) break;
    let l;
    if (mode === "full") l = labelFor(id, y);
    else if (mode === "breadth") { const b = breadth(id, y); l = { label: b.style ? "STYLE" : "CONTENT", source: "breadth" }; }
    else l = labelRules13(words[id]);                                        // "published": words without a published label are dropped
    if (l && l.label === "STYLE") out.push(id);
  }
  return out;
};
for (const y of [2024, 2026]) for (const id of ranked[y].slice(0, 200)) labelTable.set(`${id}|${y}`, labelFor(id, y));
const S24 = topStyle(2024), S26 = topStyle(2026);
const S24b = topStyle(2024, "breadth"), S26b = topStyle(2026, "breadth"), S24r = topStyle(2024, "published"), S26r = topStyle(2026, "published");
const jac = (a, b) => { const A = new Set(a), Bs = new Set(b); const i = [...A].filter((x) => Bs.has(x)).length; return { jaccard: A.size + Bs.size - i ? i / (A.size + Bs.size - i) : null, overlap: [...A].filter((x) => Bs.has(x)).map((x) => words[x]).sort() }; };
const j5 = jac(S24, S26);
const H5 = { supported: j5.jaccard != null && j5.jaccard < 0.5, jaccard: r3(j5.jaccard), overlap: j5.overlap, n2024: S24.length, n2026: S26.length };
const j5b = jac(S24b, S26b), j5r = jac(S24r, S26r);
const H5_sens = { breadth_only: { jaccard: r3(j5b.jaccard), n: [S24b.length, S26b.length] }, published_only: { jaccard: r3(j5r.jaccard), n: [S24r.length, S26r.length] } };
// H6: our raw top 50 by selection gap in 2024 against Kobak's published list
const h6in = kobakTop50_2024.filter((id) => kobak.has(words[id])).length;
const H6 = { supported: h6in >= 30, in_kobak_list: h6in, of: kobakTop50_2024.length, words: kobakTop50_2024.map((id) => ({ word: words[id], in_kobak: kobak.has(words[id]), kobak_type: kobak.get(words[id]) ?? null })), kobak_style_share_of_those_in_list: r3(kobakTop50_2024.filter((id) => kobak.get(words[id]) === "style").length / Math.max(1, h6in)) };

// ---- placebo selection (B): re-run the selection on 2019 and 2021, trend from 2016-17 ---------------------------------------------
const placeboSets = {};
for (const y of [2019, 2021]) {
  const rows = [];
  const st = (id, par) => { const p16 = pShare(id, 2016, par), p17 = pShare(id, 2017, par), pt = pShare(id, y, par); const q = p17 + Math.max(0, p17 - p16) * (y - 2017); return { p: pt, q, d: pt - q, r: q > 0 ? pt / q : null }; };
  for (let id = 0; id < V; id++) {
    if (df[id * NS + slotIdx(y, SEL)] < 5) continue;
    const s = st(id, SEL);
    if (!isCandidate(s) || s.q >= 0.05) continue;
    const l = labelRules13(words[id]); if (l && l.label === "CONTENT") continue;
    rows.push([id, s.d]);
  }
  rows.sort((a, b) => b[1] - a[1] || (words[a[0]] < words[b[0]] ? -1 : 1));
  placeboSets[y] = rows.slice(0, 50).map((r) => r[0]);
}

// ---- pass 3: lower bounds (even entry months, 2015..2026), clusters = journals --------------------------------------------------
log("pass 3: bounds");
const SETLIST = [S24, S26, S24b, S26b, S24r, S26r, placeboSets[2019], placeboSets[2021]];
const maskArr = new Uint16Array(V); SETLIST.forEach((ids, b) => { for (const id of ids) maskArr[id] |= 1 << b; });
const BC = 12;                                                             // per year: n, 8 set counts, 3 unions
const T_B = new ClusterTable(J, 12 * BC), ba = T_B.a, BK = T_B.K;
for (let i = 0; i < N; i++) {
  const m = M[i]; if (((m % 12) + 1) % 2 !== 0 || m === M_DEC22) continue;
  const o = JI[i] * BK + (yearOf(m) - 2015) * BC, ch = pool[TCH[i]], e = TOFF[i] + TLEN[i];
  let mk = 0; for (let k = TOFF[i]; k < e; k++) mk |= maskArr[ch[k]];
  ba[o]++;
  for (let b = 0; b < 8; b++) if (mk & (1 << b)) ba[o + 1 + b]++;
  if (mk & 3) ba[o + 9]++; if (mk & 12) ba[o + 10]++; if (mk & 48) ba[o + 11]++;
}
const COLSET = { set2024: 1, set2026: 2, union: 9, set2024_breadth: 3, set2026_breadth: 4, union_breadth: 10, set2024_published: 5, set2026_published: 6, union_published: 11, placebo_B_2019: 7, placebo_B_2021: 8 };
function boundStat(col, t, a = 2021, b = 2022) {
  return (S) => {
    const sh = (y) => { const o = (y - 2015) * BC; return S[o] > 0 ? S[o + col] / S[o] : null; };
    const pa = sh(a), pb = sh(b), pt = sh(t); if (pa == null || pb == null || pt == null) return null;
    const q = pb + Math.max(0, pb - pa) * (t - b);
    return q < 1 ? (100 * (pt - q)) / (1 - q) : null;
  };
}
const bStats = {};
for (const [nm, col] of Object.entries(COLSET)) {
  if (nm.startsWith("placebo_B")) { const t = +nm.slice(-4); bStats[`${nm}`] = boundStat(col, t, 2016, 2017); continue; }
  for (const t of [2023, 2024, 2025, 2026]) bStats[`${nm}.${t}`] = boundStat(col, t);
}
for (const nm of ["set2024", "set2026"]) for (const t of [2018, 2019, 2020, 2021]) bStats[`placebo_A_${nm}.${t}`] = boundStat(COLSET[nm], t, 2016, 2017);
const bBoot = T_B.bootMany(bStats, B, SEED + 20);
const pkg = (x) => ({ pct: r2(x.point), lo: r2(x.lo), hi: r2(x.hi), too_uncertain: x.lo != null && x.hi - x.lo > 40 });
const bounds = {};
for (const nm of Object.keys(COLSET)) if (!nm.startsWith("placebo_B")) bounds[nm] = Object.fromEntries([2023, 2024, 2025, 2026].map((t) => [t, pkg(bBoot[`${nm}.${t}`])]));
const placebo = { A_actual_sets: {}, B_reselected: {} };
for (const nm of ["set2024", "set2026"]) placebo.A_actual_sets[nm] = Object.fromEntries([2018, 2019, 2020, 2021].map((t) => [t, { real_year_equivalent: t + 5, ...pkg(bBoot[`placebo_A_${nm}.${t}`]) }]));
for (const y of [2019, 2021]) placebo.B_reselected[y] = { real_year_equivalent: y + 5, words: placeboSets[y].map((id) => words[id]).sort(), ...pkg(bBoot[`placebo_B_${y}`]) };
// by group (union set), clusters within the group
const boundsByGroup = {};
for (let g = 0; g < NG; g++) {
  const st = { b2024: boundStat(COLSET.union, 2024), b2026: boundStat(COLSET.union, 2026) };
  const bt = T_B.bootMany(st, Math.min(B, 1000), SEED + 200 + g, groupMembers[g]);
  boundsByGroup[GN[g]] = { label: FIELDS.labels[GN[g]], 2024: pkg(bt.b2024), 2026: pkg(bt.b2026) };
}
const C1pt = bounds.set2024[2024].pct, C1 = { supported: bounds.set2024[2024].lo != null && bounds.set2024[2024].lo > 0 && C1pt >= 6.75 && C1pt <= 27, bound_pct: C1pt, lo: bounds.set2024[2024].lo, hi: bounds.set2024[2024].hi, kobak_pct: 13.5, window: [6.75, 27] };

// ---- C2: the sample against Kobak et al.'s full-corpus counts -----------------------------------------------------------------------
const c2rows = []; let c2n = 0, c2ok = 0; const c2ratios = [];
for (const w of FROZEN) {
  const id = vocab.get(w), k = kobakYearly.get(w); if (!k) continue;
  for (let y = 2015; y <= 2024; y++) {
    const kc = k[y - 2010]; if (kc < 1000) continue;
    const t = id === undefined ? -1 : trackIdx[id];
    const ours = t >= 0 ? yearCnt[t * TY + (y - 2015)] / Nyear[y - 2015] : 0, theirs = kc / kobakTotal[y - 2010];
    const ratio = ours / theirs; c2n++; c2ratios.push(ratio); const ok = ratio >= 0.8 && ratio <= 1.4; if (ok) c2ok++;
    c2rows.push({ word: w, year: y, ours_pct: r4(100 * ours), kobak_pct: r4(100 * theirs), ratio: r3(ratio), within: ok });
  }
}
c2ratios.sort((a, b) => a - b);
const C2 = { supported: c2n > 0 && c2ok / c2n >= 0.8, word_years: c2n, within_window: c2ok, share_within: r3(c2n ? c2ok / c2n : null), median_ratio: r3(c2ratios[Math.floor(c2ratios.length / 2)]), window: [0.8, 1.4], rows: c2rows };

// ---- sensitivity analyses ---------------------------------------------------------------------------------------------------------------
log("sensitivity analyses");
const sensKeys = ["old.d24b", "old.d2624", "new.d2624", "new.d26b", "new.r26b", "old.r24b"];
const sensOf = (t, f = share) => { const st = setStats(f); const pick = Object.fromEntries(sensKeys.map((k) => [k, st[k]])); Object.assign(pick, Object.fromEntries(["old.base", "old.y24", "old.y26", "new.base", "new.y24", "new.y26"].map((k) => [k, st[k]]))); const bt = t.bootMany(pick, Math.min(B, 1000), SEED + 300); const n = nest(bt); return { n: counts(t), ...n }; };
const jBase = new Int32Array(J), jY26 = new Int32Array(J);
for (let i = 0; i < N; i++) { const p = perOf(M[i]); if (p === 0) jBase[JI[i]]++; else if (p === 2) jY26[JI[i]]++; }
const sensitivity = {
  publication_date: sensOf(buildSetTable(() => true, PM)),
  retracted_dropped: sensOf(buildSetTable((i) => !(FL[i] & 1), M)),
  structured_only: sensOf(buildSetTable((i) => !!(FL[i] & 2), M)),
  unstructured_only: sensOf(buildSetTable((i) => !(FL[i] & 2), M)),
  same_journals_30_each: sensOf(buildSetTable((i) => jBase[JI[i]] >= 30 && jY26[JI[i]] >= 30, M)),
  journals_weighted_equally: sensOf(buildSetTable(() => true, M), bshare),
  baseline_2018_2019: { note: "BASE2 column: 2018-01 to 2019-12", old_base2: main.old.base2, new_base2: main.new.base2, control_base2: main.ctl.base2 },
};
sensitivity.same_journals_30_each.journals = jBase.reduce((a, v, j) => a + (v >= 30 && jY26[j] >= 30 ? 1 : 0), 0);
sensitivity.revised_after_nov_2022 = { baseline_period_records: revisedLate.total, last_revised_after_2022_11_30: revisedLate.late, share_pct: r2(revisedLate.total ? (100 * revisedLate.late) / revisedLate.total : null) };

// ---- composition ----------------------------------------------------------------------------------------------------------------------------
const compo = {};
{
  const per = {}; for (let i = 0; i < N; i++) { const y = yearOf(M[i]); (per[y] ??= { docs: 0, structured: 0, retracted: 0 }); per[y].docs++; if (FL[i] & 2) per[y].structured++; if (FL[i] & 1) per[y].retracted++; }
  const top20 = [...Array(J).keys()].sort((a, b) => jDocs[b] - jDocs[a]).slice(0, 20);
  const isTop = new Uint8Array(J); for (const j of top20) isTop[j] = 1;
  const topN = {}; for (let i = 0; i < N; i++) if (isTop[JI[i]]) topN[yearOf(M[i])] = (topN[yearOf(M[i])] ?? 0) + 1;
  for (const [y, o] of Object.entries(per)) compo[y] = { docs: o.docs, structured_pct: r2((100 * o.structured) / o.docs), retracted_pct: r3((100 * o.retracted) / o.docs), largest_20_journals_pct: r2((100 * (topN[y] ?? 0)) / o.docs) };
}

// ---- assemble outputs -------------------------------------------------------------------------------------------------------------------------
const H1 = { supported: main.old.d24b.lo > 0 && main.old.d2624.hi < 0, rose_vs_base: main.old.d24b, fell_vs_2024: main.old.d2624 };
const H2 = { supported: main.new.d2624.lo > 0 && main.new.d26b.lo > 0 && groupsRatio2 >= 6, new_vs_2024: main.new.d2624, new_vs_base: main.new.d26b, groups_with_ratio_at_least_2: groupsRatio2, groups_counted: NG };
const nSup = [H1, H2, H3].filter((h) => h.supported).length;
const replication = nSup === 3 ? "replicates" : nSup > 0 ? "partly replicates" : "does not replicate";
const word = (w) => {
  const id = vocab.get(w), t = id === undefined ? -1 : trackIdx[id];
  const by = {}; for (let y = 2015; y <= 2026; y++) by[y] = t >= 0 ? r4((100 * yearCnt[t * TY + (y - 2015)]) / Nyear[y - 2015]) : 0;
  return by;
};
const wordsFrozen = Object.fromEntries(FROZEN.map((w) => [w, word(w)]));

const summary = {
  study: "SGR-024", pilot: PILOT, generated: new Date().toISOString(), seed: SEED, bootstrap_resamples: B,
  sample: { file: PILOT ? "pilot (h < 4000)" : "sample.jsonl.gz", records_in_sample_file: sampleRows, included: N, journals: J, distinct_words: V, manifest },
  exclusions: ex, retracted_papers_included: retractedIncluded,
  periods: { BASE: "2020-01..2022-11", Y2024: "2024-01..2024-12", Y2026: "2026-01..2026-09", BASE2: "2018-01..2019-12", Y2025: "2025-01..2025-12" },
  n_by_period: mainCounts,
  sets: { OLD, NEW, CONTROL },
  main_shares: main,
  hypotheses: { H1, H2, H3, H4, H5, H6 },
  checks: { C1, C2: { ...C2, rows: undefined } },
  replication_verdict: replication,
  by_group: byGroup,
  half_year_all: halfRows.filter((r) => r.group === "all"),
  excess: { style_2024: S24.map((id) => words[id]), style_2026: S26.map((id) => words[id]), raw_top50_2024: kobakTop50_2024.map((id) => words[id]), labelled_words: toLabelIds.length, label_sources: Object.fromEntries(["kobak", "sgr008", "ai_topic", "breadth"].map((s) => [s, [...labelTable.values()].filter((l) => l.source === s).length])), h5_sensitivity: H5_sens, sets_sensitivity: { style_2024_breadth: S24b.map((id) => words[id]), style_2026_breadth: S26b.map((id) => words[id]), style_2024_published: S24r.map((id) => words[id]), style_2026_published: S26r.map((id) => words[id]) } },
  bounds, bounds_by_group_union: boundsByGroup, placebo,
  instruments, instruments_by_year: instrumentsByYear,
  frozen_word_share_pct_by_year: wordsFrozen,
  sensitivity, composition_by_year: compo,
  sgr008_reference: REF8,
  groups: Object.fromEntries(GN.map((g, k) => [g, { label: FIELDS.labels[g], journals: groupMembers[k].length, docs: [...Array(N).keys()].length ? undefined : 0 }])),
};
{ const gd = new Float64Array(10); for (let i = 0; i < N; i++) gd[DG[i]]++; GN.forEach((g, k) => { summary.groups[g].docs = gd[k]; }); }
if (existsSync(`${R}/verify.json`)) summary.efetch_check = jread(`${R}/verify.json`);

// ---- CSVs -----------------------------------------------------------------------------------------------------------------------------------------
const label24 = (id) => labelTable.get(`${id}|2024`), label26 = (id) => labelTable.get(`${id}|2026`);
const wordRows = [];
const trackedForCsv = [...new Set([...toLabelIds, ...FROZEN.map((w) => vocab.get(w)).filter((x) => x !== undefined)])];
for (const id of trackedForCsv) {
  const t = trackIdx[id], inSet = OLD.includes(words[id]) ? "OLD" : NEW.includes(words[id]) ? "NEW" : CONTROL.includes(words[id]) ? "CONTROL" : "";
  for (let y = 2015; y <= 2026; y++) wordRows.push({ word: words[id], year: y, docs_with_word: yearCnt[t * TY + (y - 2015)], share_pct: r4((100 * yearCnt[t * TY + (y - 2015)]) / Nyear[y - 2015]), frozen_set: inSet, label_2024: label24(id)?.label ?? "", label_2024_source: label24(id)?.source ?? "", label_2026: label26(id)?.label ?? "", label_2026_source: label26(id)?.source ?? "", in_kobak_list: kobak.has(words[id]) ? 1 : 0 });
}
const exRows = [];
for (const [id, c] of cands) for (const y of YEARS_T) if (c[y]) exRows.push({ word: words[id], year: y, sel_p: r6(c[y].sel.p), sel_q: r6(c[y].sel.q), sel_d: r6(c[y].sel.d), sel_r: r3(c[y].sel.r), sco_p: r6(c[y].sco.p), sco_q: r6(c[y].sco.q), sco_d: r6(c[y].sco.d), sco_r: r3(c[y].sco.r), rank_by_gap_q_under_5pct: ranked[y].indexOf(id) + 1 || "", label: (y === 2024 ? label24(id) : y === 2026 ? label26(id) : null)?.label ?? "", label_source: (y === 2024 ? label24(id) : y === 2026 ? label26(id) : null)?.source ?? "" });
exRows.sort((a, b) => a.year - b.year || a.word.localeCompare(b.word));
const yearGroupRows = [];
{
  const A = new Float64Array(12 * 10 * 4);
  for (let i = 0; i < N; i++) { const o = ((yearOf(M[i]) - 2015) * 10 + DG[i]) * 4, f = FS[i]; A[o]++; if (f & 1) A[o + 1]++; if (f & 2) A[o + 2]++; if (f & 4) A[o + 3]++; }
  for (let y = 0; y < 12; y++) for (let g = 0; g < 10; g++) { const o = (y * 10 + g) * 4; if (A[o] > 0) yearGroupRows.push({ year: 2015 + y, group: GN[g], docs: A[o], old_pct: r4((100 * A[o + 1]) / A[o]), new_pct: r4((100 * A[o + 2]) / A[o]), control_pct: r4((100 * A[o + 3]) / A[o]) }); }
}
const journalRows = [...Array(J).keys()].map((j) => ({ nlm_unique_id: jIds[j], group: GN[jgroup[j]], records_in_sample: jDocs[j], mesh_votes_before_chatgpt: r2(jvotes[j]) })).sort((a, b) => b.records_in_sample - a.records_in_sample || (a.nlm_unique_id < b.nlm_unique_id ? -1 : 1));

writeFileSync(`${OUT}/sgr-024-half-year.csv`, csv(halfRows, ["half", "group", "docs", "old_pct", "new_pct", "control_pct"]));
writeFileSync(`${OUT}/sgr-024-monthly.csv`, csv(monthRows, ["ym", "group", "docs", "old", "new", "control", "words", "structured"]));
writeFileSync(`${OUT}/sgr-024-year-by-group.csv`, csv(yearGroupRows, ["year", "group", "docs", "old_pct", "new_pct", "control_pct"]));
writeFileSync(`${OUT}/sgr-024-words-by-year.csv`, csv(wordRows, ["word", "year", "docs_with_word", "share_pct", "frozen_set", "label_2024", "label_2024_source", "label_2026", "label_2026_source", "in_kobak_list"]));
writeFileSync(`${OUT}/sgr-024-excess-words.csv`, csv(exRows, ["word", "year", "sel_p", "sel_q", "sel_d", "sel_r", "sco_p", "sco_q", "sco_d", "sco_r", "rank_by_gap_q_under_5pct", "label", "label_source"]));
writeFileSync(`${OUT}/sgr-024-journal-groups.csv`, csv(journalRows, ["nlm_unique_id", "group", "records_in_sample", "mesh_votes_before_chatgpt"]));
writeFileSync(`${OUT}/sgr-024-sampling-check.csv`, csv(c2rows, ["word", "year", "ours_pct", "kobak_pct", "ratio", "within"]));
writeFileSync(`${OUT}/sgr-024-two-word-sets.svg`, halfYearChart(halfRows.filter((r) => r.group === "all"), REF8));
writeFileSync(`${OUT}/sgr-024-lower-bounds.svg`, boundsChart(bounds, placebo));
summary.runtime_seconds = Math.round((Date.now() - t0) / 1000);
writeFileSync(`${OUT}/sgr-024-summary.json`, JSON.stringify(summary, null, 1));
log(`done in ${summary.runtime_seconds} s -> ${OUT}; replication verdict: ${replication}`);
