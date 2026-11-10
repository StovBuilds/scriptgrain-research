// SGR-020 shared pieces: HTML body -> plain text, the page rules, units and eras.
// Frozen with docs/research/sgr-020-preregistration.md. Changes go under its "Deviations".
import { measure } from "../sgr-007/instruments.mjs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { measureBurstiness, splitSentences } from "../../../supabase/functions/_shared/ai-cliches.ts";

export const WINDOW = { from: "2015-01-01", to: "2026-09-30" };
export const MIN_WORDS = 150;

/** Departments and their lineages (pre-registration section 2). Slug -> unit id. */
export const UNITS = {
  no10: { name: "Prime Minister's Office (10 Downing Street)", slugs: ["prime-ministers-office-10-downing-street"] },
  mod: { name: "Ministry of Defence", slugs: ["ministry-of-defence"] },
  fcdo: { name: "Foreign, Commonwealth and Development Office (with FCO and DfID)", slugs: ["foreign-commonwealth-development-office", "foreign-commonwealth-office", "department-for-international-development"] },
  defra: { name: "Defra", slugs: ["department-for-environment-food-rural-affairs"] },
  dhsc: { name: "Health and Social Care", slugs: ["department-of-health-and-social-care", "department-of-health"] },
  home: { name: "Home Office", slugs: ["home-office"] },
  hmt: { name: "HM Treasury", slugs: ["hm-treasury"] },
  dft: { name: "Transport", slugs: ["department-for-transport"] },
  dcms: { name: "Culture, Media and Sport (DCMS)", slugs: ["department-for-digital-culture-media-sport", "department-for-culture-media-and-sport", "department-for-digital-culture-media-and-sport"] },
  dfe: { name: "Education", slugs: ["department-for-education"] },
  moj: { name: "Ministry of Justice", slugs: ["ministry-of-justice"] },
  cabinet: { name: "Cabinet Office", slugs: ["cabinet-office"] },
  business: { name: "Business, energy, trade, science (BIS, DECC, BEIS, DIT, DBT, DESNZ, DSIT)", slugs: ["department-for-business-innovation-skills", "department-of-energy-climate-change", "department-for-business-energy-and-industrial-strategy", "department-for-international-trade", "department-for-business-and-trade", "department-for-energy-security-and-net-zero", "department-for-science-innovation-and-technology", "department-for-business-innovation-science-and-trade"] },
  communities: { name: "Housing, communities and local government (DCLG, MHCLG, DLUHC)", slugs: ["department-for-communities-and-local-government", "ministry-of-housing-communities-and-local-government-2018-2021", "department-for-levelling-up-housing-and-communities", "ministry-of-housing-communities-local-government"] },
  dwp: { name: "Work and Pensions", slugs: ["department-for-work-pensions"] },
  hmrc: { name: "HM Revenue and Customs", slugs: ["hm-revenue-customs"] },
  ago: { name: "Attorney General's Office", slugs: ["attorney-generals-office"] },
  nio: { name: "Northern Ireland Office", slugs: ["northern-ireland-office"] },
  wales: { name: "Wales Office", slugs: ["office-of-the-secretary-of-state-for-wales", "wales-office"] },
  scotland: { name: "Scotland Office", slugs: ["office-of-the-secretary-of-state-for-scotland", "scotland-office"] },
};
export const SLUG_TO_UNIT = Object.fromEntries(Object.entries(UNITS).flatMap(([id, u]) => u.slugs.map((s) => [s, id])));

export const ERAS = ["EARLY", "LATE", "TRANSITION", "AFTER"];
/** Era from a YYYY-MM-DD date (pre-registration section 4). */
export function era(d) {
  if (!d || d < WINDOW.from || d > WINDOW.to) return null;
  if (d < "2019-01-01") return "EARLY";
  if (d < "2022-12-01") return "LATE";
  if (d < "2024-01-01") return "TRANSITION";
  return "AFTER";
}
/** The Conservative-government months of the AFTER era: 1 January to 4 July 2024 (general election day). */
export const isAfterConservative = (d) => d >= "2024-01-01" && d <= "2024-07-04";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", pound: "£", hellip: "…", euro: "€" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const c = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
/** Headings that open a section of contacts or boilerplate: that section to the end is dropped. */
const CUT = /^(notes? (to|for) editors?|media enquiries|press enquiries|general enquiries|further information|more information|contact (the )?press office|contact(s| us)?|useful links|related (links|content|information))\s*:?$/i;
/** A paragraph that is just "Ends" closes the release; what follows is background for editors. */
const ENDS = /<p[^>]*>\s*(?:<(?:strong|b)>)?\s*ends\s*(?:<\/(?:strong|b)>)?\s*<\/p>/i;

/** Body HTML -> plain text, as pre-registration section 3 says. */
export function htmlToPlain(html) {
  let h = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<table[\s\S]*?<\/table>/gi, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const ends = ENDS.exec(h); if (ends) h = h.slice(0, ends.index);
  // cut at the first boilerplate heading
  const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let m;
  while ((m = re.exec(h))) {
    const t = decode(m[1].replace(/<[^>]+>/g, "")).trim();
    if (CUT.test(t)) { h = h.slice(0, m.index); break; }
  }
  h = h.replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|section|figure|figcaption)>/gi, "\n\n").replace(/<(p|h[1-6]|blockquote|div)[^>]*>/gi, "\n");
  const t = decode(h.replace(/<[^>]+>/g, " "));
  return t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export const countWords = (t) => (t.match(/\S+/g) ?? []).length;
/** Share of words sitting in lines of six words or fewer (menus, link lists). */
export function shortLineWordShare(text, w) {
  const s = text.split("\n").filter((l) => l.trim() && countWords(l) <= 6).reduce((a, l) => a + countWords(l), 0);
  return w ? s / w : 1;
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

export const MEASURES = ["ai_ism_per1000", "old_per1000", "called_out_per1000", "marketing_per1000", "quiet_per1000", "ai_shape_per1000", "em_dash_per1000", "avg_sentence_length", "sentence_variation", "short_sentence_share", "contractions_per1000", "commas_per_sentence", "exclamations_per1000", "questions_per1000", "you_share", "we_share", "i_share", "long_word_share"];

/** The same measures as the brand series (scripts/experiments/brand-series/measure.mjs), for one page of plain text. */
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
