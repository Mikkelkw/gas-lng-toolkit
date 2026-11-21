"""Build tests: merging, validation and keep-last-good behaviour (hard rule 6)."""
import json
from datetime import date, timedelta

import pytest

from pipeline import build, sources
from pipeline.http_util import FetchError

TODAY = date(2026, 11, 21)


def _days(n, end=TODAY - timedelta(days=2)):
    return [(end - timedelta(days=n - 1 - i)).isoformat() for i in range(n)]


def _full(end=TODAY - timedelta(days=2)):
    """Every day from the history start to `end`."""
    start = date.fromisoformat(build.HISTORY_START)
    return _days((end - start).days + 1, end)


def _agsi(days, base=800.0):
    return {d: {"storage_twh": base - i, "full_pct": 70.0, "net_withdrawal_twh": 1.0, "wgv_twh": 1132.0}
            for i, d in enumerate(days)}


def _alsi(days):
    return {d: 3.5 for d in days}


@pytest.fixture
def fake_sources(monkeypatch):
    state = {"agsi_days": _full(), "fail": set()}

    def agsi(start, end):
        if "agsi" in state["fail"]:
            raise FetchError("AGSI down")
        return _agsi([d for d in state["agsi_days"] if start <= d <= end])

    def alsi(start, end):
        return _alsi([d for d in state["agsi_days"] if start <= d <= end])

    monkeypatch.setattr(sources, "fetch_agsi", agsi)
    monkeypatch.setattr(sources, "fetch_alsi", alsi)
    return state


def test_build_storage_from_scratch(fake_sources):
    s = build.build_storage(None, TODAY)
    n = len(fake_sources["agsi_days"])
    assert s["asOf"] == fake_sources["agsi_days"][-1]
    assert s["days"][0] == build.HISTORY_START and len(s["days"]) == n
    assert s["attribution"] == ["Source: GIE AGSI+", "Source: GIE ALSI"]
    assert len(s["lng_sendout_twh"]) == n


def test_build_storage_merges_onto_history(fake_sources):
    prev = build.build_storage(None, TODAY)
    prev["storage_twh"][0] = 500.0  # marker on the oldest day
    # The source now only serves recent days; older history must come from the stored file.
    fake_sources["agsi_days"] = _days(61, end=TODAY - timedelta(days=1))
    s = build.build_storage(prev, TODAY)
    assert s["days"][0] == build.HISTORY_START and s["storage_twh"][0] == 500.0
    assert s["asOf"] == (TODAY - timedelta(days=1)).isoformat()


def test_validate_storage_rejects_stale_and_shrinking(fake_sources):
    s = build.build_storage(None, TODAY)
    stale = {k: (v[:-20] if isinstance(v, list) and len(v) == len(s["days"]) else v) for k, v in s.items()}
    with pytest.raises(build.ValidationError, match="old"):
        build.validate_storage(stale, None, TODAY)
    bigger_prev = {"days": [s["days"][0]] + _days(len(s["days"]) + 5)}
    with pytest.raises(build.ValidationError, match="shrink"):
        build.validate_storage(s, bigger_prev, TODAY)


def test_validate_storage_rejects_gaps(fake_sources):
    s = build.build_storage(None, TODAY)
    for k in ("days", "storage_twh", "full_pct", "net_withdrawal_twh", "lng_sendout_twh"):
        del s[k][-40:-34]
    with pytest.raises(build.ValidationError, match="gap"):
        build.validate_storage(s, None, TODAY)


def test_validate_storage_rejects_truncated_history(fake_sources):
    s = build.build_storage(None, TODAY)
    cut = {k: (v[900:] if isinstance(v, list) else v) for k, v in s.items()}
    with pytest.raises(build.ValidationError, match="history starts"):
        build.validate_storage(cut, None, TODAY)


def test_run_step_keeps_last_good_file_on_failure(tmp_path, fake_sources):
    path = tmp_path / "storage.json"
    good = build.build_storage(None, TODAY)
    build.write_json_atomic(path, good)
    before = path.read_text(encoding="utf-8")

    fake_sources["fail"].add("agsi")
    status = {}
    ok = build.run_step("storage", path, lambda p: build.build_storage(p, TODAY), status)
    assert ok is False
    assert path.read_text(encoding="utf-8") == before  # untouched
    assert status["storage"]["ok"] is False and "AGSI down" in status["storage"]["error"]
    assert "lastSuccess" not in status["storage"]


def test_run_step_rejects_invalid_data_and_keeps_file(tmp_path, fake_sources):
    path = tmp_path / "storage.json"
    build.write_json_atomic(path, build.build_storage(None, TODAY))
    before = path.read_text(encoding="utf-8")
    fake_sources["agsi_days"] = _days(10)  # too short to be valid
    status = {}
    assert build.run_step("storage", path, lambda p: build.build_storage(p, TODAY, full=True), status) is False
    assert path.read_text(encoding="utf-8") == before


def test_write_json_atomic_leaves_no_temp_files(tmp_path):
    p = tmp_path / "x.json"
    build.write_json_atomic(p, {"a": 1})
    assert json.loads(p.read_text(encoding="utf-8")) == {"a": 1}
    assert [f.name for f in tmp_path.iterdir()] == ["x.json"]


def test_validate_market():
    m = {"henryHub": {"value": 3.1, "asOf": "2026-11-17"}, "eurusd": {"value": 1.099, "asOf": "2026-11-20"}}
    build.validate_market(m, None, TODAY)
    with pytest.raises(build.ValidationError):
        build.validate_market({**m, "henryHub": {"value": 0, "asOf": "2026-11-17"}}, None, TODAY)
    with pytest.raises(build.ValidationError, match="backwards"):
        build.validate_market(m, {"eurusd": {"asOf": "2026-11-21"}}, TODAY)


def test_build_weather_uses_archive_then_recent_then_forecast(monkeypatch):
    obs_days = _full(end=TODAY - timedelta(days=6))
    monkeypatch.setattr(sources, "fetch_temperature_archive", lambda c, s, e: {d: 5.0 for d in obs_days})
    recent_days = [(TODAY + timedelta(days=i)).isoformat() for i in range(-7, 16)]
    monkeypatch.setattr(sources, "fetch_temperature_forecast", lambda c, past_days=7: {d: 1.0 for d in recent_days})
    w = build.build_weather(None, TODAY, [{"lat": 0, "lon": 0, "weight": 1}])
    obs = dict(zip(w["observed"]["days"], w["observed"]["temp_c"]))
    assert obs[obs_days[-1]] == 5.0  # archive wins where it exists
    assert obs[(TODAY - timedelta(days=1)).isoformat()] == 1.0  # gap filled from recent analysis
    assert TODAY.isoformat() not in obs
    assert w["forecast"]["days"][0] == TODAY.isoformat() and len(w["forecast"]["days"]) == 16
    assert w["attribution"] == ["Weather data: Open-Meteo (CC BY 4.0)"]
