from paper.models import NewsItem
from paper.sources.news import merge_feeds, parse_feed, strip_html, truncate


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
