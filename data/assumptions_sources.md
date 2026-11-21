# Assumption sources

Verified on 2026-11-21. Each default in `data/assumptions.json` is listed with its source, the date of the source, and a verification note.

**Flag rule.** No `assumptions.json` existed before this verification, so there were no earlier defaults to compare against. Instead, a default is **flagged** where credible public sources disagree by more than 10%. A flag means: treat with care, and expect users to override it.

## Summary

| Input | Default | Unit | Source date | Flag |
|---|---|---|---|---|
| Henry Hub | 3.10 | $/MMBtu | 2026-11-17 | |
| TTF | 85.00 | €/MWh | 2026-11-20 | |
| JKM proxy | 27.00 | $/MMBtu | 2026-11-20 | **Flag**: moved 14% in one week |
| EUR/USD | 1.0990 | USD per EUR | 2026-11-20 | |
| Charter rate | 35,000 | $/day | 2026-11-18 | **Flag**: $25,750 to $38,400 within six weeks |
| Vessel size | 174,000 | m³ | current standard | |
| Conversion factor | 23.4 | MMBtu/m³ | n/a | |
| Boil-off | 0.085 | %/day | 2015, 2025 | **Flag**: 0.05 to 0.15 range by vessel type |
| Speed | 17 | knots | 2023 | **Flag**: Sabine Pass laden average reported at 14.3 knots |
| Distance NWE | 5,300 | nm | n/a | |
| Distance via Panama | 9,209 | nm | 2016 | |
| Distance via Suez | 14,521 | nm | 2016 | |
| Distance via Cape | 15,689 | nm | 2016 | |
| Panama fee | 640,000 | $/transit | tariff eff. 2024-01-01 and 2025-01-01 | |
| Suez fee | 450,000 | $/transit | various, undated base | **Flag**: rebates of up to 30% may apply |
| Port costs | 250,000 | $/voyage | 2024, 2025 | **Flag**: $50,000 to $360,000 per call |
| Liquefaction fee | 2.75 | $/MMBtu | 2025, 2026 | **Flag**: $2.25 to $3.50 across contracts |
| Feedgas multiplier | 115 | % of HH | SPAs 2011 onward | |

## Prices

**Henry Hub: $3.10/MMBtu, as of 2026-11-17.**
EIA API v2, route `natural-gas/pri/fut`, series `RNGWHHD` (Henry Hub Natural Gas Spot Price, daily). Fetched directly on 2026-11-21. Last ten prints ranged $2.60 to $3.26. Refreshed daily by the pipeline. EIA terms allow reuse with attribution ("Source: EIA").

**TTF: €85.00/MWh, as of 2026-11-20.** Manual default.
Public press reports put the Dec-26 front-month at €85.27 to €86.92/MWh between 17 and 20 November 2026 (tradingpedia.com, 20 Nov 2026; tokenpost.com; Yahoo Finance). Stored as an indicative round number, not a settlement or assessment. Users should enter their own level.

**JKM proxy: $27.00/MMBtu, as of 2026-11-20.** Manual default.
Press reports of the weekly North-east Asia spot LNG average: $26.90/MMBtu for January delivery in the week to 20 Nov 2026, down from $31.30 the week before; Energy Intelligence gave $27.55 on 17 Nov. Stored as an indicative round number, not a licensed assessment. Flagged because the level moved 14% in one week.

**EUR/USD: 1.0990, as of 2026-11-20.**
ECB euro foreign exchange reference rate, USD page (ecb.europa.eu). Cross-checked against Banca d'Italia's mirror of the ECB rate for 17 Nov 2026 (1.0989, versus 1.0989 on the ECB page). Refreshed daily by the pipeline. ECB reuse policy: free reuse with source quoted ("Source: ECB").

## Shipping

**Charter rate: $35,000/day, as of 2026-11-18.**
Weekly LNG shipping commentary (lngshiphorizon.substack.com): Atlantic 174k two-stroke $38,400/day in week 45 and $33,200/day in week 46 of 2026. Spark Commodities' public commentary gave $25,750/day on 6 Oct 2026. Default is the midpoint of the last two weekly readings. Flagged: spot rates are volatile and have ranged from about $25,000 to over $278,000/day during 2026.

