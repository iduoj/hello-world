"""Calendar events from iCal (.ics) feeds.

Works with Google Calendar ("Secret address in iCal format"), iCloud (public
calendar link), Outlook ("Publish a calendar" -> ICS) and anything else that
serves .ics. Recurring events are expanded with ``recurring_ical_events``.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, tzinfo
from typing import Iterable

import icalendar
import recurring_ical_events

from ..models import Event


def _to_local(value: date | datetime, tz: tzinfo) -> date | datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:  # "floating" time: means local wall-clock time
            return value.replace(tzinfo=tz)
        return value.astimezone(tz)
    return value


def _covers_day(ev: Event, day: date, tz: tzinfo) -> bool:
    """Does the event occupy any part of *day*?"""
    if ev.all_day:
        start = ev.start if not isinstance(ev.start, datetime) else ev.start.date()
        end = ev.end if ev.end is not None else start + timedelta(days=1)
        if isinstance(end, datetime):
            end = end.date()
        return start <= day < max(end, start + timedelta(days=1))
    day_start = datetime.combine(day, time.min, tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    assert isinstance(ev.start, datetime)
    end = ev.end if isinstance(ev.end, datetime) else ev.start
    if end == ev.start:  # zero-length events still count at their start time
        return day_start <= ev.start < day_end
    return ev.start < day_end and end > day_start


def parse_ics(data: bytes, start: date, days: int, tz: tzinfo, hide: Iterable[str] = ()) -> list[Event]:
    """Events overlapping [start, start + days) from one .ics payload."""
    cal = icalendar.Calendar.from_ical(data)
    window_start = datetime.combine(start, time.min, tzinfo=tz)
    window_end = window_start + timedelta(days=days)
    hide_lower = [h.lower() for h in hide if h]
    # Expanded occurrences all carry RECURRENCE-ID, so decide "recurring" from the source series.
    series = {
        str(c.get("UID"))
        for c in cal.walk("VEVENT")
        if c.get("RRULE") is not None or c.get("RDATE") is not None or c.get("RECURRENCE-ID") is not None
    }

    events: list[Event] = []
    for comp in recurring_ical_events.of(cal).between(window_start, window_end):
        if str(comp.get("STATUS", "")).upper() == "CANCELLED":
            continue
        title = str(comp.get("SUMMARY", "")).strip() or "(untitled)"
        if any(h in title.lower() for h in hide_lower):
            continue
        dtstart = comp.get("DTSTART")
        if dtstart is None:
            continue
        s = _to_local(dtstart.dt, tz)
        dtend = comp.get("DTEND")
        e = _to_local(dtend.dt, tz) if dtend is not None else None
        if e is None and comp.get("DURATION") is not None:
            e = s + comp.get("DURATION").dt
        all_day = not isinstance(s, datetime)
        location = str(comp.get("LOCATION", "")).strip().splitlines()[0] if comp.get("LOCATION") else ""
        recurring = str(comp.get("UID")) in series
        events.append(
            Event(title=title, start=s, end=e, location=location, all_day=all_day, recurring=recurring)
        )
    return events


def events_on(events: Iterable[Event], day: date, tz: tzinfo) -> list[Event]:
    """Events touching *day*, all-day first, then by start time, without duplicates."""
    seen: set[tuple[str, str]] = set()
    picked: list[Event] = []
    for ev in events:
        if not _covers_day(ev, day, tz):
            continue
        key = (ev.title.lower(), str(ev.start))
        if key in seen:  # the same event on two shared calendars
            continue
        seen.add(key)
        picked.append(ev)

    def sort_key(ev: Event) -> tuple[int, datetime]:
        if ev.all_day:
            return (0, datetime.min.replace(tzinfo=tz))
        assert isinstance(ev.start, datetime)
        return (1, ev.start)

    return sorted(picked, key=sort_key)

