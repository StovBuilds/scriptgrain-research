// Which hosts count as a brand's own writing (v1.4, 2026-10-05). A page counts if its host is
// the brand's domain or a subdomain of it, or one of the brand's own group, corporate or
// newsroom sites below (checked by hand). v1.1-v1.3 accepted any host whose name started with
// the brand's name plus "news", "group", "plc" and similar, which let in unrelated sites
// (eenews.net for EE, octopus-news.com for Octopus Energy, notionpress.com for Notion).
export const GROUP_HOSTS = {
  "sky.com": ["skygroup.sky"], "natwest.com": ["natwestgroup.com"], "tesco.com": ["tescoplc.com"],
  "morrisons.com": ["morrisons-corporate.com"], "ocado.com": ["ocadogroup.com"], "talktalk.co.uk": ["talktalkgroup.com"],
  "skipton.co.uk": ["skiptongroup.com"], "asos.com": ["asosplc.com"], "tui.co.uk": ["tuigroup.com"], "esure.com": ["esuregroup.com"],
  "admiral.com": ["admiralgroup.co.uk"], "next.co.uk": ["nextplc.co.uk"], "jet2.com": ["jet2plc.com"], "hsbc.co.uk": ["hsbc.com"],
  "scottishpower.co.uk": ["scottishpower.com"], "outfoxthemarket.co.uk": ["outfox.energy"], "o2.co.uk": ["virginmediao2.co.uk"],
  "virginmedia.com": ["virginmediao2.co.uk"], "bupa.co.uk": ["bupa.com"], "johnlewis.com": ["johnlewispartnership.co.uk"],
  "newlook.com": ["newlookgroup.com"], "barclays.co.uk": ["home.barclays"], "octopus.energy": ["octopusenergy.group"], "slack.com": ["slackhq.com"],
};
export function ownHost(domain, url) {
  let h; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return false; }
  if (h === domain || h.endsWith("." + domain)) return true;
  return (GROUP_HOSTS[domain] ?? []).some((g) => h === g || h.endsWith("." + g));
}
