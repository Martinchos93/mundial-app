from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_admin
from app.models import Player
from app.services.squads import sync_squads
from app.services.player_info import enrich_players, enrich_details

router = APIRouter(tags=["squads"])

# position sort order for a nice roster layout (static uses GK/DF/MF/FW)
_POS_ORDER = {
    "GK": 0, "DF": 1, "MF": 2, "FW": 3,
    "Goalkeeper": 0, "Defender": 1, "Midfielder": 2, "Attacker": 3,
}


@router.get("/squad/{team_name}")
def squad(team_name: str, db: Session = Depends(get_db)):
    players = db.query(Player).filter(Player.team_name == team_name).all()
    players.sort(key=lambda p: (_POS_ORDER.get(p.position or "", 9), p.number or 99))
    return {
        "team": team_name,
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "position": p.position,
                "number": p.number,
                "age": p.age,
                "photo_url": p.photo_url,
                "bio": p.bio,
                "wiki_url": p.wiki_url,
                "club": p.club,
                "birth_date": p.birth_date,
                "season_apps": p.season_apps,
                "season_goals": p.season_goals,
            }
            for p in players
        ],
    }


@router.get("/players-search")
def search_players(q: str = Query(default="", min_length=0), limit: int = 20, db: Session = Depends(get_db)):
    """Search players by name (for the top-scorer picker). Forwards ranked first."""
    query = db.query(Player)
    term = q.strip()
    if term:
        like = f"%{term}%"
        query = query.filter(or_(Player.name.ilike(like), Player.team_name.ilike(like)))
    players = query.limit(200).all()
    fwd = {"FW": 0, "Attacker": 0, "MF": 1, "Midfielder": 1}
    players.sort(key=lambda p: (fwd.get(p.position or "", 2), p.name or ""))
    return {
        "players": [
            {
                "id": p.id,
                "name": p.name,
                "team": p.team_name,
                "position": p.position,
                "photo_url": p.photo_url,
            }
            for p in players[: max(1, min(limit, 50))]
        ]
    }


@router.get("/player/{player_id}")
def player(player_id: int, db: Session = Depends(get_db)):
    p = db.get(Player, player_id)
    if p is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Player not found")
    return {
        "id": p.id,
        "team": p.team_name,
        "name": p.name,
        "position": p.position,
        "number": p.number,
        "age": p.age,
        "photo_url": p.photo_url,
        "bio": p.bio,
        "wiki_url": p.wiki_url,
    }


@router.post("/admin/squads/sync", dependencies=[Depends(get_current_admin)])
async def squads_sync(only_missing: bool = True, db: Session = Depends(get_db)):
    """Fetch squads from API-Football for all group-stage teams (resumable)."""
    return await sync_squads(db, only_missing=only_missing)


@router.post("/admin/squads/enrich", dependencies=[Depends(get_current_admin)])
def squads_enrich(only_missing: bool = True, limit: int | None = None, db: Session = Depends(get_db)):
    """Add photo + bio to players from Wikipedia (free, no quota)."""
    return enrich_players(db, only_missing=only_missing, limit=limit)


@router.post("/admin/squads/enrich-details", dependencies=[Depends(get_current_admin)])
def squads_enrich_details(only_missing: bool = True, limit: int | None = None, db: Session = Depends(get_db)):
    """Add current club + birth date (+ age) from Wikidata (free, no quota)."""
    return enrich_details(db, only_missing=only_missing, limit=limit)
