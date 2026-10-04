#!/usr/bin/env bun
// DESK-415: per-feature similarities for every pair (production computeVoiceMatch deltas),
// so we can see WHICH features tell brands apart on web copy, and test reweighting with
// leave-one-sector-out validation. Writes feat.jsonl (no text).
import { writeFileSync } from "node:fs";
import { pages } from "./score.ts";
import { pseudoProfileFromText, computeVoiceMatch } from "../../../supabase/functions/_shared/voice-match.ts";
const ok = pages.filter((p) => p.j);
const rows: string[] = [];
for (const a of ok) {
  const pseudo = pseudoProfileFromText(a.m, a.j);
  for (const b of ok) {
    if (a.url === b.url) continue;
    const c = computeVoiceMatch(pseudo, b.m, b.j, { pool: 0, hits: 0, found: [] })!;
    const kind = a.brand === b.brand ? "same_brand" : a.sector === b.sector ? "same_sector" : "cross_sector";
    rows.push(JSON.stringify({ sector: a.sector, mb: a.brand, ob: b.brand, kind, raw: c.raw, f: Object.fromEntries(c.deltas.map((d) => [d.feature, [+d.similarity.toFixed(3), d.weight]])) }));
  }
}
writeFileSync(new URL("./feat.jsonl", import.meta.url).pathname, rows.join("\n") + "\n");
console.log("pairs", rows.length);
