# SPEC: LNG Toolkit

## 1. Purpose

A free, public, non-commercial website with two interactive tools for gas and LNG market participants. Built by Mikkel Wahl as a personal initiative to demonstrate commodity market understanding. No ads, no paywall, no login, no tracking beyond privacy-friendly analytics.

Success means: a trader or analyst can open a tool, change an assumption, and understand the result within 60 seconds, and every number on the page can be traced to a stated source or assumption.

## 2. Decisions (defaults; change before build if needed)

| Decision | Default |
|---|---|
| Site name | LNG Toolkit (was "LNG Flow Tools" from phase 9 to section 11.3) |
| Domain | lngtoolkit.com (from section 11.3). *.pages.dev and www 301 to it |
| Author line | Built by Mikkel Wahl |
| LinkedIn URL | https://www.linkedin.com/in/mikkelwahl/ |
| GitHub repo | public, name `gas-lng-toolkit` |
| Hosting | Cloudflare Pages |
| Units | $/MMBtu for prices; TWh and % full for storage |
| Language | British English |
| Visual style | clean, minimal, dark-on-light, one accent colour (deep teal), mobile-first |

## 3. Tool 1: US LNG Netback & Arbitrage Calculator

### Question it answers
For a US Gulf Coast cargo, which destination and route gives the best netback, and how far is the arb from flipping?

### Destinations and routes (v1)
- Northwest Europe (TTF), direct
- North Asia (JKM) via Panama
- North Asia (JKM) via Suez
- North Asia (JKM) via Cape of Good Hope

### Inputs (all editable by the user; defaults from `data/assumptions.json`)
- Henry Hub ($/MMBtu): default = latest EIA spot, shown with "as of" date
- TTF (€/MWh): manual default, shown with "as of" date
- JKM ($/MMBtu): manual default, shown with "as of" date
- EUR/USD: default = latest ECB reference rate
- Charter rate ($/day)
- Vessel size (m³) and conversion factor (MMBtu per m³)
- Boil-off rate (% per day)
- Vessel speed (knots) and voyage distances (nautical miles) per route
- Canal fees (Panama, Suez) in $ per transit
- Port and other costs ($ per voyage)
- Liquefaction fee ($/MMBtu) and feedgas multiplier (default 115% of HH)

### Calculations
- TTF conversion: $/MMBtu = €/MWh × EURUSD / 3.412
- Voyage days = distance / (speed × 24); round trip = 2 × one-way (ballast return assumed)
- Shipping cost per MMBtu = (charter rate × round-trip days + canal fees (both ways) + port costs) / delivered MMBtu
- Boil-off cost = cargo MMBtu × boil-off rate × laden days × destination price / delivered MMBtu
- Delivered MMBtu = loaded MMBtu × (1 − boil-off rate × laden days)
- FOB netback (per route) = destination price − shipping cost − boil-off cost
- Cost of supply at FOB = feedgas multiplier × HH + liquefaction fee
- Margin = FOB netback − cost of supply (shows whether lifting the cargo makes sense at all)
- Arb = best Asia netback − Europe netback
- Breakeven: JKM level at which Asia and Europe netbacks are equal, given all other inputs

All formulas live in one pure TypeScript module with unit tests and are shown on the page in a "How this is calculated" section.

### Outputs
- Result table: route, voyage days, shipping cost, boil-off cost, FOB netback, margin vs cost of supply
- Headline: "Best destination: X via Y, by $Z/MMBtu"
- Chart: netback by route as horizontal bars
- Chart: sensitivity of the Europe-Asia arb to the charter rate (line), with the breakeven marked
- "Copy link" button that encodes current inputs in the URL so users can share a scenario

## 4. Tool 2: EU Gas Storage Winter Stress Test

### Question it answers
Given today's EU storage level, where will storage be on 31 March under different weather and supply assumptions?

