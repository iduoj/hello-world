"""Edition -> HTML (Jinja) -> PDF (headless Chromium)."""

from __future__ import annotations

import base64
import logging
import os
import shutil
import subprocess
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

from .editor import ap_time
from .models import Edition
from .sources.news import truncate
from .sources.weather import describe, icon

log = logging.getLogger(__name__)

HERE = Path(__file__).parent
TEMPLATES = HERE / "templates"
FONTS = HERE / "fonts"

PAGE_SIZES = {
    "Letter": {"width": "8.5in", "height": "11in"},
    "A4": {"width": "210mm", "height": "297mm"},
}

FONT_FACES = [
    ("UnifrakturMaguntia", "UnifrakturMaguntia-Regular.ttf", 400, "normal"),
    ("Playfair Display", "PlayfairDisplay-Regular.ttf", 400, "normal"),
    ("Playfair Display", "PlayfairDisplay-Bold.ttf", 700, "normal"),
    ("Playfair Display", "PlayfairDisplay-Black.ttf", 900, "normal"),
    ("Playfair Display", "PlayfairDisplay-Italic.ttf", 400, "italic"),
    ("Old Standard TT", "OldStandardTT-Regular.ttf", 400, "normal"),
    ("Old Standard TT", "OldStandardTT-Bold.ttf", 700, "normal"),
    ("Old Standard TT", "OldStandardTT-Italic.ttf", 400, "italic"),
]

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
]


class RenderError(Exception):
    pass


# ---------------------------------------------------------------- HTML


@lru_cache(maxsize=1)
def font_css() -> str:
    """@font-face rules with the fonts inlined, so the HTML is fully self-contained."""
    rules = []
    for family, filename, weight, style in FONT_FACES:
        data = base64.b64encode((FONTS / filename).read_bytes()).decode("ascii")
        rules.append(
            f'@font-face {{ font-family: "{family}"; font-weight: {weight}; font-style: {style}; '
            f'src: url(data:font/ttf;base64,{data}) format("truetype"); }}'
        )
    return "\n".join(rules)


def _roman(n: int) -> str:
    out = []
    for value, letters in [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
                           (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]:
        while n >= value:
            out.append(letters)
            n -= value
    return "".join(out) or "I"


def _hour_label(dt: datetime) -> str:
    if dt.hour == 12:
        return "Noon"
    return f"{dt.hour % 12 or 12}{'a' if dt.hour < 12 else 'p'}"


def _clock(dt: datetime) -> str:
    return f"{dt.hour % 12 or 12}:{dt.minute:02d}"


def _long_date(d: date) -> str:
    return d.strftime("%A, %B ") + f"{d.day}, {d.year}"


def _deg(value: float | None) -> Markup:
    if value is None:
        return Markup("—")
    return Markup(f'{round(value)}<span class="deg">°</span>')


def nameplate_size(name: str) -> float:
    """Blackletter nameplates get wide fast; shrink long titles so the ears still fit."""
    return round(min(6.2, 6.0 * 16 / max(len(name), 1)), 2)


def environment() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html", "j2"]),
        trim_blocks=False,
        lstrip_blocks=False,
    )
    env.filters.update(
        ap_time=ap_time,
        clock=_clock,
        hour_label=_hour_label,
        long_date=_long_date,
        roman=_roman,
        deg=_deg,
        clip=truncate,
        wx_describe=describe,
        wx_icon_name=icon,
    )
    return env


def render_html(ed: Edition, cfg: dict) -> str:
    template = environment().get_template("paper.html.j2")
    return template.render(
        ed=ed,
        css=(TEMPLATES / "paper.css").read_text(encoding="utf-8"),
        font_css=font_css(),
        page=PAGE_SIZES[cfg["paper"]["paper_size"]],
        price=cfg["paper"]["price"],
        show_images=cfg["news"]["images"],
        local_title=cfg["news"]["local_title"],
        nameplate_size=nameplate_size(ed.name),
    )


# ---------------------------------------------------------------- PDF


def _find_chrome(explicit: str = "") -> str | None:
    for candidate in [explicit, os.environ.get("CHROME_PATH", ""), *CHROME_CANDIDATES]:
        if not candidate:
            continue
        if os.path.isabs(candidate) and os.access(candidate, os.X_OK):
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    return None


def _pdf_with_playwright(html_path: Path, pdf_path: Path, executable: str | None) -> None:
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=executable) if executable else p.chromium.launch()
        try:
            page = browser.new_page()
            try:
                page.goto(html_path.as_uri(), wait_until="load", timeout=45_000)
            except PlaywrightError as exc:  # a slow news photo shouldn't stop the presses
                log.warning("Page load incomplete, printing anyway: %s", exc)
            page.evaluate("document.fonts.ready.then(() => window.__fitSheet && window.__fitSheet())")
            page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True)
        finally:
            browser.close()


def _pdf_with_chrome_cli(html_path: Path, pdf_path: Path, chrome: str) -> None:
    cmd = [
        chrome,
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        "--virtual-time-budget=15000",  # let fonts, photos and the fit-to-page script finish
        f"--print-to-pdf={pdf_path}",
        html_path.as_uri(),
    ]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.insert(1, "--no-sandbox")  # Chrome refuses to start as root otherwise (e.g. cron on a Pi)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired as exc:
        raise RenderError("Chrome took too long to print the PDF") from exc
    if result.returncode != 0 or not pdf_path.exists():
        raise RenderError(f"Chrome couldn't print the PDF:\n{result.stderr[-2000:]}")


def render_pdf(html_path: Path, pdf_path: Path, chromium_path: str = "") -> str:
    """Print *html_path* to *pdf_path*. Returns the name of the engine used."""
    explicit = chromium_path or os.environ.get("CHROMIUM_PATH", "")
    try:
        _pdf_with_playwright(html_path, pdf_path, explicit or None)
        return "playwright"
    except ModuleNotFoundError:
        log.info("Playwright not installed; looking for Chrome")
    except Exception as exc:  # e.g. browser not downloaded yet
        log.info("Playwright failed (%s); looking for Chrome", exc)

    chrome = _find_chrome(explicit)
    if chrome is None:
        raise RenderError(
            "No PDF engine found. Either `pip install playwright && playwright install chromium`, "
            "or install Google Chrome (or set CHROME_PATH)."
        )
    _pdf_with_chrome_cli(html_path, pdf_path, chrome)
    return "chrome"
