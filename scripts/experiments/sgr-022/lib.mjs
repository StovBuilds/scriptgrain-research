// SGR-022 shared pieces: answering-body -> department unit, eras, HTML -> plain text, page rules and
// the measures. Frozen with docs/research/sgr-022-preregistration.md; changes go under its "Deviations".
// Eras and measures are the same as SGR-011 (brand series) and SGR-020 (GOV.UK) so the three compare.
import { measure } from "../sgr-007/instruments.mjs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { measureBurstiness, splitSentences } from "../../../supabase/functions/_shared/ai-cliches.ts";

/** Collection frame (section 1). Questions are listed by TABLED week, from a quarter before the answer window opens. */
export const FRAME = { tabledFrom: "2014-10-01", tabledTo: "2026-10-10", answeredFrom: "2015-01-01", answeredTo: "2026-09-30" };
export const WINDOW = { from: FRAME.answeredFrom, to: FRAME.answeredTo };
/** Fixed-seed sampling design (section 2). */
export const SAMPLE = { seed: "sgr022-v1", perYear: 5000, floorPerUnitYear: 200 };
export const MIN_WORDS = 50; // answers and statements (SGR-011 and SGR-020 use 150; the 150-word subset is a robustness check)

/** The departments (confirmatory units). Same ids and lineages as SGR-020 where Parliament names a body the same way. */
export const UNITS = {
  no10: "Prime Minister's Office (10 Downing Street)",
  mod: "Ministry of Defence",
  fcdo: "Foreign, Commonwealth and Development Office (with FCO and DfID)",
  defra: "Defra",
  dhsc: "Health and Social Care",
  home: "Home Office",
  hmt: "HM Treasury (with HMRC)",
  dft: "Transport",
  dcms: "Culture, Media and Sport (DCMS)",
  dfe: "Education",
  moj: "Ministry of Justice",
  cabinet: "Cabinet Office (with the Deputy Prime Minister's Office)",
  business: "Business, energy, trade, science (BIS, DECC, BEIS, DIT, DBT, DESNZ, DSIT)",
  communities: "Housing, communities and local government (DCLG, MHCLG, DLUHC)",
  dwp: "Work and Pensions",
  ago: "Attorney General's Office",
  nio: "Northern Ireland Office",
  wales: "Wales Office",
  scotland: "Scotland Office",
};
const RULES = [
  [/^prime minister$/i, "no10"],
  [/^ministry of defence$/i, "mod"],
  [/foreign.*commonwealth|international development/i, "fcdo"],
  [/environment, food/i, "defra"],
  [/^department (of|for) health/i, "dhsc"],
  [/^home office$/i, "home"],
  [/^(hm )?treasury$|^hm revenue/i, "hmt"],
  [/^department for transport$/i, "dft"],
  [/culture,? media|digital, culture/i, "dcms"],
  [/^department for education$/i, "dfe"],
  [/^ministry of justice$/i, "moj"],
  [/^cabinet office$|^deputy prime minister$/i, "cabinet"],
  [/business, innovation|energy and climate|business, energy|international trade|business and trade|energy security|science, innovation|business, energy and industrial|industrial strategy/i, "business"],
  [/communities and local government|levelling up|housing, communities/i, "communities"],
  [/work and pensions/i, "dwp"],
  [/^attorney general/i, "ago"],
  [/northern ireland office/i, "nio"],
  [/wales office|secretary of state for wales/i, "wales"],
  [/scotland office|secretary of state for scotland/i, "scotland"],
];
/** Parliament's answering-body name -> unit id; anything else is "other" (analysed apart). */
export function unitOf(name) { for (const [re, id] of RULES) if (re.test(name ?? "")) return id; return "other"; }

export const ERAS = ["EARLY", "LATE", "TRANSITION", "AFTER"];
export function era(d) {
  if (!d || d < WINDOW.from || d > WINDOW.to) return null;
  if (d < "2019-01-01") return "EARLY";
  if (d < "2022-12-01") return "LATE";
  if (d < "2024-01-01") return "TRANSITION";
  return "AFTER";
}
/** Conservative-government months of AFTER: 1 January to 4 July 2024 (general election day). */
export const isAfterConservative = (d) => d >= "2024-01-01" && d <= "2024-07-04";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", pound: "£", hellip: "…", euro: "€" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const c = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
/** HTML -> plain text: scripts, styles, tables and comments removed; paragraphs and list items kept as lines. */
export function htmlToPlain(html) {
  let h = String(html ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<table[\s\S]*?<\/table>/gi, "\n").replace(/<!--[\s\S]*?-->/g, "");
  h = h.replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|section|figure|figcaption)>/gi, "\n\n").replace(/<(p|h[1-6]|blockquote|div)[^>]*>/gi, "\n");
  const t = decode(h.replace(/<[^>]+>/g, " "));
  return t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export const hasTable = (html) => /<table/i.test(html ?? "");
export const countWords = (t) => (t.match(/\S+/g) ?? []).length;
export function shortLineWordShare(text, w) {
  const s = text.split("\n").filter((l) => l.trim() && countWords(l) <= 6).reduce((a, l) => a + countWords(l), 0);
  return w ? s / w : 1;
}
/** A holding answer that the list flag missed: promises a reply, says nothing (section 1). */
export const HOLDING_TEXT = /\b(?:will|shall|am going to|intend to)\s+(?:reply|respond|write|answer|provide an answer)\b[^.]{0,80}\bas soon as\b|\bholding answer\b|\banswer\s+(?:will be|is being)\s+(?:provided|given|sent)\b|\bshall reply as soon\b/i;
/** Share of a text's words that sit inside numerals or tabular lines (figure lists). */
export function figureShare(text, w) {
  const tokens = text.match(/\S+/g) ?? [];
  return w ? tokens.filter((t) => /^[£$€(]?[\d.,%\-–/:]+[)]?$/.test(t)).length / w : 0;
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

export const MEASURES = ["ai_ism_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "quiet_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "sentence_variation", "short_sentence_share", "contractions_per1000", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "you_share", "we_share", "i_share", "long_word_share"];

/** The same measures as brand-series/measure.mjs and SGR-020, for one text. */
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
