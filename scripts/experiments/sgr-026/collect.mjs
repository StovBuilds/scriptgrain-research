#!/usr/bin/env bun
// SGR-026 collection: first revisions of new English Wikipedia articles, sampled by month.
// Pre-registration: docs/research/sgr-026-preregistration.md (section 1).
//
//   bun scripts/experiments/sgr-026/collect.mjs bounds       # phase 1: first page id of each month, 2015-01 .. 2026-10
//   bun scripts/experiments/sgr-026/collect.mjs index        # phase 2: seeded random page ids per month -> articles that exist today
//   bun scripts/experiments/sgr-026/collect.mjs fetch        # phase 3: first revision (wikitext) + early history of each sampled article
//   bun scripts/experiments/sgr-026/collect.mjs users        # phase 4: is the first-revision author a bot account today
//   bun scripts/experiments/sgr-026/collect.mjs deletions    # phase 5: share of mainspace creations in the creation log that were later deleted (2018-07 on)
//   bun scripts/experiments/sgr-026/collect.mjs all          # 1 to 5 in order
//   bun scripts/experiments/sgr-026/collect.mjs status
//   options: --dir ~/research/sgr-026  --per-month 120  --last-month 2026-09  --months 2024-01,2024-02 (restrict, for pilots)
//
// MediaWiki Action API, https://en.wikipedia.org/w/api.php. Polite by design: User-Agent names us and a
// contact, strictly serial requests (one in flight, at least 250 ms apart), maxlag=5 on every request
// (the servers tell us to wait when the replicas lag; we wait as long as Retry-After says), back-off on
// 429/5xx, resumable at any point (re-run the same command), every retry logged. Text is stored for the
// day-before run and is never committed or published (Wikipedia text is CC BY-SA 4.0).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const DIR = opt("--dir", `${homedir()}/research/sgr-026`).replace(/^~/, homedir());
const PER_MONTH = Number(opt("--per-month", 120));
const FIRST_MONTH = "2015-01", LAST_MONTH = opt("--last-month", "2026-09");
const ONLY = opt("--months", null)?.split(",") ?? null;
const API = "https://en.wikipedia.org/w/api.php";
const UA = "ScriptGrain research (support@scriptgrain.com) - word-frequency study of new English Wikipedia articles; numbers only, no text published";
for (const d of ["", "/index", "/bodies"]) mkdirSync(DIR + d, { recursive: true });
const LOG = `${DIR}/collect.log`;
const log = (...a) => { const l = `${new Date().toISOString()} ${a.join(" ")}`; console.log(l); appendFileSync(LOG, l + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };
const monthsAll = []; for (let ym = FIRST_MONTH; ym <= LAST_MONTH; ym = nextMonth(ym)) monthsAll.push(ym);
const months = ONLY ? monthsAll.filter((m) => ONLY.includes(m)) : monthsAll;
const startOf = (ym) => `${ym}-01T00:00:00Z`;

// ── API access: serial, maxlag, back-off ──────────────────────────────────────────────────
let last = 0, requests = 0;
const MIN_GAP = Number(opt("--gap-ms", 250)); // at least 250 ms between request starts: serial, about 4 a second at most
let GAP_MS = MIN_GAP, okRun = 0; // adaptive: a 429 widens the gap by half (to 3 s at most); 100 clean requests narrow it by a tenth
async function api(params, tries = 8) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: 2, maxlag: 5, ...params })) u.searchParams.set(k, v);
  for (let t = 0; t < tries; t++) {
    const gap = Date.now() - last; if (gap < GAP_MS) await sleep(GAP_MS - gap);
    let res;
    try { last = Date.now(); res = await fetch(u, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(60000) }); }
    catch (e) { log("net-error", String(e.message ?? e)); await sleep(2000 * 2 ** Math.min(t, 5)); continue; }
    requests++;
    if (res.status === 429) { GAP_MS = Math.min(GAP_MS * 1.5, 3000); okRun = 0; } else if (++okRun >= 100) { GAP_MS = Math.max(MIN_GAP, GAP_MS * 0.9); okRun = 0; }
    const ra = Number(res.headers.get("retry-after"));
    if (res.status === 200) {
      const j = await res.json();
      if (j.error?.code === "maxlag") { const w = (Number.isFinite(ra) && ra > 0 ? ra : 5) * 1000; log("maxlag", `wait ${w}ms`); await sleep(w); continue; }
      if (j.error) throw new Error(`api error ${j.error.code}: ${j.error.info} (${u.search.slice(0, 200)})`);
      return j;
    }
    const w = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * 2 ** Math.min(t, 5);
    log("http", res.status, `retry in ${w}ms`);
    await sleep(w);
  }
  throw new Error(`gave up: ${u.search.slice(0, 200)}`);
}
const writeJson = (f, o) => { writeFileSync(f + ".tmp", JSON.stringify(o)); renameSync(f + ".tmp", f); };