### Data (refreshed daily by GitHub Actions)
- EU aggregate storage (TWh, % full, net injection/withdrawal), daily: GIE AGSI+
- EU LNG sendout, daily: GIE ALSI
- Population-weighted EU temperature: Open-Meteo (forecast up to 16 days, archive for history) for a fixed basket of cities with fixed weights (see `data/city_weights.json`, documented as a simplification)
- Optional v1.1: pipeline flows from ENTSOG

### Model (simple, explainable)
1. Fit on past winters (Oct to Mar, at least 5 winters): daily net withdrawal (TWh) = a + b × HDD + c × (LNG sendout deviation from its winter average). HDD base 15.5 °C.
2. Store fitted coefficients and fit statistics (R², sample) in `data/model.json`; show them on the methodology page.
3. Projection from today to 31 March: use the 16-day weather forecast first, then the historical average HDD by calendar day, adjusted by the user's scenario.

### Scenario controls
- Temperature vs normal (°C, slider −4 to +4)
- LNG sendout vs recent average (%, slider −30 to +30)
- Supply disruption (TWh/day removed, slider 0 to 0.5) with optional start date and duration
- Demand response (%, slider 0 to 15)
- Presets: "Normal", "Cold winter", "Cold + LNG shortfall", "Mild"

### Outputs
- Chart: storage % full from 1 October to 31 March: this winter actual, projection under the scenario, and the range (min/max) and average of the previous 5 winters
- Headline: "Projected 31 March storage: X% (Y TWh) under this scenario"
- Small table: projection under each preset
- "Data as of [date]" label; if a refresh failed, show last good data with its date, never an error page

## 5. Site pages

- Home: one-line pitch, two tool cards, last-updated date
- /lng-netback-calculator (old /netback redirects)
- /eu-gas-storage-forecast (old /storage redirects)
- /learn/lng-trading-basics: primer for aspiring commodity traders and finance people new to LNG (see section 5a)
- /methodology: formulas, assumptions with sources, model fit, limitations
- /about: who built it and why, link to LinkedIn and the GitHub repo
- Footer on every page: "Not investment advice. Data: GIE AGSI+ / ALSI, EIA, ECB, Open-Meteo (CC BY 4.0). Built by Mikkel Wahl."

## 5a. Primer page: LNG trading basics

Audience: readers with a finance background but little knowledge of LNG or commodities (students, analysts, aspiring traders). Tone: clear, concrete, no jargon without a definition. Length: about 1,500 to 2,000 words, readable in 10 minutes. Link to it from the home page and from the top of both tool pages ("New to LNG? Start with the basics").

Sections:
1. **Three gas markets**: Henry Hub, TTF, JKM; why pipeline gas cannot cross oceans; LNG as the link. Supply chain: liquefaction, shipping, regasification. FOB vs DES.
2. **The economics of a US cargo**: the tolling model (115% of HH plus a fixed liquefaction fee paid whether or not the cargo is lifted); destination flexibility.
3. **The option analogy**: a US LNG contract as a call option on the overseas price minus HH; the fee as the premium; lifting vs cancelling a cargo (mention the 2020 cancellations).
4. **Netbacks and the arb**: definition, a worked example with clearly labelled illustrative round numbers, why a higher destination price does not always mean a better destination.
5. **What drives shipping cost**: charter rates, routes (Panama, Suez, Cape) and their risks, round trip, boil-off, canal fees.
6. **Why the JKM-TTF spread trades around freight**: flexible US cargoes as swing supply; location spread intuition.
7. **European gas storage**: injection and withdrawal seasons, the pre-winter fill target, why the 31 March level matters, summer-winter spread.
8. **Storage as a stress test**: heating degree days, the scenario approach used in the storage tool.
9. **How it all connects**: low storage, higher TTF, cargoes pulled from Asia, spread moves.
10. **Glossary**: MMBtu, MWh, HDD, FOB, DES, netback, arb, boil-off, charter rate, regas, TTF, JKM, HH.
11. **Further reading**: links to free public sources only (e.g. EIA, GIE, IEA, ENTSOG, ACER).

