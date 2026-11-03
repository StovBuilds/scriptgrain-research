// SGR-025 shared code: the frozen Index definition, the page measurement (a
// copy of SGR-004's measure.mjs row-building, proven against it by verify.mjs),
// statistics and a seeded bootstrap.
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { homepageText } from "../sgr-004/homepage-text.mjs";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const here = new URL(".", import.meta.url);
export const DEF = JSON.parse(readFileSync(new URL("index-definition.json", here), "utf8"));
export const PANEL = JSON.parse(readFileSync(new URL("../sgr-004/panel.json", here), "utf8")).sites;
export const LEX = JSON.parse(readFileSync(new URL("../sgr-004/lexicons.json", here), "utf8"));
export const SECTOR = Object.fromEntries(PANEL.map((s) => [s.domain, s.sector]));

export const MIN_WORDS = 100;
export const BOT_WALL = /request has been blocked|access denied|just a moment\.\.\.|attention required|enable javascript and cookies|are you a robot|verify you are (a )?human|captcha|site can.t be reached|page not found|404 not found|domain (is )?for sale|this domain may be for sale/i;
const toRe = (w) => new RegExp(`\\b${w.replace(/[.+?^${}()|[\]\\-]/g, (c) => (c === "-" ? "[- ]" : `\\${c}`)).replace(/\\\*$|\*$/, "\\w*")}\\b`, "gi");
const lexRes = Object.fromEntries(["ai_era", "dotcom_corporate"].map((k) => [k, LEX[k].map((w) => [w, toRe(w)])]));
export const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const TOPIC = ["ai-powered", "powered by ai"];

