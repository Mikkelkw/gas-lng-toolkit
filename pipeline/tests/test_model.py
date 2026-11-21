"""Model tests: fit recovers known coefficients, projection rules, back-test shape."""
import json
from datetime import date, timedelta

import numpy as np
import pytest

from pipeline import model
from pipeline.config import DATA_DIR


def synthetic(winters=(2018, 2019, 2020, 2021, 2022, 2023, 2024), a=-2.5, b=0.7, c=-0.3, noise=0.0, seed=1):
    """Daily series from 1 Oct 2018 to 31 Mar 2025 generated from known coefficients."""
    rng = np.random.default_rng(seed)
    start, end = date(winters[0], 10, 1), date(winters[-1] + 1, 3, 31)
    days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
    temp = {d: float(8 + 8 * np.cos(2 * np.pi * i / 365) + rng.normal(0, 3)) for i, d in enumerate(days)}
    lng = {d: float(3 + rng.normal(0, 0.5)) for d in days}
    net, stor, s = {}, {}, 50000.0  # high start: synthetic winters withdraw more than summers inject
    for y in winters:
        ws = [x.isoformat() for x in model.winter_days(y)]
        lm = float(np.mean([lng[d] for d in ws]))
        for d in ws:
            net[d] = a + b * model.hdd(temp[d]) + c * (lng[d] - lm) + rng.normal(0, noise)
    for d in days:
        s -= net.get(d, -1.0)
        stor[d] = s
    storage = {"days": days, "storage_twh": [stor[d] for d in days],
               "net_withdrawal_twh": [net.get(d, -1.0) for d in days],
               # Large capacity so the synthetic path never hits the clamp.
               "lng_sendout_twh": [lng[d] for d in days], "workingGasVolumeTwh": 100000.0,
               "annualConsumptionTwh": 3500.0, "asOf": days[-1]}
    weather = {"observed": {"days": days, "temp_c": [temp[d] for d in days]}}
    return model.Data.load(storage, weather), storage, weather


def test_hdd():
    assert model.hdd(20) == 0
    assert model.hdd(5.5) == 10


def test_winter_helpers():
    assert model.winter_of(date(2025, 11, 1)) == 2025
    assert model.winter_of(date(2026, 2, 1)) == 2025
    assert model.winter_of(date(2026, 6, 1)) is None
    assert len(model.winter_days(2023)) == 183  # includes 29 Feb 2024
    assert model.winter_label(2025) == "2025/26"


def test_fit_recovers_known_coefficients():
    data, *_ = synthetic(noise=0.0)
    f = model.fit(data, data.complete_winters()[-5:])
    assert f.a == pytest.approx(-2.5, abs=1e-9)
    assert f.b == pytest.approx(0.7, abs=1e-9)
    assert f.c == pytest.approx(-0.3, abs=1e-9)
    assert f.r2 == pytest.approx(1.0)


def test_fit_with_noise_reports_standard_errors():
    data, *_ = synthetic(noise=0.5)
    f = model.fit(data, data.complete_winters()[-5:])
    assert f.b == pytest.approx(0.7, abs=0.03)
    assert all(se > 0 for se in f.se)
    assert 0 < f.r2 < 1 and f.n == 182 * 4 + 183


def test_normal_hdd_shifts_each_year_before_averaging():
    normals = {"01-15": [10.0, 20.0]}
    # Without shift: HDD 5.5 and 0, mean 2.75. With -5 C: 10.5 and 0.5, mean 5.5.
    assert model.normal_hdd(normals, "01-15", 0) == pytest.approx(2.75)
    assert model.normal_hdd(normals, "01-15", -5) == pytest.approx(5.5)


def _project(**kw):
    base = dict(start_day="2026-01-01", start_storage=500.0, wgv=1000.0, end_day="2026-01-10",
                coef={"a": 1.0, "b": 0.0, "c": 0.0}, normals={}, forecast={}, recent_lng=4.0,
                daily_demand=10.0, scenario={})
    base.update(kw)
    return model.project(**base)


