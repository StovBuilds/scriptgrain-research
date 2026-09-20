#!/usr/bin/env bun
// SGR-003: how many samples does a voice profile need before it stabilises?
//
//   bun scripts/experiments/run-stability-study.mjs [--out public/research/sgr-003-profile-stability.json] [--resume]
//
// Protocol. Three public-domain authors (Project Gutenberg plain text, so the
// study is reproducible and needs nobody's consent): Dickens, Great
// Expectations (#1400); Austen, Pride and Prejudice (#1342); Emerson, Essays
// (#16643). Each text is cut into pieces of roughly 800 words at paragraph
// boundaries (one piece ~ one blog post). With a fixed seed, 15 training
// pieces and 4 held-out pieces are drawn per author; the training sets are
// NESTED (the 1-piece set is inside the 2-piece set, and so on) so the study
// measures what happens as samples are ADDED, not the luck of different draws.
//
// For k in {1, 2, 3, 5, 8, 15} a profile is extracted through the public API
// (api-v1, the same two-pass extraction every user gets) from the first k
// training pieces. Every profile is then measured with the product's own
// instrument, POST /v1/voice-match:
//   same    mean score of the author's 4 held-out pieces (never in any training set)
//   other   mean score of the other two authors' held-out pieces (8 pieces)
//   gap     same minus other: how well the profile tells its author from a stranger
// plus attribute agreement with the author's 15-piece profile (numeric
// attributes as absolute differences, enumerated attributes as agree/disagree)
// and the extraction's own confidence_score.
//
// Extractions are rate-limited at 5 per hour per account, so a full run is
// ~4 hours; results are written after every profile and --resume skips
// profiles already in the output file.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const OUT = opt("--out", "public/research/sgr-003-profile-stability.json");
const RESUME = args.includes("--resume");
const TEXT_DIR = opt("--texts", "/tmp/claude-1000/-home-jack/d913194c-a4e3-4701-b336-56c98e1839a1/scratchpad/gutenberg");
const KS = [15, 1, 3, 5, 8, 2]; // reference profile first so the attribute comparison is available early

