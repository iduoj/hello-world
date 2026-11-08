"""Load config.toml and fill in defaults."""

from __future__ import annotations

import copy
import os
from datetime import date
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib  # type: ignore[no-redef]

DEFAULTS: dict[str, Any] = {
    "paper": {
        "name": "The Morning Times",
        "tagline": "All the News That's Fit to Wake Up To",
        "city": "",
        "timezone": "",  # IANA name, e.g. "America/New_York"; blank = this computer's zone
        "paper_size": "Letter",  # or "A4"
        "founded": "",  # YYYY-MM-DD, drives the "Vol. / No." line; blank = Jan 1 this year
        "price": "One Cup of Coffee",
    },
    "weather": {
        "enabled": True,
        "latitude": None,
        "longitude": None,
        "units": "imperial",  # or "metric"
    },
    "calendar": {
        "enabled": True,
        "ics_urls": [],
        "hide": [],
        "max_events": 9,
    },
    "todoist": {
        "enabled": False,
        "token": "",
        "filter": "today | overdue",
        "max_tasks": 8,
    },
    "news": {
        "enabled": True,
        "max_stories": 6,
        "images": True,
        "feeds": [
            {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml"},
            {"name": "BBC News", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
        ],
    },
    "editor": {
        "enabled": False,
        "model": "claude-opus-5-5",
        "api_key": "",
    },
    "printer": {
        "name": "",
        "copies": 1,
        "options": [],
    },
    "render": {
        "chromium_path": "",
    },
}


class ConfigError(Exception):
    pass


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config(path: Path | None) -> dict[str, Any]:
    """Read *path* (if given) on top of the defaults; environment variables fill secrets."""
    user: dict[str, Any] = {}
    if path is not None:
        if not path.exists():
            raise ConfigError(
                f"Config file {path} not found. Copy config.example.toml to config.toml "
                "and edit it, or run with --demo to see a sample edition."
            )
        with path.open("rb") as fh:
            try:
                user = tomllib.load(fh)
            except tomllib.TOMLDecodeError as exc:
                raise ConfigError(f"{path}: {exc}") from exc

    cfg = _merge(DEFAULTS, user)

    # Secrets may live in the environment instead of the file.
    if not cfg["todoist"]["token"]:
        cfg["todoist"]["token"] = os.environ.get("TODOIST_API_TOKEN", "")
    if not cfg["editor"]["api_key"]:
        cfg["editor"]["api_key"] = os.environ.get("ANTHROPIC_API_KEY", "")

    size = str(cfg["paper"]["paper_size"]).strip().lower()
    if size not in ("letter", "a4"):
        raise ConfigError('paper.paper_size must be "Letter" or "A4"')
    cfg["paper"]["paper_size"] = "A4" if size == "a4" else "Letter"

    if cfg["weather"]["units"] not in ("imperial", "metric"):
        raise ConfigError('weather.units must be "imperial" or "metric"')

    founded = cfg["paper"]["founded"]
    if isinstance(founded, str) and founded:
        try:
            cfg["paper"]["founded"] = date.fromisoformat(founded)
        except ValueError as exc:
            raise ConfigError("paper.founded must look like 2026-01-01") from exc
    elif not founded:
        cfg["paper"]["founded"] = None

    return cfg
