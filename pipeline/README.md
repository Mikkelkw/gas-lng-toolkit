# Pipeline

Python 3.12 scripts that fetch public data and write JSON to `site/public/data/`.

## Setup

```
python -m venv .venv
.venv/Scripts/activate      # Windows; use .venv/bin/activate elsewhere
pip install -r pipeline/requirements.txt
python -m pytest pipeline
```

Secrets (`EIA_API_KEY`, `GIE_API_KEY`) are read from the repo-root `.env` locally, or from GitHub Actions secrets in CI.

## Running

```
python -m pipeline.build            # daily: re-fetch the last 45 days and merge onto stored history
python -m pipeline.build --full     # re-fetch everything from 2015-10-01
python -m pipeline.build --only storage
```

Outputs in `site/public/data/`:

| File | Content | Sources |
|---|---|---|
| `market.json` | Latest Henry Hub and EUR/USD with dates | EIA, ECB |
| `storage.json` | EU storage TWh, % full, net withdrawal TWh/d, LNG send-out TWh/d, daily from 2015-10-01 | GIE AGSI+, GIE ALSI |
| `weather.json` | Gas-demand-weighted EU mean temperature, observed from 2015-10-01 plus 16-day forecast | Open-Meteo |
| `status.json` | Last attempt, last success and error per output | pipeline |

Failure handling: each output is validated (freshness, no gaps, no shrinking history, value ranges) before an atomic write. On any failure the previous file is kept unchanged and the error is recorded in `status.json`.

## Endpoints used

Each endpoint is recorded after reading the provider's documentation.

### EIA API v2 (Henry Hub spot)

- Docs: https://www.eia.gov/opendata/documentation.php
- Route metadata, queried as the docs advise: `GET https://api.eia.gov/v2/natural-gas/pri/fut?api_key=...` lists frequencies (`daily`, `weekly`, `monthly`, `annual`), facets (`duoarea`, `product`, `process`, `series`) and the data column `value`.
- Data: `GET https://api.eia.gov/v2/natural-gas/pri/fut/data/?api_key=...&frequency=daily&data[]=value&facets[series][]=RNGWHHD&sort[0][column]=period&sort[0][direction]=desc&length=N`
- Rows at `response.data[]`, fields `period` (YYYY-MM-DD), `value` (string), `units` (`$/MMBTU`). Max 5,000 rows per request. Key must be in the URL.
- Terms: public domain, attribution "Source: EIA".

### ECB (EUR/USD)

- Docs: ECB reference rates page, https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html ("Time series", "XML (last 90 days only)").
- Data: `GET https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml`. No key.
- Format: `<Cube time="YYYY-MM-DD"><Cube currency="USD" rate="1.099"/>...`, namespace `http://www.ecb.int/vocabulary/2002-08-01/eurofxref`. Published around 16:00 CET on working days.
- The ECB Data Portal API docs (data.ecb.europa.eu/help/api) returned HTTP 503 on 2026-11-21, so the documented XML download is used instead.
- Terms: free reuse with source quoted ("Source: ECB").

### GIE AGSI+ (EU storage) and ALSI (EU LNG send-out)

- Docs: GIE "User Manual API access to AGSI / ALSI", v008 (01 June 2023), https://www.gie.eu/transparency-platform/GIE_API_documentation_v008.pdf
- Data: `GET https://agsi.gie.eu/api?type=eu&from=YYYY-MM-DD&to=YYYY-MM-DD&size=300&page=N` and the same on `https://alsi.gie.eu/api`. Header `x-key: <GIE_API_KEY>`.
- Paging: `size` max 300; loop to `last_page`. Rows come newest first. Values are strings.
- Fields used. AGSI: `gasDayStart`, `gasInStorage` (TWh), `full` (%), `workingGasVolume` (TWh), `injection`, `withdrawal`, `netWithdrawal` (GWh/d), `status` (E/C/N). ALSI: `gasDayStart`, `sendOut` (GWh/d), `status`.
- Rate limit: 60 calls per minute, 60-second penalty. The pipeline pauses 1.2 s between pages and retries once after 65 s if a response is empty.
- Publication: daily at 19:30 CET and 23:00 CET, for the previous gas day.
- Terms: free; "a clear indication on GIE as data source is mandatory" ("Source: GIE AGSI+", "Source: GIE ALSI").

### Open-Meteo (temperatures)

- Docs: https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/historical-weather-api
- Forecast: `GET https://api.open-meteo.com/v1/forecast?latitude=..,..&longitude=..,..&daily=temperature_2m_mean&timezone=UTC&forecast_days=16&past_days=7`
- Archive: `GET https://archive-api.open-meteo.com/v1/archive?latitude=..&longitude=..&daily=temperature_2m_mean&timezone=UTC&start_date=..&end_date=..`
- Multiple comma-separated coordinates return a list of location objects, each with `daily.time` and `daily.temperature_2m_mean` (°C). City basket and weights: `data/city_weights.json`.
- Limits: free for non-commercial use, under 10,000 calls per day. The pipeline makes 2 calls per run.
- Licence: CC BY 4.0. Attribution "Weather data: Open-Meteo (CC BY 4.0)" with a link to https://open-meteo.com/ wherever the data are shown.

### Eurostat (city weights, one-off)

- `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_cb_gas?format=JSON&lang=EN&nrg_bal=IC_CAL&siec=G3000&unit=TJ_GCV&time=2024`, retrieved 2026-11-21. Used only to set the weights in `data/city_weights.json`.
