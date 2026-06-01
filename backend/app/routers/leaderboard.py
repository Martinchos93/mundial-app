from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, User, Prediction, Score, Match
from app.schemas.group import Leaderboard, LeaderboardEntry

router = APIRouter(prefix="/groups", tags=["leaderboard"])


def _build_leaderboard(db: Session, group_id: int, only_today: bool) -> list[LeaderboardEntry]:
    users = db.query(User).filter(User.group_id == group_id).all()
    if not users:
        return []

    q = (
        db.query(Prediction.user_id, func.coalesce(func.sum(Score.total), 0))
        .join(Score, Score.prediction_id == Prediction.id)
        .join(Match, Match.id == Prediction.match_id)
        .filter(Prediction.user_id.in_([u.id for u in users]))
        .group_by(Prediction.user_id)
    )
    if only_today:
        today = datetime.now(timezone.utc).date()
        start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
        q = q.filter(Match.kickoff_utc >= start)

    points_by_user = {uid: int(total) for uid, total in q.all()}

    entries = [
        LeaderboardEntry(
            user_id=u.id,
            name=u.name,
            avatar_emoji=u.avatar_emoji,
            points=points_by_user.get(u.id, 0),
        )
        for u in users
    ]
    entries.sort(key=lambda e: e.points, reverse=True)
    for i, e in enumerate(entries, start=1):
        e.rank = i
    return entries


@router.get("/{group_id}/leaderboard", response_model=Leaderboard)
def leaderboard(group_id: int, db: Session = Depends(get_db)):
    if db.get(Group, group_id) is None:
        raise HTTPException(status_code=404, detail="Group not found")
    entries = _build_leaderboard(db, group_id, only_today=False)
    # attach today's delta
    deltas = {e.user_id: e.points for e in _build_leaderboard(db, group_id, only_today=True)}
    for e in entries:
        e.delta_today = deltas.get(e.user_id, 0)
    return Leaderboard(group_id=group_id, entries=entries)


@router.get("/{group_id}/leaderboard/live", response_model=Leaderboard)
def leaderboard_live(group_id: int, db: Session = Depends(get_db)):
    if db.get(Group, group_id) is None:
        raise HTTPException(status_code=404, detail="Group not found")
    # "live" delta = points earned from matches kicking off today (live/finished)
    entries = _build_leaderboard(db, group_id, only_today=True)
    for e in entries:
        e.delta_today = e.points
    return Leaderboard(group_id=group_id, entries=entries)
