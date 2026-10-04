// SGR-006 measurement: one text in, the product's habits out (numbers only).
// Shared by the book, web and abstract harvesters so every era is measured alike.
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
export const words = (t) => t.split(/\s+/).filter(Boolean).length;
export function features(text) {
  const w = words(text);
  const f = measureTextFeatures(text), s = scanCliches(text);
  return {
    words: w,
    sentence_length: r3(f.avg_sentence_length),
    sentence_cv: r3(s.burstiness.variation),
    short_sentence_share: r3(s.burstiness.shortShare),
    commas_per_sentence: r3(f.comma_density),
    semicolons_per1000: r3(f.semicolon_frequency),
    exclamations_per1000: r3(f.exclamation_rate),
    questions_per1000: r3(((text.match(/\?/g) ?? []).length / w) * 1000),
    contractions_per1000: r3(f.contraction_frequency),
    parentheticals_per300: r3(f.parenthetical_rate),
    short_word_share: r3(f.word_length_distribution?.short),
    long_word_share: r3(f.word_length_distribution?.long),
    pronoun_i: r3(f.pronoun_distribution?.I), pronoun_we: r3(f.pronoun_distribution?.we), pronoun_you: r3(f.pronoun_distribution?.you),
    em_dash_per1000: r3(((text.match(/—|--/g) ?? []).length / w) * 1000),
    ai_tell_per1000: r3(s.per1000),
  };
}
