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
global_router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@global_router.get("/global")
def global_ranking(page: int = 1, page_size: int = 10, db: Session = Depends(get_db)):
    """Site-wide ranking of all players by total points. Points are deduplicated
    per match (max across a user's prodes) so playing many prodes never inflates
    the score. Paginated."""
    page = max(1, page)
    page_size = min(max(1, page_size), 50)

    # Best score per (user, match) — collapses the same pick made in many prodes.
    best = (
        db.query(
            Prediction.user_id.label("uid"),
            Prediction.match_id.label("mid"),
            func.max(Score.total).label("best"),
        )
        .join(Score, Score.prediction_id == Prediction.id)
        .group_by(Prediction.user_id, Prediction.match_id)
        .subquery()
    )
    totals = (
        db.query(best.c.uid.label("uid"), func.sum(best.c.best).label("pts"))
        .group_by(best.c.uid)
        .subquery()
    )

    total = db.query(func.count()).select_from(totals).scalar() or 0
    rows = (
        db.query(User, totals.c.pts)
        .join(totals, totals.c.uid == User.id)
        .order_by(totals.c.pts.desc(), User.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    start = (page - 1) * page_size
    entries = [
        {
            "rank": start + i + 1,
            "user_id": u.id,
            "name": u.display_name,
            "avatar_emoji": u.avatar_emoji or "⚽",
            "points": int(pts or 0),
        }
        for i, (u, pts) in enumerate(rows)
    ]
    return {"entries": entries, "total": total, "page": page, "page_size": page_size}


def _build_leaderboard(db: Session, group_id: int, only_today: bool) -> list[LeaderboardEntry]:
    users = (
        db.query(User)
        .join(Membership, Membership.user_id == User.id)
        .filter(Membership.group_id == group_id, Membership.status == "active")
        .all()
    )
    if not users:
        return []

    user_ids = [u.id for u in users]
    # Only this prode's columns — otherwise a user in several prodes would have
    # all their predictions summed into every prode's table.
    col_ids = [c.id for c in db.query(Column).filter(Column.group_ids.any(group_id)).all()]
    if not col_ids:
        col_ids = [-1]  # no columns → nothing to sum

    q = (
        db.query(Prediction.user_id, func.coalesce(func.sum(Score.total), 0))
        .join(Score, Score.prediction_id == Prediction.id)
        .join(Match, Match.id == Prediction.match_id)
        .filter(Prediction.user_id.in_(user_ids), Prediction.column_id.in_(col_ids))
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


@router.get("/{group_id}/breakdown")
def breakdown(group_id: int, db: Session = Depends(get_db)):
    """Per-match points for every member: who summed how much in each match."""
    if db.get(Group, group_id) is None:
        raise HTTPException(status_code=404, detail="Group not found")

    users = (
        db.query(User)
        .join(Membership, Membership.user_id == User.id)
        .filter(Membership.group_id == group_id, Membership.status == "active")
        .all()
    )
    member_ids = [u.id for u in users]
    members = [
        {"user_id": u.id, "name": u.display_name, "avatar_emoji": u.avatar_emoji} for u in users
    ]
    if not member_ids:
        return {"members": [], "matches": []}

    # Scope to this prode's columns (a user may play several prodes).
    col_ids = [c.id for c in db.query(Column).filter(Column.group_ids.any(group_id)).all()] or [-1]

    rows = (
        db.query(
            Prediction.user_id,
            Prediction.match_id,
            Score.total,
            Prediction.pred_home_score,
            Prediction.pred_away_score,
            Prediction.pred_yellows,
            Prediction.pred_reds,
            Prediction.pred_scorers,
            Score.pts_result,
            Score.pts_exact,
            Score.pts_bonus,
            Score.pts_yellows,
            Score.pts_reds,
            Score.pts_scorers,
            Score.pts_cards,
        )
        .join(Score, Score.prediction_id == Prediction.id)
        .join(Match, Match.id == Prediction.match_id)
        .filter(
            Prediction.user_id.in_(member_ids),
            Prediction.column_id.in_(col_ids),
            Match.status == "finished",
        )
        .all()
    )
    points: dict[int, dict[int, int]] = {}
    preds: dict[int, dict[int, str]] = {}
    comps: dict[int, dict[int, dict]] = {}
    for (
        uid, mid, total, ph, pa, pyel, pred, pscorers,
        p_result, p_exact, p_bonus, p_yellows, p_reds, p_scorers, p_cards,
    ) in rows:
        slot = points.setdefault(mid, {})
        slot[uid] = slot.get(uid, 0) + int(total or 0)
        preds.setdefault(mid, {})[uid] = f"{ph}-{pa}"
        comps.setdefault(mid, {})[uid] = {
            "pred_yellows": pyel or 0,
            "pred_reds": pred or 0,
            "pred_scorers": pscorers or [],
            "pts_result": p_result or 0,
            "pts_exact": p_exact or 0,
            "pts_bonus": p_bonus or 0,
            "pts_yellows": p_yellows or 0,
            "pts_reds": p_reds or 0,
            "pts_scorers": p_scorers or 0,
            "pts_cards": p_cards or 0,
        }

    matches = (
        db.query(Match).filter(Match.id.in_(points.keys())).order_by(Match.kickoff_utc.desc()).all()
        if points
        else []
    )
    matches_out = [
        {
            "id": m.id,
            "home_team": m.home_team,
            "away_team": m.away_team,
            "home_score": m.home_score,
            "away_score": m.away_score,
            "phase": m.phase,
            "kickoff_utc": m.kickoff_utc.isoformat() if m.kickoff_utc else None,
            "home_yellows": m.home_yellows,
            "away_yellows": m.away_yellows,
            "home_reds": m.home_reds,
            "away_reds": m.away_reds,
            "scorers": m.scorers or [],
            "points": points.get(m.id, {}),
            "preds": preds.get(m.id, {}),
            "comps": comps.get(m.id, {}),
        }
        for m in matches
    ]
    return {"members": members, "matches": matches_out}


@router.get("/{group_id}/leaderboard/live", response_model=Leaderboard)
def leaderboard_live(group_id: int, db: Session = Depends(get_db)):
    if db.get(Group, group_id) is None:
        raise HTTPException(status_code=404, detail="Group not found")
    # "live" delta = points earned from matches kicking off today (live/finished)
    entries = _build_leaderboard(db, group_id, only_today=True)
    for e in entries:
        e.delta_today = e.points
    return Leaderboard(group_id=group_id, entries=entries)
