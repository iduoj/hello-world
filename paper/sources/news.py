"""Headlines from RSS 2.0 / Atom feeds (stdlib only)."""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from itertools import zip_longest
from typing import Iterable

from ..models import NewsItem
from .http import fetch

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

SUMMARY_CHARS = 320


class _TextAndImages(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.images: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "img":
            src = dict(attrs).get("src")
            if src:
                self.images.append(src)
        elif tag in ("p", "br", "div", "li"):
            self.parts.append(" ")


def strip_html(fragment: str) -> tuple[str, list[str]]:
    """Plain text and <img> sources from an HTML fragment."""
    parser = _TextAndImages()
    parser.feed(fragment or "")
    parser.close()
    text = re.sub(r"\s+", " ", html.unescape("".join(parser.parts))).strip()
    return text, parser.images


def clean_title(text: str) -> str:
    """Titles are plain text in practice (often with entities); don't treat "<...>" as tags."""
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def truncate(text: str, limit: int = SUMMARY_CHARS) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:—-")
    return cut + "…"


def _safe_image(url: str | None) -> str | None:
    if url and url.startswith(("https://", "http://")):
        return url
    return None


def _first_image(el: ET.Element, html_images: list[str]) -> str | None:
    for tag in ("media:content", "media:group/media:content"):
        for media in el.findall(tag, NS):
            kind = (media.get("medium") or media.get("type") or "image").lower()
            if "image" in kind and media.get("url"):
                return _safe_image(media.get("url"))
    thumb = el.find("media:thumbnail", NS)
    if thumb is not None and thumb.get("url"):
        return _safe_image(thumb.get("url"))
    for enc in el.findall("enclosure"):
        if (enc.get("type") or "").startswith("image") and enc.get("url"):
            return _safe_image(enc.get("url"))
    for src in html_images:
        if _safe_image(src):
            return src
    return None


def _text(el: ET.Element, path: str) -> str:
    found = el.find(path, NS)
    return (found.text or "").strip() if found is not None and found.text else ""


def parse_feed(data: bytes, source: str = "") -> list[NewsItem]:
    root = ET.fromstring(data)
    items: list[NewsItem] = []

    if root.tag == f"{{{NS['atom']}}}feed":  # Atom
        source = source or _text(root, "atom:title")
        for entry in root.findall("atom:entry", NS):
            raw = _text(entry, "atom:summary") or _text(entry, "atom:content")
            summary, imgs = strip_html(raw)
            # Element truthiness means "has children", so compare with None explicitly.
            link_el = entry.find("atom:link[@rel='alternate']", NS)
            if link_el is None:
                link_el = entry.find("atom:link", NS)
            items.append(
                NewsItem(
                    title=clean_title(_text(entry, "atom:title")),
                    summary=truncate(summary),
                    source=source,
                    link=link_el.get("href", "") if link_el is not None else "",
                    image_url=_first_image(entry, imgs),
                )
            )
        return [i for i in items if i.title]

    channel = root.find("channel")
    if channel is None:
        raise ValueError("Not an RSS or Atom feed")
    source = source or _text(channel, "title")
    for item in channel.findall("item"):
        desc_text, desc_imgs = strip_html(_text(item, "description"))
        _, content_imgs = strip_html(_text(item, "content:encoded"))
        items.append(
            NewsItem(
                title=clean_title(_text(item, "title")),
                summary=truncate(desc_text),
                source=source,
                link=_text(item, "link"),
                image_url=_first_image(item, desc_imgs + content_imgs),
            )
        )
    return [i for i in items if i.title]


def merge_feeds(feeds: Iterable[list[NewsItem]], limit: int) -> list[NewsItem]:
    """Round-robin across feeds so one source doesn't take over the page."""
    seen: set[str] = set()
    merged: list[NewsItem] = []
    for row in zip_longest(*feeds):
        for item in row:
            if item is None:
                continue
            key = re.sub(r"\W+", " ", item.title.lower()).strip()
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
            if len(merged) >= limit:
                return merged
    return merged


def fetch_feed(url: str, name: str = "") -> list[NewsItem]:
    return parse_feed(fetch(url), name)
