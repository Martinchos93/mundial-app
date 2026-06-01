from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User, Match, Column, Prediction, Membership
from app.schemas.prediction import PredictionCreate, PredictionOut, GroupPredictionEntry


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


@router.post("", response_model=PredictionOut)
def upsert_prediction(
    payload: PredictionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = db.get(Match, payload.match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    column = db.get(Column, payload.column_id)
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    if column.status == "closed":
        raise HTTPException(status_code=400, detail="Column is closed")

    if not _active_member(db, current_user.id, list(column.group_ids or [])):
        raise HTTPException(status_code=403, detail="Tu ingreso al prode está pendiente de aprobación")

    if _is_locked(match):
        raise HTTPException(status_code=400, detail="Predictions are locked for this match")

    pred = (
        db.query(Prediction)
        .filter(
            Prediction.user_id == current_user.id,
            Prediction.match_id == payload.match_id,
            Prediction.column_id == payload.column_id,
        )
        .one_or_none()
    )
    if pred is None:
        pred = Prediction(
            user_id=current_user.id,
            match_id=payload.match_id,
            column_id=payload.column_id,
        )
        db.add(pred)
    elif pred.locked:
        raise HTTPException(status_code=400, detail="Prediction is locked")

    pred.pred_home_score = payload.pred_home_score
    pred.pred_away_score = payload.pred_away_score
    pred.pred_yellows = payload.pred_yellows
    pred.pred_reds = payload.pred_reds
    db.commit()
    db.refresh(pred)
    return PredictionOut.model_validate(pred)


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
