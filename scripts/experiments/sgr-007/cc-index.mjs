// Look up Common Crawl captures for a URL prefix WITHOUT the index server
// (index.commoncrawl.org 504s under load). The crawl's zipnum CDX index is
// read directly: cluster.idx (one line per ~3,000 captures, sorted by SURT key)
// says which compressed block of which cdx-NNNNN.gz holds a key; that block is
// range-requested from data.commoncrawl.org and decompressed locally.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

export function surt(prefix) {
  // "www.punchng.com/2021/" -> "com,punchng)/2021/"
  const [host, ...path] = prefix.replace(/^https?:\/\//, "").split("/");
  const h = host.replace(/^www\./, "").split(".").reverse().join(",");
  return `${h})/${path.join("/")}`;
}

export function loadCluster(file) {
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => {
    const [key, shard, offset, length] = l.split("\t");
    return { key: key.split(" ")[0], shard, offset: +offset, length: +length };
  });
}

// Blocks whose key range can contain the prefix: the last block starting at or
// before it, then every following block until one starts past it.
export function blocksFor(cluster, key) {
  let lo = 0, hi = cluster.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cluster[mid].key <= key) lo = mid; else hi = mid - 1; }
  const out = [];
  for (let i = lo; i < cluster.length; i++) {
    if (i > lo && !cluster[i].key.startsWith(key) && cluster[i].key > key) break;
    out.push(cluster[i]);
  }
  return out;
}

export async function fetchBlock(collection, b, tries = 4) {
  const url = `https://data.commoncrawl.org/cc-index/collections/${collection}/indexes/${b.shard}`;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${b.offset}-${b.offset + b.length - 1}` }, signal: AbortSignal.timeout(60000) });
      if (r.status === 206 || r.status === 200) return gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8");
      await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
    } catch { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); }
  }
  return "";
}

// Every capture under the prefix: { url, timestamp, status, mime, filename, offset, length, languages }.
export async function capturesFor(collection, cluster, prefix, { maxBlocks = 40 } = {}) {
  const key = surt(prefix);
  const blocks = blocksFor(cluster, key).slice(0, maxBlocks);
  const rows = [];
  for (const b of blocks) {
    const text = await fetchBlock(collection, b);
    for (const line of text.split("\n")) {
      if (!line.startsWith(key)) continue;
      const j = line.indexOf("{");
      // "urlkey timestamp {json}": the key and timestamp are outside the JSON part.
      const [urlkey, timestamp] = line.slice(0, j).trim().split(" ");
      try { rows.push({ urlkey, timestamp, ...JSON.parse(line.slice(j)) }); } catch {}
    }
  }
  return rows;
}

// One WARC record's HTML body.
export async function fetchRecord(r, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://data.commoncrawl.org/${r.filename}`, { headers: { Range: `bytes=${r.offset}-${+r.offset + +r.length - 1}` }, signal: AbortSignal.timeout(60000) });
      if (res.status !== 206 && res.status !== 200) { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); continue; }
      const t = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
      const parts = t.split("\r\n\r\n");
      return parts.slice(2).join("\r\n\r\n");
    } catch { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); }
  }
  return "";
}
