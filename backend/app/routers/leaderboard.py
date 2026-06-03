from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Group, User, Prediction, Score, Match, Membership, Column,
    TopScorerPrediction, ChampionPrediction,
)
from app.schemas.group import Leaderboard, LeaderboardEntry
from app.services.bracket import tournament_top_scorer, tournament_champion, is_tournament_finished

router = APIRouter(prefix="/groups", tags=["leaderboard"])


def _build_leaderboard(db: Session, group_id: int, only_today: bool) -> list[LeaderboardEntry]:
    users = (
        db.query(User)
        .join(Membership, Membership.user_id == User.id)
        .filter(Membership.group_id == group_id, Membership.status == "active")
        .all()
    )
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

    # Tournament-long bonuses (top scorer + champion), awarded once the final is
    # played. "Today" views exclude them — they're prizes, not daily deltas.
    if not only_today and is_tournament_finished(db):
        user_ids = [u.id for u in users]
        col_ids = [c.id for c in db.query(Column).filter(Column.group_ids.any(group_id)).all()]

        def _award(model, target: str | None, attr: str, cfg_key: str, default: int):
            if not target or not col_ids:
                return
            tgt = target.strip().casefold()
            picks = (
                db.query(model)
                .filter(model.column_id.in_(col_ids), model.user_id.in_(user_ids))
                .all()
            )
            for p in picks:
                if (getattr(p, attr) or "").strip().casefold() == tgt:
                    col = db.get(Column, p.column_id)
                    bonus = int((col.scoring_config or {}).get(cfg_key, default)) if col else default
                    points_by_user[p.user_id] = points_by_user.get(p.user_id, 0) + bonus

        leader = tournament_top_scorer(db)
        _award(TopScorerPrediction, leader["name"] if leader else None, "player_name", "pts_top_scorer", 10)
        _award(ChampionPrediction, tournament_champion(db), "team_name", "pts_champion", 15)

    entries = [
        LeaderboardEntry(
            user_id=u.id,
            name=u.display_name,
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
