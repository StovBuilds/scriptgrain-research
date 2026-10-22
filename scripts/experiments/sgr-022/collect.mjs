#!/usr/bin/env node
// SGR-022 collection (docs/research/sgr-022-preregistration.md section 1). Politeness, resumable, logged.
// Reads only public metadata and answer text from the UK Parliament Written Questions and
// Statements API (Open Parliament Licence). Nothing here reads an outcome measure.
//   node collect.mjs index [s|q]  list questions (by tabled week) and statements (by month) -> index/
//   node collect.mjs sample       fixed-seed sample of answered questions -> sample.json   (needs lib.mjs units)
//   node collect.mjs fetch [--pilot]  full text of every sampled question and every statement -> bodies/
//   node collect.mjs status
// Data: ~/research/sgr-022-hansard/ (never committed, never published).
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, createWriteStream, readdirSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { unitOf, SAMPLE, FRAME } from "./lib.mjs";

const HOME = process.env.HOME;
export const DATA = process.env.SGR022_DATA ?? `${HOME}/research/sgr-022-hansard`;
const API = "https://questions-statements-api.parliament.uk/api";
const UA = "ScriptGrain research (support@scriptgrain.com)";
mkdirSync(`${DATA}/index`, { recursive: true }); mkdirSync(`${DATA}/bodies`, { recursive: true });
const LOG = `${DATA}/collect.log`;
const log = (...a) => { const l = `${new Date().toISOString()} ${a.join(" ")}`; console.log(l); appendFileSync(LOG, l + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One global pacer: at most 1 / MIN_GAP requests a second across all workers.
const MIN_GAP = Number(process.env.SGR022_GAP_MS ?? 350); // about 2.9 a second
let nextSlot = 0;
async function pace() { const now = Date.now(); const at = Math.max(now, nextSlot); nextSlot = at + MIN_GAP; if (at > now) await sleep(at - now); }
async function get(path, { tries = 7 } = {}) {
  for (let i = 0; i < tries; i++) {
    await pace();
    try {
      const r = await fetch(API + path, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(90_000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      const wait = r.status === 429 ? Number(r.headers.get("retry-after") ?? 30) * 1000 : 4000 * 2 ** i;
      log("WARN", r.status, path, `retry in ${Math.round(wait / 1000)}s (${i + 1}/${tries})`);
      await sleep(Math.min(wait, 120_000));
    } catch (e) { log("WARN", "net", String(e.message ?? e).slice(0, 80), path, `(${i + 1}/${tries})`); await sleep(Math.min(4000 * 2 ** i, 120_000)); }
  }
  log("ERROR", "gave up", path); return undefined;
}
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const readLines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

// ── index ───────────────────────────────────────────────────────────────────
const qRow = (v) => ({ id: v.id, house: v.house, uin: v.uin, tabled: v.dateTabled?.slice(0, 10), answered: v.dateAnswered?.slice(0, 10) ?? null, body: v.answeringBodyId, bodyName: v.answeringBodyName, withdrawn: v.isWithdrawn, holding: v.answerIsHolding, correction: v.answerIsCorrection, corrected: v.dateAnswerCorrected?.slice(0, 10) ?? null, attachments: v.attachmentCount });
const sRow = (v) => ({ id: v.id, house: v.house, uin: v.uin, made: v.dateMade?.slice(0, 10), body: v.answeringBodyId, bodyName: v.answeringBodyName, attachments: (v.attachments ?? []).length, hasAttachments: v.hasAttachments });

async function pagedWindow(kind, from, to) {
  const base = kind === "q" ? `/writtenquestions/questions?take=100&answered=Answered&tabledWhenFrom=${from}&tabledWhenTo=${to}` : `/writtenstatements/statements?take=100&madeWhenFrom=${from}&madeWhenTo=${to}`;
  const rows = new Map(); let total = null;
  for (let skip = 0; total === null || skip < total; skip += 100) {
    const j = await get(`${base}&skip=${skip}`);
    if (!j) return null;
    total = j.totalResults;
    for (const x of j.results) rows.set(x.value.id, (kind === "q" ? qRow : sRow)(x.value));
    if (!j.results.length) break;
  }
  return { rows: [...rows.values()], total };
}
async function indexWindows(kind, windows, file, stateFile, workers) {
  const state = readJson(stateFile, {});
  const todo = windows.filter(([f]) => !state[f]);
  log("index", kind, `${todo.length} of ${windows.length} windows to do`);
  let i = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (i < todo.length) {
      const [from, to] = todo[i++];
      let res = await pagedWindow(kind, from, to);
      if (res && res.rows.length < res.total * 0.995 && from !== to && kind === "q") {
        // skip paging dropped rows: redo this window day by day
        log("WARN", "short window", from, `${res.rows.length}/${res.total}; redoing by day`);
        const m = new Map(); let tot = 0;
        for (let d = from; d <= to; d = addDays(d, 1)) { const r = await pagedWindow(kind, d, d); if (!r) { res = null; break; } tot += r.total; r.rows.forEach((x) => m.set(x.id, x)); }
        if (res) res = { rows: [...m.values()], total: tot };
      }
      if (!res) { log("ERROR", "window failed", kind, from, to); continue; }
      if (res.rows.length < res.total * 0.995) log("WARN", "window incomplete", kind, from, `${res.rows.length}/${res.total}`);
      if (res.rows.length) appendFileSync(file, res.rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
      state[from] = { to, total: res.total, got: res.rows.length };
      writeFileSync(stateFile, JSON.stringify(state));
      if ((i % 25) === 0) log("progress", kind, `${i}/${todo.length}`, from);
    }
  }));
}
async function index(which = "sq") {
  // Statements: monthly windows. Questions: weekly windows by TABLED date (answered-date filters time out on this API).
  // The question frame starts a quarter early so answers given from 1 Jan 2015 to questions tabled just before are caught.
  const months = []; for (let y = 2015; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const f = `${y}-${String(m).padStart(2, "0")}-01`; const t = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1); if (f <= "2026-10-10") months.push([f, t]); }
  if (which.includes("s")) await indexWindows("s", months, `${DATA}/index/statements.jsonl`, `${DATA}/index/statements.state.json`, 1);
  const weeks = []; for (let d = FRAME.tabledFrom; d <= FRAME.tabledTo; d = addDays(d, 7)) weeks.push([d, addDays(d, 6)]);
  if (which.includes("q")) await indexWindows("q", weeks, `${DATA}/index/questions.jsonl`, `${DATA}/index/questions.state.json`, 3);
  log("index done");
}

// ── sample ──────────────────────────────────────────────────────────────────
const rank = (id) => createHash("sha256").update(`${SAMPLE.seed}|${id}`).digest("hex");
export function drawSample(rows) {
  const frame = rows.filter((r) => r.answered && r.answered >= FRAME.answeredFrom && r.answered <= FRAME.answeredTo && !r.withdrawn && !r.holding);
  const dedup = [...new Map(frame.map((r) => [r.id, r])).values()];
  const out = []; const report = {};
  for (let y = 2015; y <= 2026; y++) {
    const ys = dedup.filter((r) => +r.answered.slice(0, 4) === y);
    const by = new Map(); for (const r of ys) { const u = unitOf(r.bodyName); if (!by.has(u)) by.set(u, []); by.get(u).push(r); }
    for (const v of by.values()) v.sort((a, b) => (rank(a.id) < rank(b.id) ? -1 : 1));
    // water-filling: every unit gets min(size, FLOOR); the rest of the year's quota is shared in proportion to size
    const take = new Map([...by].map(([u, v]) => [u, Math.min(v.length, SAMPLE.floorPerUnitYear)]));
    let left = SAMPLE.perYear - [...take.values()].reduce((a, b) => a + b, 0);
    for (let guard = 0; left > 0 && guard < 50; guard++) {
      const room = [...by].filter(([u, v]) => take.get(u) < v.length);
      const tot = room.reduce((a, [, v]) => a + v.length, 0); if (!tot) break;
      let used = 0;
      for (const [u, v] of room) { const add = Math.min(v.length - take.get(u), Math.floor((left * v.length) / tot)); take.set(u, take.get(u) + add); used += add; }
      if (!used) { for (const [u, v] of room) { if (left - used > 0 && take.get(u) < v.length) { take.set(u, take.get(u) + 1); used++; } } }
      left -= used;
    }
    report[y] = { frame: ys.length, sampled: 0, units: {} };
    for (const [u, v] of by) { const k = take.get(u); out.push(...v.slice(0, k).map((r) => ({ ...r, unit: u }))); report[y].sampled += k; report[y].units[u] = { frame: v.length, sampled: k }; }
  }
  return { sample: out.sort((a, b) => a.id - b.id), report, frameSize: dedup.length };
}
function sample() {
  const rows = readLines(`${DATA}/index/questions.jsonl`);
  const { sample: s, report, frameSize } = drawSample(rows);
  writeFileSync(`${DATA}/sample.json`, JSON.stringify(s));
  writeFileSync(`${DATA}/sample-report.json`, JSON.stringify({ seed: SAMPLE.seed, perYear: SAMPLE.perYear, floorPerUnitYear: SAMPLE.floorPerUnitYear, indexRows: rows.length, frameSize, report }, null, 1));
  log("sample", s.length, "of", frameSize, "frame rows");
}

// ── fetch ───────────────────────────────────────────────────────────────────
function doneIds(file) { const s = new Set(); if (!existsSync(file)) return s; for (const l of gunzipSync(readFileSync(file)).toString().split("\n")) if (l) s.add(JSON.parse(l).id); return s; }
async function fetchKind(kind, items, file, workers = 1) {
  const done = doneIds(file); const todo = items.filter((x) => !done.has(x.id));
  log("fetch", kind, `${todo.length} to do, ${done.size} done`);
  let i = 0, batch = [], errs = 0;
  const flush = () => { if (batch.length) { appendFileSync(file, gzipSync(batch.map((r) => JSON.stringify(r)).join("\n") + "\n")); batch = []; } };
  await Promise.all(Array.from({ length: workers }, async () => {
    while (i < todo.length) {
      const it = todo[i++];
      const j = await get(kind === "q" ? `/writtenquestions/questions/${it.id}?expandMember=false` : `/writtenstatements/statements/${it.id}?expandMember=false`);
      if (j === undefined) { errs++; continue; }
      if (j === null) { batch.push({ id: it.id, missing: true }); }
      else { const v = j.value; batch.push(kind === "q" ? { id: v.id, house: v.house, uin: v.uin, tabled: v.dateTabled?.slice(0, 10), answered: v.dateAnswered?.slice(0, 10), body: v.answeringBodyId, bodyName: v.answeringBodyName, holding: v.answerIsHolding, correction: v.answerIsCorrection, corrected: v.dateAnswerCorrected?.slice(0, 10) ?? null, attachments: v.attachmentCount, heading: v.heading, question: v.questionText, answer: v.answerText } : { id: v.id, house: v.house, uin: v.uin, made: v.dateMade?.slice(0, 10), body: v.answeringBodyId, bodyName: v.answeringBodyName, title: v.title, text: v.text, attachments: (v.attachments ?? []).length }); }
      if (batch.length >= 200) { flush(); log("progress", kind, `${i}/${todo.length}`, `errors ${errs}`); }
    }
  }));
  flush(); log("fetch done", kind, `errors ${errs}`);
}
async function fetchAll() {
  const lim = process.env.SGR022_LIMIT ? Number(process.env.SGR022_LIMIT) : Infinity;
  const st = readLines(`${DATA}/index/statements.jsonl`).filter((r) => r.made >= FRAME.answeredFrom && r.made <= FRAME.answeredTo);
  const stUniq = [...new Map(st.map((r) => [r.id, r])).values()].sort((a, b) => a.id - b.id);
  const q = readJson(`${DATA}/sample.json`, []);
  // --pilot: only the 4% of items the pilot run reads (same hash as run.mjs). They are real corpus items, so the
  // full fetch later skips them; nothing is wasted. The pilot never reads an outcome.
  const keep = process.argv.includes("--pilot") ? (k, id) => parseInt(createHash("sha1").update(`${k}|${id}`).digest("hex").slice(0, 8), 16) % 100 < 4 : () => true;
  await fetchKind("q", q.filter((x) => keep("q", x.id)).slice(0, lim), `${DATA}/bodies/questions.jsonl.gz`);
  await fetchKind("s", stUniq.filter((x) => keep("s", x.id)).slice(0, lim), `${DATA}/bodies/statements.jsonl.gz`);
}
function status() {
  const q = readLines(`${DATA}/index/questions.jsonl`); const s = readLines(`${DATA}/index/statements.jsonl`);
  const qs = readJson(`${DATA}/index/questions.state.json`, {}); const ss = readJson(`${DATA}/index/statements.state.json`, {});
  console.log({ questionIndexRows: q.length, weeksDone: Object.keys(qs).length, statementRows: s.length, monthsDone: Object.keys(ss).length, sampled: readJson(`${DATA}/sample.json`, []).length, qBodies: doneIds(`${DATA}/bodies/questions.jsonl.gz`).size, sBodies: doneIds(`${DATA}/bodies/statements.jsonl.gz`).size });
}
const cmd = process.argv[2];
if (import.meta.main ?? process.argv[1]?.endsWith("collect.mjs")) {
  if (cmd === "index") await index(process.argv[3] ?? "sq"); else if (cmd === "sample") sample(); else if (cmd === "fetch") await fetchAll(); else if (cmd === "status") status();
  else console.log("usage: collect.mjs index | sample | fetch | status");
}
