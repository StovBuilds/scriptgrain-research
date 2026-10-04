#!/usr/bin/env bun
// SGR-006 harvest: books (Project Gutenberg by genre and era), the web of 2021
// (Common Crawl, SGR-007's frozen sources and order) and arXiv abstracts (SGR-008
// census, read-only). Numbers only; text is measured and dropped.
//
//   bun scripts/experiments/sgr-006/harvest.mjs --part books --catalog pg_catalog.csv --cache <dir> --out books.jsonl
//   bun scripts/experiments/sgr-006/harvest.mjs --part web --cluster cluster.idx --out web.jsonl
//   bun scripts/experiments/sgr-006/harvest.mjs --part arxiv --census ~/research/sgr-008 --out arxiv.jsonl
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, createReadStream } from "node:fs";
import { gunzipSync, createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { features, words } from "./features.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const PART = opt("--part"), OUT = opt("--out");
// Refuse to append to an existing file: on 2026-10-04 two concurrent runs wrote
// into one books file and produced mislabelled rows. One run, one fresh file.
if (existsSync(OUT)) { console.error(`${OUT} exists; refusing to append (remove it first)`); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, seed) => { const r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

if (PART === "books") {
  const B = CFG.books, CACHE = opt("--cache");
  mkdirSync(CACHE, { recursive: true });
  const parseCsv = (text) => { const out = []; let row = [], f = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c; } const [h, ...rest] = out; return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""]))); };
  const books = parseCsv(readFileSync(opt("--catalog"), "utf8")).filter((r) => r.Type === "Text" && r.Language === "en" && !B.exclude_subject.some((x) => r.Subjects.includes(x)));
  const match = (r, c) => { const s = r.Subjects, l = r.LoCC.split("; ").filter(Boolean); if (c.subject_any && !c.subject_any.some((x) => s.includes(x))) return false; if (c.subject_none && c.subject_none.some((x) => s.includes(x))) return false; if (c.locc_prefix && !l.some((x) => c.locc_prefix.some((p) => x.startsWith(p)))) return false; return true; };
  const era = (r) => { const m = r.Authors.match(/(\d{4})\??-\d{4}/); if (!m) return null; const y = +m[1] + 40; return Object.entries(B.eras).find(([, [a, b]]) => y >= a && y <= b)?.[0] ?? null; };
  const body = async (id) => {
    const f = `${CACHE}/${id}.txt`;
    if (!existsSync(f)) { for (let i = 0; i < 4; i++) { try { const r = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, { headers: { "User-Agent": "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research; SGR-006)" }, signal: AbortSignal.timeout(60000) }); writeFileSync(f, r.ok ? await r.text() : ""); break; } catch { await sleep(3000 * (i + 1)); } } await sleep(1000); }
    let t = readFileSync(f, "utf8").replace(/\r/g, ""); const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/); if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined); return t;
  };
  for (const [genre, rule] of Object.entries(B.genres)) for (const e of Object.keys(B.eras)) {
    const pool = shuffle(books.filter((r) => match(r, rule) && era(r) === e), CFG.seed);
    if (pool.length < B.per_cell) { log(`${genre} ${e}: only ${pool.length} books, cell dropped`); continue; }
    let got = 0;
    for (const r of pool) {
      if (got >= B.per_cell) break;
      const paras = (await body(r["Text#"])).split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => words(p) > 12 && !/^(CHAPTER|BOOK|VOLUME|PART|SECTION|LETTER|ACT|SCENE|[IVXLC]+\.)\b/i.test(p));
      const total = paras.reduce((s, p) => s + words(p), 0);
      if (total < B.min_body_words) continue;
      B.positions.forEach((pos, k) => {
        let acc = 0, i = 0; while (i < paras.length && acc < total * pos) acc += words(paras[i++]);
        const piece = []; let w = 0; while (i < paras.length && w < B.piece_words) { piece.push(paras[i]); w += words(paras[i++]); }
        appendFileSync(OUT, JSON.stringify({ group: genre, era: e, source: "gutenberg", id: r["Text#"], piece: k, ...features(piece.join("\n\n")) }) + "\n");
      });
      got++;
    }
    log(`${genre} ${e}: ${got} books`);
  }
}

if (PART === "web") {
  const { loadCluster, capturesFor, fetchRecord } = await import("../sgr-007/cc-index.mjs");
  const { htmlToText } = await import("../../../supabase/functions/_shared/html-text.ts");
  const S7 = JSON.parse(readFileSync(new URL("../sgr-007/sources.json", import.meta.url), "utf8"));
  const EXCL = new RegExp(S7.exclude_url_patterns.join("|"), "i");
  const cluster = loadCluster(opt("--cluster"));
  const jobs = Object.entries(CFG.web.groups).flatMap(([g, ps]) => ps.map((p) => ({ g, p })));
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (jobs.length) {
      const { g, p } = jobs.shift();
      const caps = await capturesFor(CFG.web.collection, cluster, p, { maxBlocks: 80 });
      const seen = new Set();
      // SGR-007's filter and seeded order, unchanged.
      const pool = shuffle(caps.filter((r) => r.status === "200" && (r.mime === "text/html" || r["mime-detected"] === "text/html") && (!r.languages || r.languages.startsWith("eng")) && !EXCL.test(r.url) && !seen.has(r.url) && seen.add(r.url)), S7.seed);
      let got = 0;
      for (const r of pool) {
        if (got >= CFG.web.pages_per_source) break;
        const page = htmlToText((await fetchRecord(r)) || "");
        if (page.words < CFG.web.min_words) continue;
        appendFileSync(OUT, JSON.stringify({ group: g, era: "2021 web", source: p, id: r.url, captured: r.timestamp, ...features(page.text) }) + "\n");
        got++;
      }
      log(`${p}: ${got}`);
    }
  }));
}

if (PART === "arxiv") {
  const DIR = opt("--census");
  const clean = (s) => s.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " X ").replace(/\\(?:cite|ref|label)\{[^}]*\}/g, " ").replace(/\\[a-zA-Z]+\*?(\{[^}]*\})?/g, (m, g) => (g ? g.slice(1, -1) : " ")).replace(/---/g, "—").replace(/--/g, "–").replace(/[{}~]/g, " ").replace(/\s+/g, " ").trim();
  const eligible = [];
  const rl = createInterface({ input: createReadStream(`${DIR}/census-papers.jsonl.gz`).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) { if (!line) continue; const p = JSON.parse(line); if (p.base_ok && p.ym >= "2015-01" && p.ym <= "2022-11") eligible.push({ id: p.id, ym: p.ym }); }
  const want = new Map(shuffle(eligible, CFG.seed).slice(0, CFG.arxiv.n).map((p) => [p.id, p]));
  const text = new Map();
  for (const f of readdirSync(`${DIR}/census`).filter((f) => /^part-.*\.jsonl\.gz$/.test(f)).sort()) {
    for (const l of gunzipSync(readFileSync(`${DIR}/census/${f}`)).toString("utf8").split("\n")) { if (!l) continue; const rec = JSON.parse(l); if (want.has(rec.id) && !text.has(rec.id)) text.set(rec.id, rec.abstract); }
    if (text.size === want.size) break;
  }
  for (const [id, p] of want) { const t = clean(text.get(id) || ""); if (words(t) >= 50) appendFileSync(OUT, JSON.stringify({ group: "arxiv", era: "2015-2022", source: "arxiv", id, captured: p.ym, ...features(t) }) + "\n"); }
  log(`arxiv: ${text.size} of ${want.size}`);
}
