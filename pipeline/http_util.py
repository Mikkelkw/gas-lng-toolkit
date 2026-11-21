"""Small HTTP helper: GET with timeout and retries. Never logs secrets."""
from __future__ import annotations

import time
from typing import Any

import requests

USER_AGENT = "gas-lng-toolkit-pipeline/1.0 (+https://github.com/Mikkelkw/gas-lng-toolkit)"


class FetchError(RuntimeError):
    """A data source could not be fetched or returned unusable data."""


def get(url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None,
        timeout: float = 60, retries: int = 3, backoff: float = 5.0) -> requests.Response:
    """GET with retries on network errors, 429 and 5xx. Raises FetchError on final failure."""
    hdrs = {"User-Agent": USER_AGENT, **(headers or {})}
    last = ""
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, params=params, headers=hdrs, timeout=timeout)
            if r.status_code == 200:
                return r
            last = f"HTTP {r.status_code}"
            if r.status_code not in (429, 500, 502, 503, 504):
                break
        except requests.RequestException as e:
            last = type(e).__name__
        if attempt < retries:
            time.sleep(backoff * attempt * (12 if last == "HTTP 429" else 1))
    # Only the URL path is reported: query strings may carry API keys.
    raise FetchError(f"GET {url.split('?')[0]} failed: {last}")
