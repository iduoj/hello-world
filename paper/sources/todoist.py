"""Today's tasks from Todoist (API v1). Needs a personal API token:
Todoist -> Settings -> Integrations -> Developer -> API token.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone, tzinfo
from typing import Any

from ..models import Task
from .http import fetch_json

FILTER_URL = "https://api.todoist.com/api/v1/tasks/filter"
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")


def _parse_due(due: dict[str, Any] | None, tz: tzinfo) -> tuple[date | None, datetime | None]:
    if not due:
        return None, None
    raw = due.get("datetime") or due.get("date")
    if not raw:
        return None, None
    if len(raw) == 10:
        return date.fromisoformat(raw), None
    stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    stamp = stamp.replace(tzinfo=tz) if stamp.tzinfo is None else stamp.astimezone(tz)
    return stamp.date(), stamp


def parse_tasks(payload: Any, today: date, tz: tzinfo, limit: int) -> list[Task]:
    rows = payload.get("results", []) if isinstance(payload, dict) else payload
    tasks: list[Task] = []
    for row in rows:
        due_day, due_time = _parse_due(row.get("due"), tz)
        tasks.append(
            Task(
                content=_MD_LINK.sub(r"\1", row.get("content", "")).strip(),
                priority=int(row.get("priority", 1)),
                overdue=due_day is not None and due_day < today,
                due_time=due_time,
            )
        )
    far = datetime.max.replace(tzinfo=timezone.utc)
    tasks.sort(key=lambda t: (not t.overdue, -t.priority, t.due_time or far))
    return tasks[:limit]


def fetch_tasks(token: str, query: str, today: date, tz: tzinfo, limit: int = 8) -> list[Task]:
    payload = fetch_json(
        FILTER_URL,
        params={"query": query, "limit": 50},
        headers={"Authorization": f"Bearer {token}"},
    )
    return parse_tasks(payload, today, tz, limit)
