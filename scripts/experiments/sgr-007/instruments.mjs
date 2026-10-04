// SGR-007 measurement: one page of text in, numbers out. Shared by every source
// (web, homepages, Gutenberg) so all groups are measured identically.
import { readFileSync } from "node:fs";
import { measureTextFeatures } from "../../../supabase/functions/_shared/voice-match.ts";
import { scanCliches } from "../../../supabase/functions/_shared/ai-cliches.ts";

const LEX = JSON.parse(readFileSync(new URL("./lexicons.json", import.meta.url), "utf8"));
const toRe = (w) => new RegExp(`\\b${w.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "[- ]").replace(/\*$/, "\\w*")}\\b`, "gi");
const LISTS = Object.fromEntries(Object.entries(LEX).filter(([k]) => !k.startsWith("_")).map(([k, ws]) => [k, ws.map((w) => [w, toRe(w)])]));
const UNION = ["OLD", "CALLED_OUT", "MARKETING"];
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

export function measure(text, words) {
  const per1k = (c) => r2((c / words) * 1000);
  const out = { words };
  const hits = {};
  const unionPos = new Set();
  for (const [name, list] of Object.entries(LISTS)) {
    let total = 0;
    const h = {};
    for (const [w, re] of list) {
      re.lastIndex = 0;
      let m, c = 0;
      while ((m = re.exec(text))) { c++; if (UNION.includes(name)) unionPos.add(m.index); }
      if (c) { h[w] = c; total += c; }
    }
    out[`${name.toLowerCase()}_per1000`] = per1k(total);
    hits[name] = h;
  }
  // The primary outcome: each word occurrence counted once across the three lists.
  out.ai_ism_per1000 = per1k(unionPos.size);
  const f = measureTextFeatures(text);
  const scan = scanCliches(text);
  out.ai_tell_per1000 = scan.per1000;
  out.em_dash_per1000 = per1k((text.match(/\u2014/g) ?? []).length);
  out.avg_sentence_length = r2(f.avg_sentence_length);
  out.contraction_frequency = r2(f.contraction_frequency);
  out.comma_density = r2(f.comma_density);
  out.hits = hits;
  return out;
}
