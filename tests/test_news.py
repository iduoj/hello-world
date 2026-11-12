from datetime import datetime, timedelta, timezone

from paper.models import NewsItem
from paper.sources.news import keep_fresh, merge_feeds, parse_feed, strip_html, truncate


def test_rss(fixtures):
    items = parse_feed((fixtures / "rss.xml").read_bytes())
    first, second, third = items
    assert first.title == "Bridge Reopens After <Repairs>"
    assert first.summary == "The bridge reopened on Monday & traffic resumed."
    assert first.image_url == "https://example.com/bridge.jpg"  # media:content wins over inline <img>
    assert first.source == "Example News"
    assert second.image_url == "https://example.com/second.jpg"  # from content:encoded
    assert third.image_url is None  # non-http(s) images are never used


def test_atom(fixtures):
    (item,) = parse_feed((fixtures / "atom.xml").read_bytes(), "My Blog")
    assert item.title == "Hello Atom"
    assert item.summary == "An atom summary."
    assert item.link == "https://blog.example.com/hello"
    assert item.source == "My Blog"


def test_merge_round_robin_and_dedupe():
    a = [NewsItem("A1"), NewsItem("Shared story"), NewsItem("A3")]
    b = [NewsItem("B1"), NewsItem("Shared  Story!"), NewsItem("B3")]
    merged = [n.title for n in merge_feeds([a, b], limit=5)]
    assert merged == ["A1", "B1", "Shared story", "A3", "B3"]


def test_truncate_and_strip():
    assert truncate("word " * 100, 20).endswith("…")
    assert len(truncate("word " * 100, 20)) <= 21
    assert strip_html("<p>a</p><p>b</p>")[0] == "a b"


def test_dates_and_categories(fixtures):
    item = parse_feed((fixtures / "rss.xml").read_bytes())[0]
    assert item.published.isoformat() == "2026-11-12T13:21:00+00:00"
    assert item.categories == ["News", "Obituaries"]
    atom = parse_feed((fixtures / "atom.xml").read_bytes())[0]
    assert atom.published.isoformat() == "2026-11-10T08:00:00+00:00"
    assert atom.categories == ["vermont"]


def test_keep_fresh():
    now = datetime(2026, 11, 12, 12, tzinfo=timezone.utc)
    items = [
        NewsItem("new", published=now - timedelta(days=1)),
        NewsItem("old", published=now - timedelta(days=10)),
        NewsItem("undated"),
        NewsItem("obit", published=now, categories=["obituaries"]),
    ]
    kept = [i.title for i in keep_fresh(items, now, max_age_days=3, skip_categories=["Obituaries"])]
    assert kept == ["new", "undated"]
    assert len(keep_fresh(items, now)) == 4  # no limits, nothing dropped


def test_feed_boilerplate_is_stripped():
    text, _ = strip_html("<p>Vermont officials want to keep the illness at bay. Read the story on VTDigger here: Deer.</p>")
    assert text == "Vermont officials want to keep the illness at bay."
    assert strip_html("Body text. The post Hello appeared first on Example.")[0] == "Body text."
