#!/usr/bin/env bun
// SGR-025 instrument check: re-render SGR-004's own 2026 capture of the 8 pilot sites (collect.mjs
// --wayback-verify), measure it with this study's code, and compare every numeric column with the row SGR-004 published.
// This tests that the pipeline reproduces SGR-004's rows; it does not test the live pages. Exits 1 if a
// reproducible site does not match. Writes ~/research/sgr-025/verify.json (pass/fail only goes on the page).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { measureHtml, pilotDomains, readPage } from "./lib.mjs";
const ROOT = `${homedir()}/research/sgr-025`;
const rows2026 = JSON.parse(readFileSync("public/research/sgr-004-web-copy-rows.json", "utf8")).filter((r) => r.year === 2026);
const KEYS = ["status", "words", "words_article", "avg_sentence_length", "sentence_length_variance", "comma_density", "exclamation_rate", "semicolon_frequency", "contraction_frequency", "pronoun_i", "pronoun_we", "pronoun_you", "word_short", "word_medium", "word_long", "ai_tell_per1000", "not_x_but_y", "triadic_list", "em_dash_per1000", "em_only_per1000", "burstiness_variation", "short_sentence_share", "ai_era_vocab_per1000", "dotcom_vocab_per1000"];
const out = [];
for (const d of pilotDomains(rows2026)) {
  const pub = rows2026.find((r) => r.domain === d);
  // A replay is re-rendered by Firecrawl each time and some come back as an empty JavaScript shell, so a
  // site gets up to three attempts (wayback, wayback2, wayback3). The instrument is reproduced for a site if any attempt matches
  // the published row on every column; attempts that do not match are listed, never hidden.
  const attempts = [];
  for (const dir of ["wayback", "wayback2", "wayback3"]) {
    const html = readPage(`${ROOT}/${dir}`, d);
    if (html == null) continue;
    const mine = measureHtml(html, { domain: d }, { archive: true });
    const diffs = KEYS.filter((k) => (mine[k] ?? null) !== (pub[k] ?? null)).map((k) => ({ k, mine: mine[k] ?? null, published: pub[k] ?? null }));
    attempts.push({ dir, status: mine.status, words: mine.words ?? null, identical: diffs.length === 0, diffs });
  }
  out.push({ domain: d, result: !attempts.length ? "missing" : attempts.some((a) => a.identical) ? "identical" : "differs", attempts });
}
writeFileSync(`${ROOT}/verify.json`, JSON.stringify(out, null, 1));
for (const o of out) console.log(o.domain.padEnd(16), o.result, (o.attempts || []).map((a) => `${a.dir}:${a.identical ? "identical" : `${a.status}/${a.words}`}`).join(" "));
const identical = out.filter((o) => o.result === "identical").length;
console.log(`${identical} of ${out.length} identical`);
