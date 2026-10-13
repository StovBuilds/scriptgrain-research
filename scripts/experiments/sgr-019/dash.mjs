// SGR-019 dash counting, frozen by docs/research/sgr-019-preregistration.md section 3.
// One function per text family; all return { d, ds, w }:
//   d  = dash marks under the primary (convention-aware) rule
//   ds = dash marks under the strict rule (U+2014 and spaced en dash only: SGR-010's definition)
//   w  = words
// Every dash mark is replaced by a space before words are counted, so "word--word" is two
// words and a spaced dash is never a word.

const STRICT = /\u2014| \u2013 /g;
// Gutenberg plain text: "--" or "---" (a run of exactly 2 or 3 hyphens) stands in for the
// em dash. Runs of 4+ (rules, redactions such as "Mr. ----") are not dashes.
const GUTENBERG_ASCII = /(?<!-)-{2,3}(?!-)/g;
// arXiv metadata is ASCII: an author's em dash arrives as "---" (LaTeX) or a spaced " -- ".
// An unspaced "--" is LaTeX's en dash (page ranges, "Erdos--Renyi") and is not counted.
const ARXIV_ASCII = /(?<![-\S])--(?![-\S])|(?<!-)---(?!-)/g;
// Note: (?<![-\S]) / (?![-\S]) mean "preceded/followed by whitespace or start/end" for the spaced "--".
const WORD = /\S*[\p{L}\p{N}]\S*/gu;

function count(text, extra) {
  const ds = (text.match(STRICT) ?? []).length;
  let d = ds;
  let padded = text.replace(STRICT, " ");
  if (extra) {
    d += (padded.match(extra) ?? []).length;
    padded = padded.replace(extra, " ");
  }
  const w = (padded.match(WORD) ?? []).length;
  return { d, ds, w };
}

export const countTyped = (text) => count(text, null);            // brand pages: real typography
export const countGutenberg = (text) => count(text, GUTENBERG_ASCII);
export const countArxiv = (text) => count(text, ARXIV_ASCII);

/** Gutenberg body between the START and END markers (same rule as SGR-005 and SGR-006). */
export function gutenbergBody(raw) {
  let t = raw.replace(/\r/g, "");
  const a = t.search(/\*\*\* ?START OF/), b = t.search(/\*\*\* ?END OF/);
  if (a >= 0) t = t.slice(t.indexOf("\n", a) + 1, b > a ? b : undefined);
  return t;
}
