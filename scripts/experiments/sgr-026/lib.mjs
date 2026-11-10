// SGR-026 shared pieces: wikitext -> plain prose, the page rules, months and eras.
// Frozen with docs/research/sgr-026-preregistration.md. Changes go under its "Deviations".
import { measure } from "../sgr-007/instruments.mjs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { measureBurstiness, splitSentences } from "../../../supabase/functions/_shared/ai-cliches.ts";

export const WINDOW = { from: "2015-01", to: "2026-09" }; // months, by the first revision's UTC timestamp
export const MIN_WORDS = 150;

export const ERAS = ["EARLY", "LATE", "TRANSITION", "AFTER"];
/** Era from a YYYY-MM month (pre-registration section 4): same eras as SGR-011 and SGR-020. */
export function era(ym) {
  if (!ym || ym < WINDOW.from || ym > WINDOW.to) return null;
  if (ym < "2019-01") return "EARLY";
  if (ym < "2022-12") return "LATE";
  if (ym < "2024-01") return "TRANSITION";
  return "AFTER";
}

// ── wikitext -> plain prose ──────────────────────────────────────────────────────────────────
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", pound: "£", hellip: "…", euro: "€", thinsp: " ", ensp: " ", emsp: " ", shy: "", deg: "°", times: "×" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const c = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
/** Sections whose whole content is dropped (up to the next heading of the same or a higher level): not prose. */
export const DROP_SECTIONS = /^(see also|references?|external links?|further reading|notes?|footnotes?|sources?|bibliography|citations?|works cited|publications?|selected works|discography|filmography|awards?( and (nominations|honou?rs))?|honou?rs|gallery|links?|related (articles|pages)|sister projects?)$/i;
const NS_DROP = /^(file|image|media|category|template|wikipedia|wp|help|portal|draft|special|talk|user)\s*:/i;
const INTERWIKI = /^:?[a-z]{2,3}(-[a-z]+)?:[^ ]/; // [[fr:Titre]] interlanguage links (old style, 2015)

