"""Forecast from Open-Meteo (free, no API key)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from ..models import HourForecast, Weather
from .http import fetch_json

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"

# WMO weather interpretation codes -> (description, icon name used by the template)
WMO: dict[int, tuple[str, str]] = {
    0: ("Clear", "sun"),
    1: ("Mostly Clear", "sun"),
    2: ("Partly Cloudy", "partly"),
    3: ("Overcast", "cloud"),
    45: ("Fog", "fog"),
    48: ("Freezing Fog", "fog"),
    51: ("Light Drizzle", "drizzle"),
    53: ("Drizzle", "drizzle"),
    55: ("Heavy Drizzle", "drizzle"),
    56: ("Freezing Drizzle", "drizzle"),
    57: ("Freezing Drizzle", "drizzle"),
    61: ("Light Rain", "rain"),
    63: ("Rain", "rain"),
    65: ("Heavy Rain", "rain"),
    66: ("Freezing Rain", "rain"),
    67: ("Freezing Rain", "rain"),
    71: ("Light Snow", "snow"),
    73: ("Snow", "snow"),
    75: ("Heavy Snow", "snow"),
    77: ("Snow Grains", "snow"),
    80: ("Showers", "rain"),
    81: ("Showers", "rain"),
    82: ("Heavy Showers", "rain"),
    85: ("Snow Showers", "snow"),
    86: ("Heavy Snow Showers", "snow"),
    95: ("Thunderstorms", "storm"),
    96: ("Thunderstorms, Hail", "storm"),
    99: ("Thunderstorms, Hail", "storm"),
}

HOURS_SHOWN = (6, 9, 12, 15, 18, 21)


def describe(code: int | None) -> str:
    return WMO.get(code if code is not None else -1, ("—", "cloud"))[0]


def icon(code: int | None) -> str:
    return WMO.get(code if code is not None else -1, ("—", "cloud"))[1]


def geocode(name: str) -> tuple[float, float]:
    """Best-effort lookup of a place name ("Post Mills, VT" -> Post Mills)."""
    query = name.split(",")[0].strip()
    data = fetch_json(GEOCODE_URL, params={"name": query, "count": 1, "language": "en", "format": "json"})
    results = data.get("results") or []
    if not results:
        raise LookupError(f"Couldn't find coordinates for {name!r}; set weather.latitude/longitude")
    return float(results[0]["latitude"]), float(results[0]["longitude"])


def fetch_weather(lat: float, lon: float, day: date, units: str = "imperial", timezone: str = "") -> Weather:
    params: dict[str, Any] = {
        "latitude": lat,
        "longitude": lon,
        "timezone": timezone or "auto",
        "forecast_days": 3,
        "current": "temperature_2m,weather_code",
        "hourly": "temperature_2m,weather_code,precipitation_probability",
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "sunrise",
                "sunset",
                "wind_speed_10m_max",
                "uv_index_max",
            ]
        ),
    }
    if units == "imperial":
        params.update(temperature_unit="fahrenheit", wind_speed_unit="mph", precipitation_unit="inch")
    else:
        params.update(wind_speed_unit="kmh")
    return parse_forecast(fetch_json(FORECAST_URL, params=params), day, units)


def _num(values: list[Any], i: int | None) -> Any:
    if i is None or i >= len(values):
        return None
    return values[i]


def parse_forecast(data: dict[str, Any], day: date, units: str = "imperial") -> Weather:
    daily = data["daily"]
    days = [date.fromisoformat(d) for d in daily["time"]]
    i = days.index(day) if day in days else 0
    j = i + 1 if i + 1 < len(days) else None

    def when(s: str | None) -> datetime | None:
        return datetime.fromisoformat(s) if s else None

    hourly = data.get("hourly") or {}
    hours: list[HourForecast] = []
    for k, stamp in enumerate(hourly.get("time", [])):
        t = datetime.fromisoformat(stamp)
        if t.date() == days[i] and t.hour in HOURS_SHOWN:
            hours.append(
                HourForecast(
                    time=t,
                    temp=hourly["temperature_2m"][k],
                    code=int(hourly["weather_code"][k]),
                    precip_chance=_num(hourly.get("precipitation_probability", []), k),
                )
            )

    current = data.get("current") or {}
    return Weather(
        unit="F" if units == "imperial" else "C",
        high=daily["temperature_2m_max"][i],
        low=daily["temperature_2m_min"][i],
        code=int(daily["weather_code"][i]),
        current_temp=current.get("temperature_2m") if day == date.fromisoformat(daily["time"][0]) else None,
        precip_chance=_num(daily.get("precipitation_probability_max", []), i),
        wind_max=_num(daily.get("wind_speed_10m_max", []), i),
        wind_unit="mph" if units == "imperial" else "km/h",
        uv_max=_num(daily.get("uv_index_max", []), i),
        sunrise=when(_num(daily.get("sunrise", []), i)),
        sunset=when(_num(daily.get("sunset", []), i)),
        hourly=hours,
        tomorrow_high=_num(daily["temperature_2m_max"], j),
        tomorrow_low=_num(daily["temperature_2m_min"], j),
        tomorrow_code=int(daily["weather_code"][j]) if j is not None else None,
    )
