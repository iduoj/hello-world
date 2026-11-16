from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures() -> Path:
    return FIXTURES


@pytest.fixture
def tz() -> ZoneInfo:
    return ZoneInfo("America/New_York")
