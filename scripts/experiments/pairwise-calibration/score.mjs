import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const corpus = JSON.parse(readFileSync(dir + "corpus.json", "utf8"));
const { secret } = JSON.parse(readFileSync(dir + "key.json", "utf8"));
const authors = Object.keys(corpus);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const out = dir + "results.jsonl"; writeFileSync(out, "");
async function call(main, others) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://auth.scriptgrain.com/functions/v1/api-v1/v1/compare-voice", {
      method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ main: { label: "main", text: main }, others: others.map((t, i) => ({ label: `o${i}`, text: t })) }),
    });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 15000)); continue; }
    const j = await r.json();
    if (!r.ok) throw new Error(r.status + " " + JSON.stringify(j).slice(0, 200));
    return j;
  }
  throw new Error("429 x4");
}
for (const len of ["short", "long"]) {
  for (const a of authors) {
    const pieces = corpus[a];
    for (let i = 0; i < pieces.length; i++) {
      const same = pieces.filter((_, k) => k !== i).slice(0, 3);
      const pool = authors.filter((b) => b !== a).sort(() => rnd() - 0.5).slice(0, 3);
      const cross = pool.map((b) => corpus[b][Math.floor(rnd() * corpus[b].length)]);
      for (const [kind, set, who] of [["same", same, same.map(() => a)], ["cross", cross, pool]]) {
        try {
          const j = await call(pieces[i][len], set.map((p) => p[len]));
          j.results.forEach((r, k) => appendFileSync(out, JSON.stringify({ len, kind, main: a, other: who[k], raw: r.raw, score: r.score, band: r.band, judge_ok: r.judge_ok ?? null, diffs: (r.top_differences || []).map((d) => d.feature) }) + "\n"));
        } catch (e) { appendFileSync(out, JSON.stringify({ len, kind, main: a, error: String(e).slice(0, 200) }) + "\n"); }
        await new Promise((s) => setTimeout(s, 1200));
      }
    }
  }
}
console.log("done");
