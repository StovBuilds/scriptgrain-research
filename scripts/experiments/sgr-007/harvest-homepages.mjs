#!/usr/bin/env bun
// SGR-007: the SGR-004 panel's homepages as Common Crawl saw them in October 2021,
// measured with SGR-004's homepage extractor and SGR-007's instruments.
//
//   bun scripts/experiments/sgr-007/harvest-homepages.mjs --cluster <cluster.idx> --out <rows.jsonl>
import { readFileSync, appendFileSync } from "node:fs";
import { loadCluster, capturesFor, fetchRecord, surt } from "./cc-index.mjs";
import { homepageText } from "../sgr-004/homepage-text.mjs";
import { measure } from "./instruments.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));
const { sites } = JSON.parse(readFileSync(new URL("../sgr-004/panel.json", import.meta.url), "utf8"));
const cluster = loadCluster(opt("--cluster", null)), OUT = opt("--out", null);

const queue = [...sites];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    // The root often redirects (microsoft.com/ -> /en-us/); follow the index's
    // recorded redirect target, up to two hops, as a visitor's browser would.
    let target = `${s.domain}/`, caps = [];
    const norm = (k) => k.replace(/\?.*$/, "").replace(/\/+$/, "");
    for (let hop = 0; hop < 3 && !caps.length; hop++) {
      const key = norm(surt(target));
      const rows = (await capturesFor(CFG.collection, cluster, target.replace(/\?.*$/, ""), { maxBlocks: 3 })).filter((r) => norm(r.urlkey) === key);
      caps = rows.filter((r) => r.status === "200" && (r.mime === "text/html" || r["mime-detected"] === "text/html"));
      // Skip same-page hops (http to https, apex to www); follow one that leaves the page.
      const redirect = rows.map((r) => /^30\d$/.test(r.status) && r.redirect).find((t) => t && norm(surt(t.replace(/^https?:\/\//, ""))) !== key);
      if (caps.length || !redirect) break;
      target = redirect.replace(/^https?:\/\//, "").replace(/#.*$/, "");
    }
    const base = { group: "homepages", source: s.domain, sector: s.sector };
    if (!caps.length) { appendFileSync(OUT, JSON.stringify({ ...base, status: "no_capture" }) + "\n"); continue; }
    const r = caps[0];
    const page = homepageText(await fetchRecord(r));
    if (page.words < 100) { appendFileSync(OUT, JSON.stringify({ ...base, url: r.url, captured: r.timestamp, status: "too_short", words: page.words }) + "\n"); continue; }
    appendFileSync(OUT, JSON.stringify({ ...base, url: r.url, captured: r.timestamp, status: "measured", ...measure(page.text, page.words) }) + "\n");
  }
}));
console.error("done");