/** Remove every balanced {{...}} by peeling the innermost ones first. Stray braces are dropped. */
function stripTemplates(s) {
  for (let i = 0; i < 60 && s.includes("{{"); i++) {
    const n = s.replace(/\{\{(?:(?!\{\{|\}\})[\s\S])*\}\}/g, "");
    if (n === s) break;
    s = n;
  }
  return s.replace(/\{\{+|\}\}+/g, "");
}
/** Remove every table {| ... |}, innermost first. */
function stripTables(s) {
  for (let i = 0; i < 30 && s.includes("{|"); i++) {
    const n = s.replace(/\{\|(?:(?!\{\|)[\s\S])*?\|\}/g, "\n");
    if (n === s) break;
    s = n;
  }
  return s.replace(/^\s*(\{\||\|\}|\|-).*$/gm, "");
}
/** [[links]]: innermost first, so files with linked captions go whole; labels kept, categories/files/interlanguage dropped. */
function stripLinks(s) {
  for (let i = 0; i < 20 && s.includes("[["); i++) {
    const n = s.replace(/\[\[([^\[\]]*)\]\]/g, (_m, inner) => {
      if (NS_DROP.test(inner) && !inner.startsWith(":")) return "";
      if (INTERWIKI.test(inner) && !/^:?(w|wikipedia|wikt|s|b|q|n|c|commons|d|v):/.test(inner)) return "";
      const parts = inner.split("|");
      const label = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).replace(/^:/, "");
      return label.replace(/#.*$/, parts.length > 1 ? "" : "") || (parts[0] ?? "").replace(/^:/, "").replace(/#.*$/, "");
    });
    if (n === s) break;
    s = n;
  }
  return s.replace(/\[\[|\]\]/g, "");
}

/** Wikitext of a revision -> plain prose, one paragraph or list item per line. Documented in the pre-registration, section 3. */
export function wikitextToPlain(src) {
  if (src == null) return "";
  let s = String(src).replace(/\r/g, "");
  if (/^\s*#\s*redirect/i.test(s)) return "";
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // citations and other non-prose tags, with their contents
  s = s.replace(/<ref\b[^>]*\/>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, "");
  s = s.replace(/<(math|chem)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  s = s.replace(/<(gallery|imagemap|timeline|score|syntaxhighlight|source|pre|poem|mapframe|maplink|graph|noinclude|references)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "\n");
  s = s.replace(/<references\b[^>]*\/>/gi, "");
  s = stripTemplates(s);
  s = stripTables(s);
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(nowiki|small|big|span|div|center|sup|sub|u|s|strike|del|ins|b|i|em|strong|font|code|tt|blockquote|cite|abbr|q|includeonly|onlyinclude|p)\b[^>]*>/gi, " ");
  s = s.replace(/<[a-z][^>]*>/gi, " ").replace(/<\/[a-z]+>/gi, " ");
  s = stripLinks(s);
  // external links: [http://x label] -> label, [http://x] -> nothing, bare URLs -> nothing
  s = s.replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]*)\]/g, "$1").replace(/\[(?:https?:)?\/\/[^\s\]]*\]/g, "").replace(/\b(?:https?:)?\/\/[^\s<>\]|]+/g, (m) => (m.startsWith("//") ? "" : ""));
  s = s.replace(/'{2,5}/g, "").replace(/__[A-Z]+__/g, "");
  s = decode(s);
  // headings: drop the line; drop whole non-prose sections
  const out = []; let skipLevel = 0;
  for (const raw of s.split("\n")) {
    const hm = /^\s*(={2,6})\s*(.*?)\s*\1\s*$/.exec(raw);
    if (hm) {
      const level = hm[1].length;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && DROP_SECTIONS.test(hm[2].replace(/'/g, "").trim())) skipLevel = level;
      continue;
    }
    if (skipLevel) continue;
    let l = raw.replace(/^[\s*#:;]+/, "").replace(/\s+/g, " ").trim();
    if (!l || /^[|!]/.test(l) || /^(?:-{4,})$/.test(l)) continue;
    out.push(l);
  }
  let t = out.join("\n");
  // empty brackets left where a template (dates, pronunciations, coordinates) used to be
  for (let i = 0; i < 4; i++) t = t.replace(/\(\s*[,;:–—-]?\s*\)|\[\s*\]/g, " ").replace(/\(\s*[,;:]\s*/g, "(").replace(/\s*[,;:]\s*\)/g, ")");
  return t.split("\n").map((l) => l.replace(/[ \t]+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim()).filter(Boolean).join("\n");
}

export const countWords = (t) => (t.match(/\S+/g) ?? []).length;
/** Share of words sitting in lines of six words or fewer (list pages, caption debris). */
export function shortLineWordShare(text, w) {
  const s = text.split("\n").filter((l) => l.trim() && countWords(l) <= 6).reduce((a, l) => a + countWords(l), 0);
  return w ? s / w : 1;
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

export const MEASURES = ["ai_ism_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "quiet_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "sentence_variation", "short_sentence_share", "contractions_per1000", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "you_share", "we_share", "i_share", "long_word_share"];

/** The same measures as the brand series and SGR-020 (scripts/experiments/brand-series/measure.mjs), for one article of plain text. */
export function measurePage(text, w) {
  const m = measure(text, w);
  const f = measureTextFeatures(text);
  const burst = measureBurstiness(text);
  const pron = f.pronoun_distribution ?? {};
  const tokens = text.match(/[A-Za-z]+/g) ?? [];
  return {
    ai_ism_per1000: m.ai_ism_per1000, old_per1000: m.old_per1000, called_out_per1000: m.called_out_per1000,
    marketing_per1000: m.marketing_per1000, quiet_per1000: m.quiet_per1000, ai_shape_per1000: m.ai_tell_per1000,
    em_dash_per1000: r3(((text.match(/—/g) ?? []).length + (text.match(/ – /g) ?? []).length) / w * 1000),
    avg_sentence_length: m.avg_sentence_length, sentence_variation: burst.variation, short_sentence_share: burst.shortShare,
    contractions_per1000: m.contraction_frequency, commas_per_sentence: m.comma_density,
    exclamations_per1000: r3((text.match(/!/g) ?? []).length / w * 1000), questions_per1000: r3((text.match(/\?/g) ?? []).length / w * 1000),
    you_share: r3(pron.you ?? null), we_share: r3(pron.we ?? null), i_share: r3(pron.I ?? pron.i ?? null),
    long_word_share: r3(tokens.length ? tokens.filter((t) => t.length >= 7).length / tokens.length : null),
    sentences: splitSentences(text).length,
  };
}

/** True when the page's early history shows it was moved into the article namespace from elsewhere (draft, user space, another title). */
export const MOVED_IN = /\bmoved (?:page )?\[\[(?:draft|user|wikipedia|wp|talk|draft talk)\b/i;
export function movedIn(row) {
  return (row.moves ?? []).some((m) => MOVED_IN.test(m.comment ?? ""));
}
