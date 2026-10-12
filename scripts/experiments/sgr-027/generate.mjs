#!/usr/bin/env bun
// SGR-027 step 1: generate the 20 bare passages (docs/research/sgr-027-preregistration.md §2).
//   bun scripts/experiments/sgr-027/generate.mjs
// Claude through the `claude` CLI, GPT through the `codex` CLI: both on subscription
// logins, never API keys (the keys are stripped from the child env, and Bun would
// otherwise load them from the repo's .env). One generation per prompt, no retries.
// Writes scripts/experiments/sgr-027/out/passages.json.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = "scripts/experiments/sgr-027";
const { items } = JSON.parse(readFileSync(`${DIR}/prompts.json`, "utf8"));
const SUFFIX = " Output only the text.";
const OUT = `${DIR}/out/passages.json`;
mkdirSync(`${DIR}/out`, { recursive: true });
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const env = { ...process.env };
for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"]) delete env[k];
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;

for (const it of items) {
  if (done.some((d) => d.id === it.id)) continue;
  const prompt = it.prompt + SUFFIX;
  let text, model, raw;
  if (it.generator === "claude") {
    const r = spawnSync("claude", ["-p", "--model", "sonnet", "--output-format", "json", prompt], { env, encoding: "utf8", timeout: 300_000, cwd: tmpdir() });
    raw = JSON.parse(r.stdout);
    text = raw.result; model = Object.keys(raw.modelUsage ?? {})[0] ?? "sonnet";
  } else {
    const dir = mkdtempSync(join(tmpdir(), "sgr027-"));
    const last = join(dir, "last.txt");
    const r = spawnSync("codex", ["exec", "--skip-git-repo-check", "--output-last-message", last, prompt], { env, encoding: "utf8", timeout: 300_000, cwd: dir });
    text = readFileSync(last, "utf8");
    model = (r.stdout + r.stderr).match(/^model:\s*(\S+)/m)?.[1] ?? "codex-default";
  }
  text = text.trim();
  const rec = { ...it, model, text, words: words(text), generatedAt: new Date().toISOString() };
  done.push(rec);
  writeFileSync(OUT, JSON.stringify(done, null, 2));
  console.log(`${it.id} ${it.generator} ${model} ${rec.words}w`);
}
