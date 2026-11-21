"""Fit the EU storage withdrawal model, back-test it, and write data/model.json.

Model (SPEC section 4), fitted on daily data for complete winters (1 Oct to 31 Mar):

    net withdrawal (TWh/d) = a + b x HDD + c x (LNG send-out - its winter average)

HDD = max(0, 15.5 C - gas-demand-weighted EU mean temperature).

The projection here mirrors site/src/lib/storage.ts exactly; a parity case in
model.json is checked by both the pytest and the Vitest suites.

Run from the repo root:  python -m pipeline.model
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import numpy as np

from .build import read_json, write_json_atomic
from .config import DATA_DIR, SITE_DATA_DIR

HDD_BASE_C = 15.5
FIT_WINTERS = 5  # SPEC: at least 5 winters
NORMAL_WINTERS = 10
RECENT_LNG_DAYS = 30

PRESETS = [
    {"id": "normal", "label": "Normal", "tempDelta": 0, "lngPct": 0, "disruptionTwh": 0, "demandResponsePct": 0},
    {"id": "cold", "label": "Cold winter", "tempDelta": -2, "lngPct": 0, "disruptionTwh": 0, "demandResponsePct": 0},
    {"id": "cold-lng", "label": "Cold + LNG shortfall", "tempDelta": -2, "lngPct": -20, "disruptionTwh": 0, "demandResponsePct": 0},
    {"id": "mild", "label": "Mild", "tempDelta": 2, "lngPct": 0, "disruptionTwh": 0, "demandResponsePct": 0},
]


# ------------------------------------------------------------------ helpers

def hdd(temp_c: float) -> float:
    return max(0.0, HDD_BASE_C - temp_c)


def winter_of(d: date) -> int | None:
    """Winter label = year in which it starts (Oct to Mar). None for Apr to Sep."""
    if d.month >= 10:
        return d.year
    if d.month <= 3:
        return d.year - 1
    return None


def winter_days(y: int) -> list[date]:
    a, b = date(y, 10, 1), date(y + 1, 3, 31)
    return [a + timedelta(days=i) for i in range((b - a).days + 1)]


def winter_label(y: int) -> str:
    return f"{y}/{str(y + 1)[-2:]}"


@dataclass
class Data:
    storage: dict[str, float]
    net_wd: dict[str, float]
    lng: dict[str, float]
    temp: dict[str, float]
    wgv: float
    annual_consumption: float | None
    as_of: str

    @classmethod
    def load(cls, storage: dict, weather: dict) -> "Data":
        days = storage["days"]
        return cls(
            storage=dict(zip(days, storage["storage_twh"])),
            net_wd=dict(zip(days, storage["net_withdrawal_twh"])),
            lng={d: v for d, v in zip(days, storage["lng_sendout_twh"]) if v is not None},
            temp=dict(zip(weather["observed"]["days"], weather["observed"]["temp_c"])),
            wgv=storage["workingGasVolumeTwh"],
            annual_consumption=storage.get("annualConsumptionTwh"),
            as_of=storage["asOf"],
        )

    def complete_winters(self) -> list[int]:
        """Winters with storage, LNG and temperature for every day."""
        out = []
        for y in range(2000, date.fromisoformat(self.as_of).year + 1):
            ds = [d.isoformat() for d in winter_days(y)]
            if all(d in self.net_wd and d in self.lng and d in self.temp for d in ds):
                out.append(y)
        return out


# ------------------------------------------------------------------ fit

@dataclass
class Fit:
    a: float
    b: float
    c: float
    se: list[float]
    r2: float
    rmse: float
    n: int
    winters: list[int] = field(default_factory=list)


def design(data: Data, winters: list[int]) -> tuple[np.ndarray, np.ndarray]:
    X, Y = [], []
    for y in winters:
        ds = [d.isoformat() for d in winter_days(y)]
        lng_mean = float(np.mean([data.lng[d] for d in ds]))
        for d in ds:
            X.append([1.0, hdd(data.temp[d]), data.lng[d] - lng_mean])
            Y.append(data.net_wd[d])
    return np.array(X), np.array(Y)


def fit(data: Data, winters: list[int]) -> Fit:
    X, Y = design(data, winters)
    beta, *_ = np.linalg.lstsq(X, Y, rcond=None)
    resid = Y - X @ beta
    n, k = X.shape
    sigma2 = float(resid @ resid) / (n - k)
    se = np.sqrt(np.diag(sigma2 * np.linalg.inv(X.T @ X)))
    r2 = 1 - float(resid @ resid) / float(((Y - Y.mean()) ** 2).sum())
    return Fit(a=float(beta[0]), b=float(beta[1]), c=float(beta[2]), se=[float(x) for x in se],
               r2=r2, rmse=float(np.sqrt((resid**2).mean())), n=n, winters=list(winters))


# ------------------------------------------------------------------ normals

def normal_temps(data: Data, winters: list[int]) -> dict[str, list[float]]:
    """Temperatures by calendar day (MM-DD), one value per winter, for 1 Oct to 31 Mar."""
    out: dict[str, list[float]] = {}
    for y in winters:
        for d in winter_days(y):
            out.setdefault(d.strftime("%m-%d"), []).append(data.temp[d.isoformat()])
    return dict(sorted(out.items(), key=lambda kv: (kv[0] < "10", kv[0])))


def normal_hdd(normals: dict[str, list[float]], mmdd: str, delta: float) -> float:
    """Mean over years of HDD with each year's temperature shifted by delta."""
    temps = normals.get(mmdd) or normals["02-28"]
    return sum(hdd(t + delta) for t in temps) / len(temps)


