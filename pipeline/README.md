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

Recorded here once each fetcher is built (phase 5), after reading the provider's documentation.
