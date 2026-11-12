"""Sample data for `--demo`, so you can see a full edition without any accounts."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, tzinfo

from .models import Event, HourForecast, NewsItem, Task, Weather


def _at(day: date, hh: int, mm: int, tz: tzinfo) -> datetime:
    return datetime.combine(day, time(hh, mm), tzinfo=tz)


def events(day: date, tz: tzinfo) -> tuple[list[Event], list[Event]]:
    tomorrow = day + timedelta(days=1)
    today = [
        Event("Mom's birthday", day, day + timedelta(days=1), all_day=True, recurring=True),
        Event("Morning run", _at(day, 7, 0, tz), _at(day, 7, 45, tz), "Lake Fairlee loop", recurring=True),
        Event("Team standup", _at(day, 9, 30, tz), _at(day, 9, 45, tz), recurring=True),
        Event("Dentist", _at(day, 14, 30, tz), _at(day, 15, 30, tz), "Dr. Patel, Main St."),
        Event("Pick up dry cleaning", _at(day, 17, 15, tz), _at(day, 17, 30, tz)),
        Event("Dinner with Maya", _at(day, 19, 0, tz), _at(day, 21, 0, tz), "Hanover, NH"),
    ]
    tmrw = [
        Event("Yoga", _at(tomorrow, 7, 30, tz), _at(tomorrow, 8, 30, tz), recurring=True),
        Event("Quarterly planning", _at(tomorrow, 10, 0, tz), _at(tomorrow, 12, 0, tz), "Room 4B"),
        Event("Flight to Denver", _at(tomorrow, 18, 5, tz), _at(tomorrow, 21, 0, tz), "Lebanon Airport"),
    ]
    return today, tmrw


def tasks(day: date, tz: tzinfo) -> list[Task]:
    return [
        Task("Pay electric bill", priority=3, overdue=True),
        Task("Call Mom — happy birthday!", priority=4),
        Task("Book Thanksgiving train tickets", priority=4),
        Task("Send slides to Jordan", priority=2, due_time=_at(day, 11, 0, tz)),
        Task("Return library books"),
        Task("Water the plants"),
    ]


def weather(day: date) -> Weather:
    hours = [(6, 49, 2), (9, 55, 2), (12, 62, 1), (15, 64, 1), (18, 58, 3), (21, 53, 3)]
    pops = [0, 0, 5, 10, 20, 20]
    return Weather(
        unit="F",
        high=64,
        low=48,
        code=2,
        current_temp=50,
        precip_chance=20,
        wind_max=9,
        uv_max=3,
        sunrise=datetime.combine(day, time(6, 34)),
        sunset=datetime.combine(day, time(16, 43)),
        hourly=[HourForecast(datetime.combine(day, time(h, 0)), t, c, p) for (h, t, c), p in zip(hours, pops)],
        tomorrow_high=58,
        tomorrow_low=45,
        tomorrow_code=61,
    )


def news() -> list[NewsItem]:
    wire = "Sample Wire"
    return [
        NewsItem(
            "Your Headlines Will Appear Here Each Morning",
            "This is a demo edition. Point the [news] section of config.toml at any RSS or Atom feeds — "
            "a national paper, your city's news site, a favorite blog — and the top stories land here, "
            "with the lead story's photo printed in black and white when the feed includes one. "
            "Stories are interleaved across feeds so no single source dominates the page.",
            wire,
        ),
        NewsItem(
            "Calendar Feeds Need No Login",
            "Google Calendar, iCloud and Outlook each offer a private .ics link. Paste it into config.toml "
            "and every event, including recurring ones, shows up in The Day Ahead.",
            wire,
        ),
        NewsItem(
            "Forecast Comes Free of Charge",
            "Weather is supplied by Open-Meteo, which needs no account or API key — only your latitude "
            "and longitude.",
            wire,
        ),
        NewsItem(
            "Tasks Arrive From Todoist",
            "Add a Todoist API token to list today's and overdue tasks, each with a box to tick by hand.",
            wire,
        ),
        NewsItem(
            "An Editor Who Never Sleeps",
            "Optionally, Claude writes the front-page headline and lede from your schedule and forecast. "
            "Without an API key, a house template does the job.",
            wire,
        ),
        NewsItem(
            "Phone Stays on the Nightstand",
            "Schedule the printer for 6:30 a.m. and the paper is waiting in the tray before you are.",
            wire,
        ),
    ]


def local_news() -> list[NewsItem]:
    return [
        NewsItem(
            "Hometown Stories Get Their Own Corner",
            "Feeds marked local = true in config.toml, such as Sidenote and the Valley News' "
            "Thetford page, appear here.",
            "Sample Wire",
        ),
        NewsItem("Old News Retires on Schedule", "Each feed sets how many days a story stays in the paper.", "Sample Wire"),
        NewsItem("Obituaries and Op-Eds Can Be Skipped", "", "Sample Wire"),
    ]