# ------------------------------------------------------------------ projection (mirrors storage.ts)

def project(*, start_day: str, start_storage: float, wgv: float, end_day: str,
            coef: dict[str, float], normals: dict[str, list[float]], forecast: dict[str, float],
            recent_lng: float, daily_demand: float, scenario: dict[str, Any],
            hdd_override: dict[str, float] | None = None,
            lng_dev_override: dict[str, float] | None = None) -> list[dict[str, float]]:
    """Daily storage path from the day after start_day to end_day inclusive.

    Forecast days use the forecast temperature unchanged; later days use the normal HDD
    with the scenario temperature shift. Overrides exist only for the back-test.
    """
    d = date.fromisoformat(start_day)
    end = date.fromisoformat(end_day)
    s = start_storage
    dis_twh = scenario.get("disruptionTwh", 0) or 0
    dis_start = date.fromisoformat(scenario["disruptionStart"]) if scenario.get("disruptionStart") else d + timedelta(days=1)
    dis_days = scenario.get("disruptionDays")
    dis_end = dis_start + timedelta(days=dis_days) if dis_days else end + timedelta(days=1)
    lng_dev = recent_lng * scenario.get("lngPct", 0) / 100
    dr = scenario.get("demandResponsePct", 0) / 100 * daily_demand
    out = []
    while d < end:
        d += timedelta(days=1)
        iso = d.isoformat()
        if hdd_override is not None:
            h = hdd_override[iso]
        elif iso in forecast:
            h = hdd(forecast[iso])
        else:
            h = normal_hdd(normals, d.strftime("%m-%d"), scenario.get("tempDelta", 0))
        ld = lng_dev_override[iso] if lng_dev_override is not None else lng_dev
        w = coef["a"] + coef["b"] * h + coef["c"] * ld
        if dis_start <= d < dis_end:
            w += dis_twh
        w -= dr
        s = min(wgv, max(0.0, s - w))
        out.append({"day": iso, "storage": s, "full": 100 * s / wgv, "withdrawal": w, "hdd": h})
    return out


def recent_lng_avg(data: Data) -> float:
    days = sorted(data.lng)[-RECENT_LNG_DAYS:]
    return float(np.mean([data.lng[d] for d in days]))


# ------------------------------------------------------------------ back-test

def backtest(data: Data, test_winter: int) -> dict[str, Any]:
    winters = data.complete_winters()
    fit_w = [y for y in winters if y < test_winter][-FIT_WINTERS:]
    f = fit(data, fit_w)
    coef = {"a": f.a, "b": f.b, "c": f.c}
    norm_w = [y for y in winters if y < test_winter][-NORMAL_WINTERS:]
    normals = normal_temps(data, norm_w)
    ds = [d.isoformat() for d in winter_days(test_winter)]
    lng_mean = float(np.mean([data.lng[d] for d in ds]))
    end = ds[-1]
    actual = data.storage[end]
    cases = []
    for start in (date(test_winter, 10, 1), date(test_winter, 11, 1), date(test_winter + 1, 1, 1)):
        prev_day = (start - timedelta(days=1)).isoformat()
        common = dict(start_day=prev_day, start_storage=data.storage[prev_day], wgv=data.wgv, end_day=end,
                      coef=coef, normals=normals, forecast={}, recent_lng=0.0, daily_demand=0.0, scenario={})
        perfect = project(**common, hdd_override={d: hdd(data.temp[d]) for d in ds},
                          lng_dev_override={d: data.lng[d] - lng_mean for d in ds})[-1]["storage"]
        normal = project(**common)[-1]["storage"]
        cases.append({
            "start": start.isoformat(),
            "startStorageTwh": round(data.storage[prev_day], 1),
            "actualWeather": {"projectedTwh": round(perfect, 1), "errorTwh": round(perfect - actual, 1),
                              "errorPp": round(100 * (perfect - actual) / data.wgv, 1)},
            "normalWeather": {"projectedTwh": round(normal, 1), "errorTwh": round(normal - actual, 1),
                              "errorPp": round(100 * (normal - actual) / data.wgv, 1)},
        })
    return {
        "winter": winter_label(test_winter),
        "fitWinters": [winter_label(y) for y in fit_w],
        "coefficients": {"a": round(f.a, 4), "b": round(f.b, 4), "c": round(f.c, 4)},
        "actual31MarTwh": round(actual, 1),
        "actual31MarPct": round(100 * actual / data.wgv, 1),
        "cases": cases,
        "note": "Actual weather: observed HDD and LNG send-out deviation for each day (tests the model). "
                "Normal weather: 10-winter normal temperatures and no LNG deviation (tests a real forecast).",
    }


