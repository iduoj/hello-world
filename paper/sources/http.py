"""Tiny stdlib HTTP helpers (no requests dependency)."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

from .. import __version__

USER_AGENT = f"morning-paper/{__version__} (personal newspaper printer)"
TIMEOUT = 20


def fetch(url: str, *, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> bytes:
    if url.startswith("webcal://"):  # iCloud and others hand out webcal:// links
        url = "https://" + url[len("webcal://"):]
    if not url.startswith(("https://", "http://")):
        raise ValueError(f"Only http(s) URLs are supported: {url!r}")
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def fetch_json(url: str, **kwargs: Any) -> Any:
    return json.loads(fetch(url, **kwargs))
