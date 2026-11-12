// Classifies fc-probe.json into in / fix-base / out for SGR-030. Hand verdicts below come from reading
// each off-side landing URL (14 Oct 2026); everything else follows from the probe.
import { readFileSync, writeFileSync } from "node:fs";
const IN = process.argv[2] ?? "~/research/sgr-030/fc-probe.json";
const d = JSON.parse(readFileSync(IN, "utf8"));
// Landing on the brand's own default or a corrected locale base: the side is real, the seed base was wrong.
const FIX = {
  Huel: "uk.huel.com | huel.com", Uber: "uber.com/gb/en | uber.com (US default)", Netflix: "netflix.com/gb | netflix.com (US default)",
  Stripe: "stripe.com/gb (retry: proxy tunnel error) | stripe.com (US default)", Vans: "vans.com/en-gb | vans.com", "The North Face": "thenorthface.com/en-gb | thenorthface.com",
  "Ted Baker": "tedbaker.com/en-gb | tedbaker.com/en-us (to check)", Marriott: "marriott.com/en-gb | marriott.com (US default)", Farfetch: "farfetch.com/uk | farfetch.com (US default)",
  "Hunter Boots": "hunterboots.co.uk | hunterboots.com", Glossier: "uk.glossier.com | glossier.com (to check)", "The Economist": "economist.com (UK edition?) | economist.com/topics/united-states (a topic page, weak pair)",
  AllSaints: "allsaints.com/gb (to check) | allsaints.com/us", "Tom Ford": "both bases 404: find current locale paths",
};
// Real geo traps or no second site: the requested side is not reachable even with Firecrawl's location set.
const OUT = {
  Asana: "UK locale redirects to the US root", "Virgin Atlantic": "both sides redirect to the root / en-US", Mailchimp: "UK locale redirects to /de/ (EUR)",
  Revolut: "en-GB redirects to the root", "Dr. Martens": "both locales redirect to the root", Gap: "UK online store closed (franchise landing page)",
  Hasbro: "both sides land on consumer-care 'where to buy'", Deliveroo: "no US site (deliveroo.com goes to .co.uk)", Innocent: "no US site (.com goes to .co.uk)",
  BrewDog: "US base 404, UK redirects to root", Spotify: "bot wall on both sides", Heinz: "bot wall on both sides", "American Airlines": "Firecrawl does not support the site",
  eBay: "times out on both sides", "Krispy Kreme": "UK bot wall", "Liquid Death": "UK bot wall", "Fred Perry": "US bot wall", Nikon: "UK 503",
  "Domino's": "UK: all engines failed", Nike: "US 500", Jigsaw: "US 404",
};
const out = {};
for (const [b, x] of Object.entries(d)) {
  const clean = x.uk.ok && x.uk.onSide && x.us.ok && x.us.onSide;
  out[b] = { seedStatus: x.status, verdict: clean ? "in" : FIX[b] ? "fix-base" : OUT[b] ? "out" : "unclassified", note: clean ? null : FIX[b] ?? OUT[b] ?? null,
    uk: { ok: x.uk.ok, onSide: x.uk.onSide ?? false, final: x.uk.final ?? null, words: x.uk.words ?? null }, us: { ok: x.us.ok, onSide: x.us.onSide ?? false, final: x.us.final ?? null, words: x.us.words ?? null } };
}
const n = (v) => Object.values(out).filter((o) => o.verdict === v).length;
writeFileSync(new URL("./fc-probe-result.json", import.meta.url), JSON.stringify({ probed: "2026-10-14", firecrawlCreditsUsed: 154, counts: { in: n("in"), "fix-base": n("fix-base"), out: n("out"), unclassified: n("unclassified") }, brands: out }, null, 1) + "\n");
console.log({ in: n("in"), fix: n("fix-base"), out: n("out"), unclassified: Object.entries(out).filter(([, o]) => o.verdict === "unclassified").map(([b]) => b) });
