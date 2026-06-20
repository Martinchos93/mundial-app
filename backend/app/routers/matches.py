from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match
from app.schemas.match import MatchOut, MatchList, MatchLive, MatchEvent, TeamLineup
from app.services import football_api
from app.redis_client import matches_cache_version, matches_cache_get, matches_cache_set

router = APIRouter(prefix="/matches", tags=["matches"])

# /matches is the shared heavy read (fixture/prode/detail). Cache the serialized
# response in Redis with a short TTL; the version key is bumped on any match
# write so admins/sync see changes immediately (TTL is just a safety net).
_MATCHES_TTL = 60


@router.get("", response_model=MatchList)
def list_matches(
    date: str | None = Query(default=None, description="YYYY-MM-DD (UTC)"),
    phase: str | None = None,
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    ver = matches_cache_version()
    cache_key = None
    if ver is not None:
        cache_key = f"matches:{ver}:{page}:{page_size}:{date or ''}:{phase or ''}:{status or ''}"
        cached = matches_cache_get(cache_key)
        if cached is not None:
            return Response(content=cached, media_type="application/json")

    q = db.query(Match)
    if date:
        try:
            day = datetime.fromisoformat(date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        end = datetime(day.year, day.month, day.day, 23, 59, 59, tzinfo=timezone.utc)
        q = q.filter(Match.kickoff_utc >= start, Match.kickoff_utc <= end)
    if phase:
        q = q.filter(Match.phase == phase)
    if status:
        q = q.filter(Match.status == status)

    total = q.count()
    items = (
        q.order_by(Match.kickoff_utc.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    payload = MatchList(
        items=[MatchOut.model_validate(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    if cache_key is not None:
        matches_cache_set(cache_key, payload.model_dump_json(), _MATCHES_TTL)
    return payload


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return MatchOut.model_validate(match)


@router.get("/{match_id}/live", response_model=MatchLive)
def get_match_live(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return MatchLive.model_validate(match)


@router.get("/{match_id}/events", response_model=list[MatchEvent])
async def get_match_events(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match.api_id:
        return []
    raw = await football_api.get_fixture_events(match.api_id)
    events: list[MatchEvent] = []
    for e in raw:
        events.append(
            MatchEvent(
                minute=(e.get("time") or {}).get("elapsed"),
                type=e.get("type"),
                detail=e.get("detail"),
                team=(e.get("team") or {}).get("name"),
                player=(e.get("player") or {}).get("name"),
                assist=(e.get("assist") or {}).get("name"),
            )
        )
    return events


@router.get("/{match_id}/lineups", response_model=list[TeamLineup])
async def get_match_lineups(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if not match.api_id:
        return []
    raw = await football_api.get_fixture_lineups(match.api_id)
    lineups: list[TeamLineup] = []
    for block in raw:
        def _players(items):
            out = []
            for it in items or []:
                p = it.get("player", {})
                out.append(
                    {"name": p.get("name"), "number": p.get("number"), "pos": p.get("pos"), "grid": p.get("grid")}
                )
            return out

        lineups.append(
            TeamLineup(
                team=(block.get("team") or {}).get("name"),
                formation=block.get("formation"),
                coach=(block.get("coach") or {}).get("name"),
                startXI=_players(block.get("startXI")),
                substitutes=_players(block.get("substitutes")),
            )
        )
    return lineups