// ── Phase 1: bounds. boundary[ym] = lowest page id whose first revision is at or after the start of ym ──
// Page ids are handed out in creation order, so a month is (almost) an interval of ids. Imported pages
// keep old timestamps; they are rare and the month of every sampled page is re-read from its own first revision.
const bFile = `${DIR}/bounds.json`;
const bounds = existsSync(bFile) ? JSON.parse(readFileSync(bFile, "utf8")) : {};
/** First-revision time of the first page at or after `id` that exists (any namespace). */
async function tsAt(id) {
  for (let hop = 0; hop < 40; hop++, id += 50) {
    const ids = Array.from({ length: 50 }, (_, i) => id + i).join("|");
    const j = await api({ action: "query", prop: "info", pageids: ids });
    const p = j.query.pages.find((x) => !x.missing);
    if (!p) continue;
    const r = await api({ action: "query", pageids: p.pageid, prop: "revisions", rvdir: "newer", rvlimit: 1, rvprop: "timestamp" });
    const ts = r.query.pages[0]?.revisions?.[0]?.timestamp;
    if (ts) return { id: p.pageid, ts };
  }
  return { id, ts: "9999" }; // past the newest page: counts as "after" any boundary
}
async function boundsPhase() {
  const need = monthsAll.concat([nextMonth(LAST_MONTH)]);
  let prevWidth = 300000;
  for (let i = 0; i < need.length; i++) {
    const ym = need[i];
    if (bounds[ym] != null) { if (i > 0 && bounds[need[i - 1]] != null) prevWidth = bounds[ym] - bounds[need[i - 1]]; continue; }
    let lo = i === 0 ? 30000000 : bounds[need[i - 1]], hi;
    if (i === 0) { hi = 60000000; } else { hi = lo + Math.max(2 * prevWidth, 100000); }
    // make sure hi is past the boundary (ts >= start); expand if not. The newest boundary may be beyond the newest page: then use the newest id.
    for (let g = 0; g < 8; g++) { const x = await tsAt(hi); if (x.ts >= startOf(ym)) break; lo = hi; hi *= i === 0 ? 1.2 : 1; hi = Math.floor(hi + Math.max(2 * prevWidth, 100000)); }
    while (hi - lo > 50) {
      const mid = Math.floor((lo + hi) / 2);
      const x = await tsAt(mid);
      if (x.ts < startOf(ym)) lo = mid; else hi = mid;
    }
    bounds[ym] = hi;
    if (i > 0) prevWidth = bounds[ym] - bounds[need[i - 1]];
    writeJson(bFile, bounds);
    log("bound", ym, hi, `width ${i > 0 ? prevWidth : "-"}`);
  }
}

