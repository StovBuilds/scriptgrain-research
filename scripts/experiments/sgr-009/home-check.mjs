#!/usr/bin/env bun
// SGR-009 exploratory: the pilot's homepage comparison on this study's pairs (primary judge).
// Rival homepages (same sector) against each other vs a homepage against its own inner pages.
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const P = JSON.parse(readFileSync(dir + "features.json", "utf8"));
const [head, ...rows] = readFileSync(dir + "pairs.csv", "utf8").trim().split("\n");
const c = head.split(",").indexOf("J1a");
const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const hh = [], hi = [];
for (const l of rows) { const f = l.split(","); const a = P[+f[0]], b = P[+f[1]];
  if (a.type === "home" && b.type === "home" && f[2] === "SS") hh.push(+f[c]);
  if (a.type === "home" && b.type !== "home" && f[2] === "SB") hi.push(+f[c]); }
const out = { rivalHomes: +med(hh).toFixed(3), rivalHomesPairs: hh.length, homeInner: +med(hi).toFixed(3), homeInnerPairs: hi.length };
writeFileSync(dir + "home-check.json", JSON.stringify(out, null, 1)); console.log(out);
