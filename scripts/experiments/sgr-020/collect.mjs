#!/usr/bin/env bun
// SGR-020 collection: GOV.UK press releases and news stories, 2015 to 2026.
// Pre-registration: docs/research/sgr-020-preregistration.md (section 1).
//
//   bun scripts/experiments/sgr-020/collect.mjs index     # phase 1: list every item (Search API)
//   bun scripts/experiments/sgr-020/collect.mjs fetch     # phase 2: body of every item (Content API)
//   bun scripts/experiments/sgr-020/collect.mjs status    # counts
//   options: --dir ~/research/sgr-020  --rate 4  --limit N (fetch at most N items, for tests)
//
// Polite by design: User-Agent names us and a contact, a hard ceiling of --rate requests a
// second (default 4; GOV.UK asks for no more than 10), back-off on 429/5xx honouring
// Retry-After, resumable at any point (re-run the same command), everything logged.
// Text is stored for the day-before run and is never committed or published.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = (opt("--dir", `${homedir()}/research/sgr-020`)).replace(/^~/, homedir());
const RATE = Math.min(Number(opt("--rate", 4)), 5); // never above 5 a second
const LIMIT = Number(opt("--limit", Infinity));
const UA = "ScriptGrain research (contact support@scriptgrain.com) - academic-style study of GOV.UK press releases; Open Government Licence v3.0";
const TYPES = ["press_release", "news_story"];
const FIRST_MONTH = "2015-01", LAST_MONTH = opt("--last-month", "2026-10"); // the last window is open-ended
mkdirSync(`${DIR}/index`, { recursive: true });
mkdirSync(`${DIR}/bodies`, { recursive: true });
const LOG = `${DIR}/collect.log`;
const log = (...a) => { const l = `${new Date().toISOString()} ${a.join(" ")}`; console.log(l); appendFileSync(LOG, l + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One shared pacer: request starts are at least 1/RATE seconds apart, whatever the concurrency.
let nextSlot = 0;
async function pace() { const now = Date.now(); const at = Math.max(now, nextSlot); nextSlot = at + 1000 / RATE; if (at > now) await sleep(at - now); }
async function get(url, tries = 7) {
  for (let t = 0; t < tries; t++) {
    await pace();
    let res;
    try { res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(30000) }); }
    catch (e) { log("net-error", url, String(e.message ?? e)); await sleep(2000 * 2 ** t); continue; }
    if (res.status === 200) return { status: 200, json: await res.json(), url: res.url };
    if (res.status === 404 || res.status === 410) return { status: res.status };
    const ra = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * 2 ** t;
    log("http", res.status, url, `retry in ${wait}ms`);
    await sleep(wait);
  }
  throw new Error(`gave up on ${url}`);
}

const months = [];
for (let y = 2015, m = 1; `${y}-${String(m).padStart(2, "0")}` <= LAST_MONTH; m++) { if (m > 12) { m = 1; y++; } months.push(`${y}-${String(m).padStart(2, "0")}`); if (months.at(-1) === LAST_MONTH) break; }
const monthRange = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const to = ym === LAST_MONTH ? "" : `${new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)}`; // last day of month, inclusive
  return `from:${from}${to ? `,to:${to}` : ""}`;
};

// ── Phase 1: index ────────────────────────────────────────────────────────────────────────
async function indexPhase() {
  const FIELDS = ["title", "link", "public_timestamp", "primary_publishing_organisation", "organisations", "government_name", "is_withdrawn", "content_store_document_type", "world_locations"];
  for (const ym of months) {
    const file = `${DIR}/index/${ym}.json`;
    if (existsSync(file) && ym !== LAST_MONTH) continue;
    const items = [];
    let total = null;
    for (let start = 0; ; start += 500) {
      const q = TYPES.map((t) => `filter_content_store_document_type[]=${t}`).join("&") + `&filter_public_timestamp=${monthRange(ym)}&order=public_timestamp&count=500&start=${start}&fields=${FIELDS.join(",")}`;
      const r = await get(`https://www.gov.uk/api/search.json?${q}`);
      if (r.status !== 200) throw new Error(`index ${ym} status ${r.status}`);
      total = r.json.total;
      for (const x of r.json.results) items.push({
        path: x.link, ts: x.public_timestamp, type: x.content_store_document_type,
        org: x.primary_publishing_organisation?.[0] ?? null,
        orgs: (x.organisations ?? []).map((o) => o.slug),
        gov: x.government_name ?? null, withdrawn: !!x.is_withdrawn,
        wl: (x.world_locations ?? []).length, // kept so embassy-style items could be identified
      });
      if (r.json.results.length < 500 || start + 500 >= total) break;
    }
    if (items.length !== total) throw new Error(`index ${ym}: got ${items.length} of ${total}`);
    writeFileSync(file, JSON.stringify({ month: ym, total, indexedAt: new Date().toISOString(), items }));
    log("indexed", ym, items.length);
  }
}

