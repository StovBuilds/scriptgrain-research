#!/usr/bin/env bun
// DESK-415: build a website-copy corpus for compare_voice calibration.
// 4 sectors x 5-8 brands x 4 marketing pages. Firecrawl map -> pick the homepage +
// 3 shallow product/about pages -> Firecrawl rawHtml -> the product's own htmlToText
// (what compare_voice runs on a URL piece). Writes corpus.json (NOT committed: third-party text).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { htmlToText } from "../../../supabase/functions/_shared/html-text.ts";
const dir = new URL(".", import.meta.url).pathname;
const KEY = readFileSync("~/.bot-infra.env", "utf8").match(/^FIRECRAWL_API_KEY=(.+)$/m)[1].trim();
export const SECTORS = {
  bank: ["lloydsbank.com", "nationwide.co.uk", "monzo.com", "barclays.co.uk", "natwest.com", "starlingbank.com", "santander.co.uk", "hsbc.co.uk"],
  energy: ["octopus.energy", "britishgas.co.uk", "edfenergy.com", "ovoenergy.com", "eonnext.com", "so.energy"],
  telecom: ["bt.com", "sky.com", "virginmedia.com", "vodafone.co.uk", "three.co.uk", "giffgaff.com"],
  saas: ["notion.com", "slack.com", "asana.com", "monday.com", "airtable.com", "mailchimp.com"],
};
const GOOD = /(about|account|saving|mortgage|loan|card|broadband|mobile|tariff|energy|electric|gas|solar|heat|feature|product|pricing|plan|business|why|switch|help|team|work|market|project|crm|tv|sim)/i;
const BAD = /(login|log-in|signin|sign-in|legal|privacy|cookie|terms|careers|jobs|press|news|blog\/|investor|sitemap|\.pdf|\?|#|status|contact|accessib|complain|search)/i;
const fc = async (path, body) => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://api.firecrawl.dev/v1/${path}`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.success !== false) return j;
    await new Promise((s) => setTimeout(s, 4000 * (i + 1)));
  }
  return null;
};
const words = (t) => t.split(/\s+/).filter(Boolean).length;
const out = existsSync(dir + "corpus.json") ? JSON.parse(readFileSync(dir + "corpus.json", "utf8")) : {};
let credits = 0;
for (const [sector, domains] of Object.entries(SECTORS)) {
  for (const d of domains) {
    if (out[d]?.pages?.length >= 4) continue;
    const m = await fc("map", { url: `https://www.${d.replace(/^www\./, "")}`, limit: 400 }); credits++;
    const links = [...new Set((m?.links || []).map((u) => u.split("#")[0].replace(/\/$/, "")))];
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
    const cands = links.filter((u) => host(u) === d && !BAD.test(u) && GOOD.test(new URL(u).pathname) && new URL(u).pathname.split("/").filter(Boolean).length <= 2)
      .sort((a, b) => a.length - b.length);
    // spread over different first path segments
    const seen = new Set(); const picks = [`https://www.${d}`];
    for (const u of cands) { const seg = new URL(u).pathname.split("/")[1]; if (!seen.has(seg)) { seen.add(seg); picks.push(u); } if (picks.length >= 9) break; }
    const pages = [];
    for (const u of picks) {
      if (pages.length >= 4) break;
      const j = await fc("scrape", { url: u, formats: ["rawHtml"], onlyMainContent: false, waitFor: 1500, location: { country: "GB" } }); credits++;
      const html = j?.data?.rawHtml; if (!html) continue;
      const t = htmlToText(html).text;
      const w = words(t);
      if (w < 150) { console.log("  skip", u, w); continue; }
      const text = t.split(/\s+/).slice(0, 700).join(" ");
      pages.push({ url: u, words: Math.min(w, 700), text });
    }
    out[d] = { sector, pages };
    console.log(sector, d, pages.length, pages.map((p) => p.words).join(","), "credits so far", credits);
    writeFileSync(dir + "corpus.json", JSON.stringify(out));
  }
}
console.log("done, firecrawl credits", credits);
