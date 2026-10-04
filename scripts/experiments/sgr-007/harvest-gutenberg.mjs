#!/usr/bin/env bun
// SGR-007: sample and measure Project Gutenberg books by class (sources.json).
//
//   bun scripts/experiments/sgr-007/harvest-gutenberg.mjs --catalog pg_catalog.csv --out <rows.jsonl>
//
// Per class: matching English texts, shuffled with the frozen seed; books are
// read in that order until books_per_class have a body of at least 3,000 words.
// Three ~800-word pieces per book, starting at 20%, 50% and 80% of the body,
// cut at paragraph boundaries. Each piece is measured and only numbers kept.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { measure } from "./instruments.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const G = CFG.gutenberg, OUT = opt("--out", null);
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal CSV parser (quoted fields with commas and doubled quotes).
function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, seed) => { const r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const books = parseCsv(readFileSync(opt("--catalog", null), "utf8")).filter((r) => r.Type === "Text" && r.Language === G.language);
const match = (r, c) => {
  const s = r.Subjects.toLowerCase(), locc = r.LoCC.split("; ").filter(Boolean);
  if (c.subject_any && !c.subject_any.some((x) => s.includes(x.toLowerCase()))) return false;
  if (c.subject_none && c.subject_none.some((x) => s.includes(x.toLowerCase()))) return false;
  if (c.locc_prefix && !locc.some((l) => c.locc_prefix.some((p) => l.startsWith(p)))) return false;
  return true;
};
const doneBooks = new Map();
if (existsSync(OUT)) for (const l of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); if (r.piece === 0 || r.status === "too_short") doneBooks.set(`${r.group}:${r.book}`, r.status); }

async function body(id) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, { headers: { "User-Agent": "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research; SGR-007)" }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) return "";
      let t = (await r.text()).replace(/\r/g, "");
      const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/);
      if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined);
      return t;
    } catch { await sleep(3000 * (i + 1)); }
  }
  return "";
}

for (const [group, c] of Object.entries(G.classes)) {
  const pool = shuffle(books.filter((r) => match(r, c)), CFG.seed);
  let got = [...doneBooks.entries()].filter(([k, v]) => k.startsWith(group + ":") && v !== "too_short").length;
  for (const r of pool) {
    if (got >= G.books_per_class) break;
    if (doneBooks.has(`${group}:${r["Text#"]}`)) continue;
    const t = await body(r["Text#"]);
    await sleep(1000);
    const paras = t.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.split(" ").length > 12 && !/^(CHAPTER|BOOK|VOLUME|PART|SECTION|[IVXLC]+\.)\b/i.test(p));
    const total = paras.reduce((a, p) => a + p.split(" ").length, 0);
    const base = { group, source: "gutenberg", book: r["Text#"], title: r.Title.slice(0, 120) };
    if (total < 3000) { appendFileSync(OUT, JSON.stringify({ ...base, status: "too_short", words: total }) + "\n"); continue; }
    G.positions.forEach((pos, k) => {
      let acc = 0, i = 0;
      while (i < paras.length && acc < total * pos) acc += paras[i++].split(" ").length;
      const piece = [];
      let w = 0;
      while (i < paras.length && w < G.piece_words) { piece.push(paras[i]); w += paras[i++].split(" ").length; }
      const text = piece.join("\n\n");
      appendFileSync(OUT, JSON.stringify({ ...base, piece: k, status: "measured", ...measure(text, w) }) + "\n");
    });
    got++;
  }
  log(`${group}: ${got} books`);
}
log("done");
