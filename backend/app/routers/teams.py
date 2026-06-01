from fastapi import APIRouter

from app.config import settings
from app.services import football_api

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("")
async def list_teams():
    teams = await football_api.get_teams(settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON)
    return {"items": teams}


@router.get("/{team_id}")
async def get_team(team_id: int):
    team = await football_api.get_team(team_id)
    stats = await football_api.get_team_statistics(
        team_id, settings.WORLD_CUP_LEAGUE_ID, settings.WORLD_CUP_SEASON
    )
    return {"team": team, "statistics": stats}


@router.get("/{team_id}/matches")
async def get_team_matches(team_id: int, last: int = 5):
    return {"items": await football_api.get_team_last_fixtures(team_id, last=last)}