**Vessel size: 174,000 m³.**
A 174,000 m³ capacity with 19.5 knots design speed "has progressively become the industry standard" (International Institute of Refrigeration, "The future standard for energy-saving LNG carriers").

**Conversion factor: 23.4 MMBtu per m³ of LNG.**
Derived from an LNG density of 0.45 t/m³ and 52 MMBtu/t, both common industry factors. Cross-check: Gasgrid Finland's published conversion table gives 24.02 MMBtu/m³ (+2.6%). The true value depends on LNG composition. The model applies the factor to the full vessel capacity and ignores heel and the fill limit (about 98.5%); this is a stated simplification.

**Boil-off: 0.085% per day, laden.**
Gas Carrier Update 2015 (University of Hamburg): boil-off rates improved from 0.15% to 0.085% per day over the previous decade. Argus (2025): a typical modern two-stroke carrier averages 0.08%/day, the best down to 0.05%/day with full reliquefaction. Older steam vessels run at about 0.15%/day. Flagged for the range across vessel types. The model applies boil-off to the laden leg only.

**Speed: 17 knots.**
Kpler voyage times (via MET Group, Energy Intelligence, Nov 2023): Sabine Pass to Tokyo about 22 days via Panama, 35 via Suez, 38 via the Cape. On the distances below these imply 17.4, 17.3 and 17.2 knots. Design speed for a modern 174k vessel is 19.5 knots (IIR). Reuters/BNEF reported an average laden speed from Sabine Pass of 14.3 knots in a period of slow steaming. Flagged for this range.

**Distances (nautical miles, one way, laden).**
- NW Europe: **5,300 nm**. Sealagom gives Sabine to Gravelines (France) 5,152 nm; Rotterdam is about 150 nm further. Ports.com gives Sabine Pass to Rotterdam 5,657 nm (+6.7%). Not flagged (under 10%).
- Via Panama: **9,209 nm** to Tokyo (Riviera Maritime Media, citing sea-distances.org). S&P Global (2016): 9,214 nm.
- Via Suez: **14,521 nm** to Tokyo (Riviera). S&P Global (2016): about 14,500.
- Via Cape of Good Hope: **15,689 nm** to Tokyo (S&P Global, 2016). Consistent with Kpler's 38 days versus 35 via Suez.

Tokyo Bay is used as the North Asia reference port. Ballast return is assumed to equal the laden distance (SPEC section 3).

## Fees

**Panama Canal: $640,000 per transit.**
Panama Canal Authority tolls page (pancanal.com/en/maritime-services/en-tolls/, read 2026-11-21; full tariff PDF dated 15 Oct 2026):
- Fixed charge, Neopanamax vessel incl. LNG (1010.FN02, eff. 1 Jan 2024): $300,000 per transit
- Capacity charge, LNG Neopanamax (1010.NN01, eff. 1 Jan 2025): $2.05 per m³, so $356,700 for 174,000 m³
- Vessels in ballast (1010.BA01): 85% of tolls
- Neopanamax tug, mandatory (1020.RTN1): $30,000

Laden transit: $300,000 + $356,700 + $30,000 = $686,700. Ballast transit: 85% × $656,700 + $30,000 = $588,195. Average of the two, rounded: $640,000. The optional transit reservation fee ($100,000) is excluded. The 85% base (full toll or capacity part only) is not stated on the page; the full-toll reading is assumed.

**Suez Canal: $450,000 per transit.**
An Argus table lists a nominal LNG carrier toll of about $396,715 per transit (undated). The Suez Canal Authority raised temporary surcharges for LNG carriers from 7% to 19% from 15 July 2026 (maritimegateway.com; bloominglobal.com). $396,715 × 1.12 (net surcharge increase) ≈ $445,000, rounded to $450,000. The SCA has offered LNG rebates for US Gulf to Asia voyages, recently reported at 30% and extended to 31 Dec 2026 (Leth Agencies), but their scope for Japan-bound cargoes is unclear. Flagged: low confidence, could be up to 30% lower.

**Port and other costs: $250,000 per voyage.**
Wood Mackenzie (via Riviera, 2025): US Gulf ports typically under $70,000 per call; expensive terminals $120,000 to $360,000. Platts 2024 port-cost notes for netbacks: Barcelona $150,000, Tianjin $250,000. Default: about $70,000 loading plus about $150,000 discharging, plus about $30,000 agency and sundries. Applied once per voyage, the same for all routes. Flagged for the wide range by destination.

