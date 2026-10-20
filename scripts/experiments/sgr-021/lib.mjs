// SGR-021 shared code: catalogue parsing, the frozen panel rules, text cleaning.
// Used by build-corpus.mjs (to count words) and run.mjs (to measure), so both see identical text.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const CFG = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url), "utf8"));

export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const shuffle = (a, seed) => { const r = rng(seed); a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function parseCsv(text) {
  const out = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); out.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  const [h, ...rest] = out;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

export const words = (t) => t.split(/\s+/).filter(Boolean).length;

// Project Gutenberg file -> body between the START and END markers.
export function bodyOf(raw) {
  let t = raw.replace(/\r/g, "");
  const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/);
  if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined);
  return t;
}
const HEADING = /^(CHAPTER|BOOK|VOLUME|PART|SECTION|LETTER|ACT|SCENE|PREFACE|CONTENTS|[IVXLC]+\.)\b/i;
const BOILER = /transcriber|project gutenberg|\[illustration|\[footnote|\[note|e-?text|proofread|\[sidenote/i;

// Paragraphs of more than 12 words, no headings or boilerplate, minus 5% of the words at each end.
export function cleanBook(raw) {
  const paras = bodyOf(raw).split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => words(p) > 12 && !HEADING.test(p) && !BOILER.test(p));
  const total = paras.reduce((s, p) => s + words(p), 0);
  const lo = total * CFG.works.trim_share_each_end, hi = total * (1 - CFG.works.trim_share_each_end);
  let acc = 0; const keep = [];
  for (const p of paras) { const w = words(p); if (acc >= lo && acc + w <= hi) keep.push(p); acc += w; }
  const text = keep.join("\n\n");
  return { text, words: words(text), rawBodyWords: total };
}

// Paired double quotes, straight or curly, within one paragraph.
export const QUOTED = /"[^"\n]*"|“[^”]*?”/g;
export function narrationOf(text) { return text.replace(QUOTED, " ").replace(/[ \t]{2,}/g, " "); }
export function dialogueWords(text) { return (text.match(QUOTED) ?? []).reduce((s, q) => s + words(q), 0); }

export const readGz = (f) => gunzipSync(readFileSync(f)).toString("utf8");
export const midlifeDecade = (born) => Math.floor((born + 40) / 10) * 10;
export const midlifeCentury = (born) => Math.floor((born + 40) / 100) * 100;
