"""Thin async client for API-Football (api-sports.io / RapidAPI).

All responses are cached in Redis for a short TTL to stay within rate
limits. The client returns the raw `response` array from the API.
"""
from __future__ import annotations

import json
import logging

import httpx

from app.config import settings
from app.redis_client import redis_client

logger = logging.getLogger(__name__)

BASE_URL = f"https://{settings.FOOTBALL_API_HOST}"
_CACHE_PREFIX = "football:"


def _headers() -> dict[str, str]:
    # api-sports.io uses x-apisports-key; RapidAPI uses x-rapidapi-key.
    # Sending both is harmless and works with either host.
    return {
        "x-apisports-key": settings.FOOTBALL_API_KEY,
        "x-rapidapi-key": settings.FOOTBALL_API_KEY,
        "x-rapidapi-host": settings.FOOTBALL_API_HOST,
    }


async def _get(path: str, params: dict | None = None, ttl: int = 60) -> list[dict]:
    cache_key = _CACHE_PREFIX + path + ":" + json.dumps(params or {}, sort_keys=True)
    cached = redis_client.get(cache_key)
    if cached is not None:
        try:
            return json.loads(cached)
        except json.JSONDecodeError:
            pass

    if not settings.FOOTBALL_API_KEY:
        logger.warning("FOOTBALL_API_KEY not set; returning empty response for %s", path)
        return []

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(f"{BASE_URL}{path}", params=params, headers=_headers())
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("API-Football request failed (%s): %s", path, exc)
            return []

    data = resp.json().get("response", [])
    redis_client.setex(cache_key, ttl, json.dumps(data))
    return data


# ---- Endpoint wrappers -------------------------------------------------

async def get_fixtures(league: int, season: int) -> list[dict]:
    return await _get("/fixtures", {"league": league, "season": season}, ttl=3600)


async def get_fixture(fixture_id: int) -> dict | None:
    data = await _get(f"/fixtures", {"id": fixture_id}, ttl=15)
    return data[0] if data else None


async def get_fixtures_by_date(date: str, league: int, season: int) -> list[dict]:
    return await _get("/fixtures", {"date": date, "league": league, "season": season}, ttl=120)


async def get_live_fixtures(league: int) -> list[dict]:
    return await _get("/fixtures", {"live": "all", "league": league}, ttl=15)


async def get_fixture_statistics(fixture_id: int) -> list[dict]:
    return await _get("/fixtures/statistics", {"fixture": fixture_id}, ttl=15)


async def get_fixture_events(fixture_id: int) -> list[dict]:
    return await _get("/fixtures/events", {"fixture": fixture_id}, ttl=15)


async def get_fixture_lineups(fixture_id: int) -> list[dict]:
    return await _get("/fixtures/lineups", {"fixture": fixture_id}, ttl=300)


async def get_fixture_players(fixture_id: int) -> list[dict]:
    return await _get("/fixtures/players", {"fixture": fixture_id}, ttl=300)


async def get_team_statistics(team_id: int, league: int, season: int) -> dict | None:
    data = await _get(
        "/teams/statistics", {"team": team_id, "league": league, "season": season}, ttl=3600
    )
    # teams/statistics returns an object, not an array, under "response"
    return data if isinstance(data, dict) else (data[0] if data else None)


async def get_team(team_id: int) -> dict | None:
    data = await _get("/teams", {"id": team_id}, ttl=86400)
    return data[0] if data else None


async def get_teams(league: int, season: int) -> list[dict]:
    return await _get("/teams", {"league": league, "season": season}, ttl=86400)


async def get_team_last_fixtures(team_id: int, last: int = 5) -> list[dict]:
    return await _get("/fixtures", {"team": team_id, "last": last}, ttl=3600)


async def get_standings(league: int, season: int) -> list[dict]:
    return await _get("/standings", {"league": league, "season": season}, ttl=600)


async def get_odds(fixture_id: int) -> list[dict]:
    return await _get("/odds", {"fixture": fixture_id}, ttl=3600)


async def get_head_to_head(team1: int, team2: int, last: int = 5) -> list[dict]:
    return await _get("/fixtures/headtohead", {"h2h": f"{team1}-{team2}", "last": last}, ttl=86400)


async def get_player(player_id: int, season: int) -> dict | None:
    data = await _get("/players", {"id": player_id, "season": season}, ttl=3600)
    return data[0] if data else None
