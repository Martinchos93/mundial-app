from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin_token
from app.models import Column, Match, Prediction, User, Group, AIPrediction
from app.models.column import DEFAULT_SCORING_CONFIG
from app.schemas.column import ColumnCreate, ColumnUpdate, ColumnOut, ColumnStats
from app.services.sync import recalculate_column

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin_token)])


def _column_stats(db: Session, col: Column) -> ColumnStats:
    total_predictions = (
        db.query(func.count(Prediction.id)).filter(Prediction.column_id == col.id).scalar() or 0
    )
    base = ColumnOut.model_validate(col).model_dump()
    return ColumnStats(
        **base,
        total_predictions=int(total_predictions),
        total_matches=len(col.match_ids or []),
        total_groups=len(col.group_ids or []),
    )


@router.get("/columns", response_model=list[ColumnStats])
def list_columns(db: Session = Depends(get_db)):
    cols = db.query(Column).order_by(Column.created_at.desc()).all()
    return [_column_stats(db, c) for c in cols]


@router.post("/columns", response_model=ColumnOut, status_code=201)
def create_column(payload: ColumnCreate, db: Session = Depends(get_db)):
    col = Column(
        name=payload.name,
        phase=payload.phase,
        group_ids=payload.group_ids,
        match_ids=payload.match_ids,
        scoring_config=payload.scoring_config or dict(DEFAULT_SCORING_CONFIG),
        starts_at=payload.starts_at,
        closes_at=payload.closes_at,
        status="draft",
    )
    db.add(col)
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.put("/columns/{column_id}", response_model=ColumnOut)
def update_column(column_id: int, payload: ColumnUpdate, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(col, field, value)
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/columns/{column_id}/activate", response_model=ColumnOut)
def activate_column(column_id: int, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    col.status = "active"
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/columns/{column_id}/close", response_model=ColumnOut)
def close_column(column_id: int, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    col.status = "closed"
    db.commit()
    db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/columns/{column_id}/recalculate")
def recalculate(column_id: int, db: Session = Depends(get_db)):
    col = db.get(Column, column_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    count = recalculate_column(db, col)
    return {"column_id": column_id, "recalculated_predictions": count}


@router.get("/stats")
def global_stats(db: Session = Depends(get_db)):
    return {
        "users": db.query(func.count(User.id)).scalar() or 0,
        "groups": db.query(func.count(Group.id)).scalar() or 0,
        "matches": db.query(func.count(Match.id)).scalar() or 0,
        "live_matches": db.query(func.count(Match.id)).filter(Match.status == "live").scalar() or 0,
        "predictions": db.query(func.count(Prediction.id)).scalar() or 0,
        "ai_predictions": db.query(func.count(AIPrediction.id)).scalar() or 0,
        "columns": db.query(func.count(Column.id)).scalar() or 0,
    }
