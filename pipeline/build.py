"""Fetch all sources and write site/public/data/*.json.

Run from the repo root:  python -m pipeline.build [--full]

Rules (CLAUDE.md hard rule 6):
- Each output is built independently. A failing source never blocks the others.
- New data is merged onto the stored history and validated before writing.
- If validation fails, the previous file is kept unchanged with its date.
- Writes are atomic (temp file then rename), so a crash never leaves a partial file.
- status.json records the last attempt and last success per source.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from . import sources
from .config import DATA_DIR, SITE_DATA_DIR
from .http_util import FetchError

HISTORY_START = "2015-10-01"  # covers 10 full winters (Oct to Mar) before 2025/26
OVERLAP_DAYS = 45  # re-fetch this many recent days to pick up revisions

ATTRIBUTION = {
    "agsi": "Source: GIE AGSI+",
    "alsi": "Source: GIE ALSI",
    "openmeteo": "Weather data: Open-Meteo (CC BY 4.0)",
    "eia": "Source: EIA",
    "ecb": "Source: ECB",
}


class ValidationError(RuntimeError):
    pass


# ------------------------------------------------------------------ file helpers

def read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_json_atomic(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


# ------------------------------------------------------------------ builders

def build_market(prev: dict | None, today: date) -> dict:
    hh = sources.fetch_henry_hub(30)
    fx = sources.fetch_eurusd()
    out = {
        "updated": now_iso(),
        "henryHub": {"value": hh[-1][1], "asOf": hh[-1][0], "source": "EIA, Henry Hub Natural Gas Spot Price (RNGWHHD)"},
        "eurusd": {"value": fx[-1][1], "asOf": fx[-1][0], "source": "ECB euro foreign exchange reference rate"},
        "attribution": [ATTRIBUTION["eia"], ATTRIBUTION["ecb"]],
    }
    validate_market(out, prev, today)
    return out


def validate_market(m: dict, prev: dict | None, today: date) -> None:
    for k, (lo, hi) in {"henryHub": (0.1, 50), "eurusd": (0.5, 2.5)}.items():
        p = m[k]
        if not (lo < p["value"] < hi):
            raise ValidationError(f"{k} value {p['value']} out of range")
        age = (today - date.fromisoformat(p["asOf"])).days
        if age > 14:
            raise ValidationError(f"{k} is {age} days old")
        if prev and prev.get(k) and p["asOf"] < prev[k]["asOf"]:
            raise ValidationError(f"{k} would go backwards in time")


def _fetch_start(prev_days: list[str] | None, full: bool) -> str:
    if full or not prev_days:
        return HISTORY_START
    start = date.fromisoformat(prev_days[-1]) - timedelta(days=OVERLAP_DAYS)
    return max(start, date.fromisoformat(HISTORY_START)).isoformat()


def build_storage(prev: dict | None, today: date, full: bool = False) -> dict:
    prev_days = (prev or {}).get("days")
    start, end = _fetch_start(prev_days, full), today.isoformat()
    agsi = sources.fetch_agsi(start, end)
    alsi = sources.fetch_alsi(start, end)

    # Merge onto history; new values override old ones for the same gas day.
    rows: dict[str, dict[str, Any]] = {}
    if prev and not full:
        for i, d in enumerate(prev["days"]):
            rows[d] = {
                "storage_twh": prev["storage_twh"][i],
                "full_pct": prev["full_pct"][i],
                "net_withdrawal_twh": prev["net_withdrawal_twh"][i],
                "lng_sendout_twh": prev["lng_sendout_twh"][i],
            }
    for d, r in agsi.items():
        rows.setdefault(d, {}).update({k: r[k] for k in ("storage_twh", "full_pct", "net_withdrawal_twh")})
    for d, v in alsi.items():
        if d in rows:
            rows[d]["lng_sendout_twh"] = v

    days = sorted(d for d, r in rows.items() if "storage_twh" in r)
    latest = agsi[max(agsi)]
    out = {
        "updated": now_iso(),
        "asOf": days[-1],
        "workingGasVolumeTwh": latest["wgv_twh"],
        "annualConsumptionTwh": latest.get("consumption_twh") or (prev or {}).get("annualConsumptionTwh"),
        "units": {"storage": "TWh", "full": "% of working gas volume", "flows": "TWh/d (gas day)"},
        "attribution": [ATTRIBUTION["agsi"], ATTRIBUTION["alsi"]],
        "days": days,
        "storage_twh": [rows[d]["storage_twh"] for d in days],
        "full_pct": [rows[d]["full_pct"] for d in days],
        "net_withdrawal_twh": [rows[d]["net_withdrawal_twh"] for d in days],
        "lng_sendout_twh": [rows[d].get("lng_sendout_twh") for d in days],
    }
    validate_storage(out, prev, today)
    return out


def validate_storage(s: dict, prev: dict | None, today: date) -> None:
    days = s["days"]
    if len(days) < 30:
        raise ValidationError("storage: fewer than 30 days")
    n = len(days)
    for k in ("storage_twh", "full_pct", "net_withdrawal_twh", "lng_sendout_twh"):
        if len(s[k]) != n:
            raise ValidationError(f"storage: {k} length mismatch")
    age = (today - date.fromisoformat(days[-1])).days
    if age > 10:
        raise ValidationError(f"storage: latest gas day is {age} days old")
    # No gaps longer than 3 days in the last 400 days (the model and chart rely on daily data).
    cutoff = today - timedelta(days=400)
    recent = [x for x in (date.fromisoformat(d) for d in days) if x >= cutoff]
    gaps = [(b - a).days for a, b in zip(recent, recent[1:])]
    if gaps and max(gaps) > 3:
        raise ValidationError(f"storage: gap of {max(gaps)} days in recent data")
    # The model and the 5-winter range need the full history; a truncated fetch must not publish.
    if date.fromisoformat(days[0]) > date.fromisoformat(HISTORY_START) + timedelta(days=7):
        raise ValidationError(f"storage: history starts {days[0]}, expected about {HISTORY_START}")
    if prev and prev.get("days"):
        if days[0] > prev["days"][0]:
            raise ValidationError("storage: history start would move later")
        if days[-1] < prev["days"][-1]:
            raise ValidationError("storage: latest day would go backwards")
        if n < len(prev["days"]):
            raise ValidationError("storage: history would shrink")
    sendout = [v for v in s["lng_sendout_twh"][-30:] if v is not None]
    if len(sendout) < 20:
        raise ValidationError("storage: LNG send-out missing for most of the last 30 days")


def build_weather(prev: dict | None, today: date, cities: list[dict], full: bool = False) -> dict:
    prev_obs = (prev or {}).get("observed") or {}
    prev_days = prev_obs.get("days")
    start = _fetch_start(prev_days, full)
    # The archive lags by a few days; ask for up to yesterday and take what is there.
    archive = sources.fetch_temperature_archive(cities, start, (today - timedelta(days=1)).isoformat())
    recent = sources.fetch_temperature_forecast(cities, past_days=7)

    observed: dict[str, float] = {}
    if prev_days and not full:
        observed.update(zip(prev_days, prev_obs["temp_c"]))
    observed.update(archive)
    archive_end = max(archive)
    # Fill days after the archive end up to yesterday with the forecast model's recent analysis.
    for d, v in recent.items():
        if archive_end < d < today.isoformat():
            observed[d] = v
    forecast = {d: v for d, v in recent.items() if d >= today.isoformat()}

    obs_days = sorted(observed)
    fc_days = sorted(forecast)
    out = {
        "updated": now_iso(),
        "attribution": [ATTRIBUTION["openmeteo"]],
        "basket": "data/city_weights.json",
        "archiveEnd": archive_end,
        "observed": {"days": obs_days, "temp_c": [observed[d] for d in obs_days]},
        "forecast": {"days": fc_days, "temp_c": [forecast[d] for d in fc_days]},
    }
    validate_weather(out, prev, today)
    return out


def validate_weather(w: dict, prev: dict | None, today: date) -> None:
    obs, fc = w["observed"], w["forecast"]
    if len(obs["days"]) < 30 or len(fc["days"]) < 10:
        raise ValidationError("weather: too few days")
    if any(not (-40 < t < 45) for t in obs["temp_c"] + fc["temp_c"]):
        raise ValidationError("weather: temperature out of range")
    if (today - date.fromisoformat(obs["days"][-1])).days > 10:
        raise ValidationError("weather: observed series is stale")
    if date.fromisoformat(obs["days"][0]) > date.fromisoformat(HISTORY_START) + timedelta(days=7):
        raise ValidationError(f"weather: history starts {obs['days'][0]}, expected about {HISTORY_START}")
    if prev and prev.get("observed") and len(obs["days"]) < len(prev["observed"]["days"]):
        raise ValidationError("weather: history would shrink")


# ------------------------------------------------------------------ runner

def run_step(name: str, path: Path, builder: Callable[[dict | None], dict], status: dict) -> bool:
    prev = read_json(path)
    entry = status.setdefault(name, {})
    entry["lastAttempt"] = now_iso()
    try:
        data = builder(prev)
        write_json_atomic(path, data)
        entry.update(lastSuccess=entry["lastAttempt"], ok=True, error=None)
        print(f"[ok]   {name}: written to {path.name}")
        return True
    except (FetchError, ValidationError, KeyError, ValueError, TypeError) as e:
        entry.update(ok=False, error=f"{type(e).__name__}: {e}")
        kept = f"kept previous file ({prev.get('updated', 'unknown date')})" if prev else "no previous file"
        print(f"[FAIL] {name}: {e}; {kept}", file=sys.stderr)
        return False


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--full", action="store_true", help="re-fetch the whole history instead of the recent window")
    ap.add_argument("--only", choices=["market", "storage", "weather"], action="append")
    args = ap.parse_args(argv)

    today = datetime.now(timezone.utc).date()
    cities = json.loads((DATA_DIR / "city_weights.json").read_text(encoding="utf-8"))["cities"]
    status_path = SITE_DATA_DIR / "status.json"
    status = read_json(status_path) or {}
    steps = {
        "market": (SITE_DATA_DIR / "market.json", lambda p: build_market(p, today)),
        "storage": (SITE_DATA_DIR / "storage.json", lambda p: build_storage(p, today, args.full)),
        "weather": (SITE_DATA_DIR / "weather.json", lambda p: build_weather(p, today, cities, args.full)),
    }
    results = {n: run_step(n, path, fn, status) for n, (path, fn) in steps.items() if not args.only or n in args.only}
    status["updated"] = now_iso()
    write_json_atomic(status_path, status)
    # Exit 0 even on partial failure: the site still builds with last good data.
    # Exit 2 only if nothing at all could be produced and no previous files exist.
    if not any(results.values()) and not all(p.exists() for p, _ in steps.values()):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
