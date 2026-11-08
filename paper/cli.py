"""Command line: gather the news, set the type, run the presses."""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import date, datetime, timedelta, tzinfo
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import demo
from .config import ConfigError, load_config
from .editor import write_front_page
from .models import Edition
from .printing import PrintError, list_printers, print_pdf
from .render import RenderError, render_html, render_pdf
from .sources import calendar_ics, news, todoist, weather
from .sources.http import fetch

log = logging.getLogger("paper")


def local_tz(name: str) -> tzinfo:
    if name:
        try:
            return ZoneInfo(name)
        except ZoneInfoNotFoundError as exc:
            raise ConfigError(f"Unknown timezone {name!r} (use an IANA name like America/New_York)") from exc
    return datetime.now().astimezone().tzinfo  # type: ignore[return-value]


def issue_numbers(day: date, founded: date | None) -> tuple[int, int]:
    founded = founded or date(day.year, 1, 1)
    number = max((day - founded).days + 1, 1)
    years = day.year - founded.year - ((day.month, day.day) < (founded.month, founded.day))
    return max(years + 1, 1), number


def build_edition(cfg: dict, day: date, tz: tzinfo, use_demo: bool = False) -> Edition:
    p = cfg["paper"]
    volume, number = issue_numbers(day, p["founded"])
    ed = Edition(
        day=day,
        name=p["name"],
        tagline=p["tagline"],
        city=p["city"],
        volume=volume,
        number=number,
        printed_at=datetime.now(tz),
    )
    tomorrow = day + timedelta(days=1)

    if use_demo:
        ed.events, ed.tomorrow_events = demo.events(day, tz)
        ed.tasks = demo.tasks(day, tz)
        ed.weather = demo.weather(day)
        ed.news = demo.news()
        write_front_page(ed, {"enabled": False})
        return ed

    # Calendar -----------------------------------------------------------
    c = cfg["calendar"]
    if c["enabled"] and c["ics_urls"]:
        found = []
        for i, url in enumerate(c["ics_urls"], 1):
            try:
                found += calendar_ics.parse_ics(fetch(url), day, 2, tz, c["hide"])
            except Exception as exc:
                log.warning("Calendar #%d failed: %s", i, exc)
                ed.notes.append(f"Calendar #{i} unreachable")
        ed.events = calendar_ics.events_on(found, day, tz)[: c["max_events"]]
        ed.tomorrow_events = calendar_ics.events_on(found, tomorrow, tz)

    # Tasks --------------------------------------------------------------
    t = cfg["todoist"]
    if t["enabled"]:
        if not t["token"]:
            ed.notes.append("Todoist token missing")
        else:
            try:
                ed.tasks = todoist.fetch_tasks(t["token"], t["filter"], day, tz, t["max_tasks"])
            except Exception as exc:
                log.warning("Todoist failed: %s", exc)
                ed.notes.append("Todoist unreachable")

    # Weather ------------------------------------------------------------
    w = cfg["weather"]
    if w["enabled"]:
        try:
            lat, lon = w["latitude"], w["longitude"]
            if lat is None or lon is None:
                if not p["city"]:
                    raise ConfigError("set weather.latitude/longitude or paper.city")
                lat, lon = weather.geocode(p["city"])
            ed.weather = weather.fetch_weather(lat, lon, day, w["units"], p["timezone"])
        except Exception as exc:
            log.warning("Weather failed: %s", exc)
            ed.notes.append("Weather desk unreachable")

    # News ---------------------------------------------------------------
    n = cfg["news"]
    if n["enabled"] and n["feeds"]:
        per_feed = []
        for feed in n["feeds"]:
            name = feed.get("name", "") if isinstance(feed, dict) else ""
            url = feed["url"] if isinstance(feed, dict) else str(feed)
            try:
                per_feed.append(news.fetch_feed(url, name))
            except Exception as exc:
                log.warning("Feed %s failed: %s", name or url, exc)
                ed.notes.append(f"{name or 'A news feed'} unreachable")
        ed.news = news.merge_feeds(per_feed, n["max_stories"])

    write_front_page(ed, cfg["editor"])
    return ed


def parse_day(value: str | None, tz: tzinfo) -> date:
    today = datetime.now(tz).date()
    if not value or value == "today":
        return today
    if value == "tomorrow":
        return today + timedelta(days=1)
    return date.fromisoformat(value)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m paper", description="Print your own morning newspaper.")
    ap.add_argument("-c", "--config", type=Path, default=Path("config.toml"), help="config file (default: config.toml)")
    ap.add_argument("--date", help='edition date: YYYY-MM-DD, "today" (default) or "tomorrow"')
    ap.add_argument("--demo", action="store_true", help="use built-in sample data (no accounts needed)")
    ap.add_argument("-o", "--out", type=Path, default=Path("out"), help="output folder (default: out/)")
    ap.add_argument("--html-only", action="store_true", help="write the HTML page but skip the PDF")
    ap.add_argument("--print", dest="send", action="store_true", help="send the PDF to the printer")
    ap.add_argument("--printer", help="printer name (see --list-printers); overrides config")
    ap.add_argument("--list-printers", action="store_true", help="show printers known to CUPS and exit")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(message)s")

    if args.list_printers:
        try:
            print(list_printers())
            return 0
        except PrintError as exc:
            print(exc, file=sys.stderr)
            return 1

    try:
        use_file = not (args.demo and not args.config.exists())
        cfg = load_config(args.config if use_file else None)
        tz = local_tz(cfg["paper"]["timezone"])
        day = parse_day(args.date, tz)
    except (ConfigError, ValueError) as exc:
        print(f"Config problem: {exc}", file=sys.stderr)
        return 2

    if args.demo and not use_file:
        cfg["paper"].update(name="The Morning Times", city="Brooklyn, NY")

    ed = build_edition(cfg, day, tz, use_demo=args.demo)

    args.out.mkdir(parents=True, exist_ok=True)
    stem = f"paper-{day.isoformat()}"
    html_path = (args.out / f"{stem}.html").resolve()
    html_path.write_text(render_html(ed, cfg), encoding="utf-8")
    print(f"Front page: {ed.headline}")
    print(f"HTML  -> {html_path}")
    if args.html_only:
        return 0

    pdf_path = html_path.with_suffix(".pdf")
    try:
        engine = render_pdf(html_path, pdf_path, cfg["render"]["chromium_path"])
    except RenderError as exc:
        print(exc, file=sys.stderr)
        return 3
    print(f"PDF   -> {pdf_path}  (via {engine})")

    if args.send:
        pr = cfg["printer"]
        try:
            job = print_pdf(
                pdf_path,
                printer=args.printer or pr["name"],
                copies=int(pr["copies"]),
                options=list(pr["options"]),
                title=f"{ed.name} {day.isoformat()}",
            )
        except PrintError as exc:
            print(exc, file=sys.stderr)
            return 4
        print(f"Print -> {job}")
    return 0
