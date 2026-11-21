"""Fetchers for every data source. Each has a network function and a pure parser.

Endpoints are documented in pipeline/README.md. Parsers validate and raise
FetchError on anything unexpected, so bad data never reaches the site.
"""
from __future__ import annotations

import math
import time
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from typing import Any

from .config import get_secret
from .http_util import FetchError, get

# ---------------------------------------------------------------- EIA

EIA_URL = "https://api.eia.gov/v2/natural-gas/pri/fut/data/"


def parse_eia(payload: dict[str, Any]) -> list[tuple[str, float]]:
    """Return (date, $/MMBtu) pairs, oldest first, from an EIA v2 response."""
    try:
        rows = payload["response"]["data"]
    except (KeyError, TypeError) as e:
        raise FetchError("EIA: unexpected response shape") from e
    out = []
    for row in rows:
        if row.get("series") not in (None, "RNGWHHD"):
            continue
        try:
            d = date.fromisoformat(row["period"]).isoformat()
            v = float(row["value"])
        except (KeyError, TypeError, ValueError):
            continue
        if 0 < v < 100:
            out.append((d, v))
    if not out:
        raise FetchError("EIA: no valid Henry Hub rows")
    return sorted(set(out))


def fetch_henry_hub(rows: int = 30) -> list[tuple[str, float]]:
    params = {
        "api_key": get_secret("EIA_API_KEY"),
        "frequency": "daily",
        "data[]": "value",
        "facets[series][]": "RNGWHHD",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": rows,
    }
    return parse_eia(get(EIA_URL, params=params).json())


