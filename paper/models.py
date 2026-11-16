"""Plain data containers passed from the sources to the editor and renderer."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class Event:
    title: str
    start: datetime | date
    end: datetime | date | None = None
    location: str = ""
    all_day: bool = False
    recurring: bool = False  # standing meetings make poor headlines


@dataclass
class Task:
    content: str
    priority: int = 1  # Todoist scale: 4 = p1 (urgent) ... 1 = p4 (none)
    overdue: bool = False
    due_time: datetime | None = None


@dataclass
class HourForecast:
    time: datetime
    temp: float
    code: int
    precip_chance: int | None = None


@dataclass
class Weather:
    unit: str  # "F" or "C"
    high: float
    low: float
    code: int
    current_temp: float | None = None
    precip_chance: int | None = None
    wind_max: float | None = None
    wind_unit: str = "mph"
    uv_max: float | None = None
    sunrise: datetime | None = None
    sunset: datetime | None = None
    hourly: list[HourForecast] = field(default_factory=list)
    tomorrow_high: float | None = None
    tomorrow_low: float | None = None
    tomorrow_code: int | None = None


@dataclass
class NewsItem:
    title: str
    summary: str = ""
    source: str = ""
    link: str = ""
    image_url: str | None = None
    published: datetime | None = None
    categories: list[str] = field(default_factory=list)


@dataclass
class Edition:
    day: date
    name: str
    tagline: str
    city: str
    headline: str = ""
    lede: str = ""
    events: list[Event] = field(default_factory=list)
    tomorrow_events: list[Event] = field(default_factory=list)
    tasks: list[Task] = field(default_factory=list)
    weather: Weather | None = None
    news: list[NewsItem] = field(default_factory=list)
    local_news: list[NewsItem] = field(default_factory=list)
    volume: int = 1
    number: int = 1
    printed_at: datetime | None = None
    # Sources that failed; printed in small type so a bad feed never stops the presses.
    notes: list[str] = field(default_factory=list)
