// SGR-023: readability measures for one page of plain text (from brand-series mdToPlain).
// Pre-registration sections 3 and 4. Deterministic; no dictionary, network or model call
// except the optional CMU-syllable sensitivity, which takes a lookup function.
import { syllables as ruleSyllables } from "./syllables.mjs";

// Pronounceable acronyms read as words (everything else in capitals, 2 to 5 letters, is spelled out).
export const ACRONYM_WORDS = new Set(["NATO", "NASA", "UNESCO", "UNICEF", "COVID", "ISA", "ISAS", "SIM", "PIN", "WIFI", "LED", "OPEC", "UEFA", "OFGEM", "OFCOM", "OFSTED", "FIFA", "AIDS", "HIV", "SAAS", "LASIK", "RAM", "LAN", "SWIFT", "FAQ", "FAQS", "ASAP", "BACS", "CHAPS", "GIF", "JPEG", "PDF", "USB", "OLED", "QLED", "SUV", "MPV", "DAB", "NEST", "UCAS", "TUPE", "LIBOR", "SONIA", "EEA", "NISA", "ASOS", "TESCO", "ALDI", "LIDL", "AXA", "ECO", "BAE", "NEXT", "EASY", "WISE", "LEON", "PRET"]);
const ABBR = new Set(["mr", "mrs", "ms", "dr", "prof", "st", "vs", "inc", "ltd", "plc", "co", "no", "approx", "e.g", "i.e", "etc", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"]);

/** Syllables of a token as written (case kept): spelled-out initialisms, otherwise the rule counter. */
export function tokenSyllables(tok, syl = ruleSyllables) {
  if (/^[A-Z]{2,5}$/.test(tok) && !ACRONYM_WORDS.has(tok)) return [...tok].reduce((a, c) => a + (c === "W" ? 3 : 1), 0);
  return syl(tok);
}
/** Word tokens of a text chunk: letters (with inner apostrophes); hyphens and slashes split. Chunks with a digit, "@", "://" or "www." are skipped. */
export function tokens(s) {
  const out = [];
  for (const chunk of s.split(/\s+/)) {
    if (!chunk || /\d|@|:\/\/|www\./i.test(chunk)) continue;
    for (const m of chunk.matchAll(/[A-Za-zÀ-ÿ]+(?:['’][A-Za-z]+)*/g)) out.push(m[0]);
  }
  return out;
}
const TERMINAL = /[.!?]["”’')\]]*$/;
/** "Running prose": lines ending in . ! or ? (headings, bylines, captions, buttons and unpunctuated list items are dropped). */
export function proseLines(text) { return text.split("\n").map((l) => l.trim()).filter((l) => l && TERMINAL.test(l)); }
/** Sentences of one prose line: split after . ! ? (plus closing quotes) before a capital, digit or opening mark; not after the listed abbreviations. */
export function splitProse(line) {
  const out = []; let start = 0;
  const re = /[.!?]["”’')\]]*\s+(?=[A-Z0-9"“‘'(£])/g;
  let m;
  while ((m = re.exec(line))) {
    const before = line.slice(start, m.index + 1);
    const last = (before.match(/([A-Za-z.]+)\.$/)?.[1] ?? "").toLowerCase();
    if (m[0][0] === "." && (ABBR.has(last) || /^[a-z]$/.test(last))) continue;
    out.push(before.trim()); start = m.index + m[0].length;
  }
  out.push(line.slice(start).trim());
  return out.filter(Boolean);
}
/** The product's sentence splitter, for the sensitivity run (supabase/functions/_shared/ai-cliches.ts, copied verbatim). */
export function splitSentencesProduct(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).filter(Boolean).length >= 2);
}

export const MIN_WORDS = 100, MIN_SENTENCES = 5;
const r4 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000);

/** Counts and scores from a list of sentence strings. */
export function score(sentences, syl = ruleSyllables) {
  let W = 0, S = 0, Y = 0, L = 0, long7 = 0, poly3 = 0, gt25 = 0, chars = 0;
  for (const s of sentences) {
    const t = tokens(s); if (!t.length) continue;
    S++; W += t.length; if (t.length > 25) gt25++;
    for (const w of t) {
      const y = tokenSyllables(w, syl); Y += y; if (y >= 3) poly3++;
      const n = w.replace(/['’]/g, "").length; chars += n; if (n >= 7) long7++;
    }
  }
  if (S === 0) return { words: 0, sentences: 0 };
  const asl = W / S, asw = Y / W;
  return {
    words: W, sentences: S,
    asl: r4(asl), asw: r4(asw),
    fre: r4(206.835 - 1.015 * asl - 84.6 * asw),
    fk: r4(0.39 * asl + 11.8 * asw - 15.59),
    reading_age: r4(0.39 * asl + 11.8 * asw - 15.59 + 5),
    long_word_share: r4(long7 / W), poly3_share: r4(poly3 / W), sent_gt25_share: r4(gt25 / S), letters_per_word: r4(chars / W),
  };
}
/** Primary scoring of a page's plain text; also the labelled variants. `cmuSyl` is optional: (word) -> syllables or null. */
export function scorePage(text, cmuSyl = null) {
  const prose = proseLines(text).flatMap(splitProse);
  const main = score(prose);
  const ok = main.words >= MIN_WORDS && main.sentences >= MIN_SENTENCES;
  const out = { prose_words: main.words, prose_sentences: main.sentences, scorable: ok };
  if (!ok) return out;
  Object.assign(out, main);
  out.v_product_split = score(splitSentencesProduct(text)); // all lines, the product's splitter
  if (cmuSyl) out.v_cmu = score(prose, (w) => cmuSyl(w) ?? ruleSyllables(w));
  return out;
}
