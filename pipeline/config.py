"""Shared paths and secret loading for the pipeline.

Secrets are read from the environment. Locally they come from the repo-root
`.env` file (never committed); in CI they come from GitHub Actions secrets.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SITE_DATA_DIR = ROOT / "site" / "public" / "data"

load_dotenv(ROOT / ".env", override=False)


class MissingSecretError(RuntimeError):
    """Raised when a required API key is not set."""


def get_secret(name: str) -> str:
    """Return a required secret, or raise a clear error naming it (never its value)."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise MissingSecretError(
            f"{name} is not set. Add it to .env locally or to GitHub Actions secrets."
        )
    return value
