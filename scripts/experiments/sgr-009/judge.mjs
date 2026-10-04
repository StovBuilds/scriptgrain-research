#!/usr/bin/env bun
// SGR-009 judge: pre-registration section 4. Every corpus page judged with the production
// judge prompt + user message through the Anthropic API.
//   bun judge.mjs J1a|J1b   -> claude-haiku-4-5, temperature 0, max_tokens 600 (production)
//   bun judge.mjs J2a|J2b|J2c -> claude-sonnet-5-5, thinking between_tools, max_tokens 1000
// Writes judged-<run>.json (url -> judged features or null; no text) and usage-<run>.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { VOICE_JUDGE_SYSTEM } from "../../../supabase/functions/_shared/voice-match.ts";

const run = process.argv[2];
const RUNS = {
  J1a: { model: "claude-haiku-4-5", max_tokens: 600, temperature: 0 },
  J1b: { model: "claude-haiku-4-5", max_tokens: 600, temperature: 0 },
  J2a: { model: "claude-sonnet-5-5", max_tokens: 1000, thinking: { type: "between_tools" } },
  J2b: { model: "claude-sonnet-5-5", max_tokens: 1000, thinking: { type: "between_tools" } },
  J2c: { model: "claude-sonnet-5-5", max_tokens: 1000, thinking: { type: "between_tools" } },
};
if (!RUNS[run]) { console.error("usage: bun judge.mjs J1a|J1b|J2a|J2b|J2c"); process.exit(2); }

const env = readFileSync("~/.bot-infra.env", "utf8");
const keyName = process.env.JUDGE_KEY_VAR || "PPS_ANTHROPIC_API_KEY";
const apiKey = env.match(new RegExp(`^${keyName}=(.+)$`, "m"))?.[1].trim().replace(/^['"]|['"]$/g, "");
if (!apiKey) { console.error("no key", keyName); process.exit(2); }
// Raw /v1/messages, as the repo's own ai-client.ts does (no SDK dependency in this repo).
async function create(body) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    const t = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (a + 1))); continue; }
    throw new Error(`${r.status} ${t.slice(0, 300)}`);
  }
  throw new Error("retries exhausted");
}

const dir = new URL(".", import.meta.url).pathname;
const corpus = JSON.parse(readFileSync(dir + "corpus.json", "utf8"));
const outPath = `${dir}judged-${run}.json`;
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
const usage = { input: 0, output: 0, cache_read: 0, cache_write: 0, calls: 0, parse_fail: 0 };

// parseLooseJSON equivalent: first { to last }.
const parse = (s) => { const a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };

const jobs = [];
for (const b of Object.values(corpus)) for (const p of b.pages) if (!(p.url in out)) jobs.push(p);
console.log(run, RUNS[run].model, "to judge", jobs.length, "key", keyName);

async function judgeOne(p) {
  const cfg = RUNS[run];
  for (let a = 0; a < 3; a++) {
    const res = await create({
      ...cfg,
      system: [{ type: "text", text: VOICE_JUDGE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `<text_to_analyse>\n${p.text}\n</text_to_analyse>` }],
    });
    usage.calls++;
    usage.input += res.usage.input_tokens; usage.output += res.usage.output_tokens;
    usage.cache_read += res.usage.cache_read_input_tokens ?? 0; usage.cache_write += res.usage.cache_creation_input_tokens ?? 0;
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    const j = parse(text);
    if (j) return j;
    usage.parse_fail++;
  }
  return null;
}

let i = 0, done = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < jobs.length) {
    const p = jobs[i++];
    try { out[p.url] = await judgeOne(p); } catch (e) { console.log("ERR", p.url, String(e).slice(0, 200)); }
    if (++done % 25 === 0) { writeFileSync(outPath, JSON.stringify(out)); console.log(run, done, "/", jobs.length); }
  }
}));
writeFileSync(outPath, JSON.stringify(out));
const prior = existsSync(`${dir}usage-${run}.json`) ? JSON.parse(readFileSync(`${dir}usage-${run}.json`, "utf8")) : null;
if (prior) for (const k of Object.keys(usage)) usage[k] += prior[k] ?? 0;
writeFileSync(`${dir}usage-${run}.json`, JSON.stringify({ model: RUNS[run].model, ...usage }, null, 1));
console.log(run, "judged", Object.keys(out).length, "nulls", Object.values(out).filter((v) => v === null).length, JSON.stringify(usage));
