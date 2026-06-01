from fastapi import APIRouter

from app.config import settings
from app.services import football_api

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/{player_id}")
async def get_player(player_id: int):
    player = await football_api.get_player(player_id, settings.WORLD_CUP_SEASON)
    return {"player": player}


@router.get("/{player_id}/stats")
async def get_player_stats(player_id: int):
    player = await football_api.get_player(player_id, settings.WORLD_CUP_SEASON)
    statistics = (player or {}).get("statistics", []) if player else []
    return {"player": (player or {}).get("player") if player else None, "statistics": statistics}