// ── Phase 2: index. Seeded random ids from the month's interval; keep the ones that are articles today ──
const seedOf = (label) => parseInt(createHash("sha1").update(label).digest("hex").slice(0, 8), 16);
function rngFor(label) { let s = seedOf(label); return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function indexPhase() {
  for (const ym of months) {
    const file = `${DIR}/index/${ym}.json`;
    if (existsSync(file)) continue;
    const lo = bounds[ym], hi = bounds[nextMonth(ym)];
    if (lo == null || hi == null) throw new Error(`no bounds for ${ym}: run the bounds phase`);
    const rnd = rngFor(`sgr-026|${ym}`);
    const seen = new Set(); const kept = []; const c = { drawn: 0, missing: 0, other_namespace: 0, redirect: 0, disambiguation: 0, article: 0 };
    const MAXDRAW = Math.min(hi - lo, 40000);
    while (kept.length < PER_MONTH && c.drawn < MAXDRAW) {
      const batch = [];
      while (batch.length < 50 && seen.size < hi - lo) { const id = lo + Math.floor(rnd() * (hi - lo)); if (!seen.has(id)) { seen.add(id); batch.push(id); } }
      if (!batch.length) break;
      const j = await api({ action: "query", prop: "info|pageprops", ppprop: "disambiguation", pageids: batch.join("|") });
      const byId = new Map(j.query.pages.map((p) => [p.pageid, p]));
      for (const id of batch) { // in draw order, so the sample is the first PER_MONTH eligible draws
        c.drawn++;
        const p = byId.get(id);
        if (!p || p.missing) { c.missing++; continue; }
        if (p.ns !== 0) { c.other_namespace++; continue; }
        if (p.redirect) { c.redirect++; continue; }
        if (p.pageprops && "disambiguation" in p.pageprops) { c.disambiguation++; continue; }
        c.article++;
        if (kept.length < PER_MONTH) kept.push({ pageid: id, title: p.title, length: p.length, lastrevid: p.lastrevid });
      }
    }
    // when the sample filled early, `drawn` stops at the draw that completed it; the shares below are over ids drawn up to that point
    writeJson(file, { month: ym, lo, hi, ids_in_interval: hi - lo, indexedAt: new Date().toISOString(), counts: c, items: kept });
    log("indexed", ym, `kept ${kept.length}`, JSON.stringify(c));
  }
}

// ── Phase 3: first revision and early history ───────────────────────────────────────────────
const bodyFile = (ym) => `${DIR}/bodies/${ym}.jsonl.gz`;
const partFile = (ym) => `${DIR}/bodies/${ym}.part.jsonl`;
const readLines = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
const MOVED = /\bmoved page\b|\bmoved\b.*\bto\b.*\[\[|\bmoved from\b|\bmerged from\b/i;
async function fetchPhase() {
  // spread order (every fourth month first, then the next set) so that a partly finished collection already covers every era;
  // the order changes nothing about what is collected
  const spread = months.map((m, i) => [m, i % 4, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
  for (const ym of spread) {
    if (existsSync(bodyFile(ym))) continue;
    const idx = JSON.parse(readFileSync(`${DIR}/index/${ym}.json`, "utf8"));
    const done = new Set(readLines(partFile(ym)).map((l) => JSON.parse(l).pageid));
    for (const it of idx.items) {
      if (done.has(it.pageid)) continue;
      const r = await api({ action: "query", pageids: it.pageid, prop: "revisions", rvdir: "newer", rvlimit: 1, rvslots: "main", rvprop: "ids|timestamp|user|userid|comment|tags|size|content" });
      const pg = r.query.pages[0];
      const rev = pg?.revisions?.[0];
      let row;
      if (!rev) row = { pageid: it.pageid, missing: true };
      else {
        const h = await api({ action: "query", pageids: it.pageid, prop: "revisions", rvdir: "newer", rvlimit: 50, rvprop: "ids|timestamp|user|comment|tags|size" });
        const hist = h.query.pages[0]?.revisions ?? [];
        const moves = hist.filter((x) => x.comment && MOVED.test(x.comment)).map((x) => ({ ts: x.timestamp, comment: x.comment.slice(0, 240), tags: x.tags }));
        row = {
          pageid: it.pageid, title: pg.title, revid: rev.revid, parentid: rev.parentid, ts: rev.timestamp,
          user: rev.userhidden ? null : rev.user ?? null, anon: !!rev.anon || rev.userid === 0, comment: (rev.comment ?? "").slice(0, 300), tags: rev.tags ?? [], size: rev.size,
          text: rev.slots?.main?.content ?? null, model: rev.slots?.main?.contentmodel ?? null,
          history_revs: hist.length, history_truncated: hist.length >= 50, moves,
        };
      }
      appendFileSync(partFile(ym), JSON.stringify(row) + "\n");
    }
    const lines = readLines(partFile(ym));
    if (lines.length !== idx.items.length) throw new Error(`${ym}: ${lines.length} rows for ${idx.items.length} items`);
    writeFileSync(bodyFile(ym) + ".tmp", gzipSync(lines.join("\n") + "\n", { level: 9 }));
    renameSync(bodyFile(ym) + ".tmp", bodyFile(ym));
    try { (await import("node:fs")).unlinkSync(partFile(ym)); } catch {}
    log("month complete", ym, lines.length, `requests so far ${requests}`);
  }
}

// ── Phase 4: bot accounts (current group membership of every first-revision author) ───────────
async function usersPhase() {
  const f = `${DIR}/users.json`;
  const known = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  const names = new Set();
  for (const b of readdirSync(`${DIR}/bodies`).filter((x) => x.endsWith(".jsonl.gz")))
    for (const l of gunzipSync(readFileSync(`${DIR}/bodies/${b}`)).toString().split("\n")) { if (!l) continue; const r = JSON.parse(l); if (r.user && !r.anon) names.add(r.user); }
  const todo = [...names].filter((n) => !(n in known)).sort();
  log("users to look up", todo.length);
  for (let i = 0; i < todo.length; i += 50) {
    const chunk = todo.slice(i, i + 50);
    const j = await api({ action: "query", list: "users", ususers: chunk.join("|"), usprop: "groups|registration" });
    const got = new Map(j.query.users.map((u) => [u.name, u]));
    for (const n of chunk) { const u = got.get(n); known[n] = u && !u.missing ? { groups: u.groups ?? [], reg: u.registration ?? null } : null; }
    if ((i / 50) % 20 === 0) writeJson(f, known);
  }
  writeJson(f, known);
  log("users done", Object.keys(known).length);
}

// ── Phase 5: deletions. The creation log (type "create") starts in mid-2018; an entry whose pageid is 0 was deleted ──
async function deletionsPhase() {
  const f = `${DIR}/deletions.json`;
  const out = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  const WINDOWS = 8, PER = 250;
  for (const ym of monthsAll.filter((m) => m >= "2018-07")) {
    if (out[ym]) continue;
    const rnd = rngFor(`sgr-026|deletions|${ym}`);
    const [y, m] = ym.split("-").map(Number); const span = Date.UTC(y, m, 1) - Date.UTC(y, m - 1, 1);
    let total = 0, deleted = 0, redirectish = 0;
    const starts = Array.from({ length: WINDOWS }, () => Date.UTC(y, m - 1, 1) + Math.floor(rnd() * (span - 12 * 3600e3)));
    for (const s of starts.sort()) {
      const j = await api({ action: "query", list: "logevents", letype: "create", lenamespace: 0, ledir: "newer", lestart: new Date(s).toISOString().replace(/\.\d+Z$/, "Z"), lelimit: PER, leprop: "ids|timestamp|comment" });
      for (const e of j.query.logevents) {
        total++;
        if (!e.pageid) deleted++;
        else if (/^#?\s*redirect|redirected? page to/i.test(e.comment ?? "")) redirectish++;
      }
    }
    out[ym] = { entries: total, deleted, windows: WINDOWS };
    writeJson(f, out);
    log("deletions", ym, JSON.stringify(out[ym]));
  }
}

// ── Phase 6 (only when needed): repair month boundaries that the sample itself shows to be off ──
// A single imported page (old timestamp) can send the plain binary search the wrong way. After `fetch`, a month whose
// first revisions fall outside the month in more than 6% of cases is re-bounded with a more robust probe (the median
// first-revision time of five pages instead of one); the months that depend on a moved boundary are cleared and
// then re-indexed and re-fetched by the normal phases. This looks only at timestamps, never at text or measures.
async function medianTsAt(id) {
  const got = [];
  for (let hop = 0; hop < 60 && got.length < 5; hop++, id += 50) {
    const j = await api({ action: "query", prop: "info", pageids: Array.from({ length: 50 }, (_, i) => id + i).join("|") });
    for (const p of j.query.pages.filter((x) => !x.missing)) {
      if (got.length >= 5) break;
      const r = await api({ action: "query", pageids: p.pageid, prop: "revisions", rvdir: "newer", rvlimit: 1, rvprop: "timestamp" });
      const ts = r.query.pages[0]?.revisions?.[0]?.timestamp; if (ts) got.push(ts);
    }
  }
  if (!got.length) return "9999";
  return got.sort()[got.length >> 1];
}
async function repairPhase() {
  const { unlinkSync } = await import("node:fs");
  const need = monthsAll.concat([nextMonth(LAST_MONTH)]);
  const flagged = new Map(); // boundary month -> reason
  for (const ym of monthsAll) {
    const f = bodyFile(ym); if (!existsSync(f)) continue;
    const rows = gunzipSync(readFileSync(f)).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.ts);
    const later = rows.filter((r) => r.ts.slice(0, 7) > ym).length, earlier = rows.filter((r) => r.ts.slice(0, 7) < ym).length;
    if (later / rows.length > 0.06) flagged.set(nextMonth(ym), `${later}/${rows.length} of ${ym} are later`);
    if (earlier / rows.length > 0.06) flagged.set(ym, `${earlier}/${rows.length} of ${ym} are earlier`);
  }
  log("boundaries to repair", JSON.stringify([...flagged]));
  for (const [ym, why] of flagged) {
    const i = need.indexOf(ym); const lo0 = bounds[need[i - 1]] ?? 30000000, hi0 = bounds[need[i + 1]] ?? bounds[ym] + 600000;
    let lo = lo0, hi = hi0;
    while (hi - lo > 50) { const mid = Math.floor((lo + hi) / 2); const ts = await medianTsAt(mid); if (ts < startOf(ym)) lo = mid; else hi = mid; }
    log("repaired boundary", ym, `was ${bounds[ym]} now ${hi}`, why);
    bounds[ym] = hi; writeJson(bFile, bounds);
    for (const mm of [need[i - 1], ym]) for (const f of [`${DIR}/index/${mm}.json`, bodyFile(mm), partFile(mm)]) { try { unlinkSync(f); } catch {} }
  }
}

function status() {
  const idx = readdirSync(`${DIR}/index`).filter((f) => f.endsWith(".json")).sort();
  let n = 0; for (const f of idx) n += JSON.parse(readFileSync(`${DIR}/index/${f}`, "utf8")).items.length;
  const bodies = readdirSync(`${DIR}/bodies`);
  let b = 0; for (const f of bodies) { if (f.endsWith(".jsonl.gz")) b += gunzipSync(readFileSync(`${DIR}/bodies/${f}`)).toString().split("\n").filter(Boolean).length; else if (f.endsWith(".part.jsonl")) b += readLines(`${DIR}/bodies/${f}`).length; }
  console.log(JSON.stringify({ months_expected: monthsAll.length, bounds: Object.keys(bounds).length, months_indexed: idx.length, articles_sampled: n, first_revisions_fetched: b, users: existsSync(`${DIR}/users.json`), deletions: existsSync(`${DIR}/deletions.json`) }));
}

if (cmd === "bounds") await boundsPhase();
else if (cmd === "index") await indexPhase();
else if (cmd === "fetch") await fetchPhase();
else if (cmd === "users") await usersPhase();
else if (cmd === "deletions") await deletionsPhase();
else if (cmd === "all") { await boundsPhase(); await indexPhase(); await fetchPhase(); await usersPhase(); await deletionsPhase(); }
else if (cmd === "repair") await repairPhase();
else if (cmd === "status") status();
else { console.error("usage: collect.mjs bounds|index|fetch|users|deletions|repair|all|status"); process.exit(2); }
log("exit", cmd, `requests this run ${requests}`);