function env(name) {
  const line = readFileSync(`${homedir()}/.bot-infra.env`, "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing`);
  return line.slice(name.length + 1).replace(/^['"]|['"]$/g, "");
}
const SB = env("SCRIPTGRAIN_SUPABASE_NEW_URL").replace(/\/$/, "");
const API_KEY = env("SCRIPTGRAIN_API_KEY");
const API = `${SB}/functions/v1/api-v1`;
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${m}\n`);

async function api(method, path, body) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429) {
      // Extraction slots: 5 per hour. Wait it out rather than fail the run.
      log(`  429 on ${path}; waiting 6 min (${j.error?.code ?? ""})`);
      await sleep(6 * 60 * 1000);
      continue;
    }
    if (!r.ok) throw new Error(`api ${path}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    return j.data ?? j;
  }
  throw new Error(`api ${path}: gave up after repeated 429s`);
}

// Deterministic PRNG (mulberry32) so the draw is reproducible.
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Gutenberg body only (between the START/END markers), paragraphs joined,
// cut into ~800-word pieces at paragraph boundaries. Chapter headings and
// very short paragraphs (running heads, "CHAPTER I") are dropped.
function pieces(file) {
  const raw = readFileSync(file, "utf8");
  const start = raw.search(/\*\*\* START OF THE PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/);
  const end = raw.search(/\*\*\* END OF THE PROJECT GUTENBERG EBOOK/);
  const body = raw.slice(start === -1 ? 0 : raw.indexOf("\n", start), end === -1 ? undefined : end);
  const paras = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => words(p) >= 12 && !/^(chapter|book|essay|[ivxlc]+\.?$)/i.test(p) && !/^\[?illustration/i.test(p));
  const out = [];
  let cur = [];
  let n = 0;
  for (const p of paras) {
    cur.push(p);
    n += words(p);
    if (n >= 800) { out.push(cur.join("\n\n")); cur = []; n = 0; }
  }
  return out.filter((p) => words(p) >= 600 && words(p) <= 1400);
}

const AUTHORS = [
  { key: "dickens", name: "Charles Dickens", work: "Great Expectations (1861)", gutenberg: 1400, file: `${TEXT_DIR}/1400.txt` },
  { key: "austen", name: "Jane Austen", work: "Pride and Prejudice (1813)", gutenberg: 1342, file: `${TEXT_DIR}/1342.txt` },
  { key: "emerson", name: "Ralph Waldo Emerson", work: "Essays, First and Second Series (1841, 1844)", gutenberg: 16643, file: `${TEXT_DIR}/16643.txt` },
];

const result = RESUME && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {
  study: "SGR-003",
  question: "How many writing samples does a voice profile need before it stabilises?",
  started_at: new Date().toISOString(),
  seed: 20260920,
  piece_target_words: 800,
  ks: [1, 2, 3, 5, 8, 15],
  authors: {},
  profiles: [],
};
const save = () => writeFileSync(OUT, JSON.stringify(result, null, 2));

// Draw the pieces.
for (const a of AUTHORS) {
  const all = pieces(a.file);
  const r = rng(result.seed + a.gutenberg);
  const idx = all.map((_, i) => i).sort(() => r() - 0.5);
  const training = idx.slice(0, 15).map((i) => all[i]);
  const held = idx.slice(15, 19).map((i) => all[i]);
  a.training = training;
  a.held = held;
  result.authors[a.key] = {
    name: a.name, work: a.work, gutenberg: a.gutenberg, pieces_available: all.length,
    training_words: training.map(words), held_out_words: held.map(words),
    training_sha: training.map((t) => Bun.hash(t).toString(16)), held_out_sha: held.map((t) => Bun.hash(t).toString(16)),
  };
  log(`${a.name}: ${all.length} pieces; training ${training.map(words).join("/")} words; held-out ${held.map(words).join("/")}`);
}
save();
if (args.includes("--dry")) { log("dry run: pieces drawn, nothing extracted"); process.exit(0); }

async function extract(a, k) {
  const name = `Study SGR-003 ${a.key} k=${k}`;
  const created = await api("POST", "/v1/profiles", { name, samples: a.training.slice(0, k) });
  const id = created.profile_id ?? created.id;
  log(`  created ${id} (${name})`);
  for (let i = 0; i < 120; i++) {
    await sleep(10000);
    const p = await api("GET", `/v1/profiles/${id}`);
    const status = p.status ?? p.profile?.status;
    if (status === "complete") return { id, profile: p.profile ?? p };
    if (status === "failed") throw new Error(`extraction failed: ${p.last_error ?? ""}`);
  }
  throw new Error("extraction timed out");
}

async function match(profileId, text) {
  const m = await api("POST", "/v1/voice-match", { profile_id: profileId, text });
  return { score: m.voice_match_score, raw: m.raw_score ?? null };
}

const NUMERIC = ["avg_sentence_length", "sentence_length_variance", "contraction_frequency", "comma_density", "semicolon_frequency", "exclamation_rate", "parenthetical_rate", "dash_frequency", "formality_score", "confidence_vs_hedging", "metaphor_usage_rate", "vocabulary_diversity_index", "rare_word_rate", "claim_density"];
const ENUMS = ["complexity_preference", "clause_ordering", "humour_register", "emotional_expressiveness", "opening_style", "argument_structure", "ellipsis_usage", "list_preference", "but_however_yet_preference", "specificity_level", "rhythm_pattern", "paragraph_length_preference", "power_sentence_position"];
const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

for (const k of KS) {
  for (const a of AUTHORS) {
    if (result.profiles.some((p) => p.author === a.key && p.k === k)) { log(`skip ${a.key} k=${k} (done)`); continue; }
    log(`extract ${a.key} k=${k} (${a.training.slice(0, k).reduce((s, t) => s + words(t), 0)} words)`);
    const { id, profile } = await extract(a, k);
    const attrs = profile.attributes ?? {};
    const same = [];
    for (const t of a.held) { same.push((await match(id, t)).score); await sleep(1500); }
    const other = [];
    for (const b of AUTHORS) {
      if (b.key === a.key) continue;
      for (const t of b.held) { other.push({ author: b.key, score: (await match(id, t)).score }); await sleep(1500); }
    }
    const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const entry = {
      author: a.key, k, profile_id: id, words: a.training.slice(0, k).reduce((s, t) => s + words(t), 0),
      confidence_score: profile.confidence_score ?? null,
      same_author: { scores: same, mean: +mean(same).toFixed(3) },
      other_authors: { scores: other, mean: +mean(other.map((o) => o.score)).toFixed(3) },
      gap: +(mean(same) - mean(other.map((o) => o.score))).toFixed(3),
      attributes: Object.fromEntries([...NUMERIC, ...ENUMS].map((key) => [key, attrs[key] ?? null])),
      measured_at: new Date().toISOString(),
    };
    result.profiles.push(entry);
    // Attribute agreement with the author's 15-piece profile, once it exists.
    const ref = result.profiles.find((p) => p.author === a.key && p.k === 15);
    for (const p of result.profiles.filter((p) => p.author === a.key)) {
      if (!ref || p.k === 15) continue;
      const numeric = {};
      for (const key of NUMERIC) { const x = num(p.attributes[key]); const y = num(ref.attributes[key]); if (x !== null && y !== null) numeric[key] = +(x - y).toFixed(3); }
      const enums = {};
      for (const key of ENUMS) { const x = p.attributes[key]; const y = ref.attributes[key]; if (x && y) enums[key] = String(x).toLowerCase().trim() === String(y).toLowerCase().trim(); }
      const agree = Object.values(enums);
      p.vs_reference = { numeric_delta: numeric, enum_agreement: enums, enum_agree_share: agree.length ? +(agree.filter(Boolean).length / agree.length).toFixed(2) : null };
    }
    save();
    log(`  ${a.key} k=${k}: same ${entry.same_author.mean} other ${entry.other_authors.mean} gap ${entry.gap} conf ${entry.confidence_score}`);
  }
}
result.finished_at = new Date().toISOString();
save();
log("done");
