from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Match, Column, Prediction, Membership, TopScorerPrediction, ChampionPrediction
from app.schemas.prediction import (
    PredictionCreate,
    PredictionOut,
    GroupPredictionEntry,
    TopScorerCreate,
    TopScorerOut,
    ChampionCreate,
    ChampionOut,
)
from app.services.bracket import (
    tournament_top_scorer,
    tournament_champion,
    is_tournament_finished,
    is_topscorer_locked,
)


def _active_member(db: Session, user_id: int, group_ids: list[int]) -> bool:
    if not group_ids:
        return True
    return (
        db.query(Membership)
        .filter(
            Membership.user_id == user_id,
            Membership.group_id.in_(group_ids),
            Membership.status == "active",
        )
        .first()
        is not None
    )

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _is_locked(match: Match) -> bool:
    if match.status != "scheduled":
        return True
    lock_at = match.kickoff_utc - timedelta(minutes=settings.PREDICTION_LOCK_MINUTES)
    return datetime.now(timezone.utc) >= lock_at


@router.get("", response_model=list[PredictionOut])
def my_predictions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    preds = db.query(Prediction).filter(Prediction.user_id == current_user.id).all()
    return [PredictionOut.model_validate(p) for p in preds]


def _apply_pred(db: Session, user_id: int, match_id: int, column_id: int, payload: PredictionCreate):
    """Get-or-create the prediction for (user, match, column) and set its fields.
    Returns None if the existing prediction is already locked (scored)."""
    pred = (
        db.query(Prediction)
        .filter(
            Prediction.user_id == user_id,
            Prediction.match_id == match_id,
            Prediction.column_id == column_id,
        )
        .one_or_none()
    )
    if pred is None:
        pred = Prediction(user_id=user_id, match_id=match_id, column_id=column_id)
        db.add(pred)
    elif pred.locked:
        return None

    pred.pred_home_score = payload.pred_home_score
    pred.pred_away_score = payload.pred_away_score
    pred.pred_yellows = payload.pred_yellows
    pred.pred_reds = payload.pred_reds
    players = [p for p in payload.pred_players if (p.g or p.y or p.r)]
    pred.pred_players = [p.model_dump() for p in players] or None
    pred.pred_scorers = [p.name for p in players if p.g] or None
    pred.pred_cards = [p.name for p in players if (p.y or p.r)] or None
    return pred


def _user_active_columns(db: Session, user_id: int):
    """Open columns belonging to the prodes where the user is an active member."""
    gids = [
        m.group_id
        for m in db.query(Membership).filter(
            Membership.user_id == user_id, Membership.status == "active"
        )
    ]
    if not gids:
        return []
    return (
        db.query(Column)
        .filter(Column.status != "closed", Column.group_ids.overlap(gids))
        .all()
    )


