import pytest

from pipeline import config


def test_paths_point_into_repo():
    assert (config.ROOT / "SPEC.md").exists()
    assert config.SITE_DATA_DIR == config.ROOT / "site" / "public" / "data"


def test_get_secret_returns_value(monkeypatch):
    monkeypatch.setenv("DUMMY_KEY", "  abc  ")
    assert config.get_secret("DUMMY_KEY") == "abc"


def test_get_secret_missing_raises_without_leaking(monkeypatch):
    monkeypatch.delenv("DUMMY_KEY", raising=False)
    with pytest.raises(config.MissingSecretError, match="DUMMY_KEY is not set"):
        config.get_secret("DUMMY_KEY")
