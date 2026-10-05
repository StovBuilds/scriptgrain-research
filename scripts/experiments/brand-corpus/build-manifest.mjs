#!/usr/bin/env bun
// Rebuild manifest.csv from the stored pages themselves, so the manifest can never drift
// from what is on the Storage Box. One row per page; no text.
//   bun build-manifest.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { bestDate } from "./dates.mjs";
const dir = new URL(".", import.meta.url).pathname;
const RCLONE = "rclone", REMOTE = "storagebox:research/scriptgrain-brand-corpus/v1/pages";
const { brands } = JSON.parse(readFileSync(dir + "brands.json", "utf8"));
const COLS = ["domain", "sector", "category", "url", "host", "title", "published", "language", "date_best", "date_source", "source", "wayback_ts", "words", "pdf_pages", "pdf_total_pages", "fetched_at", "sha256", "storage"];
const csv = (v) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const out = [COLS.join(",")];
let n = 0;
for (const b of brands) {
  const file = `${REMOTE}/${b.domain}.jsonl.gz`;
  let rows = [];
  try { rows = gunzipSync(execFileSync(RCLONE, ["cat", file], { maxBuffer: 1 << 30 })).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { console.error("missing", file); }
  for (const r of rows) { n++; out.push([b.domain, b.sector, r.category, r.url, new URL(r.url).hostname, (r.title ?? "").replace(/\s+/g, " ").trim(), r.published, r.language, ...(({ date, source }) => [date, source])(bestDate(r)), r.source ?? "live", r.wayback_ts, r.words, r.pdf_pages, r.pdf_total_pages, r.fetched_at, r.sha256, file].map(csv).join(",")); }
}
writeFileSync(dir + "manifest.csv", out.join("\n") + "\n");
console.log("manifest rows", n);
