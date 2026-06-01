from fastapi import APIRouter

from app.config import settings
from app.services import football_api

router = APIRouter(tags=["standings"])


def _strip_group(name: str | None) -> str | None:
    if not name:
        return None
    # API-Football labels groups as "Group A" / "Grupo A" → keep just "A"
    parts = name.strip().split()
    return parts[-1] if parts else name


def _transform(raw: list[dict]) -> list[dict]:
    """Flatten API-Football /standings into clean team rows."""
    out: list[dict] = []
    if not raw:
        return out
    league = (raw[0] or {}).get("league", {})
    groups = league.get("standings", []) or []
    for group_rows in groups:
        for row in group_rows:
            team = row.get("team", {}) or {}
            all_stats = row.get("all", {}) or {}
            goals = all_stats.get("goals", {}) or {}
            out.append(
                {
                    "id": team.get("id"),
                    "external_id": team.get("id"),
                    "name": team.get("name"),
                    "short_name": team.get("name"),
                    "logo_url": team.get("logo"),
                    "flag_emoji": "",  # derived client-side from name
                    "group": _strip_group(row.get("group")),
                    "played": all_stats.get("played"),
                    "wins": all_stats.get("win"),
                    "draws": all_stats.get("draw"),
                    "losses": all_stats.get("lose"),
                    "goals_for": goals.get("for"),
                    "goals_against": goals.get("against"),
                    "goal_difference": row.get("goalsDiff"),
                    "points": row.get("points"),
                    "form": row.get("form"),
                }
            )
    return out


@router.get("/standings")
async def standings():
    raw = await football_api.get_standings(settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON)
    return {"items": _transform(raw)}
