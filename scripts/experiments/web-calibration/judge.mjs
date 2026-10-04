#!/usr/bin/env bun
// Judge every corpus page ONCE with the production judge prompt (VOICE_JUDGE_SYSTEM) on
// Haiku 4.5, via the Claude Code CLI on the Max subscription (internal research runs use
// the subscription, Jack 2026-09-29). Production uses the same model + prompt through the
// API with temperature 0; the CLI cannot pin temperature, so live spot-checks (live.mjs)
// confirm the offline raw scores. Writes judged.json (no text).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
const run = (args, input, opts) => new Promise((res) => {
  const c = spawn("claude", args, { cwd: opts.cwd });
  let stdout = "", stderr = ""; const t = setTimeout(() => c.kill("SIGKILL"), opts.timeout);
  c.stdout.on("data", (d) => (stdout += d)); c.stderr.on("data", (d) => (stderr += d));
  c.on("close", (status) => { clearTimeout(t); res({ status, stdout, stderr }); });
  c.stdin.end(input);
});
import { VOICE_JUDGE_SYSTEM } from "../../../supabase/functions/_shared/voice-match.ts";
const dir = new URL(".", import.meta.url).pathname;
const corpus = JSON.parse(readFileSync(dir + "corpus.json", "utf8"));
const out = existsSync(dir + "judged.json") ? JSON.parse(readFileSync(dir + "judged.json", "utf8")) : {};
const parse = (s) => { const a = s.indexOf("{"), b = s.lastIndexOf("}"); try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };
const jobs = [];
for (const [d, { pages }] of Object.entries(corpus)) for (const p of pages) if (!out[p.url]) jobs.push(p);
console.log("to judge", jobs.length);
let i = 0;
async function worker() {
  while (i < jobs.length) {
    const p = jobs[i++];
    for (let a = 0; a < 3; a++) {
      const r = await run(["-p", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence", "--setting-sources", "", "--model", "claude-haiku-4-5", "--system-prompt", VOICE_JUDGE_SYSTEM, "--tools", "", "--output-format", "text"],
        `<text_to_analyse>\n${p.text}\n</text_to_analyse>`, { timeout: 180000, cwd: "/tmp" });
      const j = parse(r.stdout || "");
      if (j) { out[p.url] = j; break; }
      if (a === 2) console.log("FAIL", p.url, (r.stderr || r.stdout || "").slice(0, 200));
    }
    if (Object.keys(out).length % 10 === 0) writeFileSync(dir + "judged.json", JSON.stringify(out));
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
writeFileSync(dir + "judged.json", JSON.stringify(out));
console.log("judged", Object.keys(out).length);
