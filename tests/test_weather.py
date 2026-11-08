import json
from datetime import date

from paper.sources.weather import describe, icon, parse_forecast


def test_parse_forecast(fixtures):
    data = json.loads((fixtures / "open_meteo.json").read_text())
    w = parse_forecast(data, date(2026, 11, 8))
    assert (round(w.high), round(w.low), w.code) == (64, 48, 61)
    assert w.precip_chance == 70
    assert w.current_temp == 47.1
    assert [h.time.hour for h in w.hourly] == [6, 9, 12, 15, 18, 21]
    assert w.hourly[-2].precip_chance == 60
    assert (w.sunrise.hour, w.sunrise.minute) == (6, 34)
    assert round(w.tomorrow_high) == 58 and w.tomorrow_code == 3


def test_parse_forecast_for_tomorrow(fixtures):
    data = json.loads((fixtures / "open_meteo.json").read_text())
    w = parse_forecast(data, date(2026, 11, 9))
    assert round(w.high) == 58
    assert w.current_temp is None  # "current" only describes today
    assert [h.time.hour for h in w.hourly] == [6]
    assert w.tomorrow_code == 0


def test_codes():
    assert describe(2) == "Partly Cloudy" and icon(2) == "partly"
    assert icon(95) == "storm"
    assert describe(1234) == "—"
