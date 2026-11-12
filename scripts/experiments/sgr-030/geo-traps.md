# Geo-redirect traps hit during the SGR-030 probe (13 Oct 2026)

The probe ran from the Jarvis VPS. `curl https://ipinfo.io/country` returns **FI**: the VPS is geolocated in
Finland (it is a Hetzner box), not Germany. Requests carried `Accept-Language: en-GB,en;q=0.9`, which most sites ignore in favour of the IP.

Sites that bounced the request (18 pairs end `geo-trapped` in `candidates.json`):

| Brand | What happened |
|---|---|
| Netflix | Both /gb and /us land on `/fi-en/` |
| Stripe | `/gb` is served, `/us` lands on `/en-fi` |
| Uber | `/gb/en` ok, `/us/en` redirected to `/fi/en` |
| Salesforce | `/uk` kept as `/uk/`, root redirected to `/eu/` |
| Virgin Atlantic | both bases land on `/en-EU` |
| Huel | both bases land on `eu.huel.com` |
| Haribo, Hasbro, Pepsi, Innocent | land on `fi-fi` or Finnish `lang` |
| Gymshark | UK store `uk.` ok, US request goes to `row.gymshark.com` (rest of world) |
| Barbour | `/row/` instead of `/us/` |
| Patagonia | UK goes to `eu.patagonia.com/gb/en`, a different shop |
| Spotify, Slack, Mailchimp, Asana, Heinz, Deliveroo | the two bases collapse onto one URL (no separate US site reachable from here) |
| Google Workspace | `/intl/en_uk` ok, root `/` goes to a locale picked by IP |

Other traps:
- **Bot walls, not geography.** 64 pairs return 403/401/406/418/429/500 to plain curl even with browser headers (Akamai, Cloudflare, PerimeterX: Nike, Adidas, Lego, Tesla, McDonald's, KFC, Dyson, Lush, Gap, Levi's and others). They are marked `bot-blocked`, not failed: Firecrawl may see them, but that is unproved and must be tested with a handful of scrape credits after the reset.
- **429 rate limiting** on small sites after 3 requests (Ted Baker, BrewDog, Glossier); retried once after 8 s.
- **Locale vs country paths.** `/uk`, `/en-gb`, `/gb/en`, `/en_GB`, `/GB/en`, `/uk-en` and `en_uk` all occur; the strip regex must be per-brand (`uk_base`/`us_base` in `candidates.json` hold the exact prefix). `/gb` is Great Britain, `/uk` the same market.
- **US as root.** Apple, Adobe, Dropbox, Zendesk and others serve the US site at `/` with variants under `/uk`; a naive "strip any 2-letter segment" would also strip legitimate paths. Match only after removing the declared base prefix.
- **Sitemaps lie by locale.** Some brands (Aldi, Burberry, Boohoo) list every locale in one index; others (Wise, Pret, Rapha) give none for a locale. 51 of the 85 verified pairs gave no matching paths from sitemaps alone, so their pair potential is `unmeasured`, not zero.
- **Same company, different company.** Nationwide, Prudential, Allianz, AXA, Zurich, Cadbury/Hershey and Ocado/Ocado Group are different entities in the UK and US and are excluded.
- **Mitigation for the real run:** set Firecrawl's `location` (country GB for the UK side, US for the US side, plus matching languages) and verify `finalUrl` per page; or fetch only brands whose locale is in the URL path, which geo-redirects do not override.
