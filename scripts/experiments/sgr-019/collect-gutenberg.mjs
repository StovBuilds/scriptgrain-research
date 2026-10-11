#!/usr/bin/env bun
// SGR-019 data assembly (not part of the D-1 measurement): download, once, the full text of
// every Project Gutenberg book already in the SGR-005 panel and the SGR-006 book sample, and
// write books.json (the frozen book list with date information). Text goes to
// ~/research/sgr-019/gutenberg/<id>.txt.gz and is never committed or published.
//   bun scripts/experiments/sgr-019/collect-gutenberg.mjs [--limit N]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { parseCsv } from "./lib.mjs";

const R = process.env.SGR019_DIR ?? `${process.env.HOME}/research/sgr-019`;
const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? +args[args.indexOf("--limit") + 1] : Infinity;
const here = new URL(".", import.meta.url).pathname;
mkdirSync(`${R}/gutenberg`, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cat = new Map(parseCsv(readFileSync(`${R}/pg_catalog.csv`, "utf8")).map((r) => [r["Text#"], r]));

const books = new Map(); // pg id -> record
const p5 = JSON.parse(readFileSync(here + "../sgr-005/panel.json", "utf8"));
for (const a of p5.authors) for (const w of a.works) {
  books.set(String(w.pg), { id: String(w.pg), panel: "SGR-005", year: w.year, era: null, genre: "fiction_or_literary", author: a.name, cluster: `a:${a.id}` });
}
const t6 = parseCsv(readFileSync(here + "../../../public/research/sgr-006-texts.csv", "utf8")).filter((r) => r.source === "gutenberg");
for (const r of t6) {
  if (books.has(r.id)) { books.get(r.id).also6 = { genre: r.group, era: r.era }; continue; }
  const c = cat.get(r.id);
  books.set(r.id, { id: r.id, panel: "SGR-006", year: null, era: r.era, genre: r.group, author: (c?.Authors ?? "").split(";")[0].trim(), cluster: `a:${(c?.Authors ?? r.id).split(";")[0].trim()}` });
}
const SH0 = !args.includes("--shard") || args[args.indexOf("--shard") + 1].startsWith("0/");
const list = [...books.values()].sort((a, b) => +a.id - +b.id);
console.error(`books: ${list.length} (SGR-005 ${list.filter((b) => b.panel === "SGR-005").length}, SGR-006 only ${list.filter((b) => b.panel === "SGR-006").length})`);
if (SH0) writeFileSync(here + "books.json", JSON.stringify({ _readme: "SGR-019 Gutenberg book list: the SGR-005 panel works plus the SGR-006 book sample, deduplicated by Gutenberg id. Built by collect-gutenberg.mjs; no hand edits.", built: new Date().toISOString().slice(0, 10), books: list }, null, 1));

const SH = args.includes("--shard") ? args[args.indexOf("--shard") + 1].split("/").map(Number) : [0, 1];
let n = 0;
for (const [k, b] of list.entries()) {
  if (k % SH[1] !== SH[0]) continue;
  if (n >= LIMIT) break;
  const f = `${R}/gutenberg/${b.id}.txt.gz`;
  if (existsSync(f)) continue;
  n++;
  let ok = false;
  const dirs = b.id.length > 1 ? b.id.slice(0, -1).split("").join("/") : "0";
  const MIRRORS = ["http://www.mirrorservice.org/sites/ftp.ibiblio.org/pub/docs/books/gutenberg", "https://mirrors.xmission.com/gutenberg"];
  // www.gutenberg.org answered 504 under load; the mirrors carry the same files (ID-0.txt is UTF-8, ID.txt ASCII).
  for (const mirror of MIRRORS) {
    for (const name of [`${b.id}-0.txt`, `${b.id}.txt`, `${b.id}-8.txt`]) {
      try {
        const r = await fetch(`${mirror}/${dirs}/${b.id}/${name}`, { headers: { "User-Agent": "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research; SGR-019)" }, signal: AbortSignal.timeout(60000) });
        if (r.ok) { writeFileSync(f, gzipSync(Buffer.from(await r.arrayBuffer()))); ok = true; break; }
      } catch { await sleep(2000); }
    }
    if (ok) break;
  }
  await sleep(300);
  if (n % 50 === 0) console.error(`downloaded ${n}`);
}
console.error("done");