**Liquefaction fee: $2.75/MMBtu.**
Cheniere (Q4 2025 earnings call, reported by S&P Global, Mar 2026): comfortable pricing above the midpoint of a $2.50 to $3.00 range. Argus indicative long-term benchmark (Dec 2025): 115% HH + $3.00. Older Cheniere SPAs: $2.25 to $3.50 (SEC filings). Venture Global to Vitol (Mar 2026): 119% HH + $2.80 to $3.20. Flagged for the contract range. Note: for an existing SPA holder the fee is largely sunk, so the margin calculation shows full-cycle economics.

**Feedgas multiplier: 115% of Henry Hub.**
Cheniere Sabine Pass SPAs price at 115% of the NYMEX Henry Hub settlement plus a fixed fee (SEC filings, 2011 onward). Unchanged from the SPEC default. In the model it is applied to the Henry Hub spot input.

## Source links

- EIA API v2: https://www.eia.gov/opendata/documentation.php
- EIA reuse terms: https://www.eia.gov/about/copyrights_reuse.php
- ECB USD reference rate: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html
- Banca d'Italia, rates of 17 Nov 2026: https://www.bancaditalia.it/compiti/operazioni-cambi/cambio/cambi_rif_20261117
- ECB reuse policy: https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html
- TTF press: https://www.tradingpedia.com/2026/11/20/eu-gas-rebounds-above-e86-as-mideast-risks-lift-supply/
- Asia spot LNG press: https://rallies.ai/news/asia-spot-lng-prices-fall-to-6-week-low-on-weak-demand-improved-supplies-e6e68ac32fa607c6 ; https://www.energyintel.com/000001a1-eacd-d9dd-a9e9-eadf603e0000
- Charter rates: https://lngshiphorizon.substack.com/p/lng-shipping-market-commentary-week-d03 ; https://lngshiphorizon.substack.com/p/lng-shipping-market-commentary-week-688
- IIR vessel standard: https://iifiir.org/en/fridoc/the-future-standard-for-energy-saving-lng-carriers-151410
- Gasgrid conversion table: https://gasgrid.fi/wp-content/uploads/Annex-13-Conversion-table-2.pdf
- Boil-off (Hamburg): https://epub.sub.uni-hamburg.de/epub/volltexte/2016/58606/pdf/GasCarrierUpdate_2015_web.pdf
- Boil-off (Argus): https://www.argusmedia.com/en/news-and-insights/latest-market-news/2899462-lng-carrier-efficiency-a-bigger-priority-at-high-prices
- Voyage times (Kpler via MET Group): https://group.met.com/media/bvvpdeg4/energy-intelligence_231107_met-group.pdf
- Distances: https://www.rivieramm.com/news-content-hub/milestone-transit-proves-expanded-panama-canals-value-to-us-lng-60609 ; https://www.spglobal.com/energy/en/news-research/blog/natural-gas/072816-updated-panama-canal-opens-premium-asian-markets-to-us-lng ; http://ports.com/sea-route/port-of-sabine-pass,united-states/port-of-rotterdam,netherlands/ ; https://www.sealagom.com/ports/distances/
- Panama tolls: https://pancanal.com/en/maritime-services/en-tolls/
- Suez: https://www.argusmedia.com/news/2145188-suez-canal-amends-fee-rebate-terms-for-lng-carriers ; https://www.maritimegateway.com/suez-canal-raises-transit-fees-even-as-global-carriers-trickle-back/ ; https://lethagencies.com/renewal-and-extension-of-suez-canal-fixed-rebates-until-31-december-2026
- Port costs: https://www.rivieramm.com/news-content-hub/the-hidden-geography-of-lng-shipping-risk-87776 ; https://www.spglobal.com/energy/en/pricing-benchmarks/our-methodology/subscriber-notes/060324-platts-to-launch-several-lng-freight-assessments-from-july-1
- Liquefaction fees: https://www.spglobal.com/energy/en/news-research/latest-news/electric-power/032626-venture-global-vitol-lng-deal-targets-upside-in-2026-27-spot-prices ; https://sec.gov/Archives/edgar/data/1383650/000138365011000070/0001383650-11-000070.txt
