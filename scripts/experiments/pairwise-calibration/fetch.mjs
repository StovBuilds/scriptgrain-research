// Pull full-text posts from single-author feeds and cut matched excerpts.
import { writeFileSync } from "node:fs";
const FEEDS = {
  patio11: "https://www.kalzumeus.com/feed/",
  jamesclear: "https://jamesclear.com/feed",
  austinkleon: "https://austinkleon.com/feed/",
  raptitude: "https://www.raptitude.com/feed/",
  sivers: "https://sive.rs/en.atom",
  atwood: "https://blog.codinghorror.com/rss/",
  spolsky: "https://www.joelonsoftware.com/feed/",
  danluu: "https://danluu.com/atom.xml",
  jvns: "https://jvns.ca/atom.xml",
  dhh: "https://world.hey.com/dhh/feed.atom",
  fried: "https://world.hey.com/jason/feed.atom",
  noahpinion: "https://www.noahpinion.blog/feed",
  mastroianni: "https://www.experimental-history.com/feed",
  gruber: "https://daringfireball.net/feeds/main",
  simonw: "https://simonwillison.net/atom/entries/",
  hanselman: "https://www.hanselman.com/blog/feed/rss",
};
const UA = "ScriptGrainBot/1.0 (+https://scriptgrain.com/trust; calibration study, measured not stored)";
const ent = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&hellip;/g, "…").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
function toText(html) {
  let h = html.replace(/<!\[CDATA\[|\]\]>/g, "");
  if (/&lt;p|&lt;div|&lt;br/.test(h)) h = ent(h);
  h = h.replace(/<(pre|code|script|style|figure|figcaption|table|blockquote)[\s\S]*?<\/\1>/gi, " ");
  h = h.replace(/<\/(p|div|h[1-6]|li|br)>|<br\s*\/?>/gi, "\n\n").replace(/<[^>]+>/g, " ");
  return ent(h).split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p.split(" ").length >= 8).join("\n\n");
}
const words = (t) => t.split(/\s+/).filter(Boolean).length;
function excerpt(text, target) {
  const paras = text.split("\n\n"); const out = []; let n = 0;
  for (const p of paras) { out.push(p); n += words(p); if (n >= target) break; }
  return n >= target * 0.8 ? out.join("\n\n") : null;
}
const corpus = {};
for (const [author, feed] of Object.entries(FEEDS)) {
  try {
    const xml = await (await fetch(feed, { headers: { "User-Agent": UA } })).text();
    const items = xml.split(/<item[\s>]|<entry[\s>]/).slice(1);
    const texts = [];
    for (const it of items) {
      const body = (it.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || it.match(/<content[^>]*>([\s\S]*?)<\/content>/) || it.match(/<description>([\s\S]*?)<\/description>/) || [])[1];
      if (!body) continue;
      const t = toText(body);
      if (words(t) < 750) continue;
      const short = excerpt(t, 300), long = excerpt(t, 700);
      if (short && long) texts.push({ short, long });
      if (texts.length === 4) break;
    }
    if (texts.length >= 3) corpus[author] = texts;
    console.log(author, texts.length);
  } catch (e) { console.log(author, "fail", String(e).slice(0, 80)); }
}
writeFileSync(new URL("./corpus.json", import.meta.url), JSON.stringify(corpus));
console.log("authors", Object.keys(corpus).length);