// One page of HTML to one row of numbers. Identical to sgr-004/measure.mjs for
// a measured page; `archive: true` adds that script's two Wayback-only checks.
export function measureHtml(html, base, { archive = false } = {}) {
  const page = homepageText(html);
  const words_article = htmlToText(html).words;
  if (archive) {
    if (/Got an HTTP 30\d response at crawl time/.test(html)) return { ...base, status: "archive_redirect" };
    if ((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() === "Wayback Machine") return { ...base, status: "no_capture" };
  }
  if (BOT_WALL.test(page.text.slice(0, 600)) || BOT_WALL.test(page.title)) return { ...base, status: "bot_wall" };
  if (page.words < MIN_WORDS) return { ...base, status: "too_little_prose", words: page.words };
  const t = page.text;
  const feat = measureTextFeatures(t);
  const scan = scanCliches(t);
  const per1k = (n) => r2((n / page.words) * 1000);
  const lexCounts = Object.fromEntries(Object.entries(lexRes).map(([k, list]) => {
    const hits = {}; let total = 0;
    for (const [w, re] of list) { const c = (t.match(re) ?? []).length; if (c) { hits[w] = c; total += c; } }
    return [k, { per1000: per1k(total), hits }];
  }));
  const pat = Object.fromEntries(scan.patterns.map((p) => [p.id, p.count]));
  const row = {
    ...base, status: "measured", words: page.words, words_article,
    avg_sentence_length: r2(feat.avg_sentence_length), sentence_length_variance: r2(feat.sentence_length_variance),
    comma_density: r2(feat.comma_density), exclamation_rate: r2(feat.exclamation_rate), semicolon_frequency: r2(feat.semicolon_frequency),
    contraction_frequency: r2(feat.contraction_frequency), question_mark_in_body: feat.question_mark_in_body,
    pronoun_i: r2(feat.pronoun_distribution?.I), pronoun_we: r2(feat.pronoun_distribution?.we), pronoun_you: r2(feat.pronoun_distribution?.you),
    word_short: r2(feat.word_length_distribution?.short), word_medium: r2(feat.word_length_distribution?.medium), word_long: r2(feat.word_length_distribution?.long),
    ai_tell_per1000: scan.per1000, ai_tell_phrases: Object.fromEntries(scan.phrases.map((p) => [p.phrase, p.count])),
    not_x_but_y: pat.not_x_but_y ?? 0, triadic_list: pat.triadic_list ?? 0,
    em_dash_per1000: per1k(pat.em_dash ?? 0), em_only_per1000: per1k((t.match(/—/g) ?? []).length),
    burstiness_variation: r2(scan.burstiness.variation), short_sentence_share: r2(scan.burstiness.shortShare),
    ai_era_vocab_per1000: lexCounts.ai_era.per1000, ai_era_vocab_hits: lexCounts.ai_era.hits,
    dotcom_vocab_per1000: lexCounts.dotcom_corporate.per1000, dotcom_vocab_hits: lexCounts.dotcom_corporate.hits,
  };
  // analyse.mjs adds this derived field to every measured row (SGR-004 disclosed post-hoc rule).
  const topic = TOPIC.reduce((a, w) => a + ((row.ai_era_vocab_hits || {})[w] || 0), 0);
  row.ai_era_style_per1000 = r2(Math.max(0, row.ai_era_vocab_per1000 - (topic / row.words) * 1000));
  return row;
}

// ---- pilot / verification subset: fixed by hash, not by looking at data ----
export const hashKey = (seed, s) => createHash("sha256").update(`${seed}:${s}`).digest("hex");
export function pilotDomains(rows2026) {
  const ok = new Set(rows2026.filter((r) => r.status === "measured").map((r) => r.domain));
  return PANEL.map((s) => s.domain).filter((d) => ok.has(d)).sort((a, b) => hashKey(DEF.pilot.seed, a).localeCompare(hashKey(DEF.pilot.seed, b))).slice(0, DEF.pilot.sites);
}
export function repeatDomains() {
  return PANEL.map((s) => s.domain).sort((a, b) => hashKey(DEF.repeat.seed, a).localeCompare(hashKey(DEF.repeat.seed, b))).slice(0, DEF.repeat.sites);
}

// ---- statistics ----
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const num = (a) => a.filter((x) => x != null && Number.isFinite(x));
export const mean = (a) => { a = num(a); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
export function quantile(arr, p) {
  const a = num(arr).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}
export const median = (a) => quantile(a, 0.5);
// Level statistic of a measure over a list of measured rows.
export function level(m, rows) {
  const v = rows.map((r) => r[m.column]);
  if (m.level === "median") return median(v);
  if (m.level === "mean") return mean(v);
  if (m.level === "share_positive") return rows.length ? rows.filter((r) => r[m.column] > 0).length / rows.length : null;
  throw new Error("unknown level " + m.level);
}
// Paired change statistic over matched pairs [{a,b}] (a = earlier row, b = later row).
export function change(m, pairs) {
  if (!pairs.length) return null;
  if (m.level === "share_positive") return pairs.filter((p) => p.b[m.column] > 0).length / pairs.length - pairs.filter((p) => p.a[m.column] > 0).length / pairs.length;
  const d = pairs.map((p) => p.b[m.column] - p.a[m.column]);
  return m.level === "median" ? median(d) : mean(d);
}
export function bootCI(m, pairs, B, seed) {
  const R = rng(seed), n = pairs.length, out = [];
  for (let i = 0; i < B; i++) { const s = []; for (let j = 0; j < n; j++) s.push(pairs[Math.floor(R() * n)]); out.push(change(m, s)); }
  out.sort((x, y) => x - y);
  return [out[Math.floor(0.025 * B)], out[Math.min(B - 1, Math.floor(0.975 * B))]];
}
export const pairUp = (rowsA, rowsB) => {
  const b = new Map(rowsB.map((r) => [r.domain, r]));
  return rowsA.filter((r) => b.has(r.domain)).map((r) => ({ domain: r.domain, a: r, b: b.get(r.domain) }));
};

// Fetched pages are stored gzipped (<dir>/<domain>.html.gz); a plain .html is read too. null = no page.
export const hasPage = (dir, d) => existsSync(`${dir}/${d}.html.gz`) || existsSync(`${dir}/${d}.html`);
export const hasFail = (dir, d) => existsSync(`${dir}/${d}.html.fail`);
export function readPage(dir, d) {
  if (existsSync(`${dir}/${d}.html.gz`)) return gunzipSync(readFileSync(`${dir}/${d}.html.gz`)).toString("utf8");
  if (existsSync(`${dir}/${d}.html`)) return readFileSync(`${dir}/${d}.html`, "utf8");
  return null;
}
