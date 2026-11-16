from datetime import date, datetime

from paper.sources.calendar_ics import events_on, parse_ics

DAY = date(2026, 11, 8)


def load(fixtures, tz):
    return parse_ics((fixtures / "sample.ics").read_bytes(), DAY, 2, tz, hide=["focus"])


def test_today_has_timed_and_all_day_events_in_order(fixtures, tz):
    today = events_on(load(fixtures, tz), DAY, tz)
    titles = [e.title for e in today]
    # all-day first, then by start time; UTC dinner converted to 7 p.m. Eastern
    assert set(titles[:2]) == {"Conference", "Mom's birthday"}
    assert titles[2:] == ["Team standup", "Dentist", "Dinner with Maya"]
    dinner = today[-1]
    assert isinstance(dinner.start, datetime) and dinner.start.hour == 19


def test_cancelled_hidden_and_other_days_are_dropped(fixtures, tz):
    titles = {e.title for e in events_on(load(fixtures, tz), DAY, tz)}
    assert "Cancelled lunch" not in titles
    assert "Focus time" not in titles  # matched by the hide list, case-insensitively
    assert "Yesterday's thing" not in titles
    assert "Flight to Denver" not in titles


def test_recurring_flag_and_location(fixtures, tz):
    today = {e.title: e for e in events_on(load(fixtures, tz), DAY, tz)}
    assert today["Team standup"].recurring
    assert not today["Dentist"].recurring
    assert today["Dentist"].location == "Dr. Patel, 210 5th Ave"


def test_tomorrow_includes_multi_day_and_recurring(fixtures, tz):
    tomorrow = [e.title for e in events_on(load(fixtures, tz), date(2026, 11, 9), tz)]
    assert tomorrow == ["Conference", "Team standup", "Flight to Denver"]


def test_duplicate_events_across_calendars_collapse(fixtures, tz):
    events = load(fixtures, tz) + load(fixtures, tz)
    assert len(events_on(events, DAY, tz)) == 5
