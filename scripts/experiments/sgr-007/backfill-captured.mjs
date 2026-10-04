#!/usr/bin/env bun
// One-off repair (2026-10-04): the first harvest read Common Crawl index lines
// without their timestamp (it sits outside the JSON part), so `captured` was
// empty. This looks each measured URL up in the same index again and fills in
// the capture time. No page is re-fetched or re-measured.
//
//   bun scripts/experiments/sgr-007/backfill-captured.mjs --cluster <cluster.idx> --file <rows.jsonl>
import { readFileSync, writeFileSync } from "node:fs";
import { loadCluster, capturesFor } from "./cc-index.mjs";

const args = process.argv.slice(2);
const opt = (n) => args[args.indexOf(n) + 1];
const FILE = opt("--file");
const cluster = loadCluster(opt("--cluster"));
const rows = readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const prefixes = [...new Set(rows.filter((r) => r.url && !r.captured).map((r) => (r.group === "homepages" ? `${r.source}/` : r.source)))];
const ts = new Map();
const q = [...prefixes];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (q.length) {
    const p = q.shift();
    for (const c of await capturesFor("CC-MAIN-2021-43", cluster, p, { maxBlocks: 80 })) if (c.status === "200" && !ts.has(c.url)) ts.set(c.url, c.timestamp);
  }
}));
let filled = 0;
for (const r of rows) if (r.url && !r.captured && ts.has(r.url)) { r.captured = ts.get(r.url); filled++; }
writeFileSync(FILE, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.error(`filled ${filled} of ${rows.filter((r) => r.url).length} rows with a URL`);
