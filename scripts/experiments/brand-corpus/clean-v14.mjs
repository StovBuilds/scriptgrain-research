#!/usr/bin/env bun
// v1.4 (2026-10-05): remove pages from hosts that are not the brand's own (host-rules.mjs)
// from every stored brand file, then record what went in discovery.json.
//   bun clean-v14.mjs && bun build-manifest.mjs
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gzipSync, gunzipSync } from "node:zlib";
import { ownHost } from "./host-rules.mjs";
const dir = new URL(".", import.meta.url).pathname;
const RCLONE = "rclone", REMOTE = "storagebox:research/scriptgrain-brand-corpus/v1/pages", STAGE = dir + ".stage/";
mkdirSync(STAGE, { recursive: true });
const { brands } = JSON.parse(readFileSync(dir + "brands.json", "utf8"));
const disc = JSON.parse(readFileSync(dir + "discovery.json", "utf8"));
let removed = 0;
for (const b of brands) {
  const file = `${b.domain}.jsonl.gz`;
  let rows; try { rows = gunzipSync(execFileSync(RCLONE, ["cat", `${REMOTE}/${file}`], { maxBuffer: 1 << 30 })).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { continue; }
  const keep = rows.filter((r) => ownHost(b.domain, r.url));
  const gone = rows.length - keep.length;
  if (!gone) continue;
  const hosts = {}; for (const r of rows) if (!ownHost(b.domain, r.url)) { const h = new URL(r.url).hostname; hosts[h] = (hosts[h] ?? 0) + 1; }
  writeFileSync(STAGE + file, gzipSync(keep.map((r) => JSON.stringify(r)).join("\n") + "\n"));
  execFileSync(RCLONE, ["copyto", STAGE + file, `${REMOTE}/${file}`], { stdio: "ignore" });
  const remoteSize = JSON.parse(execFileSync(RCLONE, ["lsjson", `${REMOTE}/${file}`]).toString())[0]?.Size;
  if (remoteSize !== readFileSync(STAGE + file).length) throw new Error(`upload size mismatch ${file}`);
  unlinkSync(STAGE + file);
  if (disc[b.domain]) { disc[b.domain].v14 = { removedOffDomain: gone, hosts }; for (const c of Object.keys(disc[b.domain].stored ?? {})) disc[b.domain].stored[c] = keep.filter((r) => r.category === c).length; }
  removed += gone;
  console.log(b.domain, "removed", gone, JSON.stringify(hosts));
}
writeFileSync(dir + "discovery.json", JSON.stringify(disc, null, 1));
console.log("total removed", removed);
