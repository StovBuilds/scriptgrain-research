// DESK-415: check the offline harness against the live /v1/compare-voice on a sample.
// Needs key.json {"secret":"sg_live_…"} (throwaway; revoke after). Writes live.jsonl.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const corpus = JSON.parse(readFileSync(dir + "corpus.json", "utf8"));
const pairs = readFileSync(dir + "pairs.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const { secret } = JSON.parse(readFileSync(dir + "key.json", "utf8"));
const text = Object.fromEntries(Object.values(corpus).flatMap((b) => b.pages.map((p) => [p.url, p.text])));
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// 8 mains; for each, one same-brand, one same-sector, one cross-sector other
const mains = [...new Set(pairs.map((p) => p.main))].sort(() => rnd() - 0.5).slice(0, 8);
const out = [];
for (const m of mains) {
  const pick = (k) => { const c = pairs.filter((p) => p.main === m && p.kind === k); return c[Math.floor(rnd() * c.length)]; };
  const set = ["same_brand", "same_sector", "cross_sector"].map(pick).filter(Boolean);
  const r = await fetch("https://auth.scriptgrain.com/functions/v1/api-v1/v1/compare-voice", {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ main: { label: "main", text: text[m] }, others: set.map((p, i) => ({ label: `o${i}`, text: text[p.other] })) }),
  });
  const j = await r.json();
  if (!r.ok) { console.log("ERR", r.status, JSON.stringify(j).slice(0, 200)); continue; }
  j.results.forEach((res, i) => { const row = { main: m, other: set[i].other, kind: set[i].kind, offline: set[i].raw, live: res.raw, judge_ok: res.judge_ok }; out.push(row); console.log(JSON.stringify(row)); });
  await new Promise((s) => setTimeout(s, 1500));
}
writeFileSync(dir + "live.jsonl", out.map((r) => JSON.stringify(r)).join("\n") + "\n");
const d = out.map((r) => Math.abs(r.live - r.offline)).sort((a, b) => a - b);
console.log(`n ${out.length}  |live-offline| median ${d[Math.floor(d.length / 2)]?.toFixed(3)} max ${d.at(-1)?.toFixed(3)}`);
