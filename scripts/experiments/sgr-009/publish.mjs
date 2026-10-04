#!/usr/bin/env bun
// SGR-009: write the public dataset (no page text) to public/research/.
//   sgr-009-pages.csv        one row per page: brand, sector, type, URL, fetch time, words,
//                            the counted features and the primary judge's (J1a) attributes
//   sgr-009-judgements.json  every judge run's output per URL (J1a, J1b, J2a, J2b, J2c)
//   sgr-009-pairs.csv        every ordered pair: page ids, kind, same type, raw score for
//                            J1a, J2a and measured-only (3 decimals)
//   sgr-009-summary.json     summary.json from analyse.mjs, plus coverage and judge cost
//   bun scripts/experiments/sgr-009/publish.mjs [--outdir public/research]
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const OUT = args.includes("--outdir") ? args[args.indexOf("--outdir") + 1] : "public/research";
const pages = JSON.parse(readFileSync(dir + "features.json", "utf8"));
const meta = JSON.parse(readFileSync(dir + "pages.json", "utf8"));
const S = JSON.parse(readFileSync(dir + "summary.json", "utf8"));
const csvCell = (v) => { if (v == null) return ""; const s = typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const fetchedAt = new Map(Object.values(meta).flatMap((b) => b.pages.map((p) => [p.url, p.fetchedAt])));

// pages.csv
const mKeys = Object.keys(pages[0].measured);
const jKeys = [...new Set(pages.flatMap((p) => Object.keys(p.judged.J1a ?? {})))];
const rows = [["page_id", "brand", "sector", "type", "url", "fetched_at", "words_measured", ...mKeys, ...jKeys.map((k) => `judge_${k}`)].join(",")];
for (const p of pages) rows.push([p.id, p.brand, p.sector, p.type, p.url, fetchedAt.get(p.url), p.words, ...mKeys.map((k) => p.measured[k]), ...jKeys.map((k) => p.judged.J1a?.[k])].map(csvCell).join(","));
writeFileSync(`${OUT}/sgr-009-pages.csv`, rows.join("\n") + "\n");

// judgements.json
writeFileSync(`${OUT}/sgr-009-judgements.json`, JSON.stringify(Object.fromEntries(pages.map((p) => [p.url, p.judged]))));

// pairs.csv
const [head, ...body] = readFileSync(dir + "pairs.csv", "utf8").trim().split("\n");
const cols = head.split(",");
const keep = ["J1a", "J2a", "none"].map((c) => cols.indexOf(c));
const out = ["main_page_id,other_page_id,kind,same_type,raw_haiku_J1a,raw_sonnet_J2a,raw_measured_only"];
for (const l of body) { const f = l.split(","); out.push([f[0], f[1], f[2], f[3], ...keep.map((i) => (+f[i]).toFixed(3))].join(",")); }
writeFileSync(`${OUT}/sgr-009-pairs.csv`, out.join("\n") + "\n");

// summary.json + coverage + cost
const coverage = {};
for (const [d, b] of Object.entries(meta)) {
  const c = (coverage[b.sector] ??= { brands: 0, brands_included: 0, pages: 0, missing: { home: 0, about: 0, product: 0, pricing: 0, careers: 0 } });
  c.brands++; if (b.pages.length >= 2) c.brands_included++; c.pages += b.pages.length;
  for (const t of Object.keys(c.missing)) if (!b.pages.some((p) => p.type === t)) c.missing[t]++;
}
const PRICE = { "claude-haiku-4-5": [1, 5], "claude-sonnet-5-5": [2, 10] };
const usage = Object.fromEntries(["J1a", "J1b", "J2a", "J2b", "J2c"].map((r) => { const u = JSON.parse(readFileSync(`${dir}usage-${r}.json`, "utf8")); const [pi, po] = PRICE[u.model]; return [r, { model: u.model, calls: u.calls, input_tokens: u.input, output_tokens: u.output, usd: +((u.input * pi + u.output * po) / 1e6).toFixed(2) }]; }));
const excluded = Object.entries(meta).filter(([, b]) => b.pages.length < 2).map(([d, b]) => ({ brand: d, sector: b.sector, pages: b.pages.length }));
writeFileSync(`${OUT}/sgr-009-summary.json`, JSON.stringify({ study: "SGR-009", conducted: "2026-10-04", ...S, coverage, excluded, judgeUsage: usage }, null, 1));
console.error("wrote", OUT, "pages", pages.length, "pairs", body.length, "usd", Object.values(usage).reduce((s, u) => s + u.usd, 0).toFixed(2));
