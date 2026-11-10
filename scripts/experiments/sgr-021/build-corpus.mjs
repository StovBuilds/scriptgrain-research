#!/usr/bin/env bun
// SGR-021: build the panel by the frozen rules in docs/research/sgr-021-preregistration.md
// and download the book texts it needs (nothing is measured here; words are counted
// only to apply the 15,000-word rule).
//
//   bun scripts/experiments/sgr-021/build-corpus.mjs --data ~/research/sgr-021-classic [--limit-authors N] [--no-fetch]
//
// Inputs: --data/pg_catalog.csv (sha256 checked) and wd-authors.json beside this file (saved Wikidata result of wd-authors.rq).
// Outputs: texts/<id>.txt.gz (Gutenberg files, never committed), fetch-log.jsonl, and
// scripts/experiments/sgr-021/panel.json (committed: author and book ids, no text).
// Resumable: cached texts are not fetched again. Politeness: one request per 1.1 s.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { CFG, parseCsv, shuffle, sha256, cleanBook, readGz, midlifeCentury } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DATA = opt("--data", null), LIMIT = opt("--limit-authors", null), NOFETCH = args.includes("--no-fetch");
if (!DATA) throw new Error("--data required");
mkdirSync(`${DATA}/texts`, { recursive: true });
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const catBuf = readFileSync(`${DATA}/${CFG.catalogue.file}`);
if (sha256(catBuf) !== CFG.catalogue.sha256) throw new Error("catalogue does not match the frozen sha256");
const rows = parseCsv(catBuf.toString("utf8")).filter((r) => r.Type === "Text" && r.Language === CFG.works.language);

// Wikidata: English-language authors with a Project Gutenberg author ID, birth and death dates.
const people = new Map();
for (const r of JSON.parse(readFileSync(new URL("./wd-authors.json", import.meta.url), "utf8")).rows) people.set(`${r.q}:${r.born}:${r.died}`, { q: r.q, label: r.label, born: r.born, died: r.died });
const byYears = new Map();
for (const p of people.values()) { const k = `${p.born}-${p.died}`; if (!byYears.has(k)) byYears.set(k, []); byYears.get(k).push(p); }

// Catalogue works by one author "Surname, Forenames, 1812-1870" matching exactly one Wikidata
// person with the same birth and death years whose label contains the surname.
const BAD = new RegExp(CFG.works.exclude_subject_or_title, "i");
const FICTION = new RegExp(CFG.works.fiction_subject, "i");
const norm = (t) => t.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim().slice(0, 60);
const authors = new Map();
const drop = { no_wikidata_match: 0, excluded_work: 0, duplicate_title: 0, outside_midlife: 0 };
for (const r of rows) {
  if (r.Authors.includes(";")) continue;
  const m = r.Authors.match(/^([^;]*?), ([^,;]+), (\d{4})-(\d{4})$/) || r.Authors.match(/^([^;]*?), (\d{4})-(\d{4})$/);
  if (!m) continue;
  const sur = m[1].trim().toLowerCase(), c = (byYears.get(`${m.at(-2)}-${m.at(-1)}`) ?? []).filter((p) => p.label.toLowerCase().includes(sur));
  if (c.length !== 1) { drop.no_wikidata_match++; continue; }
  const p = c[0], mid = p.born + 40;
  if (mid < CFG.authors.midlife_from || mid > CFG.authors.midlife_to) { drop.outside_midlife++; continue; }
  if (BAD.test(r.Subjects) || BAD.test(r.Title)) { drop.excluded_work++; continue; }
  if (!authors.has(r.Authors)) authors.set(r.Authors, { ...p, pgName: r.Authors, cands: [] });
  authors.get(r.Authors).cands.push(r);
}
// Duplicate editions: one work per normalised title, lowest Gutenberg number.
for (const a of authors.values()) {
  a.cands.sort((x, y) => +x["Text#"] - +y["Text#"]);
  const seen = new Set();
  a.cands = a.cands.filter((r) => { const k = norm(r.Title.split("\n")[0]); if (seen.has(k)) { drop.duplicate_title++; return false; } seen.add(k); return true; });
}
let order = [...authors.values()].filter((a) => a.cands.length >= CFG.authors.min_works).sort((a, b) => a.q.localeCompare(b.q));
order = shuffle(order, CFG.seed);
const nAll = order.length;
if (LIMIT) order = order.slice(0, +LIMIT);
log(`${nAll} authors have at least ${CFG.authors.min_works} eligible catalogue works; processing ${order.length}`);