# ------------------------------------------------------------------ main

def build_model(storage: dict, weather: dict) -> dict[str, Any]:
    data = Data.load(storage, weather)
    winters = data.complete_winters()
    if len(winters) < FIT_WINTERS + 1:
        raise RuntimeError(f"Need at least {FIT_WINTERS + 1} complete winters, have {len(winters)}")
    fit_w = winters[-FIT_WINTERS:]
    f = fit(data, fit_w)
    norm_w = winters[-NORMAL_WINTERS:]
    normals = normal_temps(data, norm_w)
    coef = {"a": f.a, "b": f.b, "c": f.c}
    daily_demand = (data.annual_consumption or 0) / 365

    # Parity case: a fixed, synthetic scenario that site/src/lib/storage.ts must reproduce.
    parity_forecast = {"2026-01-02": -3.0, "2026-01-03": 1.5}
    parity_scenario = {"tempDelta": -1.5, "lngPct": -10, "disruptionTwh": 0.3, "disruptionStart": "2026-01-05",
                       "disruptionDays": 10, "demandResponsePct": 5}
    parity_inputs = dict(start_day="2026-01-01", start_storage=700.0, wgv=1130.0, end_day="2026-03-31",
                         coef=coef, normals=normals, forecast=parity_forecast, recent_lng=4.0,
                         daily_demand=9.5, scenario=parity_scenario)
    parity_path = project(**parity_inputs)

    return {
        "fitted": date.today().isoformat(),
        "dataAsOf": data.as_of,
        "formula": "net withdrawal (TWh/d) = a + b x HDD + c x (LNG send-out - winter average LNG send-out)",
        "hddBaseC": HDD_BASE_C,
        "coefficients": {
            "a": {"value": f.a, "se": f.se[0], "unit": "TWh/d"},
            "b": {"value": f.b, "se": f.se[1], "unit": "TWh/d per HDD"},
            "c": {"value": f.c, "se": f.se[2], "unit": "TWh/d per TWh/d of LNG send-out"},
        },
        "fit": {"r2": f.r2, "rmseTwh": f.rmse, "n": f.n, "winters": [winter_label(y) for y in fit_w]},
        "normals": {"winters": [winter_label(y) for y in norm_w], "temps": normals},
        "recentLngTwh": recent_lng_avg(data),
        "recentLngDays": RECENT_LNG_DAYS,
        "dailyDemandTwh": daily_demand,
        "annualConsumptionTwh": data.annual_consumption,
        "presets": PRESETS,
        "backtest": backtest(data, winters[-1]),
        "parity": {
            "inputs": {
                "startDay": parity_inputs["start_day"], "startStorage": parity_inputs["start_storage"],
                "wgv": parity_inputs["wgv"], "endDay": parity_inputs["end_day"],
                "forecast": parity_forecast, "recentLng": parity_inputs["recent_lng"],
                "dailyDemand": parity_inputs["daily_demand"], "scenario": parity_scenario,
            },
            "expected": {
                "days": len(parity_path),
                "endStorage": parity_path[-1]["storage"],
                "storageAt": {p["day"]: p["storage"] for p in parity_path if p["day"] in
                              ("2026-01-02", "2026-01-03", "2026-01-05", "2026-01-14", "2026-01-15", "2026-02-28")},
            },
        },
        "sources": ["Source: GIE AGSI+", "Source: GIE ALSI", "Weather data: Open-Meteo (CC BY 4.0)"],
    }


def main() -> int:
    storage = read_json(SITE_DATA_DIR / "storage.json")
    weather = read_json(SITE_DATA_DIR / "weather.json")
    if not storage or not weather:
        print("model: storage.json or weather.json missing; keeping existing model.json", file=sys.stderr)
        return 0
    try:
        model = build_model(storage, weather)
    except (RuntimeError, KeyError, ValueError, np.linalg.LinAlgError) as e:
        print(f"model: fit failed ({e}); keeping existing model.json", file=sys.stderr)
        return 0
    write_json_atomic(DATA_DIR / "model.json", model)
    bt = model["backtest"]
    print(f"[ok]   model: R2={model['fit']['r2']:.3f} n={model['fit']['n']} winters={model['fit']['winters']}")
    for c in bt["cases"]:
        print(f"       back-test {bt['winter']} from {c['start']}: actual weather {c['actualWeather']['errorTwh']:+.1f} TWh "
              f"({c['actualWeather']['errorPp']:+.1f} pp), normal weather {c['normalWeather']['errorTwh']:+.1f} TWh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
