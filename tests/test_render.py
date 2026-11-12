import os
import re
from datetime import date
from zoneinfo import ZoneInfo

import pytest

from paper.cli import build_edition, issue_numbers, main
from paper.config import load_config
from paper.models import Event
from paper.render import render_html

TZ = ZoneInfo("America/New_York")
DAY = date(2026, 11, 8)


def demo_html(**paper):
    cfg = load_config(None)
    cfg["paper"].update(paper)
    ed = build_edition(cfg, DAY, TZ, use_demo=True)
    return ed, render_html(ed, cfg)


def test_demo_renders_masthead_and_sections():
    ed, html = demo_html()
    assert "Barker Road Times" in html
    assert ed.headline == "Dentist at 2:30. Dinner with Maya at 7."
    for section in ("The Day Ahead", "On the Docket", "Weather", "Tomorrow", "Around Town"):
        assert section in html
    # CSS must not be HTML-escaped, or the fonts silently fall back to Times
    assert 'font-family: "UnifrakturMaguntia"' in html
    assert "&#34;" not in html.split("</style>")[0]


def test_user_content_is_escaped():
    cfg = load_config(None)
    ed = build_edition(cfg, DAY, TZ, use_demo=True)
    ed.events.append(Event("<script>alert(1)</script>", DAY, all_day=True))
    html = render_html(ed, cfg)
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


def test_a4_page_size():
    _, html = demo_html(paper_size="A4")
    assert "size: 210mm 297mm" in html


def test_issue_numbers():
    assert issue_numbers(DAY, None) == (1, 312)
    assert issue_numbers(DAY, date(2024, 11, 9)) == (2, 730)


def test_cli_html_only(tmp_path, capsys):
    assert main(["--demo", "--html-only", "-c", str(tmp_path / "none.toml"), "-o", str(tmp_path), "--date", "2026-11-08"]) == 0
    assert (tmp_path / "paper-2026-11-08.html").exists()
    assert "Front page:" in capsys.readouterr().out


@pytest.mark.skipif(not os.environ.get("PAPER_PDF_TESTS"), reason="set PAPER_PDF_TESTS=1 to render a real PDF")
def test_cli_pdf_is_one_page(tmp_path):
    assert main(["--demo", "-c", str(tmp_path / "none.toml"), "-o", str(tmp_path), "--date", "2026-11-08"]) == 0
    pdf = (tmp_path / "paper-2026-11-08.pdf").read_bytes()
    assert pdf.startswith(b"%PDF")
    assert len(re.findall(rb"/Type\s*/Page(?!s)", pdf)) == 1  # exactly one sheet of paper


def test_local_feeds_fill_their_own_box(monkeypatch):
    from datetime import datetime, timedelta, timezone

    from paper import cli
    from paper.models import NewsItem

    now = datetime.now(timezone.utc)
    stories = {
        "https://town.example/rss": [NewsItem("Town story", published=now), NewsItem("Old town story", published=now - timedelta(days=30))],
        "https://state.example/rss": [NewsItem("State story", published=now), NewsItem("An obit", published=now, categories=["Obituaries"])],
    }

    def fake_fetch(url, name=""):
        if url == "https://down.example/rss":
            raise OSError("offline")
        return stories[url]

    monkeypatch.setattr(cli.news, "fetch_feed", fake_fetch)
    cfg = load_config(None)
    cfg["weather"]["enabled"] = False
    cfg["news"]["feeds"] = [
        {"name": "Town", "url": "https://town.example/rss", "local": True, "max_age_days": 14},
        {"name": "State", "url": "https://state.example/rss", "skip_categories": ["obituaries"]},
        {"name": "Down", "url": "https://down.example/rss"},
    ]
    ed = build_edition(cfg, DAY, TZ)
    assert [n.title for n in ed.local_news] == ["Town story"]
    assert [n.title for n in ed.news] == ["State story"]
    assert "Down unreachable" in ed.notes
