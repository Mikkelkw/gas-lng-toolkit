"""Parser tests. Fixtures mirror the live response shapes seen on 2026-11-21."""
import pytest

from pipeline import sources
from pipeline.http_util import FetchError

# ---------------------------------------------------------------- EIA

EIA = {"response": {"data": [
    {"period": "2026-11-17", "series": "RNGWHHD", "value": "3.1", "units": "$/MMBTU"},
    {"period": "2026-11-16", "series": "RNGWHHD", "value": "3.2", "units": "$/MMBTU"},
    {"period": "2026-11-13", "series": "RNGWHHD", "value": None},
    {"period": "2026-11-12", "series": "OTHER", "value": "9"},
]}}


def test_parse_eia_sorts_and_skips_bad_rows():
    assert sources.parse_eia(EIA) == [("2026-11-16", 3.2), ("2026-11-17", 3.1)]


def test_parse_eia_rejects_bad_shape():
    with pytest.raises(FetchError):
        sources.parse_eia({"error": "bad key"})
    with pytest.raises(FetchError):
        sources.parse_eia({"response": {"data": []}})


# ---------------------------------------------------------------- ECB

ECB = """<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject>
<Cube><Cube time="2026-11-20"><Cube currency="USD" rate="1.099"/><Cube currency="JPY" rate="174.35"/></Cube>
<Cube time="2026-11-19"><Cube currency="USD" rate="1.0992"/></Cube></Cube></gesmes:Envelope>"""


def test_parse_ecb():
    assert sources.parse_ecb(ECB) == [("2026-11-19", 1.0992), ("2026-11-20", 1.099)]


def test_parse_ecb_errors():
    with pytest.raises(FetchError):
        sources.parse_ecb("<not xml")
    with pytest.raises(FetchError):
        sources.parse_ecb(ECB.replace("USD", "XXX"))


# ---------------------------------------------------------------- GIE

AGSI_ROW = {"name": "EU", "code": "eu", "gasDayStart": "2026-11-19", "gasInStorage": "788.0393",
            "injection": "435.31", "withdrawal": "3079.1", "netWithdrawal": "2643.7",
            "workingGasVolume": "1132.3616", "status": "E", "full": "69.59",
            "consumption": "3519"}


def test_parse_agsi_converts_gwh_to_twh():
    out = sources.parse_agsi_rows([AGSI_ROW])
    assert out == {"2026-11-19": {"storage_twh": 788.0393, "full_pct": 69.59,
                                  "net_withdrawal_twh": 2.6437, "wgv_twh": 1132.3616,
                                  "consumption_twh": 3519.0}}


def test_parse_agsi_derives_net_withdrawal_and_skips_bad_rows():
    no_net = {**AGSI_ROW, "netWithdrawal": None, "gasDayStart": "2026-11-18"}
    rows = [no_net, {**AGSI_ROW, "status": "N", "gasDayStart": "2026-11-17"},
            {**AGSI_ROW, "gasInStorage": "-", "gasDayStart": "2026-11-16"},
            {**AGSI_ROW, "full": "180", "gasDayStart": "2026-11-15"}]
    out = sources.parse_agsi_rows(rows)
    assert list(out) == ["2026-11-18"]
    assert out["2026-11-18"]["net_withdrawal_twh"] == pytest.approx((3079.1 - 435.31) / 1000, abs=1e-4)


def test_parse_alsi():
    rows = [{"gasDayStart": "2026-11-19", "sendOut": "3850.7", "status": "E"},
            {"gasDayStart": "2026-11-18", "sendOut": None, "status": "E"},
            {"gasDayStart": "2026-11-17", "sendOut": "100", "status": "N"}]
    assert sources.parse_alsi_rows(rows) == {"2026-11-19": 3.8507}


def test_gie_pagination(monkeypatch):
    monkeypatch.setenv("GIE_API_KEY", "k")
    monkeypatch.setattr(sources, "GIE_PAUSE_S", 0)
    calls = []

    class R:
        def __init__(self, j):
            self._j = j

        def json(self):
            return self._j

    def fake_get(url, params=None, headers=None, **kw):
        calls.append((params["page"], headers["x-key"]))
        day = f"2026-11-{10 + params['page']:02d}"
        return R({"last_page": 3, "data": [{**AGSI_ROW, "gasDayStart": day}]})

    monkeypatch.setattr(sources, "get", fake_get)
    out = sources.fetch_agsi("2026-11-01", "2026-11-20")
    assert [c[0] for c in calls] == [1, 2, 3]
    assert all(c[1] == "k" for c in calls)
    assert sorted(out) == ["2026-11-11", "2026-11-12", "2026-11-13"]


def test_gie_retries_once_when_empty(monkeypatch):
    monkeypatch.setenv("GIE_API_KEY", "k")
    monkeypatch.setattr(sources, "GIE_RETRY_WAIT_S", 0)
    responses = [[], [{"gasDayStart": "2026-11-19", "sendOut": "3850.7", "status": "E"}]]
    monkeypatch.setattr(sources, "_gie_pages", lambda url, s, e: responses.pop(0))
    assert sources.fetch_alsi("2026-11-01", "2026-11-20") == {"2026-11-19": 3.8507}


def test_gie_raises_when_still_empty(monkeypatch):
    monkeypatch.setattr(sources, "GIE_RETRY_WAIT_S", 0)
    monkeypatch.setattr(sources, "_gie_pages", lambda url, s, e: [])
    with pytest.raises(FetchError, match="ALSI"):
        sources.fetch_alsi("2026-11-01", "2026-11-20")


# ---------------------------------------------------------------- Open-Meteo

def _loc(days, temps):
    return {"daily": {"time": days, "temperature_2m_mean": temps}, "daily_units": {"temperature_2m_mean": "°C"}}


def test_weighted_daily_mean():
    payload = [_loc(["2026-11-01", "2026-11-02"], [10.0, 2.0]), _loc(["2026-11-01", "2026-11-02"], [0.0, None])]
    # Day 2 dropped because one city is missing; day 1 = 0.75*10 + 0.25*0.
    assert sources.weighted_daily_mean(payload, [0.75, 0.25]) == {"2026-11-01": 7.5}


def test_weighted_daily_mean_single_location_object():
    assert sources.weighted_daily_mean(_loc(["2026-11-01"], [4.0]), [1.0]) == {"2026-11-01": 4.0}


def test_weighted_daily_mean_location_count_mismatch():
    with pytest.raises(FetchError):
        sources.weighted_daily_mean([_loc(["2026-11-01"], [1.0])], [0.5, 0.5])


def test_date_range():
    assert sources.date_range("2026-02-27", "2026-03-01") == ["2026-02-27", "2026-02-28", "2026-03-01"]
