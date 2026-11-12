// SGR-028 measurement: text -> counts. Local, deterministic, no network, no model. Numbers only.
import { buildLookup, buildPhraseRes, UK_MARKERS } from "./terms.mjs";

const LOOK = buildLookup();
const PHRASE_RES = buildPhraseRes();
const MARKER_RES = UK_MARKERS.map(([id, s]) => [id, new RegExp(`(?<![a-z])${s}(?![a-z])`, "g")]);

/** Markdown -> plain text (same rules as scripts/experiments/brand-series/measure.mjs mdToPlain, copied so this folder stands alone). */
export function mdToPlain(md) {
  return md
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .filter((l) => !/^\s*\|/.test(l) && !/^\s*[-|: ]+\s*$/.test(l) && !/^\s*>/.test(l)) // tables, rules, blockquotes out
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s+/, "").replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/(\*\*|__|\*|_)(\S[\s\S]*?\S|\S)\1/g, "$2").replace(/\\([\\`*_{}[\]()#+.!-])/g, "$1").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Exclusions (pre-registration section 3): URLs, emails, quoted speech, then capitalised mid-sentence words (brand and proper names). */
export function cleanForCount(md) {
  let t = mdToPlain(md);
  t = t.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g, " ");
  t = t.replace(/[“"][^"”\n]{3,500}?[”"]/g, " ");      // quoted spans
  return t.replace(/[’‘]/g, "'");
}

const WORD = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

/**
 * @param md       page markdown
 * @param brandLabel first label of the brand's domain (its own name is skipped)
 * @returns {{words:number, us:number, uk:number, usOther:number, ukOther:number, usIze:number, ukIze:number, phrases:Object, markers:Object, terms:Object}}
 */
export function measurePage(md, brandLabel = "") {
  const t = cleanForCount(md);
  const out = { words: 0, us: 0, uk: 0, usOther: 0, ukOther: 0, usIze: 0, ukIze: 0, phrases: {}, markers: {}, terms: {} };
  let m;
  WORD.lastIndex = 0;
  while ((m = WORD.exec(t))) {
    out.words++;
    const raw = m[0], w = raw.toLowerCase();
    const hit = LOOK.get(w);
    if (!hit) continue;
    if (w === brandLabel) continue;
    // proper-noun rule: ALL CAPS, or Capitalised and not the first word of a sentence/line, is skipped
    if (raw.length > 1 && raw === raw.toUpperCase()) continue;
    if (raw[0] !== raw[0].toLowerCase()) {
      let i = m.index - 1;
      while (i >= 0 && /[\s"'(*_\[]/.test(t[i]) && t[i] !== "\n") i--;
      if (i >= 0 && t[i] !== "\n" && !/[.!?:]/.test(t[i])) continue;
    }
    const k = hit.side, g = hit.group === "ize" ? "Ize" : "Other";
    out[k]++; out[k + g]++;
    out.terms[w] = (out.terms[w] ?? 0) + 1;
  }
  const lower = t.toLowerCase();
  for (const [id, re] of PHRASE_RES) { re.lastIndex = 0; const n = (lower.match(re) ?? []).length; if (n) out.phrases[id] = n; }
  for (const [id, re] of MARKER_RES) { re.lastIndex = 0; const n = (lower.match(re) ?? []).length; if (n) out.markers[id] = n; }
  return out;
}
