#!/usr/bin/env bun
// Derives the "changed" threshold of each headline measure from SGR-004's PUBLISHED rows:
// the largest absolute year-on-year move (2022 to 2023, 2023 to 2024, 2024 to 2025, 2025 to 2026) of the
// measure's change statistic over sites measured in both years. A quarter-on-quarter move has to be
// as large as the biggest whole-year move of the last four years to be called a change.
// Uses no new data. The result is copied into index-definition.json at freeze.
import { readFileSync } from "node:fs";
import { DEF, change, pairUp } from "./lib.mjs";
const rows = JSON.parse(readFileSync("public/research/sgr-004-web-copy-rows.json", "utf8")).filter((r) => r.status === "measured");
// SGR-004's analyse.mjs adds ai_era_style_per1000 to every measured row; do the same.
for (const r of rows) { const t = ["ai-powered", "powered by ai"].reduce((a, w) => a + ((r.ai_era_vocab_hits || {})[w] || 0), 0); r.ai_era_style_per1000 = Math.round(Math.max(0, r.ai_era_vocab_per1000 - (t / r.words) * 1000) * 100) / 100; }
const out = {};
for (const m of DEF.headline_measures) {
  const moves = [];
  for (const y of [2022, 2023, 2024, 2025]) {
    const p = pairUp(rows.filter((r) => r.year === y), rows.filter((r) => r.year === y + 1));
    moves.push({ from: y, to: y + 1, sites: p.length, move: change(m, p) });
  }
  out[m.id] = { moves: moves.map((x) => ({ ...x, move: Math.round(x.move * 1000) / 1000 })), threshold: Math.round(Math.max(...moves.map((x) => Math.abs(x.move))) * 100) / 100 };
}
console.log(JSON.stringify(out, null, 1));
