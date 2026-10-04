#!/usr/bin/env bun
// SGR-005 panel, built by the frozen rules in docs/research/sgr-005-preregistration.md.
//
//   bun scripts/experiments/sgr-005/build-panel.mjs --catalog pg_catalog.csv --cache <text dir>
//
// Reads the saved Wikidata snapshot (wikidata-works.json) and the Project
// Gutenberg catalogue; downloads each candidate book's text once into the cache
// (to count body words for the 15,000-word rule; nothing is measured here) and
// writes panel.json. No hand edits: the panel is what the rules produce.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CACHE = opt("--cache", null);
mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { rows } = JSON.parse(readFileSync(new URL("./wikidata-works.json", import.meta.url), "utf8"));

function parseCsv(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  const [h, ...rest] = out;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}
const cat = new Map(parseCsv(readFileSync(opt("--catalog", null), "utf8")).map((r) => [r["Text#"], r]));
const year = (v) => (v && /^\d{4}/.test(v) ? +v.slice(0, 4) : null);

export async function body(id) {
  const f = `${CACHE}/${id}.txt`;
  if (!existsSync(f)) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, { headers: { "User-Agent": "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research; SGR-005)" }, signal: AbortSignal.timeout(60000) });
        writeFileSync(f, r.ok ? await r.text() : "");
        break;
      } catch { await sleep(3000 * (i + 1)); }
    }
    await sleep(1000);
  }
  let t = readFileSync(f, "utf8").replace(/\r/g, "");
  const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/);
  if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined);
  return t;
}

// Rule 1-3: dated within the author's working life, English text, not drama or poetry.
const works = new Map(); // author -> Map(work -> {year, pg, title})
const authors = new Map();
const drop = {};
for (const r of rows) {
  const y = year(r.date), b = year(r.birth), d = year(r.death);
  const why = !y || !b || !d ? "no_date" : y < b + 15 || y > d + 2 ? "date_outside_life" : !cat.has(r.pg) || cat.get(r.pg).Language !== "en" ? "not_in_catalogue_en" : /Drama|Plays|Poetry|Poems|Verse/i.test(cat.get(r.pg).Subjects) ? "drama_or_poetry" : null;
  if (why) { drop[why] = (drop[why] || 0) + 1; continue; }
  authors.set(r.author, { id: r.author, name: r.authorLabel, born: b, died: d });
  const m = works.get(r.author) ?? new Map();
  const cur = m.get(r.work);
  if (!cur || y < cur.year) m.set(r.work, { work: r.work, title: r.workLabel, year: y, pg: r.pg });
  works.set(r.author, m);
}
// Rule 4: at least 15,000 words of body text (books downloaded once, counted only).
const panel = [];
for (const [aid, m] of works) {
  // Only authors who could still qualify are downloaded.
  if (m.size < 6) continue;
  const kept = [];
  for (const w of [...m.values()].sort((a, b) => a.year - b.year)) {
    const words = (await body(w.pg)).split(/\s+/).filter(Boolean).length;
    if (words >= 15000) kept.push({ ...w, body_words: words });
    else drop.under_15000_words = (drop.under_15000_words || 0) + 1;
  }
  // Rule 5: at least 6 works spanning at least 15 years.
  if (kept.length >= 6 && kept[kept.length - 1].year - kept[0].year >= 15) panel.push({ ...authors.get(aid), works: kept });
}
panel.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(new URL("./panel.json", import.meta.url), JSON.stringify({ _readme: "Built by build-panel.mjs from wikidata-works.json and the Project Gutenberg catalogue by the rules in docs/research/sgr-005-preregistration.md. No hand edits.", built: "2026-10-04", dropped_rows: drop, authors: panel }, null, 1));
console.error(`${panel.length} authors, ${panel.reduce((s, a) => s + a.works.length, 0)} works`, JSON.stringify(drop));
