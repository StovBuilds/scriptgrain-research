// Best publish date for a stored page, and where it came from. In order of trust:
//   meta     the page's own metadata (article:published_time and similar, via Firecrawl)
//   jsonld   schema.org datePublished in the page's JSON-LD (fetched from v1.2 on)
//   url      a year (and month) in the URL path: /2019/03/..., /news/2019-03-12-...
//   text     a full date near the top of the page's text ("12 March 2019", "March 12, 2019", "2019-03-12")
//   captured for archived pages (v1.3) with nothing better: the Wayback capture month, an upper bound
// Returns { date: "YYYY" | "YYYY-MM" | "YYYY-MM-DD" | null, source }.
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = MONTHS.map((m) => m.slice(0, 3));
const pad = (n) => String(n).padStart(2, "0");
const valid = (y) => y >= 1990 && y <= 2026;

function iso(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/((?:19|20)\d{2})-(\d{2})(?:-(\d{2}))?/);
  if (m && valid(+m[1]) && +m[2] >= 1 && +m[2] <= 12) return m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) { const d = new Date(t); if (valid(d.getUTCFullYear())) return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  return null;
}

export function fromUrl(u) {
  let path; try { path = new URL(u).pathname; } catch { return null; }
  let m = path.match(/\/((?:19|20)\d{2})[/-](\d{1,2})(?:[/-](\d{1,2}))?(?:\/|-|$)/);
  if (m && valid(+m[1]) && +m[2] >= 1 && +m[2] <= 12) return m[3] && +m[3] <= 31 ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : `${m[1]}-${pad(m[2])}`;
  m = path.match(/(?:^|[/_-])((?:19|20)\d{2})(?:[/_-]|$)/);
  if (m && valid(+m[1])) return m[1];
  return null;
}

export function fromText(text) {
  if (!text) return null;
  const head = text.slice(0, 1500);
  let m = head.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?,?\s+((?:19|20)\d{2})\b/i);
  if (m && valid(+m[3])) return `${m[3]}-${pad(MON.indexOf(m[2].slice(0, 3).toLowerCase()) + 1)}-${pad(m[1])}`;
  m = head.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+((?:19|20)\d{2})\b/i);
  if (m && valid(+m[3])) return `${m[3]}-${pad(MON.indexOf(m[1].slice(0, 3).toLowerCase()) + 1)}-${pad(m[2])}`;
  m = head.match(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/);
  if (m && valid(+m[1]) && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function jsonLdDate(html) {
  if (!html) return null;
  const m = html.match(/"datePublished"\s*:\s*"([^"]{8,40})"/);
  return m ? iso(m[1]) : null;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);
const PUBLISHED_KEYS = ["article:published_time", "publishedTime", "datePublished", "og:article:published_time", "date", "dc.date", "DC.date", "dcterms.created"];

export function bestDate(row) {
  const m = row.metadata ?? {};
  const meta = PUBLISHED_KEYS.map((k) => iso(first(m[k]))).find(Boolean);
  if (meta) return { date: meta, source: "meta" };
  if (row.date_jsonld) return { date: row.date_jsonld, source: "jsonld" };
  const u = fromUrl(row.url);
  if (u) return { date: u, source: "url" };
  // A date in the text on or after the fetch day is page furniture (a calendar, "today"), not a publish date.
  const t = fromText(row.markdown);
  const ceiling = row.wayback_ts ? `${row.wayback_ts.slice(0, 4)}-${row.wayback_ts.slice(4, 6)}-${row.wayback_ts.slice(6, 8)}` : row.fetched_at?.slice(0, 10);
  if (t && (!ceiling || t <= ceiling) && !(row.wayback_ts && t === ceiling)) return { date: t, source: "text" };
  // Archived pages (v1.3): published no later than the capture, so the capture month is an upper bound.
  if (row.wayback_ts) return { date: `${row.wayback_ts.slice(0, 4)}-${row.wayback_ts.slice(4, 6)}`, source: "captured" };
  // Last resort: v1 stored a modified time in `published` when a page had no published time.
  const mod = iso(row.published);
  if (mod) return { date: mod, source: "modified" };
  return { date: null, source: null };
}

/** Year bucket for sampling before a page is fetched (URL only). */
export const urlYear = (u) => { const d = fromUrl(u); return d ? d.slice(0, 4) : null; };
