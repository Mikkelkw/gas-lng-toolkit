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

## Endpoints used

Each endpoint is recorded after reading the provider's documentation.

### EIA API v2 (Henry Hub spot)

- Docs: https://www.eia.gov/opendata/documentation.php
- Route metadata, queried as the docs advise: `GET https://api.eia.gov/v2/natural-gas/pri/fut?api_key=...` lists frequencies (`daily`, `weekly`, `monthly`, `annual`), facets (`duoarea`, `product`, `process`, `series`) and the data column `value`.
- Data: `GET https://api.eia.gov/v2/natural-gas/pri/fut/data/?api_key=...&frequency=daily&data[]=value&facets[series][]=RNGWHHD&sort[0][column]=period&sort[0][direction]=desc&length=N`
- Rows at `response.data[]`, fields `period` (YYYY-MM-DD), `value` (string), `units` (`$/MMBTU`). Max 5,000 rows per request. Key must be in the URL.
- Terms: public domain, attribution "Source: EIA".
