// The homepage extractor SGR-004 measured with (see measure.mjs for why it
// differs from the product's article extractor). Shared with SGR-007.
import { decodeEntities, wordCount } from "../../../supabase/functions/_shared/html-text.ts";

// Mirrors html-text.ts (DROP_SUBTREE, BLOCK_TAGS, proseLines) except as noted above.
const DROP = ["script", "style", "noscript", "template", "svg", "iframe", "canvas", "video", "audio", "object", "nav", "footer", "dialog", "menu"];
const BLOCK = "p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|section|article|main|header|aside|form|blockquote|pre|figcaption|dd|dt|dl|hr|summary|details";
export function homepageText(html) {
  const titleM = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = titleM ? decodeEntities(titleM[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
  // Wayback's own toolbar, present in rendered replays.
  let h = html.replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, " ")
    .replace(/<div id="(wm-ipp-base|wm-ipp|donato|wm-ipp-print)"[\s\S]*?<\/div>/gi, " ");
  for (const tag of DROP) {
    h = h.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), " ").replace(new RegExp(`<${tag}\\b[^>]*\\/>`, "gi"), " ");
  }
  const bodyM = h.match(/<body\b[^>]*>([\s\S]*)<\/body\s*>/i);
  const frag = bodyM ? bodyM[1] : h;
  const lines = decodeEntities(frag.replace(/<!--[\s\S]*?-->/g, " ").replace(new RegExp(`<\\/?(?:${BLOCK})\\b[^>]*>`, "gi"), "\n").replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ").split("\n").map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim()).filter(Boolean);
  const seen = new Set();
  const prose = lines.filter((line) => {
    const w = wordCount(line);
    const keep = w >= 8 || (w >= 4 && /[.!?:;\u2026"\u201d')]$/.test(line)) || (w >= 4 && !/^(home|menu|login|log in|sign up|sign in|contact|about)\b/i.test(line));
    if (!keep || seen.has(line)) return false;
    seen.add(line);
    return true;
  });
  const text = prose.join("\n\n");
  return { title, text, words: wordCount(text) };
}

