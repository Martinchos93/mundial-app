"""Fetch national-team squads (photo/age/position/number) from API-Football
and store them locally. The squads endpoint is not season-gated, so it works
on the free plan. Resumable: re-running only fetches teams not yet stored."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Match, Player
from app.services import football_api

logger = logging.getLogger(__name__)

_STATIC_PATH = Path(__file__).resolve().parent.parent / "data" / "squads_2026.json"


def load_static_squads(db: Session) -> int:
    """Load the official 2026 call-ups from the bundled static JSON.

    Source of truth for squads (names + position). Replaces any prior data.
    Runs on startup; no network/quota needed.
    """
    if not _STATIC_PATH.exists():
        logger.warning("Static squads file not found at %s", _STATIC_PATH)
        return 0
    # Don't wipe an already-populated table (would discard enriched photos/bios).
    if db.query(Player).count() > 0:
        return 0
    data = json.loads(_STATIC_PATH.read_text(encoding="utf-8"))
    count = 0
    for team, by_pos in data.items():
        for pos, names in by_pos.items():
            for name in names:
                db.add(Player(team_name=team, name=name, position=pos))
                count += 1
    db.commit()
    logger.info("Loaded %d players from static squads", count)
    return count

# Free plan = 10 requests/minute. Each team costs 2 calls (search + squad),
# so we pace calls and cap how many teams we sync per invocation.
_THROTTLE_SECONDS = 7
_DEFAULT_BATCH = 4

# API-Football names differ from our seeded names for some nations.
SEARCH_OVERRIDE = {
    "Korea Republic": "South Korea",
    "IR Iran": "Iran",
    "Cote D'Ivoire": "Ivory Coast",
    "DR Congo": "Congo DR",
    "Cape Verde": "Cape Verde Islands",
    "Bosnia and Herzegovina": "Bosnia",
    "Czech Republic": "Czechia",
}


def _group_team_names(db: Session) -> list[str]:
    names: set[str] = set()
    for m in db.query(Match).filter(Match.phase.ilike("Grupo %")).all():
        names.add(m.home_team)
        names.add(m.away_team)
    return sorted(names)


async def sync_squads(
    db: Session,
    only_missing: bool = True,
    names: list[str] | None = None,
    limit: int | None = _DEFAULT_BATCH,
    throttle: float = _THROTTLE_SECONDS,
) -> dict:
    results: dict[str, object] = {}
    synced = 0
    for name in names or _group_team_names(db):
        if only_missing and db.query(Player).filter(Player.team_name == name).count() > 0:
            continue
        if limit is not None and synced >= limit:
            results["_note"] = f"batch limit {limit} alcanzado; volvé a sincronizar para continuar"
            break
        synced += 1
        try:
            if synced > 1:
                await asyncio.sleep(throttle)
            teams = await football_api.search_team(SEARCH_OVERRIDE.get(name, name))
            national = next(
                (t for t in teams if (t.get("team") or {}).get("national")),
                teams[0] if teams else None,
            )
            if not national:
                results[name] = "no team"
                continue
            team_id = national["team"]["id"]
            await asyncio.sleep(throttle)
            squad = await football_api.get_squad(team_id)
            players = (squad[0].get("players") if squad else []) or []
            db.query(Player).filter(Player.team_name == name).delete()
            for p in players:
                db.add(
                    Player(
                        team_name=name,
                        api_id=p.get("id"),
                        name=p.get("name"),
                        position=p.get("position"),
                        number=p.get("number"),
                        age=p.get("age"),
                        photo_url=p.get("photo"),
                    )
                )
            db.commit()
            results[name] = len(players)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Squad sync failed for %s", name)
            results[name] = f"error: {exc}"
    return results
