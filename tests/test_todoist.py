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


def test_parse_tasks_orders_overdue_then_priority(tz):
    tasks = parse_tasks(PAYLOAD, date(2026, 11, 8), tz, limit=10)
    assert [t.content for t in tasks] == [
        "Pay electric bill",
        "Book train tickets",
        "Send slides",
        "Return library books",
        "Someday",
    ]
    assert tasks[0].overdue and not tasks[1].overdue
    assert tasks[2].due_time.hour == 11  # 16:00 UTC -> 11 a.m. Eastern


def test_limit_and_plain_list(tz):
    tasks = parse_tasks(PAYLOAD["results"], date(2026, 11, 8), tz, limit=2)
    assert len(tasks) == 2