let nextSlot = 0; // global limiter: one request per min_interval_ms across all workers
const acquire = async () => { const t = Math.max(nextSlot, Date.now()); nextSlot = t + CFG.fetch.min_interval_ms; if (t > Date.now()) await sleep(t - Date.now()); };
const coolUntil = new Map(); // host -> ms: skip a host for a minute after it fails
async function raw(id) {
  const f = `${DATA}/texts/${id}.txt.gz`;
  if (existsSync(f)) return readGz(f);
  if (NOFETCH) return null;
  // Primary: gutenberg.org. Fallback when it is down (504s on 2026-10-11): the pglaf mirror, whose
  // file name varies by book (id-0.txt is UTF-8, id.txt is ASCII, id-8.txt is Latin-1).
  const dir = id.length > 1 ? id.slice(0, -1).split("").join("/") + "/" + id : "0/" + id;
  const urls = [`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, `https://gutenberg.pglaf.org/${dir}/${id}-0.txt`, `https://gutenberg.pglaf.org/${dir}/${id}.txt`, `https://gutenberg.pglaf.org/${dir}/${id}-8.txt`];
  for (let i = 0; i < 3; i++) {
    let allNotFound = true;
    for (const u of urls) {
      const host = new URL(u).host, mirror = host !== "www.gutenberg.org";
      if ((coolUntil.get(host) ?? 0) > Date.now() && urls.some((x) => (coolUntil.get(new URL(x).host) ?? 0) <= Date.now())) continue;
      await acquire();
      try {
        const r = await fetch(u, { headers: { "User-Agent": CFG.fetch.user_agent }, signal: AbortSignal.timeout(60000) });
        if (r.ok) {
          const t = await r.text(); writeFileSync(f, gzipSync(t));
          appendFileSync(`${DATA}/fetch-log.jsonl`, JSON.stringify({ id, status: 200, host: new URL(u).host, bytes: t.length }) + "\n");
          return t;
        }
        if (r.status !== 404) { allNotFound = false; if (!mirror) coolUntil.set(host, Date.now() + 60000); }
      } catch { allNotFound = false; coolUntil.set(host, Date.now() + 60000); }
    }
    if (allNotFound) { appendFileSync(`${DATA}/fetch-log.jsonl`, JSON.stringify({ id, status: 404 }) + "\n"); writeFileSync(f, gzipSync("")); return ""; }
    await sleep(5000 * (i + 1));
  }
  appendFileSync(`${DATA}/fetch-log.jsonl`, JSON.stringify({ id, status: "failed" }) + "\n");
  return null;
}

const dropped = { too_short: 0, fetch_failed: 0, authors_under_min_works: 0 };
let done = 0;
const results = new Array(order.length);
async function doAuthor(idx) {
  const a = order[idx], works = [];
  for (const r of shuffle(a.cands, CFG.seed + +a.q.slice(1))) {
    if (works.length >= CFG.works.max_per_author) break;
    const t = await raw(r["Text#"]);
    if (t == null) { dropped.fetch_failed++; continue; }
    const c = cleanBook(t);
    if (c.rawBodyWords < CFG.works.min_body_words) { dropped.too_short++; continue; }
    works.push({ pg: r["Text#"], title: r.Title.split("\n")[0].slice(0, 120), genre: FICTION.test(r.Subjects) ? "fiction" : "nonfiction", body_words: c.words, issued: r.Issued });
  }
  if (++done % 25 === 0) log(`${done}/${order.length} authors`);
  if (works.length < CFG.authors.min_works) { dropped.authors_under_min_works++; return; }
  works.sort((x, y) => +x.pg - +y.pg);
  results[idx] = { id: a.q, name: a.label, pg_name: a.pgName, born: a.born, died: a.died, midlife_decade: Math.floor((a.born + 40) / 10) * 10, midlife_century: midlifeCentury(a.born), works };
}
// Several workers share the one-request-per-1.1-s limiter, because each file takes seconds to arrive.
let nextIdx = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (nextIdx < order.length) await doAuthor(nextIdx++); }));
const panel = results.filter(Boolean);
panel.sort((a, b) => a.name.localeCompare(b.name));
const out = {
  _readme: "Built by build-corpus.mjs from the frozen rules in docs/research/sgr-021-preregistration.md. No hand edits.",
  built: new Date().toISOString().slice(0, 10), partial: Boolean(LIMIT),
  catalogue_sha256: CFG.catalogue.sha256, wikidata_rows: people.size,
  authors_eligible_before_download: nAll, dropped_catalogue: drop, dropped_download: dropped,
  authors: panel,
};
const target = opt("--out", new URL(LIMIT ? "./panel-partial.json" : "./panel.json", import.meta.url).pathname);
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
log(`${panel.length} authors, ${panel.reduce((s, a) => s + a.works.length, 0)} books -> ${target}`);
