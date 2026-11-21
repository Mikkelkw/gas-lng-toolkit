# SPEC: Gas & LNG Toolkit

## 1. Purpose

A free, public, non-commercial website with two interactive tools for gas and LNG market participants. Built by Mikkel Wahl as a personal initiative to demonstrate commodity market understanding. No ads, no paywall, no login, no tracking beyond privacy-friendly analytics.

Success means: a trader or analyst can open a tool, change an assumption, and understand the result within 60 seconds, and every number on the page can be traced to a stated source or assumption.

## 2. Decisions (defaults; change before build if needed)

| Decision | Default |
|---|---|
| Site name | Gas & LNG Toolkit |
| Domain | none at first (use the free *.pages.dev URL); add custom domain later |
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
- /netback
- /storage
- /methodology: formulas, assumptions with sources, model fit, limitations
- /about: who built it and why, link to LinkedIn and the GitHub repo
- Footer on every page: "Not investment advice. Data: GIE AGSI+ / ALSI, EIA, ECB, Open-Meteo (CC BY 4.0). Built by Mikkel Wahl."

## 6. Tech stack

- Astro static site, TypeScript, with small interactive islands (Preact) for the tools
- Charts: Observable Plot (or Chart.js if simpler)
- Data pipeline: Python 3.12 scripts in `/pipeline` that fetch data and write JSON to `site/public/data/`
- Scheduling: GitHub Actions cron, daily at 07:00 UTC: fetch data, commit updated JSON, build the site, and deploy with `wrangler pages deploy` (Cloudflare API token and account ID stored as GitHub secrets)
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
9. **Polish**: home, about, methodology, footer, mobile check, Lighthouse score above 90, accessibility basics.
10. **Final review**: run all tests, check every attribution is present, check all pages on mobile width. [CHECKPOINT: summary of what was built, known limitations, suggested v1.1 items]

## 9. Out of scope for v1

User accounts, email newsletter, licensed price feeds, oil tools, real-time data, comments.
