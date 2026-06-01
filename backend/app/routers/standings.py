from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Match
from app.services import football_api

router = APIRouter(tags=["standings"])


def _strip_group(name: str | None) -> str | None:
    if not name:
        return None
    parts = name.strip().split()
    return parts[-1] if parts else name


def _transform_api(raw: list[dict]) -> list[dict]:
    out: list[dict] = []
    if not raw:
        return out
    league = (raw[0] or {}).get("league", {})
    for group_rows in league.get("standings", []) or []:
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
                    "flag_emoji": "",
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


def _derive_from_matches(db: Session) -> list[dict]:
    """Build standings from local matches whose phase is 'Grupo X'.

    Computes W/D/L/points from finished matches; pre-tournament everything is 0.
    """
    matches = db.query(Match).filter(Match.phase.ilike("Grupo %")).all()
    table: dict[tuple[str, str], dict] = {}

    def row(group: str, team: str) -> dict:
        key = (group, team)
        if key not in table:
            table[key] = {
                "id": None, "external_id": None, "name": team, "short_name": team,
                "logo_url": None, "flag_emoji": "", "group": group,
                "played": 0, "wins": 0, "draws": 0, "losses": 0,
                "goals_for": 0, "goals_against": 0, "goal_difference": 0, "points": 0, "form": "",
            }
        return table[key]

    for m in matches:
        group = (m.phase or "").split()[-1]
        h = row(group, m.home_team)
        a = row(group, m.away_team)
        # register team ids if known
        if m.home_team_id:
            h["id"] = h["external_id"] = m.home_team_id
        if m.away_team_id:
            a["id"] = a["external_id"] = m.away_team_id
        if m.status != "finished" or m.home_score is None or m.away_score is None:
            continue
        hs, as_ = m.home_score, m.away_score
        for r, gf, ga in ((h, hs, as_), (a, as_, hs)):
            r["played"] += 1
            r["goals_for"] += gf
            r["goals_against"] += ga
            r["goal_difference"] = r["goals_for"] - r["goals_against"]
        if hs > as_:
            h["wins"] += 1; h["points"] += 3; a["losses"] += 1
        elif hs < as_:
            a["wins"] += 1; a["points"] += 3; h["losses"] += 1
        else:
            h["draws"] += 1; a["draws"] += 1; h["points"] += 1; a["points"] += 1

    rows = list(table.values())
    rows.sort(key=lambda r: (r["group"], -r["points"], -r["goal_difference"]))
    return rows


@router.get("/standings")
async def standings(db: Session = Depends(get_db)):
    raw = await football_api.get_standings(settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON)
    items = _transform_api(raw)
    if not items:
        items = _derive_from_matches(db)
    return {"items": items}