Rules: every factual statement must be general and stable or sourced; no current prices; illustrative numbers must be labelled as illustrative. Each section ends with a one-line link to the relevant tool where useful ("Try it in the netback calculator"). Use plain headings that match search terms (e.g. "What is an LNG netback?", "How does LNG arbitrage work?").

## 6. Tech stack

- Astro static site, TypeScript, with small interactive islands (Preact) for the tools
- Charts: Observable Plot (or Chart.js if simpler)
- Data pipeline: Python 3.12 scripts in `/pipeline` that fetch data and write JSON to `site/public/data/`
- Scheduling: GitHub Actions cron, daily at 05:17 UTC with a backup run at 14:43 UTC (was 07:00 until 22 Nov 2026): fetch data, commit updated JSON, build the site, and deploy with `wrangler pages deploy` (Cloudflare API token and account ID stored as GitHub secrets)
- Tests: Vitest for TypeScript calculation modules, pytest for the pipeline
- No database, no backend server, no Claude API at runtime

## 7. Data sources and attribution

| Source | Use | Key | Attribution |
|---|---|---|---|
| EIA API v2 | Henry Hub spot | EIA_API_KEY | "Source: EIA" |
| ECB Data Portal (EXR) | EUR/USD | none | "Source: ECB" |
| GIE AGSI+ | EU storage | GIE_API_KEY | "Source: GIE AGSI+" under every storage chart (mandatory) |
| GIE ALSI | LNG sendout | GIE_API_KEY | "Source: GIE ALSI" (mandatory) |
| Open-Meteo | Temperatures | none | "Weather data: Open-Meteo (CC BY 4.0)" (mandatory) |

No Platts, Argus, ICE or other licensed price data is fetched or displayed. TTF and JKM defaults are entered manually.

## 8. Build phases

Claude Code works through these in order, committing after each step, and only stops at the checkpoints marked [CHECKPOINT].

1. **Scaffold**: repo, Astro site, Python pipeline skeleton, CI for tests, `.gitignore`, `.env` loading. Push to GitHub. Deploy an empty site to Cloudflare Pages. [CHECKPOINT: send the live URL]
2. **Assumptions**: verify every default in `data/assumptions.json` against a public source (distances, canal fees, boil-off, vessel size, conversion factor, liquefaction fee, recent charter rate). Record source and date for each in `data/assumptions_sources.md`. Flag any default changed by more than 10%.
3. **Netback engine**: pure TypeScript module with full unit tests, including a hand-calculated test case.
4. **Netback page**: UI, charts, URL sharing, methodology section.
5. **Storage pipeline**: fetchers for AGSI+, ALSI, Open-Meteo, EIA, ECB, with tests; write JSON outputs.
6. **Storage model**: fit on history, save coefficients, back-test on last winter (report error at 31 March).
7. **Storage page**: UI, scenarios, charts.
8. **Automation**: daily GitHub Action, failure handling (keep last good data), deploy.
9. **Polish**: home, about, methodology, footer, mobile check, Lighthouse score above 90, accessibility basics. Plus SEO:
   - Rename the site to "LNG Flow Tools" everywhere (site config, page titles, header, footer, README, SPEC.md, CLAUDE.md). Keep the repo name and the pages.dev URL unchanged.
   - Rename routes: /netback -> /lng-netback-calculator and /storage -> /eu-gas-storage-forecast, with redirects from the old paths; update all internal links.
   - Page titles: "LNG Netback & Arbitrage Calculator: US Gulf to Europe and Asia" and "EU Gas Storage Forecast: Winter Stress Test to 31 March".
   - A unique meta description (max 155 characters) per page, Open Graph tags, canonical URLs, sitemap.xml, and robots.txt allowing indexing.
   - Write the primer page from section 5a, with its own title ("LNG Trading Basics: Netbacks, Arbitrage and European Gas Storage Explained") and meta description; add it to the nav as "Learn" and to the sitemap.
   - A 2 to 3 sentence plain-English intro at the top of each tool page, using the terms people search for (LNG netback, LNG arbitrage, JKM TTF spread, EU gas storage forecast).
