#!/usr/bin/env bun
// SGR-007: Google Books Ngram (English 2019 corpus, case-insensitive, no
// smoothing) for every entry on OLD, CALLED_OUT, MARKETING and CONTROL, 1800-2019.
// A trailing-* entry is expanded to the explicit forms below (Ngram has no
// stem match); a two-word entry is a 2-gram. Output: per-million-words series.
//
//   bun scripts/experiments/sgr-007/ngram.mjs --out <ngram.json>
import { readFileSync, writeFileSync } from "node:fs";

const LEX = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));
const FORMS = {
  "delve*": ["delve", "delves", "delved"], "intricate*": ["intricate", "intricately"], "meticulous*": ["meticulous", "meticulously"],
  "showcas*": ["showcase", "showcases", "showcased", "showcasing"], "underscor*": ["underscore", "underscores", "underscored", "underscoring"],
  "notabl*": ["notable", "notably"], "comprehensive*": ["comprehensive", "comprehensively"], "enhanc*": ["enhance", "enhances", "enhanced", "enhancing", "enhancement"],
  "significant*": ["significant", "significantly"], "seamless*": ["seamless", "seamlessly"], "elevate*": ["elevate", "elevates", "elevated", "elevating"],
  "unlock*": ["unlock", "unlocks", "unlocked", "unlocking"], "empower*": ["empower", "empowers", "empowered", "empowering", "empowerment"],
  "streamline*": ["streamline", "streamlines", "streamlined", "streamlining"], "supercharge*": ["supercharge", "supercharged", "supercharging"],
  "unleash*": ["unleash", "unleashes", "unleashed", "unleashing"], "effortless*": ["effortless", "effortlessly"], "revolutionis*": ["revolutionise", "revolutionised", "revolutionising"],
  "revolutioniz*": ["revolutionize", "revolutionized", "revolutionizing"], "harness*": ["harness", "harnesses", "harnessed", "harnessing"],
  "embark*": ["embark", "embarks", "embarked", "embarking"], "reimagin*": ["reimagine", "reimagined", "reimagining"], "redefin*": ["redefine", "redefines", "redefined", "redefining"],
};
const entries = [...new Set(["OLD", "CALLED_OUT", "MARKETING", "CONTROL"].flatMap((k) => LEX[k]))];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
for (const e of entries) {
  const forms = FORMS[e] ?? [e.replace(/\*$/, "")];
  let sum = null;
  for (let i = 0; i < 5; i++) {
    const u = `https://books.google.com/ngrams/json?content=${encodeURIComponent(forms.join(","))}&year_start=1800&year_end=2019&corpus=en-2019&smoothing=0&case_insensitive=true`;
    const r = await fetch(u, { headers: { "User-Agent": "ScriptGrainResearch/1.0 (+https://scriptgrain.com/research; SGR-007)" } });
    if (r.status === 429) { await sleep(15000 * (i + 1)); continue; }
    const d = await r.json().catch(() => []);
    // Case-insensitive queries return one "(All)" series per form; keep those.
    const series = d.filter((s) => / \(All\)$/.test(s.ngram) || !d.some((x) => / \(All\)$/.test(x.ngram)));
    sum = Array.from({ length: 220 }, (_, k) => series.reduce((a, s) => a + (s.timeseries[k] ?? 0), 0) * 1e6);
    break;
  }
  out[e] = { forms, per_million: sum ? Object.fromEntries(sum.map((v, k) => [1800 + k, Math.round(v * 10000) / 10000])) : null };
  process.stderr.write(`${e} ${sum ? sum[2019 - 1800].toFixed(3) : "FAILED"}\n`);
  await sleep(1500);
}
writeFileSync(process.argv[process.argv.indexOf("--out") + 1], JSON.stringify(out));