@router.post("", response_model=PredictionOut)
def upsert_prediction(
    payload: PredictionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = db.get(Match, payload.match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if _is_locked(match):
        raise HTTPException(status_code=400, detail="Predictions are locked for this match")

    # Validate the requested prode strictly (this is the one the UI is showing).
    column = db.get(Column, payload.column_id)
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    if column.status == "closed":
        raise HTTPException(status_code=400, detail="Column is closed")
    if not _active_member(db, current_user.id, list(column.group_ids or [])):
        raise HTTPException(status_code=403, detail="Tu ingreso al prode está pendiente de aprobación")

    result = _apply_pred(db, current_user.id, payload.match_id, payload.column_id, payload)
    if result is None:
        raise HTTPException(status_code=400, detail="Prediction is locked")

    # Copy to the user's other active prodes (lenient: skip closed / not-member).
    if payload.apply_to_all:
        for col in _user_active_columns(db, current_user.id):
            if col.id == payload.column_id:
                continue
            if not _active_member(db, current_user.id, list(col.group_ids or [])):
                continue
            _apply_pred(db, current_user.id, payload.match_id, col.id, payload)

    db.commit()
    db.refresh(result)
    return PredictionOut.model_validate(result)


# ---- Prode al goleador (tournament top scorer) -------------------------

@router.get("/top-scorer", response_model=TopScorerOut)
def get_top_scorer(
    column_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pick = (
        db.query(TopScorerPrediction)
        .filter(
            TopScorerPrediction.user_id == current_user.id,
            TopScorerPrediction.column_id == column_id,
        )
        .one_or_none()
    )
    col = db.get(Column, column_id)
    cfg = (col.scoring_config if col else None) or {}
    return TopScorerOut(
        column_id=column_id,
        pick=pick.player_name if pick else None,
        team_name=pick.team_name if pick else None,
        leader=tournament_top_scorer(db),
        locked=is_topscorer_locked(db),
        finished=is_tournament_finished(db),
        points_value=int(cfg.get("pts_top_scorer", 10)),
    )


@router.post("/top-scorer", response_model=TopScorerOut)
def set_top_scorer(
    payload: TopScorerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    column = db.get(Column, payload.column_id)
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    if not _active_member(db, current_user.id, list(column.group_ids or [])):
        raise HTTPException(status_code=403, detail="Tu ingreso al prode está pendiente de aprobación")
    # The top-scorer pick can be changed until matchday 1 has been played.
    if is_topscorer_locked(db):
        raise HTTPException(
            status_code=400,
            detail="El goleador ya no se puede cambiar: se jugó la primera fecha",
        )

    name = payload.player_name.strip()
    team = (payload.team_name or "").strip() or None

    def _set(column_id: int):
        p = (
            db.query(TopScorerPrediction)
            .filter(
                TopScorerPrediction.user_id == current_user.id,
                TopScorerPrediction.column_id == column_id,
            )
            .one_or_none()
        )
        if p is None:
            p = TopScorerPrediction(user_id=current_user.id, column_id=column_id)
            db.add(p)
        p.player_name = name
        p.team_name = team
        return p

    pick = _set(payload.column_id)
    if payload.apply_to_all:
        for col in _user_active_columns(db, current_user.id):
            if col.id == payload.column_id:
                continue
            if not _active_member(db, current_user.id, list(col.group_ids or [])):
                continue
            _set(col.id)
    db.commit()

    col = db.get(Column, payload.column_id)
    cfg = (col.scoring_config if col else None) or {}
    return TopScorerOut(
        column_id=payload.column_id,
        pick=pick.player_name,
        team_name=pick.team_name,
        leader=tournament_top_scorer(db),
        locked=is_topscorer_locked(db),
        finished=is_tournament_finished(db),
        points_value=int(cfg.get("pts_top_scorer", 10)),
    )


# ---- Campeón del torneo (initial prediction) --------------------------

@router.get("/champion", response_model=ChampionOut)
def get_champion(
    column_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pick = (
        db.query(ChampionPrediction)
        .filter(
            ChampionPrediction.user_id == current_user.id,
            ChampionPrediction.column_id == column_id,
        )
        .one_or_none()
    )
    col = db.get(Column, column_id)
    cfg = (col.scoring_config if col else None) or {}
    return ChampionOut(
        column_id=column_id,
        pick=pick.team_name if pick else None,
        champion=tournament_champion(db),
        started=is_topscorer_locked(db),  # editable until matchday 1 is played
        finished=is_tournament_finished(db),
        points_value=int(cfg.get("pts_champion", 15)),
    )


@router.post("/champion", response_model=ChampionOut)
def set_champion(
    payload: ChampionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    column = db.get(Column, payload.column_id)
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    if not _active_member(db, current_user.id, list(column.group_ids or [])):
        raise HTTPException(status_code=403, detail="Tu ingreso al prode está pendiente de aprobación")
    if is_topscorer_locked(db):
        raise HTTPException(
            status_code=400,
            detail="El campeón ya no se puede cambiar: se jugó la primera fecha",
        )

    team = payload.team_name.strip()

    def _set(column_id: int):
        p = (
            db.query(ChampionPrediction)
            .filter(
                ChampionPrediction.user_id == current_user.id,
                ChampionPrediction.column_id == column_id,
            )
            .one_or_none()
        )
        if p is None:
            p = ChampionPrediction(user_id=current_user.id, column_id=column_id)
            db.add(p)
        p.team_name = team
        return p

    pick = _set(payload.column_id)
    if payload.apply_to_all:
        for col in _user_active_columns(db, current_user.id):
            if col.id == payload.column_id:
                continue
            if not _active_member(db, current_user.id, list(col.group_ids or [])):
                continue
            _set(col.id)
    db.commit()

    col = db.get(Column, payload.column_id)
    cfg = (col.scoring_config if col else None) or {}
    return ChampionOut(
        column_id=payload.column_id,
        pick=pick.team_name,
        champion=tournament_champion(db),
        started=is_topscorer_locked(db),
        finished=is_tournament_finished(db),
        points_value=int(cfg.get("pts_champion", 15)),
    )


@router.get("/match/{match_id}", response_model=list[GroupPredictionEntry])
def group_predictions(
    match_id: int,
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member_ids = [
        m.user_id
        for m in db.query(Membership).filter(
            Membership.group_id == group_id, Membership.status == "active"
        )
    ]
    if not member_ids:
        return []

    rows = (
        db.query(Prediction, User)
        .join(User, User.id == Prediction.user_id)
        .filter(Prediction.match_id == match_id, User.id.in_(member_ids))
        .all()
    )
    out: list[GroupPredictionEntry] = []
    for pred, user in rows:
        out.append(
            GroupPredictionEntry(
                user_id=user.id,
                name=user.display_name,
                avatar_emoji=user.avatar_emoji,
                pred_home_score=pred.pred_home_score,
                pred_away_score=pred.pred_away_score,
                pred_yellows=pred.pred_yellows,
                pred_reds=pred.pred_reds,
                total=pred.score.total if pred.score else 0,
            )
        )
    return out