10. **Final review**: run all tests, check every attribution is present, check all pages on mobile width. [CHECKPOINT: summary of what was built, known limitations, suggested v1.1 items]

## 9. Out of scope for v1

User accounts, email newsletter, licensed price feeds, oil tools, real-time data, comments.

## 11. v1.1: Redesign, landing page and custom domain

### 11.1 Visual direction: "maritime chart room"
The site should feel like a modern ship's chart room: calm, precise, nautical, data-first. Replaces the "dark-on-light, one accent" style in section 2.

- **Palette** (check WCAG AA contrast for all text):
  - Deep navy `#0B1F33` (header, hero, footer)
  - Ocean blue `#12355B` (panels on dark sections)
  - Chart paper `#F4F1EA` (main content background)
  - Ink `#1B2733` (body text on light)
  - Brass `#C8A24A` (accents, highlights, active states)
  - Sea teal `#2A9D8F` (primary data series)
  - Signal red `#C0392B` (warnings only)
- **Typography** (self-hosted, no external font CDNs):
  - Headings: an editorial serif (e.g. Fraunces or Source Serif 4)
  - Body: a clean sans (e.g. Inter)
  - Numbers and inputs: tabular monospace (e.g. IBM Plex Mono), so figures line up
- **Motifs** (subtle, never decorative clutter):
  - Faint latitude/longitude graticule and chart grid lines as background texture on dark sections
  - An original, simplified SVG world map showing the four routes from Sabine Pass: to Rotterdam, and to Tokyo via Panama, Suez and the Cape, as dashed route lines. Use public-domain map data (Natural Earth) only.
  - Thin brass rules as section dividers; small nautical touches (e.g. a minimal compass mark in the logo) are fine, kitsch is not
- **Charts**: restyle all Observable Plot charts to the palette (teal series, brass highlights, navy axes, paper background).
- **Motion**: gentle only (e.g. route lines drawing in on the hero), and fully disabled under `prefers-reduced-motion`.
- **Quality bar**: Lighthouse at least 95 in all four categories on mobile; no new heavy dependencies; mobile-first.

### 11.2 Landing page (replaces the current home page)
Sections, top to bottom:
1. **Hero** on deep navy with the route map: headline (e.g. "Where LNG flows, and why."), one-sentence subline explaining the site, two buttons: "LNG netback calculator" and "EU gas storage forecast".
2. **Live strip**: three live figures from the latest data, each with its date: EU storage % full; best destination for a US cargo at default inputs and the arb in $/MMBtu; projected 31 March storage under the Normal scenario.
3. **Three cards**: Netback calculator, Storage forecast, Learn the basics (primer), each with a one-line description and a small illustrative graphic.
4. **How it works**: three steps: public data refreshed daily (with source logos as text, not images), transparent models, you change the assumptions.
5. **Who it is for**: traders and analysts, students and career switchers, anyone following European gas.
6. **About snippet**: one or two sentences on who built it and why, linking to /about.
7. Footer as today.

### 11.3 Custom domain
- The owner buys the domain via Cloudflare Registrar and attaches it to the Pages project in the Cloudflare dashboard (the deploy token has no DNS rights).
- Then: set the custom domain as the canonical URL everywhere (site config, canonical tags, Open Graph, sitemap, robots.txt), and 301-redirect all `*.pages.dev` requests to the same path on the custom domain (e.g. with a Pages Functions middleware checking the host). Keep query strings so shared scenario links work.
- Domain: `lngtoolkit.com` (bought 2026-11-21). Also add `www.lngtoolkit.com` redirecting to the apex. As part of 11.3, rename the site from "LNG Flow Tools" to "LNG Toolkit" everywhere (titles, header, footer, logo, README, SPEC.md, CLAUDE.md). Build 11.1 and 11.2 first; do 11.3 only once the owner confirms the domain is attached.

### 11.4 Process
Work through 11.1 and 11.2 without stopping, deploy, then [CHECKPOINT: send the live URL and screenshots of the landing page at desktop and mobile width]. Then wait for the domain confirmation before 11.3.
