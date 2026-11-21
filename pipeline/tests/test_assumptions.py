"""Every default in data/assumptions.json must be documented (CLAUDE.md hard rule 2)."""
import json
from datetime import date

import pytest

from pipeline.config import DATA_DIR

ASSUMPTIONS = json.loads((DATA_DIR / "assumptions.json").read_text(encoding="utf-8"))
SOURCES_MD = (DATA_DIR / "assumptions_sources.md").read_text(encoding="utf-8")

REQUIRED_INPUTS = {
    "henryHub", "ttf", "jkm", "eurusd", "charterRate", "vesselSize", "mmbtuPerM3",
    "boilOff", "speed", "panamaFee", "suezFee", "portCosts", "liquefactionFee",
    "feedgasMultiplier",
}


def test_all_spec_inputs_present():
    assert REQUIRED_INPUTS <= set(ASSUMPTIONS["inputs"])


@pytest.mark.parametrize("key", sorted(REQUIRED_INPUTS))
def test_input_documented(key):
    item = ASSUMPTIONS["inputs"][key]
    assert isinstance(item["value"], (int, float)) and item["value"] > 0
    assert item["unit"].strip()
    assert item["source"].strip()
    date.fromisoformat(item["asOf"])


def test_routes_match_spec():
    routes = {r["id"]: r for r in ASSUMPTIONS["routes"]}
    assert set(routes) == {"nwe", "asia-panama", "asia-suez", "asia-cape"}
    assert routes["nwe"]["market"] == "ttf"
    assert {routes[k]["canal"] for k in ("asia-panama", "asia-suez", "asia-cape")} == {"panama", "suez", None}
    for r in routes.values():
        assert r["distanceNm"] > 0 and r["source"].strip()


def _renderings(v):
    """Plausible ways a value is written in prose: 1.0990, 1.099, 35,000, 115."""
    out = {f"{v:,}", f"{v:,.0f}", f"{v:,.2f}", f"{v:.4f}", repr(v)}
    return {r for r in out if float(r.replace(",", "")) == v}


def test_every_input_appears_in_sources_md():
    for item in ASSUMPTIONS["inputs"].values():
        assert any(r in SOURCES_MD for r in _renderings(item["value"])), item["label"]
