from datetime import date

from paper.sources.todoist import parse_tasks

PAYLOAD = {
    "results": [
        {"content": "Return library books", "priority": 1, "due": {"date": "2026-11-08"}},
        {"content": "Book [train](https://amtrak.com) tickets", "priority": 4, "due": {"date": "2026-11-08"}},
        {"content": "Pay electric bill", "priority": 2, "due": {"date": "2026-11-05"}},
        {"content": "Send slides", "priority": 3, "due": {"date": "2026-11-08T16:00:00Z"}},
        {"content": "Someday", "priority": 1, "due": None},
    ],
    "next_cursor": None,
}


def test_parse_tasks_orders_priority_then_overdue(tz):
    tasks = parse_tasks(PAYLOAD, date(2026, 11, 8), tz)
    assert [t.content for t in tasks] == [
        "Book train tickets",  # p1 due today beats an overdue p3
        "Send slides",
        "Pay electric bill",
        "Return library books",
        "Someday",
    ]
    assert tasks[2].overdue and not tasks[0].overdue
    assert tasks[1].due_time.hour == 11  # 16:00 UTC -> 11 a.m. Eastern


def test_overdue_breaks_priority_ties(tz):
    rows = [
        {"content": "today", "priority": 2, "due": {"date": "2026-11-08"}},
        {"content": "late", "priority": 2, "due": {"date": "2026-11-01"}},
    ]
    assert [t.content for t in parse_tasks(rows, date(2026, 11, 8), tz)] == ["late", "today"]


def test_limit_and_plain_list(tz):
    tasks = parse_tasks(PAYLOAD["results"], date(2026, 11, 8), tz, limit=2)
    assert len(tasks) == 2
