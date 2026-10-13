// Adds pair_basis + a one-line rank key to candidates.json after probe.mjs (idempotent).
import { readFileSync, writeFileSync } from "node:fs";
const j = JSON.parse(readFileSync("candidates.json", "utf8"));
const DIFFERENT = new Set(["Nationwide", "Cadbury / Hershey", "Allianz", "AXA", "Zurich", "Prudential", "Wikipedia/WWF", "WWF", "Ocado", "Barclays", "Hilton"]);
for (const r of j.candidates) {
  if (DIFFERENT.has(r.brand) && r.status !== "excluded") { r.verification_before_exclusion = r.status; r.status = "excluded"; r.exclusion = "different company, no real UK/US counterpart, or duplicate row"; }
  const p = r.pair_potential;
  r.pair_basis = !r.status.startsWith("verified") ? "not-verified" : p?.matching_paths > 0 ? "sitemap-matched-paths" : "unmeasured (sitemap unreadable, locale-specific or non-overlapping; needs a Firecrawl map pass)";
}
j.counts = { total: j.candidates.length, excluded: j.candidates.filter((r) => r.status === "excluded").length, verified: j.candidates.filter((r) => r.status.startsWith("verified")).length, verified_with_sitemap_pairs: j.candidates.filter((r) => r.pair_basis === "sitemap-matched-paths").length };
writeFileSync("candidates.json", JSON.stringify(j, null, 1));
console.log(j.counts, j.summary);