// ── Phase 2: bodies ───────────────────────────────────────────────────────────────────────
const bodyFile = (ym) => `${DIR}/bodies/${ym}.jsonl.gz`;
const partFile = (ym) => `${DIR}/bodies/${ym}.part.jsonl`;
const readLines = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
async function fetchPhase() {
  let fetched = 0;
  for (const ym of months) {
    if (existsSync(bodyFile(ym)) && ym !== LAST_MONTH) continue;
    const idx = JSON.parse(readFileSync(`${DIR}/index/${ym}.json`, "utf8"));
    const done = new Set(readLines(partFile(ym)).map((l) => JSON.parse(l).path));
    const todo = idx.items.filter((x) => !done.has(x.path));
    let i = 0;
    const worker = async () => {
      while (i < todo.length && fetched < LIMIT) {
        const it = todo[i++]; fetched++;
        const r = await get(`https://www.gov.uk/api/content${it.path}`);
        let row;
        if (r.status !== 200) row = { path: it.path, missing: r.status };
        else {
          const j = r.json, d = j.details ?? {};
          row = {
            path: it.path, schema: j.schema_name, type: j.document_type, locale: j.locale,
            first: j.first_published_at ?? null, updated: j.public_updated_at ?? null,
            withdrawn: !!(j.withdrawn_notice && Object.keys(j.withdrawn_notice).length),
            political: d.political ?? null, org: j.links?.primary_publishing_organisation?.[0]?.base_path?.split("/").pop() ?? null,
            title: j.title, body: d.body ?? null,
            redirected: r.url && !r.url.endsWith(it.path) ? r.url : undefined,
          };
        }
        appendFileSync(partFile(ym), JSON.stringify(row) + "\n");
        if (fetched % 200 === 0) log("progress", ym, `${fetched} fetched this run`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (fetched >= LIMIT) { log("limit reached", fetched); return; }
    const lines = readLines(partFile(ym));
    if (lines.length !== idx.items.length) throw new Error(`${ym}: ${lines.length} rows for ${idx.items.length} items`);
    writeFileSync(bodyFile(ym) + ".tmp", gzipSync(lines.join("\n") + "\n", { level: 9 }));
    renameSync(bodyFile(ym) + ".tmp", bodyFile(ym));
    if (ym !== LAST_MONTH) { try { (await import("node:fs")).unlinkSync(partFile(ym)); } catch {} }
    log("month complete", ym, lines.length);
  }
}

function status() {
  const idx = readdirSync(`${DIR}/index`).filter((f) => f.endsWith(".json")).sort();
  let n = 0; for (const f of idx) n += JSON.parse(readFileSync(`${DIR}/index/${f}`, "utf8")).items.length;
  const bodies = readdirSync(`${DIR}/bodies`);
  let b = 0; for (const f of bodies) { if (f.endsWith(".jsonl.gz")) b += gunzipSync(readFileSync(`${DIR}/bodies/${f}`)).toString().split("\n").filter(Boolean).length; else if (f.endsWith(".part.jsonl")) b += readLines(`${DIR}/bodies/${f}`).length; }
  console.log(JSON.stringify({ months_indexed: idx.length, items_indexed: n, bodies_fetched: b }));
}

if (cmd === "index") await indexPhase();
else if (cmd === "fetch") await fetchPhase();
else if (cmd === "status") status();
else { console.error("usage: collect.mjs index|fetch|status"); process.exit(2); }
