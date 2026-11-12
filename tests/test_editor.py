from datetime import date, datetime, timedelta

import pytest

from paper import editor
from paper.models import Edition, Event, Task, Weather

DAY = date(2026, 11, 8)


def at(hh, mm, tz, minutes=60, **kw):
    start = datetime(2026, 11, 8, hh, mm, tzinfo=tz)
    return Event(kw.pop("title"), start, start + timedelta(minutes=minutes), **kw)


@pytest.mark.parametrize(
    "hh,mm,ap,short",
    [(9, 0, "9 a.m.", "9"), (14, 30, "2:30 p.m.", "2:30"), (12, 0, "noon", "noon"), (0, 0, "midnight", "12")],
)
def test_times(hh, mm, ap, short):
    dt = datetime(2026, 11, 8, hh, mm)
    assert editor.ap_time(dt) == ap
    assert editor.short_time(dt) == short


def test_headline_prefers_one_off_plans(tz):
    events = [
        at(7, 0, tz, title="Morning run", recurring=True),
        at(9, 30, tz, 15, title="Team standup", recurring=True),
        at(14, 30, tz, title="Dentist", location="Dr. Patel"),
        at(17, 15, tz, 15, title="Pick up dry cleaning"),
        at(19, 0, tz, 120, title="Dinner with Maya", location="Lilia"),
    ]
    assert editor.template_headline(events, DAY) == "Dentist at 2:30. Dinner with Maya at 7."


def test_headline_fallbacks(tz):
    assert editor.template_headline([Event("Mom's birthday", DAY, all_day=True)], DAY) == "Today: Mom's birthday."
    assert editor.template_headline([], DAY) in editor.QUIET_DAY_HEADLINES


def test_lede(tz):
    ed = Edition(day=DAY, name="T", tagline="", city="")
    ed.weather = Weather(unit="F", high=64.4, low=48, code=61, precip_chance=70)
    ed.events = [at(7, 0, tz, title="Run"), at(14, 30, tz, title="Dentist")]
    ed.tasks = [Task("a", overdue=True), Task("b"), Task("c")]
    assert editor.template_lede(ed) == (
        "Expect light rain, with a high of 64° and a low of 48° and a 70% chance of precipitation. "
        "Two appointments are on the books, the first at 7 a.m. "
        "Three tasks await your attention, one of them overdue."
    )


def test_editor_failure_falls_back_to_template(tz, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("no network")

    monkeypatch.setattr(editor, "claude_front_page", boom)
    ed = Edition(day=DAY, name="T", tagline="", city="", events=[at(14, 30, tz, title="Dentist")])
    editor.write_front_page(ed, {"enabled": True, "model": "claude-opus-5-5"})
    assert ed.headline == "Dentist at 2:30."
    assert ed.notes  # the failure is noted in the colophon