# ---------------------------------------------------------------- ECB

ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml"
_ECB_NS = {"e": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref"}


def parse_ecb(xml_text: str, currency: str = "USD") -> list[tuple[str, float]]:
    """Return (date, rate) pairs, oldest first, from the ECB eurofxref XML."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise FetchError("ECB: invalid XML") from e
    out = []
    for day in root.iterfind(".//e:Cube[@time]", _ECB_NS):
        for c in day.iterfind("e:Cube[@currency]", _ECB_NS):
            if c.get("currency") == currency:
                try:
                    out.append((date.fromisoformat(day.get("time", "")).isoformat(), float(c.get("rate", ""))))
                except ValueError:
                    pass
    out = [(d, v) for d, v in out if 0.5 < v < 2.5]
    if not out:
        raise FetchError("ECB: no USD rates found")
    return sorted(out)


def fetch_eurusd() -> list[tuple[str, float]]:
    return parse_ecb(get(ECB_URL).text)


# ---------------------------------------------------------------- GIE AGSI+ / ALSI

AGSI_URL = "https://agsi.gie.eu/api"
ALSI_URL = "https://alsi.gie.eu/api"
GIE_PAGE_SIZE = 300  # documented maximum
GIE_PAUSE_S = 1.2  # stays under the documented 60 calls per minute


def _num(x: Any) -> float | None:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


def parse_agsi_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """EU storage rows to {gasDay: {storage_twh, full_pct, net_withdrawal_twh, wgv_twh}}.

    AGSI units: gasInStorage and workingGasVolume in TWh, flows in GWh/d, full in %.
    Rows with status N (no data) or missing values are skipped.
    """
    out: dict[str, dict[str, float]] = {}
    for r in rows:
        if r.get("status") == "N":
            continue
        day = r.get("gasDayStart")
        stor, full, wgv = _num(r.get("gasInStorage")), _num(r.get("full")), _num(r.get("workingGasVolume"))
        inj, wd = _num(r.get("injection")), _num(r.get("withdrawal"))
        nw = _num(r.get("netWithdrawal"))
        if nw is None and inj is not None and wd is not None:
            nw = wd - inj
        if not day or stor is None or full is None or wgv is None or nw is None:
            continue
        if not (0 < stor <= wgv * 1.05 and 0 <= full <= 105):
            continue
        out[date.fromisoformat(day).isoformat()] = {
            "storage_twh": round(stor, 4),
            "full_pct": round(full, 2),
            "net_withdrawal_twh": round(nw / 1000, 4),
            "wgv_twh": round(wgv, 4),
            # EU-level annual gas consumption in TWh, published by AGSI for countries and the EU.
            "consumption_twh": _num(r.get("consumption")),
        }
    return out


def parse_alsi_rows(rows: list[dict[str, Any]]) -> dict[str, float]:
    """EU LNG rows to {gasDay: sendout_twh}. ALSI sendOut is in GWh/d."""
    out: dict[str, float] = {}
    for r in rows:
        if r.get("status") == "N":
            continue
        day, so = r.get("gasDayStart"), _num(r.get("sendOut"))
        if day and so is not None and so >= 0:
            out[date.fromisoformat(day).isoformat()] = round(so / 1000, 4)
    return out


def _gie_pages(url: str, start: str, end: str) -> list[dict[str, Any]]:
    key = get_secret("GIE_API_KEY")
    rows: list[dict[str, Any]] = []
    page, last = 1, 1
    while page <= last:
        params = {"type": "eu", "from": start, "to": end, "size": GIE_PAGE_SIZE, "page": page}
        j = get(url, params=params, headers={"x-key": key}).json()
        if not isinstance(j, dict) or not isinstance(j.get("data"), list):
            raise FetchError(f"GIE: unexpected response from {url}")
        rows.extend(j["data"])
        last = int(j.get("last_page") or 1)
        page += 1
        if page <= last:
            time.sleep(GIE_PAUSE_S)
    return rows


GIE_RETRY_WAIT_S = 65  # the documented rate-limit penalty is 60 seconds


def _gie_with_retry(url: str, start: str, end: str, parse, label: str):
    """GIE has been seen to return an empty page right after heavy use. Retry once after the penalty window."""
    out = parse(_gie_pages(url, start, end))
    if not out:
        time.sleep(GIE_RETRY_WAIT_S)
        out = parse(_gie_pages(url, start, end))
    if not out:
        raise FetchError(f"{label}: no valid EU rows")
    return out


def fetch_agsi(start: str, end: str) -> dict[str, dict[str, float]]:
    return _gie_with_retry(AGSI_URL, start, end, parse_agsi_rows, "AGSI")


def fetch_alsi(start: str, end: str) -> dict[str, float]:
    return _gie_with_retry(ALSI_URL, start, end, parse_alsi_rows, "ALSI")


# ---------------------------------------------------------------- Open-Meteo

OM_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OM_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def weighted_daily_mean(payload: Any, weights: list[float]) -> dict[str, float]:
    """Combine a multi-location Open-Meteo daily response into one weighted series.

    A day is kept only if every city has a value, so missing cities never bias the mean.
    """
    locs = payload if isinstance(payload, list) else [payload]
    if len(locs) != len(weights):
        raise FetchError(f"Open-Meteo: expected {len(weights)} locations, got {len(locs)}")
    series = []
    for loc in locs:
        try:
            series.append(dict(zip(loc["daily"]["time"], loc["daily"]["temperature_2m_mean"])))
        except (KeyError, TypeError) as e:
            raise FetchError("Open-Meteo: unexpected response shape") from e
    out: dict[str, float] = {}
    for day in series[0]:
        vals = [s.get(day) for s in series]
        if all(isinstance(v, (int, float)) for v in vals):
            out[day] = round(sum(w * v for w, v in zip(weights, vals)) / sum(weights), 2)
    return out


def _om_params(cities: list[dict[str, Any]]) -> dict[str, str]:
    return {
        "latitude": ",".join(str(c["lat"]) for c in cities),
        "longitude": ",".join(str(c["lon"]) for c in cities),
        "daily": "temperature_2m_mean",
        "timezone": "UTC",
    }


def fetch_temperature_archive(cities: list[dict[str, Any]], start: str, end: str) -> dict[str, float]:
    params = {**_om_params(cities), "start_date": start, "end_date": end}
    out = weighted_daily_mean(get(OM_ARCHIVE_URL, params=params, timeout=180).json(), [c["weight"] for c in cities])
    if not out:
        raise FetchError("Open-Meteo archive: no complete days")
    return out


def fetch_temperature_forecast(cities: list[dict[str, Any]], past_days: int = 7) -> dict[str, float]:
    """Recent days (past_days) plus the 16-day forecast."""
    params = {**_om_params(cities), "forecast_days": "16", "past_days": str(past_days)}
    out = weighted_daily_mean(get(OM_FORECAST_URL, params=params).json(), [c["weight"] for c in cities])
    if len(out) < 10:
        raise FetchError("Open-Meteo forecast: too few days")
    return out


def date_range(start: str, end: str) -> list[str]:
    a, b = date.fromisoformat(start), date.fromisoformat(end)
    return [(a + timedelta(days=i)).isoformat() for i in range((b - a).days + 1)]