def test_project_constant_withdrawal():
    path = _project(normals={f"01-{i:02d}": [10.0] for i in range(1, 32)})
    assert [p["day"] for p in path][0] == "2026-01-02" and path[-1]["day"] == "2026-01-10"
    assert path[-1]["storage"] == pytest.approx(500 - 9)
    assert path[-1]["full"] == pytest.approx(49.1)


def test_project_forecast_ignores_temperature_shift():
    normals = {f"01-{i:02d}": [10.0] for i in range(1, 32)}
    coef = {"a": 0.0, "b": 1.0, "c": 0.0}
    path = _project(coef=coef, normals=normals, forecast={"2026-01-02": 5.5}, scenario={"tempDelta": -3})
    assert path[0]["hdd"] == pytest.approx(10.0)  # forecast day: 15.5 - 5.5, no shift
    assert path[1]["hdd"] == pytest.approx(8.5)  # normal day: 15.5 - (10 - 3)


def test_project_lng_disruption_and_demand_response():
    normals = {f"01-{i:02d}": [20.0] for i in range(1, 32)}
    coef = {"a": 0.0, "b": 0.0, "c": -0.5}
    sc = {"lngPct": -25, "disruptionTwh": 0.4, "disruptionStart": "2026-01-03", "disruptionDays": 2,
          "demandResponsePct": 10}
    path = _project(coef=coef, normals=normals, scenario=sc)
    w = {p["day"]: p["withdrawal"] for p in path}
    # LNG: -0.5 x (4 x -25%) = +0.5. Demand response: -10% x 10 = -1.0.
    assert w["2026-01-02"] == pytest.approx(-0.5)
    assert w["2026-01-03"] == pytest.approx(-0.1)  # disruption active
    assert w["2026-01-04"] == pytest.approx(-0.1)
    assert w["2026-01-05"] == pytest.approx(-0.5)  # disruption over after 2 days


def test_project_clamps_between_zero_and_capacity():
    normals = {f"01-{i:02d}": [10.0] for i in range(1, 32)}
    empty = _project(normals=normals, start_storage=3.0)
    assert empty[-1]["storage"] == 0
    full = _project(normals=normals, coef={"a": -50.0, "b": 0.0, "c": 0.0}, start_storage=990.0)
    assert full[-1]["storage"] == 1000.0


def test_backtest_shape_and_perfect_model():
    data, *_ = synthetic(noise=0.0)
    bt = model.backtest(data, 2024)
    assert bt["winter"] == "2024/25" and len(bt["fitWinters"]) == 5
    # With a noise-free model and actual weather, the back-test error is zero.
    for c in bt["cases"]:
        assert c["actualWeather"]["errorTwh"] == pytest.approx(0, abs=0.05)


def test_build_model_has_presets_and_parity():
    data, storage, weather = synthetic(noise=0.3)
    m = model.build_model(storage, weather)
    assert [p["label"] for p in m["presets"]] == ["Normal", "Cold winter", "Cold + LNG shortfall", "Mild"]
    assert m["fit"]["n"] > 800 and len(m["fit"]["winters"]) == 5
    assert m["parity"]["expected"]["days"] == 89


def test_committed_model_json_is_consistent():
    """The committed data/model.json must reproduce its own parity case."""
    m = json.loads((DATA_DIR / "model.json").read_text(encoding="utf-8"))
    p = m["parity"]["inputs"]
    coef = {k: v["value"] for k, v in m["coefficients"].items()}
    path = model.project(start_day=p["startDay"], start_storage=p["startStorage"], wgv=p["wgv"], end_day=p["endDay"],
                         coef=coef, normals=m["normals"]["temps"], forecast=p["forecast"], recent_lng=p["recentLng"],
                         daily_demand=p["dailyDemand"], scenario=p["scenario"])
    assert path[-1]["storage"] == pytest.approx(m["parity"]["expected"]["endStorage"], abs=1e-9)
    assert m["fit"]["r2"] > 0.5 and len(m["fit"]["winters"]) >= 5
