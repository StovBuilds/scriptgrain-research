#!/usr/bin/env bun
// SGR-008 census step 4: run ScriptGrain's production instruments on every
// included abstract and write one row of numbers per paper (no text).
//
//   bun scripts/experiments/sgr-008/census-instruments.mjs --census ~/research/sgr-008/census \
//       --papers ~/research/sgr-008/census-papers.jsonl.gz --out ~/research/sgr-008/census-instruments.jsonl.gz
//
// Inclusion comes from census-build's output (--papers), so both steps measure
// exactly the same papers. Cleaning is the same clean() as measure.mjs and
// census-build.py.
import { readdirSync, createReadStream, createWriteStream } from "node:fs";
import { createGunzip, createGzip } from "node:zlib";
import { createInterface } from "node:readline";
// Streams line by line: gunzipping the 550 MB papers file into one string took 8 GB.
const lines = (path) => createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const CENSUS = opt("--census"), PAPERS = opt("--papers"), OUT = opt("--out");
const r2 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);
const clean = (s) => s
  .replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " X ")
  .replace(/\\(?:cite|ref|label)\{[^}]*\}/g, " ")
  .replace(/\\[a-zA-Z]+\*?(\{[^}]*\})?/g, (m, g) => (g ? g.slice(1, -1) : " "))
  .replace(/---/g, "—").replace(/--/g, "–")
  .replace(/[{}~]/g, " ").replace(/\s+/g, " ").trim();

const meta = new Map();
for await (const line of lines(PAPERS)) {
  if (!line) continue;
  const p = JSON.parse(line);
  meta.set(p.id, [p.ym, p.cat, p.group, p.pilot, p.base_ok]);
}
const gz = createGzip(); gz.pipe(createWriteStream(OUT));
let n = 0;
for (const f of readdirSync(CENSUS).filter((x) => x.startsWith("part-")).sort()) {
  for await (const line of lines(`${CENSUS}/${f}`)) {
    if (!line) continue;
    const r = JSON.parse(line);
    const mm = meta.get(r.id);
    if (!mm) continue;
    const m = { ym: mm[0], cat: mm[1], group: mm[2], pilot: mm[3], base_ok: mm[4] };
    meta.delete(r.id); // first record only, as census-build
    const t = clean(r.abstract || "");
    const words = t.split(/\s+/).filter(Boolean).length;
    const feat = measureTextFeatures(t);
    const scan = scanCliches(t);
    gz.write(JSON.stringify({
      id: r.id, ...m, words,
      avg_sentence_length: r2(feat.avg_sentence_length),
      sentence_length_variance: r2(feat.sentence_length_variance),
      comma_density: r2(feat.comma_density),
      semicolon_frequency: r2(feat.semicolon_frequency),
      pronoun_we: r2(feat.pronoun_distribution?.we),
      word_long: r2(feat.word_length_distribution?.long),
      ai_tell_per1000: scan.per1000,
      em_dash_per1000: r2(((t.match(/—/g) ?? []).length / words) * 1000),
      burstiness_variation: r2(scan.burstiness.variation),
    }) + "\n");
    if (++n % 200000 === 0) console.error(`${n} measured`);
  }
}
await new Promise((res) => gz.end(res));
console.error(`${n} abstracts measured; ${meta.size} included ids not found in the census files`);
